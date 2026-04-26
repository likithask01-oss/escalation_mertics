var MockDataProvider = (function () {

  var INCIDENTS = [
    // ── CMI ──────────────────────────────────────────────────────────────
    {
      id: 'inc-001',
      category: 'CMI',
      requestingPoc: 'Bhushan K',
      ticketId: 'OMG/2345',
      productArea: 'Compute',
      severity: 'Huge',
      status: 'Monitoring',
      customerName: 'VPC',
      issueDetails: 'GLOBAL',
      createdAt: _daysAgo(0, 2),
      updatedAt: _daysAgo(0, 1)
    },
    {
      id: 'inc-002',
      category: 'CMI',
      requestingPoc: 'Saurabh M',
      ticketId: 'OMG/2346',
      productArea: 'Networking',
      severity: 'Major',
      status: 'Investigating',
      customerName: 'Cloud Interconnect',
      issueDetails: 'US-EAST4',
      createdAt: _daysAgo(1, 4),
      updatedAt: _daysAgo(0, 3)
    },
    {
      id: 'inc-003',
      category: 'CMI',
      requestingPoc: 'Aminisha R',
      ticketId: 'OMG/2341',
      productArea: 'Storage',
      severity: 'P0',
      status: 'Fixed',
      customerName: 'GCS',
      issueDetails: 'EU-WEST1',
      createdAt: _daysAgo(3, 6),
      updatedAt: _daysAgo(2, 1)
    },
    {
      id: 'inc-004',
      category: 'CMI',
      requestingPoc: 'Likitha K',
      ticketId: 'OMG/2338',
      productArea: 'Databases',
      severity: 'P1',
      status: 'Closed',
      customerName: 'Cloud SQL',
      issueDetails: 'ASIA-SOUTHEAST1',
      createdAt: _daysAgo(5, 8),
      updatedAt: _daysAgo(4, 2)
    },

    // ── EXEC_ESCALATIONS ─────────────────────────────────────────────────
    {
      id: 'inc-005',
      category: 'EXEC_ESCALATIONS',
      requestingPoc: 'Bhushan K',
      ticketId: 'OMG/2345',
      productArea: 'Compute',
      severity: 'Huge',
      status: 'Monitoring',
      customerName: 'VPC',
      issueDetails: 'GLOBAL',
      createdAt: _daysAgo(0, 2),
      updatedAt: _daysAgo(0, 1)
    },
    {
      id: 'inc-006',
      category: 'EXEC_ESCALATIONS',
      requestingPoc: 'Pravil S',
      ticketId: 'OMG/2350',
      productArea: 'BigQuery',
      severity: 'P0',
      status: 'Customer Update Pending',
      customerName: 'FinanceCo',
      issueDetails: 'US-CENTRAL1',
      createdAt: _daysAgo(1, 5),
      updatedAt: _daysAgo(0, 2)
    },
    {
      id: 'inc-007',
      category: 'EXEC_ESCALATIONS',
      requestingPoc: 'Pnmuley G',
      ticketId: 'OMG/2347',
      productArea: 'GKE',
      severity: 'Huge',
      status: 'Investigating',
      customerName: 'RetailMax',
      issueDetails: 'EU-WEST2',
      createdAt: _daysAgo(2, 3),
      updatedAt: _daysAgo(1, 1)
    },
    {
      id: 'inc-008',
      category: 'EXEC_ESCALATIONS',
      requestingPoc: 'Benson A',
      ticketId: 'OMG/2340',
      productArea: 'Pub/Sub',
      severity: 'P1',
      status: 'Fixed',
      customerName: 'StreamCorp',
      issueDetails: 'US-WEST1',
      createdAt: _daysAgo(4, 7),
      updatedAt: _daysAgo(3, 2)
    },

    // ── OTHER_P0_P1_ESCALATIONS ───────────────────────────────────────────
    {
      id: 'inc-009',
      category: 'OTHER_P0_P1_ESCALATIONS',
      requestingPoc: 'Saurabh M',
      ticketId: 'OMG/2352',
      productArea: 'App Engine',
      severity: 'P0',
      status: 'Investigating',
      customerName: 'HealthTech',
      issueDetails: 'US-EAST1',
      createdAt: _daysAgo(0, 1),
      updatedAt: _daysAgo(0, 0)
    },
    {
      id: 'inc-010',
      category: 'OTHER_P0_P1_ESCALATIONS',
      requestingPoc: 'Likitha K',
      ticketId: 'OMG/2349',
      productArea: 'Cloud Run',
      severity: 'P1',
      status: 'Monitoring',
      customerName: 'LogiCo',
      issueDetails: 'ASIA-EAST1',
      createdAt: _daysAgo(1, 3),
      updatedAt: _daysAgo(0, 4)
    },
    {
      id: 'inc-011',
      category: 'OTHER_P0_P1_ESCALATIONS',
      requestingPoc: 'Aminisha R',
      ticketId: 'OMG/2344',
      productArea: 'Spanner',
      severity: 'P0',
      status: 'Closed',
      customerName: 'BankGroup',
      issueDetails: 'US-CENTRAL1',
      createdAt: _daysAgo(6, 9),
      updatedAt: _daysAgo(5, 2)
    }
  ];

  var ON_CALL = [
    { id: 'oc-001', role: 'IEM ONCALL',      name: 'pravil',  contactMethod: 'phone', status: 'available', timezone: 'US/Pacific' },
    { id: 'oc-002', role: 'IEM CMIC ONCALL', name: 'pnmuley', contactMethod: 'phone', status: 'available', timezone: 'US/Pacific' }
  ];

  var COMMS_LOG = [
    // For inc-001 / inc-005 (same OMG)
    { id: 'log-001', incidentId: 'inc-001', timestamp: _daysAgo(0, 2), author: 'system-bot',   message: 'Incident opened. Initial triage in progress.', audience: 'IEM' },
    { id: 'log-002', incidentId: 'inc-001', timestamp: _daysAgo(0, 1.5), author: 'IEM Desk', message: 'Executive comms bridge opened. VP Engineering notified.', audience: 'Executive' },
    { id: 'log-003', incidentId: 'inc-001', timestamp: _daysAgo(0, 1), author: 'MIM-ADMIN-01', message: 'Latency spike traced to misconfigured VPC peering route. Rollback initiated.', audience: 'IEM' },
    { id: 'log-004', incidentId: 'inc-001', timestamp: _daysAgo(0, 0.5), author: 'MIM-ADMIN-01', message: 'Rollback 80% complete. Latency returning to baseline. Monitoring for full recovery.', audience: 'Executive' },

    // For inc-005 (same messages, different incidentId key)
    { id: 'log-005', incidentId: 'inc-005', timestamp: _daysAgo(0, 2), author: 'system-bot', message: 'Incident opened. Initial triage in progress.', audience: 'IEM' },
    { id: 'log-006', incidentId: 'inc-005', timestamp: _daysAgo(0, 1), author: 'IEM Desk', message: 'Executive bridge live. CTO looped in via exec comms channel.', audience: 'Executive' },
    { id: 'log-007', incidentId: 'inc-005', timestamp: _daysAgo(0, 0.5), author: 'MIM-ADMIN-01', message: 'Mitigation 80% complete. Monitoring.', audience: 'Executive' },

    { id: 'log-008', incidentId: 'inc-006', timestamp: _daysAgo(1, 5), author: 'system-bot', message: 'BigQuery query failure rate elevated above SLO threshold.', audience: 'IEM' },
    { id: 'log-009', incidentId: 'inc-006', timestamp: _daysAgo(1, 3), author: 'IEM Desk', message: 'Exec notified. Customer FinanceCo CSM engaged for update.', audience: 'Customer' },

    { id: 'log-010', incidentId: 'inc-009', timestamp: _daysAgo(0, 1), author: 'system-bot', message: 'App Engine deploy failure affecting us-east1. Auto-rollback triggered.', audience: 'IEM' }
  ];

  // ── Private helpers ─────────────────────────────────────────────────────

  function _daysAgo(days, hours) {
    var d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(d.getHours() - (hours || 0));
    return d.toISOString();
  }

  // ── Public interface ────────────────────────────────────────────────────

  return {
    getIncidents: function () {
      return INCIDENTS;
    },
    getOnCallPersonnel: function () {
      return ON_CALL;
    },
    getCommunicationLog: function (incidentId) {
      return COMMS_LOG.filter(function (entry) {
        return entry.incidentId === incidentId;
      });
    }
  };
})();
