// ── Unified Reporting Ecosystem — Backend (Code.gs) ──────────────────────────
//
// Covers:
//   Task 1 — Data Aggregation  (fetchTaskFlowData, fetchPlxData, fetchVectorIdData, mergeData)
//   Task 2 — AppSheet Sync     (syncToSheet, setupSyncTrigger, deleteSyncTriggers)
//   Task 3 — Web App entry     (doGet, include, getReportingData)
//   Task 4 — LLM → Slides MBR (generateMBR, computeMonthlyStats, callLlmApi_, updateSlides_)
//
// All credentials are read from Script Properties — never hardcoded.
// ─────────────────────────────────────────────────────────────────────────────

// ════════════════════════════════════════════════════════════════════════════
// WEB APP ENTRY POINT
// ════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  return template
    .evaluate()
    .setTitle('IEM Unified Reporting')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Allows Index.html to pull in partials via <?!= include('Filename') ?> */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


// ════════════════════════════════════════════════════════════════════════════
// TASK 1 — DATA AGGREGATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Fetches incidents from the TaskFlow / Buganizer JSON API.
 *
 * Expected API response: JSON array of objects with at minimum:
 *   bug_id, title, priority, status, owner, created_at, slo_breach
 *
 * @return {Array<Object>}
 */
function fetchTaskFlowData() {
  var url   = _runtimeProp_('TASKFLOW_API_URL')   || REPORTING_CONFIG.TASKFLOW_API_URL;
  var token = _runtimeProp_('TASKFLOW_API_TOKEN')  || '';
  if (!url) {
    Logger.log('[fetchTaskFlowData] TASKFLOW_API_URL not configured — returning []');
    return [];
  }
  try {
    var raw = _apiFetch_(url, token);
    // Normalise: ensure every row has bug_id
    return (Array.isArray(raw) ? raw : (raw.issues || raw.data || []))
      .map(function (r, i) {
        return {
          bug_id:      String(r.bug_id || r.id || r.bugId || ('tf-' + i)),
          title:       String(r.title || r.summary || r.subject || ''),
          priority:    String(r.priority || r.severity || '').toUpperCase(),
          status:      String(r.status || r.state || ''),
          owner:       String(r.owner || r.assignee || r.assigned_to || ''),
          created_at:  String(r.created_at || r.createdAt || r.date_opened || ''),
          slo_breach:  r.slo_breach === true || r.slo_breach === 'true' || r.sloBreach === true
                         ? 'Yes' : 'No',
          _source:     'taskflow'
        };
      });
  } catch (e) {
    Logger.log('[fetchTaskFlowData] ERROR: ' + e.message);
    return [];
  }
}

/**
 * Fetches financial / SLO data from the Plx / F1 REST endpoint.
 *
 * Expected API response: JSON array of objects with at minimum:
 *   bug_id, revenue_at_risk, slo_percent, region
 *
 * @return {Array<Object>}
 */
function fetchPlxData() {
  var url   = _runtimeProp_('PLX_API_URL')   || REPORTING_CONFIG.PLX_API_URL;
  var token = _runtimeProp_('PLX_API_TOKEN')  || '';
  if (!url) {
    Logger.log('[fetchPlxData] PLX_API_URL not configured — returning []');
    return [];
  }
  try {
    var raw = _apiFetch_(url, token);
    return (Array.isArray(raw) ? raw : (raw.rows || raw.data || []))
      .map(function (r) {
        return {
          bug_id:          String(r.bug_id || r.bugId || r.id || ''),
          revenue_at_risk: Number(r.revenue_at_risk || r.revenueAtRisk || r.arr || 0),
          slo_percent:     Number(r.slo_percent || r.sloPercent || r.slo || 0),
          region:          String(r.region || r.geo || '')
        };
      })
      .filter(function (r) { return r.bug_id; });
  } catch (e) {
    Logger.log('[fetchPlxData] ERROR: ' + e.message);
    return [];
  }
}

/**
 * Fetches escalation metadata from the Vector ID Database.
 *
 * Expected API response: JSON array of objects with at minimum:
 *   bug_id, vector_id, escalation_type, customer_name
 *
 * @return {Array<Object>}
 */
