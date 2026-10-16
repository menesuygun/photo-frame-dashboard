-- Run once in your private Supabase project's SQL Editor.
-- All browser access goes through this dashboard's authenticated server routes.
create table if not exists public.household_documents (
  household text not null,
  category text not null check (category in ('chores','completions','meals','reminders','shopping','usuals','education','photos')),
  value jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (household, category)
);
alter table public.household_documents enable row level security;
revoke all on public.household_documents from anon, authenticated;
grant all on public.household_documents to service_role;

-- Compare-and-swap prevents an older device from silently overwriting newer edits.
create or replace function public.save_household_document(
  p_household text, p_category text, p_value jsonb, p_expected bigint
) returns setof public.household_documents
language plpgsql security invoker set search_path = public as $$
begin
  if p_expected < 0 then raise exception 'Invalid revision'; end if;
  if p_expected = 0 then
    return query insert into public.household_documents(household,category,value)
      values(p_household,p_category,p_value) on conflict do nothing returning *;
  else
    return query update public.household_documents set value=p_value, revision=revision+1, updated_at=now()
      where household=p_household and category=p_category and revision=p_expected returning *;
  end if;
end;
$$;
revoke all on function public.save_household_document(text,text,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.save_household_document(text,text,jsonb,bigint) to service_role;

-- First-device migration is all-or-nothing and can never replace an existing household.
create or replace function public.initialize_household(p_household text,p_documents jsonb)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_household,0));
  if exists(select 1 from public.household_documents where household=p_household) then return false; end if;
  if jsonb_typeof(p_documents)<>'object' or p_documents='{}'::jsonb then raise exception 'Empty import'; end if;
  insert into public.household_documents(household,category,value)
    select p_household,key,value from jsonb_each(p_documents);
  return true;
end;
$$;
revoke all on function public.initialize_household(text,jsonb) from public,anon,authenticated;
grant execute on function public.initialize_household(text,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('household-photos','household-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- No public/anonymous Storage policies: photos require authorized signed access.
