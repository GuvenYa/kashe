#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# =============================================================================
# SAHNE — sentetik test dunyasi ureteci (bkz. docs/envanter/39-sahne-sentetik-dunya.md)
#   python scripts/sahne/uret.py [--seed 2026] [--out docs/sahne]
# Cikti: docs/sahne/00-sahne-temizlik.sql, 00-sahne-taksonomi.sql, 01a..-sahne-hesaplar.sql, 02a..-sahne-gecmis.sql,
#        03-sahne-hesap.sql, 04-sahne-eslestirme.sql, foto-plan.json, hesaplar.md  (01/02 Dashboard boyut siniri icin parcali)
# Kural: YALNIZ DAL (ukqhgspaallzjscjodbb). Her SQL dosyasinin basinda uretim korumasi vardir.
# Bagimlilik yok (Python 3.9+). Deterministik: ayni tohum -> ayni cikti.
# v2 (29 Ekim 2026, FAZ 10a sonrasi): uyelikler dogrudan organization_memberships (eski agency_members/business_members
#   YAZILMAZ; ayna kalkti), havuz esitleme sync_org_talent_pool, bekleyen/gecmis davetler organization_invitations,
#   katilim/davet bildirimleri gecmise tarihli; kurum alicilarinda kurumsal etkinlik turu + bulunma eki (#26);
#   kategoriye ozel performans metni (#32); etkinlik turu 3-6 (#11); eslestirme gecmisi 04 (#8).
# =============================================================================
import argparse, json, os, random, re, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sahne_veri as V  # noqa: E402

PROJE_URL = "https://ukqhgspaallzjscjodbb.supabase.co"
STORAGE = PROJE_URL + "/storage/v1/object/public"
PAROLA = "Sahne!2026"
ADMIN_N = 90001

# Kaynak konfigurasyonlar (uygulamadan turetildi: scripts/sahne/kaynak/*.json)
def kaynak(ad):
    with open(os.path.join(HERE, "kaynak", ad), encoding="utf-8") as f:
        return json.load(f)

FILTERS = kaynak("filters.json")
CATFIELDS = kaynak("catfields.json")
QUICK = kaynak("quick.json")
SUBSERVICES = kaynak("subservices.json")
BRIEF = kaynak("brief.json")

# ----------------------------------------------------------------------------- yardimcilar
def uid(code, n):
    return "5a4e%04x-0000-4000-8000-%012d" % (code, n)

U_USER, U_EVENT, U_PROP, U_VER, U_ITEM, U_CONV, U_MSG, U_QUOTE, U_BOOK, U_REV, U_REPLY, U_TR, U_TASK, U_QR, U_INV = (
    0x0000, 0x0002, 0x0003, 0x0004, 0x0005, 0x0010, 0x0011, 0x0012, 0x0013, 0x0014, 0x0015, 0x0020, 0x0024, 0x0030, 0x0040)

