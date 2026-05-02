// Public API called by the frontend via google.script.run

// ── Main dashboard data ──────────────────────────────────────────────────────

function getDashboardData() {
  var source = _runtimeDataSource_();

  if (source === 'publicSheet') {
    try {
      var result = SheetFetchService.fetchAll();
      return {
        rows:         result.rows,
        monthly:      result.monthly,
        raw:          result.raw,
        systemHealth: getSystemHealth_(),
        _meta:        result._meta || {}
      };
    } catch (e) {
      // Surface the error message to the frontend so the settings panel can
      // display it instead of silently falling back to mock data.
      return {
        rows: [], monthly: {}, raw: {},
        systemHealth: getSystemHealth_(),
        _error: e.message || String(e)
      };
    }
  }

  // Legacy providers (sheets / csv / driveExcel / api / mock)
  var provider = getIncidentProvider_(source);
  return {
    incidents:    provider.getIncidents(),
    onCall:       provider.getOnCallPersonnel(),
    systemHealth: getSystemHealth_()
  };
}

function getCommunicationLog(incidentId) {
  var source = _runtimeDataSource_();
  if (source === 'publicSheet') {
    try {
      return SheetFetchService.fetchCommsLog(incidentId);
    } catch (e) {
      return [];
    }
  }
  return getIncidentProvider_(source).getCommunicationLog(incidentId);
}

// Returns the active user's display name and initials for the UI avatar.
function getCurrentUser() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) return { name: 'IEM Admin', initials: 'IA' };
    var local  = email.split('@')[0];
    var parts  = local.replace(/[._-]/g, ' ').split(' ').filter(Boolean);
    var name   = parts.map(function (p) {
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    }).join(' ');
    var initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
    return { name: name, initials: initials };
  } catch (e) {
    return { name: 'IEM Admin', initials: 'IA' };
  }
}

// ── Settings panel API ───────────────────────────────────────────────────────

/**
 * Returns the current sheet configuration so the settings modal can
 * pre-populate its fields.
 *
 * @return {{dataSource:string, sheetUrl:string, sheetId:string, sheetGid:string}}
 */
function getSheetConfig() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID') || INCIDENT_CONFIG.SPREADSHEET_ID || '';
  var sheetGid = props.getProperty('SHEET_GID') || INCIDENT_CONFIG.INCIDENTS_GID || '';
  var dataSource = props.getProperty('DATA_SOURCE') || INCIDENT_CONFIG.DATA_SOURCE || 'mock';
  var sheetUrl = sheetId
    ? 'https://docs.google.com/spreadsheets/d/' + sheetId + '/edit'
    : (props.getProperty('SHEET_URL') || '');
  return {
    dataSource: dataSource,
    sheetUrl:   sheetUrl,
    sheetId:    sheetId,
    sheetGid:   sheetGid
  };
}

/**
 * Persists the settings panel values to Script Properties.
 * No redeploy needed — getDashboardData() always reads these at runtime.
 *
 * @param {{dataSource:string, sheetUrl:string, sheetId:string, sheetGid:string}} config
 * @return {{ok:boolean, error:string|undefined}}
 */
