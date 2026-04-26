// Entry point for the Apps Script web app.

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.logoUrl  = getLogoUrl();
  template.userName = getUserDisplayName_();
  return template
    .evaluate()
    .setTitle('IEM Escalations Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Allows Index.html to pull in Styles.html and ClientScript.html as partials.
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Returns the team logo as a base64 data URL for inline embedding.
// Requires LOGO_FILE_ID to be set in Config.gs.
function getLogoUrl() {
  try {
    var id = INCIDENT_CONFIG.LOGO_FILE_ID;
    if (!id) return '';
    var blob = DriveApp.getFileById(id).getBlob();
    var mime = blob.getContentType() || 'image/png';
    return 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    return '';
  }
}

// Returns display name for the active user (used as a template variable).
function getUserDisplayName_() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) return '';
    var local  = email.split('@')[0];
    var parts  = local.replace(/[._-]/g, ' ').split(' ').filter(Boolean);
    return parts.map(function (p) {
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    }).join(' ');
  } catch (e) {
    return '';
  }
}
