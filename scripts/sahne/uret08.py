# =============================================================================
# SAHNE 08 ureteci - ilanlar, basvurular, paketler, hizmet eklentileri (bulgu 76b / 77)
#   python scripts/sahne/uret08.py   -> docs/sahne/08-sahne-ilanlar-paketler.sql (UTF-8, LF; PowerShell '>' kullanma)
# Icerik bu dosyada SABIT (rastgelelik yok); kimlikler 5a4e0000-0000-4000-8000-00000008xxxx.
# Kurulum sirasi: 00 -> 01a/01b -> 02a..02e -> 03 -> 04 -> 06 -> 08 (07 v3.1 ureticisiyle gereksiz).
# =============================================================================
import os
import sys

P = '5a4e0000-0000-4000-8000-'
def pid(n): return P + '%012d' % n
def q(s): return "'" + s.replace("'", "''") + "'"
def arr(items): return q('[' + ', '.join('"' + i.replace('"', '\\"') + '"' for i in items) + ']') + '::jsonb'

# ---------------------------------------------------------------- paketler
# (saglayici, baslik, aciklama, icerik, fiyat_min, fiyat_max, baslangic)
PAKET = [
  # ajanslar
  (20001, 'Kurumsal Gala Paketi', 'Akış planından sahneye tek ekip: gala gecesi için planlama, sunucu, DJ ve teknik.', ['Akış ve sahne planı', 'Sunucu + DJ', 'Ses ve ışık sistemi', 'Etkinlik günü koordinasyon ekibi'], 180000, None, True),
  (20001, 'Düğün Organizasyonu - Temel', 'Nikah, karşılama ve akşam programı için temel organizasyon.', ['Program ve zaman çizelgesi', 'Karşılama müziği', 'DJ ve ses sistemi', 'Gün boyu koordinatör'], 120000, None, True),
  (20002, 'Konferans Ses-Işık Paketi', '300 kişilik salon için konuşma odaklı ses, ışık ve sahne ekranı.', ['Kablosuz yaka + el mikrofonu (4)', 'Sahne ışığı', 'LED ekran / projeksiyon', 'Teknik operatör'], 45000, None, True),
  (20002, 'Konser Prodüksiyon Paketi', 'Açık ya da kapalı alan konser için tam prodüksiyon.', ['Line array ses sistemi', 'Hareketli ışık ve truss', 'Sahne monitör sistemi', 'Kurulum ve söküm ekibi'], 150000, None, True),
  (20003, 'Lansman Organizasyonu', 'Ürün ya da mağaza lansmanı için konsept, akış ve sahne.', ['Konsept ve akış', 'Sunucu', 'Hostes ekibi', 'Fotoğraf ve video'], 140000, None, True),
  (20003, 'Doğum Günü Partisi', 'Çocuk ya da yetişkin doğum günü için tema, eğlence ve süsleme.', ['Tema ve süsleme', 'Palyaço ya da animatör', 'Müzik', 'Pasta masası kurulumu'], 35000, None, True),
  (20004, 'Kongre Operasyon Paketi', 'Çok salonlu kongre için kayıt, salon ve teknik operasyon.', ['Kayıt masası ve hostes', 'Salon koordinasyonu', 'Ses ve görüntü', 'Simültane tercüme altyapısı'], 220000, None, True),
  (20004, 'Nişan / Kına Paketi', 'Nişan ya da kına gecesi için program, müzik ve süsleme.', ['Program akışı', 'Müzisyen ya da DJ', 'Süsleme', 'Fotoğrafçı'], 60000, None, True),
  (20005, 'Gala Gecesi Müzik Paketi', 'Karşılamada caz trio, yemekte akustik set, gece kapanışında DJ; ses sistemi dahil.', ['Caz trio karşılama (60 dk)', 'Akustik yemek seti', 'DJ performansı (2 saat)', 'Ses sistemi ve teknisyen'], 85000, None, True),
  (20005, 'Düğün Müzik Paketi', 'Karşılama, ilk dans ve eğlence bölümü için müzik ve dans gösterisi.', ['Akustik karşılama', 'İlk dans eşlik', 'DJ performansı', 'Dans gösterisi (2 dansçı)'], 65000, None, True),
  (20006, 'Ödül Töreni Sunum Paketi', 'Ödül töreni ya da bayi gecesi için sunucu, metin ve prova.', ['Sunum metni', 'Prova', 'Sunucu (Türkçe / İngilizce)', 'Sahne yönetimi'], 40000, None, True),
  (20006, 'Panel Moderasyonu', 'Konferans ve paneller için moderatör ve soru akışı.', ['Ön görüşme', 'Soru akışı', 'Moderatör', 'Zaman yönetimi'], 25000, None, True),
  (20007, 'DJ + Işık Parti Paketi', 'Parti ve kutlamalar için DJ, dans pisti ışığı ve duman.', ['DJ performansı (4 saat)', 'Dans pisti ışığı', 'Duman makinesi', 'Kurulum'], 30000, None, True),
  (20007, 'Kurumsal Kokteyl DJ', 'Kokteyl ve resepsiyonlar için lounge DJ seti.', ['Lounge set (3 saat)', 'Kablosuz mikrofon', 'Ses sistemi'], 22000, None, True),
  (20008, 'Fuar Stand Ekibi', 'Fuar standı için 4 kişilik hostes / model ekibi, 3 gün.', ['4 hostes / model', 'Kıyafet koordinasyonu', 'Ekip sorumlusu', 'Günlük raporlama'], 48000, None, True),
  (20008, 'Lansman Model Paketi', 'Ürün lansmanı için model ve sahne gösterimi.', ['3 model', 'Prova', 'Saç ve makyaj', 'Sahne yönetimi'], 60000, None, True),
  (20009, 'Etkinlik Günü Koordinasyonu', 'Etkinlik günü akış ve tedarikçi yönetimi.', ['Dakikalık akış', 'Tedarikçi takibi', 'Saha ekibi (2 kişi)'], 28000, None, True),
  (20009, 'Uçtan Uca Planlama', 'Bütçeden etkinlik gününe kadar planlama ve yönetim.', ['Bütçe planı', 'Tedarikçi seçimi', 'Akış ve prova', 'Etkinlik günü yönetimi'], 75000, None, True),
  (20010, 'Lansman İçerik Paketi', 'Lansman öncesi ve sırasında influencer içeriği.', ['3 influencer', 'Öncesi duyuru', 'Canlı paylaşım', 'Sonrası rapor'], 55000, None, True),
  (20010, 'Etkinlik Canlı Paylaşım', 'Etkinlik günü canlı hikaye ve reels paylaşımı.', ['1 influencer', 'Canlı hikaye', '2 reels', 'Erişim raporu'], 30000, None, True),
  (20011, 'Nikah Töreni Paketi', 'Nikah töreni için süsleme, karşılama ve müzik.', ['Nikah masası ve süsleme', 'Karşılama ekibi', 'Müzik', 'Fotoğrafçı'], 50000, None, True),
  (20011, 'Sünnet Düğünü Paketi', 'Sünnet düğünü için eğlence, süsleme ve müzik.', ['Tema süsleme', 'İllüzyonist ya da palyaço', 'DJ', 'Fotoğrafçı'], 70000, None, True),
  (20012, 'Açık Hava Sahne Paketi', 'Festival ve açık hava etkinlikleri için sahne, ses ve ışık.', ['Sahne kurulumu', 'Line array ses', 'Işık ve truss', 'Jeneratör'], 160000, None, True),
  (20012, 'Toplantı Teknik Paketi', 'Toplantı ve eğitimler için ses ve görüntü.', ['2 mikrofon', 'Projeksiyon', 'Teknik destek'], 18000, None, True),
  # profesyoneller
  (10003, 'Düğün Hikayesi - Tam Gün', 'Hazırlıktan gece kapanışına tam gün çekim, online galeri.', ['Tam gün çekim', '400+ düzenlenmiş fotoğraf', 'Online galeri', 'İkinci fotoğrafçı'], 32000, None, True),
  (10003, 'Kurumsal Etkinlik - Yarım Gün', 'Konferans, lansman ve gala için 4 saatlik çekim.', ['4 saat çekim', '150+ fotoğraf', '48 saatte teslim'], 14000, None, True),
  (10001, 'Nişan Çekimi', 'Nişan ya da söz için 3 saatlik çekim.', ['3 saat çekim', '200+ fotoğraf', 'Online galeri'], 12000, None, True),
  (10012, 'Düğün DJ Paketi', 'Karşılama, ilk dans ve eğlence bölümü için DJ ve ses sistemi.', ['5 saat DJ', 'Ses sistemi', 'Dans pisti ışığı'], 24000, None, True),
  (10013, 'Kokteyl DJ Seti', 'Lounge ve house ağırlıklı 3 saatlik set.', ['3 saat DJ', 'Ses sistemi'], 15000, None, True),
  (10021, 'Akustik Karşılama', 'Gitar ve vokal ile 60 dakikalık karşılama.', ['60 dk performans', 'Ses sistemi', 'Repertuvar görüşmesi'], 18000, None, True),
  (10031, 'Düğün Klibi', 'Düğün günü için 3-4 dakikalık klip ve uzun versiyon.', ['Tam gün çekim', '4 dk klip', '20 dk uzun versiyon', 'Drone'], 30000, None, True),
  (10040, 'Gala Sunuculuğu', 'Gala ve ödül törenleri için sunucu, metin ve prova.', ['Sunum metni', 'Prova', '4 saat sunum'], 20000, None, True),
  (10056, 'Dans Gösterisi (2 dansçı)', 'Düğün ve kutlamalar için 15 dakikalık gösteri.', ['2 dansçı', '15 dk gösteri', 'Kostüm'], 12000, None, True),
  (10085, 'Çocuk Partisi Eğlencesi', '2 saatlik palyaço gösterisi, oyunlar ve balon figürleri.', ['2 saat gösteri', 'Oyunlar', 'Balon figürleri'], 6000, None, True),
  (10079, 'Sahne İllüzyon Gösterisi', '30 dakikalık sahne gösterisi.', ['30 dk gösteri', 'Asistan', 'Işık ve müzik'], 15000, None, True),
  (10049, 'Karşılama Hostesi (Günlük)', 'Etkinlik ve fuarlar için günlük hostes hizmeti.', ['8 saat', 'Kıyafet', 'Kayıt masası deneyimi'], 4500, None, True),
  (10062, 'Küçük Salon Ses Paketi', '100 kişiye kadar salon için ses sistemi.', ['2 hoparlör', '2 mikrofon', 'Mikser', 'Teknisyen'], 9000, None, True),
  (10074, 'Gelin Saç ve Makyaj', 'Gelin için prova dahil saç ve makyaj.', ['Prova', 'Saç', 'Makyaj', 'Rötuş'], 11000, None, True),
  (10088, 'Ardıl Tercüme (Yarım Gün)', 'Toplantı ve görüşmeler için 4 saatlik ardıl tercüme.', ['4 saat', 'Hazırlık görüşmesi', 'Terim listesi'], 8000, None, True),
]

