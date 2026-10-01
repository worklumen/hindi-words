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
    {
      title: "वाक्य / Sentences",
      text: "Write one natural, everyday Hindi sentence for each of these Hindi words, then generate a portrait-orientation (vertical, mobile-friendly) image showing every sentence in large, clear Devanagari with its transliteration in Roman letters and a word-by-word English meaning underneath.",
    },
    {
      title: "कहानी / Short story",
      text: "Write a short, simple story in Hindi that uses all of these Hindi words, then generate a portrait-orientation (vertical, mobile-friendly) illustrated image of the story with the Hindi sentences written in it, plus transliteration and English meaning for each sentence.",
    },
    {
      title: "फ़्लैशकार्ड / Flashcards",
      text: "Make a flashcard for each of these Hindi words with its meaning, transliteration and one example sentence, then generate a portrait-orientation (vertical, mobile-friendly) image with the flashcards stacked vertically and the Hindi text large and easy to read.",
    },
    {
      title: "संवाद / Dialogue",
      text: "Write a short, friendly conversation between two people in everyday Hindi that uses all of these Hindi words, then generate a portrait-orientation (vertical, mobile-friendly) chat-style image with speech bubbles showing the Hindi, its transliteration and the English meaning.",
    },
    {
      title: "कॉमिक / Comic strip",
      text: "Turn these Hindi words into a light-hearted comic strip with a clear beginning, middle and end, then generate it as a portrait-orientation (vertical, mobile-friendly) image with Hindi captions, each followed by transliteration and English meaning.",
    },
    {
      title: "चित्र शब्दकोश / Picture dictionary",
      text: "For each of these Hindi words, draw a simple illustration that makes its meaning obvious, then generate a portrait-orientation (vertical, mobile-friendly) visual-dictionary poster labelling every picture with the Hindi word, its transliteration and its English meaning.",
    },
    {
      title: "प्रश्नोत्तरी / Quiz",
      text: "Create a fill-in-the-blank quiz from these Hindi words: one Hindi sentence per word with the word left blank and a few transliterated options to choose from. Generate it as a portrait-orientation (vertical, mobile-friendly) image with the answer key at the bottom.",
    },
    {
      title: "याद रखने के तरीके / Memory hooks",
      text: "Give me a memorable hook for each of these Hindi words by linking its sound to a familiar English word or a vivid mental picture, then generate a portrait-orientation (vertical, mobile-friendly) image showing the Hindi word, transliteration, meaning and hook together.",
    },
    {
      title: "शब्द परिवार / Word families",
      text: "For each of these Hindi words, give one related word (a synonym, an opposite or a word from the same family) and one common phrase that uses it, then generate a tidy portrait-orientation (vertical, mobile-friendly) chart with transliteration and English meaning for everything.",
    },
    {
      title: "डायरी / Diary page",
      text: "Write a first-person diary entry in simple Hindi about an ordinary day, using all of these Hindi words, then generate a portrait-orientation (vertical, mobile-friendly) image styled like a journal page, with transliteration and English meaning beneath each sentence.",
    },
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
 promptPrev: $("prompt-prev"),
 promptNext: $("prompt-next"),
 promptCounter: $("prompt-counter"),
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
  let prompts = []; // PROMPTS in a random order for this visit
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

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function renderPrompts() {
    const frag = document.createDocumentFragment();

    prompts.forEach((prompt, index) => {
      const li = document.createElement("li");
      li.className = "prompt-card";
      li.setAttribute("role", "group");
      li.setAttribute("aria-roledescription", "slide");
      li.setAttribute("aria-label", `${index + 1} / ${prompts.length}`);

      const title = document.createElement("h3");
      title.className = "prompt-title";
      title.textContent = prompt.title;

      const text = document.createElement("p");
      text.className = "prompt-text";
      text.textContent = prompt.text;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-ghost prompt-copy";
      btn.dataset.promptIndex = String(index);
      btn.innerHTML = `${COPY_ICON}<span class="btn-label">कॉपी / Copy</span>`;

      li.append(title, text, btn);
      frag.append(li);
    });

    els.promptsList.replaceChildren(frag);
    updateCarousel();
  }

  /* ======================================================================
   * Prompt carousel (swipe, or use the arrow buttons)
   * ====================================================================== */

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function activePromptIndex() {
    const cards = Array.from(els.promptsList.children);
    const left = els.promptsList.scrollLeft;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((card, i) => {
      const dist = Math.abs(card.offsetLeft - left);
      if (dist < bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    return best;
  }

  function updateCarousel() {
    const index = activePromptIndex();
    els.promptCounter.textContent = `${index + 1} / ${prompts.length}`;
    els.promptPrev.disabled = index <= 0;
    els.promptNext.disabled = index >= prompts.length - 1;
  }

  function goToPrompt(index) {
    const card = els.promptsList.children[clamp(index, 0, prompts.length - 1)];
    if (!card) return;
    els.promptsList.scrollTo({
      left: card.offsetLeft,
      behavior: prefersReducedMotion.matches ? "auto" : "smooth",
    });
  }

  let carouselFrame = 0;
  function onCarouselScroll() {
    cancelAnimationFrame(carouselFrame);
    carouselFrame = requestAnimationFrame(updateCarousel);
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
      if (btn) copyWithPrompt(btn, prompts[Number(btn.dataset.promptIndex)].text);
    });

      els.promptsList.addEventListener("scroll", onCarouselScroll, { passive: true });
      els.promptPrev.addEventListener("click", () => goToPrompt(activePromptIndex() - 1));
      els.promptNext.addEventListener("click", () => goToPrompt(activePromptIndex() + 1));
      window.addEventListener("resize", () => goToPrompt(activePromptIndex()));

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
    prompts = shuffle(PROMPTS);
    renderPrompts();
    render();
  }

  init();
})();
