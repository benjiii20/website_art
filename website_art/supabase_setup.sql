-- ================================
-- Supabase Art Platform Bootstrap (Admins-table model)
-- with "single profile artwork per artist"
-- ================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "unaccent";

-- =============
-- Artists table
-- =============
create table if not exists public.artists (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  bio             text,
  avatar_url      text,
  hero_image_url  text,
  country         text,
  region_sub      text,
  gender          text,
  is_published    boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- touch updated_at (shared)
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
  image_url     text,
  year          int,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Ensure "is_profile" exists (BEFORE creating index) -------------
alter table public.artworks
  add column if not exists is_profile boolean not null default false;

drop trigger if exists trg_touch_updated_at_artworks on public.artworks;
create trigger trg_touch_updated_at_artworks
before update on public.artworks
for each row execute function public.touch_updated_at();

create index if not exists idx_artworks_artist on public.artworks(artist_id);
create index if not exists idx_artworks_published on public.artworks(is_published);
create index if not exists idx_artworks_created_at on public.artworks(created_at);

-- Enforce: at most one profile artwork per artist (partial unique index)
create unique index if not exists uq_artworks_one_profile_per_artist
  on public.artworks(artist_id)
  where is_profile = true;

-- Trigger to auto-unset other profile flags when one is set
create or replace function public.ensure_single_profile_artwork()
returns trigger language plpgsql as $$
begin
  if new.is_profile is true then
    update public.artworks
       set is_profile = false
     where artist_id = new.artist_id
       and id <> new.id
       and is_profile = true;
  end if;

  new.updated_at := coalesce(new.updated_at, now());
  return new;
end $$;

drop trigger if exists trg_single_profile_artwork_ins on public.artworks;
create trigger trg_single_profile_artwork_ins
before insert on public.artworks
for each row execute function public.ensure_single_profile_artwork();

drop trigger if exists trg_single_profile_artwork_upd on public.artworks;
create trigger trg_single_profile_artwork_upd
before update on public.artworks
for each row execute function public.ensure_single_profile_artwork();

-- ==============================
-- Favorites (per-user, per-artist)
-- ==============================
create table if not exists public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  artist_id  uuid not null references public.artists(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, artist_id)
);

alter table public.favorites enable row level security;

-- Drop policies if they exist
drop policy if exists "user can read own favorites" on public.favorites;
drop policy if exists "user can insert own favorites" on public.favorites;
drop policy if exists "user can delete own favorites" on public.favorites;

create policy "user can read own favorites"
on public.favorites
for select
to authenticated
using (user_id = auth.uid());

create policy "user can insert own favorites"
on public.favorites
for insert
to authenticated
with check (user_id = auth.uid());

create policy "user can delete own favorites"
on public.favorites
for delete
to authenticated
using (user_id = auth.uid());

create index if not exists idx_favorites_user on public.favorites(user_id);
create index if not exists idx_favorites_artist on public.favorites(artist_id);

-- ==========================
-- Admins table (Option A)
-- ==========================
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- DROP conflicting policies if present
drop policy if exists "self can read own admin row" on public.admins;
drop policy if exists "admins can manage admins (insert)" on public.admins;
drop policy if exists "admins can manage admins (update)" on public.admins;
drop policy if exists "admins can manage admins (delete)" on public.admins;

-- Read: any signed-in user can check ONLY their own membership
create policy "self can read own admin row"
on public.admins
for select
to authenticated
using (user_id = auth.uid());

-- Write: only existing admins can manage list (split per command)
create policy "admins can manage admins (insert)"
on public.admins
for insert
to authenticated
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "admins can manage admins (update)"
on public.admins
for update
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "admins can manage admins (delete)"
on public.admins
for delete
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- (Optional) bootstrap your first admin — run these 3 lines ONCE, then comment:
-- alter table public.admins disable row level security;
-- insert into public.admins (user_id) values ('400a7b42-8fc1-4a6d-b6e4-155474df67e7');
-- alter table public.admins enable row level security;

-- ==========
-- RLS (Data)
-- ==========
alter table public.artists  enable row level security;
alter table public.artworks enable row level security;

-- DROP old policies that might conflict
drop policy if exists "Public read published artists" on public.artists;
drop policy if exists "Auth select all artists" on public.artists;
drop policy if exists "Auth write artists" on public.artists;

