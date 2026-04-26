// Entry point for the Apps Script web app.

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  return template
    .evaluate()
    .setTitle('Critical Incidents and Escalations Comms Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Allows Index.html to pull in Styles.html and ClientScript.html as partials.
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
