// Fetches incident data from an external REST API.
// The API must return JSON arrays shaped like the internal data model,
// or close enough for Mappers to normalise.

var ApiDataProvider = (function () {

  function _fetch(path) {
    var apiKey = PropertiesService.getScriptProperties()
      .getProperty(INCIDENT_CONFIG.API_KEY_PROPERTY_NAME);
    var url = INCIDENT_CONFIG.API_BASE_URL + path;
    var options = {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' },
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      throw new Error('API error ' + response.getResponseCode() + ': ' + response.getContentText());
    }
    return JSON.parse(response.getContentText());
  }

  function getIncidents() {
    return _fetch('/incidents').map(Mappers.toIncident);
  }

  function getOnCallPersonnel() {
    return _fetch('/oncall').map(Mappers.toOnCallPerson);
  }

  function getCommunicationLog(incidentId) {
    return _fetch('/comms?incidentId=' + encodeURIComponent(incidentId)).map(Mappers.toCommsLogEntry);
  }

  return { getIncidents: getIncidents, getOnCallPersonnel: getOnCallPersonnel, getCommunicationLog: getCommunicationLog };
})();
