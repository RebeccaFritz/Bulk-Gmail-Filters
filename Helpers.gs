let filterCriteria = [];

/**
 * Iterates over all email types defined in emailTypes (Config.gs) and
 * populates the global filterCriteria array with one row per sender.
 * Called by createBulkFilters() before the filter creation loop.
 */
function createCriteriaArray() {

  for (const [emails, label, skipInbox, markImportant] of emailTypes) {
    let cur = createCriteriaForType(emails, label, skipInbox, markImportant);
    filterCriteria = filterCriteria.concat(cur);
  }

  return;
}

/**
 * Converts a list of email addresses into an array of filter criteria rows,
 * each formatted as [email, label, skipInbox, markImportant].
 *
 * @param {string[]} emails - List of sender email addresses.
 * @param {string} label - The label name to apply.
 * @param {boolean} skipInbox - Whether to archive the email.
 * @param {boolean} markImportant - Whether to mark the email as important.
 * @returns {Array[]} Array of filter criteria rows.
 */
function createCriteriaForType(emails, label, skipInbox, markImportant) {
  let result = [];
  for (const email of emails) {
    let cur = [email, label, skipInbox, markImportant];
    result.push(cur);
  }
  return result;
}

/**
 * Builds and returns a flat array of rules used by applyLabelsToExistingEmails().
 * Each rule is formatted as [query, label, skipInbox, markImportant], where
 * query is a Gmail search string (e.g. 'from:someone@example.com').
 *
 * @returns {Array[]} Flat array of rule rows, one per sender.
 */
function createRulesArray() {
  let rules = [];
  for (const [emails, label, skipInbox, markImportant] of emailTypes) {
    let queries = emails.map(convertEmailToQuery);
    let cur = createRulesForType(emails, label, skipInbox, markImportant);
    rules = rules.concat(cur);
  }
  return rules;
}

/**
 * Converts a plain email address into a Gmail search query string.
 * Example: 'info@company.com' → 'from:info@company.com'
 *
 * @param {string} email - The sender email address to convert.
 * @returns {string} A Gmail search query string.
 */
function convertEmailToQuery(email) {
  return 'from:' + email; 
}

/**
 * Converts a list of Gmail search queries into an array of rule rows,
 * each formatted as [query, label, skipInbox, markImportant].
 *
 * @param {string[]} emails - List of Gmail search query strings.
 * @param {string} label - The label name to apply.
 * @param {boolean} skipInbox - Whether to archive the email.
 * @param {boolean} markImportant - Whether to mark the email as important.
 * @returns {Array[]} Array of rule rows.
 */
function createRulesForType(emails, label, skipInbox, markImportant) {
  let result = []
  for (const email of emails) {
    result.push([email, label, skipInbox, markImportant]);
  }
  return result;
}

/**
 * Returns the ID of a Gmail label by name, creating it if it doesn't exist.
 *
 * @param {string} labelName - The display name of the label.
 * @returns {string} The Gmail label ID.
 */
function getOrCreateLabel(labelName) {
  const response = Gmail.Users.Labels.list(userId);
  const existingLabels = (response && response.labels) ? response.labels : [];

  const found = existingLabels.find(l => l.name === labelName);
  if (found) {
    console.log(`  Label "${labelName}" already exists (ID: ${found.id})`);
    return found.id;
  }

  const newLabel = Gmail.Users.Labels.create(
    { name: labelName, labelListVisibility: "labelShow", messageListVisibility: "show" },
    userId
  );
  console.log(`  Created new label "${labelName}" (ID: ${newLabel.id})`);
  return newLabel.id;
}

/**
 * Checks all existing Gmail filters for the given sender address.
 * Keeps the first filter that exactly matches the desired criteria,
 * and deletes all others. Returns true if an exact match was found
 * so the caller can skip creating a duplicate.
 *
 * @param {string} from - The sender email address to check.
 * @param {string} labelId - The Gmail label ID the filter should apply.
 * @param {boolean} skipInbox - Whether the filter should archive the email.
 * @param {boolean} markImportant - Whether the filter should mark as important.
 * @returns {boolean} True if an exact matching filter already exists.
 */
function processExistingFilters(from, labelId, skipInbox, markImportant) {
  const response = Gmail.Users.Settings.Filters.list(userId);
  const existingFilters = (response && response.filter) ? response.filter : [];

  const matches = existingFilters.filter(f => f.criteria && f.criteria.from === from);

  if (matches.length === 0) {
    console.log(`  No existing filters found for ${from}`);
    return;
  }

  // loop through every match
  let foundExactMatch = false;
  for (const match of matches) {
    if (!foundExactMatch && isDesiredFilter(match, labelId, skipInbox, markImportant)) { 
      // keep the first exact match 
      foundExactMatch = true;
    } else {
      // delete all other matches (exact or partial)
      Gmail.Users.Settings.Filters.remove(userId, match.id);
      console.log(`  🗑️ Deleted existing filter for ${from} (ID: ${match.id})`);
    }
  }

  return foundExactMatch;
}

/**
 * Checks whether a single existing filter exactly matches the desired criteria.
 * Returns true only if the label, skipInbox, and markImportant settings all match.
 *
 * @param {Object} match - An existing Gmail filter object from the API.
 * @param {string} labelId - The Gmail label ID the filter should apply.
 * @param {boolean} skipInbox - Whether the filter should archive the email.
 * @param {boolean} markImportant - Whether the filter should mark as important.
 * @returns {boolean} True if the filter matches all desired criteria.
 */
function isDesiredFilter(match, labelId, skipInbox, markImportant) {

  const addIds    = match.action.addLabelIds    || [];
  const removeIds = match.action.removeLabelIds || [];

  const hasLabel       = addIds.includes(labelId);
  const hasImportant   = addIds.includes("IMPORTANT");
  const hasSkipInbox   = removeIds.includes("INBOX");

  return (
    hasLabel                     === true          &&
    hasImportant                 === markImportant &&
    hasSkipInbox                 === skipInbox
  );
}