function fetchVectorIdData() {
  var url   = _runtimeProp_('VECTOR_ID_API_URL')   || REPORTING_CONFIG.VECTOR_ID_API_URL;
  var token = _runtimeProp_('VECTOR_ID_API_TOKEN')  || '';
  if (!url) {
    Logger.log('[fetchVectorIdData] VECTOR_ID_API_URL not configured — returning []');
    return [];
  }
  try {
    var raw = _apiFetch_(url, token);
    return (Array.isArray(raw) ? raw : (raw.records || raw.data || []))
      .map(function (r) {
        return {
          bug_id:          String(r.bug_id || r.bugId || r.id || ''),
          vector_id:       String(r.vector_id || r.vectorId || r.iem_escalation_number || ''),
          escalation_type: String(r.escalation_type || r.escalationType || r.type || ''),
          customer_name:   String(r.customer_name || r.customerName || r.customer || r.account || '')
        };
      })
      .filter(function (r) { return r.bug_id; });
  } catch (e) {
    Logger.log('[fetchVectorIdData] ERROR: ' + e.message);
    return [];
  }
}

/**
 * Merges all three data sources on bug_id (left-join: TaskFlow is primary).
 *
 * Rows from Plx or Vector that have no matching TaskFlow entry are appended
 * at the end with _source = 'unmatched', so nothing is silently dropped.
 *
 * @return {Array<Object>}  Rows conforming to REPORTING_CONFIG.MERGED_ROW_SCHEMA
 */
function mergeData() {
  var taskflow = fetchTaskFlowData();
  var plxRows  = fetchPlxData();
  var vecRows  = fetchVectorIdData();

  // Index secondary sources by bug_id for O(1) lookup
  var plxMap = {};
  plxRows.forEach(function (r) { plxMap[r.bug_id] = r; });

  var vecMap = {};
  vecRows.forEach(function (r) { vecMap[r.bug_id] = r; });

  // Build merged rows from TaskFlow (primary)
  var merged = taskflow.map(function (tf) {
    var plx = plxMap[tf.bug_id] || {};
    var vec = vecMap[tf.bug_id] || {};
    // Mark this bug_id as consumed so we can detect unmatched secondaries
    delete plxMap[tf.bug_id];
    delete vecMap[tf.bug_id];

    return _buildMergedRow_(tf, plx, vec, 'taskflow');
  });

  // Append unmatched Plx rows (not in TaskFlow)
  Object.keys(plxMap).forEach(function (id) {
    var plx = plxMap[id];
    var vec = vecMap[id] || {};
    delete vecMap[id];
    merged.push(_buildMergedRow_({ bug_id: id, _source: 'plx' }, plx, vec, 'unmatched'));
  });

  // Append unmatched Vector rows (not in TaskFlow or Plx)
  Object.keys(vecMap).forEach(function (id) {
    merged.push(_buildMergedRow_({ bug_id: id, _source: 'vector' }, {}, vecMap[id], 'unmatched'));
  });

  return merged;
}

/** Assembles a single merged row object respecting MERGED_ROW_SCHEMA order. */
function _buildMergedRow_(tf, plx, vec, sourceTag) {
  return {
    bug_id:          tf.bug_id          || '',
    vector_id:       vec.vector_id      || '',
    title:           tf.title           || '',
    priority:        tf.priority        || '',
    status:          tf.status          || '',
    owner:           tf.owner           || '',
    customer_name:   vec.customer_name  || '',
    escalation_type: vec.escalation_type || '',
    revenue_at_risk: plx.revenue_at_risk != null ? plx.revenue_at_risk : '',
    slo_percent:     plx.slo_percent    != null ? plx.slo_percent    : '',
    region:          plx.region         || '',
    created_at:      tf.created_at      || '',
    slo_breach:      tf.slo_breach      || '',
    _source:         sourceTag          || 'taskflow'
  };
}


// ════════════════════════════════════════════════════════════════════════════
// TASK 2 — APPSHEET SYNC (time-driven trigger)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Main trigger handler — called every 5 minutes by the time-driven trigger.
 * Fetches merged data and overwrites the target Google Sheet tab.
 *
 * Run this manually once from the GAS editor to test; use setupSyncTrigger()
 * to schedule it automatically.
 */
