# Private household synchronization

## Setup

1. In a Free Supabase project, run `supabase/household.sql` in the SQL Editor. This creates a dedicated table, two service-only RPC functions, and a private `household-photos` bucket. Existing unrelated data is not changed.
2. Set Production server variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (supports modern `sb_secret_` or legacy service-role keys), and `HOUSEHOLD_ID`. Never prefix the secret with `VITE_`.
3. Deploy. The database remains empty and all devices remain local until explicitly connected.
4. On the tablet containing the household's current data, refresh, open **Family sync** at the bottom of the sidebar, connect with the existing frame code if needed, then choose **Import this device first**. Save the downloaded backup. Photos upload privately, followed by an atomic import. A household can only be initialized once; no other device can replace it through the import action.
5. On each other device, connect its calendar/frame code, open **Family sync**, and select **Connect to existing household**. Its current local data downloads as a backup before the cloud copy is loaded. Do not use the initial-import action again.

## What syncs

Chore schedules and dated completions, meals including their thumbnails, reminders, shopping items, Usuals, Education progress, and uploaded photo files/details. The iCloud feed, frame access code, Google key, home address, and screensaver collection are not copied into the database or backups.

Devices check revisions every 30 seconds while online. Full documents and photo blobs only transfer when needed. Photos remain cached in IndexedDB; viewing an already downloaded photo does not re-download it on every slide. Updates to a collection use compare-and-swap revisions. A conflicting edit stays local and requires an explicit choice in Family sync; it is never silently overwritten. Offline edits are queued in localStorage and sent after reconnection. This is polling, not a WebSocket realtime subscription.

## Privacy and recovery

The backend uses the existing frame code for access and a single configured household. Browser requests cannot select another household. The service key stays in Vercel's server environment. The table has RLS enabled, no anonymous/authenticated grants, and service-only RPC permissions. Photos use a private bucket with short-lived signed upload/download URLs. File IDs are constrained and downloads can only be signed for current household photo metadata. A signed URL grants temporary access to that file and should not be shared publicly.

Device backups are JSON files containing lists, progress and photo data. Keep them private. They exclude authentication credentials. A failed import or photo download leaves the source local data intact. Disconnecting keeps the local copy and pending queue; do not clear browser storage until the backup and cloud data have been verified.

Photo removal hides it from the shared library; the underlying private object is retained for recovery and consumes storage until manually cleaned up. No automatic permanent file purge is implemented. The library limit remains 100 photos; the bucket accepts supported images up to 5 MB each. Free-plan storage and transfer quotas still apply.

## Limits

Only devices explicitly connected to the household sync. The initial import must be performed on the user's source tablet, not a fresh developer browser. Tests use isolated mocked households and do not initialize the real household. A live readiness check must confirm the real household is still uninitialized before asking the user to import.
