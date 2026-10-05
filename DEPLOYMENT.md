# MathsManthra — Deployment Guide

## Folder Structure

```
landing_html/
├── index.html          ← Landing page (do not touch for config)
├── config.js           ← ✏️  All your settings live here
├── enrollment.js       ← Frontend logic (auto-loaded)
├── course_api.gs       ← Paste into Course Apps Script project
├── consult_api.gs      ← Paste into Consultation Apps Script project
└── public/
    └── image/
        └── apple-touch-icon.png
```

---

## System 1: Course Enrollment & Payment

### Step 1 — Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) → **New Spreadsheet**
2. Name it: `MM_Leads_Payment`
3. Copy the Spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**SPREADSHEET_ID**/edit`
4. Paste it into `course_api.gs` → `COURSE_CONFIG.SPREADSHEET_ID`

### Step 2 — Create the Drive Folder

1. Go to [Google Drive](https://drive.google.com) → **New Folder**
2. Name it: `MM_Leads_Payment_Screenshots`
3. Copy the Folder ID from the URL when you open the folder:
   `https://drive.google.com/drive/folders/**FOLDER_ID**`
4. Paste it into `course_api.gs` → `COURSE_CONFIG.DRIVE_FOLDER_ID`
   *(Already pre-filled: `1rss4PqC3u8AFIAlB9laWS8msSXYpqu0c` — verify this is yours)*

### Step 3 — Deploy the Course API

1. Go to [script.google.com](https://script.google.com) → **New Project**
2. Name it: `MM Course API`
3. Delete any existing code in `Code.gs`
4. Copy the entire contents of `course_api.gs` and paste it into `Code.gs`
5. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Authorize access** → Choose your Google account → Allow
7. Copy the **Web App URL**
8. Paste into `config.js` → `COURSE_APPS_SCRIPT_URL`

### Sheets Created Automatically

| Sheet | Columns |
|-------|---------|
| **Leads** | Lead ID, Name, Phone, Email, Course, Price, Source, Created Date, Payment Status |
| **Payments** | Lead ID, Name, Phone, Amount, Screenshot URL, Drive File ID, Payment Status, Notes, Submitted At |

### Payment Status Values

| Status | Meaning |
|--------|---------|
| `payment_pending` | Lead saved, awaiting payment |
| `verification_pending` | Screenshot uploaded |
| `verified` | Payment confirmed (update manually) |
| `rejected` | Payment rejected (update manually) |

---

## System 2: Free Consultation

### Step 1 — Google Sheet

Your consultation spreadsheet ID is already pre-filled:
```
1gJfoSAvo6gM9KaZrIgHgOZmcLGbuL0U7f18w3o-WXy8
```
Open it and verify you have access.

### Step 2 — Deploy the Consultation API

1. Go to [script.google.com](https://script.google.com) → **New Project**
2. Name it: `MM Consultation API`
3. Delete any existing code in `Code.gs`
4. Copy the entire contents of `consult_api.gs` and paste it into `Code.gs`
5. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Authorize access** → Choose your Google account → Allow
7. Copy the **Web App URL**
8. Paste into `config.js` → `CONSULTATION_APPS_SCRIPT_URL`

### Sheet Created Automatically

| Sheet: Consultations | Columns |
|---------------------|---------|
| Consultation ID, Name, Phone, Email, Interested Course, Role / Profile, Notes, Source, Created Date, Status |

---

## config.js — Final State After Setup

```js
const MM_CONFIG = {
  COURSE_APPS_SCRIPT_URL:        "https://script.google.com/macros/s/YOUR_COURSE_DEPLOYMENT_ID/exec",
  CONSULTATION_APPS_SCRIPT_URL:  "https://script.google.com/macros/s/YOUR_CONSULT_DEPLOYMENT_ID/exec",
  UPI_ID:                        "nnaju044-2@oksbi",
  BUSINESS_NAME:                 "MathsManthra Academy",
  WHATSAPP_NUMBER:               "917560908799",
  COURSES: [
    { id: "ai_digital_5day", label: "AI & Digital Marketing for Teachers (5-Day)", price: 999 },
  ],
};
```

---

## Testing Checklist

### Before Going Live

- [ ] Both Apps Script Web Apps deployed
- [ ] Both URLs pasted into `config.js`
- [ ] `config.js` and `enrollment.js` loaded in `index.html` (before `</body>`)
- [ ] Drive folder ID correct in `course_api.gs`
- [ ] Consultation Spreadsheet ID correct in `consult_api.gs`
- [ ] UPI ID tested by scanning QR manually

### Functional Tests

**System 1 — Enrollment:**
- [ ] Click "Enroll Now" → Enrollment modal opens
- [ ] Submit with empty fields → validation errors appear
- [ ] Submit valid form → Payment sheet opens with correct Lead ID + Amount + Course
- [ ] On **mobile**: UPI app buttons (GPay, PhonePe, Paytm) are visible
- [ ] On **desktop**: UPI app buttons hidden, amber "scan QR" hint appears
- [ ] Click "I've Paid" → Upload screen opens
- [ ] Upload screenshot → Success screen shows Lead ID
- [ ] Check Google Sheet: new row in **Leads** + **Payments** tabs
- [ ] Check Drive folder: screenshot uploaded with `MMxxxx_filename.jpg` naming

**System 2 — Consultation:**
- [ ] Click "Book Free Consultation" → Consultation modal opens
- [ ] Submit with empty required fields → validation errors
- [ ] Submit valid form → Success screen shows Consultation ID (FC0001…)
- [ ] Check Google Sheet: new row in **Consultations** tab

### After Updates to Apps Script

> ⚠️ **Important:** Every time you change and save `course_api.gs` or `consult_api.gs`, you MUST create a **New Version** in the deployment:
> **Deploy → Manage Deployments → Edit (pencil icon) → Version: New version → Deploy**
> The Web App URL stays the same.
