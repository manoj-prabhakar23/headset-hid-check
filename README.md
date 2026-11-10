# Headset HID check

A single-page browser tool that tests whether a browser and a USB or DECT headset support **WebHID call control**: answering, hanging up, muting and changing volume from the headset's own buttons.

**Open it:** https://manoj-prabhakar23.github.io/headset-hid-check/ (Chrome or Edge 89+ on a computer)

Everything runs in the browser. Nothing about the headset is uploaded.

## What it checks

1. **Browser.** Is WebHID built in? Is the page secure? Does the page's permissions policy allow `hid`? Do browser settings or admin policy block it? If the device chooser closes instantly without appearing, the tool reports "Blocked" and points to `chrome://settings/content/hidDevices` / `edge://settings/content/hidDevices` and the `DefaultWebHidGuardSetting`, `WebHidBlockedForUrls` and `WebHidAskForUrls` policies.
2. **Headset.** Opens every HID interface of the chosen headset and reads its descriptor:
   - Telephony collection (usage page `0x0B`)
   - Call button (Hook Switch `0x0B:0x20`), mute (Phone Mute `0x0B:0x2F` or Consumer Mute `0x0C:0xE2`), volume (`0x0C:0xE9/0xEA/0xE0`)
   - Outputs the page can drive: Off-Hook LED `0x08:0x17`, Ring LED `0x08:0x18` or Ringer `0x0B:0x9E`, Mute LED `0x08:0x09`, Hold LED `0x08:0x20`

   The verdict is **Yes** (standard telephony controls), **Partly** (buttons readable, no call-state outputs), **Vendor only** (vendor-defined reports, which need the manufacturer's software or SDK) or **No**.
   Headsets you've allowed before are remembered by the browser and listed without asking again.
3. **Call controls.** The page acts like a softphone. **Ring the headset** sends the Ring state. Then press the headset's buttons: answer, mute, volume up/down, hang up. Each control lights up on the faceplate when its report arrives. The report log shows raw bytes (with changed bytes highlighted) and decoded meanings for every report in and out.

4. **Report to your platform's developers.** Pick the platform (Content Guru storm DTA / Web iPath by default, or Genesys Cloud, Talkdesk, Amazon Connect, NICE CXone, Five9, Microsoft Teams, Other). Record what happened in that platform's web app: whether the headset is **listed for HID pairing** (listed and paired, listed but pairing failed, or not listed), and whether answer, hang up, mute, volume, ringing on an incoming call, call and mute lights, and audio worked. Add a case number, your name and notes. Step 3 also asks what the headset physically did (rang, in-call light, mute light), because a web page can send those signals but can't see the result. The page compares this with its own WebHID results and states the likely cause:
   - **Likely an issue in [platform]**: something works over standard WebHID here (pairing, a button, ringing or lights) but not in the platform. If the platform doesn't list the headset for pairing, the report gives its VID/PID; if pairing fails, it points to the per-site browser permission.
   - Failures that also happen here point to the headset; failures not yet checked here are flagged; audio problems are called out as not WebHID-related.
   - **Headset isn't supported by standard WebHID**: the headset only sends vendor-defined reports.
   - **Headset supports standard WebHID call control** / **Works here and in [platform]**.
   - **WebHID is blocked or unavailable in this browser**: fix the browser or policy first.

   **Download report** saves one HTML file the developers can open in any browser: the diagnosis, a side-by-side table (headset reports it, worked here, worked in the platform), tester details and notes, headset and browser details, the full HID descriptor, the report log and the raw JSON (also embedded as `<script type="application/json" id="report-data">` for tooling). **Email the report** downloads it and opens a pre-filled draft in your email app to attach it to. **Copy email text** copies the same draft.

Results can also be copied as a text summary, downloaded as a CSV row (for an inventory spreadsheet, now including the platform results and diagnosis) or downloaded as a full JSON report.

## Results log (saving every user's report)

When `SAVE_URL` at the top of the script in `index.html` is set, the page saves each user's report to the owner's Google account:

- **Google Sheet**: one row per report (browser, headset, IDs, capabilities, live results, platform results, diagnosis, tester, case, notes, link to the full report). Later saves of the same test update that row instead of adding new ones.
- **Google Drive**: the full HTML report in a private `Headset HID reports` folder.

Saving happens automatically a few seconds after results change, immediately when a user downloads, emails or copies a report, and (without the HTML file) when the page is closed with unsaved changes. Nothing is saved for visitors who never test a headset or hit a block. When saving is on, the page tells every user, at the top and in the footer, that their results, including any name, email and notes they enter, are saved to a private results log.

### Set it up

1. Create a Google Sheet (for example, *Headset HID check results*).
2. In the Sheet, open **Extensions → Apps Script**, replace the sample code with [`apps-script/Code.gs`](apps-script/Code.gs) and click **Save**.
3. Click **Deploy → New deployment**, choose type **Web app**, set **Execute as: Me** and **Who has access: Anyone**, then **Deploy** and authorize the requested Sheets and Drive access.
4. Copy the **Web app URL** (it ends in `/exec`) into `const SAVE_URL = "";` in `index.html` and push.

After changing `Code.gs`, use **Deploy → Manage deployments → Edit → New version** so the same URL keeps working.

The endpoint accepts only well-formed Headset HID check reports up to 4 MB, never returns stored data, and stores user text as plain values (no spreadsheet formulas). Anyone who knows the URL can still post a fake report, so treat rows as tester-supplied.

## Notes

- WebHID is only in Chromium browsers (Chrome, Edge, Opera) on desktop. Firefox, Safari and mobile browsers don't have it.
- WebHID doesn't work inside an iframe unless the embedding page grants `allow="hid"`. Open the tool in its own tab.
- Some DECT bases only send button presses while ringing or in a call. Start with **Ring the headset**.
- Many headsets change volume inside the headset or through the operating system, so volume buttons may not appear. Softphones don't need them.
- Passing here means generic WebHID can control the headset. Whether a given contact-center platform uses WebHID for that brand is the platform's choice. For example, Genesys Cloud's open-source headset library uses WebHID for Yealink, Jabra, CyberAcoustics and VBeT, the HP call control SDK for Poly, and the EPOS Connect desktop app for EPOS/Sennheiser.
- Vendor software (EPOS Connect, Jabra Direct, Poly Lens) can run at the same time, but it may also set the headset's LEDs. Close it if the LEDs behave unexpectedly.

## References

- [WebHID specification](https://wicg.github.io/webhid/)
- [WebHID API on MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API)
- [HID Usage Tables](https://usb.org/document-library/hid-usage-tables-15)
- [Genesys softphone-vendor-headsets debug tools](https://github.com/purecloudlabs/softphone-vendor-headsets/blob/develop/react-app/docs/headset-debug-tools.md)
