-- ================================
-- Supabase Art Platform Bootstrap
-- ================================

-- Extensions
create extension if not exists "pgcrypto";   -- gen_random_uuid
create extension if not exists "citext";     -- case-insensitive text (optional)

-- =============
-- Artists table
-- =============
create table if not exists public.artists (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,          -- /artist_page?slug=
  bio             text,
  avatar_url      text,                          -- profile image
  hero_image_url  text,                          -- banner/hero image
  country         text,                          -- e.g., "Ghana"
  region_sub      text,                          -- e.g., "West Africa", "Caribbean", "North America", etc.
  gender          text,                          -- keep as text for flexibility
  is_published    boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Optional helper to auto-touch updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_updated_at_artists on public.artists;
create trigger trg_touch_updated_at_artists
before update on public.artists
for each row execute function public.touch_updated_at();

-- Useful indexes
create index if not exists idx_artists_published on public.artists(is_published);
create index if not exists idx_artists_slug on public.artists(slug);
create index if not exists idx_artists_region on public.artists(region_sub);
create index if not exists idx_artists_country on public.artists(country);

-- =============
-- Artworks table
-- =============
create table if not exists public.artworks (
  id            uuid primary key default gen_random_uuid(),
  artist_id     uuid not null references public.artists(id) on delete cascade,
  title         text not null,
  description   text,
  image_url     text,                     -- artwork image
  year          int,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_touch_updated_at_artworks on public.artworks;
create trigger trg_touch_updated_at_artworks
before update on public.artworks
for each row execute function public.touch_updated_at();

create index if not exists idx_artworks_artist on public.artworks(artist_id);
create index if not exists idx_artworks_published on public.artworks(is_published);

-- ==========
-- RLS (Row Level Security)
-- ==========
alter table public.artists  enable row level security;
alter table public.artworks enable row level security;

-- Public: read only published artists
drop policy if exists "Public read published artists" on public.artists;
create policy "Public read published artists"
  on public.artists
  for select
  using (is_published = true);

-- Authenticated users: can insert/update/delete artists (loosen/tighten later)
drop policy if exists "Auth write artists" on public.artists;
create policy "Auth write artists"
  on public.artists
  for all
  to authenticated
  using (true)
  with check (true);

-- Public: read only published artworks of published artists
drop policy if exists "Public read artworks" on public.artworks;
create policy "Public read artworks"
  on public.artworks
  for select
  using (
    is_published = true
    and exists (
      select 1 from public.artists a
      where a.id = artworks.artist_id and a.is_published = true
    )
  );

-- Authenticated users: can insert/update/delete artworks
drop policy if exists "Auth write artworks" on public.artworks;
create policy "Auth write artworks"
  on public.artworks
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================
-- Storage buckets (create first)
-- ============================
-- In Dashboard > Storage create two buckets:
--   1) artists   (for avatars/hero images)
--   2) artworks  (for artwork images)
-- You can toggle Public ON for simplicity. Below are matching policies:

-- Public read for 'artists' bucket
drop policy if exists "Public read artists bucket" on storage.objects;
create policy "Public read artists bucket"
  on storage.objects for select
  using ( bucket_id = 'artists' );

-- Authenticated write/update/delete for 'artists' bucket
drop policy if exists "Auth write artists bucket" on storage.objects;
create policy "Auth write artists bucket"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'artists' );

drop policy if exists "Auth update artists bucket" on storage.objects;
create policy "Auth update artists bucket"
  on storage.objects for update to authenticated
  using ( bucket_id = 'artists' )
  with check ( bucket_id = 'artists' );

drop policy if exists "Auth delete artists bucket" on storage.objects;
create policy "Auth delete artists bucket"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'artists' );

-- Public read for 'artworks' bucket
drop policy if exists "Public read artworks bucket" on storage.objects;
create policy "Public read artworks bucket"
  on storage.objects for select
  using ( bucket_id = 'artworks' );

-- Authenticated write/update/delete for 'artworks' bucket
drop policy if exists "Auth write artworks bucket" on storage.objects;
create policy "Auth write artworks bucket"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'artworks' );

drop policy if exists "Auth update artworks bucket" on storage.objects;
create policy "Auth update artworks bucket"
  on storage.objects for update to authenticated
  using ( bucket_id = 'artworks' )
  with check ( bucket_id = 'artworks' );

drop policy if exists "Auth delete artworks bucket" on storage.objects;
create policy "Auth delete artworks bucket"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'artworks' );

-- =======================
-- (Optional) slug helper
-- =======================
create or replace function public.slugify(txt text)
returns text language sql immutable as $$
  select regexp_replace(lower(unaccent(coalesce(txt,''))), '[^a-z0-9]+', '-', 'g')
$$;

-- You can generate slug on the client as we do now; or add a trigger if you prefer.