def tr(s):
    return s

# ---------------------------------------------------------------- eklentiler
# (saglayici, hizmet sirasi, baslik, aciklama, fiyat)
EKLENTI = [
  (10003, 1, 'İkinci fotoğrafçı', 'Tören ve dans aynı anda çekilir.', 4000),
  (10003, 1, 'Drone çekimi', 'Açık alanda 15 dakikalık hava çekimi.', 3500),
  (10003, 1, 'Baskılı albüm', '30x30, 40 sayfa.', 2500),
  (10001, 1, 'Ekstra saat', 'Saat başına.', 2000),
  (10012, 1, 'Ekstra saat', 'Saat başına DJ performansı.', 3000),
  (10012, 1, 'Duman makinesi', 'İlk dans için.', 1500),
  (10021, 1, 'Ek müzisyen', 'Keman ya da piyano.', 6000),
  (10031, 1, 'Kısa film kurgusu', 'Sosyal medya için 60 sn.', 5000),
  (10040, 1, 'İngilizce sunum', 'Tüm akış iki dilde.', 4000),
  (20005, 1, 'Ek müzisyen', 'Saksofon ya da keman.', 6500),
  (20005, 1, 'Ses sistemi (300 kişi)', 'Teknisyen dahil.', 9000),
  (20007, 1, 'Işık şovu', 'Hareketli ışık + lazer.', 7000),
]

