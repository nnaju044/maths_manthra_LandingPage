/**
 * MathsManthra — Course Enrollment & Payment API
 * ═══════════════════════════════════════════════
 *
 * SETUP INSTRUCTIONS
 * ──────────────────
 * 1. Go to https://script.google.com → New Project → name it "MM Course API"
 * 2. Paste this entire file into Code.gs
 * 3. Fill in SPREADSHEET_ID and DRIVE_FOLDER_ID below
 * 4. Click Deploy → New Deployment
 *    - Type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Authorize → Copy the Web App URL
 * 6. Paste that URL into config.js → COURSE_APPS_SCRIPT_URL
 *
 * SPREADSHEET SETUP
 * ─────────────────
 * Create a Google Sheet named: MM_Leads_Payment
 * The script auto-creates two tabs: Leads + Payments
 * Spreadsheet ID is the string between /d/ and /edit in the URL
 *
 * DRIVE FOLDER SETUP
 * ──────────────────
 * Create a Google Drive folder named: MM_Leads_Payment_Screenshots
 * Folder ID is the last segment of the folder URL
 */

// ── Edit These ──────────────────────────────────────────────────────────────
const COURSE_CONFIG = {
  SPREADSHEET_ID:  "1N3EHqhMqTJif0J31bfzNCdm9oWc9GLg5cOqd6SGe5eM",
  DRIVE_FOLDER_ID: "1rss4PqC3u8AFIAlB9laWS8msSXYpqu0c",
  WHATSAPP_NUMBER: "917560908799",
};

// ── Sheet names (do not change) ──────────────────────────────────────────────
const SHEET_LEADS    = "Leads";
const SHEET_PAYMENTS = "Payments";

// ── Entry Point ──────────────────────────────────────────────────────────────
function doPost(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);

  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;

    let result;
    if      (action === "createLead")       result = createLead(body);
    else if (action === "savePaymentProof") result = savePaymentProof(body);
    else                                    result = { success: false, error: "Unknown action: " + action };

    out.setContent(JSON.stringify(result));
  } catch (err) {
    out.setContent(JSON.stringify({ success: false, error: err.message }));
  }

  return out;
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", api: "MathsManthra Course API v1" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Quick Test & Permission Authorization ────────────────────────────────────
// Run this function once in the Apps Script editor to authorize Drive & Sheets permissions!
function testSetup() {
  try {
    const ss = SpreadsheetApp.openById(COURSE_CONFIG.SPREADSHEET_ID);
    Logger.log("✅ Spreadsheet opened successfully: " + ss.getName());
    const folder = DriveApp.getFolderById(COURSE_CONFIG.DRIVE_FOLDER_ID);
    Logger.log("✅ Drive Folder opened successfully: " + folder.getName());
    return "All permissions authorized successfully!";
  } catch (err) {
    Logger.log("❌ Error during testSetup: " + err.message);
    throw err;
  }
}

// ── Leads ────────────────────────────────────────────────────────────────────
function createLead(data) {
  const ss    = SpreadsheetApp.openById(COURSE_CONFIG.SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_LEADS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_LEADS);
    sheet.appendRow([
      "Lead ID", "Name", "Phone", "Email",
      "Course", "Price (₹)", "Source",
      "Created Date", "Payment Status"
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#003371").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(8, 180);
  }

  // Generate sequential Lead ID
  const lastRow = sheet.getLastRow();
  const seq     = lastRow; // row 1 = header, so seq = count of leads already
  const leadId  = "MM" + String(seq).padStart(4, "0");

  sheet.appendRow([
    leadId,
    data.name     || "",
    data.phone    || "",
    data.email    || "",
    data.course   || "",
    data.price    || "",
    data.source   || "landing_page",
    new Date().toISOString(),
    "payment_pending",
  ]);

  return { success: true, leadId };
}

// ── Payment Proof ─────────────────────────────────────────────────────────────
function savePaymentProof(data) {
  // 1. Upload screenshot to Drive
  const folder  = DriveApp.getFolderById(COURSE_CONFIG.DRIVE_FOLDER_ID);
  const bytes   = Utilities.base64Decode(data.fileData);
  const blob    = Utilities.newBlob(bytes, data.fileType, data.fileName);
  const file    = folder.createFile(blob);
  file.setName(data.leadId + "_" + data.fileName);
  const fileUrl = file.getUrl();
  const fileId  = file.getId();

  // 2. Append to Payments sheet
  const ss    = SpreadsheetApp.openById(COURSE_CONFIG.SPREADSHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_PAYMENTS);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PAYMENTS);
    sheet.appendRow([
      "Lead ID", "Name", "Phone", "Amount (₹)",
      "Screenshot URL", "Drive File ID",
      "Payment Status", "Verification Notes", "Submitted At"
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#1a4731").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    data.leadId || "",
    data.name   || "",
    data.phone  || "",
    data.amount || "",
    fileUrl,
    fileId,
    "verification_pending",
    "",
    new Date().toISOString(),
  ]);

  // 3. Update lead status in Leads sheet
  _updateLeadStatus(data.leadId, "verification_pending");

  return { success: true, fileUrl, fileId };
}

// ── Internal: update payment_status column in Leads ───────────────────────────
function _updateLeadStatus(leadId, newStatus) {
  try {
    const ss    = SpreadsheetApp.openById(COURSE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_LEADS);
    if (!sheet) return;

    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === leadId) {
        sheet.getRange(i + 1, 9).setValue(newStatus); // Column I = Payment Status
        break;
      }
    }
  } catch (err) {
    console.error("_updateLeadStatus error:", err.message);
  }
}
