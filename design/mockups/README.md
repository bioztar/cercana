# Mockups: Mom's screens

Source files of the Claude Design canvas "Family Memory — Mom’s screens":
https://claude.ai/artifact/YJYZpBYg8orLg8C2P3oJur

- `canvas.json` — canvas index: every artboard's position, size and title, plus group headings.
- `*.dc.html` — one file per screen (390×844 iPhone, except `Main.dc.html`, which is the full feed scroll at 390×2500).

The files load `./support.js` from the Design canvas runtime, so they render inside the canvas, not when opened directly in a browser.

| Group | Screens |
| --- | --- |
| Mom · iPhone | `Main` (feed), `Thread` (photo comments) |
| Tell the family: photos and events | `Share`, `PhotoPick`, `PhotoEvent`, `PhotoSend`, `EventVoice`, `EventConfirm`, `Calendar`, `EventDetail`, `EventHouse` |
| Andrey · iPhone: “Family” calendar | `CalConnect`, `CalPeople`, `CalEvent` |
| Important event: reminders and “Did you go?” | `ImpCreate`, `MomNotify`, `MomCheck`, `ImpStatus` |
