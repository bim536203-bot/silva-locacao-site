-- Existing admin-only SELECT/UPDATE RLS remains enforced.
grant update (motorcycle_id) on public.website_applications to authenticated;
