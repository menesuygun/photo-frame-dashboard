# Shared Apple Calendar on Vercel

Set the Vercel project's Root Directory to `dashboard`. Deploy this branch with the Vite preset.

Add server-only environment variables:

- `ICLOUD_CALENDAR_URL`: the published iCloud calendar subscription link (`webcal://` or `https://`).
- `FRAME_ACCESS_CODE`: a long randomly generated code, entered once on each frame/browser.
- `CALENDAR_TIMEZONE`: optional fallback for floating events; defaults to `America/Toronto`. The feed must include that timezone's VTIMEZONE definition for floating events.

Never use a `VITE_` prefix for these settings. Keep the calendar URL and code out of commits. Redeploy after changing environment settings. Use branch-specific Preview settings when testing.

Open the Calendar tab and select **Connect**, or use **Connect** on the home screen. Enter the frame access code. It is remembered in that browser's local storage. Calendar data is fetched only after authorization and is not placed in a shared CDN cache. Vercel deployment protection remains an additional layer; this change does not alter it.

In Apple Calendar, name events `[Enes] Dentist`, `[Beyza] Meeting`, `[Atlas] Swimming`, or `[Miyam] Playdate`. Multiple tags such as `[Enes][Beyza] Dinner` assign both people. Tags ignore capitalization and are hidden on the frame. Untagged events belong to everyone. Unknown bracketed words remain visible.

The calendar is read-only: add and edit events in Apple Calendar. The frame refreshes every five minutes and when it reconnects. It keeps the last successful calendar in memory if a refresh fails, labels the stale state, and replaces the complete event list after a successful refresh, including removals. Reloading requires a new successful fetch; events are not saved to local storage.

The server expands recurrence rules, exclusions, and overrides, preserves all-day dates, and returns events from the beginning of the month one year ago through the end of the month one year ahead. Calendar navigation outside this window has no loaded events. It limits feeds to 5 MB, 5,000 visible occurrences, and 100,000 recurrence iterations.

The calendar and clock now use live data; other dashboard sections remain demo data. Google Photos is separate work.

Validation: `npm ci`, `node --test tests/calendar.test.js`, `npm run build`. For local end-to-end testing use Vercel's local development environment so `/api/calendar` runs; Vite by itself serves the interface only.

## Enes work calendar (Google)

Optional server-only `GOOGLE_CALENDAR_URL` accepts the work calendar's **Secret address in iCal format** from Google Calendar → Settings → the calendar → Integrate calendar. Never make the calendar public. Store the link as a sensitive Production environment variable and redeploy; never use a VITE prefix or commit the link. Workspace administrators may disable secret subscription links.

Google events merge with Apple events through the existing protected `/api/calendar` function, refresh every five minutes while the dashboard is open, and always have `people: ['enes']`, including untagged and recurring events. They remain visible on the shared display under Enes. Source-specific event IDs prevent collisions with Apple. Edit the original Google calendar; this subscription is read-only. If either configured feed fails, the client retains the last complete successful update and shows its existing offline status. No additional serverless function is used.
