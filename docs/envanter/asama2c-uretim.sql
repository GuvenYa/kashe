-- =============================================================================
-- FAZ -1 / Asama 2c — YALNIZ URETIMDE kosturulur (qydsooqmflrrwtgawhsv), salt okunur.
-- 09 dosyasinin son bolumleri ve 04'teki protect_sensitive_profile_fields duzeltmesi
-- icin gereken uretim tanimlari.
-- =============================================================================
with
govde as (
  select 'A protect_sensitive_profile_fields govdesi' as bolum,
         pg_get_functiondef('public.protect_sensitive_profile_fields'::regproc) as deger
),
cron_is as (
  select 'B cron isi: '||jobid||' '||coalesce(jobname,'(adsiz)'),
         'schedule='||schedule||' active='||active::text||' command='||command
  from cron.job
),
fn_acl as (
  select 'C fonksiyon ayricaliklari (proacl)',
         string_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||')='||coalesce(p.proacl::text,'NULL'), ' ;; ' order by p.proname)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
  where n.nspname = 'public' and d.objid is null and p.prokind = 'f'
),
seq as (
  select 'D sequence ayricaliklari',
         coalesce(string_agg(c.relname||'='||coalesce(c.relacl::text,'NULL'), ' ;; ' order by c.relname), '(sequence yok)')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'S'
),
replident as (
  select 'E replica identity (varsayilan disi)',
         coalesce(string_agg(c.relname||'='||c.relreplident::text, ' ' order by c.relname), '(hepsi varsayilan)')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relreplident <> 'd'
),
bucket_ad as (
  select 'F bucket id<>name',
         coalesce(string_agg(id||' -> '||name, ' '), '(hepsi esit)')
  from storage.buckets where id <> name
),
tablo_acl as (
  select 'G tablo/view ACL (ozet)',
         string_agg(distinct coalesce(c.relacl::text,'NULL'), ' ;; ')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','v')
)
select * from govde
union all select * from cron_is
union all select * from fn_acl
union all select * from seq
union all select * from replident
union all select * from bucket_ad
union all select * from tablo_acl
order by 1;
