(() => {
  "use strict";

  /* ======================================================================
   * Config
   * ====================================================================== */

  const CONFIG = Object.freeze({
    files: Array.from({ length: 10 }, (_, i) => `words/hw${String(i + 1).padStart(2, "0")}.txt`),
                               storageKeys: { data: "hindi-words-data", state: "hindi-words-state" },
                               colsOptions: [2, 3],
                               rows: { min: 3, max: 6 },
                               defaults: { cols: 2, rows: 5, lastIndex: 9 }, // lastIndex = index of last word shown
                                 flashMs: 1200,
  });

  const PROMPTS = Object.freeze([
    "Form sentences with these Hindi words and generate a portrait orientation (vertical, mobile-friendly) image with these texts and sentences rendered in it, also, add word wise meaning and transliteration to read Hindi",
                                "Create a short story using these Hindi words and generate a portrait orientation (vertical, mobile-friendly) illustrated image of the story with the Hindi sentences written in it, with word-by-word meaning in English and transliteration for each sentence",
                                "Make flashcards for these Hindi words with meaning, transliteration and one example sentence each, and generate a portrait orientation (vertical, mobile-friendly) image showing all the flashcards stacked vertically with the Hindi text clearly readable",
  ]);

  const COPY_ICON =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>';

  /* ======================================================================
   * DOM references
   * ====================================================================== */

  const $ = (id) => document.getElementById(id);

  const els = {
    status: $("status"),
 statusText: document.querySelector("#status .status-text"),
 wordsBox: $("words-box"),
 grid: $("words-grid"),
 colsSelect: $("cols-select"),
 rowsSelect: $("rows-select"),
 copyBtn: $("copy-btn"),
 prevBtn: $("prev-btn"),
 nextBtn: $("next-btn"),
 pageIndicator: $("page-indicator"),
 progressBar: $("progress-bar"),
 promptsSection: $("prompts-section"),
 promptsList: $("prompts-list"),
  };

  /* ======================================================================
   * Storage (all access is guarded: storage may be blocked or full)
   * ====================================================================== */

  const store = {
    read(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* Quota exceeded or unavailable — persistence is best-effort. */
      }
    },
  };

  /* ======================================================================
   * State
   * ====================================================================== */

  let words = []; // [{ word, freq }]
  const state = { ...CONFIG.defaults };

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function loadState() {
    const raw = store.read(CONFIG.storageKeys.state);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      if (CONFIG.colsOptions.includes(saved.cols)) state.cols = saved.cols;
      if (Number.isInteger(saved.rows)) state.rows = clamp(saved.rows, CONFIG.rows.min, CONFIG.rows.max);

      // Migrate legacy `basketSize` state into cols/rows.
      if (Number.isInteger(saved.basketSize) && !saved.cols && !saved.rows) {
        const pageSize = clamp(saved.basketSize, 6, 18);
        state.cols = pageSize % 3 === 0 && pageSize % 2 !== 0 ? 3 : 2;
        state.rows = clamp(Math.round(pageSize / state.cols), CONFIG.rows.min, CONFIG.rows.max);
      }

      if (Number.isInteger(saved.lastIndex) && saved.lastIndex >= 0) state.lastIndex = saved.lastIndex;
    } catch {
      /* Corrupt state — keep defaults. */
    }
  }

  function saveState() {
    store.write(CONFIG.storageKeys.state, JSON.stringify(state));
  }

  /* ======================================================================
   * Data
   * ====================================================================== */

  function parseWords(text) {
    const out = [];
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      const comma = t.lastIndexOf(",");
      if (comma === -1) continue;
      const freq = Number(t.slice(comma + 1));
      if (Number.isNaN(freq)) continue;
      out.push({ word: t.slice(0, comma), freq });
    }
    return out;
  }

  function loadCachedWords() {
    const raw = store.read(CONFIG.storageKeys.data);
    return raw ? parseWords(raw) : [];
  }

  async function fetchWords() {
    const texts = await Promise.all(
      CONFIG.files.map(async (file) => {
        const res = await fetch(file);
        if (!res.ok) throw new Error(`Failed to load ${file}`);
        return res.text();
      })
    );
    const all = texts.join("\n");
    store.write(CONFIG.storageKeys.data, all);
    return parseWords(all);
  }

  /* ======================================================================
   * Pagination maths
   * ====================================================================== */

  const pageSize = () => state.cols * state.rows;

  function pageStart() {
    const last = Math.min(state.lastIndex, words.length - 1);
    return Math.max(0, last - pageSize() + 1);
  }

  function currentSlice() {
    const start = pageStart();
    return words.slice(start, start + pageSize());
  }

  /* ======================================================================
   * Formatting
   * ====================================================================== */

  const FREQ_UNITS = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];

  function formatFreq(n) {
    if (n < 1000) return String(n);
    for (const [value, suffix] of FREQ_UNITS) {
      if (n >= value) return (n / value).toFixed(1).replace(/\.0$/, "") + suffix;
    }
    return String(n);
  }

  /* ======================================================================
   * Rendering
   * ====================================================================== */

  function createCell({ word, freq }) {
    const cell = document.createElement("div");
    cell.className = "word-cell";

    const w = document.createElement("span");
    w.className = "word-text";
    w.textContent = word;

    const f = document.createElement("span");
    f.className = "freq";
    f.textContent = formatFreq(freq);

    cell.append(w, f);
    return cell;
  }

  function render({ animate = false } = {}) {
    const size = pageSize();
    const start = pageStart();
    const slice = currentSlice();
    state.lastIndex = start + slice.length - 1;

    els.grid.style.gridTemplateColumns = `repeat(${state.cols}, minmax(0, 1fr))`;

    const frag = document.createDocumentFragment();
    slice.forEach((entry) => frag.append(createCell(entry)));
    els.grid.replaceChildren(frag);

    if (animate) {
      els.grid.classList.remove("is-turning");
      void els.grid.offsetWidth; // restart the animation
      els.grid.classList.add("is-turning");
    }

    const totalPages = Math.max(1, Math.ceil(words.length / size));
    const currentPage = Math.floor(start / size) + 1;
    els.pageIndicator.textContent = `Page ${currentPage} / ${totalPages}`;
    els.progressBar.style.width = `${Math.min(100, ((state.lastIndex + 1) / words.length) * 100)}%`;
    els.prevBtn.disabled = start === 0;
    els.nextBtn.disabled = start + size >= words.length;

    saveState();
  }

  function renderPrompts() {
    const frag = document.createDocumentFragment();

    PROMPTS.forEach((prompt, index) => {
      const li = document.createElement("li");
      li.className = "prompt-row";

      const text = document.createElement("span");
      text.className = "prompt-text";
      text.textContent = prompt;
      text.title = prompt;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-ghost";
      btn.dataset.promptIndex = String(index);
      btn.innerHTML = `${COPY_ICON}<span class="btn-label">कॉपी / Copy</span>`;

      li.append(text, btn);
      frag.append(li);
    });

    els.promptsList.replaceChildren(frag);
  }

  /* ======================================================================
   * Clipboard
   * ====================================================================== */

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for non-secure contexts.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.append(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  const flashTimers = new WeakMap();

  function flashButton(btn, message = "Copied!") {
    const label = btn.querySelector(".btn-label");
    if (!label) return;

    clearTimeout(flashTimers.get(btn));
    if (!btn.dataset.label) btn.dataset.label = label.textContent;

    label.textContent = message;
    btn.dataset.state = "done";

    flashTimers.set(
      btn,
      setTimeout(() => {
        label.textContent = btn.dataset.label;
        delete btn.dataset.state;
        delete btn.dataset.label;
      }, CONFIG.flashMs)
    );
  }

  const wordsText = () => currentSlice().map((e) => e.word).join(", ");

  async function copyWords() {
    await copyToClipboard(wordsText());
    flashButton(els.copyBtn);
  }

  async function copyWithPrompt(btn, prompt) {
    await copyToClipboard(`${prompt}:\n${wordsText()}`);
    flashButton(btn);
  }

  /* ======================================================================
   * Events
   * ====================================================================== */

  function goPrev() {
    state.lastIndex = pageStart() - 1;
    render({ animate: true });
  }

  function goNext() {
    state.lastIndex += pageSize();
    render({ animate: true });
  }

  function bindEvents() {
    els.colsSelect.addEventListener("change", () => {
      state.cols = Number(els.colsSelect.value);
      render();
    });

    els.rowsSelect.addEventListener("change", () => {
      state.rows = Number(els.rowsSelect.value);
      render();
    });

    els.prevBtn.addEventListener("click", goPrev);
    els.nextBtn.addEventListener("click", goNext);
    els.copyBtn.addEventListener("click", copyWords);

    els.promptsList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-prompt-index]");
      if (btn) copyWithPrompt(btn, PROMPTS[Number(btn.dataset.promptIndex)]);
    });

      document.addEventListener("keydown", (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;

        if (e.key === "ArrowLeft" && !els.prevBtn.disabled) {
          e.preventDefault();
          goPrev();
        } else if (e.key === "ArrowRight" && !els.nextBtn.disabled) {
          e.preventDefault();
          goNext();
        }
      });
  }

  /* ======================================================================
   * Init
   * ====================================================================== */

  function showError(message) {
    els.status.dataset.state = "error";
    els.statusText.textContent = message;
    els.status.setAttribute("role", "alert");
  }

  async function init() {
    loadState();
    els.colsSelect.value = String(state.cols);
    els.rowsSelect.value = String(state.rows);
    bindEvents();

    words = loadCachedWords();
    if (!words.length) {
      try {
        words = await fetchWords();
      } catch (err) {
        showError(`Error: ${err.message}. Serve the app over HTTP, e.g. python3 -m http.server`);
        return;
      }
    }

    if (!words.length) {
      showError("No words found in the data files.");
      return;
    }

    // Safety sort by frequency, descending.
    words.sort((a, b) => b.freq - a.freq);
    state.lastIndex = Math.min(state.lastIndex, words.length - 1);

    els.status.hidden = true;
    els.wordsBox.hidden = false;
    els.promptsSection.hidden = false;
    renderPrompts();
    render();
  }

  init();
})();
