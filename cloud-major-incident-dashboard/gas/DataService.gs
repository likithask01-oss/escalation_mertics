// Public API called by the frontend via google.script.run

function getDashboardData() {
  var provider = getIncidentProvider_();
  return {
    incidents:    provider.getIncidents(),
    onCall:       provider.getOnCallPersonnel(),
    systemHealth: getSystemHealth_()
  };
}

function getCommunicationLog(incidentId) {
  return getIncidentProvider_().getCommunicationLog(incidentId);
}

// Internal helpers --------------------------------------------------------

function getIncidentProvider_() {
  switch (INCIDENT_CONFIG.DATA_SOURCE) {
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
