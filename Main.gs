/**
 * Creates Gmail filters for all senders defined in Config.gs.
 * Safe to run multiple times — existing filters with matching criteria
 * are skipped, and outdated ones are replaced.
 */
function createBulkFilters() {

  createCriteriaArray();

  for (const [from, labelName, skipInbox, markImportant] of filterCriteria) {
    const labelId = getOrCreateLabel(labelName);

    if (processExistingFilters(from, labelId, skipInbox, markImportant)) {
      console.log(`⏭️ Skipping ${from} — filter already exists with same criteria`);
      continue; // skip to the next row
    }

    const action = {
      addLabelIds: [labelId]
    };

    if (skipInbox)     action.removeLabelIds = ["INBOX"];
    if (markImportant) action.addLabelIds.push("IMPORTANT");

    try {
      Gmail.Users.Settings.Filters.create(
        { criteria: { from }, action },
        userId
      );
      console.log(`✅ ${from} → "${labelName}"`);
    } catch (e) {
      console.error(`❌ ${from}: ${e.message}`);
    }

  } 
}   

/**
 * Applies labels and archives existing threads that arrived before
 * the filters were created. Run once after createBulkFilters() to
 * backfill your inbox.
 */
function applyLabelsToExistingEmails() {
  const rules = createRulesArray();

  for (const [query, labelName, skipInbox, markImportant] of rules) {
    const label = GmailApp.getUserLabelByName(labelName);
    if (!label) {
      console.error(`❌ Label "${labelName}" not found — run createBulkFilters first`);
      continue;
    }

    const threads = GmailApp.search(query);
    if (threads.length === 0) {
      console.log(`  No emails found for: ${query}`);
      continue;
    }

    label.addToThreads(threads);            // apply the label
    if (skipInbox) GmailApp.moveThreadsToArchive(threads); // skip the inbox

    console.log(`✅ Applied "${labelName}" to ${threads.length} threads for ${query}`);
  }
}

/**
 * Runs createBulkFilters() and applyLabelsToExistingEmails() in
 * succession. Use this as the single entry point to fully sync
 * your filters and inbox in one step.
 */
function syncFilters() {
  createBulkFilters();
  applyLabelsToExistingEmails();
}