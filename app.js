// WFRP4 Helper
// Denominations: P (penny), S (shilling), ZK (gold crown)
// 1 S = 12 P
// 1 ZK = 20 S = 240 P

(() => {
  const RATE_S = 12;
  const RATE_ZK = 20 * RATE_S;

  const STORAGE_WALLET = "wfrp_wallet";
  const STORAGE_SETTINGS = "wfrp_settings";

  // ---------- Helpers ----------
  function $(id) { return document.getElementById(id); }
  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return document.querySelectorAll(sel); }

  function on(el, evt, fn) { if (el) el.addEventListener(evt, fn); }
  function onAll(list, evt, fn) { if (list) list.forEach(el => el && el.addEventListener(evt, fn)); }

  function clampInt(n) {
    const x = Number.isFinite(n) ? Math.trunc(n) : 0;
    return x < 0 ? 0 : x;
  }

  function toTotalP(m) {
    const p = clampInt(Number(m?.p ?? 0));
    const s = clampInt(Number(m?.s ?? 0));
    const zk = clampInt(Number(m?.zk ?? 0));
    return p + s * RATE_S + zk * RATE_ZK;
  }

  function fromTotalP(totalP) {
    const t = Math.max(0, Math.trunc(totalP));
    const zk = Math.floor(t / RATE_ZK);
    const rest = t - zk * RATE_ZK;
    const s = Math.floor(rest / RATE_S);
    const p = rest - s * RATE_S;
    return { p, s, zk };
  }

  function fmtMoney({ p, s, zk }) {
    return `${p} P • ${s} S • ${zk} ZK`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- State ----------
  let opMode = "spend"; // "spend" | "add"
  let calc = 0;

  let settings = { autoApply: true }; // default ON

  // ---------- Elements (resolved after DOM ready) ----------
  let els = null;

  function readWalletInputs() {
    return {
      p: Number(els.wP?.value || 0),
      s: Number(els.wS?.value || 0),
      zk: Number(els.wZK?.value || 0)
    };
  }

  function writeWalletInputs(m) {
    if (els.wP) els.wP.value = String(clampInt(m.p));
    if (els.wS) els.wS.value = String(clampInt(m.s));
    if (els.wZK) els.wZK.value = String(clampInt(m.zk));
  }

  function readChangeInputs() {
    return {
      p: Number(els.cP?.value || 0),
      s: Number(els.cS?.value || 0),
      zk: Number(els.cZK?.value || 0)
    };
  }

  function setResult(html) {
    if (!els.walletResult) return;
    const content = (html || "").trim();
    if (!content) {
      els.walletResult.classList.add("is-hidden");
      els.walletResult.innerHTML = "";
      return;
    }
    els.walletResult.classList.remove("is-hidden");
    els.walletResult.innerHTML = content;
  }

  function setSettingsMsg(html) {
    if (!els.settingsMsg) return;
    const content = (html || "").trim();
    if (!content) {
      els.settingsMsg.classList.add("is-hidden");
      els.settingsMsg.innerHTML = "";
      return;
    }
    els.settingsMsg.classList.remove("is-hidden");
    els.settingsMsg.innerHTML = content;
  }

  // ---------- Persistence ----------
  function saveSettings() {
    try { localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings)); } catch {}
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (typeof obj.autoApply === "boolean") settings.autoApply = obj.autoApply;
    } catch {}
  }

  function saveWallet() {
    const w = fromTotalP(toTotalP(readWalletInputs()));
    try {
      localStorage.setItem(STORAGE_WALLET, JSON.stringify(w));
      setSettingsMsg(`<div class="ok"><strong>Zapisano sakiewkę.</strong> ${escapeHtml(fmtMoney(w))}</div>`);
    } catch {
      setSettingsMsg(`<div class="bad"><strong>Nie udało się zapisać.</strong> LocalStorage może być zablokowany.</div>`);
    }
  }

  function loadWallet() {
    try {
      const raw = localStorage.getItem(STORAGE_WALLET);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      const safe = fromTotalP(toTotalP(obj));
      writeWalletInputs(safe);
      return true;
    } catch {
      return false;
    }
  }

  function resetWallet() {
    writeWalletInputs({ p: 0, s: 0, zk: 0 });
    setResult("");
    setSettingsMsg(`<div class="ok"><strong>Zresetowano.</strong> Sakiewka ustawiona na 0.</div>`);
  }

  function exportWallet() {
    const w = fromTotalP(toTotalP(readWalletInputs()));
    const payload = { wallet: w, settings: { autoApply: !!settings.autoApply } };
    if (els.walletJson) els.walletJson.value = JSON.stringify(payload);
    setSettingsMsg(`<div class="ok"><strong>Export gotowy.</strong></div>`);
  }

  async function copyWalletJson() {
    const text = (els.walletJson?.value || "").trim();
    if (!text) {
      setSettingsMsg(`<div class="bad"><strong>Brak danych.</strong> Kliknij Export lub wklej JSON.</div>`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setSettingsMsg(`<div class="ok"><strong>Skopiowano.</strong></div>`);
    } catch {
      setSettingsMsg(`<div class="bad"><strong>Nie udało się skopiować.</strong> Skopiuj ręcznie.</div>`);
    }
  }

  function importWallet() {
    const raw = (els.walletJson?.value || "").trim();
    if (!raw) {
      setSettingsMsg(`<div class="bad"><strong>Brak JSON.</strong> Wklej dane do pola.</div>`);
      return;
    }
    try {
      const data = JSON.parse(raw);

      // Obsługa dwóch formatów:
      // 1) {wallet:{p,s,zk}, settings:{autoApply}}
      // 2) {p,s,zk}
      const w = data.wallet ? data.wallet : data;
      const safe = fromTotalP(toTotalP(w));
      writeWalletInputs(safe);

      if (typeof data.settings?.autoApply === "boolean") {
        settings.autoApply = !!data.settings.autoApply;
        if (els.toggleAutoApply) els.toggleAutoApply.checked = settings.autoApply;
        saveSettings();
      }

      setSettingsMsg(`<div class="ok"><strong>Zaimportowano.</strong> ${escapeHtml(fmtMoney(safe))}</div>`);
    } catch {
      setSettingsMsg(`<div class="bad"><strong>Błąd JSON.</strong></div>`);
    }
  }

  // ---------- Tabs ----------
  function setTab(name) {
    els.tabs.forEach(t => t.classList.toggle("is-active", t.dataset.tab === name));
    Object.entries(els.pages).forEach(([key, node]) => {
      if (node) node.classList.toggle("is-active", key === name);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Segmented mode ----------
  function setMode(mode, clickedBtn = null) {
    opMode = mode;
    els.segs.forEach(s => s.classList.toggle("is-active", s === clickedBtn));
  }

  // ---------- Wallet operation ----------
  function applyOperation() {
    const wallet = fromTotalP(toTotalP(readWalletInputs()));
    const change = readChangeInputs();

    const beforeTotal = toTotalP(wallet);
    const changeTotal = toTotalP(change);

    if (changeTotal === 0) {
      setResult(`<div class="bad"><strong>Brak operacji.</strong> Wpisz kwotę do dodania lub wydania.</div>`);
      return;
    }

    const delta = (opMode === "add") ? changeTotal : -changeTotal;
    const afterTotal = beforeTotal + delta;

    if (afterTotal < 0) {
      setResult(`<div class="bad"><strong>Brak środków.</strong> Nie masz wystarczająco monet na tę operację.</div>`);
      return;
    }

    const after = fromTotalP(afterTotal);

    if (settings.autoApply) {
      writeWalletInputs(after);
    }

    const actionLabel = opMode === "add" ? "Dodano" : "Wydano";
    const changeNorm = fromTotalP(changeTotal);

    const note = settings.autoApply
      ? ""
      : `<br/><span class="muted small">Auto-podmienianie OFF — stan sakiewki u góry nie został zmieniony.</span>`;

    setResult(`
      <div class="ok">
        <strong>${escapeHtml(actionLabel)}:</strong> <strong>${escapeHtml(fmtMoney(changeNorm))}</strong><br/>
        <span class="muted small">Nowy stan (wynik):</span> <strong>${escapeHtml(fmtMoney(after))}</strong>
        ${note}
      </div>
    `);
  }

  // ---------- Modal (Settings) ----------
  function openModal() {
    if (!els.modal) return;
    els.modal.classList.remove("is-hidden");
    setSettingsMsg("");
    if (els.toggleAutoApply) els.toggleAutoApply.checked = !!settings.autoApply;
  }

  function closeModal() {
    if (!els.modal) return;
    els.modal.classList.add("is-hidden");
    setSettingsMsg("");
  }

  // ---------- Mini calculator ----------
  function renderCalc() {
    if (els.calcValue) els.calcValue.textContent = String(calc);
  }

  function addCalc(delta) {
    calc = Math.trunc(calc + delta);
    renderCalc();
  }

  // ---------- PD table (podgląd) ----------
  const DEV_COSTS = [
    { range: "0 do 5",   min: 0,  max: 5,  cechy: 25,  um: 10 },
    { range: "6 do 10",  min: 6,  max: 10, cechy: 30,  um: 15 },
    { range: "11 do 15", min: 11, max: 15, cechy: 40,  um: 20 },
    { range: "16 do 20", min: 16, max: 20, cechy: 50,  um: 30 },
    { range: "21 do 25", min: 21, max: 25, cechy: 70,  um: 40 },
    { range: "26 do 30", min: 26, max: 30, cechy: 90,  um: 60 },
    { range: "31 do 35", min: 31, max: 35, cechy: 120, um: 80 },
    { range: "36 do 40", min: 36, max: 40, cechy: 150, um: 110 },
    { range: "41 do 45", min: 41, max: 45, cechy: 190, um: 140 },
    { range: "46 do 50", min: 46, max: 50, cechy: 230, um: 180 },
    { range: "51 do 55", min: 51, max: 55, cechy: 280, um: 220 },
    { range: "56 do 60", min: 56, max: 60, cechy: 330, um: 270 },
    { range: "61 do 65", min: 61, max: 65, cechy: 390, um: 320 },
    { range: "66 do 70", min: 66, max: 70, cechy: 450, um: 380 },
    { range: "ponad 70", min: 71, max: Infinity, cechy: 520, um: 440 }
  ];

  function renderDevTable() {
    if (!els.tblDevBody) return;
    els.tblDevBody.innerHTML = DEV_COSTS.map(r => `
      <tr>
        <td>${escapeHtml(r.range)}</td>
        <td>${r.cechy}</td>
        <td>${r.um}</td>
      </tr>
    `).join("");
  }

  // ---------- STATES (tu dodajesz kolejne stany) ----------
  // icon: mała ikonka (lewy górny róg) — plik w projekcie
  // cardImg: pełna karta PNG — plik w projekcie
  // Zmieniasz nazwy w label, a w STATES używasz tylko key: "fight" | "psyche" | "status" | "rule"

const SORT = {
  mode: "name", // "name" | "tag"
  dir: "asc"    // "asc" | "desc"
};

    const TAGS = {
    fight:     { label: "Walka",      badgeClass: "badge--red" },
    psyche:    { label: "Psychologia",   badgeClass: "badge--yellow" },
    status:    { label: "Stan Postaci",     badgeClass: "badge--blue" }, 
    rule: { label: "Zasada", badgeClass: "badge--green" },
//jakby cos nie działało
    character: { label: "Zasada", badgeClass: "badge--green" }
  };

  function getTagLabel(tagKeyOrText) {
    const t = TAGS[tagKeyOrText];
    return t ? t.label : String(tagKeyOrText || "");
  }

  function getTagBadgeClass(tagKeyOrText) {
    const t = TAGS[tagKeyOrText];
    return t ? t.badgeClass : ""; // brak klasy = fallback do domyślnego .badge
  }
  const STATES = [
  {
    id: "modyfikatory-strzelania",
    name: "MODYFIKATORY STRZELANIA",
    tag: "fight",
    icon: "assets/icons/modyfikatory strzelania_icon.png",
    cardImg: "assets/cards/modyfikatory strzelania.png",
    text: "Ściąga premii i kar do Testów Strzelania: zasięg (bliski/daleki/bardzo daleki), rozmiar celu, zasłony, ruch, strach oraz trafienia w grupy/tłum."
  },
  {
    id: "antagonizmy",
    name: "ANTAGONIZMY",
    tag: "psyche",
    icon: "assets/icons/antagonizmy_icon.png",
    cardImg: "assets/cards/antagonizmy.png",
    text: "Gdy postać trafia na Źródło: Test Opanowania i możliwe reakcje (Nienawiść, Wrogość, Uprzedzenie). Udany/nieudany test daje konkretne premie/kary i zmienia zachowanie."
  },
  {
    id: "bohater-i-determinacja",
    name: "BOHATER I DETERMINACJA",
    tag: "rule",
    icon: "assets/icons/bohater i determinacja_icon.png",
    cardImg: "assets/cards/bohater i determinacja.png",
    text: "Wydawanie Punktu Bohatera (PBo) i Punktu Determinacji (PDe): jakie korzyści dają, kiedy można użyć, co blokują/znoszą i jak się odnawiają."
  },
  {
    id: "brudny",
    name: "BRUDNY",
    tag: "status",
    icon: "assets/icons/brudny_icon.png",
    cardImg: "assets/cards/brudny.png",
    text: "Zabrudzenie: obniża Status do Brązu 1, daje kary do testów opartych na Ogładzie, może wymagać testu Odporności przy ranie. Usunięcie: mycie/Determinacja."
  },
  {
    id: "groza-x",
    name: "GROZA (X)",
    tag: "psyche",
    icon: "assets/icons/groza_icon.png",
    cardImg: "assets/cards/groza.png",
    text: "Spotkanie istoty o Grozie (X): Test Opanowania. Udany – kontrola; nieudany – poziomy Paniki. Groza zwykle generuje Strach i trwa do ustąpienia Paniki."
  },
  {
    id: "grupowa-przewaga",
    name: "GRUPOWA PRZEWAGA",
    tag: "fight",
    icon: "assets/icons/grupowa przewaga_icon.png",
    cardImg: "assets/cards/grupowa przewaga.png",
    text: "Wydawanie Grupowej Przewagi (GP) na efekty: akcje specjalne, premie do testów, dodatkowe działania/ucieczkę itd. Zasady zdobywania GP i ograniczenia."
  },
  {
    id: "krwawienie",
    name: "KRWAWIENIE ^",
    tag: "status",
    icon: "assets/icons/krwawienie_icon.png",
    cardImg: "assets/cards/krwawienie.png",
    text: "Efekt Krwawienia: narastanie co rundę, kary do testów odporności i ryzyko utraty przytomności/śmierci przy 0 Żyw. Usuwanie: Leczenie, bandaże, magia, zioła."
  },
  {
    id: "krytyki",
    name: "KRYTYKI",
    tag: "status",
    icon: "assets/icons/krytyki_icon.png",
    cardImg: "assets/cards/krytyki.png",
    text: "Rany Krytyczne (RK): kiedy powstają (trafienie krytyczne lub spadek Żyw do 0), jak ustala się miejsce trafienia, zasady tabel RK i co oznacza rana powierzchowna."
  },
  {
    id: "leczenie-ran",
    name: "LECZENIE RAN",
    tag: "rule",
    icon: "assets/icons/leczenie ran_icon.png",
    cardImg: "assets/cards/leczenie ran.png",
    text: "Regeneracja i leczenie: odpoczynek, pełny dzień, test Leczenia (udany/nieudany), wpływ ran krytycznych i przykłady farmaceutyków/modlitw/czarów."
  },
  {
    id: "mocna-glowa",
    name: "MOCNA GŁOWA",
    tag: "status",
    icon: "assets/icons/mocna głowa_icon.png",
    cardImg: "assets/cards/mocna głowa.png",
    text: "Alkohol: Test Mocnej Głowy – udany daje „wstawienie”, nieudany „upicie” z karami. Trzeźwienie po czasie (testy), możliwy „abstynent” w sytuacjach społecznych."
  },
  {
    id: "podpalenie",
    name: "PODPALENIE ^",
    tag: "status",
    icon: "assets/icons/podpalenie_icon.png",
    cardImg: "assets/cards/podpalenie.png",
    text: "Pod koniec każdej rundy postać dostaje 1k10 Ran (+1 za każdy dodatkowy poziom), minimum 1. Usunięcie: test Atletyki (usuwa poziomy) lub 1 poziom Punktem Determinacji."
  },
  {
    id: "modyfikatory-walki-wrecz",
    name: "MODYFIKATORY WALKI WRĘCZ",
    tag: "fight",
    icon: "assets/icons/modyfikatory walki wręcz_icon.png",
    cardImg: "assets/cards/modyfikatory walki wręcz.png",
    text: "Ściąga premii/kar do Testów Walki Wręcz: przewaga liczebna, atak z flanki/tyłu, rozmiar, warunki (teren/pogoda/ciemność), długość broni, strach i inne sytuacyjne modyfikatory."
  },
  {
    id: "obciazenie",
    name: "OBCIĄŻENIE",
    tag: "rule",
    icon: "assets/icons/obciążenie_icon.png",
    cardImg: "assets/cards/obciążenie.png",
    text: "Zasady noszenia ekwipunku: Obciążenie (Obc.) i Przeciążenie (Przec.). Jak liczyć Limit Obc. oraz jakie kary pojawiają się przy przekroczeniu x2/x3."
  },
  {
    id: "obrazenia",
    name: "OBRAŻENIA",
    tag: "fight",
    icon: "assets/icons/obrażenia_icon.png",
    cardImg: "assets/cards/obrażenia.png",
    text: "Jak liczyć otrzymane Rany: kolejność (PS z testu, BS+obrażenia broni, zalety/wady, rozmiar, pancerz/tarcza, redukcja obrażeń). Ściąga krok po kroku."
  },
  {
    id: "odwrot",
    name: "ODWRÓT",
    tag: "fight",
    icon: "assets/icons/odwrót_icon.png",
    cardImg: "assets/cards/odwrót.png",
    text: "Wyjście z walki związanej: ucieczka przed zagrożeniem (za Przewagę), testy przeciwstawne Unik/Broń Biała, konsekwencje porażki oraz zasady pościgu."
  },
  {
    id: "ogluszenie",
    name: "OGŁUSZENIE ^",
    tag: "status",
    icon: "assets/icons/ogłuszenie_icon.png",
    cardImg: "assets/cards/ogłuszenie.png",
    text: "Kary do testów wykorzystujących słuch oraz premie dla atakującego w zwarciu (flanka/tył). Usuwanie: 1 poziom na koniec każdej rundy lub 1 poziom Punktem Determinacji."
  },
  {
    id: "oszolomienie",
    name: "OSZOŁOMIENIE ^",
    tag: "status",
    icon: "assets/icons/oszołomienie_icon.png",
    cardImg: "assets/cards/oszołomienie.png",
    text: "Brak akcji, ruch tylko połową Szybkości, kary do testów i problemy z obroną. Usuwanie: test Odporności na koniec rundy / zioło Salwort / Punkt Determinacji."
  },
  {
    id: "oslepienie",
    name: "OŚLEPIENIE ^",
    tag: "status",
    icon: "assets/icons/oślepienie_icon.png",
    cardImg: "assets/cards/oślepienie.png",
    text: "Kary do testów opartych na wzroku, a wręcz przeciwnik ma premię do trafienia. Usunięcie: 1 poziom na koniec co drugiej rundy lub Punktem Determinacji."
  },
  {
    id: "panika",
    name: "PANIKA ^",
    tag: "psyche",
    icon: "assets/icons/panika_icon.png",
    cardImg: "assets/cards/panika.png",
    text: "Postać musi używać Ruchu i Akcji, by uciekać lub się ukryć; kary do testów niezwiązanych z ucieczką. Usuwanie: runda w ukryciu / Test Opanowania / Punkt Determinacji."
  },
  {
    id: "pochwycenie",
    name: "POCHWYCENIE ^",
    tag: "status",
    icon: "assets/icons/pochwycenie_icon.png",
    cardImg: "assets/cards/pochwycenie.png",
    text: "Brak Ruchu, kary do testów przy akcjach ruchu (w tym Zapasy/Walka Wręcz). Usuwanie: przeciwstawny test Siły z Źródłem Pochwycenia (usuwa poziomy) lub Punkt Determinacji."
  },
  {
  id: "powalenie",
  name: "POWALENIE",
  tag: "status",
  icon: "assets/icons/powalenie_icon.png",
  cardImg: "assets/cards/powalenie.png",
  text: "Powalenie: postać może zużyć Ruch, by wstać lub odczołgać się (½ Szybkości). Kary do testów w akcjach ruchu (w tym WW), przeciwnik ma premię do trafienia wręcz. Usunięcie: wstanie/Ruch lub Punkt Determinacji."
},
{
  id: "przeznaczenie-i-szczescie",
  name: "PRZEZNACZENIE I SZCZĘŚCIE",
  tag: "rule",
  icon: "assets/icons/przeznaczenie i szczęście_icon.png",
  cardImg: "assets/cards/przeznaczenie i szczęście.png",
  text: "Punkty Przeznaczenia (PPr) i Szczęścia (PSz): kiedy i na co je wydawać (ocalenie, anulowanie skutków, przerzut / +1 PS), jak określa się maksimum i jak się odnawiają."
},
{
  id: "rozmiar",
  name: "ROZMIAR",
  tag: "rule",
  icon: "assets/icons/rozmiar_icon.png",
  cardImg: "assets/cards/rozmiar.png",
  text: "Rozmiar w walce: większy zyskuje zalety (np. Przebijająca/Drzgocąca), mnożenie obrażeń i modyfikacje trafienia; mniejszy ma premie do trafienia. Zasady: obrona przed większymi, przeciwstawna siła, ruch w walce, strach/groza, tupnięcie, żywotność."
},
{
  id: "skoki-upadki",
  name: "SKOKI, UPADKI",
  tag: "rule",
  icon: "assets/icons/skoki, upadki_icon.png",
  cardImg: "assets/cards/skoki, upadki.png",
  text: "Skok: bez testu do ½ Szybkości; dłuższy skok zależy od rozbiegu (Atletyka +20 / +0). Upadek: obrażenia za metr + 1k10, redukcja o BWt, PP nie pomaga; możliwe Powalenie. Zeskok: Atletyka +20 zmniejsza wysokość upadku."
},
{
  id: "status",
  name: "STATUS",
  tag: "rule",
  icon: "assets/icons/status_icon.png",
  cardImg: "assets/cards/status.png",
  text: "Status (Brąz/Srebro/Złoto + Pozycja) wpływa na testy społeczne (Charyzma, Dowodzenie, Plotkowanie, Zastraszanie). Zasady utrzymania statusu, zarabiania (test Zarabiania) oraz dochodu (brąz/srebro/złoto)."
},
{
  id: "strach-x",
  name: "STRACH (X)",
  tag: "psyche",
  icon: "assets/icons/strach_icon.png",
  cardImg: "assets/cards/strach.png",
  text: "Strach (X): wydłużony Test Opanowania z celem +X PS. Sukces = normalne działanie; porażka = efekty strachu (kary, problemy ze zbliżeniem, ryzyko Paniki). Test można powtarzać co rundę; Determinacja daje czasową niewrażliwość na Psychologię."
},
{
  id: "sympatie",
  name: "SYMPATIE",
  tag: "psyche",
  icon: "assets/icons/sympatie_icon.png",
  cardImg: "assets/cards/sympatie.png",
  text: "Czynnik Psychologiczny Sympatie: Test Opanowania przeciw Źródłu. Udany = działasz normalnie; nieudany = musisz nieść pomoc Źródłu i dostajesz premie do testów niesienia pomocy (zależnie od wariantu), + interakcje z efektami Psychologii."
},
{
  id: "szal-bojowy",
  name: "SZAŁ BOJOWY",
  tag: "psyche",
  icon: "assets/icons/szał bojowy_icon.png",
  cardImg: "assets/cards/szał bojowy.png",
  text: "Szał Bojowy: wejście testem Siły Woli. Po udanym: niewrażliwość na inne czynniki psychologiczne, przymus parcia na wroga, darmowy atak wręcz co rundę i +1 BS. Kończy się m.in. po Oszołomieniu/Utracie Przytomności, użyciu Determinacji, końcu tury lub braku celów; po zakończeniu 1 poziom Zmęczenia."
},
{
  id: "tarcza-x",
  name: "TARCZA (X)",
  tag: "fight",
  icon: "assets/icons/tarcza_icon.png",
  cardImg: "assets/cards/tarcza.png",
  text: "Tarcza (X): sposoby obrony w zwarciu (Broń Biała, Parująca) i zasady użycia tarczy z różnymi umiejętnościami. Zapewnia premię +X PP przeciw atakom wręcz; interakcje z unikami i odbiciem trafień."
},
{
  id: "utrata-przytomnosci",
  name: "UTRATA PRZYTOMNOŚCI",
  tag: "status",
  icon: "assets/icons/utrata przytomności_icon.png",
  cardImg: "assets/cards/utrata przytomności.png",
  text: "Postać nie wykonuje żadnych Akcji w swojej Turze i nie jest świadoma otoczenia. Ataki wręcz lub z bliska są skrajnie niebezpieczne. Po odzyskaniu przytomności: Powalenie + 1 poziom Zmęczenia."
},{
  id: "zmeczenie",
  name: "ZMĘCZENIE ^",
  tag: "status",
  icon: "assets/icons/zmęczenie_icon.png",
  cardImg: "assets/cards/zmęczenie.png",
  text: "Postać otrzymuje karę −10 do wszystkich Testów. Usuwanie zwykle przez odpoczynek, magię lub zmianę warunków; możliwe usunięcie Punktem Determinacji. Opcjonalnie: Zadycha przy długim wysiłku."
},
{
  id: "walka-z-wierzchowca",
  name: "WALKA Z WIERZCHOWCA",
  tag: "fight",
  icon: "assets/icons/walka z wierzchowca_icon.png",
  cardImg: "assets/cards/walka z wierzchowca.png",
  text: "Zasady walki konnej: premie do trafienia przeciw mniejszym celom, obrażenia przy szarży, ograniczenia strzałów, testy Jeździectwa przy Panice konia oraz cechy konia bojowego."
},
{
  id: "zaniepokojenie",
  name: "ZANIEPOKOJENIE",
  tag: "psyche",
  icon: "assets/icons/zaniepokojenie_icon.png",
  cardImg: "assets/cards/zaniepokojenie.png",
  text: "Premia +10 do Testów Percepcji, kara −10 do pozostałych Testów. Usuwane m.in. przez Panikę, minięcie zagrożenia, Test Opanowania (+20), zdolności usuwające Panikę lub Punkt Determinacji."
},
{
  id: "zaskoczenie",
  name: "ZASKOCZENIE",
  tag: "status",
  icon: "assets/icons/zaskoczenie_icon.png",
  cardImg: "assets/cards/zaskoczenie.png",
  text: "Postać traci swoją Turę (brak Akcji i Ruchu), nie broni się przed pierwszym atakiem; pierwszy napastnik zyskuje premię do trafienia i Przewagę. Usuwane po pierwszym ataku, na koniec rundy lub Punktem Determinacji."
},
{
  id: "zatrucie",
  name: "ZATRUCIE ^",
  tag: "status",
  icon: "assets/icons/zatrucie_icon.png",
  cardImg: "assets/cards/zatrucie.png",
  text: "Postać otrzymuje Rany co rundę i kary do Testów; przy 0 Żyw. grozi śmierć po teście Odporności. Usuwanie: Test Odporności lub Leczenia (zależnie od trucizny) albo Punkt Determinacji. Po usunięciu: Zmęczenie."
}
];



  function openStateCard(stateId) {
    const s = STATES.find(x => x.id === stateId);
    if (!s || !els.stateCardModal || !els.stateCardImg) return;

    els.stateCardImg.src = s.cardImg || "";
    els.stateCardImg.alt = `Karta stanu: ${s.name}`;

    if (els.stateCardSubtitle) {
      els.stateCardSubtitle.textContent = s.name + (s.tag ? ` • ${s.tag}` : "");
    }

    els.stateCardModal.classList.remove("is-hidden");
  }

  function closeStateCard() {
    if (!els.stateCardModal) return;
    els.stateCardModal.classList.add("is-hidden");
    if (els.stateCardImg) els.stateCardImg.src = "";
    if (els.stateCardSubtitle) els.stateCardSubtitle.textContent = "";
  }

  function renderStates(filterText = "") {
    if (!els.statesList || !els.stateCount) return;

    const qText = (filterText || "").trim().toLowerCase();
    let filtered = qText
      ? STATES.filter(s =>
          s.name.toLowerCase().includes(qText) ||
          s.tag.toLowerCase().includes(qText)
        )
      : STATES;
      filtered = sortStates(filtered);

    if (els.stateCountInline) els.stateCountInline.textContent = String(filtered.length);


    els.statesList.innerHTML = filtered.map(s => {
      const iconHtml = s.icon
        ? `<div class="state-icon"><img src="${escapeHtml(s.icon)}" alt="" aria-hidden="true"></div>`
        : `<div class="state-icon" aria-hidden="true"></div>`;

      const cardBtn = s.cardImg
        ? `
          <button class="icon-mini" type="button"
            data-open-card="1"
            data-state-id="${escapeHtml(s.id)}"
            aria-label="Otwórz pełną kartę stanu"
            title="Podgląd karty">
            <span class="icon-card" aria-hidden="true"></span>
          </button>`
        : "";

      return `
        <details class="state" data-state="${escapeHtml(s.id)}">
          <summary>
            <div class="state-summary-left">
              ${iconHtml}
              <div class="state-title-wrap">
                <div class="state-title-row">
                  <span>${escapeHtml(s.name)}</span>
                  <span class="badge ${escapeHtml(getTagBadgeClass(s.tag))}">
  ${escapeHtml(getTagLabel(s.tag))}
</span>
                </div>
              </div>
            </div>

            <div class="state-actions">
              ${cardBtn}
            </div>
          </summary>

          <div class="content">${escapeHtml(s.text)}</div>
        </details>
      `;
    }).join("");

    els.statesList.querySelectorAll("[data-open-card='1']").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation(); // nie przełączaj details
        const id = btn.getAttribute("data-state-id");
        openStateCard(id);
      });
    });
  }
  function sortStates(list){
  const dirMul = (SORT.dir === "asc") ? 1 : -1;

  const byName = (a,b) =>
    a.name.localeCompare(b.name, "pl", { sensitivity:"base" });

  if (SORT.mode === "tag") {
    return list.slice().sort((a,b) => {
      const ta = (a.tag || "").toString();
      const tb = (b.tag || "").toString();

      const tagCmp = ta.localeCompare(tb, "pl", { sensitivity:"base" });
      if (tagCmp !== 0) return tagCmp * dirMul;

      return byName(a,b) * dirMul;
    });
  }

  return list.slice().sort((a,b) => byName(a,b) * dirMul);
}
  function setupSortUI(){
  if (!els.btnSortMode || !els.sortMenu || !els.btnSortDir) return;

  // otwieranie / zamykanie dropdown
  els.btnSortMode.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSortMenu(true);
  });

  // wybór trybu sortowania
  els.sortMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sort]");
    if (!btn) return;

    SORT.mode = btn.getAttribute("data-sort"); // "name" lub "tag"
    applySortLabels();
    highlightActiveSort();
    toggleSortMenu(false);

    // przerysuj listę stanów
    renderStates();
  });

  // kierunek sortowania (osobny przycisk)
  els.btnSortDir.addEventListener("click", (e) => {
    e.stopPropagation();
    SORT.dir = (SORT.dir === "asc") ? "desc" : "asc";
    applySortLabels();
    renderStates();
  });

  // klik poza menu zamyka
  document.addEventListener("click", () => toggleSortMenu(false));

  // start
  applySortLabels();
  highlightActiveSort();
}

