var SheetDataProvider = (function () {

  function _getSheet(name) {
    var ss = SpreadsheetApp.openById(INCIDENT_CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error('Sheet not found: ' + name);
    return sheet;
  }

  function getIncidents() {
    var values = _getSheet(INCIDENT_CONFIG.INCIDENTS_SHEET_NAME).getDataRange().getValues();
    return Mappers.sheetToObjects(values).map(Mappers.toIncident);
  }

  function getOnCallPersonnel() {
    var values = _getSheet(INCIDENT_CONFIG.ONCALL_SHEET_NAME).getDataRange().getValues();
    return Mappers.sheetToObjects(values).map(Mappers.toOnCallPerson);
  }

  function getCommunicationLog(incidentId) {
    var values = _getSheet(INCIDENT_CONFIG.COMMS_LOG_SHEET_NAME).getDataRange().getValues();
    return Mappers.sheetToObjects(values)
      .map(Mappers.toCommsLogEntry)
      .filter(function (e) { return e.incidentId === incidentId; });
  }

  return { getIncidents: getIncidents, getOnCallPersonnel: getOnCallPersonnel, getCommunicationLog: getCommunicationLog };
})();
