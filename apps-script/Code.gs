/**
 * Headset HID check: results log backend.
 *
 * Receives reports from the Headset HID check page and stores them:
 *   - one row per report in the "Reports" sheet of the spreadsheet this script is bound to
 *     (later saves of the same report update that row instead of adding a new one)
 *   - the full HTML report as a file in the "Headset HID reports" Drive folder (private to you)
 *
 * Setup: open the Google Sheet, Extensions > Apps Script, paste this file, save,
 * then Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
 * Copy the Web app URL (ending in /exec) into SAVE_URL in index.html.
 */

const SHEET_NAME = 'Reports';
const FOLDER_NAME = 'Headset HID reports';
const MAX_BYTES = 4 * 1024 * 1024;   // reject anything bigger than 4 MB
const MAX_CELL = 45000;              // Sheets allows 50,000 characters per cell

const HEADERS = [
  'Saved at', 'Report ID', 'Saved by action', 'Tested at',
  'Tester (name and company)', 'Send to', 'Case or ticket', 'Platform',
  'Browser', 'Browser version', 'OS', 'Browser allows WebHID',
  'Headset', 'Vendor', 'VID', 'PID', 'Headset works with WebHID',
  'Telephony collection', 'Call button reported', 'Mute reported', 'Volume reported',
  'In-call LED output', 'Ring output', 'Mute LED output',
  'Answer here', 'Hang up here', 'Mute here', 'Volume up here', 'Volume down here', 'Remote call control',
  'Platform answer', 'Platform hang up', 'Platform mute', 'Platform volume',
  'Diagnosis', 'Diagnosis detail', 'Notes', 'Report file', 'Report file ID', 'User agent', 'Tool URL',
  // Added later; kept at the end so existing sheets stay aligned.
  'Platform HID pairing', 'Platform rings', 'Platform lights in sync', 'Platform audio',
  'Headset rang here', 'In-call light here', 'Mute light here'
];
const COL_ID = HEADERS.indexOf('Report ID') + 1;
const COL_FILE = HEADERS.indexOf('Report file') + 1;
const COL_FILE_ID = HEADERS.indexOf('Report file ID') + 1;

function doGet() {
  return json_({ ok: true, service: 'Headset HID check results log' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw) return json_({ ok: false, error: 'Empty request' });
    if (raw.length > MAX_BYTES) return json_({ ok: false, error: 'Report is too large' });

    let body;
    try { body = JSON.parse(raw); } catch (err) { return json_({ ok: false, error: 'Request is not JSON' }); }
    const r = body && body.report;
    const id = String((body && body.id) || '');
    if (!r || r.tool !== 'Headset HID check' || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
      return json_({ ok: false, error: 'Not a Headset HID check report' });
    }

    lock.waitLock(20000);
    locked = true;

    const sheet = sheet_();
    const rowNum = findRow_(sheet, id);
    let fileId = rowNum ? String(sheet.getRange(rowNum, COL_FILE_ID).getValue() || '') : '';
    let fileUrl = rowNum ? String(sheet.getRange(rowNum, COL_FILE).getValue() || '') : '';

    if (typeof body.html === 'string' && body.html.length) {
      let file = null;
      if (fileId) {
        try { file = DriveApp.getFileById(fileId); file.setContent(body.html); } catch (err) { file = null; }
      }
      if (!file) file = folder_().createFile(fileName_(r, id), body.html, MimeType.HTML);
      fileId = file.getId();
      fileUrl = file.getUrl();
    }

    const row = buildRow_(r, id, String(body.trigger || ''), fileUrl, fileId);
    if (rowNum) sheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);

    return json_({ ok: true, id: id, updated: !!rowNum });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (err) {} }
  }
}

function buildRow_(r, id, trigger, fileUrl, fileId) {
  const b = r.browser || {};
  const h = r.headset || null;
  const c = (h && h.capabilities) || {};
  const cc = r.callControl || null;
  const t = (cc && cc.tests) || {};
  const pc = r.platformCheck || {};
  const pr = pc.results || {};
  const d = pc.diagnosis || {};
  const yn = v => (v === true ? 'Yes' : v === false ? 'No' : '');
  const ynh = v => (h ? yn(!!v) : '');
  const pt = v => (v === 'works' ? 'Works' : v === 'fails' ? "Doesn't work" : 'Not tried');
  const pairing = v => ({ paired: 'Listed and paired', 'pair-failed': 'Listed, pairing failed', 'not-listed': 'Not listed' })[v] || 'Not checked';
  const cf = (cc && cc.confirmed) || {};
  const seen = v => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : (h ? 'Not checked' : ''));
  const verdict = v => (v && v.pill) || '';
  const values = [
    new Date(), id, trigger, r.testedAt ? new Date(r.testedAt) : '',
    pc.tester, pc.sendTo, pc.ticket, pc.platform,
    b.name, b.version, b.os, verdict(b.verdict),
    h ? h.name : '', h ? h.vendor : '', h ? h.vendorId : '', h ? h.productId : '', h ? verdict(h.verdict) : 'Not tested',
    ynh(c.telephony), ynh(c.hook), ynh(c.mute), ynh(c.vol),
    ynh(c.ledOffHook), ynh(c.ledRing), ynh(c.ledMute),
    ynh(t.answer), ynh(t.hangup), ynh(t.mute), ynh(t.volUp), ynh(t.volDown), cc ? verdict(cc.verdict) : 'Not tested',
    pt(pr.answer), pt(pr.hangup), pt(pr.mute), pt(pr.volume),
    d.title, d.text, pc.notes, fileUrl, fileId, r.userAgent, r.toolUrl,
    pairing(pr.pairing), pt(pr.ring), pt(pr.lights), pt(pr.audio),
    seen(cf.ring), seen(cf.light), seen(cf.muteLight)
  ];
  return values.map(clean_);
}

// Keep every cell a plain value: no formulas from user input, and within the cell size limit.
function clean_(v) {
  if (v instanceof Date) return v;
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (s.length > MAX_CELL) s = s.slice(0, MAX_CELL) + '…';
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  } else {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);   // picks up columns added in later versions
  }
  sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  return sh;
}

function findRow_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const hit = sheet.getRange(2, COL_ID, last - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function folder_() {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty('FOLDER_ID');
  if (saved) {
    try { return DriveApp.getFolderById(saved); } catch (err) {}
  }
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function fileName_(r, id) {
  const name = (r.headset && r.headset.name) || 'no-headset';
  const day = String(r.testedAt || new Date().toISOString()).slice(0, 10);
  const safe = name.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'headset';
  return 'headset-report-' + safe + '-' + day + '-' + id.slice(0, 8) + '.html';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
