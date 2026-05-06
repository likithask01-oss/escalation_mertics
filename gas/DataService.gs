// Public API called by the frontend via google.script.run

// ── Main dashboard data ──────────────────────────────────────────────────────

function getDashboardData() {
  var source = _runtimeDataSource_();

  if (source === 'publicSheet') {
    try {
      var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || INCIDENT_CONFIG.SPREADSHEET_ID || '';
      var gid     = PropertiesService.getScriptProperties().getProperty('SHEET_GID') || INCIDENT_CONFIG.INCIDENTS_GID  || '';
      var result  = fetchSheetByUrl(sheetId, gid);
      if (!result.ok) throw new Error(result.error || 'fetchSheetByUrl failed');
      return {
        rows:         result.rows,
        monthly:      {},
        raw:          {},
        systemHealth: getSystemHealth_(),
        _meta:        result._meta || {}
      };
    } catch (e) {
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
    return [];   // comms log not available from plain CSV sheet
  }
  return getIncidentProvider_(source).getCommunicationLog(incidentId);
}

// Returns the active user's display name, LDAP and initials for the UI avatar.
function getCurrentUser() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) return { name: 'IEM Admin', initials: 'IA', ldap: 'iem-admin' };
    var ldap   = email.split('@')[0];
    var parts  = ldap.replace(/[._-]/g, ' ').split(' ').filter(Boolean);
    var name   = parts.map(function (p) {
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    }).join(' ');
    var initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
    return { name: name, initials: initials, ldap: ldap };
  } catch (e) {
    return { name: 'IEM Admin', initials: 'IA', ldap: 'iem-admin' };
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
 * Returns sheet config for a specific header tab group.
 * Falls back to the global SHEET_ID/SHEET_GID if no group-specific config.
 */
function getSheetConfigForGroup(groupId) {
  try {
    var props = PropertiesService.getScriptProperties();
    var key = 'SHEET_MAPPINGS_' + groupId;
    var raw = props.getProperty(key);
    if (raw) {
      var mappings = JSON.parse(raw);
      var active = (mappings || []).filter(function(m){ return m.enabled !== false; });
      if (active.length) return { ok:true, mappings:active };
    }
    // Fallback to global config
    var globalId = props.getProperty('SHEET_ID') || INCIDENT_CONFIG.SPREADSHEET_ID || '';
    var globalGid = props.getProperty('SHEET_GID') || INCIDENT_CONFIG.INCIDENTS_GID || '';
    if (globalId) return { ok:true, mappings:[{ sheetId:globalId, gid:globalGid, name:'Default', enabled:true }] };
    return { ok:false, mappings:[] };
  } catch(e) {
    return { ok:false, error:e.message };
  }
}

/**
 * Saves per-group sheet mappings to Script Properties.
 */
function saveSheetMappings(groupId, mappings) {
  try {
    if (!groupId) throw new Error('No group ID provided');
    PropertiesService.getScriptProperties().setProperty(
      'SHEET_MAPPINGS_' + groupId,
      JSON.stringify(mappings || [])
    );
    return { ok:true };
  } catch(e) {
    return { ok:false, error:e.message || String(e) };
  }
}

/**
 * Returns all group sheet mappings for the settings panel.
 */
function getAllSheetMappings() {
  try {
    var props = PropertiesService.getScriptProperties();
    var groups = ['INCIDENT_MANAGEMENT','ESCALATION_MANAGEMENT','SERVICE_DISRUPTION'];
    var result = {};
    groups.forEach(function(g){
      var raw = props.getProperty('SHEET_MAPPINGS_' + g);
      result[g] = raw ? JSON.parse(raw) : [];
    });
    return { ok:true, mappings:result };
  } catch(e) {
    return { ok:false, mappings:{}, error:e.message };
  }
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

    var result = fetchSheetByUrl(id, config.sheetGid || '');
    if (!result.ok) throw new Error(result.error || 'Fetch failed');

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
 * Self-contained: does NOT depend on SheetFetchService.
 * Strategy 1 — SpreadsheetApp (requires sheet shared with script user).
 * Strategy 2 — UrlFetchApp CSV export (requires sheet publicly shared).
 *
 * @param {string} sheetId
 * @param {string} gid   numeric GID string, or '' for first sheet
 * @return {{ok:boolean, rows:Array, _meta:Object, error:string|undefined}}
 */
function fetchSheetByUrl(sheetId, gid) {
  try {
    if (!sheetId) throw new Error('No Sheet ID provided.');

    var rawObjects, sheetName, strategy;
    var targetGid = gid ? String(gid) : '';

    // ── Strategy 1: SpreadsheetApp ──────────────────────────────────────
    try {
      var ss     = SpreadsheetApp.openById(sheetId);
      var sheets = ss.getSheets();
      var sheet  = sheets[0];
      if (targetGid) {
        for (var i = 0; i < sheets.length; i++) {
          if (String(sheets[i].getSheetId()) === targetGid) { sheet = sheets[i]; break; }
        }
      }
      var values = sheet.getDataRange().getValues();
      rawObjects = _sheetValuesToObjects_(values);
      sheetName  = sheet.getName();
      strategy   = 'SpreadsheetApp';
    } catch (e1) {

      // ── Strategy 2: UrlFetchApp CSV export ──────────────────────────
      var url = 'https://docs.google.com/spreadsheets/d/' + sheetId +
                '/export?format=csv' + (targetGid ? '&gid=' + targetGid : '');
      var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var code = resp.getResponseCode();
      var body = resp.getContentText();
      if (code !== 200) throw new Error('CSV export returned HTTP ' + code);
      if (/^<!DOCTYPE|^<html/i.test(body.trim())) {
        throw new Error('Sheet requires sign-in or is not publicly shared.');
      }
      rawObjects = _parseCsvToObjects_(body);
      sheetName  = '';
      strategy   = 'csv-export';
    }

    var rows = rawObjects.map(_toCanonicalRow_);
    return { ok: true, rows: rows, _meta: { strategy: strategy, sheetName: sheetName, rowCount: rows.length } };

  } catch (e) {
    return { ok: false, rows: [], error: e.message || String(e) };
  }
}

// ── Inline helpers (no external dependency) ──────────────────────────────

var _FETCH_ALIASES_ = {
  bug_id:                    ['bug_id','bug id','id','bugid','issue id','case id'],
  iem_escalation_number:     ['iem_escalation_number','iem escalation number','escalation #','escalation number','iem bug/vector case','vector case'],
  current_assignee_ldap:     ['current_assignee_ldap','current assignee ldap','assignee','requesting poc','assigned to','owner'],
  product_name:              ['product_name','product name','product area','product','service'],
  priority:                  ['priority','severity','sev'],
  customer_name:             ['customer_name','customer name','customer','account','company'],
  subject:                   ['subject','title','issue','summary','description'],
  last_update:               ['last_update','last update','update','latest update','notes'],
  p0_time_to_first_update_mins: ['p0_time_to_first_update_mins','p0 time to first update (mins)','p0 fmr (mins)','p0 fmr'],
  time_to_first_update_mins: ['time_to_first_update_mins','time to first update (mins)','fmr (mins)','fmr','first response mins','tfu'],
  resolution_hours:          ['resolution_hours','resolution hours','age (hours)','resolution time','hours to close'],
  created_timestamp:         ['created_timestamp','created at','created','opened at','date opened','date created'],
  closed_timestamp:          ['closed_timestamp','closed at','closed','resolved at','date closed'],
  status:                    ['status','state','current status'],
  iem_escalation_type:       ['iem_escalation_type','iem escalation type','escalation type','type','category'],
  impact:                    ['impact','revenue at risk','revenue_at_risk','rev at risk','arr impact','arr','financial impact']
};

var _FETCH_ALIAS_LOOKUP_ = (function () {
  var m = {};
  var keys = Object.keys(_FETCH_ALIASES_);
  for (var k = 0; k < keys.length; k++) {
    var canon = keys[k];
    var aliases = _FETCH_ALIASES_[canon];
    for (var a = 0; a < aliases.length; a++) {
      m[aliases[a].toLowerCase()] = canon;
    }
  }
  return m;
}());

function _toCanonicalRow_(obj, idx) {
  var row = {};
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var h     = keys[i];
    var canon = _FETCH_ALIAS_LOOKUP_[h.toLowerCase().trim()];
    if (canon) row[canon] = String(obj[h] || '').trim();
  }
  if (!row.bug_id) row.bug_id = 'ext-' + idx;
  return row;
}

function _sheetValuesToObjects_(values) {
  if (!values || values.length < 2) return [];
  var headers = values[0];
  return values.slice(1).map(function (row) {
    var obj = {};
    for (var i = 0; i < headers.length; i++) {
      obj[headers[i]] = row[i] !== undefined ? row[i] : '';
    }
    return obj;
  });
}

function _parseCsvToObjects_(text) {
  var lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  var headers = _splitCsvLine_(lines[0]);
  return lines.slice(1).map(function (line) {
    var vals = _splitCsvLine_(line);
    var obj  = {};
    for (var i = 0; i < headers.length; i++) {
      obj[headers[i].trim().replace(/^"|"$/g, '')] = (vals[i] || '').trim().replace(/^"|"$/g, '');
    }
    return obj;
  });
}

function _splitCsvLine_(line) {
  var result = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
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
