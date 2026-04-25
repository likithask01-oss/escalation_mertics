// Reads a CSV file from Google Drive. The file must have an Incidents sheet
// encoded as CSV. OnCall and CommsLog fall back to mock data when not available.

var CsvDataProvider = (function () {

  function _getCsvText(fileId) {
    var file = DriveApp.getFileById(fileId);
    return file.getBlob().getDataAsString();
  }

  function getIncidents() {
    var text = _getCsvText(INCIDENT_CONFIG.CSV_FILE_ID);
    return Mappers.csvToObjects(text).map(Mappers.toIncident);
  }

  function getOnCallPersonnel() {
    return MockDataProvider.getOnCallPersonnel();
  }

  function getCommunicationLog(incidentId) {
    return MockDataProvider.getCommunicationLog(incidentId);
  }

  return { getIncidents: getIncidents, getOnCallPersonnel: getOnCallPersonnel, getCommunicationLog: getCommunicationLog };
})();
