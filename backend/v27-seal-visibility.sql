-- Execute no projeto Supabase do site CADASTRO antes de publicar V27.
-- Não altera dados existentes.
alter table public.website_motorcycles
  add column if not exists seal_number text,
  add column if not exists visibility_status text not null default 'available';
update public.website_motorcycles set visibility_status='unavailable'
  where available=false and visibility_status='available';
alter table public.website_motorcycles
  drop constraint if exists website_motorcycles_visibility_status_check;
alter table public.website_motorcycles
  add constraint website_motorcycles_visibility_status_check
  check (visibility_status in ('available','hidden','unavailable'));
-- Permissão para a ADM autenticada, conforme as políticas RLS existentes.
grant update (seal_number, visibility_status) on public.website_motorcycles to authenticated;
