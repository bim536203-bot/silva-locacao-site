alter table public.website_motorcycles add column if not exists contract_seal_path text;
grant update (contract_seal_path) on public.website_motorcycles to authenticated;
create table if not exists website_private.contract_layouts (
 version text primary key,
 pdf_base64 text not null check (length(pdf_base64)<2000000)
);
alter table website_private.contract_layouts enable row level security;
create policy contract_layout_admin_read on website_private.contract_layouts
 for select to authenticated using ((select website_private.is_admin()));
grant select on website_private.contract_layouts to authenticated;
create or replace function public.website_contract_layout() returns text
language sql stable security invoker set search_path = '' as $$
 select pdf_base64 from website_private.contract_layouts where version='v22';
$$;
revoke all on function public.website_contract_layout() from public,anon;
grant execute on function public.website_contract_layout() to authenticated;
-- Install the sanitized approved PDF separately into website_private.contract_layouts.
-- Never place customer documents or signed reference PDFs in the public repository.
