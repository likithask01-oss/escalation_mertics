/**
 * SheetFetchService.gs
 *
 * Fetches incident data from the configured Google Sheet and transforms it
 * into the canonical data shape consumed by the dashboard's useDashboardData hook.
 *
 * Fetch strategy (tried in order):
 *   1. SpreadsheetApp.openById()  — native GAS access; fastest, no HTTP quota.
 *      Requires the GAS script to have been granted Sheets read scope, AND
 *      the sheet to be in the same domain or explicitly shared with the
 *      script's service account / running user.
 *
 *   2. UrlFetchApp CSV export     — works when the sheet is published or
 *      shared as "Anyone with the link can view".
 *      URL: https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}
 *
 *   3. Throws FetchError          — caught by getDashboardData() and propagated
 *      as an error state to the UI (user sees Retry button).
 *
 * Column resolution:
 *   The mapper tries a wide set of known aliases for each canonical field so
 *   the sheet can use human-readable headers without any code change.
 *   See _ALIASES for the full alias list and add entries as needed.
 */

var SheetFetchService = (function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════
     TAB FILTER FUNCTIONS  (mirror of Hooks.html TAB_FILTERS — server-side)
     These are used to bucket rows into tab categories for pre-computing
     monthly counts and the raw analytics table.
  ══════════════════════════════════════════════════════════════════════ */
  var _TAB_KEYS = ['EXEC_ESCALATIONS','MCS','CUF_P0_P1','CUF_GUP','CUF_BILLING','SOCIAL_CARE'];

  var _TAB_FILTERS = {
    EXEC_ESCALATIONS: function (r) {
      var type = (r.iem_escalation_type || '').toLowerCase();
      var subj = (r.subject || '').toLowerCase();
      return type.indexOf('exec escalation') !== -1 &&
             (subj.indexOf('email - fwd') !== -1 || subj.indexOf('email - re') !== -1);
    },
    MCS: function (r) {
      return (r.subject || '').toLowerCase().indexOf('mcs sf prod') !== -1;
    },
    CUF_P0_P1: function (r) {
      var s = (r.subject || '').toLowerCase();
      return s.indexOf('cuf - account team') !== -1 || s.indexOf('cuf - other') !== -1;
    },
    CUF_GUP: function (r) {
      return (r.subject || '').toLowerCase().indexOf('cuf - gup') !== -1;
    },
    CUF_BILLING: function (r) {
      return (r.iem_escalation_type || '').toLowerCase() === 'billing related';
    },
    SOCIAL_CARE: function (r) {
      return (r.iem_escalation_type || '').toLowerCase().indexOf('social care') !== -1;
    }
  };

  /* ══════════════════════════════════════════════════════════════════════
     COLUMN ALIAS MAP
     Maps canonical field name → ordered array of accepted column header
     aliases (exact, case-insensitive match).  First alias found in the
     actual sheet headers wins.  Add more aliases here as new sheet layouts
     are encountered — no other code needs changing.
  ══════════════════════════════════════════════════════════════════════ */
  var _ALIASES = {
    bug_id: [
      'bug_id','Bug ID','Bug Id','IEM Bug ID','IEM Bug Id','BugID',
      'Buganizer ID','Buganizer Id','Bug','b/ ID','Bug Number'
    ],
    iem_escalation_number: [
      'iem_escalation_number','IEM Escalation #','IEM Escalation Number',
      'Escalation #','Escalation Number','escalation_number','Escalation No.',
      'Vector Case','vector_case','IEM #','IEM Ticket','Ticket ID','ticket_id',
      'IEM Bug/Vector Case','Case Number','Case #'
    ],
    current_assignee_ldap: [
      'current_assignee_ldap','Current Assignee','Assignee','LDAP',
      'Current Owner','Owner','Assigned To','assigned_to','assignee_ldap',
      'Requesting POC','requestingPoc','POC','IEM POC','On-Call POC',
      'Assigned Engineer'
    ],
    product_name: [
      'product_name','Product Name','Product','Product Area','productArea',
      'Service','GCP Service','GCP Product','Product / Name','Affected Product'
    ],
    priority: [
      'priority','Priority','Severity','severity','P0/P1','Sev',
      'Incident Priority','Issue Priority','Priority Level','P Level'
    ],
    customer_name: [
      'customer_name','Customer Name','Customer','customerName','Account',
      'Customer / Service Level','Customer Account','Org','Organization',
      'Affected Customer','Client'
    ],
    subject: [
      'subject','Subject','Title','Issue','Issue Title','Description',
      'Summary','Ticket Subject','Escalation Subject','Email Subject',
      'Incident Title'
    ],
    last_update: [
      'last_update','Last Update','Latest Update','Last Comment',
      'latest_update','Last Activity','Status Update','latest_comment',
      'Recent Update','Last Status','Update Text','Latest Comment Text'
    ],
    time_to_first_update_mins: [
      'time_to_first_update_mins','Time to First Update (mins)',
      'Time to First Update','FMR (mins)','FMR','First Update Mins',
      'first_update_mins','First Meaningful Response (mins)',
      'First Meaningful Response','Time to First Response (mins)',
      'First Response (mins)','FMR Minutes','TTFU (mins)','TTFU'
    ],
    resolution_hours: [
      'resolution_hours','Resolution Hours','Resolution Time (hours)',
      'Resolution Time','Age (hours)','Escalation Age (hours)',
      'Time to Resolution (hours)','resolution_time_hours','Duration (hours)',
      'Handle Time (hours)','Age Hours','Total Hours'
    ],
    created_timestamp: [
      'created_timestamp','Created Timestamp','Created At','Created',
      'createdAt','Creation Date','Date Created','Open Date',
      'Escalation Date','Date Opened','Start Date','Opened At',
      'Created Date','Date/Time Created'
    ],
    closed_timestamp: [
      'closed_timestamp','Closed Timestamp','Closed At','Closed',
      'closedAt','Close Date','Date Closed','Resolution Date',
      'Resolved At','End Date','Date Resolved','Closed Date',
      'Resolution Timestamp'
    ],
    status: [
      'status','Status','Current Status','Escalation Status',
      'Issue Status','State','Ticket Status','Case Status'
    ],
    iem_escalation_type: [
      'iem_escalation_type','IEM Escalation Type','Escalation Type',
      'Type','Category','category','escalation_type','IEM Type',
      'Ticket Type','Issue Type','Incident Type','Esc Type'
    ]
  };

  /* Build reverse lookup: lowercased alias → canonical key */
  var _ALIAS_LOOKUP = {};
  Object.keys(_ALIASES).forEach(function (canonical) {
    _ALIASES[canonical].forEach(function (alias) {
      var key = alias.toLowerCase().trim();
      if (!_ALIAS_LOOKUP[key]) _ALIAS_LOOKUP[key] = canonical;
    });
  });

  /* ══════════════════════════════════════════════════════════════════════
     CSV PARSER  (RFC-4180, handles quoted fields and escaped quotes)
  ══════════════════════════════════════════════════════════════════════ */
  function _parseCsv(text) {
    var rows  = [];
    var row   = [];
    var field = '';
    var inQ   = false;
    var len   = text.length;

    for (var i = 0; i < len; i++) {
      var ch = text[i];

      if (inQ) {
        if (ch === '"') {
          if (i + 1 < len && text[i + 1] === '"') { field += '"'; i++; }   // escaped "
          else inQ = false;
        } else {
          field += ch;
        }
      } else {
        if      (ch === '"')  { inQ = true; }
        else if (ch === ',')  { row.push(field.trim()); field = ''; }
        else if (ch === '\r') {
          if (i + 1 < len && text[i + 1] === '\n') i++;                    // CRLF
          row.push(field.trim());
          if (row.length) rows.push(row);
          row = []; field = '';
        } else if (ch === '\n') {
          row.push(field.trim());
          if (row.length) rows.push(row);
          row = []; field = '';
        } else {
          field += ch;
        }
      }
    }
    // Flush last field/row
    if (field || row.length) { row.push(field.trim()); rows.push(row); }
    return rows;
  }

  /* ══════════════════════════════════════════════════════════════════════
     RAW ROWS → PLAIN OBJECTS  (first row = headers)
  ══════════════════════════════════════════════════════════════════════ */
  function _rowsToObjects(rows) {
    if (!rows || rows.length < 2) return [];
    var headers = rows[0];
    return rows.slice(1).filter(function (row) {
      return row.some(function (cell) { return String(cell || '').trim() !== ''; });
    }).map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) {
        obj[String(h)] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     DATE NORMALISER  — accepts Date objects, ISO strings, locale strings
  ══════════════════════════════════════════════════════════════════════ */
  function _normaliseDate(val) {
    if (val == null || val === '' || val === 'N/A' || val === '-' || val === '—') return null;
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val.toISOString();
    }
    try {
      var d = new Date(String(val));
      return isNaN(d.getTime()) ? null : d.toISOString();
    } catch (e) { return null; }
  }

  /* ══════════════════════════════════════════════════════════════════════
     CANONICAL ROW MAPPER
     Takes a plain-object row (with sheet headers as keys) and returns
     a row in the dashboard's canonical schema.
  ══════════════════════════════════════════════════════════════════════ */
  function _toCanonical(rawObj) {
    // Start with empty canonical row
    var r = {
      bug_id: '', iem_escalation_number: '', current_assignee_ldap: '',
      product_name: '', priority: '', customer_name: '', subject: '',
      last_update: '', time_to_first_update_mins: null, resolution_hours: null,
      created_timestamp: null, closed_timestamp: null,
      status: '', iem_escalation_type: ''
    };

    // Resolve headers via alias map (first match wins)
    Object.keys(rawObj).forEach(function (header) {
      var canonical = _ALIAS_LOOKUP[header.toLowerCase().trim()];
      if (!canonical) return;
      var current = r[canonical];
      // Only overwrite if the canonical slot is still empty/null
      if (current === '' || current === null || current === undefined) {
        r[canonical] = rawObj[header];
      }
    });

    // Type coercions
    var fmr = parseFloat(r.time_to_first_update_mins);
    r.time_to_first_update_mins = isNaN(fmr) ? null : fmr;

    var resHrs = parseFloat(r.resolution_hours);
    r.resolution_hours = isNaN(resHrs) ? null : resHrs;

    r.created_timestamp = _normaliseDate(r.created_timestamp);
    r.closed_timestamp  = _normaliseDate(r.closed_timestamp);

    // Coerce priority values: "P0", "p0", "Huge" → normalised
    r.priority = _normalisePriority(r.priority);

    return r;
  }

  function _normalisePriority(raw) {
    var s = String(raw || '').trim();
    var upper = s.toUpperCase();
    if (upper === 'P0' || upper === 'P1' || upper === 'P2' || upper === 'P3') return upper;
    if (upper === 'HUGE') return 'P0';
    if (upper === 'MAJOR') return 'P1';
    return s || '';
  }

  /* ══════════════════════════════════════════════════════════════════════
     FETCH STRATEGY 1: SpreadsheetApp  (native GAS access)
  ══════════════════════════════════════════════════════════════════════ */
  function _fetchViaSheets() {
    var ss = SpreadsheetApp.openById(INCIDENT_CONFIG.SPREADSHEET_ID);
    var sheet;

    // Find by GID (numeric sheet ID) first — most reliable
    if (INCIDENT_CONFIG.INCIDENTS_GID) {
      var gid = String(INCIDENT_CONFIG.INCIDENTS_GID);
      var all = ss.getSheets();
      for (var i = 0; i < all.length; i++) {
        if (String(all[i].getSheetId()) === gid) { sheet = all[i]; break; }
      }
    }

    // Fall back to sheet name
    if (!sheet && INCIDENT_CONFIG.INCIDENTS_SHEET_NAME) {
      sheet = ss.getSheetByName(INCIDENT_CONFIG.INCIDENTS_SHEET_NAME);
    }

    // Fall back to first sheet
    if (!sheet) {
      var allSheets = ss.getSheets();
      if (allSheets.length > 0) sheet = allSheets[0];
    }

    if (!sheet) throw new Error('No accessible sheet found in spreadsheet ' + INCIDENT_CONFIG.SPREADSHEET_ID);

    Logger.log('[SheetFetchService] Using sheet: "' + sheet.getName() + '" (GID=' + sheet.getSheetId() + ')');

    var values = sheet.getDataRange().getValues();
    // Values from Sheets API may contain Date objects — _rowsToObjects handles them transparently
    return _rowsToObjects(values);
  }

  /* ══════════════════════════════════════════════════════════════════════
     FETCH STRATEGY 2: UrlFetchApp CSV export  (public sheet fallback)
  ══════════════════════════════════════════════════════════════════════ */
  function _fetchViaCsv() {
    var url = 'https://docs.google.com/spreadsheets/d/' +
              encodeURIComponent(INCIDENT_CONFIG.SPREADSHEET_ID) +
              '/export?format=csv&gid=' +
              encodeURIComponent(INCIDENT_CONFIG.INCIDENTS_GID || '0');

    Logger.log('[SheetFetchService] CSV export URL: ' + url);

    var resp = UrlFetchApp.fetch(url, {
      method:           'GET',
      muteHttpExceptions: true,
      followRedirects:  true,
      headers:          { 'Accept': 'text/csv, text/plain, */*' }
    });

    var code = resp.getResponseCode();
    Logger.log('[SheetFetchService] CSV export HTTP ' + code);

    if (code === 200) {
      var text = resp.getContentText('UTF-8');
      if (!text || text.trim().length === 0) {
        throw new Error('CSV export returned empty body (HTTP 200).');
      }
      // Detect HTML redirect to sign-in page (Google redirects 200 with sign-in HTML)
      if (text.trim().indexOf('<!DOCTYPE') === 0 || text.trim().indexOf('<html') === 0) {
        throw new Error('CSV export returned HTML (likely a sign-in redirect). ' +
                        'Ensure the sheet is shared as "Anyone with the link can view".');
      }
      var rows = _parseCsv(text);
      return _rowsToObjects(rows);
    }

    if (code === 302 || code === 301) {
      throw new Error('CSV export redirected (HTTP ' + code + '). ' +
                      'The sheet may require authentication. ' +
                      'Publish the sheet or grant access to the GAS project\'s service account.');
    }

    if (code === 403 || code === 401) {
      throw new Error('CSV export access denied (HTTP ' + code + '). ' +
                      'Share the sheet as "Anyone with the link can view" or ' +
                      'grant the GAS service account read access.');
    }

    throw new Error('CSV export failed (HTTP ' + code + '): ' + resp.getContentText().slice(0, 300));
  }

  /* ══════════════════════════════════════════════════════════════════════
     COMMS LOG FETCH
     Tries to open a CommsLog sheet in the same spreadsheet.
     Returns [] if not found (graceful degradation to mock log in frontend).
  ══════════════════════════════════════════════════════════════════════ */
  function fetchCommsLog(bugId) {
    try {
      var ss    = SpreadsheetApp.openById(INCIDENT_CONFIG.SPREADSHEET_ID);
      var sheet = ss.getSheetByName(INCIDENT_CONFIG.COMMS_LOG_SHEET_NAME || 'CommsLog');
      if (!sheet) return [];

      var objects = _rowsToObjects(sheet.getDataRange().getValues());
      return objects
        .filter(function (row) {
          var rid = row['bug_id'] || row['Bug ID'] || row['Incident ID'] ||
                    row['incidentId'] || row['IEM Bug ID'] || '';
          return String(rid).trim() === String(bugId).trim();
        })
        .map(function (row) {
          return {
            timestamp: _normaliseDate(row['timestamp'] || row['Timestamp'] || row['Date'] || ''),
            author:    row['author']    || row['Author']    || row['IEM POC']   || '',
            message:   row['message']   || row['Message']   || row['Update']    || '',
            audience:  row['audience']  || row['Audience']  || 'IEM'
          };
        });
    } catch (e) {
      Logger.log('[SheetFetchService] fetchCommsLog failed: ' + e.message);
      return [];
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     MONTHLY STATS COMPUTER
     Groups canonical rows by YYYY-MM per tab filter key.
     Returns { EXEC_ESCALATIONS: [{month, count},...], MCS: [...], ... }
  ══════════════════════════════════════════════════════════════════════ */
  function _computeMonthly(rows) {
    var monthly = {};
    _TAB_KEYS.forEach(function (k) { monthly[k] = {}; });

    rows.forEach(function (r) {
      var ts = r.created_timestamp;
      if (!ts) return;
      var d = new Date(ts);
      if (isNaN(d.getTime())) return;
      var ym = Utilities.formatDate(d, 'UTC', 'yyyy-MM');

      _TAB_KEYS.forEach(function (k) {
        if (_TAB_FILTERS[k](r)) {
          monthly[k][ym] = (monthly[k][ym] || 0) + 1;
        }
      });
    });

    var result = {};
    _TAB_KEYS.forEach(function (k) {
      var months = Object.keys(monthly[k]).sort();
      result[k] = months.map(function (m) { return { month: m, count: monthly[k][m] }; });
    });
    return result;
  }

  /* ══════════════════════════════════════════════════════════════════════
     RAW ANALYTICS TABLE DATA
     Returns the most-recent N rows per tab key in the rawData table shape.
  ══════════════════════════════════════════════════════════════════════ */
  function _computeRaw(rows) {
    var result = {};
    _TAB_KEYS.forEach(function (k) {
      var filtered = rows.filter(_TAB_FILTERS[k]).slice().sort(function (a, b) {
        return new Date(b.created_timestamp || 0) - new Date(a.created_timestamp || 0);
      });

      result[k] = filtered.slice(0, 25).map(function (r) {
        var ts = r.created_timestamp;
        var d  = ts ? new Date(ts) : null;
        var ym = (d && !isNaN(d.getTime()))
               ? Utilities.formatDate(d, 'UTC', 'yyyy-MM')
               : '—';
        // Estimate firstUpdate from FMR if available
        var firstUpdate = '—';
        if (ts && r.time_to_first_update_mins != null) {
          try {
            var fu = new Date(new Date(ts).getTime() + Number(r.time_to_first_update_mins) * 60000);
            firstUpdate = isNaN(fu.getTime()) ? '—' : Utilities.formatDate(fu, 'UTC', 'yyyy-MM-dd HH:mm');
          } catch (e) { /* ignore */ }
        }
        return {
          month:       ym,
          bugId:       r.bug_id                 || '—',
          escalation:  r.iem_escalation_number  || '—',
          subject:     (r.subject || '—').slice(0, 80),
          created:     ts                        || '—',
          firstAssign: r.current_assignee_ldap  || '—',
          firstUpdate: firstUpdate
        };
      });
    });
    return result;
  }

  /* ══════════════════════════════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════════════════════════════ */

  /**
   * fetchAll()
   * Returns { rows, monthly, raw, _meta } or throws on total failure.
   */
  function fetchAll() {
    var rawObjects;
    var fetchMethod = 'unknown';
    var sheetsError, csvError;

    /* — Strategy 1: SpreadsheetApp — */
    try {
      rawObjects  = _fetchViaSheets();
      fetchMethod = 'SpreadsheetApp';
      Logger.log('[SheetFetchService] ✓ SpreadsheetApp: ' + rawObjects.length + ' raw rows');
    } catch (e1) {
      sheetsError = e1;
      Logger.log('[SheetFetchService] ✗ SpreadsheetApp failed: ' + e1.message);
      Logger.log('[SheetFetchService] → Trying CSV export fallback…');

      /* — Strategy 2: UrlFetchApp CSV — */
      try {
        rawObjects  = _fetchViaCsv();
        fetchMethod = 'UrlFetchApp CSV';
        Logger.log('[SheetFetchService] ✓ CSV export: ' + rawObjects.length + ' raw rows');
      } catch (e2) {
        csvError = e2;
        Logger.log('[SheetFetchService] ✗ CSV export failed: ' + e2.message);
        throw new Error(
          '[SheetFetchService] All fetch strategies failed.\n' +
          'Strategy 1 (SpreadsheetApp): ' + e1.message + '\n' +
          'Strategy 2 (CSV export):     ' + e2.message
        );
      }
    }

    /* Map to canonical schema; drop entirely empty rows */
    var rows = rawObjects
      .map(_toCanonical)
      .filter(function (r) {
        return r.bug_id || r.iem_escalation_number || r.subject || r.created_timestamp;
      });

    Logger.log('[SheetFetchService] ✓ Mapped ' + rows.length + ' canonical rows via ' + fetchMethod);

    return {
      rows:    rows,
      monthly: _computeMonthly(rows),
      raw:     _computeRaw(rows),
      _meta: {
        fetchMethod: fetchMethod,
        rawRowCount: rawObjects.length,
        mappedRowCount: rows.length,
        fetchedAt: new Date().toISOString()
      }
    };
  }

  return {
    fetchAll:      fetchAll,
    fetchCommsLog: fetchCommsLog
  };
}());
