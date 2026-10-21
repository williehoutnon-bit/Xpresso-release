-- ============================================================================
-- Xpresso Live Updates (Capgo web bundles)
-- Run once in the Supabase SQL editor.
-- ============================================================================

-- 1. Public storage bucket holding the zipped web bundles.
--    The app downloads bundles by public URL, so the bucket must be public.
insert into storage.buckets (id, name, public)
values ('app-updates', 'app-updates', true)
on conflict (id) do update set public = true;

-- 2. Table listing every published bundle. The newest row is the live version.
create table if not exists public.app_versions (
    id uuid primary key default gen_random_uuid(),
    version text not null unique,
    bundle_url text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_app_versions_created_at
    on public.app_versions (created_at desc);

-- 3. Anyone (the anon key in the app) may read versions.
--    Writes come only from CI with the service role key, which bypasses RLS.
alter table public.app_versions enable row level security;

drop policy if exists "Anyone can read app versions" on public.app_versions;
create policy "Anyone can read app versions"
    on public.app_versions
    for select
    to anon, authenticated
    using (true);