function syncToSheet() {
  var sheetId  = _runtimeProp_('REPORTING_SHEET_ID') || REPORTING_CONFIG.REPORTING_SHEET_ID;
  var tabName  = REPORTING_CONFIG.REPORTING_TAB_NAME  || 'Incidents';

  if (!sheetId) {
    Logger.log('[syncToSheet] REPORTING_SHEET_ID not configured — aborting.');
    return;
  }

  var rows   = mergeData();
  var schema = REPORTING_CONFIG.MERGED_ROW_SCHEMA;

  var ss    = SpreadsheetApp.openById(sheetId);
  var sheet = _getOrCreateTab_(ss, tabName);

  // Clear existing content (header + data)
  sheet.clearContents();

  if (rows.length === 0) {
    // Write header only so AppSheet doesn't lose its column definitions
    sheet.getRange(1, 1, 1, schema.length).setValues([schema]);
    Logger.log('[syncToSheet] No rows returned — wrote header only.');
    return;
  }

  // Build 2D array: [header, ...dataRows]
  var output = [schema].concat(
    rows.map(function (r) {
      return schema.map(function (col) {
        var v = r[col];
        return v === undefined || v === null ? '' : v;
      });
    })
  );

  sheet.getRange(1, 1, output.length, schema.length).setValues(output);

  // Freeze header row for readability
  sheet.setFrozenRows(1);

  // Stamp last-sync time in a named range / cell A1 comment for debugging
  sheet.getRange(1, 1).setNote('Last synced: ' + new Date().toISOString());

  Logger.log('[syncToSheet] Wrote ' + rows.length + ' rows to "' + tabName + '".');
}

/**
 * Creates a time-driven trigger that calls syncToSheet() every 5 minutes.
 * Safe to call multiple times — won't create duplicate triggers.
 *
 * Run this ONCE manually from the GAS editor (or deploy as an installable trigger).
 */
function setupSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncToSheet') {
      Logger.log('[setupSyncTrigger] Trigger already exists — nothing to do.');
      return;
    }
  }
  ScriptApp.newTrigger('syncToSheet')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('[setupSyncTrigger] Trigger created: syncToSheet every 5 minutes.');
}

/**
 * Removes all syncToSheet triggers (useful when changing cadence or disabling sync).
 */
function deleteSyncTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed  = 0;
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'syncToSheet') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  Logger.log('[deleteSyncTriggers] Removed ' + removed + ' trigger(s).');
}


// ════════════════════════════════════════════════════════════════════════════
// TASK 3 — FRONTEND DATA API
// ════════════════════════════════════════════════════════════════════════════

/**
 * Called by the frontend via google.script.run.getReportingData().
 *
 * Reads from the synced Google Sheet for fast response (avoids re-fetching
 * all three APIs on every page load).  Falls back to live mergeData() if the
 * sheet is not configured.
 *
 * @return {{ rows: Array<Object>, lastSynced: string, schema: Array<string> }}
 */
function getReportingData() {
  try {
    var sheetId = _runtimeProp_('REPORTING_SHEET_ID') || REPORTING_CONFIG.REPORTING_SHEET_ID;
    var tabName = REPORTING_CONFIG.REPORTING_TAB_NAME || 'Incidents';

    if (sheetId) {
      // Fast path: read the pre-merged sheet
      var ss      = SpreadsheetApp.openById(sheetId);
      var sheet   = ss.getSheetByName(tabName);
      if (sheet && sheet.getLastRow() > 1) {
        var values  = sheet.getDataRange().getValues();
        var headers = values[0];
        var rows    = values.slice(1).map(function (row) {
          var obj = {};
          headers.forEach(function (h, i) { obj[h] = row[i] !== undefined ? String(row[i]) : ''; });
          return obj;
        });
        var lastSynced = sheet.getRange(1, 1).getNote() || '';
        return { ok: true, rows: rows, lastSynced: lastSynced, schema: headers };
      }
    }

    // Fallback: live merge (slower but always works)
    var rows = mergeData();
    return {
      ok:         true,
      rows:       rows,
      lastSynced: new Date().toISOString(),
      schema:     REPORTING_CONFIG.MERGED_ROW_SCHEMA
    };

  } catch (e) {
    return { ok: false, rows: [], error: e.message || String(e) };
  }
}


