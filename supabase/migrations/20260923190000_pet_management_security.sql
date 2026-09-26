-- Migration: 20260923190000_pet_management_security.sql
-- Description: Enforce strict user ownership RLS on public.pets and add optional dob column

-- 1. Ensure schema supports dob (date of birth)
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS dob text;

-- 2. Revoke unauthenticated select on pets to eliminate data leakage
REVOKE SELECT ON public.pets FROM anon;

-- 3. Drop permissive public select policy
DROP POLICY IF EXISTS "pets are publicly viewable" ON public.pets;
DROP POLICY IF EXISTS "pets_select_authorized" ON public.pets;
DROP POLICY IF EXISTS "owner reads own pets" ON public.pets;

-- 4. Create strict ownership-based SELECT policy:
-- Pet parents can only read their own pets; admins can read all
CREATE POLICY "owner reads own pets" ON public.pets
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 5. Ensure INSERT policy restricts ownership to the caller
DROP POLICY IF EXISTS "owner inserts own pets" ON public.pets;
CREATE POLICY "owner inserts own pets" ON public.pets
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- 6. Ensure UPDATE policy allows owners to update only their own pets
DROP POLICY IF EXISTS "owner updates own pets" ON public.pets;
CREATE POLICY "owner updates own pets" ON public.pets
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 7. Ensure DELETE policy allows owners to delete only their own pets
DROP POLICY IF EXISTS "owner deletes own pets" ON public.pets;
CREATE POLICY "owner deletes own pets" ON public.pets
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());
