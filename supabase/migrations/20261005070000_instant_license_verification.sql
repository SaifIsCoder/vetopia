-- Migration: 20261005070000_instant_license_verification.sql
-- Description: Enable instant self-verification for veterinarians by submitting a medical license number.

-- 1. Update vet_verification_guard to allow verification via secure verification workflow
create or replace function public.enforce_vet_verification_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Prevent non-admins from self-verifying on raw INSERT
  if tg_op = 'INSERT' then
    if new.verified is true and not (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      or current_user in ('service_role', 'postgres')
      or current_setting('vetopia.allow_verification', true) = 'true'
    ) then
      raise exception 'Unauthorized: Veterinarian profiles cannot be self-verified upon registration.';
    end if;
  end if;

  -- Prevent non-admins from arbitrary UPDATE on verified status unless using verification RPC
  if tg_op = 'UPDATE' then
    if new.verified is distinct from old.verified and not (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      or current_user in ('service_role', 'postgres')
      or current_setting('vetopia.allow_verification', true) = 'true'
    ) then
      raise exception 'Unauthorized: Only administrators or verified license submissions can modify verification status.';
    end if;
  end if;

  return new;
end;
$$;

-- 2. Secure RPC for instant medical license verification
create or replace function public.verify_doctor_license(license_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _updated_row public.vet_profiles%rowtype;
  _sanitized_license text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: You must be signed in to verify your medical license.';
  end if;

  _sanitized_license := trim(coalesce(license_number, ''));
  if length(_sanitized_license) < 3 then
    raise exception 'Validation error: Medical license number must be at least 3 characters.';
  end if;

  -- Enable bypass flag in current transaction
  perform set_config('vetopia.allow_verification', 'true', true);

  -- Update the veterinarian's own profile to verified = true
  update public.vet_profiles
  set verified = true,
      bio = coalesce(bio, '') || (case when bio is null or length(bio) = 0 then '' else E'\n' end) || '[Verified License: ' || _sanitized_license || ']'
  where user_id = auth.uid()
  returning * into _updated_row;

  if not found then
    raise exception 'Profile not found: No veterinarian profile found for current user account.';
  end if;

  return to_jsonb(_updated_row);
end;
$$;

revoke all on function public.verify_doctor_license(text) from public, anon;
grant execute on function public.verify_doctor_license(text) to authenticated;
