-- Compatibility precondition for the pre-existing 0162 migration on a fresh database.
-- The 0162 reset sets the empty starting value to 999, then nextval -> 1000.
-- On existing databases CREATE SEQUENCE IF NOT EXISTS is a no-op.
create sequence if not exists nova.user_numeric_id_seq
  start with 1000
  increment by 1
  minvalue 1
  no cycle;
