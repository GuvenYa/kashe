-- =============================================================================
-- FAZ -1 / 04 — Tetikleyici fonksiyonlari + RPC (35 + 1)
--
-- KAYNAK: docs/envanter/04-sema-uzlastirma.md (GRUP A = yalniz uretimde olan nesneler)
-- VERI  : docs/envanter/uretim-dokum/*.csv (uretim semasindan alinan dokum)
--
-- GRUP A'daki kalan 35 fonksiyon + handle_updated_at duzeltmesi.
--
-- SIRALAMA: protect_sensitive_profile_fields is_admin'e bagimli -> 02 ONCE kosmali.
--
-- handle_updated_at ISTISNASI (kural 2 — catismada uretim kazanir):
--   Bu fonksiyon GRUP D'dedir (iki tarafta da var) ama tek bilinen govde farki
--   ondadir: uretimde SECURITY DEFINER = false, repoda true. Uretim surumu esas
--   alinip CREATE OR REPLACE ile hizalanir. Kural 4'un (Grup D'ye dokunma) bilincli
--   tek istisnasidir; gerekcesi kural 2'dir.
--
-- protect_sensitive_profile_fields GOVDE KAYNAGI:
--   fonksiyon-govdeleri-*.csv icinde YOK. Govde docs/architecture/04-goc-plani.md
--   FAZ -1 bolumunden alindi (uretimden cekilip oraya islenmisti).
--   Kara liste, 7 alan: is_admin, role, approval_status, approved_at,
--   suspended_at, suspension_reason, suspended_by.
--
-- GOVDE (digerleri): fonksiyon-govdeleri-*.csv
--
-- KURALLAR (bu dosyalarin tamaminda gecerli):
--   * VERI DEGISTIRILMEZ — hicbir INSERT/UPDATE/DELETE yoktur, yalniz DDL.
--   * CATISMADA URETIM KAZANIR — govdeler uretim dokumundan birebir alinmistir.
--   * IDEMPOTENT — dosya iki kez kosturulsa da hata vermez.
--   * GRUP D'ye (repoda da uretimde de ayni olan nesneler) DOKUNULMAZ.
--
-- UYGULAMA: Supabase Dashboard > SQL Editor. Terminale yapistirilmaz.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- A) Koruma tetikleyicisi fonksiyonu — is_admin'e bagimli (02'den sonra)
-- Kaynak: docs/architecture/04-goc-plani.md (uretimden alinan tanim)
-- ---------------------------------------------------------------------------
create or replace function public.protect_sensitive_profile_fields()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if public.is_admin(auth.uid()) then return new; end if;

  new.is_admin          := old.is_admin;
  new.role              := old.role;
  new.approval_status   := old.approval_status;
  new.approved_at       := old.approved_at;
  new.suspended_at      := old.suspended_at;
  new.suspension_reason := old.suspension_reason;
  new.suspended_by      := old.suspended_by;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- B) Diger tetikleyici fonksiyonlari
-- ---------------------------------------------------------------------------
-- fn_assignee_added_message
CREATE OR REPLACE FUNCTION public.fn_assignee_added_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  pro_name text;
  agency_id uuid;
begin
  select coalesce(full_name, 'ekibimizden bir profesyonel') into pro_name
    from public.profiles where id = new.professional_id;
  select professional_id into agency_id
    from public.conversations where id = new.conversation_id;

  insert into public.messages (conversation_id, sender_id, message_type, body)
  values (new.conversation_id, agency_id, 'system',
          pro_name || ' talebinizle ilgilenmek üzere eklendi.');
  return new;
end $function$;

-- fn_assignee_removed_message
CREATE OR REPLACE FUNCTION public.fn_assignee_removed_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  remaining int;
  agency_id uuid;
begin
  select count(*) into remaining
    from public.conversation_assignees
    where conversation_id = old.conversation_id;

  if remaining = 0 then
    select professional_id into agency_id
      from public.conversations where id = old.conversation_id;
    insert into public.messages (conversation_id, sender_id, message_type, body)
    values (old.conversation_id, agency_id, 'system',
            'Talebiniz yeniden ajans tarafından yürütülecek.');
  end if;
  return old;
end $function$;

-- fn_remove_assignments_on_leave
CREATE OR REPLACE FUNCTION public.fn_remove_assignments_on_leave()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.conversation_assignees ca
  using public.conversations c
  where ca.conversation_id = c.id
    and ca.professional_id = old.professional_id
    and c.professional_id = old.agency_id;
  return old;
end $function$;

-- notify_quote_request_recipients
CREATE OR REPLACE FUNCTION public.notify_quote_request_recipients(recipient_ids uuid[], notif_link text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  pid uuid;
begin
  foreach pid in array recipient_ids loop
    insert into public.notifications (user_id, type, link, body)
    values (pid, 'message', notif_link, 'Sana yeni bir teklif talebi geldi');
  end loop;
end;
$function$;

-- set_blog_posts_updated_at
CREATE OR REPLACE FUNCTION public.set_blog_posts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- C) handle_updated_at — GRUP D istisnasi (uretim surumu, SECURITY DEFINER=false)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- D) RPC ve yardimci fonksiyonlar (29)
-- ---------------------------------------------------------------------------
-- admin_booking_daily
CREATE OR REPLACE FUNCTION public.admin_booking_daily(p_days integer DEFAULT 30)
 RETURNS TABLE(bucket date, gmv numeric, cnt bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    created_at::date as bucket,
    coalesce(sum(total_amount) filter (where status in ('confirmed','completed')), 0) as gmv,
    count(*) filter (where status in ('confirmed','completed')) as cnt
  from bookings
  where created_at >= now() - (p_days || ' days')::interval
  group by created_at::date
  order by created_at::date
$function$;

-- admin_booking_summary
CREATE OR REPLACE FUNCTION public.admin_booking_summary(p_days integer DEFAULT 30)
 RETURNS TABLE(total_count bigint, confirmed_count bigint, completed_count bigint, cancelled_count bigint, gmv numeric, avg_value numeric, cancelled_value numeric)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with scoped as (
    select * from bookings
    where created_at >= now() - (p_days || ' days')::interval
  )
  select
    count(*),
    count(*) filter (where status = 'confirmed'),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'cancelled'),
    coalesce(sum(total_amount) filter (where status in ('confirmed','completed')), 0),
    coalesce(avg(total_amount) filter (where status in ('confirmed','completed')), 0),
    coalesce(sum(total_amount) filter (where status = 'cancelled'), 0)
  from scoped
$function$;

-- admin_funnel_client
CREATE OR REPLACE FUNCTION public.admin_funnel_client()
 RETURNS TABLE(step integer, label text, cnt bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with clients as (
    select id from profiles where role in ('client', 'business')
  )
  select 1 as step, 'Kayıt oldu' as label, (select count(*) from clients) as cnt
  union all
  select 2, 'İlan açtı',
    (select count(distinct creator_id) from listings
      where creator_id in (select id from clients))
  union all
  select 3, 'Başvuru aldı',
    (select count(distinct l.creator_id) from listings l
      join applications a on a.listing_id = l.id
      where l.creator_id in (select id from clients))
  union all
  select 4, 'Mesajlaşma başlattı',
    (select count(distinct customer_id) from conversations
      where customer_id in (select id from clients))
  union all
  select 5, 'Rezervasyon yaptı',
    (select count(distinct customer_id) from bookings
      where customer_id in (select id from clients))
  order by 1;
$function$;

-- admin_funnel_professional
CREATE OR REPLACE FUNCTION public.admin_funnel_professional()
 RETURNS TABLE(step integer, label text, cnt bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with pros as (
    select id, approval_status, is_published
    from profiles
    where role in ('professional', 'agency')
  )
  select 1 as step, 'Kayıt oldu' as label, (select count(*) from pros) as cnt
  union all
  select 2, 'Profil tamamladı', (select count(*) from pros where approval_status = 'approved')
  union all
  select 3, 'Profili yayınladı', (select count(*) from pros where is_published = true)
  union all
  select 4, 'İlana başvurdu',
    (select count(distinct applicant_id) from applications
      where applicant_id in (select id from pros))
  union all
  select 5, 'İş aldı',
    (select count(distinct applicant_id) from applications
      where status = 'accepted' and applicant_id in (select id from pros))
  order by 1;
$function$;

-- admin_ops_application_response
CREATE OR REPLACE FUNCTION public.admin_ops_application_response(p_days integer DEFAULT 30)
 RETURNS TABLE(avg_hours numeric, median_hours numeric, responded_count bigint, total_count bigint, pending_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with scoped as (
    select * from applications
    where created_at >= now() - (p_days || ' days')::interval
  ),
  diffs as (
    select extract(epoch from (responded_at - created_at)) / 3600.0 as hours
    from scoped
    where responded_at is not null and responded_at >= created_at
  )
  select
    coalesce(round((select avg(hours) from diffs)::numeric, 1), 0),
    coalesce(round((select percentile_cont(0.5) within group (order by hours) from diffs)::numeric, 1), 0),
    (select count(*) from scoped where responded_at is not null),
    (select count(*) from scoped),
    (select count(*) from scoped where status = 'pending')
$function$;

-- admin_ops_listing_to_first_app
CREATE OR REPLACE FUNCTION public.admin_ops_listing_to_first_app(p_days integer DEFAULT 30)
 RETURNS TABLE(avg_hours numeric, median_hours numeric, measured_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with first_app as (
    select
      l.id,
      l.created_at as listing_created,
      min(a.created_at) as first_app_at
    from listings l
    join applications a on a.listing_id = l.id
    where l.created_at >= now() - (p_days || ' days')::interval
    group by l.id, l.created_at
  ),
  diffs as (
    select extract(epoch from (first_app_at - listing_created)) / 3600.0 as hours
    from first_app
    where first_app_at >= listing_created
  )
  select
    coalesce(round(avg(hours)::numeric, 1), 0),
    coalesce(round((percentile_cont(0.5) within group (order by hours))::numeric, 1), 0),
    count(*)
  from diffs
$function$;

-- admin_ops_message_response
CREATE OR REPLACE FUNCTION public.admin_ops_message_response(p_days integer DEFAULT 30)
 RETURNS TABLE(avg_hours numeric, median_hours numeric, measured_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with ranked as (
    select
      conversation_id,
      sender_id,
      created_at,
      row_number() over (partition by conversation_id order by created_at) as rn
    from messages
    where message_type <> 'system'
      and created_at >= now() - (p_days || ' days')::interval
  ),
  first_msg as (
    select conversation_id, sender_id as first_sender, created_at as first_at
    from ranked where rn = 1
  ),
  first_reply as (
    select
      r.conversation_id,
      min(r.created_at) as reply_at
    from ranked r
    join first_msg f on f.conversation_id = r.conversation_id
    where r.sender_id <> f.first_sender
      and r.created_at > f.first_at
    group by r.conversation_id
  ),
  diffs as (
    select extract(epoch from (fr.reply_at - fm.first_at)) / 3600.0 as hours
    from first_reply fr
    join first_msg fm on fm.conversation_id = fr.conversation_id
  )
  select
    coalesce(round(avg(hours)::numeric, 1), 0),
    coalesce(round((percentile_cont(0.5) within group (order by hours))::numeric, 1), 0),
    count(*)
  from diffs
$function$;

-- admin_queue_counts
CREATE OR REPLACE FUNCTION public.admin_queue_counts()
 RETURNS TABLE(pending_profiles bigint, pending_listings bigint, pending_categories bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (select count(*) from profiles where approval_status = 'pending'),
    (select count(*) from listings where status = 'pending_approval'),
    (select count(*) from category_requests where status = 'pending')
$function$;

-- admin_recent_actions
CREATE OR REPLACE FUNCTION public.admin_recent_actions(p_limit integer DEFAULT 30)
 RETURNS TABLE(id uuid, admin_name text, action text, target_type text, target_id uuid, notes text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    a.id,
    coalesce(p.full_name, p.email, 'Bilinmeyen') as admin_name,
    a.action,
    a.target_type,
    a.target_id,
    a.notes,
    a.created_at
  from admin_audit_log a
  left join profiles p on p.id = a.admin_id
  order by a.created_at desc
  limit p_limit
$function$;

-- admin_retention_incomplete_pros
CREATE OR REPLACE FUNCTION public.admin_retention_incomplete_pros()
 RETURNS TABLE(profile_id uuid, name text, category text, approval_status text, is_published boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.id as profile_id,
    coalesce(nullif(p.company_name, ''), p.full_name, 'İsimsiz') as name,
    c.name_tr as category,
    p.approval_status::text,
    p.is_published
  from profiles p
  left join service_categories c on c.id = p.primary_category_id
  where p.role in ('professional', 'agency')
    and (p.approval_status is distinct from 'approved' or p.is_published = false)
  order by p.created_at desc;
$function$;

-- admin_retention_listings_no_apps
CREATE OR REPLACE FUNCTION public.admin_retention_listings_no_apps()
 RETURNS TABLE(listing_id uuid, title text, creator_id uuid, creator_name text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    l.id as listing_id,
    l.title,
    l.creator_id,
    coalesce(nullif(pr.company_name, ''), pr.full_name, 'İsimsiz') as creator_name,
    l.created_at
  from listings l
  join profiles pr on pr.id = l.creator_id
  where l.status = 'published'
    and not exists (
      select 1 from applications a where a.listing_id = l.id
    )
  order by l.created_at desc;
$function$;

-- admin_retention_pros_no_apps
CREATE OR REPLACE FUNCTION public.admin_retention_pros_no_apps()
 RETURNS TABLE(profile_id uuid, name text, category text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.id as profile_id,
    coalesce(nullif(p.company_name, ''), p.full_name, 'İsimsiz') as name,
    c.name_tr as category
  from profiles p
  left join service_categories c on c.id = p.primary_category_id
  where p.role in ('professional', 'agency')
    and p.is_published = true
    and not exists (
      select 1 from applications a where a.applicant_id = p.id
    )
  order by p.created_at desc;
$function$;

-- admin_stats_active_categories
CREATE OR REPLACE FUNCTION public.admin_stats_active_categories()
 RETURNS TABLE(category_id integer, label text, listings_count bigint, applications_count bigint, activity bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    c.id as category_id,
    c.name_tr as label,
    coalesce(l.cnt, 0) as listings_count,
    coalesce(a.cnt, 0) as applications_count,
    coalesce(l.cnt, 0) + coalesce(a.cnt, 0) as activity
  from service_categories c
  left join (
    select category_id as cid, count(*) as cnt
    from listings where status = 'published'
    group by category_id
  ) l on l.cid = c.id
  left join (
    select li.category_id as cid, count(ap.id) as cnt
    from applications ap join listings li on li.id = ap.listing_id
    group by li.category_id
  ) a on a.cid = c.id
  where c.is_active = true
  order by activity desc
  limit 10;
$function$;

-- admin_stats_active_users
CREATE OR REPLACE FUNCTION public.admin_stats_active_users()
 RETURNS TABLE(role_key text, total bigint, active_7d bigint, active_30d bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Yetkisiz erişim';
  end if;
  return query
  select p.role::text, count(*)::bigint,
    count(*) filter (where p.last_seen_at >= now() - interval '7 days')::bigint,
    count(*) filter (where p.last_seen_at >= now() - interval '30 days')::bigint
  from public.profiles p group by p.role order by p.role;
end; $function$;

-- admin_stats_categories
CREATE OR REPLACE FUNCTION public.admin_stats_categories()
 RETURNS TABLE(label text, cnt bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Yetkisiz erişim';
  end if;
  return query
  select coalesce(c.name_tr, 'Belirtilmemiş'), count(*)::bigint
  from public.profiles p
  left join public.service_categories c on c.id = p.primary_category_id
  where p.role in ('professional', 'business')
  group by c.name_tr order by 2 desc;
end; $function$;

-- admin_stats_cities
CREATE OR REPLACE FUNCTION public.admin_stats_cities()
 RETURNS TABLE(label text, cnt bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Yetkisiz erişim';
  end if;
  return query
  select coalesce(ci.name, 'Belirtilmemiş'), count(*)::bigint
  from public.profiles p
  left join public.turkish_cities ci on ci.id = p.city_id
  group by ci.name order by 2 desc;
end; $function$;

-- admin_stats_messages
CREATE OR REPLACE FUNCTION public.admin_stats_messages(p_days integer DEFAULT 30)
 RETURNS TABLE(bucket date, cnt bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Yetkisiz erişim';
  end if;
  return query
  select date_trunc('day', created_at)::date, count(*)::bigint
  from public.messages
  where created_at >= now() - make_interval(days => p_days)
  group by 1 order by 1;
end; $function$;

-- admin_stats_quotes
CREATE OR REPLACE FUNCTION public.admin_stats_quotes()
 RETURNS TABLE(status_key text, cnt bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Yetkisiz erişim';
  end if;
  return query
  select q.status::text, count(*)::bigint
  from public.quotes q group by q.status order by 1;
end; $function$;

-- admin_stats_registrations
CREATE OR REPLACE FUNCTION public.admin_stats_registrations(p_days integer DEFAULT 30)
 RETURNS TABLE(bucket date, role_key text, cnt bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Yetkisiz erişim';
  end if;
  return query
  select date_trunc('day', p.created_at)::date, p.role::text, count(*)::bigint
  from public.profiles p
  where p.created_at >= now() - make_interval(days => p_days)
  group by 1, 2 order by 1, 2;
end; $function$;

-- admin_stats_supply_demand_category
CREATE OR REPLACE FUNCTION public.admin_stats_supply_demand_category()
 RETURNS TABLE(category_id integer, label text, supply bigint, demand bigint, applications bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    c.id as category_id,
    c.name_tr as label,
    coalesce(p.cnt, 0) as supply,
    coalesce(l.cnt, 0) as demand,
    coalesce(a.cnt, 0) as applications
  from service_categories c
  left join (
    select primary_category_id as cid, count(*) as cnt
    from profiles
    where is_published = true
      and role in ('professional', 'agency')
      and primary_category_id is not null
    group by primary_category_id
  ) p on p.cid = c.id
  left join (
    select category_id as cid, count(*) as cnt
    from listings
    where status = 'published'
    group by category_id
  ) l on l.cid = c.id
  left join (
    select li.category_id as cid, count(ap.id) as cnt
    from applications ap
    join listings li on li.id = ap.listing_id
    group by li.category_id
  ) a on a.cid = c.id
  where c.is_active = true
  order by c.sort_order;
$function$;

-- admin_stats_supply_demand_city
CREATE OR REPLACE FUNCTION public.admin_stats_supply_demand_city()
 RETURNS TABLE(city_id integer, label text, supply bigint, demand bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    ct.id as city_id,
    ct.name as label,
    coalesce(p.cnt, 0) as supply,
    coalesce(l.cnt, 0) as demand
  from turkish_cities ct
  left join (
    select city_id as cid, count(*) as cnt
    from profiles
    where is_published = true
      and role in ('professional', 'agency')
      and city_id is not null
    group by city_id
  ) p on p.cid = ct.id
  left join (
    select city_id as cid, count(*) as cnt
    from listings
    where status = 'published' and city_id is not null
    group by city_id
  ) l on l.cid = ct.id
  where coalesce(p.cnt, 0) > 0 or coalesce(l.cnt, 0) > 0
  order by (coalesce(p.cnt,0) + coalesce(l.cnt,0)) desc;
$function$;

-- admin_stats_top_favorited
CREATE OR REPLACE FUNCTION public.admin_stats_top_favorited()
 RETURNS TABLE(profile_id uuid, name text, category text, fav_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.id as profile_id,
    coalesce(nullif(p.company_name, ''), p.full_name, 'İsimsiz') as name,
    c.name_tr as category,
    count(f.id) as fav_count
  from favorites f
  join profiles p on p.id = f.professional_id
  left join service_categories c on c.id = p.primary_category_id
  group by p.id, p.company_name, p.full_name, c.name_tr
  order by fav_count desc
  limit 10;
$function$;

-- admin_stats_top_rated
CREATE OR REPLACE FUNCTION public.admin_stats_top_rated()
 RETURNS TABLE(professional_id uuid, name text, category text, avg_rating numeric, review_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    rs.professional_id,
    coalesce(nullif(p.company_name, ''), p.full_name, 'İsimsiz') as name,
    c.name_tr as category,
    rs.average_rating as avg_rating,
    rs.review_count
  from professional_rating_summary rs
  join profiles p on p.id = rs.professional_id
  left join service_categories c on c.id = p.primary_category_id
  where rs.review_count >= 1
  order by rs.average_rating desc, rs.review_count desc
  limit 10;
$function$;

-- admin_stats_top_viewed
CREATE OR REPLACE FUNCTION public.admin_stats_top_viewed()
 RETURNS TABLE(profile_id uuid, name text, category text, views bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.id as profile_id,
    coalesce(nullif(p.company_name, ''), p.full_name, 'İsimsiz') as name,
    c.name_tr as category,
    coalesce(p.views_count, 0)::bigint as views
  from profiles p
  left join service_categories c on c.id = p.primary_category_id
  where p.is_published = true
    and p.role in ('professional', 'agency')
    and coalesce(p.views_count, 0) > 0
  order by p.views_count desc
  limit 10;
$function$;

-- admin_stats_weekly_compare
CREATE OR REPLACE FUNCTION public.admin_stats_weekly_compare()
 RETURNS TABLE(metric text, this_week bigint, last_week bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with bounds as (
    select
      date_trunc('week', now()) as this_start,
      date_trunc('week', now()) - interval '7 days' as last_start
  )
  select 'kayit' as metric,
    count(*) filter (where p.created_at >= b.this_start) as this_week,
    count(*) filter (where p.created_at >= b.last_start and p.created_at < b.this_start) as last_week
  from profiles p, bounds b
  union all
  select 'ilan',
    count(*) filter (where l.created_at >= b.this_start),
    count(*) filter (where l.created_at >= b.last_start and l.created_at < b.this_start)
  from listings l, bounds b
  union all
  select 'basvuru',
    count(*) filter (where a.created_at >= b.this_start),
    count(*) filter (where a.created_at >= b.last_start and a.created_at < b.this_start)
  from applications a, bounds b
  union all
  select 'rezervasyon',
    count(*) filter (where bk.created_at >= b.this_start),
    count(*) filter (where bk.created_at >= b.last_start and bk.created_at < b.this_start)
  from bookings bk, bounds b
  union all
  select 'mesaj',
    count(*) filter (where m.created_at >= b.this_start),
    count(*) filter (where m.created_at >= b.last_start and m.created_at < b.this_start)
  from messages m, bounds b
  union all
  select 'teklif',
    count(*) filter (where q.created_at >= b.this_start),
    count(*) filter (where q.created_at >= b.last_start and q.created_at < b.this_start)
  from quotes q, bounds b;
$function$;

-- admin_stats_weekly_trend
CREATE OR REPLACE FUNCTION public.admin_stats_weekly_trend()
 RETURNS TABLE(week_start date, kayit bigint, ilan bigint, basvuru bigint, rezervasyon bigint, mesaj bigint, teklif bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with weeks as (
    select generate_series(
      date_trunc('week', now()) - interval '11 weeks',
      date_trunc('week', now()),
      interval '1 week'
    )::date as week_start
  )
  select
    w.week_start,
    (select count(*) from profiles p
      where date_trunc('week', p.created_at)::date = w.week_start) as kayit,
    (select count(*) from listings l
      where date_trunc('week', l.created_at)::date = w.week_start) as ilan,
    (select count(*) from applications a
      where date_trunc('week', a.created_at)::date = w.week_start) as basvuru,
    (select count(*) from bookings bk
      where date_trunc('week', bk.created_at)::date = w.week_start) as rezervasyon,
    (select count(*) from messages m
      where date_trunc('week', m.created_at)::date = w.week_start) as mesaj,
    (select count(*) from quotes q
      where date_trunc('week', q.created_at)::date = w.week_start) as teklif
  from weeks w
  order by w.week_start;
$function$;

-- delete_push_subscription_by_endpoint
CREATE OR REPLACE FUNCTION public.delete_push_subscription_by_endpoint(target_endpoint text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  delete from public.push_subscriptions where endpoint = target_endpoint;
$function$;

-- get_push_subscriptions_for_user
CREATE OR REPLACE FUNCTION public.get_push_subscriptions_for_user(target_user_id uuid)
 RETURNS TABLE(endpoint text, p256dh text, auth text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select endpoint, p256dh, auth
  from public.push_subscriptions
  where user_id = target_user_id;
$function$;

-- increment_profile_views
CREATE OR REPLACE FUNCTION public.increment_profile_views(profile_id_param uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.profiles
  set views_count = views_count + 1
  where id = profile_id_param;
$function$;

COMMIT;
