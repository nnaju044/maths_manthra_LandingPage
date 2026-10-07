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

  // Use leadId provided by frontend, or fallback to sequential Lead ID
  const lastRow = sheet.getLastRow();
  const seq     = lastRow; // row 1 = header, so seq = count of leads already
  const leadId  = (data && data.leadId && String(data.leadId).trim())
                  ? String(data.leadId).trim()
                  : ("MM" + String(seq).padStart(4, "0"));

  Logger.log("Creating Lead: Lead ID=" + leadId + ", Name=" + data.name + ", Course=" + data.course);

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
  Logger.log("Step 1 [GAS]: Starting savePaymentProof for Lead ID: " + data.leadId);

  // 1. Extract and sanitize base64 string
  let rawBase64 = data.imageBase64 || data.fileData || "";
  if (typeof rawBase64 === "string" && rawBase64.indexOf(",") > -1) {
    rawBase64 = rawBase64.split(",")[1];
  }
  rawBase64 = String(rawBase64).replace(/\s/g, "");

  if (!rawBase64) {
    throw new Error("No image base64 data received in savePaymentProof.");
  }
  Logger.log("Step 2 [GAS]: imageBase64 received successfully. Length: " + rawBase64.length + " chars");

  // 2. Decode base64 bytes & create blob
  const fileType      = data.fileType || "image/jpeg";
  const rawFileName   = data.fileName || "screenshot.jpg";
  const cleanFileName = (data.leadId || "MM") + "_" + rawFileName;

  const bytes = Utilities.base64Decode(rawBase64);
  const blob  = Utilities.newBlob(bytes, fileType, cleanFileName);
  Logger.log("Step 3 [GAS]: Blob created. MIME: " + fileType + ", Size: " + bytes.length + " bytes");

  // 3. Locate or create destination Drive folder
  let folder;
  try {
    if (COURSE_CONFIG.DRIVE_FOLDER_ID && !COURSE_CONFIG.DRIVE_FOLDER_ID.includes("YOUR_")) {
      folder = DriveApp.getFolderById(COURSE_CONFIG.DRIVE_FOLDER_ID);
    }
  } catch (folderErr) {
    Logger.log("⚠️ Could not open folder by ID (" + COURSE_CONFIG.DRIVE_FOLDER_ID + "): " + folderErr.message);
  }

  // Graceful fallback: locate or create folder by name in user's Drive
  if (!folder) {
    const folderName = "MM_Leads_Payment_Screenshots";
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    Logger.log("Step 4 [GAS]: Using folder: " + folder.getName() + " (ID: " + folder.getId() + ")");
  } else {
    Logger.log("Step 4 [GAS]: Using configured Drive folder: " + folder.getName() + " (ID: " + folder.getId() + ")");
  }

  // 4. Upload file to Drive & set view permissions
  const file = folder.createFile(blob);
  file.setName(cleanFileName);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (permErr) {
    Logger.log("⚠️ Warning setting file sharing permission: " + permErr.message);
  }

  const fileUrl = file.getUrl();
  const fileId  = file.getId();
  Logger.log("Step 5 [GAS]: Screenshot uploaded to Drive! File ID: " + fileId + ", URL: " + fileUrl);

  // 5. Append to Payments sheet
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
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(5, 250);
  }

  sheet.appendRow([
    data.leadId || "",
    data.name   || "",
    data.phone  || "",
    data.amount || "",
    fileUrl     || "",
    fileId      || "",
    "verification_pending",
    "",
    new Date().toISOString(),
  ]);
  Logger.log("Step 6 [GAS]: Row successfully appended to Payments sheet with Screenshot URL.");

  // 6. Update lead status and screenshot URL in Leads sheet if present
  _updateLeadStatus(data.leadId, "verification_pending", fileUrl);

  return { success: true, leadId: data.leadId, fileUrl: fileUrl, fileId: fileId };
}

// ── Internal: update payment_status and screenshot URL column in Leads ─────────
function _updateLeadStatus(leadId, newStatus, fileUrl) {
  try {
    const ss    = SpreadsheetApp.openById(COURSE_CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_LEADS);
    if (!sheet) return;

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return;
    const headers = values[0];

    const statusColIndex     = headers.indexOf("Payment Status") + 1;
    const screenshotColIndex = headers.findIndex(h => String(h).toLowerCase().includes("screenshot")) + 1;

    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === String(leadId).trim()) {
        if (statusColIndex > 0) {
          sheet.getRange(i + 1, statusColIndex).setValue(newStatus);
        }
        if (screenshotColIndex > 0 && fileUrl) {
          sheet.getRange(i + 1, screenshotColIndex).setValue(fileUrl);
        }
        break;
      }
    }
  } catch (err) {
    Logger.log("⚠️ _updateLeadStatus warning: " + err.message);
  }
}
