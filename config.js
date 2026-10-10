/**
 * MathsManthra — Central Configuration
 * Edit all settings here. No need to touch any other files.
 */
const MM_CONFIG = {

  // ── Google Apps Script ─────────────────────────────────────────────────────
  // Deploy your Apps Script as a Web App and paste the URL here.
  COURSE_APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwoGLYjOVrh1Bc52O3G8v1utLoIpdjayhqq7D8xr-FZ5-fppDfpBOro8YmtYNAG0_BpKA/exec",

  // ── Free Consultation Endpoint (Optional) ──────────────────────────────────
  // If you use a separate Apps Script Web App for Free Consultations, paste it here.
  // If left empty, it will route through APPS_SCRIPT_URL with action: "createConsultation"
  CONSULTATION_APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxvxvntMaNJrVB3R9mIpXNBrYe7YESKVeyMpkVBPWAYJAHqgqd5e95GoEv7qZr4O50Seg/exec",

  // ── UPI Payment ────────────────────────────────────────────────────────────
  UPI_ID: "smijasmija006@oksbi",
  BUSINESS_NAME: "MathsManthra Academy",

  // ── WhatsApp Support ───────────────────────────────────────────────────────
  // International format without + sign (e.g., 919876543210 for India)
  WHATSAPP_NUMBER: "917560908799",

  // ── AI Mentor Assistant Endpoint ──────────────────────────────────────────
  AI_API_URL: "http://localhost:4000/api/chat",

  // ── Courses & Pricing ──────────────────────────────────────────────────────
  COURSES: [
    {
      id: "edupreneur_mentorship",
      label: "Course 3 — Edupreneur Mentorship",
      price: 5999,
    },
  ],

  // ── UTM / Tracking (optional) ──────────────────────────────────────────────
  DEFAULT_SOURCE: "landing_page",
  DEFAULT_CAMPAIGN: "edupreneur_mentorship",

  // ── Google Drive ───────────────────────────────────────────────────────────
  // The Apps Script will upload screenshots into this folder.
  // Set the folder ID in your Apps Script (see appsscript.gs).
  DRIVE_FOLDER_NAME: "MathsManthra Payments",

};

// Expose globally on window
if (typeof window !== "undefined") {
  window.MM_CONFIG = MM_CONFIG;
}
