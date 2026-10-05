/**
 * MathsManthra — Enrollment & Payment System
 * Handles: Lead form → UPI QR → Screenshot upload → Success
 */

(function () {
  "use strict";

  // ─── State ────────────────────────────────────────────────────────────────
  let state = {
    leadId:     null,
    name:       null,
    phone:      null,
    email:      null,
    courseId:   null,
    courseName: null,
    price:      null,
    submitting: false,
    uploading:  false,
  };

  // ─── Utility helpers ──────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  function openSheet(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove("translate-y-full", "pointer-events-none", "opacity-0");
    el.classList.add("translate-y-0");
    document.body.style.overflow = "hidden";
  }

  function closeSheet(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add("translate-y-full", "pointer-events-none", "opacity-0");
    el.classList.remove("translate-y-0");
    document.body.style.overflow = "";
  }

  function closeAllSheets() {
    ["mm-enroll-sheet", "mm-payment-sheet", "mm-upload-sheet", "mm-success-sheet"].forEach(closeSheet);
    document.body.style.overflow = "";
  }

  function showError(fieldId, msg) {
    const el = $(fieldId);
    if (el) { el.textContent = msg; el.classList.remove("hidden"); }
  }

  function clearErrors() {
    ["mm-err-name", "mm-err-phone", "mm-err-email", "mm-err-course", "mm-err-file"].forEach(id => {
      const el = $(id);
      if (el) { el.textContent = ""; el.classList.add("hidden"); }
    });
  }

  function setBtn(btnId, loading, text) {
    const btn = $(btnId);
    if (!btn) return;
    btn.disabled = loading;
    const textEl = btn.querySelector(".mm-btn-text");
    if (textEl) textEl.textContent = text;
    const spinner = btn.querySelector(".mm-spinner");
    if (spinner) spinner.classList.toggle("hidden", !loading);
  }

  // ─── Populate course dropdown ──────────────────────────────────────────────
  function populateCourses() {
    const sel = $("mm-course-select");
    if (!sel) return;
    (MM_CONFIG.COURSES || []).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      sel.appendChild(opt);
    });
  }

  // ─── Lead ID generator (client-side temp; server returns canonical one) ────
  function tempLeadId() {
    return "MM" + String(Math.floor(Math.random() * 9000) + 1000);
  }

  // ─── Build UPI deep-link ──────────────────────────────────────────────────
  function buildUpiUrl(leadId, price) {
    const params = new URLSearchParams({
      pa: MM_CONFIG.UPI_ID,
      pn: MM_CONFIG.BUSINESS_NAME,
      am: price,
      cu: "INR",
      tn: "MathsManthra Teacher Program",
      tr: leadId,
    });
    return "upi://pay?" + params.toString();
  }

  // ─── QR code via public CDN API ───────────────────────────────────────────
  function renderQr(upiUrl) {
    const img = $("mm-qr-img");
    if (!img) return;
    const encoded = encodeURIComponent(upiUrl);
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`;
    img.alt = "UPI QR Code";
  }

  // ─── Payment app deep links ───────────────────────────────────────────────
  function wirePaymentButtons(upiUrl) {
    const apps = [
      { id: "mm-btn-gpay",    url: upiUrl.replace("upi://pay", "gpay://upi/pay") },
      { id: "mm-btn-phonepe", url: upiUrl.replace("upi://", "phonepe://") },
      { id: "mm-btn-paytm",   url: upiUrl.replace("upi://", "paytmmp://") },
      { id: "mm-btn-generic", url: upiUrl },
    ];
    apps.forEach(({ id, url }) => {
      const btn = $(id);
      if (btn) btn.onclick = () => window.location.href = url;
    });
  }

  // ─── PHASE 1 — Submit lead to Apps Script ─────────────────────────────────
  async function submitLead(e) {
    e.preventDefault();
    if (state.submitting) return;

    clearErrors();

    const name   = $("mm-name").value.trim();
    const phone  = $("mm-phone").value.trim();
    const email  = $("mm-email").value.trim();
    const course = $("mm-course-select").value;

    let valid = true;
    if (!name)                              { showError("mm-err-name",   "Name is required"); valid = false; }
    if (!/^[6-9]\d{9}$/.test(phone))       { showError("mm-err-phone",  "Enter a valid 10-digit Indian mobile number"); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError("mm-err-email", "Enter a valid email address"); valid = false; }
    if (!course)                            { showError("mm-err-course", "Please select a course"); valid = false; }
    if (!valid) return;

    const courseObj = (MM_CONFIG.COURSES || []).find(c => c.id === course);
    if (!courseObj) return;

    state.submitting = true;
    setBtn("mm-submit-lead", true, "Saving…");

    try {
      const payload = {
        action:   "createLead",
        name, phone, email,
        course:   courseObj.label,
        courseId: courseObj.id,
        price:    courseObj.price,
        source:   MM_CONFIG.DEFAULT_SOURCE || "landing_page",
        campaign: MM_CONFIG.DEFAULT_CAMPAIGN || "",
      };

      let leadId;
      if (MM_CONFIG.APPS_SCRIPT_URL && !MM_CONFIG.APPS_SCRIPT_URL.includes("YOUR_DEPLOYMENT_ID")) {
        const res  = await fetch(MM_CONFIG.APPS_SCRIPT_URL, {
          method:  "POST",
          headers: { "Content-Type": "text/plain" },
          body:    JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Server error");
        leadId = data.leadId;
      } else {
        // Demo mode — Apps Script not yet configured
        leadId = "MM" + String(Date.now()).slice(-4);
      }

      state.leadId     = leadId;
      state.name       = name;
      state.phone      = phone;
      state.email      = email;
      state.courseId   = course;
      state.courseName = courseObj.label;
      state.price      = courseObj.price;

      // Close enrollment sheet, open payment sheet
      closeSheet("mm-enroll-sheet");
      showPaymentSheet();

    } catch (err) {
      console.error("Lead submission error:", err);
      showError("mm-err-course", "Something went wrong. Please try again.");
    } finally {
      state.submitting = false;
      setBtn("mm-submit-lead", false, "Proceed to Payment →");
    }
  }

  // ─── PHASE 2 — Show payment QR ────────────────────────────────────────────
  function showPaymentSheet() {
    const upiUrl = buildUpiUrl(state.leadId, state.price);

    $("mm-pay-lead-id").textContent  = state.leadId;
    $("mm-pay-amount").textContent   = "₹" + state.price;
    $("mm-pay-name").textContent     = state.name;

    renderQr(upiUrl);
    wirePaymentButtons(upiUrl);
    openSheet("mm-payment-sheet");
  }

  // ─── PHASE 3 — "I've Paid" → upload sheet ─────────────────────────────────
  function showUploadSheet() {
    $("mm-upload-lead-id").textContent = state.leadId;
    $("mm-upload-amount").textContent  = "₹" + state.price;
    $("mm-file-input").value           = "";
    $("mm-file-preview").classList.add("hidden");
    $("mm-upload-progress").classList.add("hidden");
    clearErrors();
    openSheet("mm-upload-sheet");
  }

  // ─── File preview ─────────────────────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      showError("mm-err-file", "Only JPG, PNG, or WEBP images are accepted.");
      e.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError("mm-err-file", "File must be under 10 MB.");
      e.target.value = "";
      return;
    }
    clearErrors();

    const reader = new FileReader();
    reader.onload = ev => {
      const prev = $("mm-file-preview");
      prev.src = ev.target.result;
      prev.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }

  // ─── PHASE 4 — Upload screenshot ──────────────────────────────────────────
  async function submitPaymentProof(e) {
    e.preventDefault();
    if (state.uploading) return;

    clearErrors();
    const file = $("mm-file-input").files[0];
    if (!file) { showError("mm-err-file", "Please upload your payment screenshot."); return; }

    state.uploading = true;
    setBtn("mm-submit-proof", true, "Uploading…");
    $("mm-upload-progress").classList.remove("hidden");

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);

      const payload = {
        action:    "savePaymentProof",
        leadId:    state.leadId,
        name:      state.name,
        phone:     state.phone,
        amount:    state.price,
        fileName:  file.name,
        fileType:  file.type,
        fileData:  base64,
      };

      if (MM_CONFIG.APPS_SCRIPT_URL && !MM_CONFIG.APPS_SCRIPT_URL.includes("YOUR_DEPLOYMENT_ID")) {
        const res  = await fetch(MM_CONFIG.APPS_SCRIPT_URL, {
          method:  "POST",
          headers: { "Content-Type": "text/plain" },
          body:    JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Upload failed");
      } else {
        // Demo mode
        await new Promise(r => setTimeout(r, 1500));
      }

      closeSheet("mm-upload-sheet");
      showSuccessSheet();

    } catch (err) {
      console.error("Upload error:", err);
      showError("mm-err-file", "Upload failed. Please try again.");
    } finally {
      state.uploading = false;
      setBtn("mm-submit-proof", false, "Submit Payment Proof");
      $("mm-upload-progress").classList.add("hidden");
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ─── PHASE 5 — Success screen ─────────────────────────────────────────────
  function showSuccessSheet() {
    $("mm-success-lead-id").textContent = state.leadId;
    openSheet("mm-success-sheet");
  }

  // ─── PHASE 6 — WhatsApp prefilled ─────────────────────────────────────────
  function openWhatsApp() {
    const msg = encodeURIComponent(
      `Hi MathsManthra,\n\nI have completed payment.\n\nLead ID: ${state.leadId}\n\nPlease verify my enrollment.\n\nName: ${state.name}\nCourse: ${state.courseName}`
    );
    window.open(`https://wa.me/${MM_CONFIG.WHATSAPP_NUMBER}?text=${msg}`, "_blank");
  }

  // ─── Wire all "Enroll Now" / "Book" buttons ───────────────────────────────
  function wireEnrollButtons() {
    document.querySelectorAll("[data-mm-enroll]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        openSheet("mm-enroll-sheet");
      });
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    populateCourses();
    wireEnrollButtons();

    // Enroll form submit
    const enrollForm = $("mm-enroll-form");
    if (enrollForm) enrollForm.addEventListener("submit", submitLead);

    // Backdrop clicks close sheets
    document.querySelectorAll("[data-mm-backdrop]").forEach(el => {
      el.addEventListener("click", () => closeAllSheets());
    });

    // Close buttons
    document.querySelectorAll("[data-mm-close]").forEach(btn => {
      btn.addEventListener("click", () => closeSheet(btn.dataset.mmClose));
    });

    // "I've Paid" button
    const paidBtn = $("mm-ive-paid");
    if (paidBtn) paidBtn.addEventListener("click", () => {
      closeSheet("mm-payment-sheet");
      showUploadSheet();
    });

    // File input
    const fileInput = $("mm-file-input");
    if (fileInput) fileInput.addEventListener("change", handleFileChange);

    // Proof submit
    const proofForm = $("mm-proof-form");
    if (proofForm) proofForm.addEventListener("submit", submitPaymentProof);

    // WhatsApp button on success
    const waBtn = $("mm-whatsapp-support");
    if (waBtn) waBtn.addEventListener("click", openWhatsApp);

    // Close success
    const closeSuccess = $("mm-close-success");
    if (closeSuccess) closeSuccess.addEventListener("click", () => closeAllSheets());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
