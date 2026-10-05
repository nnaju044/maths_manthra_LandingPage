/**
 * MathsManthra — Central Configuration
 * Edit all settings here. No need to touch any other files.
 */
const MM_CONFIG = {

  // ── Google Apps Script ─────────────────────────────────────────────────────
  // Deploy your Apps Script as a Web App and paste the URL here.
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbymCj5hZlG5OeVeihQI5Xrr4t11dFqvhe0soBjpL4PdOhHRFmqN6_aUg5fk89fdQHGj/exec",

  // ── UPI Payment ────────────────────────────────────────────────────────────
  UPI_ID: "nnaju044-2@oksbi",
  BUSINESS_NAME: "MathsManthra Academy",

  // ── WhatsApp Support ───────────────────────────────────────────────────────
  // International format without + sign (e.g., 919876543210 for India)
  WHATSAPP_NUMBER: "917560908799",

  // ── Courses & Pricing ──────────────────────────────────────────────────────
  COURSES: [
    {
      id: "ai_digital_5day",
      label: "AI & Digital Marketing for Teachers (5-Day) — ₹999",
      price: 999,
    },
    // Add more courses here as needed
    // { id: "advanced", label: "Advanced Program — ₹1,999", price: 1999 },
  ],

  // ── UTM / Tracking (optional) ──────────────────────────────────────────────
  DEFAULT_SOURCE: "landing_page",
  DEFAULT_CAMPAIGN: "oct_2025_cohort",

  // ── Google Drive ───────────────────────────────────────────────────────────
  // The Apps Script will upload screenshots into this folder.
  // Set the folder ID in your Apps Script (see appsscript.gs).
  DRIVE_FOLDER_NAME: "MathsManthra Payments",

};