def q(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def qj(obj):
    return q(json.dumps(obj, ensure_ascii=False)) + "::jsonb"

def arr(lst):
    return "ARRAY[" + ",".join(q(x) for x in lst) + "]::text[]"

def num(x):
    return "NULL" if x is None else ("%g" % x if isinstance(x, float) else str(x))

ASCII = str.maketrans("çğıöşüÇĞİÖŞÜâîû", "cgiosuCGIOSUaiu")

def slugla(s):
    s = s.translate(ASCII).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s

def ilk_harfler(ad):
    p = [x for x in ad.replace("&", " ").split() if x and x[0].isalpha()]
    if not p:
        return "K"
    return (p[0][0] + (p[-1][0] if len(p) > 1 else "")).upper()

RENKLER = ["#1F3A5F", "#5B2A86", "#0F6E56", "#B4532A", "#8A2D3B", "#2F5D8A", "#6B4F1D", "#3C6E47"]

def secim(rnd, agirliklar):
    toplam = sum(agirliklar.values())
    r = rnd.random() * toplam
    for k, w in agirliklar.items():
        r -= w
        if r <= 0:
            return k
    return k

def t(h):
    return "pg_temp.t(%s)" % ("%.2f" % h)

def d(n):
    return "pg_temp.d(%d)" % n

def butce_araligi(tutar):
    if tutar < 5000:
        return "under_5k"
    if tutar < 15000:
        return "5k_15k"
    if tutar < 30000:
        return "15k_30k"
    if tutar < 50000:
        return "30k_50k"
    return "over_50k"

def tur_ad(key):
    return V.ETKINLIK_TURLERI.get(key, "etkinlik").lower()

def ek_de(kelime):
    # Turkce bulunma eki (bulgular #26): son unluye gore a/e, sert unsuzden (p c t k s s h f) sonra t: Istanbul'da, Izmir'de, Gaziantep'te
    k = kelime.strip()
    son = k[-1].lower() if k else "e"
    unlu = "e"
    for ch in reversed(k.lower()):
        if ch in "aeıioöuüâîû":
            unlu = "a" if ch in "aıouâû" else "e"
            break
    return "'" + ("t" if son in "pçtksşhf" else "d") + unlu

def yuvarla(x, adim=500):
    return int(round(x / adim) * adim)

# ----------------------------------------------------------------------------- SQL ortak bloklar
GUARD = """DO $$
DECLARE n_cron int := 0; n_prof int;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM cron.job WHERE jobname = ''send-message-notifications''' INTO n_cron;
  END IF;
  SELECT count(*) INTO n_prof FROM public.profiles WHERE email NOT LIKE 'faz1test+%' AND email NOT LIKE 'sahne+%';
  IF n_cron > 0 OR n_prof > 10 THEN
    RAISE EXCEPTION 'URETIM KORUMASI: bu veritabani uretim gibi gorunuyor (cron=%, test disi profil=%). Sahne yalniz dalda (ukqhgspaallzjscjodbb) kurulur. Hicbir sey yazilmadi.', n_cron, n_prof;
  END IF;
END $$;
"""

TEMP_FN = """CREATE OR REPLACE FUNCTION pg_temp.t(h numeric) RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT now() - (h * interval '1 hour') $$;
CREATE OR REPLACE FUNCTION pg_temp.d(n int) RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date + n $$;
CREATE OR REPLACE FUNCTION pg_temp.kat(s text) RETURNS int LANGUAGE sql STABLE AS $$ SELECT id FROM public.service_categories WHERE slug = s $$;
CREATE OR REPLACE FUNCTION pg_temp.rol(s text) RETURNS int LANGUAGE sql STABLE AS $$ SELECT id FROM public.service_roles WHERE slug = s $$;
CREATE OR REPLACE FUNCTION pg_temp.sehir(s text) RETURNS int LANGUAGE sql STABLE AS $$ SELECT id FROM public.turkish_cities WHERE name = s ORDER BY id LIMIT 1 $$;
CREATE OR REPLACE FUNCTION pg_temp.org(p uuid) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.organizations WHERE legacy_profile_id = p $$;
"""

# FAZ 10a: uyelik satiri dogrudan yazilir; fn_faz10_member_notify sahibe "katildi" bildirimini now() ile yazar -> her satirdan
# sonra o bildirim uyelik zamanina cekilir (14 gunden eskiler okunmus).
UYELIK_DO = """DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
%s
  ) AS v(org, uye, rol, davet_eden, katilim) LOOP
    INSERT INTO public.organization_memberships (organization_id, user_id, role, status, invited_by, joined_at, created_at, updated_at)
    VALUES (r.org, r.uye::uuid, r.rol::public.organization_member_role, 'active', r.davet_eden::uuid, r.katilim, r.katilim, r.katilim)
    ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active', joined_at = EXCLUDED.joined_at;
    UPDATE public.notifications SET created_at = r.katilim,
           read_at = CASE WHEN r.katilim < now() - interval '14 days' THEN r.katilim + interval '4 hours' END
     WHERE id = (SELECT n.id FROM public.notifications n WHERE n.user_id = r.davet_eden::uuid AND n.type = 'team'
                  AND n.created_at > now() - interval '10 minutes' ORDER BY n.created_at DESC LIMIT 1);
  END LOOP;
END $$;"""

# FAZ 10a: davetler dogrudan organization_invitations; bekleyen davette fn_faz10_invitation_notify davetliye bildirim yazar -> davet zamanina cekilir
DAVET_DO = """DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
%s
  ) AS v(id, org, eposta, davetli, davet_eden, rol, durum, mesaj, olusturma, yanit, bitis) LOOP
    INSERT INTO public.organization_invitations (id, organization_id, invited_email, invited_user_id, invited_by_id, role, status,
                                                 invitation_message, created_at, responded_at, expires_at)
    VALUES (r.id::uuid, r.org, r.eposta, r.davetli::uuid, r.davet_eden::uuid, r.rol::public.organization_member_role,
            r.durum::public.organization_invitation_status, r.mesaj, r.olusturma, r.yanit, r.bitis);
    UPDATE public.notifications SET created_at = r.olusturma,
           read_at = CASE WHEN r.olusturma < now() - interval '14 days' THEN r.olusturma + interval '6 hours' END
     WHERE id = (SELECT n.id FROM public.notifications n WHERE n.user_id = r.davetli::uuid AND n.type = 'team'
                  AND n.created_at > now() - interval '10 minutes' ORDER BY n.created_at DESC LIMIT 1);
  END LOOP;
END $$;"""

TEMIZLIK_FN = """CREATE OR REPLACE FUNCTION pg_temp.sahne_temizle() RETURNS text LANGUAGE plpgsql AS $$
DECLARE ids uuid[]; orgs uuid[]; n_u int; n_o int;
BEGIN
  SELECT COALESCE(array_agg(id), '{}') INTO ids FROM (
    SELECT id FROM public.profiles WHERE email LIKE 'sahne+%' UNION SELECT id FROM auth.users WHERE email LIKE 'sahne+%'
    UNION SELECT id FROM public.profiles WHERE id::text LIKE '5a4e0000-%') s;
  SELECT COALESCE(array_agg(id), '{}') INTO orgs FROM public.organizations WHERE legacy_profile_id = ANY(ids);
  n_u := coalesce(array_length(ids, 1), 0); n_o := coalesce(array_length(orgs, 1), 0);
  -- rezervasyon (teklif surumune RESTRICT) -> teklif -> etkinlik
  DELETE FROM public.bookings WHERE customer_id = ANY(ids) OR professional_id = ANY(ids) OR seller_provider_id = ANY(ids)
     OR buyer_organization_id = ANY(orgs) OR cancelled_by = ANY(ids) OR id::text LIKE '5a4e0013-%';
  IF to_regclass('public.proposals') IS NOT NULL THEN
    DELETE FROM public.proposals WHERE seller_organization_id = ANY(orgs) OR buyer_user_id = ANY(ids) OR buyer_organization_id = ANY(orgs) OR id::text LIKE '5a4e0003-%';
  END IF;
  IF to_regclass('public.rfps') IS NOT NULL THEN DELETE FROM public.rfps WHERE organization_id = ANY(orgs); END IF;
  IF to_regclass('public.event_suppliers') IS NOT NULL THEN
    DELETE FROM public.event_suppliers WHERE organization_id = ANY(orgs);
    DELETE FROM public.supplier_shortlists WHERE organization_id = ANY(orgs);
    DELETE FROM public.suppliers WHERE organization_id = ANY(orgs);
  END IF;
  IF to_regclass('public.crm_leads') IS NOT NULL THEN
    DELETE FROM public.crm_leads WHERE organization_id = ANY(orgs);
    DELETE FROM public.contacts WHERE organization_id = ANY(orgs) OR linked_user_id = ANY(ids);
  END IF;
  IF to_regclass('public.tasks') IS NOT NULL THEN
    UPDATE public.tasks SET status = 'cancelled' WHERE organization_id = ANY(orgs) AND status NOT IN ('todo', 'cancelled');
    DELETE FROM public.tasks WHERE organization_id = ANY(orgs);
    DELETE FROM public.activity_logs WHERE organization_id = ANY(orgs) OR actor_user_id = ANY(ids);
  END IF;
  IF to_regclass('public.events') IS NOT NULL THEN
    DELETE FROM public.events WHERE owner_user_id = ANY(ids) OR organization_id = ANY(orgs) OR id::text LIKE '5a4e0002-%';
    DELETE FROM public.event_briefs WHERE created_by_user_id = ANY(ids);
  END IF;
  IF to_regclass('public.organization_talent_records') IS NOT NULL THEN
    DELETE FROM public.organization_talent_records WHERE organization_id = ANY(orgs) OR talent_id = ANY(ids) OR created_by = ANY(ids);
  END IF;
  DELETE FROM public.review_replies WHERE review_id IN (SELECT id FROM public.reviews WHERE customer_id = ANY(ids) OR professional_id = ANY(ids));
  DELETE FROM public.reviews WHERE customer_id = ANY(ids) OR professional_id = ANY(ids);
  DELETE FROM public.messages WHERE conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids)) OR sender_id = ANY(ids);
  DELETE FROM public.quotes WHERE conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids));
  DELETE FROM public.conversation_assignees WHERE conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids)) OR professional_id = ANY(ids);
  DELETE FROM public.conversations WHERE customer_id = ANY(ids) OR professional_id = ANY(ids);
  IF to_regclass('public.quote_requests') IS NOT NULL THEN
    DELETE FROM public.quote_request_recipients WHERE professional_id = ANY(ids) OR request_id IN (SELECT id FROM public.quote_requests WHERE customer_id = ANY(ids));
    DELETE FROM public.quote_requests WHERE customer_id = ANY(ids);
  END IF;
  DELETE FROM public.applications WHERE applicant_id = ANY(ids) OR listing_id IN (SELECT id FROM public.listings WHERE creator_id = ANY(ids));
  DELETE FROM public.listing_invitations WHERE listing_id IN (SELECT id FROM public.listings WHERE creator_id = ANY(ids));
  DELETE FROM public.listings WHERE creator_id = ANY(ids);
  DELETE FROM public.favorites WHERE user_id = ANY(ids) OR professional_id = ANY(ids);
  DELETE FROM public.availability_blocks WHERE profile_id = ANY(ids);
  DELETE FROM public.portfolio_items WHERE profile_id = ANY(ids);
  DELETE FROM public.profile_experiences WHERE profile_id = ANY(ids);
  DELETE FROM public.services WHERE profile_id = ANY(ids);
  IF to_regclass('public.provider_services') IS NOT NULL THEN DELETE FROM public.provider_services WHERE provider_id = ANY(ids); END IF;
  DELETE FROM public.agency_members WHERE agency_id = ANY(ids) OR professional_id = ANY(ids);
  DELETE FROM public.agency_invitations WHERE agency_id = ANY(ids) OR invited_by_id = ANY(ids) OR invited_user_id = ANY(ids);
  IF to_regclass('public.business_members') IS NOT NULL THEN
    DELETE FROM public.business_members WHERE business_id = ANY(ids) OR member_user_id = ANY(ids);
    DELETE FROM public.business_invitations WHERE business_id = ANY(ids) OR invited_by_id = ANY(ids) OR invited_user_id = ANY(ids);
  END IF;
  IF to_regclass('public.organization_memberships') IS NOT NULL THEN
    DELETE FROM public.organization_memberships WHERE organization_id = ANY(orgs) OR user_id = ANY(ids);
    DELETE FROM public.organization_invitations WHERE organization_id = ANY(orgs) OR invited_by_id = ANY(ids) OR invited_user_id = ANY(ids);
  END IF;
  IF to_regclass('public.trust_appeals') IS NOT NULL THEN
    DELETE FROM public.trust_appeals WHERE provider_id = ANY(ids);
    DELETE FROM public.trust_score_snapshots WHERE provider_id = ANY(ids);
  END IF;
  IF to_regclass('public.analytics_events') IS NOT NULL THEN
    DELETE FROM public.analytics_events WHERE actor_user_id = ANY(ids) OR provider_id = ANY(ids) OR organization_id = ANY(orgs) OR entity_id::text LIKE '5a4e%';
  END IF;
  IF to_regclass('internal.access_audit') IS NOT NULL THEN DELETE FROM internal.access_audit WHERE actor_user_id = ANY(ids); END IF;
  DELETE FROM public.notifications WHERE user_id = ANY(ids);
  DELETE FROM public.push_subscriptions WHERE user_id = ANY(ids);
  DELETE FROM public.admin_audit_log WHERE admin_id = ANY(ids) OR target_id = ANY(ids);
  DELETE FROM public.reports WHERE reporter_id = ANY(ids) OR target_id = ANY(ids);
  DELETE FROM public.organizations WHERE id = ANY(orgs);
  IF to_regclass('public.providers') IS NOT NULL THEN DELETE FROM public.providers WHERE id = ANY(ids); END IF;
  IF to_regclass('public.talents') IS NOT NULL THEN DELETE FROM public.talents WHERE user_id = ANY(ids) OR id = ANY(ids); END IF;
  DELETE FROM public.profiles WHERE id = ANY(ids);
  DELETE FROM auth.users WHERE id = ANY(ids);
  RETURN format('%s hesap, %s kurulus silindi', n_u, n_o);
END $$;
"""

# ----------------------------------------------------------------------------- dunya
class Dunya:
    def __init__(self, seed):
        self.rnd = random.Random(seed)
        self.kullanicilar = []  # hepsi
        self.prolar, self.ajanslar, self.kurumlar, self.kurum_uyeleri, self.musteriler = [], [], [], [], []
        self.email_set = set()
        self.slug_set = set()
        self.sayac = {}
        self.kur()

    def say(self, k):
        self.sayac[k] = self.sayac.get(k, 0) + 1
        return self.sayac[k]

    def benzersiz(self, taban, kume):
        s = taban
        i = 2
        while s in kume:
            s = "%s-%d" % (taban, i)
            i += 1
        kume.add(s)
        return s

    def sehir_sec(self):
        return secim(self.rnd, {s: w for s, _, w in V.SAHNE_SEHIRLER})

    def kisi(self, kadin_orani):
        kadin = self.rnd.random() < kadin_orani
        ad = self.rnd.choice(V.KADIN_ADLAR if kadin else V.ERKEK_ADLAR)
        soyad = self.rnd.choice(V.SOYADLAR)
        return ad, soyad, kadin

    def kur(self):
        rnd = self.rnd
        # --- profesyoneller
        n = 10000
        for slug, meta in V.KATEGORILER.items():
            for i in range(meta["sayi"]):
                n += 1
                ad, soyad, kadin = self.kisi(meta["kadin"])
                full = "%s %s" % (ad, soyad)
                base = slugla(full)
                eslug = self.benzersiz(base, self.email_set)
                sehir = self.sehir_sec()
                yil = rnd.choice([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16])
                kat2 = None
                if rnd.random() < 0.25 and slug in V.IKINCI_ROL:
                    kat2 = rnd.choice(V.IKINCI_ROL[slug])
                p = dict(n=n, id=uid(U_USER, n), tip="pro", ad=ad, soyad=soyad, full=full, kadin=kadin, slug=eslug,
                         email="sahne+%s@kashe.net" % eslug, kat=slug, kat2=kat2, sehir=sehir,
                         ilce=rnd.choice(V.ILCELER[sehir]), yil=yil, telefon="+9053%08d" % rnd.randint(10000000, 99999999),
                         kayit_saat=rnd.uniform(24 * 30, 24 * 540), durum="approved", yayinda=True,
                         dogrulama=secim(rnd, {"none": 35, "email": 40, "document": 18, "full": 7}), premium="none",
                         uzmanlik=rnd.choice(V.UZMANLIK[slug]), teslim=rnd.choice(V.TESLIM),
                         son_gorulme=rnd.uniform(0.5, 24 * 20))
                self.prolar.append(p)
        # durum dagilimi: 8 pending, 3 revision, 2 rejected, 2 suspended, 10 premium
        karisik = self.prolar[:]
        rnd.shuffle(karisik)
        for p in karisik[0:8]:
            p.update(durum="pending", yayinda=False, kayit_saat=rnd.uniform(24, 24 * 20), dogrulama="none")
        for p in karisik[8:11]:
            p.update(durum="revision", yayinda=False, kayit_saat=rnd.uniform(24 * 5, 24 * 40))
        for p in karisik[11:13]:
            p.update(durum="rejected", yayinda=False)
        for p in karisik[13:15]:
            p.update(askida=True)
        for p in karisik[15:19]:
            p.update(yayinda=False)  # onayli ama yayinda degil
        for p in karisik[19:29]:
            if p["durum"] == "approved":
                p["premium"] = "premium"
        # --- ajanslar
        n = 20000
        for a in V.AJANSLAR:
            n += 1
            ad, soyad, kadin = self.kisi(0.5)
            self.email_set.add(a["slug"])
            p = dict(n=n, id=uid(U_USER, n), tip="ajans", ad=ad, soyad=soyad, full="%s %s" % (ad, soyad), kadin=kadin,
                     slug=a["slug"], email="sahne+%s@kashe.net" % a["slug"], sirket=a["ad"], kat=a["kat"], kat2=None,
                     sehir=a["sehir"], ilce=rnd.choice(V.ILCELER[a["sehir"]]), yil=rnd.choice([6, 8, 10, 12, 14]),
                     telefon="+9021%08d" % rnd.randint(10000000, 99999999), kayit_saat=rnd.uniform(24 * 60, 24 * 540),
                     durum="approved", yayinda=True, dogrulama=rnd.choice(["document", "full", "email"]), premium=a["premium"],
                     hakkinda=a["hakkinda"], odak=a["odak"], ekip=a["ekip"], uyeler=[], son_gorulme=rnd.uniform(0.5, 24 * 10))
            self.ajanslar.append(p)
        # --- kurumlar + uyeleri
        n = 30000
        for k in V.KURUMLAR:
            n += 1
            ad, soyad, kadin = self.kisi(0.5)
            self.email_set.add(k["slug"])
            p = dict(n=n, id=uid(U_USER, n), tip="kurum", ad=ad, soyad=soyad, full="%s %s" % (ad, soyad), kadin=kadin,
                     slug=k["slug"], email="sahne+%s@kashe.net" % k["slug"], sirket=k["ad"], sektor=k["sektor"], kat=None, kat2=None,
                     sehir=k["sehir"], ilce=rnd.choice(V.ILCELER[k["sehir"]]), telefon="+9021%08d" % rnd.randint(10000000, 99999999),
                     kayit_saat=rnd.uniform(24 * 30, 24 * 400), durum="approved", yayinda=False, dogrulama="none", premium="none",
                     turler=k["turler"], uyeler=[], son_gorulme=rnd.uniform(1, 24 * 15))
            self.kurumlar.append(p)
        n = 31000
        for k in self.kurumlar:
            n += 1
            ad, soyad, kadin = self.kisi(0.5)
            eslug = self.benzersiz(slugla("%s %s" % (ad, soyad)), self.email_set)
            p = dict(n=n, id=uid(U_USER, n), tip="kurum_uye", ad=ad, soyad=soyad, full="%s %s" % (ad, soyad), kadin=kadin, slug=eslug,
                     email="sahne+%s@kashe.net" % eslug, kurum=k, kat=None, kat2=None, sehir=k["sehir"], ilce=k["ilce"],
                     telefon="+9053%08d" % rnd.randint(10000000, 99999999), kayit_saat=k["kayit_saat"] - rnd.uniform(24, 24 * 20),
                     durum="approved", yayinda=False, dogrulama="none", premium="none", son_gorulme=rnd.uniform(1, 24 * 30))
            k["uyeler"].append(p)
            self.kurum_uyeleri.append(p)
        # --- musteriler
        n = 40000
        for i in range(20):
            n += 1
            ad, soyad, kadin = self.kisi(0.5)
            eslug = self.benzersiz(slugla("%s %s" % (ad, soyad)), self.email_set)
            sehir = self.sehir_sec()
            p = dict(n=n, id=uid(U_USER, n), tip="musteri", ad=ad, soyad=soyad, full="%s %s" % (ad, soyad), kadin=kadin, slug=eslug,
                     email="sahne+%s@kashe.net" % eslug, kat=None, kat2=None, sehir=sehir, ilce=rnd.choice(V.ILCELER[sehir]),
                     telefon="+9053%08d" % rnd.randint(10000000, 99999999), kayit_saat=rnd.uniform(24 * 10, 24 * 300),
                     durum="approved", yayinda=False, dogrulama="none", premium="none", son_gorulme=rnd.uniform(1, 24 * 40))
            self.musteriler.append(p)
        # --- admin
        self.admin = dict(n=ADMIN_N, id=uid(U_USER, ADMIN_N), tip="admin", ad="Kashe", soyad="Yönetim", full="Kashe Yönetim", kadin=False,
                          slug="admin", email="sahne+admin@kashe.net", kat=None, kat2=None, sehir="İstanbul", ilce="Şişli", telefon=None,
                          kayit_saat=24 * 600, durum="approved", yayinda=False, dogrulama="none", premium="none", son_gorulme=1)
        self.kullanicilar = self.prolar + self.ajanslar + self.kurumlar + self.kurum_uyeleri + self.musteriler + [self.admin]
        # --- ajans ekipleri (yalniz onayli + askida olmayan profesyoneller)
        uygun = [p for p in self.prolar if p["durum"] == "approved" and not p.get("askida")]
        uyelik = {}
        for a in self.ajanslar:
            adaylar = [p for p in uygun if p["kat"] in a["odak"] and uyelik.get(p["id"], 0) < 2 and p["id"] not in [u["id"] for u in a["uyeler"]]]
            # ayni sehir tercih edilir
            adaylar.sort(key=lambda p: (0 if p["sehir"] == a["sehir"] else 1, rnd.random()))
            secilen = adaylar[: a["ekip"]]
            for i, p in enumerate(secilen):
                uyelik[p["id"]] = uyelik.get(p["id"], 0) + 1
                rol = "manager" if i == 0 else "member"
                a["uyeler"].append(dict(p=p, rol=rol, katilim=rnd.uniform(24 * 10, min(a["kayit_saat"], p["kayit_saat"]) - 24)))
        # --- dis (harici) havuz kayitlari: ajans basina 2-4
        for a in self.ajanslar:
            a["harici"] = []
            for i in range(rnd.randint(2, 4)):
                ad, soyad, kadin = self.kisi(0.5)
                a["harici"].append(dict(ad="%s %s" % (ad, soyad), kat=rnd.choice(a["odak"]), sehir=a["sehir"],
                                        email="%s.%s@example.com" % (slugla(ad), slugla(soyad)), telefon="+9054%08d" % rnd.randint(10000000, 99999999)))

    def pro_bul(self, pid):
        for p in self.prolar:
            if p["id"] == pid:
                return p
        return None


def paketle(L, out, onek, baslik, D, onkosul_sonraki, SINIR=380_000):
    # ardisik ifadeler <= SINIR baytlik parcalara; her parca kendi korumasi + pg_temp yardimcilari + on kosuluyla
    # (Dashboard SQL Editor ~1 MB uzeri sorguyu reddeder; 380 KB guvenli). Tek parca sigarsa dosya adi harfsiz kalir.
    parcalar, cur, boy = [], [], 0
    for ifade in L:
        b = len(ifade.encode("utf-8")) + 2
        if cur and boy + b > SINIR:
            parcalar.append(cur); cur, boy = [], 0
        cur.append(ifade); boy += b
    if cur:
        parcalar.append(cur)
    harfler = "abcdefghijklmnop"
    tek = len(parcalar) == 1
    adlar = [("%s-%s.sql" % (onek, baslik)) if tek else ("%s%s-%s.sql" % (onek, harfler[i], baslik)) for i in range(len(parcalar))]
    for i, parca in enumerate(parcalar):
        etiket = onek if tek else "%s%s" % (onek, harfler[i])
        bas = ["\n".join(["-- =============================================================================",
                          "-- SAHNE %s (%d/%d) — %s (YALNIZ DALDA)" % (etiket, i + 1, len(parcalar), D.aciklama[onek]),
                          "-- Uretildi: scripts/sahne/uret.py (tohum %d, %s). Sira: %s (hepsi, atlamadan). Ilk parca kendi verisini silip yeniden baslar." % (
                              D.seed, D.tarih, " -> ".join(a.replace(".sql", "") for a in adlar)),
                          "-- ============================================================================="]), GUARD, TEMP_FN]
        if i > 0:
            bas.append(onkosul_sonraki(harfler[i - 1]))
        son = ["SELECT %s AS parca, 'tamam' AS durum;" % q("%s %d/%d" % (etiket, i + 1, len(parcalar)))] if i < len(parcalar) - 1 else []
        with open(os.path.join(out, adlar[i]), "w", encoding="utf-8") as f:
            f.write("\n\n".join(bas + parca + son) + "\n")
    return adlar

# ----------------------------------------------------------------------------- 01 hesaplar
def deneyim_seviye(yil):
    return "junior" if yil < 2 else "mid" if yil < 5 else "senior" if yil < 10 else "expert"

def attributes_uret(rnd, slug, p):
    out = {}
    for f in FILTERS[slug]["fields"]:
        if f["key"] == "experience":
            out["experience"] = deneyim_seviye(p["yil"])
        elif f["key"] == "gender":
            out["gender"] = "female" if p["kadin"] else "male"
        elif f["key"] == "age_group":
            out["age_group"] = rnd.choice([o for o in f["options"] if o not in ("child", "teen")]) if f["type"] == "single" else rnd.sample(f["options"], 2)
        elif f["type"] == "multi":
            k = rnd.randint(1, min(4, len(f["options"])))
            out[f["key"]] = rnd.sample(f["options"], k)
        else:
            out[f["key"]] = rnd.choice(f["options"])
    return out

def category_attributes_uret(rnd, slug, p):
    cf = CATFIELDS[slug]
    qo = QUICK["QUICK_OPTIONS_BY_SLUG"].get(slug, {})
    qm = QUICK["QUICK_MULTI_OPTIONS"]
    quick = {}
    for key in cf["quickInfo"]:
        if key in qm:
            opts = qm[key]["options"]
            quick[key] = rnd.sample(opts, rnd.randint(1, min(3, len(opts))))
        elif key in qo:
            quick[key] = rnd.choice(qo[key])
        elif key == "yeminli":
            if rnd.random() < 0.5:
                quick[key] = "Evet"
        elif key == "ceviri_turleri":
            quick[key] = rnd.sample(qm["ceviri_turleri"]["options"], 2)
    logistics = {}
    for lg in cf["logistics"]:
        if rnd.random() < 0.7:
            logistics[lg["key"]] = True
    diller = rnd.choice(V.DILLER["tercuman" if slug == "tercuman" else "varsayilan"])
    modules = {}
    for m in cf["modules"]:
        k = m["key"]
        if k == "repertuar":
            modules[k] = {"genres": rnd.sample(["Pop", "House", "Techno", "Retro", "Latin", "Türkçe Pop", "Caz", "R&B", "Rock"], 3), "notes": "Repertuvar etkinliğe göre birlikte netleştirilir."}
        elif k == "ekipman":
            items = rnd.choice(V.EKIPMAN.get(slug, [["Kendi ekipmanı", "Yedek set"]]))
            modules[k] = {"items": items, "venue_requirements": "Sahne yakınında 2 adet 16A priz, kurulum için 60 dk."}
        elif k == "performans":
            # v2 (#32): kategoriye ozel metin; sozlukte olmayan kategori icin genel metin
            secenekler = V.PERFORMANS_METNI.get(slug)
            if secenekler:
                bekle, kurulum, ek = rnd.choice(secenekler)
            else:
                bekle = "Giriş, ana program ve kapanış olmak üzere üç bölümlü bir akış; müzik ve kostüm seçimi etkinliğe göre uyarlanır."
                kurulum = "Mekana 90 dk önce varış, ses kontrolü ve sahne ölçüsü kontrolü."
                ek = {}
            details = {"Gösteri süresi": quick.get("gosteri_suresi", "45 dk"), "Kişi sayısı": quick.get("ekip_boyutu", "Solo"), "Prova": "İsteğe bağlı"}
            details.update(ek)
            modules[k] = {"details": details, "what_to_expect": bekle, "setup_logistics": kurulum}
        elif k == "fiziksel":
            modules[k] = {"oynayabildigi_yas_araligi": rnd.choice(["20–30", "25–35", "30–45", "18–25"]), "height": str(rnd.randint(160, 190)),
                          "size": rnd.choice(["S", "M", "L", "36", "38", "40"]), "shoe": str(rnd.randint(36, 45)),
                          "hair": rnd.choice(["Siyah", "Kahverengi", "Sarı", "Kızıl"]), "eyes": rnd.choice(["Kahverengi", "Yeşil", "Mavi", "Ela"])}
        elif k == "sosyal_erisim":
            plats = [{"platform": "Instagram", "followers_range": rnd.choice(["10B altı", "10–50B", "50–250B", "250B+"])}]
            if rnd.random() < 0.5:
                plats.append({"platform": rnd.choice(["TikTok", "YouTube", "X"]), "followers_range": rnd.choice(["10B altı", "10–50B", "50–250B"])})
            modules[k] = {"platforms": plats}
        elif k == "diller_belgeler":
            modules[k] = {"language_pairs": diller}
        elif k == "uzmanlik_alanlari":
            alanlar = [s[0] for s in SUBSERVICES[slug]]
            modules[k] = {"areas": rnd.sample(alanlar, min(4, len(alanlar)))}
        elif k == "calisma_parametreleri":
            modules[k] = {"params": {"Minimum süre": rnd.choice(["2 saat", "4 saat", "Yarım gün", "Tam gün"]), "Şehir dışı": rnd.choice(["Ulaşım + konaklama müşteriye ait", "Türkiye geneli, ulaşım dahil"]), "Ödeme": "%30 kapora, kalan etkinlik günü"},
                          "notes": "Hafta sonu ve resmi tatil için önceden rezervasyon önerilir."}
        elif k == "teknik_teslimat":
            modules[k] = {"delivery": {"Teslim süresi": quick.get("teslim_suresi", p["teslim"]), "Format": rnd.choice(["4K + 1080p", "JPEG + RAW", "Online galeri + USB", "MP4 H.264"]), "Yedekleme": "Çift kart + bulut"}}
    out = {"service_region": rnd.choice(QUICK["SERVICE_REGION_OPTIONS"]), "experience_label": "%d yıl · %d+ etkinlik" % (p["yil"], p["yil"] * rnd.randint(15, 40)),
           "calisma_sekli": rnd.choice(QUICK["CALISMA_SEKLI_OPTIONS"]), "quick": quick, "logistics": logistics, "modules": modules}
    if cf["archetype"] == "uzmanlik":
        out["summary"] = {"title": rnd.choice(V.BASLIK[slug]), "body": "Kurumun hedefine göre uyarlanan içerik, net teslimat ve zamanında raporlama.",
                          "stats": [{"label": "Yıl", "value": str(p["yil"])}, {"label": "Etkinlik", "value": "%d+" % (p["yil"] * 20)}, {"label": "Şehir", "value": str(rnd.randint(3, 15))}]}
    if cf["archetype"] == "cast":
        out["skills"] = [{"name": s, "level": rnd.randint(1, 3)} for s in rnd.sample(["Dans", "Şarkı", "Yüzme", "Binicilik", "İngilizce aksan", "Doğaçlama", "Gitar", "Dövüş sanatı"], 3)]
    return out

def etkinlik_turleri_uret(rnd, u):
    # kategorinin tur agirliklarindan 2-5 anahtar (agirlik sirasiyla onde gelenler daha olasi); ajans odak kategorilerinin birlesimi
    katlar = [u["kat"]] + ([u["kat2"]] if u.get("kat2") else []) + (u.get("odak", []) if u["tip"] == "ajans" else [])
    agirlik = {}
    for k in katlar:
        for tur, w in V.KATEGORILER[k]["turler"].items():
            agirlik[tur] = agirlik.get(tur, 0) + w
    adet = rnd.randint(3, 5) if u["tip"] == "pro" else rnd.randint(4, 6)   # v2: en az 3 (bulgular #11; Kesfet tur suzgeci / sihirbaz sayaci)
    secilen = []
    kalan = dict(agirlik)
    while kalan and len(secilen) < adet:
        t = secim(rnd, kalan)
        secilen.append(t)
        del kalan[t]
    return secilen

def fiyat_uret(rnd, slug, p, kacinci=0):
    lo, hi = V.KATEGORILER[slug]["fiyat"]
    base = rnd.uniform(lo, hi * 0.6)
    if p["yil"] >= 10:
        base *= 1.3
    pmin = yuvarla(base)
    pmax = yuvarla(min(hi, base * rnd.uniform(1.4, 2.2)))
    return max(500, pmin), max(pmin + 500, pmax)

def yaz_01(D, out):
    rnd = random.Random(D.rnd.random())
    D.aciklama = {"01": "hesaplar, profiller, hizmetler, ajans ekipleri, kurumlar, davetler, CRM/gorev (parola hepsinde %s)" % PAROLA,
                  "02": "6 aylik gecmis: etkinlikler, konusmalar, mesajlar, teklifler, rezervasyonlar, yorumlar, ajans teklifleri"}
    L = []
    L.append(TEMIZLIK_FN)
    L.append("SELECT pg_temp.sahne_temizle() AS onceki_temizlik;")
    # on kosul: kategoriler
    L.append("""DO $$
DECLARE eksik text[];
BEGIN
  SELECT array_agg(s) INTO eksik FROM unnest(ARRAY[%s]) s WHERE NOT EXISTS (SELECT 1 FROM public.service_categories c WHERE c.slug = s)
     OR NOT EXISTS (SELECT 1 FROM public.service_roles r WHERE r.slug = s);
  IF eksik IS NOT NULL THEN
    RAISE EXCEPTION 'on kosul: kategori/rol eksik: %% (00-sahne-taksonomi.sql calistir)', eksik;
  END IF;
END $$;""" % ",".join(q(s) for s in V.KATEGORILER))
    # sehirler
    L.append("-- 81 il (dalda bos; uretimde zaten dolu -> 0 satir)")
    L.append("INSERT INTO public.turkish_cities (plate_no, name)\nSELECT v.plaka, v.ad FROM (VALUES %s) AS v(plaka, ad)\n WHERE NOT EXISTS (SELECT 1 FROM public.turkish_cities c WHERE c.plate_no = v.plaka OR c.name = v.ad);" %
             ",".join("(%d,%s)" % (pl, q(ad)) for pl, ad in V.TUM_ILLER))
    # auth.users
    L.append("-- hesaplar: auth.users -> handle_new_user (profil) -> faz0/faz2 tetikleyicileri (kurulus, saglayici)")
    rows = []
    for u in D.kullanicilar:
        rol = {"pro": "professional", "ajans": "agency", "kurum": "business", "kurum_uye": "client", "musteri": "client", "admin": "client"}[u["tip"]]
        meta = {"role": rol, "full_name": u["full"], "kvkk_approved": "true"}
        if u["tip"] in ("ajans", "kurum"):
            meta["company_name"] = u["sirket"]
        if u.get("telefon"):
            meta["phone"] = u["telefon"]
        rows.append("('00000000-0000-0000-0000-000000000000', %s, 'authenticated', 'authenticated', %s, extensions.crypt(%s, extensions.gen_salt('bf')), %s, '{\"provider\":\"email\",\"providers\":[\"email\"]}'::jsonb, %s, %s, %s, '', '', '', '', '', '', '', '')"
                    % (q(u["id"]), q(u["email"]), q(PAROLA), t(u["kayit_saat"]), qj(meta), t(u["kayit_saat"]), t(u["kayit_saat"])))
    L.append("INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,\n  confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)\nVALUES\n%s;" % ",\n".join(rows))
    L.append("DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM public.profiles WHERE email LIKE 'sahne+%'; IF n <> " + str(len(D.kullanicilar)) +
             " THEN RAISE EXCEPTION 'profil sayisi % (beklenen " + str(len(D.kullanicilar)) + ") — handle_new_user?', n; END IF; END $$;")
    # admin
    L.append("-- Sahne yoneticisi (admin paneli icin); koruma tetikleyicisi gecici kapatilir (asama4 T5 kalibi)")
    L.append("ALTER TABLE public.profiles DISABLE TRIGGER protect_profile_fields;\nUPDATE public.profiles SET is_admin = true WHERE id = %s;\nALTER TABLE public.profiles ENABLE TRIGGER protect_profile_fields;" % q(D.admin["id"]))
    # profil guncellemeleri (admin olarak)
    L.append("-- profil alanlari (onay alanlari icin auth.uid() = Sahne yoneticisi)")
    vals = []
    plan = []
    for u in D.kullanicilar:
        bio = None
        attributes = {}
        cat_attr = {}
        headline = None
        if u["tip"] == "pro":
            sablon = rnd.choice(V.BIO[u["kat"]])
            bio = sablon.format(yil=u["yil"], sehir=u["sehir"], uzmanlik=u["uzmanlik"], teslim=u["teslim"])
            if FILTERS[u["kat"]]["source"] == "attributes":
                attributes = attributes_uret(rnd, u["kat"], u)
            else:
                cat_attr = category_attributes_uret(rnd, u["kat"], u)
            headline = rnd.choice(V.BASLIK[u["kat"]])
        elif u["tip"] == "ajans":
            bio = u["hakkinda"]
            cat_attr = {"service_region": "Türkiye geneli", "experience_label": "%d yıl · %d+ etkinlik" % (u["yil"], u["yil"] * 60)}
        if u["tip"] in ("pro", "ajans"):
            # ORTAK alan: category_attributes.etkinlik_turleri (event_types key'leri) — sihirbaz sayaci ve Kesfet
            # "Etkinlik turu" filtresi yalniz bunu okur; eski sistem (attributes) kategorilerinde de bu kokte durur.
            cat_attr["etkinlik_turleri"] = etkinlik_turleri_uret(rnd, u)
            u["etkinlik_turleri"] = cat_attr["etkinlik_turleri"]
        onay = {"approved": "approved", "pending": "pending", "revision": "revision", "rejected": "rejected"}[u["durum"]]
        onay_saat = (u["kayit_saat"] - rnd.uniform(2, 72)) if onay == "approved" else None
        not_ = None
        if u["durum"] == "revision":
            not_ = "Portföy ve biyografi eksik; en az 3 görsel ve 120 karakter açıklama ekleyin."
        if u["durum"] == "rejected":
            not_ = "Profil Kashe kategori kapsamı dışında."
        askida = t(rnd.uniform(24, 24 * 20)) if u.get("askida") else "NULL"
        prim = q(u["kat"]) if u["kat"] else "NULL"
        premium_until = t(-24 * rnd.randint(30, 300)) if u["premium"] != "none" else "NULL"
        slug_db = u["slug"] if u["tip"] in ("pro", "ajans", "kurum") else None
        vals.append("(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)" % (
            q(u["id"]), q(slug_db), q(bio), q(u["sehir"]), prim, qj(attributes), qj(cat_attr), q(onay), (t(onay_saat) if onay_saat else "NULL"),
            q(not_), askida, q("Topluluk kuralları ihlali şikayeti; inceleme sürüyor." if u.get("askida") else None),
            "true" if u["yayinda"] else "false", q(u["premium"]), premium_until, t(u["son_gorulme"]), t(u["kayit_saat"])))
        plan.append(dict(id=u["id"], tip=u["tip"], ad=u.get("sirket") or u["full"], harf=ilk_harfler(u.get("sirket") or u["full"]),
                         renk=RENKLER[u["n"] % len(RENKLER)], kat=u.get("kat"), kat2=u.get("kat2"),
                         adet=(rnd.randint(4, 8) if u["tip"] == "pro" else rnd.randint(6, 8) if u["tip"] == "ajans" else 0)))
    L.append("""DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', %s, true);
  UPDATE public.profiles p SET
    slug = v.slug, bio = v.bio, city_id = pg_temp.sehir(v.sehir), primary_category_id = pg_temp.kat(v.kat),
    attributes = v.attrs, category_attributes = v.cat_attrs, approval_status = v.onay::public.profile_approval_status,
    approved_at = v.onay_at, approval_note = v.onay_not, suspended_at = v.askida_at, suspension_reason = v.askida_neden,
    suspended_by = CASE WHEN v.askida_at IS NULL THEN NULL ELSE %s::uuid END,
    is_published = v.yayinda, premium_tier = v.premium::public.premium_tier, premium_until = v.premium_until,
    last_seen_at = v.son_gorulme, created_at = v.kayit, welcome_email_sent_at = v.kayit
  FROM (VALUES
%s
  ) AS v(id, slug, bio, sehir, kat, attrs, cat_attrs, onay, onay_at, onay_not, askida_at, askida_neden, yayinda, premium, premium_until, son_gorulme, kayit)
  WHERE p.id = v.id::uuid;
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;""" % (q(D.admin["id"]), q(D.admin["id"]), ",\n".join(vals)))
    # providers: dogrulama + created_at
    L.append("-- saglayici dogrulama seviyesi (sync_bypass: koruma tetikleyicisi) ve kayit zamani")
    vals = []
    for u in D.prolar + D.ajanslar:
        vals.append("(%s, %s, %s, %s)" % (q(u["id"]), q(u["dogrulama"]), "true" if u["dogrulama"] in ("document", "full") else "false", t(u["kayit_saat"])))
    L.append("""DO $$
BEGIN
  PERFORM set_config('kashe.sync_bypass', 'on', true);
  UPDATE public.providers pr SET verification_level = v.lvl::public.verification_level, is_verified = v.ver, created_at = v.kayit,
         slug = CASE WHEN p.slug IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.providers x WHERE x.slug = p.slug AND x.id <> pr.id) THEN p.slug ELSE pr.slug END
  FROM (VALUES
%s
  ) AS v(id, lvl, ver, kayit) JOIN public.profiles p ON p.id = v.id::uuid
  WHERE pr.id = v.id::uuid;
  PERFORM set_config('kashe.sync_bypass', 'off', true);
END $$;""" % ",\n".join(vals))
    # professional_profiles / organization_profiles
    vals = []
    for u in D.prolar:
        diller = rnd.choice(V.DILLER["tercuman" if u["kat"] == "tercuman" else "varsayilan"])
        ekip = rnd.choice(V.EKIPMAN.get(u["kat"], [[]]))
        vals.append("(%s, %s, %d, %s, %s)" % (q(u["id"]), q(rnd.choice(V.BASLIK[u["kat"]])), u["yil"], arr(diller), qj({"items": ekip}) if ekip else "'{}'::jsonb"))
    L.append("UPDATE public.professional_profiles pp SET headline = v.headline, experience_years = v.yil, languages = v.diller, equipment = v.ekipman\nFROM (VALUES\n%s\n) AS v(id, headline, yil, diller, ekipman) WHERE pp.provider_id = v.id::uuid;" % ",\n".join(vals))
    vals = []
    for u in D.ajanslar:
        vals.append("(%s, %s, %s, %s, %d, %s)" % (q(u["id"]), q(rnd.choice(["2-5 kişi", "6-15 kişi", "16-50 kişi"])), "true" if u["kat"] == "organizasyon" else "false",
                                                "true" if rnd.random() < 0.6 else "false", rnd.choice([25000, 50000, 100000, 150000]),
                                                qj({"min_guests": rnd.choice([50, 100, 200]), "max_guests": rnd.choice([500, 1000, 2000]), "events_per_year": rnd.randint(20, 120)})))
    L.append("UPDATE public.organization_profiles op SET team_size_range = v.ekip, can_full_service = v.tam, subcontracts = v.alt, min_project_budget = v.butce, portfolio_scale = v.olcek\nFROM (VALUES\n%s\n) AS v(id, ekip, tam, alt, butce, olcek) WHERE op.provider_id = v.id::uuid;" % ",\n".join(vals))
    # providers.district via profiles? simpler: direct update
    vals = ",\n".join("(%s, %s)" % (q(u["id"]), q(u["ilce"])) for u in D.prolar + D.ajanslar)
    L.append("UPDATE public.providers pr SET district = v.ilce FROM (VALUES\n%s\n) AS v(id, ilce) WHERE pr.id = v.id::uuid;" % vals)
    # kurulus (organizations) ayrintilari
    vals = []
    for u in D.ajanslar + D.kurumlar:
        vals.append("(%s, %s, %s, %s)" % (q(u["id"]), q(u["sirket"] + (" Ltd. Şti." if u["tip"] == "ajans" else "")), q("fatura@%s.example.com" % u["slug"].replace("ajans-", "").replace("kurum-", "")), t(u["kayit_saat"])))
    L.append("UPDATE public.organizations o SET legal_name = v.legal, billing_email = v.fatura, created_at = v.kayit, slug = COALESCE(p.slug, o.slug)\nFROM (VALUES\n%s\n) AS v(id, legal, fatura, kayit) JOIN public.profiles p ON p.id = v.id::uuid WHERE o.legacy_profile_id = v.id::uuid AND NOT EXISTS (SELECT 1 FROM public.organizations x WHERE x.slug = p.slug AND x.id <> o.id);" % ",\n".join(vals))
    # hizmetler
    L.append("-- hizmetler (services -> provider_services ayna tetikleyicisi; ikinci rol = ikinci kategoride hizmet)")
    rows = []
    for u in D.prolar + D.ajanslar:
        katlar = [u["kat"]] + ([u["kat2"]] if u.get("kat2") else [])
        for ki, kat in enumerate(katlar):
            alt = SUBSERVICES[kat][:]
            rnd.shuffle(alt)
            adet = rnd.randint(1, 3) if ki == 0 else 1
            for si, (ad, acik) in enumerate(alt[:adet]):
                pmin, pmax = fiyat_uret(rnd, kat, u)
                birim = V.KATEGORILER[kat]["birim"]
                talep = rnd.random() < 0.12
                baslangic = (not talep) and rnd.random() < 0.3
                rows.append("(%s, pg_temp.kat(%s), %s, %s, %s, %s, %s, %s, %s, %d, %s)" % (
                    q(u["id"]), q(kat), q(ad), q(acik + ". " + rnd.choice(["Ulaşım şehir içi dahildir.", "Fiyat etkinlik süresine göre netleşir.", "Hafta sonu için erken rezervasyon önerilir.", "Paket içeriği ihtiyaca göre uyarlanır."])),
                    "NULL" if talep else num(pmin), "NULL" if talep else num(pmin if baslangic else pmax), "true" if talep else "false", "true" if baslangic else "false",
                    q(birim), si, t(u["kayit_saat"] - rnd.uniform(1, 48))))
    L.append("INSERT INTO public.services (profile_id, category_id, title, description, price_min, price_max, price_on_request, price_starting, price_unit, sort_order, created_at)\nVALUES\n%s;" % ",\n".join(rows))
    # deneyimler
    rows = []
    for u in D.prolar:
        yil0 = 2026 - u["yil"]
        kind_list = [("work", "Freelance %s" % V.KATEGORILER[u["kat"]]["ad"], "Serbest", u["sehir"], yil0, None, True),
                     ("education", rnd.choice(["Güzel Sanatlar Fakültesi", "İletişim Fakültesi", "Konservatuvar", "İşletme Fakültesi", "Mütercim Tercümanlık"]), rnd.choice(["Mimar Sinan Üniversitesi", "Anadolu Üniversitesi", "Dokuz Eylül Üniversitesi", "Hacettepe Üniversitesi", "Boğaziçi Üniversitesi"]), None, yil0 - 5, yil0 - 1, False)]
        if rnd.random() < 0.6:
            kind_list.append(("work", rnd.choice(["Etkinlik ekibi", "Stüdyo asistanı", "Sahne ekibi", "Prodüksiyon asistanı"]), rnd.choice(["Bir organizasyon şirketi", "Bir prodüksiyon ajansı", "Yerel bir stüdyo"]), u["sehir"], yil0 - 2, yil0, False))
        if rnd.random() < 0.35:
            kind_list.append(("award", rnd.choice(["Yılın Etkinlik Profesyoneli finalisti", "Festival jüri özel ödülü", "Sektör derneği başarı belgesi"]), None, None, 2026 - rnd.randint(1, 4), None, False))
        for si, (kind, title, orgn, loc, y1, y2, current) in enumerate(kind_list):
            rows.append("(%s, %s, %s, %s, %s, %s, %s, %s, %s, %d)" % (q(u["id"]), q(kind), q(title), q(orgn), q(loc), num(y1), num(y2) if y2 else "NULL", "true" if current else "false",
                                                                       q("%d – %s" % (y1, "devam" if current else (y2 or y1))), si))
    L.append("INSERT INTO public.profile_experiences (profile_id, kind, title, organization, location, start_year, end_year, is_current, period_label, sort_order)\nVALUES\n%s;" % ",\n".join(rows))
    # musaitlik
    rows = []
    for u in D.prolar:
        for g in sorted(set(rnd.randint(3, 120) for _ in range(rnd.randint(2, 6)))):
            rows.append("(%s, %s, %s)" % (q(u["id"]), d(g), q(rnd.choice(["Dolu", "Başka etkinlik", "Şehir dışı", None]))))
    L.append("INSERT INTO public.availability_blocks (profile_id, blocked_date, note)\nVALUES\n%s\nON CONFLICT DO NOTHING;" % ",\n".join(rows))
    # ajans ekipleri (FAZ 10a: dogrudan organization_memberships; eski agency_members YAZILMAZ)
    L.append("-- ajans ekipleri: organization_memberships (FAZ 10a; eski tablo yazilmaz), ince roller, havuz esitleme, harici kayitlar, davetler")
    uyelik_rows = []
    for a in D.ajanslar:
        for i, m in enumerate(a["uyeler"]):
            rol = "admin" if m["rol"] == "manager" else ("sales" if i == 1 else ("crew_coordinator" if i == 2 else "viewer"))
            m["org_rol"] = rol
            uyelik_rows.append("(pg_temp.org(%s), %s, %s, %s, %s)" % (q(a["id"]), q(m["p"]["id"]), q(rol), q(a["id"]), t(m["katilim"])))
    for k in D.kurumlar:
        for m in k["uyeler"]:
            uyelik_rows.append("(pg_temp.org(%s), %s, 'admin', %s, %s)" % (q(k["id"]), q(m["id"]), q(k["id"]), t(m["kayit_saat"] - 24)))
    L.append(UYELIK_DO % ",\n".join(uyelik_rows))
    # havuz esitleme: kurulus sahibi JWT'siyle sync_org_talent_pool (eski faz5_backfill_agency_members kalkti)
    L.append("""DO $$
DECLARE o record;
BEGIN
  FOR o IN SELECT id, owner_user_id FROM public.organizations WHERE account_type = 'agency' AND legacy_profile_id::text LIKE '5a4e0000-%' ORDER BY created_at LOOP
    PERFORM set_config('request.jwt.claim.sub', o.owner_user_id::text, true);
    PERFORM public.sync_org_talent_pool(o.id);
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- esitlemeyle acilan kayitlarin zamani uyelik zamanina
UPDATE public.organization_talent_records r SET created_at = r.linked_at, updated_at = r.linked_at
  FROM public.organizations o WHERE o.id = r.organization_id AND o.legacy_profile_id::text LIKE '5a4e0000-%'
   AND r.source = 'marketplace_linked' AND r.linked_at IS NOT NULL AND r.created_at > now() - interval '10 minutes';""")
    rows = []
    for a in D.ajanslar:
        for h in a["harici"]:
            rows.append("(pg_temp.org(%s), %s, %s, %s, pg_temp.sehir(%s), %s, %s, %s)" % (q(a["id"]), q(h["ad"]), q(h["email"]), q(h["telefon"]), q(h["sehir"]),
                                                                                       q(rnd.choice(["occasional", "regular_freelancer", "subcontractor"])), q(a["id"]), q(h["kat"])))
    L.append("""DO $$
DECLARE r record; rec uuid;
BEGIN
  FOR r IN SELECT * FROM (VALUES
%s
  ) AS v(org, ad, eposta, telefon, sehir, iliski, olusturan, rol) LOOP
    INSERT INTO public.organization_talent_records (organization_id, name, email, phone, city_id, source, relationship_type, status, created_by, notes)
    VALUES (r.org, r.ad, r.eposta, r.telefon, r.sehir, 'external_manual', r.iliski::public.talent_relationship_type, 'active', r.olusturan::uuid, 'Sahne: harici havuz kaydi')
    RETURNING id INTO rec;
    INSERT INTO public.organization_talent_record_roles (record_id, role_id, is_primary) VALUES (rec, pg_temp.rol(r.rol), true);
  END LOOP;
END $$;""" % ",\n".join(rows))
    # davetler (FAZ 10a; organization_invitations): bekleyen (tur icin), suresi gecmis bekleyen, gecmis kabul/ret/iptal
    D.davetler = []
    inv_rows = []
    uygun = [p for p in D.prolar if p["durum"] == "approved" and p["yayinda"] and not p.get("askida")]
    uye_olan = set()
    for a in D.ajanslar:
        for m in a["uyeler"]:
            uye_olan.add((a["id"], m["p"]["id"]))
    dn = 0
    def davet(sahip, kisi, rol, durum, saat, mesaj=None, sure=14 * 24):
        nonlocal dn
        dn += 1
        yanit = None if durum == "pending" else saat - rnd.uniform(2, 72)
        D.davetler.append(dict(id=uid(U_INV, dn), sahip=sahip, kisi=kisi, rol=rol, durum=durum, saat=saat))
        inv_rows.append("(%s, pg_temp.org(%s), %s, %s, %s, %s, %s, %s, %s, %s, %s)" % (
            q(uid(U_INV, dn)), q(sahip["id"]), q(kisi["email"]), q(kisi["id"]), q(sahip["id"]), q(rol), q(durum), q(mesaj),
            t(saat), "NULL" if yanit is None else t(yanit), "pg_temp.t(%s) + interval '%d hours'" % ("%.2f" % saat, sure)))
    for ai, a in enumerate(D.ajanslar):
        adaylar = [p for p in uygun if p["kat"] in a["odak"] and (a["id"], p["id"]) not in uye_olan and p["id"] not in [x["kisi"]["id"] for x in D.davetler]]
        if not adaylar:
            continue
        adaylar.sort(key=lambda p: (0 if p["sehir"] == a["sehir"] else 1, rnd.random()))
        if ai % 2 == 0:      # her ikinci ajansta bekleyen davet (tur icin)
            davet(a, adaylar[0], rnd.choice(["viewer", "viewer", "sales", "crew_coordinator"]), "pending", rnd.uniform(6, 24 * 6),
                  rnd.choice(["Ekibimize katılmanı çok isteriz; sezon yoğun, birlikte çalışalım.", "Düğün sezonu için kadroyu genişletiyoruz.", None]))
        if ai % 4 == 1 and len(adaylar) > 1:   # suresi gecmis bekleyen
            davet(a, adaylar[1], "viewer", "pending", rnd.uniform(24 * 16, 24 * 40))
        if ai % 3 == 2 and len(adaylar) > 2:   # reddedilmis
            davet(a, adaylar[2], "viewer", "declined", rnd.uniform(24 * 20, 24 * 120))
        if ai % 5 == 3 and len(adaylar) > 3:   # iptal
            davet(a, adaylar[3], "viewer", "cancelled", rnd.uniform(24 * 20, 24 * 120))
        # mevcut uyelerin bir kismi davetle katildi (gecmis kabul)
        for m in a["uyeler"][1:]:
            if rnd.random() < 0.5:
                davet(a, m["p"], m["org_rol"], "accepted", m["katilim"] + rnd.uniform(24, 24 * 6))
    for ki, k in enumerate(D.kurumlar):
        if ki % 2 == 0:
            aday = [m for m in D.musteriler if m["id"] not in [x["kisi"]["id"] for x in D.davetler]]
            if aday:
                davet(k, rnd.choice(aday), rnd.choice(["viewer", "finance", "project_manager"]), "pending", rnd.uniform(12, 24 * 5),
                      "Etkinlik bütçelerini birlikte takip edelim.")
        for m in k["uyeler"]:
            davet(k, m, "admin", "accepted", m["kayit_saat"] - 24 + rnd.uniform(24, 72))
    if inv_rows:
        L.append(DAVET_DO % ",\n".join(inv_rows))
    # tedarikci, kisi, firsat, gorev (ajans)
    L.append("-- ajans CRM: tedarikciler, kisiler, firsatlar, gorevler")
    rows = []
    for a in D.ajanslar:
        for ad, kat in rnd.sample(V.TEDARIKCILER, rnd.randint(2, 4)):
            rows.append("(pg_temp.org(%s), %s, %s, %s, %s, pg_temp.sehir(%s), %d, %s)" % (q(a["id"]), q(ad), q(kat), q("%s %s" % (rnd.choice(V.ERKEK_ADLAR + V.KADIN_ADLAR), rnd.choice(V.SOYADLAR))),
                                                                                        q("+9021%08d" % rnd.randint(10000000, 99999999)), q(a["sehir"]), rnd.randint(3, 5), q(a["id"])))
    L.append("INSERT INTO public.suppliers (organization_id, name, category, contact_name, phone, city_id, rating, created_by)\nVALUES\n%s;" % ",\n".join(rows))
    rows = []
    D.kisiler = {}
    for a in D.ajanslar:
        D.kisiler[a["id"]] = []
        for i in range(rnd.randint(3, 5)):
            ad = "%s %s" % (rnd.choice(V.ERKEK_ADLAR + V.KADIN_ADLAR), rnd.choice(V.SOYADLAR))
            unvan, _ = rnd.choice(V.KISILER)
            sirket = rnd.choice(V.KURUMLAR)["ad"] if rnd.random() < 0.5 else None
            D.kisiler[a["id"]].append((ad, sirket))
            rows.append("(pg_temp.org(%s), 'person', %s, %s, %s, %s, %s, %s)" % (q(a["id"]), q(ad), q(sirket), q("%s@example.com" % slugla(ad)), q("+9053%08d" % rnd.randint(10000000, 99999999)), q(unvan), q(a["id"])))
    L.append("INSERT INTO public.contacts (organization_id, kind, full_name, company_name, email, phone, notes, created_by)\nVALUES\n%s;" % ",\n".join(rows))
    rows = []
    for a in D.ajanslar:
        for i in range(rnd.randint(2, 4)):
            ad, sirket = rnd.choice(D.kisiler[a["id"]])
            baslik = rnd.choice(V.LEAD_BASLIK).format(kurum=sirket or "Özel müşteri", ad=ad.split()[0])
            stage = rnd.choice(["new", "contacted", "proposal_sent", "won", "lost"])
            rows.append("(pg_temp.org(%s), (SELECT id FROM public.contacts c WHERE c.organization_id = pg_temp.org(%s) AND c.full_name = %s LIMIT 1), %s, %s, %d, %s, %s, %s, %s)" % (
                q(a["id"]), q(a["id"]), q(ad), q(baslik), q(stage), yuvarla(rnd.uniform(30000, 400000), 5000), d(rnd.randint(10, 120)), q(a["id"]),
                q(rnd.choice(["Teklif revizyonu gönderilecek", "Mekan keşfi planlanacak", "Bütçe onayı bekleniyor", "Sözleşme taslağı hazırlanacak"])), q(a["id"])))
    L.append("INSERT INTO public.crm_leads (organization_id, contact_id, title, stage, estimated_value, expected_date, owner_user_id, next_step, created_by)\nVALUES\n%s;" % ",\n".join(rows))
    rows = []
    for a in D.ajanslar:
        for g in rnd.sample(V.GOREVLER, rnd.randint(3, 6)):
            status = rnd.choice(["todo", "todo", "in_progress", "done", "blocked"])
            atanan = rnd.choice(a["uyeler"])["p"]["id"] if a["uyeler"] and rnd.random() < 0.6 else None
            rows.append("(pg_temp.org(%s), %s, %s, %s, %s, %s, %s)" % (q(a["id"]), q(g), q(status), q(atanan), t(-24 * rnd.randint(2, 40)), "true" if rnd.random() < 0.2 else "false", q(a["id"])))
    L.append("INSERT INTO public.tasks (organization_id, title, status, assignee_user_id, due_at, is_milestone, created_by)\nVALUES\n%s;" % ",\n".join(rows))
    # favoriler
    rows = []
    gorunur = [p for p in D.prolar if p["durum"] == "approved" and p["yayinda"] and not p.get("askida")]
    for m in D.musteriler + D.kurum_uyeleri:
        for p in rnd.sample(gorunur, rnd.randint(2, 6)):
            rows.append("(%s, %s, %s)" % (q(m["id"]), q(p["id"]), t(rnd.uniform(1, m["kayit_saat"]))))
    L.append("INSERT INTO public.favorites (user_id, professional_id, created_at)\nVALUES\n%s\nON CONFLICT DO NOTHING;" % ",\n".join(rows))
    # ozet
    L.append("""-- ozet
SELECT (SELECT count(*) FROM public.profiles WHERE email LIKE 'sahne+%') AS hesap,
       (SELECT count(*) FROM public.providers pr JOIN public.profiles p ON p.id = pr.id WHERE p.email LIKE 'sahne+%') AS saglayici,
       (SELECT count(*) FROM public.v_providers_public v JOIN public.profiles p ON p.id = v.id WHERE p.email LIKE 'sahne+%' AND v.is_visible) AS gorunur,
       (SELECT count(*) FROM public.organizations WHERE legacy_profile_id::text LIKE '5a4e0000-%') AS kurulus,
       (SELECT count(*) FROM public.organization_memberships om JOIN public.organizations o ON o.id = om.organization_id WHERE o.legacy_profile_id::text LIKE '5a4e0000-%') AS uyelik,
       (SELECT count(*) FROM public.organization_talent_records r JOIN public.organizations o ON o.id = r.organization_id WHERE o.legacy_profile_id::text LIKE '5a4e0000-%') AS havuz,
       (SELECT count(*) FROM public.services WHERE profile_id::text LIKE '5a4e0000-%') AS hizmet,
       (SELECT count(*) FROM public.provider_services WHERE provider_id::text LIKE '5a4e0000-%') AS saglayici_rol,
       (SELECT count(*) FROM public.turkish_cities) AS il,
       (SELECT count(*) FROM public.organization_invitations i JOIN public.organizations o ON o.id = i.organization_id WHERE o.legacy_profile_id::text LIKE '5a4e0000-%') AS davet,
       (SELECT count(*) FROM public.organization_invitations i JOIN public.organizations o ON o.id = i.organization_id WHERE o.legacy_profile_id::text LIKE '5a4e0000-%' AND i.status = 'pending' AND i.expires_at > now()) AS bekleyen_davet,
       (SELECT count(*) FROM public.agency_members WHERE agency_id::text LIKE '5a4e0000-%') + (SELECT count(*) FROM public.business_members WHERE business_id::text LIKE '5a4e0000-%') AS eski_tablo,
       (SELECT count(*) FROM public.organization_sync_log WHERE occurred_at > now() - interval '10 minutes') AS sync_hata;""")
    D.hesap_dosyalari = paketle(L, out, "01", "sahne-hesaplar", D,
        lambda onceki: "DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM public.profiles WHERE email LIKE 'sahne+%%'; IF n < 100 THEN RAISE EXCEPTION 'on kosul: once 01a..01%s (profil=%%)', n; END IF; END $$;" % onceki)
    return plan


# ----------------------------------------------------------------------------- 02 gecmis
def brief_uret(rnd, kat, tur, tarih_gun, sehir, ilce, kisi, butce):
    b = {}
    for f in BRIEF[kat]:
        k = f["key"]
        if f["legacyColumn"] == "event_type":
            b[k] = tur
        elif f["legacyColumn"] == "event_date":
            b[k] = tarih_gun
        elif f["legacyColumn"] == "location":
            b[k] = "%s / %s" % (sehir, ilce)
        elif f["legacyColumn"] == "guest_count":
            b[k] = kisi
        elif f["legacyColumn"] == "budget_range":
            b[k] = butce
        elif f["options"]:
            if rnd.random() < 0.8:
                b[k] = rnd.choice(f["options"])
        elif f["type"] in ("text", "textarea"):
            if rnd.random() < 0.4:
                b[k] = rnd.choice(["Detayları görüşerek netleştirelim.", "Sade ve şık bir konsept istiyoruz.", "Program akışı daha sonra paylaşılacak."])
        elif f["type"] == "number":
            b[k] = rnd.randint(1, 6)
    return b

def yaz_02(D, out):
    rnd = random.Random(D.rnd.random() + 1)
    L = []  # ifadeler; sonda boyuta gore 02a, 02b, ... dosyalarina paketlenir (Dashboard SQL Editor boyut siniri)
    # kendi gecmisini sil (idempotan; yalniz ilk parcada)
    L.append("""DO $$
DECLARE ids uuid[]; orgs uuid[];
BEGIN
  SELECT COALESCE(array_agg(id), '{}') INTO ids FROM public.profiles WHERE email LIKE 'sahne+%';
  SELECT COALESCE(array_agg(id), '{}') INTO orgs FROM public.organizations WHERE legacy_profile_id = ANY(ids);
  DELETE FROM public.bookings WHERE customer_id = ANY(ids) OR professional_id = ANY(ids) OR seller_provider_id = ANY(ids) OR id::text LIKE '5a4e0013-%';
  DELETE FROM public.proposals WHERE seller_organization_id = ANY(orgs) OR id::text LIKE '5a4e0003-%';
  DELETE FROM public.event_requirements WHERE event_id::text LIKE '5a4e0002-%';
  DELETE FROM public.events WHERE id::text LIKE '5a4e0002-%';
  DELETE FROM public.review_replies WHERE review_id::text LIKE '5a4e0014-%';
  DELETE FROM public.reviews WHERE id::text LIKE '5a4e0014-%';
  DELETE FROM public.messages WHERE conversation_id::text LIKE '5a4e0010-%';
  DELETE FROM public.quotes WHERE conversation_id::text LIKE '5a4e0010-%';
  DELETE FROM public.conversations WHERE id::text LIKE '5a4e0010-%';
  DELETE FROM public.quote_request_recipients WHERE request_id::text LIKE '5a4e0030-%';
  DELETE FROM public.quote_requests WHERE id::text LIKE '5a4e0030-%';
  DELETE FROM public.analytics_events WHERE entity_id::text LIKE '5a4e%' OR actor_user_id = ANY(ids);
  DELETE FROM public.notifications WHERE user_id = ANY(ids);
END $$;""")
    gorunur = [p for p in D.prolar if p["durum"] == "approved" and p["yayinda"] and not p.get("askida")]
    alicilar = D.musteriler + D.kurum_uyeleri + [k for k in D.kurumlar]
    # ---------------- A) etkinlikler (ajans + kurum)
    L.append("-- A) etkinlikler (FAZ 4a): ajans ve kurum etkinlikleri + gereksinimler")
    D.etkinlikler = []
    ev_rows, req_rows = [], []
    en = 0
    for sahip in D.ajanslar + D.kurumlar:
        adet = rnd.randint(3, 5) if sahip["tip"] == "ajans" else rnd.randint(2, 4)
        for i in range(adet):
            en += 1
            if sahip["tip"] == "kurum":
                tur = rnd.choice(sahip["turler"])
            else:
                tur = secim(rnd, V.KATEGORILER[sahip["kat"]]["turler"])
            gun = rnd.randint(-170, 90)
            if tur in ("wedding", "engagement", "henna", "birthday", "baby_shower", "circumcision"):
                ad1, ad2 = rnd.choice(V.KADIN_ADLAR), rnd.choice(V.ERKEK_ADLAR)
                baslik = rnd.choice(V.ETKINLIK_BASLIK[tur]).format(ad1=ad1, ad2=ad2, kurum=sahip.get("sirket", ""))
            else:
                baslik = rnd.choice(V.ETKINLIK_BASLIK[tur]).format(ad1="", ad2="", kurum=(sahip["sirket"] if sahip["tip"] == "kurum" else rnd.choice(V.KURUMLAR)["ad"]))
            if gun < -3:
                status = "completed" if rnd.random() < 0.85 else "cancelled"
            elif gun < 0:
                status = "running" if rnd.random() < 0.3 else "completed"
            else:
                status = rnd.choice(["confirmed", "confirmed", "matching", "booked"])   # uygulama taslak etkinlik uretmez (sihirbaz -> confirmed)
            kisi = rnd.choice({"birthday": [20, 30, 50, 80], "baby_shower": [20, 30, 50], "henna": [80, 120, 150, 200], "engagement": [50, 80, 120, 200],
                               "circumcision": [50, 80, 120, 200], "wedding": [100, 150, 200, 300, 500], "graduation": [100, 200, 300, 500]}.get(tur, [50, 80, 120, 150, 200, 300, 500, 800]))
            bmin = yuvarla(kisi * rnd.uniform(400, 900), 5000)
            bmax = yuvarla(bmin * rnd.uniform(1.3, 1.8), 5000)
            sehir = sahip["sehir"] if rnd.random() < 0.8 else D.sehir_sec()
            olusturma = max(gun * -24 + 24 * rnd.randint(20, 90), 24 * 10)  # saat once (en az 10 gun)
            ev = dict(id=uid(U_EVENT, en), sahip=sahip, tur=tur, gun=gun, status=status, kisi=kisi, sehir=sehir, baslik=baslik, bmin=bmin, bmax=bmax, olusturma=olusturma)
            D.etkinlikler.append(ev)
            ev_rows.append("(%s, pg_temp.org(%s), %s, %s, %s, %s, %s, %s, pg_temp.sehir(%s), %s, %s, %d, %d, %d, %s, %s, %s, %s)" % (
                q(ev["id"]), q(sahip["id"]), q(sahip["id"]), q(baslik), q(tur), d(gun), d(gun), q(rnd.choice(["18:00", "19:00", "10:00", "14:00"])), q(sehir), q(rnd.choice(V.ILCELER[sehir])),
                q(rnd.choice(["confirmed", "searching", "not_needed"])), kisi, bmin, bmax, q(status), (t(olusturma - 24) if status in ("confirmed", "booked", "matching", "running", "completed") else "NULL"),
                t(olusturma), t(olusturma - 2)))
            # gereksinimler: 2-4 rol
            roller = rnd.sample(list(V.KATEGORILER), rnd.randint(2, 4))
            ev["roller"] = roller
            for ri, r in enumerate(roller):
                lo, hi = V.KATEGORILER[r]["fiyat"]
                req_rows.append("(%s, pg_temp.rol(%s), %d, %s, %d, %d, %d)" % (q(ev["id"]), q(r), rnd.choice([1, 1, 1, 2]), "true" if ri < 2 else "false", yuvarla(lo * 1.2), yuvarla(hi * 0.6), ri))
    L.append("INSERT INTO public.events (id, organization_id, owner_user_id, title, event_type, start_date, end_date, start_time, city_id, district, venue_status, participant_count, budget_min, budget_max, status, confirmed_at, created_at, updated_at)\nVALUES\n%s;" % ",\n".join(ev_rows))
    L.append("INSERT INTO public.event_requirements (event_id, role_id, quantity, is_required, budget_hint_min, budget_hint_max, sort_order)\nVALUES\n%s;" % ",\n".join(req_rows))
    # ---------------- B) pazaryeri akisi
    L.append("-- B) pazaryeri: konusma -> mesajlar -> teklif (quote) -> rezervasyon -> yorum")
    conv_rows, msg_rows, quote_rows, book_rows, rev_rows, reply_rows, ev_manual = [], [], [], [], [], [], []
    book_update = []
    cn = mn = qn = bn = rn = 0
    ciftler = set()
    # yogun hucreler: Istanbul x dugun/kurumsal x 5 rol; 22 kabul edilmis teklif (90 gunluk pencerede; esik 15)
    yogun = []
    for rol in ["fotografci", "dj", "muzisyen", "videograf", "sunucu"]:
        for tur in ["wedding", "corporate"]:
            adaylar = [p for p in gorunur if p["kat"] == rol and p["sehir"] == "İstanbul"]
            if not adaylar:
                adaylar = [p for p in gorunur if p["kat"] == rol]
            for i in range(22):
                yogun.append((rnd.choice(adaylar), tur, True))
    # genel: her gorunur pro icin 0-5 konusma
    genel = []
    for p in gorunur:
        for i in range(rnd.choice([0, 1, 1, 2, 2, 3, 3, 4, 5])):
            genel.append((p, secim(rnd, V.KATEGORILER[p["kat"]]["turler"]), False))
    tum = yogun + genel
    rnd.shuffle(tum)
    OZEL_TURLER = ("wedding", "engagement", "henna", "birthday", "baby_shower", "circumcision")
    for p, tur, zorla_kabul in tum:
        # alici: tekil cift. v2 (#26): yogun hucrelerde ozel tur (dugun) yalniz bireysel musteriye gider (hucre sayisi korunur)
        havuz = D.musteriler if (zorla_kabul and tur in OZEL_TURLER) else alicilar
        for _ in range(20):
            alici = rnd.choice(havuz)
            if (alici["id"], p["id"]) not in ciftler:
                break
        else:
            continue
        ciftler.add((alici["id"], p["id"]))
        # v2 (#26): kurum sahibi / kurum uyesi alici kurumsal tur ister (kurumun tur listesi, kategoriyle kesisen varsa o)
        if alici["tip"] in ("kurum", "kurum_uye") and not zorla_kabul:
            kurum_turleri = alici["turler"] if alici["tip"] == "kurum" else alici["kurum"]["turler"]
            ortak = [x for x in kurum_turleri if x in V.KATEGORILER[p["kat"]]["turler"]]
            tur = rnd.choice(ortak or kurum_turleri)
        cn += 1
        cid = uid(U_CONV, cn)
        basla = rnd.uniform(24 * 3, 24 * 80) if zorla_kabul else rnd.uniform(24 * 1.5, 24 * 180)  # ilk mesaj: kac saat once (yogun hucreler 90 gunluk pencerede)
        olcek = min(1.0, basla / 300.0)            # taze konusmalarda adimlar kisalir (zaman asla gelecege kaymaz)
        def adim(lo, hi):
            return rnd.uniform(lo, hi) * olcek
        sehir = "İstanbul" if zorla_kabul else (p["sehir"] if rnd.random() < 0.75 else D.sehir_sec())
        ilce = rnd.choice(V.ILCELER[sehir])
        kisi = rnd.choice([30, 50, 80, 100, 150, 200, 300, 500])
        lo, hi = V.KATEGORILER[p["kat"]]["fiyat"]
        tutar = yuvarla(rnd.uniform(lo, hi * 0.8))
        butce = butce_araligi(tutar)
        if rnd.random() < 0.15:
            butce = "open"
        rtype = "booking_request" if rnd.random() < 0.15 else "quote"
        # --- 1) zincir simulasyonu (saat once; azalan)
        mesajlar = []  # (sender, body_or_key, zaman, tip, quote)
        zaman = basla
        mesajlar.append((alici["id"], "ACILIS", zaman, "text", None))
        hiz = p.setdefault("hiz", rnd.choice(["hizli", "hizli", "orta", "yavas"]))
        yanit = {"hizli": rnd.uniform(0.2, 1.8), "orta": rnd.uniform(2, 20), "yavas": rnd.uniform(26, 70)}[hiz] * olcek
        zaman -= yanit
        cevap_var = rnd.random() < 0.9
        if cevap_var:
            mesajlar.append((p["id"], "PRO_YANIT", zaman, "text", None))
            if rnd.random() < 0.7:
                zaman -= adim(0.5, 24)
                mesajlar.append((alici["id"], "MUSTERI_DEVAM", zaman, "text", None))
                zaman -= adim(0.3, 10)
                mesajlar.append((p["id"], "PRO_DEVAM", zaman, "text", None))
        teklif_var = cevap_var and (zorla_kabul or rnd.random() < 0.7)
        sonuc = None; q_olusturma = yanit_saat = None; gecerlilik = None; qid = None
        if teklif_var:
            qn += 1
            qid = uid(U_QUOTE, qn)
            zaman -= adim(0.5, 12)
            q_olusturma = zaman
            sonuc = "accepted" if zorla_kabul else secim(rnd, {"accepted": 55, "declined": 20, "expired": 10, "pending": 15})
            gecerlilik = rnd.choice([72, 168, 336])
            if sonuc in ("accepted", "declined"):
                yanit_saat = q_olusturma - adim(1, min(gecerlilik - 1, 120))
            elif sonuc == "expired":
                yanit_saat = q_olusturma - gecerlilik
                if yanit_saat < 0.5:
                    sonuc = "pending"; yanit_saat = None
            mesajlar.append((p["id"], "Teklif gönderildi", q_olusturma, "quote", qid))
            if sonuc == "accepted":
                mesajlar.append((alici["id"], "KAPANIS_OLUMLU", yanit_saat + 0.05, "text", None))
                mesajlar.append((p["id"], "✓ Teklif onaylandı", yanit_saat, "system", qid))
            elif sonuc == "declined":
                mesajlar.append((alici["id"], "KAPANIS_OLUMSUZ", yanit_saat + 0.05, "text", None))
                mesajlar.append((p["id"], "✗ Teklif reddedildi", yanit_saat, "system", qid))
                if rnd.random() < 0.6:
                    mesajlar.append((p["id"], V.PRO_TESEKKUR[2], max(yanit_saat - adim(0.5, 12), 0.3), "text", None))
            elif sonuc == "expired":
                mesajlar.append((p["id"], "⏱ Teklif süresi doldu", yanit_saat, "system", qid))
        elif cevap_var and rnd.random() < 0.3:
            zaman -= adim(1, 48)
            mesajlar.append((alici["id"], "KAPANIS_OLUMSUZ", zaman, "text", None))
        son = min(m[2] for m in mesajlar)  # zincirin son ani (saat once)
        # --- 2) etkinlik gunu: zincirden en az 1 gun sonra; %60 gecmis (tamamlanabilir), %40 gelecek
        gecmis_mi = rnd.random() < 0.6 if not zorla_kabul else rnd.random() < 0.8
        if gecmis_mi:
            gun = -int(son / 24) + rnd.randint(1, 45)
            if gun > -2:
                gun = rnd.randint(2, 90)
        else:
            gun = rnd.randint(2, 120)
        tarih = datetime.date.today() + datetime.timedelta(days=gun)
        tarih_str = "%02d.%02d" % (tarih.day, tarih.month)
        brief = brief_uret(rnd, p["kat"], tur, tarih.isoformat(), sehir, ilce, kisi, butce)
        conv_rows.append("(%s, %s, %s, %s, %s, %s, %d, %s, %s, %s, %s, %s, %s)" % (q(cid), q(alici["id"]), q(p["id"]), d(gun), q(tur), q("%s / %s" % (sehir, ilce)), kisi, q(butce), qj(brief), q(rtype),
                                                                             q(rnd.choice(["18:00", "19:00", "20:00", "11:00", "14:00"])), t(basla), t(basla)))
        fmt = dict(tur=tur_ad(tur), tarih=tarih_str, sehir=sehir, sehir_de=sehir + ek_de(sehir), kisi=kisi, ad=p["ad"], ilce=ilce)
        SABLON = {"ACILIS": V.MUSTERI_ACILIS, "PRO_YANIT": V.PRO_YANIT, "MUSTERI_DEVAM": V.MUSTERI_DEVAM, "PRO_DEVAM": V.PRO_DEVAM,
                  "KAPANIS_OLUMLU": V.MUSTERI_KAPANIS_OLUMLU, "KAPANIS_OLUMSUZ": V.MUSTERI_KAPANIS_OLUMSUZ}
        def msg(sender, body, zaman_, tip="text", quote=None):
            nonlocal mn
            mn += 1
            okundu = (t(max(zaman_ - rnd.uniform(0.2, 30), 0.05)) if (rnd.random() < 0.85 or tip != "text") else "NULL")
            msg_rows.append("(%s, %s, %s, %s, %s, %s, %s, %s)" % (q(uid(U_MSG, mn)), q(cid), q(sender), q(body), q(tip), q(quote), t(zaman_), okundu))
        for sender, body, z, tip, quote in mesajlar:
            if body in SABLON:
                body = rnd.choice(SABLON[body]).format(**fmt)
            msg(sender, body, z, tip, quote)
        # --- 3) teklif + rezervasyon + yorum
        if teklif_var:
            aciklama = rnd.choice(V.TEKLIF_ACIKLAMA[p["kat"]]).format(tur=tur_ad(tur).capitalize(), kisi_h=rnd.randint(2, 6))
            quote_rows.append("(%s, %s, %s, %d, %s, %s, %s, %s, %s, %s, %s)" % (q(qid), q(cid), q(p["id"]), tutar, q(aciklama), q(rnd.choice(V.IPTAL_POLITIKA)),
                                                                            t(q_olusturma - gecerlilik), q(sonuc), t(q_olusturma), (t(yanit_saat) if yanit_saat else "NULL"),
                                                                            "true" if (butce != "open" and tutar > {"under_5k": 5000, "5k_15k": 15000, "15k_30k": 30000, "30k_50k": 50000, "over_50k": 10**9}[butce]) else "false"))
            if sonuc == "accepted":
                ev_manual.append("('quote_accepted', 'quote', %s, %s, %s, %s, %s)" % (q(qid), q(p["id"]), qj({"total_amount": tutar, "event_type": tur, "event_id": None}), t(yanit_saat), q(alici["id"])))
                bn += 1
                bid = uid(U_BOOK, bn)
                etkinlik_once = -gun * 24  # etkinlik kac saat once (gelecekse negatif)
                if gun < -1:
                    bstatus = secim(rnd, {"completed": 82, "cancelled": 12, "confirmed": 6})
                else:
                    bstatus = "cancelled" if rnd.random() < 0.06 else "confirmed"
                book_rows.append("(%s, %s, %s, %s, %s, %s, %s, %s, %d, %d, %s)" % (q(bid), q(qid), q(cid), q(alici["id"]), q(p["id"]), d(gun), q(tur), q("%s / %s" % (sehir, ilce)), kisi, tutar, t(yanit_saat)))
                if bstatus == "completed":
                    tamam = max(etkinlik_once - rnd.uniform(4, 72), 0.5)
                    book_update.append("UPDATE public.bookings SET status = 'completed', completed_at = %s WHERE id = %s;" % (t(tamam), q(bid)))
                    msg(p["id"], "Profesyonel işi tamamlandı olarak işaretledi", tamam, "system")
                    if rnd.random() < 0.7:
                        rn += 1
                        rid = uid(U_REV, rn)
                        puan = secim(rnd, {5: 55, 4: 30, 3: 10, 2: 5})
                        y_zaman = max(tamam - rnd.uniform(6, 240), 0.2)
                        rev_rows.append("(%s, %s, %s, %s, %d, %s, %s, %s)" % (q(rid), q(cid), q(alici["id"]), q(p["id"]), puan, q(rnd.choice(V.YORUMLAR[puan])), t(y_zaman), t(y_zaman)))
                        if rnd.random() < 0.5:
                            reply_rows.append("(%s, %s, %s)" % (q(rid), q(rnd.choice(V.YORUM_YANIT)), t(max(y_zaman - rnd.uniform(2, 48), 0.1))))
                elif bstatus == "cancelled":
                    iptal_eden = p["id"] if rnd.random() < 0.35 else alici["id"]
                    alt = max(etkinlik_once, 0) + 1  # etkinlikten once (gecmisse) ya da simdiye kadar
                    ust = yanit_saat - 0.5
                    iptal_zaman = rnd.uniform(alt, ust) if ust > alt else max(ust, 0.3)
                    book_update.append("UPDATE public.bookings SET status = 'cancelled', cancelled_at = %s, cancelled_by = %s, cancellation_reason = %s WHERE id = %s;" % (
                        t(iptal_zaman), q(iptal_eden), q(rnd.choice(["Tarih değişikliği", "Bütçe", "Mekan iptal oldu", "Sağlık nedeniyle", "Başka tedarikçi seçildi"])), q(bid)))
            elif sonuc == "declined":
                ev_manual.append("('quote_declined', 'quote', %s, %s, %s, %s, %s)" % (q(qid), q(p["id"]), qj({"total_amount": tutar, "event_type": tur, "event_id": None}), t(yanit_saat), q(alici["id"])))
    L.append("INSERT INTO public.conversations (id, customer_id, professional_id, event_date, event_type, location, guest_count, budget_range, brief_data, request_type, start_time, created_at, last_message_at)\nVALUES\n%s;" % ",\n".join(conv_rows))
    L.append("INSERT INTO public.quotes (id, conversation_id, sender_id, total_amount, services_description, cancellation_policy, expires_at, status, created_at, responded_at, over_budget)\nVALUES\n%s;" % ",\n".join(quote_rows))
    # mesajlar zaman sirasiyla (last_message_at tetikleyicisi son mesaji yazsin)
    for i in range(0, len(msg_rows), 600):   # parca parca: tek ifade Dashboard sinirini asmasin
        L.append("INSERT INTO public.messages (id, conversation_id, sender_id, body, message_type, quote_id, created_at, read_at)\nSELECT v.id::uuid, v.cid::uuid, v.sender::uuid, v.body, v.tip::public.message_type, v.quote::uuid, v.ts, v.okundu FROM (VALUES\n%s\n) AS v(id, cid, sender, body, tip, quote, ts, okundu) ORDER BY v.ts;" % ",\n".join(msg_rows[i:i + 600]))
    L.append("INSERT INTO public.bookings (id, quote_id, conversation_id, customer_id, professional_id, event_date, event_type, location, guest_count, total_amount, created_at)\nVALUES\n%s;" % ",\n".join(book_rows))
    L.append("\n".join(book_update))
    L.append("INSERT INTO public.reviews (id, conversation_id, customer_id, professional_id, rating, body, created_at, updated_at)\nVALUES\n%s;" % ",\n".join(rev_rows))
    if reply_rows:
        L.append("INSERT INTO public.review_replies (review_id, body, created_at)\nVALUES\n%s;" % ",\n".join(reply_rows))
    L.append("-- teklif kabul/red olaylari (durum UPDATE tetikleyicisi yerine dogrudan; zaman gecmis)")
    L.append("INSERT INTO public.analytics_events (event_name, entity_type, entity_id, provider_id, payload, occurred_at, actor_user_id)\nSELECT v.ad, v.tip, v.eid::uuid, v.prov::uuid, v.payload, v.ts, v.actor::uuid FROM (VALUES\n%s\n) AS v(ad, tip, eid, prov, payload, ts, actor)\nON CONFLICT (event_name, entity_id) DO NOTHING;" % ",\n".join(ev_manual))
    # ---------------- C) teklif topla (quote_requests) — birkac
    L.append("-- C) teklif topla (quote_requests): kurum uyeleri ve musterilerden 1-2")
    qr_rows, qrr_rows = [], []
    qrn = 0
    for m in rnd.sample(D.musteriler + D.kurum_uyeleri, 10):
        qrn += 1
        kat = rnd.choice(list(V.KATEGORILER))
        adaylar = [p for p in gorunur if p["kat"] == kat][:4]
        if not adaylar:
            continue
        rid = uid(U_QR, qrn)
        gun = rnd.randint(10, 90)
        saat = rnd.uniform(24, 24 * 40)
        qr_rows.append("(%s, %s, pg_temp.kat(%s), pg_temp.sehir(%s), %s, %s, %s, %d, %d, %s, %d, %s, %s, %s)" % (
            q(rid), q(m["id"]), q(kat), q(m["sehir"]), qj({"note": "Birden fazla teklif alıp karşılaştırmak istiyoruz."}), d(gun), q(secim(rnd, V.KATEGORILER[kat]["turler"])),
            yuvarla(V.KATEGORILER[kat]["fiyat"][0]), yuvarla(V.KATEGORILER[kat]["fiyat"][1] * 0.5), t(saat - 24 * 5), len(adaylar), q("active" if gun > 0 else "expired"), t(saat), q(m["id"])))
        for p in adaylar:
            qrr_rows.append("(%s, %s, %s, %s)" % (q(rid), q(p["id"]), q(rnd.choice(["sent", "viewed", "declined"])), t(saat)))
    if qr_rows:
        L.append("INSERT INTO public.quote_requests (id, customer_id, category_id, city_id, brief_data, event_date, event_type, budget_min, budget_max, response_deadline, recipient_count, status, created_at, created_by)\nVALUES\n%s;" % ",\n".join(qr_rows))
        L.append("INSERT INTO public.quote_request_recipients (request_id, professional_id, status, created_at)\nVALUES\n%s;" % ",\n".join(qrr_rows))
    # ---------------- D) ajans teklifleri (FAZ 7a) + FAZ 7c rezervasyon
    L.append("-- D) ajans teklifleri: proposals/versions/items (kashe.faz7_rpc bayragi), gonderim, onay/red, FAZ 7c rezervasyon")
    prop_rows, ver_rows, item_rows, sent_rows, status_rows, appr_rows, pbook_rows = [], [], [], [], [], [], []
    pn = vn = itn = 0
    for a in D.ajanslar:
        evs = [e for e in D.etkinlikler if e["sahip"] is a]
        for ev in evs:
            if ev["status"] == "draft":
                continue
            for k in range(rnd.choice([1, 1, 2, 3])):
                pn += 1
                vn += 1
                pid, vid = uid(U_PROP, pn), uid(U_VER, vn)
                alici_kurum = rnd.choice(D.kurumlar) if (ev["tur"] not in ("wedding", "engagement", "henna", "birthday", "baby_shower", "circumcision") and rnd.random() < 0.7) else None
                alici_kisi = None if alici_kurum else (rnd.choice(D.musteriler) if rnd.random() < 0.6 else None)
                client_name = None if (alici_kurum or alici_kisi) else "%s %s" % (rnd.choice(V.KADIN_ADLAR + V.ERKEK_ADLAR), rnd.choice(V.SOYADLAR))
                client_email = None if not client_name else "%s@example.com" % slugla(client_name)
                olusturma = ev["olusturma"] - rnd.uniform(2, 48)
                gonderim = olusturma - rnd.uniform(1, 72)
                if gonderim <= 0.5:
                    gonderim = 0.5
                if ev["gun"] < 0:
                    sonuc = secim(rnd, {"approved": 60, "declined": 25, "sent": 5, "viewed": 5, "expired": 5})
                else:
                    sonuc = secim(rnd, {"sent": 25, "viewed": 25, "approved": 30, "revision_requested": 10, "declined": 10})
                if k > 0:
                    sonuc = rnd.choice(["declined", "viewed", "sent"])
                baslik = "%s — %s" % (ev["baslik"], rnd.choice(["Teknik paket", "Tam kapsam teklifi", "Sahne ve müzik", "Çekim ve içerik", "Organizasyon teklifi"]))
                prop_rows.append("(%s, pg_temp.org(%s), %s, %s, %s, %s, %s, %s, %s, 'direct', %s, %s, %s)" % (
                    q(pid), q(a["id"]), q(a["id"]), q(alici_kisi["id"]) if alici_kisi else "NULL", ("pg_temp.org(%s)" % q(alici_kurum["id"])) if alici_kurum else "NULL",
                    q(ev["id"]), q(baslik), q(client_name), q(client_email), q(a["id"]), t(olusturma), t(olusturma)))
                ver_rows.append("(%s, %s, 1, 0.20, %s, %s, %s, %s, %s)" % (q(vid), q(pid), q(rnd.choice(["Fiyatlara KDV dahil değildir. Ulaşım şehir içi dahildir.", "Teklif 14 gün geçerlidir; kapora %30.", None])),
                                                                     t(gonderim - 24 * 14), q(a["id"]), t(olusturma), t(olusturma)))
                # kalemler: etkinlik rolleri + ajansin odaklari
                roller = list(dict.fromkeys(ev["roller"] + rnd.sample(a["odak"], min(2, len(a["odak"])))))[: rnd.randint(2, 5)]
                for ri, r in enumerate(roller):
                    itn += 1
                    lo, hi = V.KATEGORILER[r]["fiyat"]
                    fiyat = yuvarla(rnd.uniform(lo, hi * 0.7) * (1.15 if ev["sehir"] == "İstanbul" else 1.0))
                    adet = rnd.choice([1, 1, 1, 2])
                    uye = None
                    item_rows.append("(%s, %s, pg_temp.rol(%s), %s, %d, %d, %s, %d)" % (q(uid(U_ITEM, itn)), q(vid), q(r), q("%s (%s)" % (V.KATEGORILER[r]["ad"], tur_ad(ev["tur"]))), adet, fiyat, "true" if rnd.random() < 0.92 else "false", ri))
                sent_rows.append("UPDATE public.proposal_versions SET sent_at = %s WHERE id = %s;" % (t(gonderim), q(vid)))
                if sonuc in ("approved", "declined", "revision_requested", "expired", "viewed"):
                    durum_zaman = gonderim - rnd.uniform(2, max(2.5, min(24 * 10, gonderim - 2)))
                    if durum_zaman < 0.2:
                        durum_zaman = 0.2
                    if sonuc == "approved":
                        appr_rows.append("UPDATE public.proposal_versions SET approved_by_name = %s, approved_at = %s WHERE id = %s;" % (q(client_name or (alici_kisi["full"] if alici_kisi else alici_kurum["full"])), t(durum_zaman), q(vid)))
                    status_rows.append("UPDATE public.proposals SET status = %s WHERE id = %s;" % (q(sonuc), q(pid)))
                    if sonuc == "approved":
                        bn += 1
                        bid = uid(U_BOOK, bn)
                        bst = "completed" if ev["gun"] < -1 and rnd.random() < 0.85 else ("cancelled" if rnd.random() < 0.08 else "confirmed")
                        pbook_rows.append("(%s, %s, %s, %s, %s, %s, %s, %s, %s, %d, (SELECT total_amount FROM public.proposal_versions WHERE id = %s), %s)" % (
                            q(bid), q(vid), q(a["id"]), ("pg_temp.org(%s)" % q(alici_kurum["id"])) if alici_kurum else "NULL", q(alici_kisi["id"]) if alici_kisi else "NULL", q(ev["id"]),
                            d(ev["gun"]), q(ev["tur"]), q(ev["sehir"]), ev["kisi"], q(vid), t(max(durum_zaman - 0.5, 0.1))))
                        if bst == "completed":
                            book_update_p = "UPDATE public.bookings SET status = 'completed', completed_at = %s WHERE id = %s;" % (t(max(-ev["gun"] * 24 - 24, 0.5)), q(bid))
                            pbook_rows.append(("UPD", book_update_p))
                        elif bst == "cancelled":
                            pbook_rows.append(("UPD", "UPDATE public.bookings SET status = 'cancelled', cancelled_at = %s, cancelled_by = %s, cancellation_reason = 'Etkinlik ertelendi' WHERE id = %s;" % (t(max(durum_zaman - 48, 0.3)), q(a["id"]), q(bid))))
                else:
                    status_rows.append("UPDATE public.proposals SET status = 'sent' WHERE id = %s;" % q(pid))
    L.append("""DO $$
BEGIN
  PERFORM set_config('kashe.faz7_rpc', '1', true);
  INSERT INTO public.proposals (id, seller_organization_id, seller_provider_id, buyer_user_id, buyer_organization_id, event_id, title, client_name, client_email, source_type, created_by, created_at, updated_at)
  VALUES
%s;
  INSERT INTO public.proposal_versions (id, proposal_id, version_no, tax_rate, notes, valid_until, created_by, created_at, updated_at)
  VALUES
%s;
  UPDATE public.proposals p SET current_version_id = v.id FROM public.proposal_versions v WHERE v.proposal_id = p.id AND p.id::text LIKE '5a4e0003-%%';
  INSERT INTO public.proposal_items (id, proposal_version_id, role_id, description, quantity, unit_client_price, is_visible_to_client, sort_order)
  VALUES
%s;
  -- gonderim (sent_at ilk kez; tetikleyici proposal_sent olayini sent_at ile yazar)
%s
  -- durumlar (proposal_* olaylari now() ile yazilir; asagida duzeltilir)
%s
%s
  PERFORM set_config('kashe.faz7_rpc', '0', true);
END $$;""" % (",\n".join(prop_rows), ",\n".join(ver_rows), ",\n".join(item_rows), "\n".join(sent_rows), "\n".join(appr_rows), "\n".join(status_rows)))
    ins = [r for r in pbook_rows if not isinstance(r, tuple)]
    upd = [r[1] for r in pbook_rows if isinstance(r, tuple)]
    if ins:
        L.append("INSERT INTO public.bookings (id, proposal_version_id, seller_provider_id, buyer_organization_id, customer_id, event_id, event_date, event_type, location, guest_count, total_amount, created_at)\nVALUES\n%s;" % ",\n".join(ins))
        L.append("\n".join(upd))
    # ---------------- E) zaman duzeltmeleri
    L.append("""-- E) zaman duzeltmeleri: tetikleyicilerin now() yazdigi olaylar/bildirimler varlik zamanina cekilir
UPDATE public.analytics_events a SET occurred_at = b.created_at FROM public.bookings b WHERE a.entity_type = 'booking' AND a.event_name = 'booking_created' AND a.entity_id = b.id AND b.id::text LIKE '5a4e0013-%';
UPDATE public.analytics_events a SET occurred_at = LEAST(COALESCE(v.approved_at, v.sent_at + interval '3 days'), now()) FROM public.proposals p JOIN public.proposal_versions v ON v.id = p.current_version_id
 WHERE a.entity_type = 'proposal' AND a.entity_id = p.id AND p.id::text LIKE '5a4e0003-%' AND a.event_name IN ('proposal_approved', 'proposal_declined', 'proposal_revision');
UPDATE public.analytics_events a SET occurred_at = e.created_at FROM public.events e WHERE a.entity_type = 'event' AND a.entity_id = e.id AND e.id::text LIKE '5a4e0002-%';
UPDATE public.conversations c SET last_message_at = m.son FROM (SELECT conversation_id, max(created_at) AS son FROM public.messages WHERE conversation_id::text LIKE '5a4e0010-%' GROUP BY conversation_id) m WHERE m.conversation_id = c.id;
-- bildirimler: konusma bildirimleri son mesaj zamanina (±48 saat), yorum bildirimleri yorum zamanina; 14 gunden eskiler okunmus
UPDATE public.notifications n SET created_at = c.last_message_at - (random() * interval '48 hours'),
       read_at = CASE WHEN c.last_message_at < now() - interval '14 days' THEN c.last_message_at + interval '3 hours' END
  FROM public.conversations c WHERE n.link = '/mesajlar/' || c.id::text AND c.id::text LIKE '5a4e0010-%' AND n.user_id::text LIKE '5a4e0000-%' AND n.created_at > now() - interval '1 hour';
UPDATE public.notifications n SET created_at = r.created_at, read_at = CASE WHEN r.created_at < now() - interval '14 days' THEN r.created_at + interval '5 hours' END
  FROM public.reviews r WHERE n.type = 'review' AND n.user_id = r.professional_id AND r.id::text LIKE '5a4e0014-%' AND n.created_at > now() - interval '1 hour';
UPDATE public.notifications SET created_at = now() - interval '2 days' WHERE user_id::text LIKE '5a4e0000-%' AND created_at > now() - interval '1 hour';""")
    L.append("""-- ozet
SELECT (SELECT count(*) FROM public.events WHERE id::text LIKE '5a4e0002-%') AS etkinlik,
       (SELECT count(*) FROM public.conversations WHERE id::text LIKE '5a4e0010-%') AS konusma,
       (SELECT count(*) FROM public.messages WHERE conversation_id::text LIKE '5a4e0010-%') AS mesaj,
       (SELECT count(*) FROM public.quotes WHERE id::text LIKE '5a4e0012-%') AS teklif,
       (SELECT count(*) FROM public.quotes WHERE id::text LIKE '5a4e0012-%' AND status = 'accepted') AS kabul,
       (SELECT count(*) FROM public.bookings WHERE id::text LIKE '5a4e0013-%') AS rezervasyon,
       (SELECT count(*) FROM public.bookings WHERE id::text LIKE '5a4e0013-%' AND status = 'completed') AS tamamlanan,
       (SELECT count(*) FROM public.reviews WHERE id::text LIKE '5a4e0014-%') AS yorum,
       (SELECT count(*) FROM public.proposals WHERE id::text LIKE '5a4e0003-%') AS ajans_teklifi,
       (SELECT count(*) FROM public.proposals WHERE id::text LIKE '5a4e0003-%' AND status = 'approved') AS onayli,
       (SELECT count(*) FROM public.analytics_events WHERE entity_id::text LIKE '5a4e%') AS olay,
       (SELECT count(*) FROM public.notifications WHERE user_id::text LIKE '5a4e0000-%') AS bildirim;""")
    D.gecmis_dosyalari = paketle(L, out, "02", "sahne-gecmis", D,
        lambda onceki: "DO $$ DECLARE n int; BEGIN SELECT count(*) INTO n FROM public.conversations WHERE id::text LIKE '5a4e0010-%%'; IF n < 100 THEN RAISE EXCEPTION 'on kosul: once 02a..02%s (konusma=%%)', n; END IF; END $$;" % onceki)


# ----------------------------------------------------------------------------- 00 / 03 / plan / md
def yaz_00(D, out):
    with open(os.path.join(out, "00-sahne-temizlik.sql"), "w", encoding="utf-8") as f:
        f.write("-- SAHNE 00 — temizlik: tum Sahne verisini siler (fixture'lar ve sema etkilenmez). YALNIZ DALDA. Storage nesneleri: node scripts/sahne/foto-yukle.mjs --sil\n\n")
        f.write(GUARD + "\n" + TEMIZLIK_FN + "\nSELECT pg_temp.sahne_temizle() AS sonuc;\n")
    rows = ",\n".join("(%s, %s, %s, %d)" % (q(s), q(m["ad"]), q(m["emoji"]), i * 10) for i, (s, m) in enumerate(V.KATEGORILER.items()))
    with open(os.path.join(out, "00-sahne-taksonomi.sql"), "w", encoding="utf-8") as f:
        f.write("""-- SAHNE 00 — taksonomi guvencesi: 23 kategori eksikse ekler (rolu trg_faz3 tetikleyicisi turetir). Dalda 0 satir beklenir.
-- Adlar yalniz EKSIK kategori icin kullanilir; mevcut satirlara dokunulmaz.
INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active, layer)
SELECT v.slug, v.ad, v.emoji, v.sira, true, 'legacy_role' FROM (VALUES
%s
) AS v(slug, ad, emoji, sira)
WHERE NOT EXISTS (SELECT 1 FROM public.service_categories c WHERE c.slug = v.slug);
SELECT (SELECT count(*) FROM public.service_categories WHERE slug IN (%s)) AS kategori,
       (SELECT count(*) FROM public.service_roles WHERE slug IN (%s)) AS rol;
""" % (rows, ",".join(q(s) for s in V.KATEGORILER), ",".join(q(s) for s in V.KATEGORILER)))
    with open(os.path.join(out, "03-sahne-hesap.sql"), "w", encoding="utf-8") as f:
        f.write("""-- SAHNE 03 — zeka katmani hesaplari: fiyat kiyaslari + guven puani (YALNIZ DALDA; 02'den sonra)
%s
SELECT public.price_benchmarks_compute() AS kiyas_satiri;
SELECT public.trust_score_compute() AS guven_satiri;
-- ozet 1: fiyat kiyasi hucreleri (yayinli / esik alti)
SELECT count(*) AS hucre, count(*) FILTER (WHERE is_published) AS yayinli,
       count(*) FILTER (WHERE is_published AND city_id IS NOT NULL AND event_type IS NOT NULL) AS yayinli_rol_sehir_tur,
       count(*) FILTER (WHERE is_published AND city_id IS NOT NULL AND event_type IS NULL) AS yayinli_rol_sehir,
       count(*) FILTER (WHERE is_published AND city_id IS NULL) AS yayinli_rol
  FROM public.price_benchmarks WHERE period_end = (now() AT TIME ZONE 'Europe/Istanbul')::date;
-- ozet 2: guven dagilimi (Sahne saglayicilari)
SELECT width_bucket(pr.trust_score, 0, 100, 5) AS dilim, count(*) AS saglayici, round(avg(pr.trust_score), 1) AS ortalama
  FROM public.providers pr JOIN public.profiles p ON p.id = pr.id WHERE p.email LIKE 'sahne+%%' AND pr.trust_score IS NOT NULL GROUP BY 1 ORDER BY 1;
-- ozet 3: kategori basina gorunur profil / tamamlanan is / yorum
SELECT c.slug, count(DISTINCT v.id) FILTER (WHERE v.is_visible) AS gorunur,
       (SELECT count(*) FROM public.bookings b JOIN public.profiles pp ON pp.id = COALESCE(b.professional_id, b.seller_provider_id) WHERE pp.primary_category_id = c.id AND b.status = 'completed' AND pp.email LIKE 'sahne+%%') AS tamamlanan,
       (SELECT count(*) FROM public.reviews r JOIN public.profiles pp ON pp.id = r.professional_id WHERE pp.primary_category_id = c.id AND pp.email LIKE 'sahne+%%') AS yorum
  FROM public.service_categories c JOIN public.v_providers_public v ON v.primary_category_id = c.id JOIN public.profiles p ON p.id = v.id AND p.email LIKE 'sahne+%%'
 GROUP BY c.id, c.slug ORDER BY gorunur DESC;
""" % GUARD)

ESLESTIRME_DO = """DO $$
DECLARE r record; run uuid; ids uuid[]; aday record; k int;
BEGIN
  FOR r IN SELECT * FROM (VALUES
%s
  ) AS v(etkinlik, sahip, strateji, kosu, goster, tikla) LOOP
    DELETE FROM public.match_runs WHERE event_id = r.etkinlik::uuid;   -- tekrar kosuda eski Sahne kosusu gider
    PERFORM set_config('request.jwt.claim.sub', r.sahip, true);
    run := public.run_event_match(r.etkinlik::uuid, r.strateji::public.match_strategy);
    -- gosterilenler: rol basina ilk N aday; tiklananlar: gosterilenlerden ilk M (deterministik sira)
    SELECT array_agg(id) INTO ids FROM public.match_candidates WHERE match_run_id = run AND final_rank <= r.goster;
    IF ids IS NOT NULL THEN PERFORM public.mark_match_candidates_shown(run, ids); END IF;
    k := 0;
    FOR aday IN SELECT id FROM public.match_candidates WHERE match_run_id = run AND was_shown ORDER BY final_rank, provider_id LOOP
      EXIT WHEN k >= r.tikla;
      PERFORM public.mark_match_candidate_clicked(aday.id);
      k := k + 1;
    END LOOP;
    -- zaman: kosu, adaylar ve olaylar etkinlik olusturmasindan sonraki gune cekilir (tetikleyiciler now() yazdi)
    UPDATE public.match_runs SET created_at = r.kosu WHERE id = run;
    UPDATE public.match_candidates SET created_at = r.kosu WHERE match_run_id = run;
    UPDATE public.analytics_events SET occurred_at = r.kosu WHERE entity_type = 'match_run' AND entity_id = run;
    UPDATE public.analytics_events a SET occurred_at = r.kosu + (CASE a.event_name WHEN 'match_shown' THEN interval '2 minutes' ELSE interval '9 minutes' END)
      FROM public.match_candidates mc WHERE a.entity_type = 'match_candidate' AND a.entity_id = mc.id AND mc.match_run_id = run;
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;"""

def yaz_04(D, out):
    # eslestirme gecmisi (bulgular #8): onayli / eslesme durumundaki etkinlikler icin run_event_match (sahip JWT'siyle),
    # rol basina ilk 6-10 aday gosterildi, 0-3 aday tiklandi; zamanlar etkinlik olusturmasindan 1-3 gun sonra.
    # Tamamlanmis/rezervasyonlu etkinlikler RPC'nin durum kosulu (confirmed/matching) disinda kalir; gecmis kosu uydurulmaz.
    rnd = random.Random(D.seed + 4)
    secilen = [ev for ev in D.etkinlikler if ev["status"] in ("confirmed", "matching")]
    rows = []
    for ev in secilen:
        strateji = "hybrid" if ev["sahip"]["tip"] == "kurum" else rnd.choice(["hybrid", "hybrid", "individual"])
        kosu = max(ev["olusturma"] - rnd.uniform(24, 72), 1.0)
        rows.append("(%s, %s, %s, %s, %d, %d)" % (q(ev["id"]), q(ev["sahip"]["id"]), q(strateji), t(kosu), rnd.randint(6, 10), rnd.randint(0, 3)))
    D.eslestirme_sayisi = len(rows)
    L = ["-- SAHNE 04 — eslestirme gecmisi (FAZ 6 run_event_match + mark_match_candidates_shown / mark_match_candidate_clicked); YALNIZ DALDA; 02'den sonra.",
         "-- Onayli/eslesme durumundaki %d etkinlik icin sahip JWT'siyle kosu; adaylar gercek Sahne verisinden (uydurma aday yok)." % len(rows),
         GUARD, TEMP_FN, ESLESTIRME_DO % ",\n".join(rows),
         """-- ozet
SELECT (SELECT count(*) FROM public.match_runs r JOIN public.events e ON e.id = r.event_id WHERE e.id::text LIKE '5a4e0002-%') AS kosu,
       (SELECT count(*) FROM public.match_candidates c JOIN public.match_runs r ON r.id = c.match_run_id JOIN public.events e ON e.id = r.event_id WHERE e.id::text LIKE '5a4e0002-%') AS aday,
       (SELECT count(*) FROM public.match_candidates c JOIN public.match_runs r ON r.id = c.match_run_id JOIN public.events e ON e.id = r.event_id WHERE e.id::text LIKE '5a4e0002-%' AND c.was_shown) AS gosterilen,
       (SELECT count(*) FROM public.match_candidates c JOIN public.match_runs r ON r.id = c.match_run_id JOIN public.events e ON e.id = r.event_id WHERE e.id::text LIKE '5a4e0002-%' AND c.was_clicked) AS tiklanan,
       (SELECT count(DISTINCT c.provider_id) FROM public.match_candidates c JOIN public.match_runs r ON r.id = c.match_run_id JOIN public.events e ON e.id = r.event_id WHERE e.id::text LIKE '5a4e0002-%' AND c.was_shown) AS gosterilen_saglayici,
       (SELECT count(*) FROM public.analytics_events WHERE event_name IN ('match_run', 'match_shown', 'match_clicked') AND occurred_at > now() - interval '1 hour') AS simdiki_olay;"""]
    with open(os.path.join(out, "04-sahne-eslestirme.sql"), "w", encoding="utf-8") as f:
        f.write("\n\n".join(L) + "\n")

def yaz_plan(D, plan, out):
    with open(os.path.join(out, "foto-plan.json"), "w", encoding="utf-8") as f:
        json.dump({"proje_url": PROJE_URL, "storage": STORAGE, "uretildi": D.tarih, "kategoriler": {s: {"ad": m["ad"], "arama": m["arama"]} for s, m in V.KATEGORILER.items()},
                   "kullanicilar": plan}, f, ensure_ascii=False, indent=1)

def yaz_md(D, out):
    L = ["# Sahne hesaplari (dal projesi; parola hepsinde `%s`)" % PAROLA, "", "Uretildi: %s, tohum %d. E-posta kutusu yok; sifre sifirlama calismaz." % (D.tarih, D.seed), "",
         "## Yonetici", "", "| E-posta | Not |", "|---|---|", "| `%s` | Sahne yoneticisi (is_admin), /admin icin |" % D.admin["email"], "",
         "## Ajanslar (sahip hesabi)", "", "| E-posta | Ajans | Sehir | Odak | Ekip |", "|---|---|---|---|---|"]
    for a in D.ajanslar:
        L.append("| `%s` | %s | %s | %s | %s |" % (a["email"], a["sirket"], a["sehir"], ", ".join(a["odak"]), ", ".join("%s (%s)" % (m["p"]["full"], m["rol"]) for m in a["uyeler"])))
    L += ["", "## Kurumlar (sahip + uye)", "", "| Sahip | Uye | Kurum | Sehir |", "|---|---|---|---|"]
    for k in D.kurumlar:
        L.append("| `%s` | `%s` | %s | %s |" % (k["email"], k["uyeler"][0]["email"], k["sirket"], k["sehir"]))
    L += ["", "## Profesyoneller", "", "| E-posta | Ad | Kategori | 2. rol | Sehir | Durum | Dogrulama | Premium |", "|---|---|---|---|---|---|---|---|"]
    for p in sorted(D.prolar, key=lambda x: (x["kat"], x["full"])):
        durum = p["durum"] + (" / askida" if p.get("askida") else "") + ("" if p["yayinda"] else " / yayinda degil")
        L.append("| `%s` | %s | %s | %s | %s | %s | %s | %s |" % (p["email"], p["full"], p["kat"], p["kat2"] or "", p["sehir"], durum, p["dogrulama"], p["premium"]))
    L += ["", "## Musteriler", "", "| E-posta | Ad | Sehir |", "|---|---|---|"]
    for m in D.musteriler:
        L.append("| `%s` | %s | %s |" % (m["email"], m["full"], m["sehir"]))
    L += ["", "## Davetler (FAZ 10a; `organization_invitations`)", "",
          "Bekleyenler tur icindir: davetli hesapla `/davetlerim` -> kabul/ret; kurulus sahibiyle `/profil/ekibim` ya da `/profil/kurumsal-ekip` -> iptal.",
          "Suresi gecmis bekleyenler arayuzde \"Suresi doldu\" gorunur (DB durumu pending). Gecmis kabul/ret/iptal kayitlari davet listelerini doldurur.", "",
          "| Kurulus (sahip e-postasi) | Davetli | Rol | Durum |", "|---|---|---|---|"]
    for dv in sorted(D.davetler, key=lambda x: (x["durum"] != "pending", x["sahip"]["email"])):
        durum = dv["durum"] + (" (suresi gecmis)" if dv["durum"] == "pending" and dv["saat"] > 14 * 24 else "")
        L.append("| %s (`%s`) | `%s` %s | %s | %s |" % (dv["sahip"]["sirket"], dv["sahip"]["email"], dv["kisi"]["email"], dv["kisi"]["full"], dv["rol"], durum))
    L += ["", "## Eslestirme gecmisi (04)", "",
          "%d onayli/eslesme durumundaki etkinlik icin `run_event_match` kosusu (sahip hesabiyla); rol basina ilk 6-10 aday gosterildi, 0-3 aday tiklandi. Admin `/admin/zeka` huni ve adalet bloklari bu kosulari okur." % getattr(D, "eslestirme_sayisi", 0)]
    with open(os.path.join(out, "hesaplar.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--out", default=os.path.join(HERE, "..", "..", "docs", "sahne"))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    D = Dunya(a.seed)
    D.seed = a.seed
    D.tarih = datetime.date.today().isoformat()
    plan = yaz_01(D, a.out)
    yaz_02(D, a.out)
    yaz_04(D, a.out)
    yaz_00(D, a.out)
    yaz_plan(D, plan, a.out)
    yaz_md(D, a.out)
    print("Sahne: %d hesap (%d pro, %d ajans, %d kurum, %d uye, %d musteri), %d etkinlik, %d davet, %d eslestirme kosusu -> %s" % (
        len(D.kullanicilar), len(D.prolar), len(D.ajanslar), len(D.kurumlar), len(D.kurum_uyeleri), len(D.musteriler), len(D.etkinlikler),
        len(D.davetler), D.eslestirme_sayisi, os.path.abspath(a.out)))

if __name__ == "__main__":
    main()
