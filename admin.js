(() => {
  const $ = (id) => document.getElementById(id);
  const fields = ["day","quality","case-title-input","original-message","court-question","aadi-response","final-observation","next-hearing","published"];
  let db = null, auth = null, records = [], selectedId = null, toastTimer;
  let currentImageData = "", imageProcessing = Promise.resolve();

  function configured() {
    const c = window.DIL_FIREBASE_CONFIG || {};
    return c.apiKey && !c.apiKey.startsWith("PASTE_") && c.projectId && !c.projectId.startsWith("YOUR_");
  }
  function toast(message) {
    const el = $("toast");
    el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }
  function setError(message) { $("editor-error").textContent = message || ""; }
  function setLoginError(message) { $("login-error").textContent = message || ""; }
  function showLogin() { $("login-panel").classList.remove("hidden"); $("dashboard-panel").classList.add("hidden"); }
  function showDashboard() { $("login-panel").classList.add("hidden"); $("dashboard-panel").classList.remove("hidden"); }
  function getFormData(publishedOverride) {
    return {
      day: Number($("day").value),
      quality: $("quality").value.trim(),
      caseTitle: $("case-title-input").value.trim(),
      originalMessage: $("original-message").value,
      courtQuestion: $("court-question").value.trim(),
      response: $("aadi-response").value,
      finalObservation: $("final-observation").value.trim(),
      nextHearing: $("next-hearing").value.trim(),
      imageData: currentImageData || "",
      imageAlt: $("case-title-input").value.trim(),
      published: typeof publishedOverride === "boolean" ? publishedOverride : $("published").checked,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }
  function fillForm(c = null) {
    selectedId = c ? c.id : null;
    $("chapter-id").value = selectedId || "";
    $("editor-state").textContent = c ? `EDITING DAY ${String(c.day).padStart(2,"0")}` : "NEW CHAPTER";
    $("saved-state").textContent = "";
    $("delete-chapter").classList.toggle("hidden", !c);
    $("day").value = c?.day ?? (records.length ? Math.max(...records.map(r => Number(r.day)||0)) + 1 : 30);
    $("quality").value = c?.quality || "";
    $("case-title-input").value = c?.caseTitle || "";
    $("original-message").value = c?.originalMessage || "";
    $("court-question").value = c?.courtQuestion || "";
    $("aadi-response").value = c?.response || "";
    $("final-observation").value = c?.finalObservation || "";
    $("next-hearing").value = c?.nextHearing || "";
    currentImageData = c?.imageData || "";
    $("chapter-image-file").value = "";
    $("image-upload-status").textContent = currentImageData ? "An image is saved with this chapter. Choose another image to replace it." : "No image selected. Existing image is kept when editing unless you replace or remove it.";
    $("image-preview-wrap").classList.toggle("hidden", !currentImageData);
    if (currentImageData) $("chapter-image-preview").src = currentImageData;
    $("published").checked = Boolean(c?.published);
    setError("");
    renderAdminList();
  }
  function renderAdminList() {
    const list = $("admin-chapter-list");
    list.replaceChildren();
    const sorted = [...records].sort((a,b) => Number(b.day||0)-Number(a.day||0));
    sorted.forEach((c) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `admin-chapter-item${c.id === selectedId ? " active" : ""}`;
      const day = document.createElement("span"); day.className = "admin-day"; day.textContent = `DAY ${String(c.day).padStart(2,"0")}`;
      const title = document.createElement("strong"); title.textContent = c.quality || "Untitled chapter";
      const status = document.createElement("small"); status.textContent = c.published ? "● Published" : "○ Draft";
      status.className = c.published ? "status-live" : "status-draft";
      button.append(day,title,status);
      button.addEventListener("click", () => fillForm(c));
      list.append(button);
    });
    $("total-count").textContent = records.length;
    $("published-count").textContent = records.filter(r => r.published).length;
    $("draft-count").textContent = records.filter(r => !r.published).length;
  }
  async function loadRecords() {
    const snap = await db.collection("chapters").get();
    records = snap.docs.map(doc => ({id:doc.id, ...doc.data()}));
    renderAdminList();
    if (selectedId) {
      const current = records.find(r => r.id === selectedId);
      if (current) fillForm(current);
    }
  }
  async function save(publishOverride) {
    setError("");
    try { await imageProcessing; } catch (e) { setError("The image could not be processed. Please choose another image."); return; }
    const data = getFormData(publishOverride);
    if (!data.day || !data.quality || !data.caseTitle || !data.originalMessage.trim() || !data.courtQuestion || !data.response.trim() || !data.finalObservation || !data.nextHearing) {
      setError("Please complete every field before saving. You can save this as a draft by leaving Publish unchecked.");
      return;
    }
    try {
      $("save-draft").disabled = true; $("save-publish").disabled = true;
      let ref;
      if (selectedId) {
        ref = db.collection("chapters").doc(selectedId);
        await ref.set(data, { merge: true });
      } else {
        ref = await db.collection("chapters").add({...data, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
        selectedId = ref.id;
      }
      await loadRecords();
      const saved = records.find(r => r.id === selectedId);
      fillForm(saved || null);
      $("saved-state").textContent = "SAVED SUCCESSFULLY";
      toast(data.published ? "Chapter saved and published." : "Draft saved privately.");
    } catch (err) {
      console.error(err);
      setError("Save failed. Check that your account UID matches the admin UID in Firestore rules, then try again.");
    } finally {
      $("save-draft").disabled = false; $("save-publish").disabled = false;
    }
  }
  async function removeSelected() {
    if (!selectedId) return;
    const current = records.find(r => r.id === selectedId);
    if (!confirm(`Delete Day ${current?.day || ""}? This cannot be undone.`)) return;
    try {
      await db.collection("chapters").doc(selectedId).delete();
      records = records.filter(r => r.id !== selectedId);
      fillForm(null);
      renderAdminList();
      toast("Chapter deleted.");
    } catch (err) {
      console.error(err);
      setError("Delete failed. Check your Firestore security rules.");
    }
  }

  async function compressImage(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("Please choose an image file.");
    const sourceUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = sourceUrl;
    });
    const maxWidth = 1500, maxHeight = 950;
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#f8f4ed"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.78;
    let result = canvas.toDataURL("image/jpeg", quality);
    while (result.length > 720000 && quality > 0.42) {
      quality -= 0.08;
      result = canvas.toDataURL("image/jpeg", quality);
    }
    if (result.length > 720000) {
      const shrink = 0.78;
      canvas.width = Math.max(1, Math.round(canvas.width * shrink));
      canvas.height = Math.max(1, Math.round(canvas.height * shrink));
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      result = canvas.toDataURL("image/jpeg", 0.48);
    }
    if (result.length > 850000) throw new Error("This image is too large to store safely. Please choose a smaller image.");
    return result;
  }
  $("chapter-image-file").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    $("image-upload-status").textContent = "Preparing your image…";
    imageProcessing = compressImage(file).then((data) => {
      currentImageData = data;
      $("chapter-image-preview").src = data;
      $("image-preview-wrap").classList.remove("hidden");
      $("image-upload-status").textContent = `Image ready · landscape-friendly · ${(data.length / 1024).toFixed(0)} KB after compression.`;
    }).catch((err) => {
      console.error(err);
      $("image-upload-status").textContent = err.message || "Could not process this image.";
      currentImageData = "";
      setError(err.message || "Could not process this image.");
    });
  });
  $("remove-chapter-image").addEventListener("click", () => {
    currentImageData = "";
    $("chapter-image-file").value = "";
    $("image-preview-wrap").classList.add("hidden");
    $("image-upload-status").textContent = "Image removed. Save the chapter to publish this change.";
  });

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault(); setLoginError("");
    try {
      await auth.signInWithEmailAndPassword($("login-email").value.trim(), $("login-password").value);
    } catch (err) {
      setLoginError("Login failed. Check your email and password, and confirm Email/Password sign-in is enabled in Firebase.");
    }
  });
  $("logout-button").addEventListener("click", () => auth.signOut());
  $("new-chapter").addEventListener("click", () => fillForm(null));
  $("chapter-form").addEventListener("submit", (e) => { e.preventDefault(); save(true); });
  $("save-draft").addEventListener("click", () => save(false));
  $("delete-chapter").addEventListener("click", removeSelected);

  if (!configured()) {
    $("login-error").textContent = "Setup needed: add your Firebase web app configuration to firebase-config.js first.";
  } else {
    try {
      firebase.initializeApp(window.DIL_FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      auth.onAuthStateChanged(async (user) => {
        if (!user) { showLogin(); records = []; return; }
        showDashboard();
        try {
          await loadRecords();
          if (!selectedId) fillForm(null);
        } catch (err) {
          console.error(err);
          setError("Could not load records. Make sure your signed-in UID is the admin UID in firestore.rules.");
        }
      });
    } catch (err) {
      console.error(err);
      setLoginError("Firebase could not initialise. Check firebase-config.js.");
    }
  }
})();
