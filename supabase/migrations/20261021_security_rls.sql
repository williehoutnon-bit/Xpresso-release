-- ============================================================================
-- Xpresso security migration: replace "allow everything" with per-user rules
-- ============================================================================
--
-- BEFORE: every table had `FOR ALL USING (true)`, so anyone holding the public anon key
--         (it ships inside every APK) could read, edit and delete all data, including
--         children's NINs and parent phone numbers, and every user's messages.
-- AFTER:  access follows auth.uid() (Supabase Auth) and conversation membership.
--
-- HOW TO APPLY
--   1. Rotate the service-role key first (Supabase > Settings > API). It was shipped in the app.
--   2. Try this on a staging copy / branch of the database before production.
--   3. Run the whole file in the SQL editor. It is one transaction: it either applies fully or
--      not at all. It aborts at once if your live column types differ from supabase_schema.sql.
--   4. Test with two real accounts: sign up, log in, start a chat, send, read, delete a chat,
--      friend request, profile edit, upload a photo, push notification.
--
-- ROLLBACK: restore from a backup, or re-run the "Allow all actions" policies from
--           supabase_schema.sql (this reopens the holes).
--
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Preflight: refuse to run if the live schema does not match what the policies assume
-- ----------------------------------------------------------------------------
do $$
declare
  bad text;
begin
  select string_agg(format('%s.%s is %s (expected uuid)', table_name, column_name, data_type), '; ')
    into bad
  from information_schema.columns
  where table_schema = 'public'
    and (table_name, column_name) in (
      ('participants', 'conversation_id'), ('participants', 'user_id'),
      ('messages', 'conversation_id'), ('messages', 'sender_id'),
      ('conversations', 'id'), ('profiles', 'user_id'), ('presence', 'user_id'),
      ('friendships', 'user_id'), ('friendships', 'friend_id'), ('annotations', 'user_id')
    )
    and data_type <> 'uuid';
  if bad is not null then
    raise exception 'Live schema differs from supabase_schema.sql: %. Adjust this migration before running it.', bad;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 1. Helpers (SECURITY DEFINER so policies can look at participants without recursing)
-- ----------------------------------------------------------------------------
create or replace function public.is_conversation_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.participants p
    where p.conversation_id = cid and p.user_id = auth.uid()
  );
$$;
revoke all on function public.is_conversation_member(uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Remove every existing policy on the app tables (the "allow all" ones)
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'conversations', 'participants', 'messages', 'friendships', 'attachments',
        'message_status', 'presence', 'schools', 'canvas_sessions', 'element_operations',
        'math_elements', 'live_canvas_messages', 'annotations', 'accounts', 'user_push_tokens'
      )
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Defense in depth: the anonymous (not logged in) role gets no table access at all.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- ----------------------------------------------------------------------------
-- 3. Sensitive profile data moves to a table only its owner can read
--    (NIN, LIN, phone numbers, IPs of minors must not be visible to other users)
-- ----------------------------------------------------------------------------
create table if not exists public.profile_private (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  student_nin      text,
  student_lin      text,
  parent_nin       text,
  student_contact  text,
  parent_contact   text,
  whatsapp_contact text,
  ip_addresses     text[],
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

insert into public.profile_private
  (user_id, student_nin, student_lin, parent_nin, student_contact, parent_contact, whatsapp_contact, ip_addresses)
select user_id, student_nin, student_lin, parent_nin, student_contact, parent_contact, whatsapp_contact, ip_addresses
from public.profiles
where user_id is not null
  and (student_nin is not null or student_lin is not null or parent_nin is not null
       or student_contact is not null or parent_contact is not null
       or whatsapp_contact is not null or ip_addresses is not null)
on conflict (user_id) do nothing;

-- Old app versions still write these columns into profiles. Keep them working: a trigger moves
-- any incoming sensitive value into profile_private and blanks it in profiles.
create or replace function public.profiles_split_private()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is not null and (
       new.student_nin is not null or new.student_lin is not null or new.parent_nin is not null
    or new.student_contact is not null or new.parent_contact is not null
    or new.whatsapp_contact is not null or new.ip_addresses is not null) then
    insert into public.profile_private
      (user_id, student_nin, student_lin, parent_nin, student_contact, parent_contact, whatsapp_contact, ip_addresses)
    values
      (new.user_id, new.student_nin, new.student_lin, new.parent_nin, new.student_contact,
       new.parent_contact, new.whatsapp_contact, new.ip_addresses)
    on conflict (user_id) do update set
      student_nin      = coalesce(excluded.student_nin,      public.profile_private.student_nin),
      student_lin      = coalesce(excluded.student_lin,      public.profile_private.student_lin),
      parent_nin       = coalesce(excluded.parent_nin,       public.profile_private.parent_nin),
      student_contact  = coalesce(excluded.student_contact,  public.profile_private.student_contact),
      parent_contact   = coalesce(excluded.parent_contact,   public.profile_private.parent_contact),
      whatsapp_contact = coalesce(excluded.whatsapp_contact, public.profile_private.whatsapp_contact),
      ip_addresses     = coalesce(excluded.ip_addresses,     public.profile_private.ip_addresses),
      updated_at       = timezone('utc', now());
  end if;
  new.student_nin := null;
  new.student_lin := null;
  new.parent_nin := null;
  new.student_contact := null;
  new.parent_contact := null;
  new.whatsapp_contact := null;
  new.ip_addresses := null;
  return new;
end;
$$;

drop trigger if exists profiles_split_private_trg on public.profiles;
create trigger profiles_split_private_trg
  before insert or update on public.profiles
  for each row execute function public.profiles_split_private();

-- Blank what is already stored in the readable table (it was copied above).
update public.profiles set
  student_nin = null, student_lin = null, parent_nin = null, student_contact = null,
  parent_contact = null, whatsapp_contact = null, ip_addresses = null
where student_nin is not null or student_lin is not null or parent_nin is not null
   or student_contact is not null or parent_contact is not null
   or whatsapp_contact is not null or ip_addresses is not null;

alter table public.profile_private enable row level security;
create policy profile_private_owner on public.profile_private
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.profile_private to authenticated;

-- A user may not make themselves an administrator, or change their role later.
create or replace function public.profiles_protect_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.role is not null and new.role not in ('student', 'teacher', 'parent') then
      new.role := 'student';
    end if;
  elsif new.role is distinct from old.role then
    raise exception 'role cannot be changed by the user';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role_trg on public.profiles;
create trigger profiles_protect_role_trg
  before insert or update on public.profiles
  for each row execute function public.profiles_protect_role();

-- ----------------------------------------------------------------------------
-- 4. profiles / presence / annotations / friendships
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.profiles to authenticated;

alter table public.presence enable row level security;
create policy presence_read on public.presence for select to authenticated using (true);
create policy presence_write_own on public.presence for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.presence to authenticated;

alter table public.annotations enable row level security;
create policy annotations_own on public.annotations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.annotations to authenticated;

alter table public.friendships enable row level security;
create policy friendships_read on public.friendships for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());
create policy friendships_insert on public.friendships for insert to authenticated
  with check (user_id = auth.uid());
