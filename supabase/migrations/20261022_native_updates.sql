-- ============================================================================
-- Xpresso native (APK) self-updates
-- Run once in the Supabase SQL editor, BEFORE the next CI run publishes a bundle
-- (the publisher now writes min_native_version).
-- Builds on 20261021_live_updates.sql (app_versions table + public app-updates bucket).
-- ============================================================================

alter table public.app_versions
    -- Lowest installed APK versionCode able to run this web bundle. Older installs skip the bundle
    -- and are offered the APK below instead. Bumped by editing android/min-native-version.txt.
    add column if not exists min_native_version integer not null default 1,
    -- versionCode of the APK published with this row (the CI run number).
    add column if not exists native_version integer,
    -- Public URL of that APK in the app-updates bucket (apks/xpresso-<versionCode>.apk).
    add column if not exists apk_url text,
    -- Lowercase hex SHA-256 of the APK. The app verifies it after download.
    add column if not exists apk_sha256 text,
    add column if not exists apk_size bigint;

alter table public.app_versions
    drop constraint if exists app_versions_min_native_positive;
alter table public.app_versions
    add constraint app_versions_min_native_positive check (min_native_version >= 1);

-- RLS is unchanged: the anon key can read rows; only the CI service-role key writes them.