drop policy if exists "Public read artworks" on public.artworks;
drop policy if exists "Auth write artworks" on public.artworks;

drop policy if exists "auth read published artists" on public.artists;
drop policy if exists "auth read published artworks" on public.artworks;
drop policy if exists "admins full access artists" on public.artists;
drop policy if exists "admins full access artworks" on public.artworks;

-- Read: any SIGNED-IN user can read PUBLISHED rows
create policy "auth read published artists"
on public.artists
for select
to authenticated
using (is_published = true);

create policy "auth read published artworks"
on public.artworks
for select
to authenticated
using (
  is_published = true
  and exists (
    select 1 from public.artists a
    where a.id = artworks.artist_id and a.is_published = true
  )
);

-- Admins: FULL CRUD via admins table
create policy "admins full access artists"
on public.artists
for all
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "admins full access artworks"
on public.artworks
for all
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- ============================
-- Storage bucket policies
-- ============================

-- Drop old storage policies (names must match if they existed)
drop policy if exists "Public read artists bucket" on storage.objects;
drop policy if exists "Auth write artists bucket" on storage.objects;
drop policy if exists "Auth update artists bucket" on storage.objects;
drop policy if exists "Auth delete artists bucket" on storage.objects;

drop policy if exists "Public read artworks bucket" on storage.objects;
drop policy if exists "Auth write artworks bucket" on storage.objects;
drop policy if exists "Auth update artworks bucket" on storage.objects;
drop policy if exists "Auth delete artworks bucket" on storage.objects;

drop policy if exists "read artists bucket" on storage.objects;
drop policy if exists "read artworks bucket" on storage.objects;
drop policy if exists "admins write artists bucket (insert)" on storage.objects;
drop policy if exists "admins update artists bucket" on storage.objects;
drop policy if exists "admins delete artists bucket" on storage.objects;
drop policy if exists "admins write artworks bucket (insert)" on storage.objects;
drop policy if exists "admins update artworks bucket" on storage.objects;
drop policy if exists "admins delete artworks bucket" on storage.objects;

-- READ access (public or signed-in — here we allow both)
create policy "read artists bucket"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'artists');

create policy "read artworks bucket"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'artworks');

-- WRITE/UPDATE/DELETE: split per command and check admins table

-- artists bucket
create policy "admins write artists bucket (insert)"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'artists'
  and exists (select 1 from public.admins a where a.user_id = auth.uid())
);

create policy "admins update artists bucket"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'artists'
  and exists (select 1 from public.admins a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'artists'
  and exists (select 1 from public.admins a where a.user_id = auth.uid())
);

create policy "admins delete artists bucket"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'artists'
  and exists (select 1 from public.admins a where a.user_id = auth.uid())
);

-- artworks bucket
create policy "admins write artworks bucket (insert)"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'artworks'
  and exists (select 1 from public.admins a where a.user_id = auth.uid())
);

create policy "admins update artworks bucket"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'artworks'
  and exists (select 1 from public.admins a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'artworks'
  and exists (select 1 from public.admins a where a.user_id = auth.uid())
);

create policy "admins delete artworks bucket"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'artworks'
  and exists (select 1 from public.admins a where a.user_id = auth.uid())
);

-- =======================
-- View: profile image per artist
-- (prefer explicit profile; else newest published)
-- =======================
create or replace view public.v_artist_profile_image as
select
  a.id as artist_id,
  coalesce(p.image_url, l.image_url) as profile_image_url
from public.artists a
left join lateral (
  select aw.image_url
  from public.artworks aw
  where aw.artist_id = a.id
    and aw.is_published = true
    and aw.is_profile  = true
  order by aw.created_at desc
  limit 1
) p on true
left join lateral (
  select aw2.image_url
  from public.artworks aw2
  where aw2.artist_id = a.id
    and aw2.is_published = true
  order by aw2.created_at desc
  limit 1
) l on true;

grant select on public.v_artist_profile_image to authenticated;

-- =======================
-- (Optional) slug helper
-- =======================
create or replace function public.slugify(txt text)
returns text language sql immutable as $$
  select regexp_replace(
           lower(unaccent(coalesce(txt,''))),
           '[^a-z0-9]+', '-', 'g'
         )
$$;