create policy friendships_update on public.friendships for update to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid())
  with check (user_id = auth.uid() or friend_id = auth.uid());
create policy friendships_delete on public.friendships for delete to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());
grant select, insert, update, delete on public.friendships to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Conversations, participants, messages: visible only to members
-- ----------------------------------------------------------------------------
alter table public.conversations add column if not exists created_by uuid default auth.uid();

alter table public.conversations enable row level security;
create policy conversations_read on public.conversations for select to authenticated
  using (created_by = auth.uid() or public.is_conversation_member(id));
create policy conversations_insert on public.conversations for insert to authenticated
  with check (created_by = auth.uid());
create policy conversations_update on public.conversations for update to authenticated
  using (created_by = auth.uid() or public.is_conversation_member(id))
  with check (created_by = auth.uid() or public.is_conversation_member(id));
grant select, insert, update on public.conversations to authenticated;

-- Existing conversations have no created_by: they stay reachable through membership.

alter table public.participants enable row level security;
create policy participants_read on public.participants for select to authenticated
  using (user_id = auth.uid() or public.is_conversation_member(conversation_id));
-- Add people to a conversation you created or already belong to (not to arbitrary ones).
create policy participants_insert on public.participants for insert to authenticated
  with check (
    public.is_conversation_member(conversation_id)
    or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid())
  );
create policy participants_update_own on public.participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy participants_delete_own on public.participants for delete to authenticated
  using (user_id = auth.uid());
grant select, insert, update, delete on public.participants to authenticated;

alter table public.messages enable row level security;
create policy messages_read on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
-- Members may update (read status, shared math content) but never re-assign sender or conversation.
create policy messages_update on public.messages for update to authenticated
  using (public.is_conversation_member(conversation_id))
  with check (public.is_conversation_member(conversation_id));
create policy messages_delete_own on public.messages for delete to authenticated
  using (sender_id = auth.uid());
grant select, insert, update, delete on public.messages to authenticated;

create or replace function public.messages_protect_columns()
returns trigger
language plpgsql
as $$
begin
  if new.sender_id is distinct from old.sender_id or new.conversation_id is distinct from old.conversation_id then
    raise exception 'sender_id and conversation_id cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_protect_columns_trg on public.messages;
create trigger messages_protect_columns_trg
  before update on public.messages
  for each row execute function public.messages_protect_columns();

-- The trigger that un-deletes a chat for its participants must run with its own rights,
-- because the sender is not allowed to edit other people's participant rows.
create or replace function public.restore_participant_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.participants
     set is_deleted = false,
         updated_at = timezone('utc'::text, now())
   where conversation_id = new.conversation_id;
  return new;
end;
$$;

-- Tables the client does not use: closed to everyone except the service role.
alter table public.accounts enable row level security;
alter table public.attachments enable row level security;
alter table public.message_status enable row level security;
revoke all on public.accounts, public.attachments from authenticated;

create policy message_status_own on public.message_status for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.message_status to authenticated;

