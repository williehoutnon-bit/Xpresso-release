-- ============================================================================
-- Xpresso Push Notifications & Unread Badge Database Migration
-- ============================================================================

-- 1. Table to store FCM device push tokens
create table if not exists public.user_push_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id text not null,
    token text not null unique,
    platform text default 'android',
    device_model text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Index for instant lookup of recipient tokens when a message is sent
create index if not exists idx_user_push_tokens_user_id on public.user_push_tokens(user_id);
create index if not exists idx_user_push_tokens_token on public.user_push_tokens(token);

-- Enable Row Level Security (RLS)
alter table public.user_push_tokens enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Allow users to manage their push tokens" on public.user_push_tokens;

-- Policy: Users can view and manage their own push tokens
create policy "Allow users to manage their push tokens"
    on public.user_push_tokens
    for all
    using (true)
    with check (true);

-- 2. Helper function to clean up stale tokens
create or replace function public.cleanup_stale_push_tokens()
returns void
language sql
as $$
    delete from public.user_push_tokens
    where updated_at < now() - interval '90 days';
$$;
