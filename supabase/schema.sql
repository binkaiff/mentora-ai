-- Run once in Supabase SQL Editor. Non-destructive; creates Mentora-specific objects.
create extension if not exists vector with schema extensions;
create table if not exists public.mentora_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb,
 version integer not null default 0,
 updated_at timestamptz not null default now(),
 check (octet_length(data::text) <= 2000000)
);
create table if not exists public.mentora_notes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null, path text not null, pages integer not null,
 embedding_model text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.mentora_chunks (
 id bigint generated always as identity primary key,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 note_id uuid not null references public.mentora_notes(id) on delete cascade,
 page integer not null, content text not null,
 embedding extensions.vector(768) not null
);
create table if not exists public.mentora_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 assignment_id text not null, title text not null, due_at timestamptz not null,
 read boolean not null default false,
 unique(user_id, assignment_id, due_at)
);
create table if not exists public.mentora_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null default current_date, calls integer not null default 0,
 primary key(user_id, day)
);
alter table public.mentora_workspaces enable row level security;
alter table public.mentora_notes enable row level security;
alter table public.mentora_chunks enable row level security;
alter table public.mentora_notifications enable row level security;
alter table public.mentora_usage enable row level security;
do $$ declare t text; begin
 foreach t in array array['mentora_workspaces','mentora_notes','mentora_chunks'] loop
   if not exists(select 1 from pg_policies where tablename=t and policyname='mentora_owner') then
     execute format('create policy mentora_owner on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',t);
   end if;
 end loop;
end $$;
create policy mentora_notification_read on public.mentora_notifications for select to authenticated using (user_id=auth.uid());
create policy mentora_notification_update on public.mentora_notifications for update to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid());
create policy mentora_usage_read on public.mentora_usage for select to authenticated using(user_id=auth.uid());
grant select,insert,update,delete on public.mentora_workspaces,public.mentora_notes,public.mentora_chunks to authenticated;
grant usage,select on sequence public.mentora_chunks_id_seq to authenticated;
grant select,update on public.mentora_notifications to authenticated;
grant select on public.mentora_usage to authenticated;

create or replace function public.mentora_save_workspace(payload jsonb, expected_version integer)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare w public.mentora_workspaces;
begin
 insert into public.mentora_workspaces(user_id) values(auth.uid()) on conflict do nothing;
 update public.mentora_workspaces set data=payload,version=version+1,updated_at=now()
 where user_id=auth.uid() and version=expected_version returning * into w;
 if not found then raise exception 'Workspace changed in another tab. Reload before saving.'; end if;
 return jsonb_build_object('data',w.data,'version',w.version);
end $$;

create or replace function public.mentora_reserve_ai()
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer; total integer;
begin
 if auth.uid() is null then return false; end if;
 perform pg_advisory_xact_lock(91420261);
 select coalesce(sum(calls),0) into total from public.mentora_usage where day=current_date;
 select calls into n from public.mentora_usage where user_id=auth.uid() and day=current_date;
 -- Pilot limits: 20 operations per user, 100 app-wide per UTC day.
 if coalesce(n,0)>=20 or total>=100 then return false; end if;
 insert into public.mentora_usage(user_id,day,calls) values(auth.uid(),current_date,1)
 on conflict(user_id,day) do update set calls=mentora_usage.calls+1;
 return true;
end $$;

create or replace function public.mentora_match_chunks(query_embedding extensions.vector(768), target_note uuid)
returns table(page integer,content text,similarity float)
language sql stable security invoker set search_path=public,extensions as $$
 select c.page,c.content,1-(c.embedding <=> query_embedding) as similarity
 from public.mentora_chunks c where c.user_id=auth.uid() and c.note_id=target_note
 order by c.embedding <=> query_embedding limit 6;
$$;

create or replace function public.mentora_check_note_limit()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext(new.user_id::text));
 if (select count(*) from public.mentora_notes where user_id=new.user_id)>=5 then
 raise exception 'Maximum five PDFs. Delete one before uploading another.';
 end if;
 return new;
end $$;
create trigger mentora_note_limit before insert on public.mentora_notes for each row execute function public.mentora_check_note_limit();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mentora-pdfs','mentora-pdfs',false,5242880,array['application/pdf']) on conflict(id) do nothing;
create policy mentora_pdf_owner on storage.objects for all to authenticated
 using(bucket_id='mentora-pdfs' and (storage.foldername(name))[1]=auth.uid()::text)
 with check(bucket_id='mentora-pdfs' and (storage.foldername(name))[1]=auth.uid()::text);

-- Scheduled in-app reminders. Due dates are saved as ISO timestamps by the client.
create or replace function public.mentora_create_reminders()
returns void language plpgsql security definer set search_path=public as $$
declare w record; a jsonb; deadline timestamptz;
begin
 for w in select user_id,data from public.mentora_workspaces loop
  if jsonb_typeof(w.data->'assignments') is distinct from 'array' then continue; end if;
  for a in select value from jsonb_array_elements(w.data->'assignments') loop
   begin
    deadline=(a->>'due')::timestamptz;
    if coalesce((a->>'done')::boolean,false)=false
       and deadline between now()-interval '7 days' and now()+interval '24 hours'
       and a->>'id' is not null and a->>'title' is not null then
     insert into public.mentora_notifications(user_id,assignment_id,title,due_at)
     values(w.user_id,a->>'id',a->>'title',deadline)
     on conflict(user_id,assignment_id,due_at) do nothing;
    end if;
   exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then
    continue; -- A malformed personal record must not block other students' reminders.
   end;
  end loop;
 end loop;
end;
$$;
-- Restrict SECURITY DEFINER functions explicitly.
revoke all on function public.mentora_create_reminders() from public,anon,authenticated;
revoke all on function public.mentora_reserve_ai() from public,anon;
grant execute on function public.mentora_reserve_ai() to authenticated;
revoke all on function public.mentora_save_workspace(jsonb,integer) from public,anon;
grant execute on function public.mentora_save_workspace(jsonb,integer) to authenticated;
revoke all on function public.mentora_match_chunks(extensions.vector,uuid) from public,anon;
grant execute on function public.mentora_match_chunks(extensions.vector,uuid) to authenticated;
