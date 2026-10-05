/**
 * MathsManthra — Google Apps Script Backend
 * ─────────────────────────────────────────
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com → New Project
 * 2. Paste this entire file into Code.gs
 * 3. Edit the CONFIG block below with your real values
 * 4. Click Deploy → New Deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Authorize the script and copy the Web App URL
 * 6. Paste that URL into config.js → APPS_SCRIPT_URL
 */

// ─── Configuration (edit these) ───────────────────────────────────────────────
const CONFIG = {
  SPREADSHEET_ID:   "YOUR_SPREADSHEET_ID",   // From the Sheet URL
  DRIVE_FOLDER_ID:  "YOUR_DRIVE_FOLDER_ID",  // From Drive folder URL
  WHATSAPP_NUMBER:  "919876543210",
};

// ─── Sheet names ──────────────────────────────────────────────────────────────
const SHEET_LEADS    = "Leads";
const SHEET_PAYMENTS = "Payments";

// ─── CORS & entry point ───────────────────────────────────────────────────────
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;

    let result;
    if (action === "createLead") {
      result = createLead(body);
    } else if (action === "savePaymentProof") {
      result = savePaymentProof(body);
    } else {
      result = { success: false, error: "Unknown action: " + action };
    }

    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ success: false, error: err.message }));
  }

  return output;
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", service: "MathsManthra API" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Lead ID generator ────────────────────────────────────────────────────────
function generateLeadId(sheet) {
  const rows    = sheet.getLastRow();
  const num     = rows; // row 1 = header, so rows after = count of leads
  const padded  = String(num).padStart(4, "0");
  return "MM" + padded;
}

// ─── PHASE 1: Create Lead ─────────────────────────────────────────────────────
function createLead(data) {
  const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(SHEET_LEADS);

  // Auto-create sheet + header if missing
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_LEADS);
    sheet.appendRow([
      "Lead ID", "Name", "Phone", "Email",
      "Course", "Source", "Campaign",
      "Created Date", "Payment Status"
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  const leadId  = generateLeadId(sheet);
  const now     = new Date();

  sheet.appendRow([
    leadId,
    data.name        || "",
    data.phone       || "",
    data.email       || "",
    data.course      || "",
    data.source      || "landing_page",
    data.campaign    || "",
    now.toISOString(),
    "payment_pending"
  ]);

  return { success: true, leadId };
}

// ─── PHASE 4: Save Payment Proof ──────────────────────────────────────────────
function savePaymentProof(data) {
  // 1. Decode base64 and upload to Drive
  const folder   = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const bytes    = Utilities.base64Decode(data.fileData);
  const blob     = Utilities.newBlob(bytes, data.fileType, data.fileName);
  const file     = folder.createFile(blob);
  file.setName(data.leadId + "_" + data.fileName);

  const fileUrl  = file.getUrl();
  const fileId   = file.getId();

  // 2. Save to Payments sheet
  const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet   = ss.getSheetByName(SHEET_PAYMENTS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PAYMENTS);
    sheet.appendRow([
      "Lead ID", "Name", "Phone", "Amount",
      "Screenshot URL", "Drive File ID",
      "Payment Status", "Verification Notes", "Created Date"
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    data.leadId      || "",
    data.name        || "",
    data.phone       || "",
    data.amount      || "",
    fileUrl,
    fileId,
    "verification_pending",
    "",
    new Date().toISOString()
  ]);

  // 3. Update lead status in Leads sheet
  updateLeadStatus(data.leadId, "verification_pending");

  return { success: true, fileUrl, fileId };
}

// ─── Helper: update lead status in Leads sheet ────────────────────────────────
function updateLeadStatus(leadId, newStatus) {
  try {
    const ss     = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet  = ss.getSheetByName(SHEET_LEADS);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === leadId) {
        sheet.getRange(i + 1, 9).setValue(newStatus); // Column I = Payment Status
        break;
      }
    }
  } catch (err) {
    console.error("updateLeadStatus error:", err.message);
  }
}