alter table public.schools enable row level security;
create policy schools_read on public.schools for select to authenticated using (true);
grant select on public.schools to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Live math canvas: logged-in users only. (Tighten to chat membership once the
--    thread/session -> conversation mapping is settled; today it cannot be derived from the columns.)
-- ----------------------------------------------------------------------------
alter table public.canvas_sessions enable row level security;
create policy canvas_sessions_rw on public.canvas_sessions for select to authenticated using (true);
create policy canvas_sessions_insert on public.canvas_sessions for insert to authenticated
  with check (created_by is null or created_by = auth.uid()::text);
create policy canvas_sessions_update on public.canvas_sessions for update to authenticated using (true) with check (true);
create policy canvas_sessions_delete on public.canvas_sessions for delete to authenticated
  using (created_by = auth.uid()::text);
grant select, insert, update, delete on public.canvas_sessions to authenticated;

alter table public.element_operations enable row level security;
create policy element_operations_read on public.element_operations for select to authenticated using (true);
create policy element_operations_insert on public.element_operations for insert to authenticated
  with check (user_id = auth.uid()::text);
grant select, insert on public.element_operations to authenticated;

alter table public.math_elements enable row level security;
create policy math_elements_read on public.math_elements for select to authenticated using (true);
create policy math_elements_insert on public.math_elements for insert to authenticated
  with check (created_by is null or created_by = auth.uid()::text);
create policy math_elements_update on public.math_elements for update to authenticated using (true) with check (true);
create policy math_elements_delete on public.math_elements for delete to authenticated
  using (created_by = auth.uid()::text);
grant select, insert, update, delete on public.math_elements to authenticated;

alter table public.live_canvas_messages enable row level security;
create policy live_canvas_messages_read on public.live_canvas_messages for select to authenticated using (true);
create policy live_canvas_messages_insert on public.live_canvas_messages for insert to authenticated
  with check (sender_id = auth.uid()::text);
create policy live_canvas_messages_update on public.live_canvas_messages for update to authenticated
  using (sender_id = auth.uid()::text) with check (sender_id = auth.uid()::text);
create policy live_canvas_messages_delete on public.live_canvas_messages for delete to authenticated
  using (sender_id = auth.uid()::text);
grant select, insert, update, delete on public.live_canvas_messages to authenticated;

-- ----------------------------------------------------------------------------
-- 7. Push tokens: a user sees only their own; writes go through two functions so a token that
--    moves between accounts on one phone (log out / log in as someone else) is handled safely.
-- ----------------------------------------------------------------------------
create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  token text not null unique,
  platform text default 'android',
  device_model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.user_push_tokens enable row level security;
create policy user_push_tokens_read_own on public.user_push_tokens for select to authenticated
  using (user_id = auth.uid()::text);
grant select on public.user_push_tokens to authenticated;

create or replace function public.register_push_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_token is null or length(p_token) < 20 or length(p_token) > 4096 then
    raise exception 'invalid token';
  end if;
  insert into public.user_push_tokens (user_id, token, platform, updated_at)
  values (auth.uid()::text, p_token, coalesce(p_platform, 'android'), now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.user_push_tokens where token = p_token and user_id = auth.uid()::text;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. Live updates: read-only for the app. Only the CI job (service role) may publish a bundle,
--    because the app installs whatever bundle this table points to.
-- ----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.app_versions') is not null then
    execute 'alter table public.app_versions enable row level security';
    execute 'drop policy if exists app_versions_read on public.app_versions';
    execute 'create policy app_versions_read on public.app_versions for select to anon, authenticated using (true)';
    execute 'revoke all on public.app_versions from anon, authenticated';
    execute 'grant select on public.app_versions to anon, authenticated';
  end if;
  if to_regclass('public.typing_indicators') is not null then
    execute 'alter table public.typing_indicators enable row level security';
    execute 'drop policy if exists typing_indicators_rw on public.typing_indicators';
    execute 'create policy typing_indicators_rw on public.typing_indicators for all to authenticated using (true) with check (true)';
    execute 'revoke all on public.typing_indicators from anon';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 9. Storage: chat_media. Files stay readable by their public link (needed for images in chats),
--    but only logged-in users can upload, and only the uploader can change or delete a file.
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and policyname in ('Allow public read access to chat_media', 'Allow public upload to chat_media',
                                'Allow public update to chat_media', 'Allow public delete to chat_media')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;

  execute 'create policy chat_media_insert on storage.objects for insert to authenticated
           with check (bucket_id = ''chat_media'')';
  execute 'create policy chat_media_select_own on storage.objects for select to authenticated
           using (bucket_id = ''chat_media'' and owner_id = auth.uid()::text)';
  execute 'create policy chat_media_update_own on storage.objects for update to authenticated
           using (bucket_id = ''chat_media'' and owner_id = auth.uid()::text)
           with check (bucket_id = ''chat_media'' and owner_id = auth.uid()::text)';
  execute 'create policy chat_media_delete_own on storage.objects for delete to authenticated
           using (bucket_id = ''chat_media'' and owner_id = auth.uid()::text)';
end $$;

commit;
