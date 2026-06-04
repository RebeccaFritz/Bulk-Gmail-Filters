// ─── PropertiesService Cache ──────────────────────────────────────────────────

const props = PropertiesService.getScriptProperties();

/**
 * Returns the cached label ID for a given label name, or null if not cached.
 * @param {string} labelName
 * @returns {string|null}
 */
function getCachedLabelId(labelName) {
  return props.getProperty(`label:${labelName}`) || null;
}

/**
 * Stores a label name → ID mapping in the cache.
 * @param {string} labelName
 * @param {string} labelId
 */
function cacheLabelId(labelName, labelId) {
  props.setProperty(`label:${labelName}`, labelId);
}

/**
 * Returns the cached filter data for a given sender, or null if not cached.
 * @param {string} from
 * @returns {{ labelId: string, skipInbox: boolean, markImportant: boolean }|null}
 */
function getCachedFilter(from) {
  const raw = props.getProperty(`filter:${from}`);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Stores filter criteria for a sender in the cache.
 * @param {string} from
 * @param {string} labelId
 * @param {boolean} skipInbox
 * @param {boolean} markImportant
 */
function cacheFilter(from, labelId, skipInbox, markImportant) {
  props.setProperty(`filter:${from}`, JSON.stringify({ labelId, skipInbox, markImportant }));
}

/**
 * Removes a filter entry from the cache (used when criteria change).
 * @param {string} from
 */
function evictFilterCache(from) {
  props.deleteProperty(`filter:${from}`);
}

// ─── Gmail Label Helpers ──────────────────────────────────────────────────────

const userId = 'me';

/**
 * Returns the ID of a Gmail label by name, creating it if it doesn't exist.
 * Checks PropertiesService cache before querying Gmail.
 *
 * @param {string} labelName
 * @returns {string} Gmail label ID
 */
function getOrCreateLabel(labelName) {
  const cached = getCachedLabelId(labelName);
  if (cached) {
    console.log(`  Label "${labelName}" found in cache (ID: ${cached})`);
    return cached;
  }

  const response      = Gmail.Users.Labels.list(userId);
  const existingLabels = (response && response.labels) ? response.labels : [];
  const found         = existingLabels.find(l => l.name === labelName);

  if (found) {
    console.log(`  Label "${labelName}" already exists (ID: ${found.id})`);
    cacheLabelId(labelName, found.id);
    return found.id;
  }

  const newLabel = Gmail.Users.Labels.create(
    { name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
    userId
  );
  console.log(`  Created label "${labelName}" (ID: ${newLabel.id})`);
  cacheLabelId(labelName, newLabel.id);
  return newLabel.id;
}

// ─── Gmail Filter Helpers ─────────────────────────────────────────────────────

/**
 * Checks existing Gmail filters for a sender. Cache-first.
 * Keeps the first exact match; deletes all others.
 * Returns true if an exact match was found (caller should skip creating a duplicate).
 *
 * @param {string}  from
 * @param {string}  labelId
 * @param {boolean} skipInbox
 * @param {boolean} markImportant
 * @returns {boolean}
 */
function processExistingFilters(from, labelId, skipInbox, markImportant) {
  // 1. Cache fast-path
  const cached = getCachedFilter(from);
  if (cached) {
    const exactMatch =
      cached.labelId       === labelId       &&
      cached.skipInbox     === skipInbox     &&
      cached.markImportant === markImportant;

    if (exactMatch) {
      console.log(`  Cache hit: filter for ${from} already matches`);
      return true;
    }
    console.log(`  Cache mismatch for ${from} — querying Gmail`);
    evictFilterCache(from);
  }

  // 2. Query Gmail
  const response      = Gmail.Users.Settings.Filters.list(userId);
  const existingFilters = (response && response.filter) ? response.filter : [];
  const matches       = existingFilters.filter(f => f.criteria && f.criteria.from === from);

  if (matches.length === 0) {
    console.log(`  No existing filters for ${from}`);
    return false;
  }

  let foundExactMatch = false;
  for (const match of matches) {
    if (!foundExactMatch && isDesiredFilter(match, labelId, skipInbox, markImportant)) {
      foundExactMatch = true;
      cacheFilter(from, labelId, skipInbox, markImportant);
    } else {
      Gmail.Users.Settings.Filters.remove(userId, match.id);
      console.log(`  🗑️ Deleted stale filter for ${from} (ID: ${match.id})`);
    }
  }

  return foundExactMatch;
}

/**
 * Returns true if an existing Gmail filter object matches all desired criteria.
 *
 * @param {Object}  match
 * @param {string}  labelId
 * @param {boolean} skipInbox
 * @param {boolean} markImportant
 * @returns {boolean}
 */
function isDesiredFilter(match, labelId, skipInbox, markImportant) {
  const addIds    = match.action.addLabelIds    || [];
  const removeIds = match.action.removeLabelIds || [];

  return (
    addIds.includes(labelId)        === true          &&
    addIds.includes('IMPORTANT')    === markImportant &&
    removeIds.includes('INBOX')     === skipInbox
  );
}

// ─── Shared Utilities ─────────────────────────────────────────────────────────

/**
 * Parses a string as a boolean. 'true' (case-insensitive) → true, else defaultValue.
 * @param {string|boolean|undefined} val
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function parseBool(val, defaultValue) {
  if (val === undefined || val === null || val === '') return defaultValue;
  if (typeof val === 'boolean') return val;
  return String(val).toLowerCase() === 'true';
}