-- Add dashboard-created calendar events to the existing private household storage.
begin;
alter table public.household_documents drop constraint if exists household_documents_category_check;
alter table public.household_documents add constraint household_documents_category_check check (category in ('chores','completions','meals','reminders','shopping','usuals','education','photos','events'));
commit;