# ---------------------------------------------------------------- ilanlar
# (no, olusturan, kategori, tur, il, tarih, butce_min, butce_max, kisi, baslik, aciklama, gereksinim, son_basvuru, acil)
ILAN = [
  (1, 30003, 'sunucu', 'corporate', 'Ankara', '2027-01-21', 20000, 35000, 250, 'Bayi toplantısı için sunucu', 'Yıllık bayi toplantımız için protokol deneyimli bir sunucu arıyoruz. Akış 4 saat; ödül bölümü ve iki panel var.', 'Kurumsal etkinlik deneyimi, protokol bilgisi', '2026-12-20', False),
  (2, 30004, 'ses-isik', 'launch', 'İzmir', '2027-02-18', 80000, 120000, 400, 'Yeni model lansmanı için ses-ışık ekibi', 'Showroom önünde açık alanda lansman yapacağız. Sahne, ses, ışık ve LED ekran dahil tek ekip bekliyoruz.', 'Açık alan deneyimi, jeneratör', '2027-01-15', False),
  (3, 30006, 'muzisyen', 'gala', 'Antalya', '2026-12-19', 40000, 70000, 300, 'Bayi gala gecesi için canlı müzik', 'Gala gecemizde karşılama ve yemek bölümü için caz ya da akustik grup arıyoruz; gece sonunda DJ de olabilir.', 'Gala repertuvarı', '2026-11-30', True),
  (4, 30007, 'fotografci', 'graduation', 'Ankara', '2027-06-25', 15000, 25000, 600, 'Mezuniyet töreni fotoğrafçısı', 'Açık havada yapılacak mezuniyet töreni için iki fotoğrafçılık ekip arıyoruz. Teslim online galeri.', 'Kalabalık tören deneyimi', '2027-04-30', False),
  (5, 30001, 'dj', 'corporate', 'İstanbul', '2026-12-26', 15000, 30000, 180, 'Yıl sonu partisi için DJ', 'Ofis yıl sonu partimiz için 4 saatlik DJ performansı istiyoruz; ses ve ışık DJ tarafından gelsin.', None, '2026-12-10', True),
  (6, 30005, 'tercuman', 'conference', 'İstanbul', '2027-03-10', 30000, 45000, 200, 'Konferans için simültane tercüman', 'Finans konferansımız için iki gün, Türkçe-İngilizce simültane tercüme. Kabin ve ekipman bizde.', 'Finans terminolojisi', '2027-02-01', False),
  (7, 40001, 'videograf', 'wedding', 'İstanbul', '2027-05-15', 25000, 40000, 220, 'Düğünümüz için video çekimi', 'Mayıs ayında kır düğünümüz var. Hazırlıktan gece sonuna kadar video ve kısa bir klip istiyoruz.', None, '2027-03-15', False),
  (8, 40002, 'palyaco', 'birthday', 'İzmir', '2026-12-12', 4000, 8000, 30, 'Kızımın 7. yaş günü için palyaço', 'Evde 25-30 çocuklu bir doğum günü. 2 saatlik gösteri, oyun ve balon figürleri bekliyoruz.', None, '2026-12-05', True),
  (9, 40003, 'dansci', 'henna', 'Bursa', '2027-04-10', 12000, 20000, 150, 'Kına gecesi için dansçı grubu', 'Kına gecemizde 15-20 dakikalık geleneksel dans gösterisi ve misafirleri piste kaldıracak bir ekip arıyoruz.', None, '2027-03-01', False),
  (10, 40005, 'illuzyonist', 'circumcision', 'Konya', '2027-06-05', 8000, 15000, 120, 'Sünnet düğünü için illüzyonist', 'Oğlumun sünnet düğünü için çocuklara yönelik 30 dakikalık bir gösteri istiyoruz.', None, '2027-04-15', False),
  (11, 30008, 'hostes', 'launch', 'Muğla', '2027-04-24', 20000, 35000, 250, 'Otel açılışı için hostes ekibi', 'Bodrum’daki yeni otelimizin açılışı için 4 kişilik karşılama ve kayıt ekibi arıyoruz.', 'İngilizce bilen en az 2 kişi', '2027-03-20', False),
  (12, 40012, 'muzisyen', 'engagement', 'Eskişehir', '2027-01-30', 10000, 18000, 80, 'Nişan töreni için akustik müzisyen', 'Restoranda yapılacak nişanımız için gitar ve vokal ile 2 saatlik akustik müzik istiyoruz.', None, '2027-01-10', False),
]

