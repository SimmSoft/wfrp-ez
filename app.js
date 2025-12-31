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
    // order: P • S • ZK
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
    if (els.walletJson) els.walletJson.value = JSON.stringify(w);
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
      const obj = JSON.parse(raw);
      const safe = fromTotalP(toTotalP(obj));
      writeWalletInputs(safe);
      setResult("");
      setSettingsMsg(`<div class="ok"><strong>Zaimportowano.</strong> ${escapeHtml(fmtMoney(safe))}</div>`);
    } catch {
      setSettingsMsg(`<div class="bad"><strong>Błąd JSON.</strong> Format: {"p":0,"s":0,"zk":0}</div>`);
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
    if (!els.modal) {
      console.warn("Brak elementu #walletSettingsModal w HTML.");
      return;
    }
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

  // ---------- PD table render only (bez pól do liczenia) ----------
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

  // ---------- States (placeholder list) ----------
  const STATES = [
    { name: "Groza (X)", tag: "Psychologia", text: "Test Opanowania przeciwko współczynnikowi Grozy..." },
    { name: "Strach (X)", tag: "Psychologia", text: "Nieudane testy Opanowania dodają poziomy Strachu..." },
    { name: "Panika", tag: "Psychologia", text: "Panika zmusza do ucieczki/ukrycia..." }
  ];

  function renderStates(filterText = "") {
    if (!els.statesList || !els.stateCount) return;

    const qText = (filterText || "").trim().toLowerCase();
    const filtered = qText
      ? STATES.filter(s => s.name.toLowerCase().includes(qText) || s.tag.toLowerCase().includes(qText))
      : STATES;

    els.stateCount.textContent = `Widoczne: ${filtered.length} / ${STATES.length}`;
    els.statesList.innerHTML = filtered.map(s => `
      <details class="state">
        <summary>
          <span>${escapeHtml(s.name)}</span>
          <span class="badge">${escapeHtml(s.tag)}</span>
        </summary>
        <div class="content">${escapeHtml(s.text)}</div>
      </details>
    `).join("");
  }

  // ---------- Init (DOM ready) ----------
  function init() {
    // resolve elements AFTER DOM is loaded
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

      tblDev: $("tblDev"),

      tblDevBody: q("#tblDev tbody"),

      calcValue: $("calcValue"),
      calcCustom: $("calcCustom"),
      btnCalcAdd: $("btnCalcAdd"),
      btnCalcSub: $("btnCalcSub"),
      btnCalcReset: $("btnCalcReset"),
      chips: qa(".chip"),

      quickButtons: qa("[data-jump]"),

      stateSearch: $("stateSearch"),
      statesList: $("statesList"),
      stateCount: $("stateCount"),

      segs: qa(".seg")

      
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

    // Modal open/close
    on(els.btnOpenSettings, "click", openModal);
    on(els.btnCloseSettings, "click", closeModal);
    on(els.modalBackdrop, "click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && els.modal && !els.modal.classList.contains("is-hidden")) closeModal();
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

    on(els.fileImport, "change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.wallet) {
        writeWalletInputs(data.wallet);
        if (typeof data.settings?.autoApply === "boolean") {
          settings.autoApply = data.settings.autoApply;
          els.toggleAutoApply.checked = settings.autoApply;
          saveSettings();
        }
        setSettingsMsg(`<div class="ok"><strong>Zaimportowano z pliku.</strong></div>`);
      }
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
    renderStates("");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
