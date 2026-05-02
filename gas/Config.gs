var INCIDENT_CONFIG = {
  // ── Active data source ──────────────────────────────────────────────────
  // 'mock'        — in-memory mock data (local dev / default)
  // 'publicSheet' — live Google Sheet via SheetFetchService (SpreadsheetApp → CSV fallback)
  // 'sheets'      — legacy SheetDataProvider (named-sheet access)
  // 'csv'         — Drive CSV file
  // 'driveExcel'  — Drive Excel file
  // 'api'         — external REST API
  //
  // NOTE: At runtime, getDashboardData() ALWAYS checks Script Properties first
  //       (set via the dashboard's ⚙ Settings panel).  This value is only the
  //       compile-time fallback when no Script Property has been saved yet.
  DATA_SOURCE: 'mock',

  // ── Google Sheet settings ───────────────────────────────────────────────
  // Used by SheetFetchService (DATA_SOURCE = 'publicSheet') and SheetDataProvider.
  // These are fallback values; the Settings panel overwrites them via
  // PropertiesService at runtime — no redeploy needed.
  SPREADSHEET_ID:       '',   // e.g. '1SKir-kwioaUyPGkLh9y7HnYkKvwkFar8aWcU0vj8T1Q'
  INCIDENTS_GID:        '',   // numeric GID of the incidents tab (blank = first sheet)
  INCIDENTS_SHEET_NAME: 'Incidents',
  ONCALL_SHEET_NAME:    'OnCall',
  COMMS_LOG_SHEET_NAME: 'CommsLog',

  // ── Legacy providers ────────────────────────────────────────────────────
  CSV_FILE_ID:             '',
  EXCEL_FILE_ID:           '',
  API_BASE_URL:            '',
  API_KEY_PROPERTY_NAME:   'INCIDENT_API_KEY',

  // ── Logo ────────────────────────────────────────────────────────────────
  // Google Drive file ID for the IEM Team logo (PNG/JPG).
  // Leave empty to show the text fallback "IEM".
  LOGO_FILE_ID: ''
};
