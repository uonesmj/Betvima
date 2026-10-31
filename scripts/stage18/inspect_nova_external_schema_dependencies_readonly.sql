-- Stage18B: strict read-only external schema dependencies for NOVA.
-- Never reads profile/customer rows, financial records or secrets.
-- No schema/role/auth/KYC writes.
WITH column_types AS (
 SELECT
   tns.nspname AS required_schema,
   t.typname AS required_object,
   c.relname AS consuming_relation,
   a.attname AS consuming_column,
   t.typtype::text AS type_kind
 FROM pg_attribute a
 JOIN pg_class c ON c.oid=a.attrelid
 JOIN pg_namespace relns ON relns.oid=c.relnamespace
 JOIN pg_type t ON t.oid=a.atttypid
 JOIN pg_namespace tns ON tns.oid=t.typnamespace
 WHERE relns.nspname='nova' AND c.relkind IN ('r','p','v')
   AND a.attnum>0 AND NOT a.attisdropped
   AND tns.nspname NOT IN ('nova','pg_catalog','information_schema')
),
external_fk AS (
 SELECT refns.nspname AS referenced_schema,
        ref.relname AS referenced_table,
        src.relname AS source_table,
        co.conname AS constraint_name
 FROM pg_constraint co
 JOIN pg_class src ON src.oid=co.conrelid
 JOIN pg_namespace srcns ON srcns.oid=src.relnamespace
 JOIN pg_class ref ON ref.oid=co.confrelid
 JOIN pg_namespace refns ON refns.oid=ref.relnamespace
 WHERE srcns.nspname='nova' AND co.contype='f'
 AND refns.nspname<>'nova'
)
SELECT 'external_type' AS dependency_class,required_schema,required_object,
       consuming_relation AS consumer,consuming_column AS detail
FROM column_types
UNION ALL
SELECT 'external_fk',referenced_schema,referenced_table,source_table,constraint_name
FROM external_fk
ORDER BY dependency_class,required_schema,required_object;