# Basvurular: (ilan no, basvuran, mesaj, teklif, durum)
BASVURU = [
  (1, 10040, 'Merhaba, 10 yıldır kurumsal etkinlik ve gala sunuculuğu yapıyorum; protokol ve ödül törenlerine hakimim.', 28000, 'shortlisted'),
  (1, 10038, 'Ankara merkezliyim, bayi toplantıları ve paneller için akışı birlikte hazırlayabiliriz.', 24000, 'pending'),
  (1, 20006, 'Artı Bir Ajans olarak sunucu ve moderatör ekibimizle bayi toplantınız için teklif vermek isteriz.', 32000, 'pending'),
  (2, 20012, 'Zirve Teknik olarak açık alan lansmanları için sahne, ses, ışık ve LED ekranı tek ekip sağlıyoruz.', 110000, 'pending'),
  (2, 20002, 'Lumen Prodüksiyon olarak İzmir’de benzer üç lansman yaptık; teknik çizim ve keşif için görüşelim.', 95000, 'shortlisted'),
  (3, 20005, 'Mavi Sahne olarak caz trio karşılama, akustik yemek seti ve DJ kapanışla gala paketimizi uyarlayabiliriz.', 65000, 'pending'),
  (3, 10024, 'Antalya merkezliyim, gala ve kokteyller için akustik repertuvarım ve ses sistemim hazır.', 42000, 'pending'),
  (4, 10008, 'Ankara’dayım, kalabalık tören çekimlerinde ikinci fotoğrafçıyla çalışıyorum; teslim bir hafta.', 18000, 'pending'),
  (5, 10012, 'Ofis partileri için house ve pop ağırlıklı set hazırlarım; ses ve ışık benden.', 22000, 'shortlisted'),
  (5, 20007, 'Ritim Müzik Ajansı olarak DJ + ışık parti paketimizle 4 saatlik performans sunabiliriz.', 28000, 'pending'),
  (6, 10088, 'Finans konferanslarında simültane deneyimim var; ikinci tercüman arkadaşımla birlikte çalışırız.', 40000, 'pending'),
  (7, 10031, 'Kır düğünlerinde doğal ışıkla çalışıyorum; uzun versiyon ve 4 dakikalık klip teslim ederim.', 32000, 'pending'),
  (7, 10033, 'İstanbul’dayım, düğün filmi ve drone çekimini aynı ekiple yapıyoruz.', 36000, 'pending'),
  (8, 10084, 'Çocuk partileri için 2 saatlik gösteri, oyunlar ve balon figürleriyle gelirim.', 6000, 'pending'),
  (9, 10055, 'İzmir merkezliyim ama Bursa’ya gelebilirim; kına için geleneksel gösteri hazırlarız.', 16000, 'pending'),
  (10, 10082, 'Çocuklara yönelik interaktif illüzyon gösterim var, 30 dakikalık akışı birlikte planlarız.', 12000, 'pending'),
  (11, 20008, 'Vizyon Cast olarak İngilizce bilen hostes ekibimizle açılışınızda kayıt ve karşılamayı üstleniriz.', 30000, 'pending'),
  (12, 10020, 'Eskişehir’e gelebilirim; gitar ve vokal ile nişanlar için romantik bir repertuvarım var.', 14000, 'pending'),
]

