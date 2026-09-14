-- =============================================================================
-- FAZ -1 / Asama 2b — Parmak izi farklarinin ayrintisi (salt okunur)
-- Parmak izi sorgusunda esit cikmayan siniflar: F fonksiyon, I realtime yayin,
-- M uzanti, N tablo yetkileri + dalda kurulmasi gereken K auth tetikleyici, L bucket,
-- S storage.objects politikalari. Once URETIMDE, sonra DALDA kosturulur.
-- =============================================================================
with
f_ham as (
  select 'F1 fonksiyon md5 (ham)' as bolum,
         string_agg(p.proname||'='||left(md5(pg_get_functiondef(p.oid)),8), ' ' order by p.proname) as deger
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where n.nspname = 'public' and d.objid is null and p.prokind = 'f'
),
f_norm as (
  select 'F2 fonksiyon md5 (bosluk/CR normalize)',
         string_agg(p.proname||'='||left(md5(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')),8), ' ' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where n.nspname = 'public' and d.objid is null and p.prokind = 'f'
),
f_cr as (
  select 'F3 govdesinde CR (\r) olan fonksiyonlar',
         coalesce(string_agg(p.proname, ' ' order by p.proname), '(yok)')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc like '%'||chr(13)||'%'
),
yayin as (
  select 'I realtime yayin tablolari',
         coalesce(string_agg(tablename, ' ' order by tablename), '(yok)')
  from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
),
uzanti as (
  select 'M uzantilar',
         string_agg(e.extname||' '||e.extversion||' ('||n.nspname||')', ' | ' order by e.extname)
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
),
yetki_ozet as (
  select 'N1 yetki ozeti: '||grantee,
         count(distinct table_name)||' tablo/view, ayricaliklar: '||string_agg(distinct privilege_type, ',')
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
  group by grantee
),
yetki_tablo as (
  select 'N2 tablo bazinda: '||grantee,
         string_agg(table_name||'['||privs||']', ' ' order by table_name)
  from (
    select grantee, table_name,
           string_agg(left(privilege_type,3), ',' order by privilege_type) as privs
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon','authenticated','service_role')
    group by grantee, table_name
  ) t
  group by grantee
),
varsayilan as (
  select 'N3 varsayilan ayricaliklar (public)',
         coalesce(string_agg(pg_get_userbyid(d.defaclrole)||' '||d.defaclobjtype::text||': '||d.defaclacl::text, ' | '), '(yok)')
  from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
),
auth_tetik as (
  select 'K auth.users tetikleyici',
         coalesce(string_agg(pg_get_triggerdef(t.oid), ' | ' order by t.tgname), '(yok)')
  from pg_trigger t where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
),
bucket as (
  select 'L bucket: '||id,
         'public='||public::text||' limit='||coalesce(file_size_limit::text,'-')||' mime='||coalesce(array_to_string(allowed_mime_types, ','),'-')
  from storage.buckets
),
storage_pol as (
  select 'S storage.objects politikasi: '||policyname,
         cmd||' '||roles::text||' USING('||coalesce(qual,'-')||') CHECK('||coalesce(with_check,'-')||')'
  from pg_policies where schemaname = 'storage' and tablename = 'objects'
)
select * from f_ham
union all select * from f_norm
union all select * from f_cr
union all select * from yayin
union all select * from uzanti
union all select * from yetki_ozet
union all select * from yetki_tablo
union all select * from varsayilan
union all select * from auth_tetik
union all select * from bucket
union all select * from storage_pol
order by 1;
