-- Execute no Supabase do site Cadastro antes de publicar a versão 37.
-- Selos independentes das motos; apenas administradores autenticados podem acessar.
create table if not exists public.website_seals (
 id uuid primary key default gen_random_uuid(),
 number text not null unique check (number ~ '^[0-9]+$'),
 image_path text not null unique check (image_path like 'seals/%'),
 created_at timestamptz not null default now()
);
alter table public.website_seals enable row level security;
drop policy if exists website_seals_admin on public.website_seals;
create policy website_seals_admin on public.website_seals for all to authenticated
 using ((select website_private.is_admin()))
 with check ((select website_private.is_admin()));
grant select,insert,update,delete on public.website_seals to authenticated;
-- A política existente website_admin_motorcycle_documents restringe o bucket
-- privado website-motorcycle-documents aos administradores.
