-- =============================================================================
-- FAZ -1 / Asama 2 — Sema parmak izi v2 (salt okunur) — O/P/Q satirlari 14 Eylul'de eklendi
-- Ayni sorgu once URETIMDE (qydsooqmflrrwtgawhsv), sonra DALDA (pkyauwyszvfvbzcgzrdb)
-- kosturulur; iki ciktida "parmak_izi" sutunu satir satir esit olmali.
-- Her satir bir nesne sinifinin normalize edilmis tam tanim listesinin md5'idir;
-- tek bir harf farki bile md5'i degistirir. Esit olmayan sinif icin ayrinti sorgusu ayrica verilir.
-- =============================================================================
with
sutun as (
  select 'A sutun' as kategori, count(*) as adet,
         md5(coalesce(string_agg(
           table_name||'.'||column_name||':'||data_type||':'||udt_name||':'||is_nullable||':'||coalesce(column_default,'-'),
           '|' order by table_name, column_name), '')) as parmak_izi
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (select tablename from pg_tables where schemaname = 'public')
),
kisit as (
  select 'B kisit', count(*),
         md5(coalesce(string_agg(
           c.conrelid::regclass::text||'.'||c.conname||':'||pg_get_constraintdef(c.oid),
           '|' order by c.conrelid::regclass::text, c.conname), ''))
  from pg_constraint c join pg_namespace n on n.oid = c.connamespace
  where n.nspname = 'public'
),
indeks as (
  select 'C indeks', count(*),
         md5(coalesce(string_agg(tablename||'.'||indexname||':'||indexdef, '|' order by tablename, indexname), ''))
  from pg_indexes where schemaname = 'public'
),
politika as (
  select 'D politika', count(*),
         md5(coalesce(string_agg(
           tablename||'.'||policyname||':'||cmd||':'||permissive||':'||roles::text||':'||coalesce(qual,'-')||':'||coalesce(with_check,'-'),
           '|' order by tablename, policyname), ''))
  from pg_policies where schemaname = 'public'
),
tetikleyici as (
  select 'E tetikleyici', count(*),
         md5(coalesce(string_agg(c.relname||'.'||t.tgname||':'||pg_get_triggerdef(t.oid)||':'||t.tgenabled::text,
           '|' order by c.relname, t.tgname), ''))
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
),
fonksiyon as (
  select 'F fonksiyon', count(*),
         md5(coalesce(string_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||pg_get_functiondef(p.oid),
           '|' order by p.proname, pg_get_function_identity_arguments(p.oid)), ''))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where n.nspname = 'public' and d.objid is null and p.prokind = 'f'
),
enum_ as (
  select 'G enum', count(distinct t.typname),
         md5(coalesce(string_agg(t.typname||':'||e.enumlabel||':'||e.enumsortorder::text, '|' order by t.typname, e.enumsortorder), ''))
  from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
),
rls as (
  select 'H rls bayragi', count(*),
         md5(coalesce(string_agg(c.relname||':'||c.relrowsecurity::text||':'||c.relforcerowsecurity::text, '|' order by c.relname), ''))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
yayin as (
  select 'I realtime yayin', count(*),
         md5(coalesce(string_agg(tablename, '|' order by tablename), ''))
  from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
),
view_ as (
  select 'J view', count(*),
         md5(coalesce(string_agg(viewname||':'||definition, '|' order by viewname), ''))
  from pg_views where schemaname = 'public'
),
auth_tetik as (
  select 'K auth.users tetikleyici', count(*),
         md5(coalesce(string_agg(t.tgname||':'||pg_get_triggerdef(t.oid), '|' order by t.tgname), ''))
  from pg_trigger t where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
),
bucket as (
  select 'L storage bucket', count(*),
         md5(coalesce(string_agg(id||':'||public::text, '|' order by id), ''))
  from storage.buckets
),
uzanti as (
  select 'M uzanti', count(*),
         md5(coalesce(string_agg(extname||':'||extversion, '|' order by extname), ''))
  from pg_extension
),
yetki as (
  select 'N tablo yetkileri', count(*),
         md5(coalesce(string_agg(table_name||':'||grantee||':'||privilege_type, '|' order by table_name, grantee, privilege_type), ''))
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
),
replident as (
  select 'O replica identity', count(*),
         md5(coalesce(string_agg(c.relname||':'||c.relreplident::text, '|' order by c.relname), ''))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
fn_acl as (
  select 'P fonksiyon ACL (kume)', count(*),
         md5(coalesce(string_agg(
           p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||
           coalesce((select string_agg(regexp_replace(a::text, '/.*$', ''), ',' order by regexp_replace(a::text, '/.*$', '')) from unnest(p.proacl) a), 'NULL'),
           '|' order by p.proname, pg_get_function_identity_arguments(p.oid)), ''))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where n.nspname = 'public' and d.objid is null and p.prokind = 'f'
),
seq_acl as (
  select 'Q sequence ACL (kume)', count(*),
         md5(coalesce(string_agg(
           c.relname||':'||coalesce((select string_agg(regexp_replace(a::text, '/.*$', ''), ',' order by regexp_replace(a::text, '/.*$', '')) from unnest(c.relacl) a), 'NULL'),
           '|' order by c.relname), ''))
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'S'
)
select * from sutun
union all select * from kisit
union all select * from indeks
union all select * from politika
union all select * from tetikleyici
union all select * from fonksiyon
union all select * from enum_
union all select * from rls
union all select * from yayin
union all select * from view_
union all select * from auth_tetik
union all select * from bucket
union all select * from uzanti
union all select * from yetki
union all select * from replident
union all select * from fn_acl
union all select * from seq_acl
order by 1;
