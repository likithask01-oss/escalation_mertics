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