function saveSheetConfig(config) {
  try {
    if (!config || typeof config !== 'object') throw new Error('Invalid config object');
    var props = PropertiesService.getScriptProperties();
    var id = _extractSheetId_(config.sheetUrl || '') || config.sheetId || '';
    props.setProperties({
      DATA_SOURCE: config.dataSource || 'publicSheet',
      SHEET_URL:   config.sheetUrl  || '',
      SHEET_ID:    id,
      SHEET_GID:   String(config.sheetGid || '')
    }, /* deleteAllOthers= */ false);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/**
 * Probes the given config (without persisting it) and returns connection info.
 * Used by the "Test Connection" button in the settings modal.
 *
 * @param {{sheetUrl:string, sheetId:string, sheetGid:string}} config
 * @return {{success:boolean, rowCount:number, fetchMethod:string, tabName:string, error:string|undefined}}
 */
function testSheetConnection(config) {
  try {
    if (!config) throw new Error('No config provided');
    var id = _extractSheetId_(config.sheetUrl || '') || config.sheetId || '';
    if (!id) throw new Error('No Sheet ID found. Enter a Google Sheets URL or Sheet ID.');

    // Temporarily override SheetFetchService config for this call only.
    var savedId  = INCIDENT_CONFIG.SPREADSHEET_ID;
    var savedGid = INCIDENT_CONFIG.INCIDENTS_GID;
    INCIDENT_CONFIG.SPREADSHEET_ID = id;
    INCIDENT_CONFIG.INCIDENTS_GID  = String(config.sheetGid || '');

    var result;
    try {
      result = SheetFetchService.fetchAll();
    } finally {
      INCIDENT_CONFIG.SPREADSHEET_ID = savedId;
      INCIDENT_CONFIG.INCIDENTS_GID  = savedGid;
    }

    return {
      success:     true,
      rowCount:    result.rows.length,
      fetchMethod: result._meta ? result._meta.strategy : 'unknown',
      tabName:     result._meta ? result._meta.sheetName : ''
    };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * Opens the spreadsheet and returns every visible tab with its name, GID and
 * approximate row count. Solves the "I don't know the GID" problem: the
 * frontend shows a dropdown so the user can pick the correct tab.
 *
 * @param {string} sheetIdOrUrl  Sheet ID or full Google Sheets URL.
 * @return {{ok:boolean, tabs: Array<{name:string, gid:string, rowCount:number}>, error:string|undefined}}
 */
function listSheetTabs(sheetIdOrUrl) {
  try {
    var id = _extractSheetId_(sheetIdOrUrl || '') || sheetIdOrUrl || '';
    if (!id) throw new Error('No Sheet ID provided.');

    var ss     = SpreadsheetApp.openById(id);
    var sheets = ss.getSheets();
    var tabs   = sheets.map(function (sh) {
      var lastRow = 0;
      try { lastRow = Math.max(0, sh.getLastRow() - 1); } catch (e) { /* ignore */ }
      return {
        name:     sh.getName(),
        gid:      String(sh.getSheetId()),
        rowCount: lastRow   // excludes header row
      };
    });
    return { ok: true, tabs: tabs };
  } catch (e) {
    return { ok: false, tabs: [], error: e.message || String(e) };
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns the effective DATA_SOURCE, preferring the Script Property that the
 * settings panel writes over the compile-time INCIDENT_CONFIG fallback.
 */
function _runtimeDataSource_() {
  try {
    var prop = PropertiesService.getScriptProperties().getProperty('DATA_SOURCE');
    if (prop) return prop;
  } catch (e) { /* PropertiesService unavailable in local mock mode */ }
  return INCIDENT_CONFIG.DATA_SOURCE || 'mock';
}

/**
 * Extracts the 44-character spreadsheet ID from a Google Sheets URL.
 * Returns the input unchanged when it looks like a bare ID already.
 */
function _extractSheetId_(urlOrId) {
  if (!urlOrId) return '';
  // Match /d/<id>/ pattern in Sheets URLs
  var m = urlOrId.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  if (m) return m[1];
  // If it looks like a bare ID (only base-64 chars, 20+ chars), return as-is
  if (/^[A-Za-z0-9_-]{20,}$/.test(urlOrId.trim())) return urlOrId.trim();
  return '';
}

/**
 * Called by the inline "Google Sheet URL → Fetch" bar on the frontend.
 * Temporarily applies sheetId/gid, runs SheetFetchService, and returns
 * canonical rows so the client can feed them straight into the table.
 *
 * @param {string} sheetId
 * @param {string} gid   numeric GID string, or '' for first sheet
 * @return {{ok:boolean, rows:Array, _meta:Object, error:string|undefined}}
 */
function fetchSheetByUrl(sheetId, gid) {
  try {
    if (!sheetId) throw new Error('No Sheet ID provided.');
    var saved = { id: INCIDENT_CONFIG.SPREADSHEET_ID, gid: INCIDENT_CONFIG.INCIDENTS_GID };
    INCIDENT_CONFIG.SPREADSHEET_ID = sheetId;
    INCIDENT_CONFIG.INCIDENTS_GID  = String(gid || '');
    var result;
    try { result = SheetFetchService.fetchAll(); }
    finally {
      INCIDENT_CONFIG.SPREADSHEET_ID = saved.id;
      INCIDENT_CONFIG.INCIDENTS_GID  = saved.gid;
    }
    return { ok: true, rows: result.rows, _meta: result._meta || {} };
  } catch (e) {
    return { ok: false, rows: [], error: e.message || String(e) };
  }
}

function getIncidentProvider_(source) {
  switch (source) {
    case 'sheets':     return SheetDataProvider;
    case 'csv':        return CsvDataProvider;
    case 'driveExcel': return DriveFileDataProvider;
    case 'api':        return ApiDataProvider;
    case 'mock':
    default:           return MockDataProvider;
  }
}

function getSystemHealth_() {
  return {
    version:         'v4.2.1-RELEASE',
    authenticatedAs: 'MIM-ADMIN-01',
    apiLatency:      '12MS',
    uptime:          '99.98%',
    logRate:         '12.4K/S'
  };
}