out = []
w = out.append
w("""-- =============================================================================
-- SAHNE 08 - ilanlar, basvurular, paketler, hizmet eklentileri (bulgu 76b / 77)
--
-- Neden: Fahri'nin turunda (#9 Mavi Sahne, #10 /ilanlar, #12 Kerem Oz) paket ve
-- ilan akislari test edilemedi: Sahne'de `listings`, `service_packages` ve
-- `service_addons` 0 satirdi. Bu dosya kucuk ve gercekci bir set ekler:
--   - 12 yayinda ilan (kurum ve musteri hesaplarindan; rehber hesaplari Beren /
--     Irem / Caner / Marmara ilan sahibi DEGIL) + 18 basvuru (rehber
--     profesyonelleri Kerem / Burcu / Sinan / Deniz Avci / Melih Basak basvuran
--     DEGIL - kendileri basvurabilsin diye),
--   - 12 ajansa 2'ser paket + 15 profesyonele 1-2 paket (Mavi Sahne ve Kerem Oz
--     dahil: Fahri'nin bulgulari tam bu sayfalarda),
--   - 9 hizmete 12 eklenti (ekstra).
-- Kimlikler sabit (5a4e0000-0000-4000-8000-00000008xxxx): once silinir, sonra
-- yazilir - tekrar calistirmak guvenli. Ilan bildirimi gonderilmez
-- (`notified_at` dolu); basvuru tetikleyicisi ilan sahibine bildirim yazar.
--
-- YALNIZ DAL (ukqhgspaallzjscjodbb) - Sahne verisi. Uretimde CALISTIRILMAZ.
-- Kosum: Dashboard > SQL Editor (dal) - tamami tek seferde.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '5a4e0000-0000-4000-8000-000000090001') THEN
    RAISE EXCEPTION 'Sahne yonetici hesabi yok - bu dosya yalniz Sahne verisi yuklu dalda calisir';
  END IF;
END $$;

-- Onceki 08 kosusu (sabit kimlikler; basvuru tetikleyicisinin yazdigi bildirimler dahil)
DELETE FROM public.notifications    WHERE link LIKE '/ilanlar/5a4e0000-0000-4000-8000-00000008%';
DELETE FROM public.applications     WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%';
DELETE FROM public.listings         WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%';
DELETE FROM public.service_addons   WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%';
DELETE FROM public.service_packages WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%';
""")

