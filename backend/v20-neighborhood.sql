insert into website_private.deployment_function_backups(name,definition) values('website_finalize_before_v20',pg_get_functiondef('public.website_finalize(uuid,jsonb,jsonb)'::regprocedure)) on conflict(name) do nothing;
alter table public.website_applications add column if not exists neighborhood text;
create or replace function public.website_finalize(p_id uuid,p_data jsonb,p_docs jsonb) returns uuid language plpgsql set search_path='' as $$
declare d jsonb;
begin
 if exists(select 1 from public.website_applications where id=p_id) then return p_id;end if;
 if not exists(select 1 from public.website_motorcycles where id=(p_data->>'motorcycle_id')::uuid and available) then raise exception 'Moto indisponível';end if;
 if jsonb_array_length(p_docs)<>2 then raise exception 'Documentos incompletos';end if;
 insert into public.website_applications(id,motorcycle_id,full_name,cpf,birth_date,phone,email,address,house_number,neighborhood,relative_1_name,relative_1_phone,relative_1_relation,relative_2_name,relative_2_phone,relative_2_relation) values(p_id,(p_data->>'motorcycle_id')::uuid,p_data->>'full_name',p_data->>'cpf',(p_data->>'birth_date')::date,p_data->>'phone',p_data->>'email',p_data->>'address',p_data->>'house_number',p_data->>'neighborhood',p_data->>'relative_1_name',p_data->>'relative_1_phone',p_data->>'relative_1_relation',p_data->>'relative_2_name',p_data->>'relative_2_phone',p_data->>'relative_2_relation');
 for d in select value from jsonb_array_elements(p_docs) loop insert into public.website_application_documents(application_id,kind,path,mime_type,size_bytes) values(p_id,d->>'kind',d->>'path',d->>'mime_type',(d->>'size_bytes')::int);end loop;
 insert into public.website_notifications(application_id,customer_name) values(p_id,p_data->>'full_name');
 update website_private.upload_sessions set completed=true where id=p_id;
 return p_id;
end $$;
