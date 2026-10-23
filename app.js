(() => {
  const $ = (id) => document.getElementById(id);
  const appRoot = $("app");
  const caseView = $("case-view");
  const letterView = $("letter-view");
  const chapterList = $("chapter-list");
  const toast = $("toast");
  let chapters = [];
  let activeIndex = -1;
  let toastTimer;

  function configured() {
    const c = window.DIL_FIREBASE_CONFIG || {};
    return c.apiKey && !c.apiKey.startsWith("PASTE_") && c.projectId && !c.projectId.startsWith("YOUR_");
  }
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }
  function safeText(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text || "";
    return el;
  }
  function renderParagraphs(target, text) {
    target.replaceChildren();
    const paragraphs = String(text || "").split(/\n\s*\n/);
    paragraphs.forEach((p) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = p;
      target.appendChild(paragraph);
    });
  }
  function renderList(filter = "") {
    const filtered = chapters.filter((c) => `${c.quality} ${c.caseTitle} ${c.day}`.toLowerCase().includes(filter.toLowerCase()));
    chapterList.replaceChildren();
    $("chapter-count").textContent = `${chapters.length} ${chapters.length === 1 ? "CHAPTER" : "CHAPTERS"} PUBLISHED`;
    if (!filtered.length) {
      $("empty-state").classList.remove("hidden");
      if (chapters.length) $("empty-state").textContent = "No chapters match that search.";
      else $("empty-state").textContent = "The story is getting ready. Check back soon. ❤️";
      return;
    }
    $("empty-state").classList.add("hidden");
    filtered.forEach((chapter, i) => {
      const realIndex = chapters.findIndex((c) => c.id === chapter.id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "chapter-card";
      card.addEventListener("click", () => openChapter(realIndex));
      const top = document.createElement("div");
      top.className = "chapter-card-top";
      top.append(safeText("span", "chapter-number", `DAY ${String(chapter.day).padStart(2, "0")}`));
      top.append(safeText("span", "chapter-arrow", "↗"));
      card.append(top);
      card.append(safeText("h3", "", chapter.caseTitle || chapter.quality || `Case ${chapter.day}`));
      card.append(safeText("p", "chapter-quality", chapter.quality));
      card.append(safeText("span", "chapter-read", "OPEN CASE  →"));
      chapterList.append(card);
    });
  }
  function openChapter(index) {
    if (index < 0 || index >= chapters.length) return;
    activeIndex = index;
    const c = chapters[index];
    appRoot.classList.add("hidden");
    letterView.classList.add("hidden");
    caseView.classList.remove("hidden");
    $("case-kicker").textContent = `CASE FILE ${String(c.day).padStart(3, "0")} · DAY ${String(c.day).padStart(2, "0")}`;
    $("case-title").textContent = c.caseTitle || c.quality;
    $("case-quality").textContent = c.quality;
    renderParagraphs($("case-original"), c.originalMessage);
    $("case-question").textContent = c.courtQuestion;
    renderParagraphs($("case-response"), c.response);
    $("case-observation").textContent = c.finalObservation;
    $("case-next").textContent = c.nextHearing;
    $("case-position").textContent = `CHAPTER ${index + 1} OF ${chapters.length}`;
    $("previous-case").disabled = index === 0;
    $("next-case").disabled = index === chapters.length - 1;
    $("previous-case").textContent = index === 0 ? "First case" : "← Previous case";
    $("next-case").textContent = index === chapters.length - 1 ? "Last case" : "Next case →";
    history.replaceState(null, "", `#case-${encodeURIComponent(c.id)}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function showArchive() {
    caseView.classList.add("hidden");
    letterView.classList.add("hidden");
    appRoot.classList.remove("hidden");
    history.replaceState(null, "", "#story");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openLetter() {
    appRoot.classList.add("hidden");
    caseView.classList.add("hidden");
    letterView.classList.remove("hidden");
    history.replaceState(null, "", "#letter");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function routeFromHash() {
    const hash = decodeURIComponent(location.hash || "");
    if (hash.startsWith("#case-")) {
      const id = hash.slice(6);
      const index = chapters.findIndex((c) => c.id === id);
      if (index >= 0) openChapter(index);
      else showArchive();
    } else if (hash === "#letter") {
      openLetter();
    } else {
      caseView.classList.add("hidden");
      letterView.classList.add("hidden");
      appRoot.classList.remove("hidden");
    }
  }
  $("chapter-search").addEventListener("input", (e) => renderList(e.target.value));
  $("back-to-archive").addEventListener("click", (e) => { e.preventDefault(); showArchive(); });
  $("open-letter").addEventListener("click", openLetter);
  $("previous-case").addEventListener("click", () => openChapter(activeIndex - 1));
  $("next-case").addEventListener("click", () => openChapter(activeIndex + 1));
  window.addEventListener("hashchange", routeFromHash);

  async function start() {
    if (!configured()) {
      chapterList.innerHTML = '<div class="setup-notice"><strong>One-time setup needed</strong><p>The website design is ready. Add your Firebase web app settings to <code>firebase-config.js</code> to connect the live chapter database.</p></div>';
      $("chapter-count").textContent = "READY FOR SETUP";
      $("empty-state").classList.add("hidden");
      return;
    }
    try {
      firebase.initializeApp(window.DIL_FIREBASE_CONFIG);
      const db = firebase.firestore();
      const snapshot = await db.collection("chapters").where("published", "==", true).get();
      chapters = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => Number(b.day || 0) - Number(a.day || 0));
      renderList();
      routeFromHash();
    } catch (err) {
      console.error(err);
      chapterList.innerHTML = '<div class="setup-notice"><strong>The case files could not be loaded.</strong><p>Check your Firebase configuration and Firestore security rules. Refresh after setup.</p></div>';
      $("chapter-count").textContent = "CONNECTION ISSUE";
    }
  }
  start();
})();
