const userId = "me";

function createBulkFilters() {

  const filterFromEmail = [
    // [from, labelName, skipInbox, markImportant]
    ['updates@newsletter.com',   'Newsletters',          true,  false],
    ['noreply@social.com',       'Social',               true,  false],
    ['alerts@work.com',          'Work/Alerts',          true,  true ],
    ['invoices@billing.com',     'Finance',              false, true ],
  ];

  for (const [from, labelName, skipInbox, markImportant] of filterFromEmail) {
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
