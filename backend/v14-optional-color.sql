alter table public.website_motorcycles drop constraint website_motorcycles_color_check;
alter table public.website_motorcycles add constraint website_motorcycles_color_check check (color='' or length(color) between 2 and 60);
alter table public.website_motorcycles alter column color set default '';
