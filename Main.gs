// ─── Web App entry point ──────────────────────────────────────────────────────

/**
 * Serves the web app UI. Visit the deployment URL in any browser to open it.
 * Deploy via: Apps Script editor → Deploy → New deployment → Web app.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Gmail Filter Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

// ─── UI handler (called by the page via google.script.run) ───────────────────

/**
 * Parses textarea input, creates Gmail labels and filters, writes rows to the
 * sheet, and returns a result array for the page to display.
 *
 * Each non-blank, non-comment line:
 *   email@example.com, Label Name                          → skipInbox=false, markImportant=false
 *   email@example.com, Label Name, skipInbox, markImportant
 *
 * @param {string} rawInput
 * @returns {{ email: string, label: string, status: string, message: string }[]}
 */
function addFiltersFromUI(rawInput) {
  const lines = rawInput
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('//'));

  const results = [];

  for (const line of lines) {
    const parts         = line.split(',').map(p => p.trim());
    const email         = parts[0];
    const labelName     = parts[1] || '';
    const skipInbox     = parseBool(parts[2], false);
    const markImportant = parseBool(parts[3], false);

    if (!email || !email.includes('@')) {
      results.push({ email: line, label: '', status: 'error', message: 'Invalid email address' });
      continue;
    }
    if (!labelName) {
      results.push({ email, label: '', status: 'error', message: 'Label name is required' });
      continue;
    }

    try {
      const { status, message } = applyFilter(email, labelName, skipInbox, markImportant, true);
      results.push({ email, label: labelName, status, message });
    } catch (e) {
      results.push({ email, label: labelName, status: 'error', message: e.message });
    }
  }

  return results;
}

/**
 * Returns all filter rows from the sheet for display in the UI.
 * @returns {{ email: string, label: string, skipInbox: boolean, markImportant: boolean, lastSynced: string }[]}
 */
function getFiltersForUI() {
  return readFiltersFromSheet();
}

// ─── Core filter logic ────────────────────────────────────────────────────────

/**
 * Creates a Gmail label and filter for one email address and writes the entry
 * to the sheet. Safe to call repeatedly — skips if an exact match already exists.
 *
 * @param {string}  email
 * @param {string}  labelName
 * @param {boolean} skipInbox
 * @param {boolean} markImportant
 * @param {boolean} [backfill=false] - If true, applies label to existing threads.
 * @returns {{ status: 'created'|'skipped'|'error', message: string }}
 */
function applyFilter(email, labelName, skipInbox, markImportant, backfill = false) {
  const labelId = getOrCreateLabel(labelName);

  if (processExistingFilters(email, labelId, skipInbox, markImportant)) {
    writeFilterToSheet(email, labelName, skipInbox, markImportant);
    return { status: 'skipped', message: 'Filter already exists' };
  }

  const action = { addLabelIds: [labelId] };
  if (skipInbox)      action.removeLabelIds = ['INBOX'];
  if (markImportant)  action.addLabelIds.push('IMPORTANT');
  Gmail.Users.Settings.Filters.create({ criteria: { from: email }, action }, userId);
  cacheFilter(email, labelId, skipInbox, markImportant);

  let backfilledCount = 0;
  if (backfill) {
    const gmailLabel = GmailApp.getUserLabelByName(labelName);
    const threads    = gmailLabel ? GmailApp.search('from:' + email) : [];
    if (threads.length > 0) {
      gmailLabel.addToThreads(threads);
      if (skipInbox) GmailApp.moveThreadsToArchive(threads);
    }
    backfilledCount = threads.length;
  }

  writeFilterToSheet(email, labelName, skipInbox, markImportant);
  return {
    status: 'created',
    message: backfill ? `Backfilled ${backfilledCount} thread(s)` : 'Filter created'
  };
}

// ─── Sync (sheet → Gmail) ─────────────────────────────────────────────────────

/**
 * Reads every row from the sheet and ensures a matching Gmail label and filter
 * exists for each one. Safe to run repeatedly.
 * Can be run directly from the Apps Script editor.
 */
function syncFilters() {
  const rows = readFiltersFromSheet();

  if (rows.length === 0) {
    console.log('No filter rows found in sheet. Add entries via the web app and run again.');
    return;
  }

  for (const { email, label, skipInbox, markImportant } of rows) {
    try {
      const { status, message } = applyFilter(email, label, skipInbox, markImportant);
      const icon = status === 'created' ? '✅' : '⏭️';
      console.log(`${icon} ${email} → "${label}" — ${message}`);
      markSyncedInSheet(email);
    } catch (e) {
      console.error(`❌ ${email}: ${e.message}`);
    }
  }
}