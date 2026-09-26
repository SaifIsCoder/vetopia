-- Migration: 20260923180000_vet_verification_security.sql
-- Description: Enforce strict authorization for veterinarian verification status.
-- Prevents self-verification, unauthorized modification of verified flag, and enables admin approval.

-- 1. Tighten INSERT policy on public.vet_profiles
-- Only allow INSERT with verified = false unless caller is an admin
drop policy if exists "vet creates own profile" on public.vet_profiles;

create policy "vet creates own profile"
on public.vet_profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    verified is false
    or public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- 2. Allow authorized admins to update any vet profile
drop policy if exists "admins update vet profiles" on public.vet_profiles;

create policy "admins update vet profiles"
on public.vet_profiles
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Trigger Guard: fail-safe prevention of unauthorized verification changes
create or replace function public.enforce_vet_verification_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Prevent non-admins from self-verifying on INSERT
  if tg_op = 'INSERT' then
    if new.verified is true and not (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      or current_user = 'service_role'
    ) then
      raise exception 'Unauthorized: Veterinarian profiles cannot be self-verified upon registration.';
    end if;
  end if;

  -- Prevent non-admins from setting or changing verified on UPDATE
  if tg_op = 'UPDATE' then
    if new.verified is distinct from old.verified and not (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      or current_user = 'service_role'
    ) then
      raise exception 'Unauthorized: Only administrators can modify veterinarian verification status.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists vet_verification_guard on public.vet_profiles;
create trigger vet_verification_guard
  before insert or update on public.vet_profiles
  for each row
  execute function public.enforce_vet_verification_guard();

-- 4. Secure RPC for administrator vet verification/approval
create or replace function public.approve_vet(target_vet_id uuid, approve_status boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.vet_profiles%rowtype;
begin
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or current_user = 'service_role'
  ) then
    raise exception 'Unauthorized: Only administrators can approve or verify veterinarians.';
  end if;

  update public.vet_profiles
  set verified = approve_status
  where id = target_vet_id
  returning * into updated_row;

  if not found then
    raise exception 'Veterinarian profile not found for id %', target_vet_id;
  end if;

  return to_jsonb(updated_row);
end;
$$;

revoke all on function public.approve_vet(uuid, boolean) from public, anon;
grant execute on function public.approve_vet(uuid, boolean) to authenticated;