// ════════════════════════════════════════════════════════════════════════════
// TASK 4 — LLM → GOOGLE SLIDES MBR
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generates the Monthly Business Review (MBR) by:
 *   1. Computing monthly stats from the merged dataset
 *   2. Calling the LLM API for AI-written insights
 *   3. Replacing {{placeholders}} in the Google Slides MBR template
 *
 * Called from the frontend via google.script.run.generateMBR()
 * or manually from the GAS editor for testing.
 *
 * @return {{ ok: boolean, slidesUrl: string, error: string|undefined }}
 */
function generateMBR() {
  try {
    var slidesId = _runtimeProp_('SLIDES_TEMPLATE_ID') || REPORTING_CONFIG.SLIDES_TEMPLATE_ID;
    if (!slidesId) throw new Error('SLIDES_TEMPLATE_ID is not configured.');

    // Step 1: aggregate stats
    var stats = computeMonthlyStats();

    // Step 2: call LLM
    var insights = callLlmApi_(stats);

    // Step 3: update slides
    updateSlides_(slidesId, stats, insights);

    var slidesUrl = 'https://docs.google.com/presentation/d/' + slidesId;
    Logger.log('[generateMBR] Done. Slides: ' + slidesUrl);
    return { ok: true, slidesUrl: slidesUrl };

  } catch (e) {
    Logger.log('[generateMBR] ERROR: ' + e.message);
    return { ok: false, error: e.message || String(e) };
  }
}

/**
 * Computes aggregate monthly stats from the merged dataset.
 * Scoped to the current calendar month (UTC).
 *
 * @return {{ totalP0: number, totalActive: number, sloPercent: number,
 *            revenueAtRisk: number, topCustomer: string, reportMonth: string }}
 */
