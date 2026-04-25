// Converts external row formats (Sheets, CSV, Excel) into the internal data model.

var Mappers = (function () {

  // Maps a raw sheet/CSV row to the internal incident shape.
  // Accepts both camelCase column names and human-readable headers.
  function toIncident(row, index) {
    return {
      id:            row['id']            || row['ID']                               || ('inc-ext-' + index),
      category:      row['category']      || row['Category']                         || 'CMI',
      requestingPoc: row['requestingPoc'] || row['Requesting POC']                   || '',
      ticketId:      row['ticketId']      || row['IEM Bug/Vector Case']              || row['Ticket ID'] || '',
      productArea:   row['productArea']   || row['Product Area']                     || '',
      severity:      row['severity']      || row['Severity']                         || '',
      status:        row['status']        || row['Status']                           || '',
      customerName:  row['customerName']  || row['Customer Name']                    || '',
      issueDetails:  row['issueDetails']  || row['Customer Service Level / Issue Details'] || row['Issue Details'] || '',
      createdAt:     row['createdAt']     || row['Created At']                       || new Date().toISOString(),
      updatedAt:     row['updatedAt']     || row['Updated At']                       || new Date().toISOString()
    };
  }

  function toOnCallPerson(row, index) {
    return {
      id:            row['id']            || ('oc-ext-' + index),
      role:          row['role']          || row['Role']          || '',
      name:          row['name']          || row['Name']          || '',
      contactMethod: row['contactMethod'] || row['Contact Method']|| 'phone',
      status:        row['status']        || row['Status']        || 'available',
      timezone:      row['timezone']      || row['Timezone']      || 'US/Pacific'
    };
  }

  function toCommsLogEntry(row, index) {
    return {
      id:         row['id']         || ('log-ext-' + index),
      incidentId: row['incidentId'] || row['Incident ID'] || '',
      timestamp:  row['timestamp']  || row['Timestamp']   || new Date().toISOString(),
      author:     row['author']     || row['Author']      || '',
      message:    row['message']    || row['Message']     || '',
      audience:   row['audience']   || row['Audience']    || 'IEM'
    };
  }

  // Converts a 2-D array (from Sheets.getValues()) into an array of plain objects
  // using the first row as headers.
  function sheetToObjects(values) {
    if (!values || values.length < 2) return [];
    var headers = values[0];
    return values.slice(1).map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) {
        obj[h] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    });
  }

  // Parses a CSV string into an array of plain objects.
  function csvToObjects(csvText) {
    var lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    var headers = lines[0].split(',').map(function (h) { return h.trim().replace(/^"|"$/g, ''); });
    return lines.slice(1).map(function (line) {
      var values = line.split(',').map(function (v) { return v.trim().replace(/^"|"$/g, ''); });
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = values[i] || ''; });
      return obj;
    });
  }

  return { toIncident: toIncident, toOnCallPerson: toOnCallPerson, toCommsLogEntry: toCommsLogEntry, sheetToObjects: sheetToObjects, csvToObjects: csvToObjects };
})();
