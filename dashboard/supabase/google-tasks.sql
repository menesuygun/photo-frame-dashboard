begin;
-- Private Google Tasks connection. Run once in the project's Supabase SQL Editor.
create table if not exists public.household_google_tasks (
 household text primary key,
 credentials text,
 state jsonb not null default '{"lists":{},"links":{},"conflicts":{}}'::jsonb,
 last_sync timestamptz,
 lock_token uuid,
 locked_until timestamptz
);
alter table public.household_google_tasks enable row level security;
revoke all on public.household_google_tasks from public,anon,authenticated;
grant all on public.household_google_tasks to service_role;

create or replace function public.lock_google_tasks(p_household text,p_token uuid)
returns setof public.household_google_tasks language plpgsql security invoker set search_path=public as $$
begin
 insert into public.household_google_tasks(household) values(p_household) on conflict do nothing;
 return query update public.household_google_tasks set lock_token=p_token,locked_until=now()+interval '120 seconds'
 where household=p_household and (locked_until is null or locked_until<now()) returning *;
end;
$$;
revoke all on function public.lock_google_tasks(text,uuid) from public,anon,authenticated;
grant execute on function public.lock_google_tasks(text,uuid) to service_role;

-- Commit the sync checkpoint and changed household documents together, or neither.
create or replace function public.commit_google_tasks(p_household text,p_token uuid,p_changes jsonb,p_state jsonb,p_finished boolean default false)
returns boolean language plpgsql security invoker set search_path=public as $$
declare change jsonb; saved public.household_documents;
begin
 perform 1 from public.household_google_tasks where household=p_household and lock_token=p_token and locked_until>now() for update;
 if not found then raise exception 'Sync lease expired'; end if;
 for change in select * from jsonb_array_elements(p_changes) loop
  if change->>'category' not in ('chores','completions','reminders','shopping') then raise exception 'Invalid sync category'; end if;
  select * into saved from public.save_household_document(p_household,change->>'category',change->'value',(change->>'revision')::bigint);
  if not found then raise exception 'Household changed; retry sync' using errcode='40001'; end if;
 end loop;
 update public.household_google_tasks set state=p_state,last_sync=case when p_finished then now() else last_sync end,locked_until=now()+interval '120 seconds'
 where household=p_household and lock_token=p_token;
 return true;
end;
$$;
revoke all on function public.commit_google_tasks(text,uuid,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.commit_google_tasks(text,uuid,jsonb,jsonb,boolean) to service_role;

commit;
