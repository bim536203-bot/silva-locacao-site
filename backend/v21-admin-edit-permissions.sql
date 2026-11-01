-- Preserve admin_read/admin_update RLS policies; only add missing form-column privileges.
grant update (email, address, house_number, neighborhood)
  on public.website_applications to authenticated;