function toggleSortMenu(forceOpen){
  const isHidden = els.sortMenu.classList.contains("is-hidden");
  const open = (typeof forceOpen === "boolean") ? forceOpen : isHidden;

  if (open) {
    els.sortMenu.classList.remove("is-hidden");
    els.btnSortMode.setAttribute("aria-expanded", "true");
  } else {
    els.sortMenu.classList.add("is-hidden");
    els.btnSortMode.setAttribute("aria-expanded", "false");
  }
}

function applySortLabels(){
  if (!els.sortLabel || !els.sortDirIcon) return;

  els.sortLabel.textContent =
    (SORT.mode === "name") ? "Alfabetycznie" : "Według tagu";

  els.sortDirIcon.textContent = (SORT.dir === "asc") ? "↑" : "↓";
}

function highlightActiveSort(){
  if (!els.sortMenu) return;
  els.sortMenu.querySelectorAll(".sort-item").forEach(b => {
    b.classList.toggle("is-active", b.getAttribute("data-sort") === SORT.mode);
  });
}


  // ---------- Init ----------
  function init() {
    els = {
      tabs: qa(".tab"),
      pages: { wallet: $("tab-wallet"), xp: $("tab-xp"), states: $("tab-states") },

      wP: $("wP"), wS: $("wS"), wZK: $("wZK"),
      cP: $("cP"), cS: $("cS"), cZK: $("cZK"),
      btnApply: $("btnApply"),
      walletResult: $("walletResult"),

      btnOpenSettings: $("btnOpenSettings"),
      btnCloseSettings: $("btnCloseSettings"),
      modal: $("settingsModal"),
      modalBackdrop: $("settingsBackdrop"),

      toggleAutoApply: $("toggleAutoApply"),
      btnSaveWallet: $("btnSaveWallet"),
      btnResetWallet: $("btnResetWallet"),
      walletJson: $("ioArea"),
      btnExportWallet: $("btnExport"),
      btnCopyWallet: $("btnCopy"),
      btnImportWallet: $("btnImport"),
      settingsMsg: $("settingsMsg"),
      fileImport: $("fileImport"),

      tblDevBody: $("tblDevBody"),

      calcValue: $("calcValue"),
      calcCustom: $("calcCustom"),
      btnCalcAdd: $("btnCalcAdd"),
      btnCalcSub: $("btnCalcSub"),
      btnCalcReset: $("btnCalcReset"),
      chips: qa(".chip"),

      quickButtons: qa("[data-jump]"),

      stateCountInline: $("stateCountInline"),
      stateSearch: $("stateSearch"),
      statesList: $("statesList"),
      stateCount: $("stateCount"),

      segs: qa(".seg"),
sortControl: $("sortControl"),
btnSortMode: $("btnSortMode"),
btnSortDir: $("btnSortDir"),
sortMenu: $("sortMenu"),
sortLabel: $("sortLabel"),
sortDirIcon: $("sortDirIcon"),
      // State card modal
      stateCardModal: $("stateCardModal"),
      stateCardBackdrop: $("stateCardBackdrop"),
      btnCloseStateCard: $("btnCloseStateCard"),
      stateCardImg: $("stateCardImg"),
      stateCardSubtitle: $("stateCardSubtitle"),
    };

    // Settings + wallet from storage
    loadSettings();
    if (els.toggleAutoApply) els.toggleAutoApply.checked = !!settings.autoApply;

    const loaded = loadWallet();
    if (!loaded) writeWalletInputs({ p: 15, s: 32, zk: 10 });

    setResult("");
    setSettingsMsg("");

    // Tabs
    onAll(els.tabs, "click", (e) => setTab(e.currentTarget.dataset.tab));
    onAll(els.quickButtons, "click", (e) => setTab(e.currentTarget.dataset.jump));

    // Segmented
    onAll(els.segs, "click", (e) => {
      const seg = e.currentTarget;
      setMode(seg.dataset.mode, seg);
    });

    // Apply op
    on(els.btnApply, "click", applyOperation);
    [els.cP, els.cS, els.cZK].forEach(inp => on(inp, "keydown", (e) => {
      if (e.key === "Enter") applyOperation();
    }));

    // Modal (settings)
    on(els.btnOpenSettings, "click", openModal);
    on(els.btnCloseSettings, "click", closeModal);
    on(els.modalBackdrop, "click", closeModal);

    // State card modal
    on(els.btnCloseStateCard, "click", closeStateCard);
    on(els.stateCardBackdrop, "click", closeStateCard);

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (els.modal && !els.modal.classList.contains("is-hidden")) closeModal();
      if (els.stateCardModal && !els.stateCardModal.classList.contains("is-hidden")) closeStateCard();
    });

    // Toggle
    on(els.toggleAutoApply, "change", () => {
      settings.autoApply = !!els.toggleAutoApply.checked;
      saveSettings();
      setSettingsMsg(`<div class="ok"><strong>Zapisano.</strong> Auto-podmienianie: ${settings.autoApply ? "ON" : "OFF"}</div>`);
    });

    // Save/Reset/IO
    on(els.btnSaveWallet, "click", saveWallet);
    on(els.btnResetWallet, "click", resetWallet);
    on(els.btnExportWallet, "click", exportWallet);
    on(els.btnCopyWallet, "click", copyWalletJson);
    on(els.btnImportWallet, "click", importWallet);

    // Import z pliku JSON
    on(els.fileImport, "change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);

          const w = data.wallet ? data.wallet : data;
          const safe = fromTotalP(toTotalP(w));
          writeWalletInputs(safe);

          if (typeof data.settings?.autoApply === "boolean") {
            settings.autoApply = !!data.settings.autoApply;
            if (els.toggleAutoApply) els.toggleAutoApply.checked = settings.autoApply;
            saveSettings();
          }

          setSettingsMsg(`<div class="ok"><strong>Zaimportowano z pliku.</strong></div>`);
        } catch {
          setSettingsMsg(`<div class="bad"><strong>Błąd pliku JSON.</strong></div>`);
        }
      };
      reader.readAsText(file);
    });

    // Calculator
    onAll(els.chips, "click", (e) => addCalc(Number(e.currentTarget.dataset.delta)));
    on(els.btnCalcAdd, "click", () => addCalc(Number(els.calcCustom?.value || 0)));
    on(els.btnCalcSub, "click", () => addCalc(-Number(els.calcCustom?.value || 0)));
    on(els.btnCalcReset, "click", () => { calc = 0; renderCalc(); });
    renderCalc();

    // PD table
    renderDevTable();

    // States
    on(els.stateSearch, "input", (e) => renderStates(e.target.value));
    setupSortUI(); 
    renderStates("");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
