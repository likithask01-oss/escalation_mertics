// ── Unified Reporting Ecosystem — Configuration ──────────────────────────────
//
// All values here are COMPILE-TIME DEFAULTS.
// Override any of them at runtime via PropertiesService.getScriptProperties()
// so you never need to redeploy when endpoints or IDs change.
//
// Script Properties that take precedence (set in GAS editor → Project Settings):
//   TASKFLOW_API_URL, TASKFLOW_API_TOKEN
//   PLX_API_URL,      PLX_API_TOKEN
//   VECTOR_ID_API_URL, VECTOR_ID_API_TOKEN
//   REPORTING_SHEET_ID
//   SLIDES_TEMPLATE_ID
//   LLM_API_KEY
//   LLM_API_URL  (if using a non-Anthropic endpoint)
// ─────────────────────────────────────────────────────────────────────────────

var REPORTING_CONFIG = {

  // ── Task 1: Data source endpoints ────────────────────────────────────────
  // TaskFlow / Buganizer JSON API
  // Expected response shape: Array<{ bug_id, title, priority, status, owner,
  //                                   created_at, slo_breach }>
  TASKFLOW_API_URL: '',

  // Plx / F1 REST endpoint
  // Expected response shape: Array<{ bug_id, revenue_at_risk, slo_percent, region }>
  PLX_API_URL: '',

  // Vector ID Database REST endpoint
  // Expected response shape: Array<{ bug_id, vector_id, escalation_type, customer_name }>
  VECTOR_ID_API_URL: '',

  // ── Task 2: AppSheet sync target ─────────────────────────────────────────
  // Google Spreadsheet ID that AppSheet reads from.
  // syncToSheet() will write merged incident data here every 5 minutes.
  REPORTING_SHEET_ID: '',

  // Tab name inside REPORTING_SHEET_ID where rows are written.
  // Created automatically by syncToSheet() if it does not exist.
  REPORTING_TAB_NAME: 'Incidents',

  // ── Task 4: LLM → Google Slides MBR ─────────────────────────────────────
  // Google Slides presentation ID used as the MBR template.
  // Placeholders in the deck: {{Report_Month}}, {{Total_P0}},
  //   {{SLO_Percent}}, {{Revenue_At_Risk}}, {{Insights}}
  SLIDES_TEMPLATE_ID: '',

  // LLM API endpoint (Anthropic Claude by default; swap for any OpenAI-compat endpoint).
  LLM_API_URL: 'https://api.anthropic.com/v1/messages',

  // Model identifier forwarded in the LLM request body.
  LLM_MODEL: 'claude-3-5-haiku-20241022',

  // Prompt template — {{STATS_JSON}} is replaced at runtime with the
  // JSON-serialised monthly stats object before the API call.
  LLM_PROMPT_TEMPLATE: [
    'You are a senior SRE analyst writing a Monthly Business Review (MBR) slide for',
    'senior leadership. Given the incident statistics below, write:',
    '  1. A 3-sentence executive summary of service health this month.',
    '  2. Three concise, actionable recommendations (each ≤ 20 words).',
    'Be direct and data-driven. Do not use filler phrases.',
    '',
    'Stats (JSON):',
    '{{STATS_JSON}}',
    '',
    'Respond in plain text with two sections labelled "Summary:" and "Recommendations:".'
  ].join('\n'),

  // ── Merged row schema ────────────────────────────────────────────────────
  // Defines the column order written to the sync sheet (and served to the frontend).
  // Add / remove fields here; syncToSheet() and the frontend both respect this order.
  MERGED_ROW_SCHEMA: [
    'bug_id',
    'vector_id',
    'title',
    'priority',
    'status',
    'owner',
    'customer_name',
    'escalation_type',
    'revenue_at_risk',
    'slo_percent',
    'region',
    'created_at',
    'slo_breach',
    '_source'
  ]
};
