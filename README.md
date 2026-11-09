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

Results can be copied as a text summary, downloaded as a CSV row (for an inventory spreadsheet) or downloaded as a full JSON report including the descriptor.

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
