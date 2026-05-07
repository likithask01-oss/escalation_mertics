# AppSheet Setup — IEM Unified Reporting

Connect AppSheet to the Google Sheet that `syncToSheet()` writes every 5 minutes.
The result is two native mobile views: **Active P0s** (table) and **SLO Trends** (chart).

---

## Prerequisites

- `syncToSheet()` has been run at least once so the `Incidents` tab and header row exist.
- You have the **Spreadsheet ID** of `REPORTING_SHEET_ID` (from `Config.gs` / Script Properties).
- You have an AppSheet account (free tier is sufficient).

---

## Step 1 — Create the App

1. Go to [appsheet.com](https://www.appsheet.com) → **Make a new app → Start with existing data**.
2. Choose **Google Sheets** as the data source.
3. Select the spreadsheet identified by `REPORTING_SHEET_ID`.
4. AppSheet detects the `Incidents` tab automatically — click **Customize my app**.

---

## Step 2 — Configure the Data Table

In **Data → Tables → Incidents**:

| AppSheet Column    | Type        | Notes |
|--------------------|-------------|-------|
| `bug_id`           | Text        | Set as the **Table Key** (Data → Key column = `bug_id`) |
| `vector_id`        | Text        | |
| `title`            | LongText    | |
| `priority`         | Enum        | Values: `P0`, `P1`, `P2`, `P3` |
| `status`           | Enum        | Values: `In Progress`, `Investigating`, `Monitoring`, `Open`, `Closed`, `Resolved` |
| `owner`            | Text        | |
| `customer_name`    | Text        | |
| `escalation_type`  | Text        | |
| `revenue_at_risk`  | Decimal     | |
| `slo_percent`      | Decimal     | |
| `region`           | Text        | |
| `created_at`       | DateTime    | |
| `slo_breach`       | Yes/No      | AppSheet maps "Yes"/"No" strings automatically |
| `_source`          | Text        | |

### Deep-link to Buganizer

Add a **Virtual Column** to open each bug in the browser:

- Column name: `Bug Link`
- App formula: `CONCATENATE("http://b/", [bug_id])`
- Column type: **Url**

Then add a **Row Action**:
- Action name: `Open in Buganizer`
- Do this: **Open a website**
- Target: `[Bug Link]`
- Icon: `link`

---

## Step 3 — "Active P0s" View

In **UX → Views → + New View**:

| Setting | Value |
|---------|-------|
| View name | `Active P0s` |
| For this data | `Incidents` |
| View type | `Table` |
| Sort by | `created_at` ↑ (oldest first — most urgent at top) |
| Row filter condition | `AND([priority] = "P0", NOT(OR([status] = "Closed", [status] = "Resolved")))` |
| Columns shown | `bug_id`, `title`, `customer_name`, `owner`, `created_at`, `slo_breach` |

Pin this view to the bottom navigation bar (set **Position** = **Left menu** or **Ref**).

---

## Step 4 — "SLO Trends" View

In **UX → Views → + New View**:

| Setting | Value |
|---------|-------|
| View name | `SLO Trends` |
| For this data | `Incidents` |
| View type | `Chart` |
| Chart type | `Line` |
| X-axis | `created_at` (grouped by **Month**) |
| Y-axis | `slo_percent` (aggregation: **Average**) |
| Group by | `priority` (series colour) |

---

## Step 5 — Auto-Refresh

AppSheet refreshes data when the user opens the app. For near-real-time updates:

**Option A — Client-side (no extra setup):**
- In **Settings → Offline / Sync → Sync on start**: ON
- **Automatic updates interval**: 5 minutes

**Option B — Server-side push (AppSheet webhook):**
1. In AppSheet → **Integrations → IN: from cloud services → AppSheet API** — copy the app endpoint.
2. In `Code.gs`, at the end of `syncToSheet()`, add a `UrlFetchApp.fetch()` call to the AppSheet refresh URL:
   ```js
   // Notify AppSheet to refresh (optional)
   var appsheetUrl = _runtimeProp_('APPSHEET_REFRESH_URL') || '';
   if (appsheetUrl) {
     UrlFetchApp.fetch(appsheetUrl, { method: 'post', muteHttpExceptions: true });
   }
   ```
3. Store the AppSheet refresh URL in Script Properties as `APPSHEET_REFRESH_URL`.

---

## Step 6 — Deploy

1. **AppSheet → Manage → Deploy → Move app to deployed state** → Confirm.
2. Share the app link or install it via **Add to Home Screen** on mobile.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| No data in AppSheet | Run `syncToSheet()` manually in GAS editor; check Logger for errors |
| Wrong column types detected | Re-sync after populating real data; AppSheet infers types from values |
| `slo_breach` shows as Text instead of Yes/No | In AppSheet Data editor, change column type manually to **Yes/No** |
| Bug ID link doesn't open | Ensure the Virtual Column formula is `CONCATENATE("http://b/", [bug_id])` not `=HYPERLINK(...)` |
| Trigger not running | In GAS editor → Triggers (clock icon) — verify `syncToSheet` shows every 5 min; re-run `setupSyncTrigger()` if missing |
