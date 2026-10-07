/**
 * MathsManthra — Enrollment & Payment System
 * ═══════════════════════════════════════════
 *
 * System 1 (data-mm-enroll): Lead Form → UPI QR → Screenshot Upload → Success
 * System 2 (data-mm-consult): Free Consultation Form → Consultation CRM
 *
 * Reads all settings from MM_CONFIG (config.js — must be loaded first).
 */

(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // ── SHARED STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /** Course Enrollment state */
  const enroll = {
    leadId: null,
    name: null,
    phone: null,
    email: null,
    courseId: null,
    courseName: null,
    price: null,
    busy: false,
    uploading: false,
  };

  /** Free Consultation state */
  const consult = {
    consultId: null,
    name: null,
    phone: null,
    email: null,
    busy: false,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ── DOM HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  function $(id) { return document.getElementById(id); }

  function openSheet(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove("translate-y-full", "pointer-events-none", "opacity-0");
    el.classList.add("translate-y-0");
    document.body.style.overflow = "hidden";
    // show backdrop
    const bd = $("mm-backdrop");
    if (bd) bd.classList.remove("hidden");
  }

  function closeSheet(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add("translate-y-full", "pointer-events-none", "opacity-0");
    el.classList.remove("translate-y-0");
  }

  function closeAllSheets() {
    [
      "mm-enroll-sheet",
      "mm-payment-sheet",
      "mm-upload-sheet",
      "mm-success-sheet",
      "mm-consult-sheet",
      "mm-consult-success-sheet",
    ].forEach(closeSheet);
    document.body.style.overflow = "";
    const bd = $("mm-backdrop");
    if (bd) bd.classList.add("hidden");
  }

  function fieldError(id, msg) {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function clearFieldErrors(...ids) {
    ids.forEach(id => {
      const el = $(id);
      if (el) { el.textContent = ""; el.classList.add("hidden"); }
    });
  }

  function setBtn(btnId, loading, defaultText) {
    const btn = $(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle("pointer-events-none", loading);
    btn.classList.toggle("cursor-not-allowed", loading);
    if (loading) {
      btn.setAttribute("aria-busy", "true");
    } else {
      btn.removeAttribute("aria-busy");
    }
    const textEl = btn.querySelector(".mm-btn-text");
    const spinner = btn.querySelector(".mm-spinner");
    if (textEl) textEl.textContent = loading ? textEl.dataset.loading || defaultText : (textEl.dataset.default || defaultText);
    if (spinner) spinner.classList.toggle("hidden", !loading);
  }

  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // ═══════════════════════════════════════════════════════════════════════════
  // ── NETWORK & CONFIG
  // ═══════════════════════════════════════════════════════════════════════════

  function getConfig() {
    if (typeof window !== "undefined" && window.MM_CONFIG) return window.MM_CONFIG;
    if (typeof MM_CONFIG !== "undefined") return MM_CONFIG;
    return {};
  }

  async function apiPost(url, payload) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" }, // Apps Script CORS requirement
        body: JSON.stringify(payload),
      });
    } catch (netErr) {
      console.error("[MM] Network / CORS error connecting to Apps Script:", netErr);
      throw new Error("Unable to reach Google Apps Script. Check network connection.");
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      console.error("[MM] Non-JSON response received from Apps Script:\n", text);
      if (text.includes("Page not found") || text.includes("Sorry, unable to open")) {
        throw new Error("Apps Script deployment returned 'Page not found'. Please ensure 'Who has access' is set to 'Anyone' in your Web App deployment settings.");
      }
      throw new Error("Invalid response from server. Check Apps Script deployment permissions.");
    }

    if (!data.success) throw new Error(data.error || "Server error");
    return data;
  }

  function isDemoUrl(url) {
    if (!url || typeof url !== "string") return true;
    const u = url.trim();
    return u === "" || u.startsWith("REPLACE_") || u.includes("YOUR_DEPLOYMENT_ID");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── SYSTEM 1: COURSE ENROLLMENT
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Populate course <select> from config ──────────────────────────────────
  function populateCourses() {
    const sel = $("mm-course-select");
    if (!sel) return;
    // Remove any previously injected options (keep placeholder)
    [...sel.querySelectorAll("option.mm-dyn")].forEach(o => o.remove());
    (MM_CONFIG.COURSES || []).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label + " — ₹" + c.price;
      opt.className = "mm-dyn";
      sel.appendChild(opt);
    });
  }

  // ── Also populate consult course select ──────────────────────────────────
  function populateConsultCourses() {
    const sel = $("mm-c-course");
    if (!sel) return;
    [...sel.querySelectorAll("option.mm-dyn")].forEach(o => o.remove());
    (MM_CONFIG.COURSES || []).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      opt.className = "mm-dyn";
      sel.appendChild(opt);
    });
  }

  // ── Lead ID Generator ─────────────────────────────────────────────────────
  function generateLeadId() {
    return "MM" + String(Date.now()).slice(-4);
  }

  // ── Build UPI URL ─────────────────────────────────────────────────────────
  function buildUpiUrl(leadId, price) {
    const p = new URLSearchParams({
      pa: MM_CONFIG.UPI_ID,
      pn: MM_CONFIG.BUSINESS_NAME,
      am: price,
      cu: "INR",
      tn: "MathsManthra Course",
      tr: leadId,
    });
    return "upi://pay?" + p.toString();
  }

  // ── Render QR ─────────────────────────────────────────────────────────────
  function renderQr(upiUrl) {
    const img = $("mm-qr-img");
    if (!img) return;
    img.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=" + encodeURIComponent(upiUrl);
    img.alt = "Scan to pay via UPI";
  }

  // ── Wire mobile pay buttons (hidden on desktop) ───────────────────────────
  function wirePaymentButtons(upiUrl) {
    const appsRow = $("mm-mobile-pay-apps");
    if (appsRow) appsRow.style.display = isMobile() ? "" : "none";

    const desktopHint = $("mm-desktop-hint");
    if (desktopHint) desktopHint.style.display = isMobile() ? "none" : "";

    const apps = [
      { id: "mm-btn-gpay", url: upiUrl.replace("upi://pay", "gpay://upi/pay") },
      { id: "mm-btn-phonepe", url: upiUrl.replace("upi://", "phonepe://") },
      { id: "mm-btn-paytm", url: upiUrl.replace("upi://", "paytmmp://") },
      { id: "mm-btn-generic", url: upiUrl },
    ];
    apps.forEach(({ id, url }) => {
      const btn = $(id);
      if (btn) btn.onclick = () => { window.location.href = url; };
    });
  }

  // ── PHASE 1: Submit Lead ──────────────────────────────────────────────────
  async function submitLead(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
    }

    if (enroll.busy) return;

    clearFieldErrors(
      "mm-err-name",
      "mm-err-phone",
      "mm-err-email",
      "mm-err-course"
    );

    const name = $("mm-name").value.trim();
    const phone = $("mm-phone").value.trim();
    const email = $("mm-email").value.trim();
    const course = $("mm-course-select").value;

    let ok = true;

    if (!name) {
      fieldError("mm-err-name", "Name is required");
      ok = false;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      fieldError(
        "mm-err-phone",
        "Enter a valid 10-digit Indian mobile number"
      );
      ok = false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldError(
        "mm-err-email",
        "Enter a valid email address"
      );
      ok = false;
    }

    if (!course) {
      fieldError(
        "mm-err-course",
        "Please select a course"
      );
      ok = false;
    }

    if (!ok) return;

    const courseObj =
      (MM_CONFIG.COURSES || []).find(
        c => c.id === course
      );

    if (!courseObj) {
      fieldError(
        "mm-err-course",
        "Invalid course selected"
      );
      return;
    }

    enroll.busy = true;
    setBtn(
      "mm-submit-lead",
      true,
      "Saving..."
    );

    try {

      // Generate Lead ID locally only
      const generatedLeadId = generateLeadId();

      enroll.leadId = generatedLeadId;
      enroll.name = name;
      enroll.phone = phone;
      enroll.email = email;
      enroll.courseId = course;
      enroll.courseName = courseObj.label;
      enroll.price = courseObj.price;

      console.log(
        "[MM] Lead saved locally:",
        generatedLeadId
      );

      closeSheet("mm-enroll-sheet");
      openPaymentSheet();

    } catch (err) {

      console.error(
        "[MM] Lead error:",
        err
      );

      fieldError(
        "mm-err-course",
        "Something went wrong. Please try again."
      );

    } finally {

      enroll.busy = false;

      setBtn(
        "mm-submit-lead",
        false,
        "Proceed to Payment →"
      );

    }
  }

  // ── PHASE 2: Payment QR Sheet ─────────────────────────────────────────────
  function openPaymentSheet() {
    const upiUrl = buildUpiUrl(enroll.leadId, enroll.price);

    $("mm-pay-lead-id").textContent = enroll.leadId;
    $("mm-pay-amount").textContent = "₹" + enroll.price;
    $("mm-pay-name").textContent = enroll.name;
    $("mm-pay-course").textContent = enroll.courseName;

    renderQr(upiUrl);
    wirePaymentButtons(upiUrl);
    openSheet("mm-payment-sheet");
  }

  // ── PHASE 3: Upload Screen ────────────────────────────────────────────────
  function openUploadSheet() {
    $("mm-upload-lead-id").textContent = enroll.leadId;
    $("mm-upload-amount").textContent = "₹" + enroll.price;
    const fi = $("mm-file-input");
    if (fi) fi.value = "";
    const prev = $("mm-file-preview");
    if (prev) prev.classList.add("hidden");
    const prog = $("mm-upload-progress");
    if (prog) prog.classList.add("hidden");
    clearFieldErrors("mm-err-file");
    enroll.uploading = false;
    setBtn("mm-submit-proof", false, "Submit Payment Proof");
    openSheet("mm-upload-sheet");
  }

  // ── File Preview ──────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      fieldError("mm-err-file", "Only JPG, PNG, or WEBP images accepted.");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      fieldError("mm-err-file", "File must be under 10 MB.");
      e.target.value = "";
      return;
    }
    clearFieldErrors("mm-err-file");

    const reader = new FileReader();
    reader.onload = ev => {
      const prev = $("mm-file-preview");
      if (prev) { prev.src = ev.target.result; prev.classList.remove("hidden"); }
    };
    reader.readAsDataURL(file);
  }

  // ── File → base64 ────────────────────────────────────────────────────────
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        try {
          const res = r.result;
          if (!res || typeof res !== "string") {
            throw new Error("FileReader returned empty result");
          }
          const base64 = res.indexOf(",") > -1 ? res.split(",")[1] : res;
          console.log("[MM] Step 2: imageBase64 generated successfully. Size:", Math.round(base64.length / 1024), "KB");
          resolve(base64);
        } catch (err) {
          console.error("[MM] Error extracting base64:", err);
          reject(err);
        }
      };
      r.onerror = err => {
        console.error("[MM] FileReader error:", err);
        reject(err);
      };
      r.readAsDataURL(file);
    });
  }

  // ── PHASE 4: Submit Payment Proof ─────────────────────────────────────────
  async function submitProof(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
    }

    // Strict concurrency lock: abort if an upload is already running
    if (enroll.uploading) return;

    clearFieldErrors("mm-err-file");
    const file = $("mm-file-input") ? $("mm-file-input").files[0] : null;
    if (!file) {
      fieldError("mm-err-file", "Please upload your payment screenshot.");
      return;
    }

    // Lock submission & trigger visual loading state immediately
    enroll.uploading = true;
    setBtn("mm-submit-proof", true, "Uploading…");
    const prog = $("mm-upload-progress");
    if (prog) prog.classList.remove("hidden");

    try {
      console.log("[MM] Step 1: Image selected. Name:", file.name, "Type:", file.type, "Size:", Math.round(file.size / 1024), "KB");

      const base64 = await fileToBase64(file);
      if (!base64 || base64.trim() === "") {
        throw new Error("Failed to generate image base64 data.");
      }

      const proofPayload = {
        action: "savePaymentProof",
        leadId: enroll.leadId,
        name: enroll.name,
        phone: enroll.phone,
        amount: enroll.price,
        fileName: file.name,
        fileType: file.type || "image/jpeg",
        imageBase64: base64, // Primary field expected by Apps Script
        fileData: base64,    // Backward compatible alias
      };

      console.log("[MM] Step 3: Payload prepared with imageBase64 (length: " + base64.length + "):", {
        action: proofPayload.action,
        leadId: proofPayload.leadId,
        name: proofPayload.name,
        phone: proofPayload.phone,
        amount: proofPayload.amount,
        fileName: proofPayload.fileName,
        fileType: proofPayload.fileType,
        hasImageBase64: Boolean(proofPayload.imageBase64),
      });

      if (!isDemoUrl(MM_CONFIG.COURSE_APPS_SCRIPT_URL)) {
        console.log("[MM] Step 4: Sending POST request to Apps Script...");
        const data = await apiPost(MM_CONFIG.COURSE_APPS_SCRIPT_URL, proofPayload);
        console.log("[MM] Step 5: Apps Script response received:", data);
        if (data.fileUrl) {
          console.log("[MM] Step 6: Screenshot uploaded to Drive! URL:", data.fileUrl);
        } else {
          console.warn("[MM] Warning: Apps Script did not return fileUrl:", data);
        }
      } else {
        // Demo mode
        await new Promise(r => setTimeout(r, 1500));
        console.warn("[MM] COURSE_APPS_SCRIPT_URL not set — running in demo mode. Demo Lead ID:", enroll.leadId);
      }

      closeSheet("mm-upload-sheet");
      openSuccessSheet();

    } catch (err) {
      console.error("[MM] Upload error:", err);
      fieldError("mm-err-file", "Upload failed: " + (err.message || "Please try again."));
    } finally {
      enroll.uploading = false;
      setBtn("mm-submit-proof", false, "Submit Payment Proof");
      if (prog) prog.classList.add("hidden");
    }
  }

  // ── PHASE 5: Success ─────────────────────────────────────────────────────
  function openSuccessSheet() {
    $("mm-success-lead-id").textContent = enroll.leadId;
    openSheet("mm-success-sheet");
  }

  // ── WhatsApp prefill (enrollment) ─────────────────────────────────────────
  function enrollWhatsApp() {
    const msg = encodeURIComponent(
      `Hi MathsManthra,\n\nI have completed my payment.\n\nLead ID: ${enroll.leadId}\nName: ${enroll.name}\nCourse: ${enroll.courseName}\n\nPlease verify my enrollment.`
    );
    window.open(`https://wa.me/${MM_CONFIG.WHATSAPP_NUMBER}?text=${msg}`, "_blank");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── SYSTEM 2: FREE CONSULTATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function submitConsultation(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") {
        e.stopImmediatePropagation();
      }
    }
    if (consult.busy) return;

    clearFieldErrors("mm-err-c-name", "mm-err-c-phone", "mm-err-c-email");

    const name = $("mm-c-name") ? $("mm-c-name").value.trim() : "";
    const phone = $("mm-c-phone") ? $("mm-c-phone").value.trim() : "";
    const email = $("mm-c-email") ? $("mm-c-email").value.trim() : "";
    const course = $("mm-c-course") ? $("mm-c-course").value : "";
    const role = $("mm-c-role") ? $("mm-c-role").value : "";
    const notes = $("mm-c-notes") ? $("mm-c-notes").value.trim() : "";

    let ok = true;
    if (!name) { fieldError("mm-err-c-name", "Name is required"); ok = false; }
    if (!/^[6-9]\d{9}$/.test(phone)) { fieldError("mm-err-c-phone", "Enter a valid 10-digit Indian mobile number"); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldError("mm-err-c-email", "Enter a valid email address"); ok = false; }
    if (!ok) return;

    consult.busy = true;
    setBtn("mm-submit-consult", true, "Scheduling…");

    try {
      let consultId;

      if (!isDemoUrl(MM_CONFIG.CONSULTATION_APPS_SCRIPT_URL)) {
        const data = await apiPost(MM_CONFIG.CONSULTATION_APPS_SCRIPT_URL, {
          action: "createConsultation",
          name, phone, email, course, role, notes,
          source: "landing_page_consultation",
        });
        consultId = data.consultId;
      } else {
        consultId = "FC" + String(Date.now()).slice(-4);
        console.warn("[MM] CONSULTATION_APPS_SCRIPT_URL not set — running in demo mode.");
      }

      consult.consultId = consultId;
      consult.name = name;
      consult.phone = phone;
      consult.email = email;

      const form = $("mm-consult-form");
      if (form) form.reset();

      closeSheet("mm-consult-sheet");
      openConsultSuccess();

    } catch (err) {
      console.error("[MM] Consultation error:", err);
      fieldError("mm-err-c-email", "Something went wrong. Please try again.");
    } finally {
      consult.busy = false;
      setBtn("mm-submit-consult", false, "Schedule Free Call →");
    }
  }

  function openConsultSuccess() {
    const el = $("mm-consult-success-id");
    if (el) el.textContent = consult.consultId;
    openSheet("mm-consult-success-sheet");
  }

  function consultWhatsApp() {
    const msg = encodeURIComponent(
      `Hi MathsManthra,\n\nI just booked a Free Consultation.\n\nConsultation ID: ${consult.consultId}\nName: ${consult.name}\n\nLooking forward to our call!`
    );
    window.open(`https://wa.me/${MM_CONFIG.WHATSAPP_NUMBER}?text=${msg}`, "_blank");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── INIT
  // ═══════════════════════════════════════════════════════════════════════════

  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    populateCourses();
    populateConsultCourses();

    // Wire all [data-mm-enroll] buttons → enrollment sheet
    document.querySelectorAll("[data-mm-enroll]").forEach(btn => {
      btn.addEventListener("click", e => { e.preventDefault(); openSheet("mm-enroll-sheet"); });
    });

    // Wire all [data-mm-consult] buttons → consultation sheet
    document.querySelectorAll("[data-mm-consult]").forEach(btn => {
      btn.addEventListener("click", e => { e.preventDefault(); openSheet("mm-consult-sheet"); });
    });

    // Backdrop click → close all
    const bd = $("mm-backdrop");
    if (bd) bd.addEventListener("click", closeAllSheets);

    // All [data-mm-close] close buttons
    document.querySelectorAll("[data-mm-close]").forEach(btn => {
      btn.addEventListener("click", () => closeSheet(btn.dataset.mmClose));
    });

    // ── Enrollment form ──────────────────────────────────────────────────────
    const enrollForm = $("mm-enroll-form");
    const enrollBtn = $("mm-submit-lead");
    if (enrollBtn) enrollBtn.onclick = null;
    if (enrollForm) {
      enrollForm.onsubmit = null;
      enrollForm.removeEventListener("submit", submitLead);
      enrollForm.addEventListener("submit", submitLead);
    }

    // "I've Paid" button
    const paidBtn = $("mm-ive-paid");
    if (paidBtn) paidBtn.addEventListener("click", () => {
      closeSheet("mm-payment-sheet");
      openUploadSheet();
    });

    // File input preview
    const fileInput = $("mm-file-input");
    if (fileInput) fileInput.addEventListener("change", handleFileChange);

    // Proof upload form
    const proofForm = $("mm-proof-form");
    const proofBtn = $("mm-submit-proof");
    if (proofBtn) proofBtn.onclick = null;
    if (proofForm) {
      proofForm.onsubmit = null;
      proofForm.removeEventListener("submit", submitProof);
      proofForm.addEventListener("submit", submitProof);
    }

    // Success: WhatsApp + close
    const waBtn = $("mm-whatsapp-support");
    if (waBtn) waBtn.addEventListener("click", enrollWhatsApp);

    const closeSuccess = $("mm-close-success");
    if (closeSuccess) closeSuccess.addEventListener("click", closeAllSheets);

    // ── Consultation form ────────────────────────────────────────────────────
    const consultForm = $("mm-consult-form");
    const consultBtn = $("mm-submit-consult");
    if (consultBtn) consultBtn.onclick = null;
    if (consultForm) {
      consultForm.onsubmit = null;
      consultForm.removeEventListener("submit", submitConsultation);
      consultForm.addEventListener("submit", submitConsultation);
    }

    const consultWa = $("mm-consult-whatsapp");
    if (consultWa) consultWa.addEventListener("click", consultWhatsApp);

    const closeConsult = $("mm-close-consult-success");
    if (closeConsult) closeConsult.addEventListener("click", closeAllSheets);

    // Payment WhatsApp help link
    const payWaHelp = $("mm-pay-wa-help");
    if (payWaHelp) {
      payWaHelp.addEventListener("click", e => {
        e.preventDefault();
        const msg = encodeURIComponent(`Hi MathsManthra, I need help with UPI payment.\nLead ID: ${enroll.leadId || "N/A"}`);
        window.open(`https://wa.me/${MM_CONFIG.WHATSAPP_NUMBER}?text=${msg}`, "_blank");
      });
    }
  }

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

})();
