-- Execute once in the Supabase SQL editor before deploying V41.
alter table public.website_motorcycles drop constraint if exists website_motorcycles_visibility_status_check;
alter table public.website_motorcycles add constraint website_motorcycles_visibility_status_check check (visibility_status in ('available','hidden','unavailable','disabled'));
alter table public.website_motorcycles add column if not exists cover_photo_index integer not null default 0;
update public.website_motorcycles set cover_photo_index=0 where cover_photo_index<0;
-- Permite ao administrador autenticado escolher a capa sob as políticas RLS já existentes.
grant update (cover_photo_index) on public.website_motorcycles to authenticated;
