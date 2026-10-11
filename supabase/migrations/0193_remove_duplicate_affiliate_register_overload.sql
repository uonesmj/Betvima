drop function if exists nova.register_affiliate(
  uuid,
  text,
  text,
  commission_model,
  integer,
  text,
  text,
  bigint
);

select '0193 applied: duplicate public.commission_model overload removed' as result;
