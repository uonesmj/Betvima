-- BetVima Stage17: metadata-only structural fingerprints.
-- Run with Supabase execute_sql on production and isolated preview separately.
-- Does not read customer rows or function bodies outside aggregate fingerprints.
-- No table, account, KYC, auth, casino rules or database state is changed.
WITH
t AS (
 SELECT c.oid,c.relname,c.relrowsecurity
 FROM pg_class c
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='nova' AND c.relkind='r'
),
cols AS (
 SELECT t.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) AS typ,a.attnotnull
 FROM t JOIN pg_attribute a ON a.attrelid=t.oid
 WHERE a.attnum>0 AND NOT a.attisdropped
),
fn AS (
 SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) AS args,p.prosecdef
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='nova'
),
idx AS (
 SELECT c.relname,i.indexrelid,pg_get_indexdef(i.indexrelid) AS def
 FROM pg_index i JOIN t c ON i.indrelid=c.oid
),
tr AS (
 SELECT t.relname,g.tgname,pg_get_triggerdef(g.oid) AS def
 FROM pg_trigger g JOIN t ON t.oid=g.tgrelid
 WHERE NOT g.tgisinternal
)
SELECT
 (SELECT count(*) FROM t)::int AS table_count,
 (SELECT count(*) FROM cols)::int AS column_count,
 (SELECT count(*) FROM idx)::int AS index_count,
 (SELECT count(*) FROM tr)::int AS custom_trigger_count,
 (SELECT count(*) FROM fn)::int AS routine_count,
 (SELECT count(*) FROM t WHERE relrowsecurity)::int AS table_rls_count,
 (SELECT md5(string_agg(format('%s.%s:%s:%s',relname,attname,typ,attnotnull),E'\n' ORDER BY relname,attnum)) FROM cols) AS column_schema_fingerprint,
 (SELECT md5(string_agg(format('%s(%s):%s',proname,args,prosecdef),E'\n' ORDER BY proname,args)) FROM fn) AS routine_signature_fingerprint,
 (SELECT md5(string_agg(format('%s.%s:%s',relname,tgname,def),E'\n' ORDER BY relname,tgname)) FROM tr) AS trigger_fingerprint,
 (SELECT md5(string_agg(format('%s:%s',relname,def),E'\n' ORDER BY relname,def)) FROM idx) AS index_fingerprint;
