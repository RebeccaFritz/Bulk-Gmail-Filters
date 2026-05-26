# Gmail Bulk Filter Manager

A Google Apps Script that creates and manages Gmail filters in bulk from a simple array — applying labels, skipping the inbox, and marking emails as important.

---

## Features

- **Bulk filter creation** from a single array of rules
- **Auto-creates labels** if they don't exist yet (including nested labels like `fiz/buz`)
- **Skips duplicates** — if an identical filter already exists, it won't create another
- **Replaces outdated filters** — if a filter exists for the same sender but with different settings, it deletes the old one and creates the updated one
- **Handles duplicate filters** — cleans up multiple conflicting filters for the same sender

---

## Setup

### 1. Open Google Apps Script
Go to [script.google.com](https://script.google.com) and create a new project.

### 2. Enable the Gmail Advanced Service
- In the left sidebar, click **Services** (`+`)
- Find **Gmail API** and click **Add**

### 3. Paste the script
Copy the contents of `Code.gs` into the editor.

### 4. Run it
- Select `createBulkFilters` from the function dropdown
- Click **Run**
- Authorize the script when prompted

---

## Usage

Edit the `filterFromEmail` array in `createBulkFilters()`. Each row follows this format:

```javascript
['sender@example.com', 'LabelName', skipInbox, markImportant]
```

| Column | Type | Description |
|---|---|---|
| `from` | string | The sender email address to filter on |
| `labelName` | string | The label to apply (use `/` for nested labels) |
| `skipInbox` | boolean | `true` to skip the inbox, `false` to keep it |
| `markImportant` | boolean | `true` to mark as important, `false` to leave as-is |

### Example

```javascript
const filterFromEmail = [
  ['newsletters@example.com',  'Newsletters',       true,  false],
  ['boss@mycompany.com',        'Work/Priority',     false, true],
  ['noreply@github.com',        'GitHub',            true,  false],
];
```

---

## How It Works

### `createBulkFilters()`
The main entry point. Loops through `filterFromEmail`, gets or creates the label, checks for existing filters, and creates new ones as needed.

### `getOrCreateLabel(labelName)`
Checks if a label already exists. If it does, returns its ID. If not, creates it and returns the new ID. Using `/` in the label name automatically creates a nested sub-label in Gmail.

### `processExistingFilters(from, labelId, skipInbox, markImportant)`
For a given sender address, finds all existing filters. Keeps the first one that exactly matches the desired criteria, and deletes everything else. Returns `true` if an exact match was found (so the main loop can skip creation).

### `isDesiredFilter(match, labelId, skipInbox, markImportant)`
Compares a single existing filter against the desired criteria. Returns `true` only if the label, skip inbox setting, and mark important setting all match exactly.
