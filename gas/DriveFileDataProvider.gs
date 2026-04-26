// Reads an Excel (.xlsx) file from Google Drive by converting it to a
// temporary Google Sheet, then delegating to SheetDataProvider logic.

var DriveFileDataProvider = (function () {

  function _openAsSheet() {
    var file = DriveApp.getFileById(INCIDENT_CONFIG.EXCEL_FILE_ID);
    var converted = Drive.Files.copy(
      { title: '_tmp_incident_import', mimeType: MimeType.GOOGLE_SHEETS },
      file.getId()
    );
    return SpreadsheetApp.openById(converted.id);
  }

  function _getValues(sheetName) {
    var ss = _openAsSheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    var values = sheet.getDataRange().getValues();
    // Clean up the temporary file
    DriveApp.getFileById(ss.getId()).setTrashed(true);
    return values;
  }

  function getIncidents() {
    var values = _getValues(INCIDENT_CONFIG.INCIDENTS_SHEET_NAME);
    return Mappers.sheetToObjects(values).map(Mappers.toIncident);
  }

  function getOnCallPersonnel() {
    var values = _getValues(INCIDENT_CONFIG.ONCALL_SHEET_NAME);
    if (!values.length) return MockDataProvider.getOnCallPersonnel();
    return Mappers.sheetToObjects(values).map(Mappers.toOnCallPerson);
  }

  function getCommunicationLog(incidentId) {
    var values = _getValues(INCIDENT_CONFIG.COMMS_LOG_SHEET_NAME);
    if (!values.length) return MockDataProvider.getCommunicationLog(incidentId);
    return Mappers.sheetToObjects(values)
      .map(Mappers.toCommsLogEntry)
      .filter(function (e) { return e.incidentId === incidentId; });
  }

  return { getIncidents: getIncidents, getOnCallPersonnel: getOnCallPersonnel, getCommunicationLog: getCommunicationLog };
})();
