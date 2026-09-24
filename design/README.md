# design/

Mockups and visual design for Cercana. Owner: Andrey (`calledandrey`).

## How we split the work

- **Andrey designs, crewmates code.** Mockups are made in Claude Design and land here.
- **Nobody pushes to `main` directly.** Open a branch (`design/<topic>`) and a pull request;
  `main` is what runs at https://cercana.pro7ocol.com.
- Put exports in a folder per flow, e.g. `design/01-patient-home/`, with PNGs (phone 390 px
  wide and desktop) plus a short `notes.md`: what changed, and what is open.
- The product concept lives in `family_memory_concept_for_designer.md` at the repo root.

## What is built today (so mockups can start from it)

- Patient home: greeting + date, "Hear today" spoken briefing, birthday banner, faces grid.
- Person card: call on WhatsApp, phone call, "Tell me about…", Coming up (calendar), Lately.
- Family mode: people, moments (text / photo / voice note), ping, calendars.
- Next (in progress): invite link `/join/<code>` with "which one are you?", roles
  (lead → admins → members), and a **"From your family" feed** that replaces "Lately"
  (from the concept doc §4.1). Chats and voice replies are v2.

Live screenshots: `docs/screenshots/`. Try it without an account: https://cercana.pro7ocol.com/?demo=patient
