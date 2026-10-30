# Google Tasks household sync

The permanent dashboard uses one Google account, three Google Tasks lists (Chores, Reminders, Shopping), the existing frame code, and private Supabase storage. No Google credentials are sent to dashboard devices. Tokens are encrypted with AES-256-GCM before storage; changing the frame code or Google OAuth secret requires reconnecting Google.

## One-time setup

1. In the existing Google Cloud project, enable **Google Tasks API** (not Cloud Tasks).
2. Configure Google Auth Platform / OAuth consent with the Tasks scope `https://www.googleapis.com/auth/tasks`. If the app is in Testing, add the connecting account as a test user. Testing-mode refresh tokens can expire after seven days; use a suitable production publishing configuration for a permanent connection.
3. Create an OAuth client of type **Web application** with this exact authorized redirect URI:
   `https://photo-frame-dashboard-neon.vercel.app/api/google-tasks?action=callback`
4. Save its credentials in the Vercel project's **Production** environment:
   - `GOOGLE_TASKS_CLIENT_ID`
   - `GOOGLE_TASKS_CLIENT_SECRET` (sensitive/server only)
   Do not put these in VITE-prefixed variables or browser storage.
5. Run `supabase/google-tasks.sql` in the existing private Supabase project's SQL Editor. This creates only the connection table and sync RPCs, with RLS and service-role-only access. Household documents and photos remain in their existing tables/bucket.
6. Deploy after saving environment variables. Open the permanent dashboard, connect Family sync, then **Family sync → Google Tasks → Connect Google Tasks**. The person who owns the Google account must finish Google's authorization screen.
7. The connection uses existing lists with those exact names (case insensitive), or creates missing lists. It stops if multiple lists have the same name. Only those three lists are synced. Do not rename/reassign the lists to unrelated uses while connected.

## Behavior

- On first sync, dashboard items are exported and open Google tasks are imported; no existing household data is replaced wholesale. Completed/deleted historical Google tasks are not imported.
- Subsequent adds, edits, completions/reopening, and deletion sync both ways. A linked delete applies to both systems. Disconnecting stops updates and keeps all items.
- Updates run about once per minute while an online, Family-sync-connected dashboard is open; devices receive household changes through the existing 30-second sync. This is not a background phone notification service or an always-running scheduled job.
- A database lease serializes devices. Checkpoints and household writes are transactional and revision-checked. Google updates use ETags. If both systems change an item, users choose a version in the connection sheet. A successful Google insert is recovered through its Frame ID note if the checkpoint was interrupted.
- Keep the generated `Frame ID:` note line; it helps recover interrupted inserts and prevent duplicates. Ordinary notes and unrelated Google Tasks fields are preserved on updates.
- Chores: names may start with `[Enes]`, `[Beyza]`, `[Atlas]`, `[Miyam]` or `[Anyone]`. Untagged imported chores belong to Anyone, use Afternoon, and are one-off tasks on the Google date (today if undated). Dashboard repeat/timeframe settings are retained. One Google task tracks the next occurrence of a repeating dashboard chore and reopens on the next occurrence. The Google API does not expose a recurrence rule or scheduled time. Editing a repeating chore's Google date requires review; keeping the Google date turns the template into a one-off.
- Reminders: title and completion sync; Google dates/notes are not used by the dashboard's undated reminders.
- Shopping: title and completion sync. Optional notes lines: `Quantity: 2`, `Store: Costco`, `Category: Meat & Deli`. Defaults are quantity 1, Grocery Store, Other. Stores: Grocery Store, Costco, Other. Categories match the dashboard. Existing unrecognized values stop the sync and show an error instead of silently replacing data.
- Tasks assigned from Docs/Chat are excluded. Subtasks in the three household lists appear as regular dashboard items; their Google parent/order is preserved when updating existing tasks.
- Bounds: 500 dashboard items per section; refuse Google lists larger than 2,000 returned tasks. Each run checkpoints up to 20 changes or about 30 seconds of work and continues on the next run. API requests have timeouts and use a 60-second function budget.

## Scope of verification

Production builds and JavaScript syntax checks can run without Google access. Live authorization and a full two-way round trip require the user's saved Google credentials and consent. No real household tasks should be created or deleted merely for verification without the user's permission.