# paketler
w("-- Paketler (saglayicinin mevcut paket sirasinin arkasina)")
w("INSERT INTO public.service_packages (id, profile_id, title, description, includes, price_min, price_max, price_on_request, price_starting, is_active, sort_order, created_at, updated_at)")
rows = []
sira = {}
for i, (s, t, a, inc, mn, mx, bas) in enumerate(PAKET, 1):
    sira[s] = sira.get(s, 0) + 1
    rows.append("  (%s, %s, %s, %s, %s, %s, %s, false, %s, true, %d, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03')" % (
        q(pid(81000 + i)), q(pid(s)), q(tr(t)), q(tr(a)), arr([tr(x) for x in inc]), mn, 'NULL' if mx is None else mx, 'true' if bas else 'false', 100 + sira[s]))
w("SELECT v.id::uuid, v.profile_id::uuid, v.title, v.description, v.includes, v.pmin::numeric, v.pmax::numeric, v.por, v.pbas, v.akt, v.sira, v.c, v.u FROM (VALUES")
w(",\n".join(rows))
w(") AS v(id, profile_id, title, description, includes, pmin, pmax, por, pbas, akt, sira, c, u)")
w("WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v.profile_id::uuid);\n")

# eklentiler: saglayicinin sort_order'a gore N. hizmeti
w("-- Hizmet eklentileri: saglayicinin sort_order'a gore ilk hizmeti")
w("INSERT INTO public.service_addons (id, service_id, profile_id, title, description, price, is_active, sort_order, created_at)")
w("SELECT v.id::uuid, s.id, v.sahip::uuid, v.title, v.description, v.price, true, v.sira, timestamptz '2026-10-29 10:00+03'")
w("FROM (VALUES")
rows = []
for i, (s, n, t, a, f) in enumerate(EKLENTI, 1):
    rows.append("  (%s, %s, %d, %s, %s, %d, %d)" % (q(pid(82000 + i)), q(pid(s)), n, q(t), q(a), f, i))
w(",\n".join(rows))
w(") AS v(id, sahip, hizmet_no, title, description, price, sira)")
w("JOIN LATERAL (SELECT x.id FROM public.services x WHERE x.provider_id = v.sahip::uuid AND x.is_active")
w("              ORDER BY x.sort_order, x.created_at, x.id OFFSET (v.hizmet_no - 1) LIMIT 1) s ON true;\n")

