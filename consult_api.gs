/**
 * MathsManthra — Free Consultation Booking API
 * ═════════════════════════════════════════════
 *
 * SETUP INSTRUCTIONS
 * ──────────────────
 * 1. Go to https://script.google.com → New Project → name it "MM Consultation API"
 * 2. Paste this entire file into Code.gs
 * 3. Fill in SPREADSHEET_ID below
 * 4. Click Deploy → New Deployment
 *    - Type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Authorize → Copy the Web App URL
 * 6. Paste that URL into config.js → CONSULTATION_APPS_SCRIPT_URL
 *
 * SPREADSHEET SETUP
 * ─────────────────
 * Create a Google Sheet named: MathsManthra Consultation
 * Spreadsheet ID: 1gJfoSAvo6gM9KaZrIgHgOZmcLGbuL0U7f18w3o-WXy8
 * The script auto-creates the "Consultations" tab with headers
 */

// ── Edit These ──────────────────────────────────────────────────────────────
const CONSULT_CONFIG = {
  SPREADSHEET_ID: "1gJfoSAvo6gM9KaZrIgHgOZmcLGbuL0U7f18w3o-WXy8",
};

// ── Sheet name (do not change) ───────────────────────────────────────────────
const SHEET_CONSULTATIONS = "Consultations";

// ── Entry Point ──────────────────────────────────────────────────────────────
function doPost(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);

  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;

    let result;
    if (action === "createConsultation") result = createConsultation(body);
    else                                 result = { success: false, error: "Unknown action: " + action };

    out.setContent(JSON.stringify(result));
  } catch (err) {
    out.setContent(JSON.stringify({ success: false, error: err.message }));
  }

  return out;
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", api: "MathsManthra Consultation API v1" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Create Consultation ───────────────────────────────────────────────────────
function createConsultation(data) {
  const ss    = SpreadsheetApp.openById(CONSULT_CONFIG.SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_CONSULTATIONS);

  // Auto-create sheet with styled headers if missing
  if (!sheet) {
    // Use blank first sheet if it has no data, else insert new
    const first = ss.getSheets()[0];
    if (first && first.getLastRow() === 0) {
      first.setName(SHEET_CONSULTATIONS);
      sheet = first;
    } else {
      sheet = ss.insertSheet(SHEET_CONSULTATIONS);
    }
    sheet.appendRow([
      "Consultation ID", "Name", "Phone", "Email",
      "Interested Course", "Role / Profile", "Message / Notes",
      "Source", "Created Date", "Status"
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#234a8a").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(9, 180);
  }

  // Generate sequential Consultation ID: FC0001, FC0002 ...
  const lastRow   = sheet.getLastRow();
  const seq       = lastRow; // row 1 = header
  const consultId = "FC" + String(seq).padStart(4, "0");

  sheet.appendRow([
    consultId,
    data.name    || "",
    data.phone   || "",
    data.email   || "",
    data.course  || "",
    data.role    || "",
    data.notes   || "",
    data.source  || "landing_page_consultation",
    new Date().toISOString(),
    "pending_contact",
  ]);

  return { success: true, consultId };
}
