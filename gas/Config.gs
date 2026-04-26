var INCIDENT_CONFIG = {
  // Switch data source here: 'mock' | 'sheets' | 'csv' | 'driveExcel' | 'api'
  DATA_SOURCE: 'mock',

  // Google Sheets settings (used when DATA_SOURCE = 'sheets')
  SPREADSHEET_ID: '',
  INCIDENTS_SHEET_NAME: 'Incidents',
  ONCALL_SHEET_NAME: 'OnCall',
  COMMS_LOG_SHEET_NAME: 'CommsLog',

  // Google Drive CSV file ID (used when DATA_SOURCE = 'csv')
  CSV_FILE_ID: '',

  // Google Drive Excel file ID (used when DATA_SOURCE = 'driveExcel')
  EXCEL_FILE_ID: '',

  // External API (used when DATA_SOURCE = 'api')
  API_BASE_URL: '',
  // Store the actual key in Script Properties under this name
  API_KEY_PROPERTY_NAME: 'INCIDENT_API_KEY',

  // Google Drive file ID for the IEM Team logo image (PNG/JPG)
  // Leave empty to show the text fallback "IEM"
  LOGO_FILE_ID: ''
};