# ilanlar
w("-- Ilanlar (yayinda; tarih / son basvuru Kasim 2026 sonrasi)")
w("INSERT INTO public.listings (id, creator_id, created_by, category_id, title, description, requirements, event_date, event_type, location, city_id,")
w("                             guest_count, budget_min, budget_max, status, expires_at, application_deadline, is_urgent, urgent_until, notified_at, created_at, updated_at)")
w("SELECT v.id::uuid, v.sahip::uuid, v.sahip::uuid, sc.id, v.baslik, v.aciklama, v.gerek, v.tarih::date, v.tur, v.il, ci.id,")
w("       v.kisi, v.bmin, v.bmax, 'published'::public.listing_status, (v.tarih::date + 1)::timestamptz, (v.son::date + time '23:59')::timestamptz AT TIME ZONE 'Europe/Istanbul',")
w("       v.acil, CASE WHEN v.acil THEN (v.son::date + time '23:59') AT TIME ZONE 'Europe/Istanbul' END, now(), v.olusma, v.olusma")
w("FROM (VALUES")
rows = []
for (no, s, kat, tur, il, tarih, bmin, bmax, kisi, bas, ac, ger, son, acil) in ILAN:
    olusma = "timestamptz '2026-10-%02d 1%d:00+03'" % (29 + (no % 3), no % 8)
    rows.append("  (%s, %s, %s, %s, %s, %s, %d, %d, %d, %s, %s, %s, %s, %s, %s)" % (
        q(pid(80000 + no)), q(pid(s)), q(kat), q(tur), q(il), q(tarih), bmin, bmax, kisi, q(bas), q(ac), 'NULL' if ger is None else q(ger), q(son), 'true' if acil else 'false', olusma))
w(",\n".join(rows))
w(") AS v(id, sahip, kat, tur, il, tarih, bmin, bmax, kisi, baslik, aciklama, gerek, son, acil, olusma)")
w("JOIN public.service_categories sc ON sc.slug = v.kat")
w("JOIN public.turkish_cities ci ON ci.name = v.il")
w("WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v.sahip::uuid);\n")

# basvurular
w("-- Basvurular (basvuran yayinda saglayici; ilan sahibine bildirim tetikleyicisi yazar)")
w("INSERT INTO public.applications (id, listing_id, applicant_id, cover_message, proposed_amount, status, created_at, updated_at, responded_at)")
w("SELECT v.id::uuid, v.ilan::uuid, v.basvuran::uuid, v.mesaj, v.teklif, v.durum::public.application_status, v.zaman, v.zaman,")
w("       CASE WHEN v.durum <> 'pending' THEN v.zaman + interval '1 day' END")
w("FROM (VALUES")
rows = []
for i, (no, b, m, t, d) in enumerate(BASVURU, 1):
    rows.append("  (%s, %s, %s, %s, %d, %s, timestamptz '2026-11-0%d 1%d:30+03')" % (q(pid(83000 + i)), q(pid(80000 + no)), q(pid(b)), q(m), t, q(d), 1 + i % 4, i % 9))
w(",\n".join(rows))
w(") AS v(id, ilan, basvuran, mesaj, teklif, durum, zaman)")
w("WHERE EXISTS (SELECT 1 FROM public.listings l WHERE l.id = v.ilan::uuid)")
w("  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v.basvuran::uuid AND p.is_published);\n")

w("""-- Ozet (SQL Editor tabloda gosterir)
SELECT 'ilan' AS tur, count(*) FROM public.listings WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%'
UNION ALL SELECT 'basvuru', count(*) FROM public.applications WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%'
UNION ALL SELECT 'paket', count(*) FROM public.service_packages WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%'
UNION ALL SELECT 'eklenti', count(*) FROM public.service_addons WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%';

COMMIT;
""")
HEDEF = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs', 'sahne', '08-sahne-ilanlar-paketler.sql')
if len(sys.argv) > 1:
    HEDEF = sys.argv[1]
with open(HEDEF, 'w', encoding='utf-8', newline='\n') as f:
    f.write("\n".join(out))
print('yazildi:', os.path.normpath(HEDEF))
