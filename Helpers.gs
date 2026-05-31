let filterCriteria = [];

function createCriteriaArray() {

  for (const [emails, label, skipInbox, markImportant] of emailTypes) {
    let cur = createCriteriaForType(emails, label, skipInbox, markImportant);
    filterCriteria = filterCriteria.concat(cur);
  }

  return;
}


function createCriteriaForType(emails, label, skipInbox, markImportant) {
  let result = [];
  for (const email of emails) {
    let cur = [email, label, skipInbox, markImportant];
    result.push(cur);
  }
  return result;
}

function createRulesArray() {
  let rules = [];
  for (const [emails, label, skipInbox, markImportant] of emailTypes) {
    let queries = emails.map(convertEmailToQuery);
    let cur = createRulesForType(emails, label, skipInbox, markImportant);
    rules = rules.concat(cur);
  }
  return rules;
}

function convertEmailToQuery(email) {
  // convert 'info@company.com' to 'from:info@company.com', 
  return 'from:' + email; 
}

function createRulesForType(emails, label, skipInbox, markImportant) {
  let result = []
  for (const email of emails) {
    result.push([email, label, skipInbox, markImportant]);
  }
  return result;
}

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
