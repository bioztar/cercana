# Cercana — 4-minute demo script

**Cast.** Vitaly = **Maria**, 79, memory loss (iPhone, Cercana app). Andrey = **Pedro**, her son
(his phone). A laptop on the big screen = **Anna**, her daughter in London (web:
https://cercana.pro7ocol.com). Family code **ABUELA**.

**Land these three things:**
1. **Maria never has to remember.** The phone tells her what her day holds and who everyone is.
2. **Maria is not just a viewer.** She answers her family by voice.
3. **The family knows she's OK.** "Did you go to the doctor?" comes back to them.

## The run (≈ 4 min)

| Time | Who | Do | Say (one line) |
|---|---|---|---|
| 0:00 | Vitaly | Hold up the phone. | "Over 55 million people live with dementia. The hardest part for families isn't the big moments. It's that yesterday doesn't stick." |
| 0:20 | Maria (phone) | Tap **Hear today**. The phone speaks: Rosa visits, Anna in London, Lucia's birthday tomorrow, new photos. | "Every morning at nine, Maria's phone tells her her day. She doesn't have to remember it." |
| 0:50 | Maria | Scroll to the faces. Tap **Pedro**: "your son", Sunday lunch under *Coming up*. Tap **Call on WhatsApp**. | "Who's who, and one tap to call." *(Andrey's phone rings. Answer, wave, hang up.)* |
| 1:30 | Pedro (Andrey's phone) | Post a photo with a line: "Diego's football match today ⚽". | "The family posts like any family chat…" |
| 1:45 | Maria | It appears in **Feed**. Tap ▶ on Carmen's voice note. | "…and it lands on Maria's phone as a story she can hear." |
| 2:05 | Maria | Tap **Comment** on Pedro's post, hold the big button: "Qué bien, see you Sunday!" | "Maria answers. No typing, just her voice." |
| 2:20 | Pedro | Show the comment arriving on his phone and play it. | "Pedro hears his mum." |
| 2:35 | Anna (laptop) | **Ping** → "Thinking of you". | "Anna is in London…" |
| 2:40 | Maria | The phone shows Anna's face full-screen and says *"Anna says: thinking of you."* | "…and her mum hears it." |
| 3:00 | Maria | Home shows **Blood test this morning: Did you go?** Tap **Yes, I went**. | "Here is the care loop." |
| 3:15 | Anna (laptop) | Open the important event: **"Mom went ✓"**. Then create **Cardiologist, Tuesday 10:30**: reminders the evening before and on the day, then "Did you go?". | "The family doesn't have to chase. If she doesn't answer, Cercana asks again in an hour, then tells them." |
| 3:45 | Vitaly | Point at Anna's card, *"Anna is in London until Sunday."* | "Anna didn't type that. It came from her own calendar. Maria never had to remember, and her family never had to chase." |

## Before the demo (15 minutes)

- **helm re-seeds ABUELA** on demo morning: dates are relative (birthday "tomorrow", "Blood test this morning"). Tell helm the demo date. Re-seeding recreates the family, so **both phones and the laptop must re-join ABUELA afterwards**.
- **Maria's phone:**
  - Cercana joined with ABUELA as Maria.
  - Notifications and microphone allowed.
  - **Silent switch off**, volume high, Focus / Do Not Disturb off.
  - App open on Home.
- **Andrey's phone:**
  - Cercana app installed (plug into the Mac once), or Safari → https://cercana.pro7ocol.com/join/ABUELA → **Pedro**.
  - WhatsApp signed in on his number.
- **Laptop:**
  - Chrome → https://cercana.pro7ocol.com/join/ABUELA → **Anna**.
  - Screen shared, sound on.
- **Dry run once**, end to end.

## If something misbehaves

- **Phone doesn't speak:** check the silent switch; tap **Hear today** again (speech needs a tap first).
- **Ping doesn't show:** Maria's app must be open; pull down to refresh. Push to a closed app isn't in this version.
- **WhatsApp doesn't ring:** use **Phone call** on the same card.
- **Anything else breaks:** open https://cercana.pro7ocol.com/?demo=patient on any browser. It's the same app with the sample family, offline-safe.

## Don't demo yet

- iPhone calendar connect: family side, iPhone app only; a mention is enough.
- The new setup flow: still being built.
- Transcripts of voice notes on iPhone: audio only in this version.
