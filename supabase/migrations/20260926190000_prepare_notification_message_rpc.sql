-- The following notification migration replaces the original JSONB result with a
-- direct_messages row. PostgreSQL cannot change an existing function's return type.
-- Skip an already-upgraded function when applying this bridge out of order.
do $$
begin
  if exists (
    select 1 from pg_proc
    where oid = to_regprocedure('public.send_direct_message(uuid,text)')
      and prorettype = 'jsonb'::regtype
  ) then
    drop function public.send_direct_message(uuid, text);
  end if;
end;
$$;