function computeMonthlyStats() {
  var rows = mergeData();

  var now       = new Date();
  var monthStr  = Utilities.formatDate(now, 'UTC', 'yyyy-MM');  // e.g. "2025-05"

  // Filter to current month's rows (created_at starts with yyyy-MM)
  var monthRows = rows.filter(function (r) {
    return r.created_at && String(r.created_at).indexOf(monthStr) === 0;
  });

  // Fallback: use all rows if none fall in current month (e.g. during first-run / mock)
  var sample = monthRows.length ? monthRows : rows;

  var totalP0     = sample.filter(function (r) { return r.priority === 'P0'; }).length;
  var activeRows  = sample.filter(function (r) { return r.status !== 'Closed' && r.status !== 'Resolved'; });

  // Average SLO percent across rows that have it
  var sloValues = sample
    .map(function (r) { return parseFloat(r.slo_percent); })
    .filter(function (v) { return !isNaN(v); });
  var avgSlo = sloValues.length
    ? (sloValues.reduce(function (a, b) { return a + b; }, 0) / sloValues.length)
    : 0;

  // Sum revenue at risk
  var totalRevenue = sample.reduce(function (sum, r) {
    var v = parseFloat(r.revenue_at_risk);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  // Top customer by incident count
  var customerCounts = {};
  sample.forEach(function (r) {
    if (r.customer_name) {
      customerCounts[r.customer_name] = (customerCounts[r.customer_name] || 0) + 1;
    }
  });
  var topCustomer = Object.keys(customerCounts).sort(function (a, b) {
    return customerCounts[b] - customerCounts[a];
  })[0] || 'N/A';

  return {
    totalP0:        totalP0,
    totalActive:    activeRows.length,
    totalIncidents: sample.length,
    sloPercent:     Math.round(avgSlo * 100) / 100,
    revenueAtRisk:  Math.round(totalRevenue),
    topCustomer:    topCustomer,
    reportMonth:    Utilities.formatDate(now, 'UTC', 'MMMM yyyy')
  };
}

/**
 * Sends monthly stats to the configured LLM API and returns the insights text.
 *
 * @param  {Object} stats  Output of computeMonthlyStats()
 * @return {string}        AI-generated insights paragraph
 */
function callLlmApi_(stats) {
  var apiKey  = _runtimeProp_('LLM_API_KEY') || '';
  var apiUrl  = _runtimeProp_('LLM_API_URL') || REPORTING_CONFIG.LLM_API_URL;
  var model   = REPORTING_CONFIG.LLM_MODEL;

  if (!apiKey) {
    Logger.log('[callLlmApi_] LLM_API_KEY not set — returning placeholder text.');
    return '(LLM_API_KEY not configured. Set it in Script Properties to enable AI insights.)';
  }

  var prompt = REPORTING_CONFIG.LLM_PROMPT_TEMPLATE
    .replace('{{STATS_JSON}}', JSON.stringify(stats, null, 2));

  // Anthropic Messages API format
  var payload = {
    model:      model,
    max_tokens: 600,
    messages: [
      { role: 'user', content: prompt }
    ]
  };

  var resp = UrlFetchApp.fetch(apiUrl, {
    method:          'post',
    contentType:     'application/json',
    headers: {
      'x-api-key':        apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error('LLM API returned HTTP ' + code + ': ' + resp.getContentText().slice(0, 200));
  }

  var body = JSON.parse(resp.getContentText());

  // Claude Messages API: body.content[0].text
  if (body.content && body.content[0] && body.content[0].text) {
    return body.content[0].text.trim();
  }
  // OpenAI-compat fallback
  if (body.choices && body.choices[0]) {
    return (body.choices[0].message || body.choices[0]).content || '';
  }
  // Legacy completions fallback
  return body.completion || body.text || '';
}

/**
 * Opens the Slides template and replaces all {{placeholders}} with computed values.
 *
 * Placeholders expected in the template:
 *   {{Report_Month}}     — e.g. "May 2025"
 *   {{Total_P0}}         — integer count
 *   {{Total_Active}}     — integer count of non-closed incidents
 *   {{SLO_Percent}}      — decimal, e.g. "99.85"
 *   {{Revenue_At_Risk}}  — formatted string, e.g. "$2.4M"
 *   {{Top_Customer}}     — customer name string
 *   {{Insights}}         — full LLM-generated text block
 *
 * @param {string} slidesId  Google Slides presentation ID
 * @param {Object} stats     Output of computeMonthlyStats()
 * @param {string} insights  Output of callLlmApi_()
 */
function updateSlides_(slidesId, stats, insights) {
  var pres = SlidesApp.openById(slidesId);

  var replacements = {
    '{{Report_Month}}':    stats.reportMonth,
    '{{Total_P0}}':        String(stats.totalP0),
    '{{Total_Active}}':    String(stats.totalActive),
    '{{SLO_Percent}}':     String(stats.sloPercent) + '%',
    '{{Revenue_At_Risk}}': _formatRevenue_(stats.revenueAtRisk),
    '{{Top_Customer}}':    stats.topCustomer,
    '{{Insights}}':        insights
  };

  Object.keys(replacements).forEach(function (placeholder) {
    pres.replaceAllText(placeholder, replacements[placeholder]);
  });

  pres.saveAndClose();
}


// ════════════════════════════════════════════════════════════════════════════
// SHARED INTERNAL HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Reads a value from Script Properties (runtime override).
 * Returns null if the property is not set or PropertiesService is unavailable.
 *
 * @param  {string} key
 * @return {string|null}
 */
function _runtimeProp_(key) {
  try {
    return PropertiesService.getScriptProperties().getProperty(key) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Makes an authenticated GET request and parses the JSON response.
 * Throws on non-200 status.
 *
 * @param  {string} url
 * @param  {string} token  Bearer token (pass '' to skip Authorization header)
 * @return {*}  Parsed JSON
 */
function _apiFetch_(url, token) {
  var options = { muteHttpExceptions: true };
  if (token) options.headers = { Authorization: 'Bearer ' + token };

  var resp = UrlFetchApp.fetch(url, options);
  var code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error('API ' + url + ' returned HTTP ' + code);
  }
  return JSON.parse(resp.getContentText());
}

/**
 * Returns or creates a sheet tab by name inside the given Spreadsheet.
 *
 * @param  {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param  {string} tabName
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function _getOrCreateTab_(ss, tabName) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    Logger.log('[_getOrCreateTab_] Created new tab: ' + tabName);
  }
  return sheet;
}

/**
 * Formats a raw dollar amount into a compact string.
 * e.g. 2400000 → "$2.4M",  45000 → "$45K",  500 → "$500"
 *
 * @param  {number} amount
 * @return {string}
 */
function _formatRevenue_(amount) {
  if (!amount || isNaN(amount)) return '$0';
  var n = Number(amount);
  if (n >= 1e6)  return '$' + (Math.round(n / 1e5) / 10).toFixed(1) + 'M';
  if (n >= 1e3)  return '$' + Math.round(n / 1e3) + 'K';
  return '$' + Math.round(n);
}
