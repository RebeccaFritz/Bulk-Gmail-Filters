// ─── Sheet constants ──────────────────────────────────────────────────────────

const SHEET_NAME        = 'Filters';
const SPREADSHEET_NAME  = 'Gmail Filter Manager';

const COL_EMAIL          = 1;
const COL_LABEL          = 2;
const COL_SKIP_INBOX     = 3;
const COL_MARK_IMPORTANT = 4;
const COL_LAST_SYNCED    = 5;
const HEADER_ROW         = ['Email', 'Label', 'Skip Inbox', 'Mark Important', 'Last Synced'];
const DATA_START_ROW     = 2; // row 1 is the header

// ─── Spreadsheet access ───────────────────────────────────────────────────────

/**
 * Returns the Gmail Filter Manager spreadsheet, creating it if it doesn't exist.
 * Caches the spreadsheet ID in PropertiesService so subsequent calls skip the
 * Drive search entirely.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getOrCreateSpreadsheet() {
  // 1. Fast path: ID already cached
  const cachedId = props.getProperty('spreadsheet:id');
  if (cachedId) {
    try {
      return SpreadsheetApp.openById(cachedId);
    } catch (e) {
      // File was deleted — clear cache and fall through
      props.deleteProperty('spreadsheet:id');
    }
  }

  // 2. Search Drive by name
  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    const ss = SpreadsheetApp.openById(files.next().getId());
    props.setProperty('spreadsheet:id', ss.getId());
    return ss;
  }

  // 3. Create fresh
  const ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  props.setProperty('spreadsheet:id', ss.getId());
  console.log(`Created spreadsheet: ${ss.getUrl()}`);
  return ss;
}

/**
 * Returns the Filters sheet, creating and formatting it if it doesn't exist.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet() {
  const ss    = getOrCreateSpreadsheet();
  let   sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    formatSheet(sheet);
  }

  return sheet;
}

/**
 * Applies header row, column widths, freeze, and checkbox columns to a fresh sheet.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function formatSheet(sheet) {
  // Header
  const headerRange = sheet.getRange(1, 1, 1, HEADER_ROW.length);
  headerRange.setValues([HEADER_ROW]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#f3f3f3');

  // Column widths
  sheet.setColumnWidth(COL_EMAIL,          280);
  sheet.setColumnWidth(COL_LABEL,          180);
  sheet.setColumnWidth(COL_SKIP_INBOX,     100);
  sheet.setColumnWidth(COL_MARK_IMPORTANT, 130);
  sheet.setColumnWidth(COL_LAST_SYNCED,    160);

  // Freeze header row
  sheet.setFrozenRows(1);
}

// ─── Sheet read / write ───────────────────────────────────────────────────────

/**
 * Reads all filter rows from the sheet and returns them as an array of objects.
 * Skips blank rows and the header.
 *
 * @returns {{ email: string, label: string, skipInbox: boolean, markImportant: boolean, lastSynced: string }[]}
 */
function readFiltersFromSheet() {
  const sheet     = getOrCreateSheet();
  const lastRow   = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return [];

  const numRows = lastRow - DATA_START_ROW + 1;
  const values  = sheet.getRange(DATA_START_ROW, 1, numRows, HEADER_ROW.length).getValues();

  return values
    .filter(row => row[COL_EMAIL - 1] && String(row[COL_EMAIL - 1]).includes('@'))
    .map(row => ({
      email:         String(row[COL_EMAIL          - 1]).trim(),
      label:         String(row[COL_LABEL          - 1]).trim(),
      skipInbox:     row[COL_SKIP_INBOX     - 1] === true,
      markImportant: row[COL_MARK_IMPORTANT - 1] === true,
      lastSynced:    String(row[COL_LAST_SYNCED    - 1] || '').trim(),
    }));
}

/**
 * Appends a new filter row to the sheet.
 * Does nothing if a row with the same email already exists.
 *
 * @param {string}  email
 * @param {string}  labelName
 * @param {boolean} skipInbox
 * @param {boolean} markImportant
 * @returns {boolean} True if a new row was written, false if it already existed.
 */
function writeFilterToSheet(email, labelName, skipInbox, markImportant) {
  if (filterExistsInSheet(email)) {
    console.log(`  Sheet: "${email}" already exists — skipping`);
    return false;
  }

  const sheet    = getOrCreateSheet();
  const newRow   = sheet.getLastRow() + 1;
  const checkbox = SpreadsheetApp.newDataValidation().requireCheckbox().build();

  sheet.getRange(newRow, COL_EMAIL).setValue(email);
  sheet.getRange(newRow, COL_LABEL).setValue(labelName);
  sheet.getRange(newRow, COL_SKIP_INBOX).setDataValidation(checkbox).setValue(skipInbox);
  sheet.getRange(newRow, COL_MARK_IMPORTANT).setDataValidation(checkbox).setValue(markImportant);
  sheet.getRange(newRow, COL_LAST_SYNCED).setValue(new Date().toLocaleString());

  console.log(`  Sheet: appended "${email}" → "${labelName}"`);
  return true;
}

/**
 * Updates the Last Synced timestamp for a given email row.
 *
 * @param {string} email
 */
function markSyncedInSheet(email) {
  const sheet   = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return;

  const emailCol = sheet.getRange(DATA_START_ROW, COL_EMAIL, lastRow - DATA_START_ROW + 1, 1).getValues();
  for (let i = 0; i < emailCol.length; i++) {
    if (String(emailCol[i][0]).trim() === email) {
      sheet.getRange(DATA_START_ROW + i, COL_LAST_SYNCED).setValue(new Date().toLocaleString());
      return;
    }
  }
}

/**
 * Returns true if a row with the given email address already exists in the sheet.
 *
 * @param {string} email
 * @returns {boolean}
 */
function filterExistsInSheet(email) {
  const sheet   = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return false;

  const emails = sheet
    .getRange(DATA_START_ROW, COL_EMAIL, lastRow - DATA_START_ROW + 1, 1)
    .getValues()
    .flat()
    .map(e => String(e).trim().toLowerCase());

  return emails.includes(email.toLowerCase());
}