# Gmail Bulk Filter Manager

A Google Apps Script that creates and manages Gmail filters in bulk — applying labels, skipping the inbox, and marking emails as important. Also backfills labels onto existing emails.

---

## Features

- **Bulk filter creation** from simple email lists defined in `Config.gs`
- **Auto-creates labels** if they don't exist yet (including nested labels like `Finance/Alerts`)
- **Skips duplicates** — if an identical filter already exists, it won't create another
- **Replaces outdated filters** — if a filter exists for the same sender but with different settings, it deletes the old one and creates the updated one
- **Cleans up duplicates** — removes multiple conflicting filters for the same sender, keeping only the correct one
- **Backfills existing emails** — applies labels and archives threads that arrived before the filters were created

---

## Setup

### 1. Open Google Apps Script
Go to [script.google.com](https://script.google.com) and create a new project.

### 2. Enable the Gmail Advanced Service
- In the left sidebar, click **Services** (`+`)
- Find **Gmail API** and click **Add**

### 3. Create the files
Create three script files and paste in the contents of each:

| File | Purpose |
|---|---|
| `Config.gs` | Your email lists and label names — the only file you ever need to edit |
| `Helpers.gs` | Utility functions called by `Main.gs` |
| `Main.gs` | The two entry point functions you run |

### 4. Run it
- Select `createBulkFilters` from the function dropdown
- Click **Run**
- Authorize the script when prompted

---

## Usage

All configuration lives in `Config.gs`. `Helpers.gs` and `Main.gs` never need to be touched.

### Adding a new sender to an existing label

Just append their address to the right email list in `Config.gs`:

```javascript
const newsletterEmails = [
  'updates@newsletter-service.com',
  'new-sender@example.com',   // 👈 add here
];
```

### Adding a new email type

In `Config.gs`:

**Step 1** — add the label constant:
```javascript
const LABEL = {
  ...
  SOCIAL: 'Social',  // 👈
};
```

**Step 2** — add the email list and a row in `emailTypes`:
```javascript
const emailTypes = [
  ...
  [socialEmails, LABEL.SOCIAL, true, false],  // 👈 [emails, label, skipInbox, markImportant]
];

const socialEmails = [   // 👈
  'noreply@twitter.com',
  'notifications@facebook.com',
];
```

That's it — `Helpers.gs` and `Main.gs` read from `emailTypes` automatically.

### `emailTypes` settings

Each row in `emailTypes` follows this format:

```javascript
[emailList, LABEL.NAME, skipInbox, markImportant]
```

| Column | Type | Description |
|---|---|---|
| `emailList` | array | The email list defined in `Config.gs` |
| `LABEL.NAME` | string | The label to apply, referenced from the `LABEL` constant |
| `skipInbox` | boolean | `true` to archive, `false` to keep in inbox |
| `markImportant` | boolean | `true` to mark as important, `false` to leave as-is |

---

## Running the Script

There are two functions you can run from the Apps Script editor:

### `createBulkFilters()`
Creates Gmail filters for all senders in `Config.gs`. Safe to run multiple times — existing filters with matching criteria are skipped, and outdated ones are replaced.

### `applyLabelsToExistingEmails()`
Applies labels and archives existing threads that arrived before the filters were created. Run this once after `createBulkFilters()` to backfill your inbox. This will not apply the 'IMPORTANT' label to existing emails.

> **Note:** Run `createBulkFilters()` first so the labels exist before trying to apply them.

---

## File Structure

### `Config.gs`
The only file you need to edit. Contains:
- `LABEL` — named constants for all label strings
- `userId` — always `"me"` (the authenticated Google account)
- Email lists (eg. `newsletterEmails`, `shoppingEmails`, `financeEmails`, `workEmails`)
- `emailTypes` — maps each email list to its label and filter settings

### `Helpers.gs`
Utility functions used by `Main.gs`. Reads from `emailTypes` in `Config.gs` automatically — no hardcoded email types. Contains:
- `getOrCreateLabel(labelName)` — returns a label's ID, creating it if it doesn't exist
- `processExistingFilters(from, labelId, skipInbox, markImportant)` — checks for existing filters, keeps exact matches, deletes outdated ones
- `isDesiredFilter(match, labelId, skipInbox, markImportant)` — compares a filter against desired criteria
- `createFilterCriteriaArray()` — builds the flat filter list used by `createBulkFilters()`
- `createRulesArray()` — builds the flat rules list used by `applyLabelsToExistingEmails()`

### `Main.gs`
The two entry points — `createBulkFilters()` and `applyLabelsToExistingEmails()`.

---

## Notes

- The Gmail API returns filters under `response.filter` (singular) — this is an API quirk, not a typo.
- Built-in Gmail label IDs (`"INBOX"`, `"IMPORTANT"`) are always uppercase.
- Nested labels use `/` as a separator (e.g. `Finance/Alerts`) and appear as a folder hierarchy in the Gmail sidebar.
- `GmailApp.search()` returns a maximum of 500 threads. If you have more than 500 emails from one sender, the backfill will only process the first 500.
