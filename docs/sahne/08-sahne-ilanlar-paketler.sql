-- =============================================================================
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

-- Paketler (saglayicinin mevcut paket sirasinin arkasina)
INSERT INTO public.service_packages (id, profile_id, title, description, includes, price_min, price_max, price_on_request, price_starting, is_active, sort_order, created_at, updated_at)
SELECT v.id::uuid, v.profile_id::uuid, v.title, v.description, v.includes, v.pmin::numeric, v.pmax::numeric, v.por, v.pbas, v.akt, v.sira, v.c, v.u FROM (VALUES
  ('5a4e0000-0000-4000-8000-000000081001', '5a4e0000-0000-4000-8000-000000020001', 'Kurumsal Gala Paketi', 'Akış planından sahneye tek ekip: gala gecesi için planlama, sunucu, DJ ve teknik.', '["Akış ve sahne planı", "Sunucu + DJ", "Ses ve ışık sistemi", "Etkinlik günü koordinasyon ekibi"]'::jsonb, 180000, 252000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081002', '5a4e0000-0000-4000-8000-000000020001', 'Düğün Organizasyonu - Temel', 'Nikah, karşılama ve akşam programı için temel organizasyon.', '["Program ve zaman çizelgesi", "Karşılama müziği", "DJ ve ses sistemi", "Gün boyu koordinatör"]'::jsonb, 120000, 168000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081003', '5a4e0000-0000-4000-8000-000000020002', 'Konferans Ses-Işık Paketi', '300 kişilik salon için konuşma odaklı ses, ışık ve sahne ekranı.', '["Kablosuz yaka + el mikrofonu (4)", "Sahne ışığı", "LED ekran / projeksiyon", "Teknik operatör"]'::jsonb, 45000, 63000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081004', '5a4e0000-0000-4000-8000-000000020002', 'Konser Prodüksiyon Paketi', 'Açık ya da kapalı alan konser için tam prodüksiyon.', '["Line array ses sistemi", "Hareketli ışık ve truss", "Sahne monitör sistemi", "Kurulum ve söküm ekibi"]'::jsonb, 150000, 210000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081005', '5a4e0000-0000-4000-8000-000000020003', 'Lansman Organizasyonu', 'Ürün ya da mağaza lansmanı için konsept, akış ve sahne.', '["Konsept ve akış", "Sunucu", "Hostes ekibi", "Fotoğraf ve video"]'::jsonb, 140000, 196000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081006', '5a4e0000-0000-4000-8000-000000020003', 'Doğum Günü Partisi', 'Çocuk ya da yetişkin doğum günü için tema, eğlence ve süsleme.', '["Tema ve süsleme", "Palyaço ya da animatör", "Müzik", "Pasta masası kurulumu"]'::jsonb, 35000, 49000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081007', '5a4e0000-0000-4000-8000-000000020004', 'Kongre Operasyon Paketi', 'Çok salonlu kongre için kayıt, salon ve teknik operasyon.', '["Kayıt masası ve hostes", "Salon koordinasyonu", "Ses ve görüntü", "Simültane tercüme altyapısı"]'::jsonb, 220000, 308000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081008', '5a4e0000-0000-4000-8000-000000020004', 'Nişan / Kına Paketi', 'Nişan ya da kına gecesi için program, müzik ve süsleme.', '["Program akışı", "Müzisyen ya da DJ", "Süsleme", "Fotoğrafçı"]'::jsonb, 60000, 84000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081009', '5a4e0000-0000-4000-8000-000000020005', 'Gala Gecesi Müzik Paketi', 'Karşılamada caz trio, yemekte akustik set, gece kapanışında DJ; ses sistemi dahil.', '["Caz trio karşılama (60 dk)", "Akustik yemek seti", "DJ performansı (2 saat)", "Ses sistemi ve teknisyen"]'::jsonb, 85000, 119000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081010', '5a4e0000-0000-4000-8000-000000020005', 'Düğün Müzik Paketi', 'Karşılama, ilk dans ve eğlence bölümü için müzik ve dans gösterisi.', '["Akustik karşılama", "İlk dans eşlik", "DJ performansı", "Dans gösterisi (2 dansçı)"]'::jsonb, 65000, 91000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081011', '5a4e0000-0000-4000-8000-000000020006', 'Ödül Töreni Sunum Paketi', 'Ödül töreni ya da bayi gecesi için sunucu, metin ve prova.', '["Sunum metni", "Prova", "Sunucu (Türkçe / İngilizce)", "Sahne yönetimi"]'::jsonb, 40000, 56000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081012', '5a4e0000-0000-4000-8000-000000020006', 'Panel Moderasyonu', 'Konferans ve paneller için moderatör ve soru akışı.', '["Ön görüşme", "Soru akışı", "Moderatör", "Zaman yönetimi"]'::jsonb, 25000, 35000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081013', '5a4e0000-0000-4000-8000-000000020007', 'DJ + Işık Parti Paketi', 'Parti ve kutlamalar için DJ, dans pisti ışığı ve duman.', '["DJ performansı (4 saat)", "Dans pisti ışığı", "Duman makinesi", "Kurulum"]'::jsonb, 30000, 42000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081014', '5a4e0000-0000-4000-8000-000000020007', 'Kurumsal Kokteyl DJ', 'Kokteyl ve resepsiyonlar için lounge DJ seti.', '["Lounge set (3 saat)", "Kablosuz mikrofon", "Ses sistemi"]'::jsonb, 22000, 31000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081015', '5a4e0000-0000-4000-8000-000000020008', 'Fuar Stand Ekibi', 'Fuar standı için 4 kişilik hostes / model ekibi, 3 gün.', '["4 hostes / model", "Kıyafet koordinasyonu", "Ekip sorumlusu", "Günlük raporlama"]'::jsonb, 48000, 67000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081016', '5a4e0000-0000-4000-8000-000000020008', 'Lansman Model Paketi', 'Ürün lansmanı için model ve sahne gösterimi.', '["3 model", "Prova", "Saç ve makyaj", "Sahne yönetimi"]'::jsonb, 60000, 84000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081017', '5a4e0000-0000-4000-8000-000000020009', 'Etkinlik Günü Koordinasyonu', 'Etkinlik günü akış ve tedarikçi yönetimi.', '["Dakikalık akış", "Tedarikçi takibi", "Saha ekibi (2 kişi)"]'::jsonb, 28000, 39000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081018', '5a4e0000-0000-4000-8000-000000020009', 'Uçtan Uca Planlama', 'Bütçeden etkinlik gününe kadar planlama ve yönetim.', '["Bütçe planı", "Tedarikçi seçimi", "Akış ve prova", "Etkinlik günü yönetimi"]'::jsonb, 75000, 105000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081019', '5a4e0000-0000-4000-8000-000000020010', 'Lansman İçerik Paketi', 'Lansman öncesi ve sırasında influencer içeriği.', '["3 influencer", "Öncesi duyuru", "Canlı paylaşım", "Sonrası rapor"]'::jsonb, 55000, 77000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081020', '5a4e0000-0000-4000-8000-000000020010', 'Etkinlik Canlı Paylaşım', 'Etkinlik günü canlı hikaye ve reels paylaşımı.', '["1 influencer", "Canlı hikaye", "2 reels", "Erişim raporu"]'::jsonb, 30000, 42000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081021', '5a4e0000-0000-4000-8000-000000020011', 'Nikah Töreni Paketi', 'Nikah töreni için süsleme, karşılama ve müzik.', '["Nikah masası ve süsleme", "Karşılama ekibi", "Müzik", "Fotoğrafçı"]'::jsonb, 50000, 70000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081022', '5a4e0000-0000-4000-8000-000000020011', 'Sünnet Düğünü Paketi', 'Sünnet düğünü için eğlence, süsleme ve müzik.', '["Tema süsleme", "İllüzyonist ya da palyaço", "DJ", "Fotoğrafçı"]'::jsonb, 70000, 98000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081023', '5a4e0000-0000-4000-8000-000000020012', 'Açık Hava Sahne Paketi', 'Festival ve açık hava etkinlikleri için sahne, ses ve ışık.', '["Sahne kurulumu", "Line array ses", "Işık ve truss", "Jeneratör"]'::jsonb, 160000, 224000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081024', '5a4e0000-0000-4000-8000-000000020012', 'Toplantı Teknik Paketi', 'Toplantı ve eğitimler için ses ve görüntü.', '["2 mikrofon", "Projeksiyon", "Teknik destek"]'::jsonb, 18000, 25000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081025', '5a4e0000-0000-4000-8000-000000010003', 'Düğün Hikayesi - Tam Gün', 'Hazırlıktan gece kapanışına tam gün çekim, online galeri.', '["Tam gün çekim", "400+ düzenlenmiş fotoğraf", "Online galeri", "İkinci fotoğrafçı"]'::jsonb, 32000, 45000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081026', '5a4e0000-0000-4000-8000-000000010003', 'Kurumsal Etkinlik - Yarım Gün', 'Konferans, lansman ve gala için 4 saatlik çekim.', '["4 saat çekim", "150+ fotoğraf", "48 saatte teslim"]'::jsonb, 14000, 20000, false, true, true, 102, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081027', '5a4e0000-0000-4000-8000-000000010001', 'Nişan Çekimi', 'Nişan ya da söz için 3 saatlik çekim.', '["3 saat çekim", "200+ fotoğraf", "Online galeri"]'::jsonb, 12000, 17000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081028', '5a4e0000-0000-4000-8000-000000010012', 'Düğün DJ Paketi', 'Karşılama, ilk dans ve eğlence bölümü için DJ ve ses sistemi.', '["5 saat DJ", "Ses sistemi", "Dans pisti ışığı"]'::jsonb, 24000, 34000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081029', '5a4e0000-0000-4000-8000-000000010013', 'Kokteyl DJ Seti', 'Lounge ve house ağırlıklı 3 saatlik set.', '["3 saat DJ", "Ses sistemi"]'::jsonb, 15000, 21000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081030', '5a4e0000-0000-4000-8000-000000010021', 'Akustik Karşılama', 'Gitar ve vokal ile 60 dakikalık karşılama.', '["60 dk performans", "Ses sistemi", "Repertuvar görüşmesi"]'::jsonb, 18000, 25000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081031', '5a4e0000-0000-4000-8000-000000010031', 'Düğün Klibi', 'Düğün günü için 3-4 dakikalık klip ve uzun versiyon.', '["Tam gün çekim", "4 dk klip", "20 dk uzun versiyon", "Drone"]'::jsonb, 30000, 42000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081032', '5a4e0000-0000-4000-8000-000000010040', 'Gala Sunuculuğu', 'Gala ve ödül törenleri için sunucu, metin ve prova.', '["Sunum metni", "Prova", "4 saat sunum"]'::jsonb, 20000, 28000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081033', '5a4e0000-0000-4000-8000-000000010056', 'Dans Gösterisi (2 dansçı)', 'Düğün ve kutlamalar için 15 dakikalık gösteri.', '["2 dansçı", "15 dk gösteri", "Kostüm"]'::jsonb, 12000, 17000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081034', '5a4e0000-0000-4000-8000-000000010085', 'Çocuk Partisi Eğlencesi', '2 saatlik palyaço gösterisi, oyunlar ve balon figürleri.', '["2 saat gösteri", "Oyunlar", "Balon figürleri"]'::jsonb, 6000, 8000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081035', '5a4e0000-0000-4000-8000-000000010079', 'Sahne İllüzyon Gösterisi', '30 dakikalık sahne gösterisi.', '["30 dk gösteri", "Asistan", "Işık ve müzik"]'::jsonb, 15000, 21000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081036', '5a4e0000-0000-4000-8000-000000010049', 'Karşılama Hostesi (Günlük)', 'Etkinlik ve fuarlar için günlük hostes hizmeti.', '["8 saat", "Kıyafet", "Kayıt masası deneyimi"]'::jsonb, 4500, 6000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081037', '5a4e0000-0000-4000-8000-000000010062', 'Küçük Salon Ses Paketi', '100 kişiye kadar salon için ses sistemi.', '["2 hoparlör", "2 mikrofon", "Mikser", "Teknisyen"]'::jsonb, 9000, 13000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081038', '5a4e0000-0000-4000-8000-000000010074', 'Gelin Saç ve Makyaj', 'Gelin için prova dahil saç ve makyaj.', '["Prova", "Saç", "Makyaj", "Rötuş"]'::jsonb, 11000, 15000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000081039', '5a4e0000-0000-4000-8000-000000010088', 'Ardıl Tercüme (Yarım Gün)', 'Toplantı ve görüşmeler için 4 saatlik ardıl tercüme.', '["4 saat", "Hazırlık görüşmesi", "Terim listesi"]'::jsonb, 8000, 11000, false, true, true, 101, timestamptz '2026-10-29 10:00+03', timestamptz '2026-10-29 10:00+03')
) AS v(id, profile_id, title, description, includes, pmin, pmax, por, pbas, akt, sira, c, u)
WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v.profile_id::uuid);

-- Hizmet eklentileri: saglayicinin sort_order'a gore ilk hizmeti
INSERT INTO public.service_addons (id, service_id, profile_id, title, description, price, is_active, sort_order, created_at)
SELECT v.id::uuid, s.id, v.sahip::uuid, v.title, v.description, v.price, true, v.sira, timestamptz '2026-10-29 10:00+03'
FROM (VALUES
  ('5a4e0000-0000-4000-8000-000000082001', '5a4e0000-0000-4000-8000-000000010003', 1, 'İkinci fotoğrafçı', 'Tören ve dans aynı anda çekilir.', 4000, 1),
  ('5a4e0000-0000-4000-8000-000000082002', '5a4e0000-0000-4000-8000-000000010003', 1, 'Drone çekimi', 'Açık alanda 15 dakikalık hava çekimi.', 3500, 2),
  ('5a4e0000-0000-4000-8000-000000082003', '5a4e0000-0000-4000-8000-000000010003', 1, 'Baskılı albüm', '30x30, 40 sayfa.', 2500, 3),
  ('5a4e0000-0000-4000-8000-000000082004', '5a4e0000-0000-4000-8000-000000010001', 1, 'Ekstra saat', 'Saat başına.', 2000, 4),
  ('5a4e0000-0000-4000-8000-000000082005', '5a4e0000-0000-4000-8000-000000010012', 1, 'Ekstra saat', 'Saat başına DJ performansı.', 3000, 5),
  ('5a4e0000-0000-4000-8000-000000082006', '5a4e0000-0000-4000-8000-000000010012', 1, 'Duman makinesi', 'İlk dans için.', 1500, 6),
  ('5a4e0000-0000-4000-8000-000000082007', '5a4e0000-0000-4000-8000-000000010021', 1, 'Ek müzisyen', 'Keman ya da piyano.', 6000, 7),
  ('5a4e0000-0000-4000-8000-000000082008', '5a4e0000-0000-4000-8000-000000010031', 1, 'Kısa film kurgusu', 'Sosyal medya için 60 sn.', 5000, 8),
  ('5a4e0000-0000-4000-8000-000000082009', '5a4e0000-0000-4000-8000-000000010040', 1, 'İngilizce sunum', 'Tüm akış iki dilde.', 4000, 9),
  ('5a4e0000-0000-4000-8000-000000082010', '5a4e0000-0000-4000-8000-000000020005', 1, 'Ek müzisyen', 'Saksofon ya da keman.', 6500, 10),
  ('5a4e0000-0000-4000-8000-000000082011', '5a4e0000-0000-4000-8000-000000020005', 1, 'Ses sistemi (300 kişi)', 'Teknisyen dahil.', 9000, 11),
  ('5a4e0000-0000-4000-8000-000000082012', '5a4e0000-0000-4000-8000-000000020007', 1, 'Işık şovu', 'Hareketli ışık + lazer.', 7000, 12)
) AS v(id, sahip, hizmet_no, title, description, price, sira)
JOIN LATERAL (SELECT x.id FROM public.services x WHERE x.provider_id = v.sahip::uuid AND x.is_active
              ORDER BY x.sort_order, x.created_at, x.id OFFSET (v.hizmet_no - 1) LIMIT 1) s ON true;

-- Ilanlar (yayinda; tarih / son basvuru Kasim 2026 sonrasi)
INSERT INTO public.listings (id, creator_id, created_by, category_id, title, description, requirements, event_date, event_type, location, city_id,
                             guest_count, budget_min, budget_max, status, expires_at, application_deadline, is_urgent, urgent_until, notified_at, created_at, updated_at)
SELECT v.id::uuid, v.sahip::uuid, v.sahip::uuid, sc.id, v.baslik, v.aciklama, v.gerek, v.tarih::date, v.tur, v.il, ci.id,
       v.kisi, v.bmin, v.bmax, 'published'::public.listing_status, (v.tarih::date + 1)::timestamptz, (v.son::date + time '23:59')::timestamptz AT TIME ZONE 'Europe/Istanbul',
       v.acil, CASE WHEN v.acil THEN (v.son::date + time '23:59') AT TIME ZONE 'Europe/Istanbul' END, now(), v.olusma, v.olusma
FROM (VALUES
  ('5a4e0000-0000-4000-8000-000000080001', '5a4e0000-0000-4000-8000-000000030003', 'sunucu', 'corporate', 'Ankara', '2027-01-21', 20000, 35000, 250, 'Bayi toplantısı için sunucu', 'Yıllık bayi toplantımız için protokol deneyimli bir sunucu arıyoruz. Akış 4 saat; ödül bölümü ve iki panel var.', 'Kurumsal etkinlik deneyimi, protokol bilgisi', '2026-12-20', false, timestamptz '2026-10-30 11:00+03'),
  ('5a4e0000-0000-4000-8000-000000080002', '5a4e0000-0000-4000-8000-000000030004', 'ses-isik', 'launch', 'İzmir', '2027-02-18', 80000, 120000, 400, 'Yeni model lansmanı için ses-ışık ekibi', 'Showroom önünde açık alanda lansman yapacağız. Sahne, ses, ışık ve LED ekran dahil tek ekip bekliyoruz.', 'Açık alan deneyimi, jeneratör', '2027-01-15', false, timestamptz '2026-10-31 12:00+03'),
  ('5a4e0000-0000-4000-8000-000000080003', '5a4e0000-0000-4000-8000-000000030006', 'muzisyen', 'gala', 'Antalya', '2026-12-19', 40000, 70000, 300, 'Bayi gala gecesi için canlı müzik', 'Gala gecemizde karşılama ve yemek bölümü için caz ya da akustik grup arıyoruz; gece sonunda DJ de olabilir.', 'Gala repertuvarı', '2026-11-30', true, timestamptz '2026-10-29 13:00+03'),
  ('5a4e0000-0000-4000-8000-000000080004', '5a4e0000-0000-4000-8000-000000030007', 'fotografci', 'graduation', 'Ankara', '2027-06-25', 15000, 25000, 600, 'Mezuniyet töreni fotoğrafçısı', 'Açık havada yapılacak mezuniyet töreni için iki fotoğrafçılık ekip arıyoruz. Teslim online galeri.', 'Kalabalık tören deneyimi', '2027-04-30', false, timestamptz '2026-10-30 14:00+03'),
  ('5a4e0000-0000-4000-8000-000000080005', '5a4e0000-0000-4000-8000-000000030001', 'dj', 'corporate', 'İstanbul', '2026-12-26', 15000, 30000, 180, 'Yıl sonu partisi için DJ', 'Ofis yıl sonu partimiz için 4 saatlik DJ performansı istiyoruz; ses ve ışık DJ tarafından gelsin.', NULL, '2026-12-10', true, timestamptz '2026-10-31 15:00+03'),
  ('5a4e0000-0000-4000-8000-000000080006', '5a4e0000-0000-4000-8000-000000030005', 'tercuman', 'conference', 'İstanbul', '2027-03-10', 30000, 45000, 200, 'Konferans için simültane tercüman', 'Finans konferansımız için iki gün, Türkçe-İngilizce simültane tercüme. Kabin ve ekipman bizde.', 'Finans terminolojisi', '2027-02-01', false, timestamptz '2026-10-29 16:00+03'),
  ('5a4e0000-0000-4000-8000-000000080007', '5a4e0000-0000-4000-8000-000000040001', 'videograf', 'wedding', 'İstanbul', '2027-05-15', 25000, 40000, 220, 'Düğünümüz için video çekimi', 'Mayıs ayında kır düğünümüz var. Hazırlıktan gece sonuna kadar video ve kısa bir klip istiyoruz.', NULL, '2027-03-15', false, timestamptz '2026-10-30 17:00+03'),
  ('5a4e0000-0000-4000-8000-000000080008', '5a4e0000-0000-4000-8000-000000040002', 'palyaco', 'birthday', 'İzmir', '2026-12-12', 4000, 8000, 30, 'Kızımın 7. yaş günü için palyaço', 'Evde 25-30 çocuklu bir doğum günü. 2 saatlik gösteri, oyun ve balon figürleri bekliyoruz.', NULL, '2026-12-05', true, timestamptz '2026-10-31 10:00+03'),
  ('5a4e0000-0000-4000-8000-000000080009', '5a4e0000-0000-4000-8000-000000040003', 'dansci', 'henna', 'Bursa', '2027-04-10', 12000, 20000, 150, 'Kına gecesi için dansçı grubu', 'Kına gecemizde 15-20 dakikalık geleneksel dans gösterisi ve misafirleri piste kaldıracak bir ekip arıyoruz.', NULL, '2027-03-01', false, timestamptz '2026-10-29 11:00+03'),
  ('5a4e0000-0000-4000-8000-000000080010', '5a4e0000-0000-4000-8000-000000040005', 'illuzyonist', 'circumcision', 'Konya', '2027-06-05', 8000, 15000, 120, 'Sünnet düğünü için illüzyonist', 'Oğlumun sünnet düğünü için çocuklara yönelik 30 dakikalık bir gösteri istiyoruz.', NULL, '2027-04-15', false, timestamptz '2026-10-30 12:00+03'),
  ('5a4e0000-0000-4000-8000-000000080011', '5a4e0000-0000-4000-8000-000000030008', 'hostes', 'launch', 'Muğla', '2027-04-24', 20000, 35000, 250, 'Otel açılışı için hostes ekibi', 'Bodrum’daki yeni otelimizin açılışı için 4 kişilik karşılama ve kayıt ekibi arıyoruz.', 'İngilizce bilen en az 2 kişi', '2027-03-20', false, timestamptz '2026-10-31 13:00+03'),
  ('5a4e0000-0000-4000-8000-000000080012', '5a4e0000-0000-4000-8000-000000040012', 'muzisyen', 'engagement', 'Eskişehir', '2027-01-30', 10000, 18000, 80, 'Nişan töreni için akustik müzisyen', 'Restoranda yapılacak nişanımız için gitar ve vokal ile 2 saatlik akustik müzik istiyoruz.', NULL, '2027-01-10', false, timestamptz '2026-10-29 14:00+03')
) AS v(id, sahip, kat, tur, il, tarih, bmin, bmax, kisi, baslik, aciklama, gerek, son, acil, olusma)
JOIN public.service_categories sc ON sc.slug = v.kat
JOIN public.turkish_cities ci ON ci.name = v.il
WHERE EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v.sahip::uuid);

-- Basvurular (basvuran yayinda saglayici; ilan sahibine bildirim tetikleyicisi yazar)
INSERT INTO public.applications (id, listing_id, applicant_id, cover_message, proposed_amount, status, created_at, updated_at, responded_at)
SELECT v.id::uuid, v.ilan::uuid, v.basvuran::uuid, v.mesaj, v.teklif, v.durum::public.application_status, v.zaman, v.zaman,
       CASE WHEN v.durum <> 'pending' THEN v.zaman + interval '1 day' END
FROM (VALUES
  ('5a4e0000-0000-4000-8000-000000083001', '5a4e0000-0000-4000-8000-000000080001', '5a4e0000-0000-4000-8000-000000010040', 'Merhaba, 10 yıldır kurumsal etkinlik ve gala sunuculuğu yapıyorum; protokol ve ödül törenlerine hakimim.', 28000, 'shortlisted', timestamptz '2026-11-02 11:30+03'),
  ('5a4e0000-0000-4000-8000-000000083002', '5a4e0000-0000-4000-8000-000000080001', '5a4e0000-0000-4000-8000-000000010038', 'Ankara merkezliyim, bayi toplantıları ve paneller için akışı birlikte hazırlayabiliriz.', 24000, 'pending', timestamptz '2026-11-03 12:30+03'),
  ('5a4e0000-0000-4000-8000-000000083003', '5a4e0000-0000-4000-8000-000000080001', '5a4e0000-0000-4000-8000-000000020006', 'Artı Bir Ajans olarak sunucu ve moderatör ekibimizle bayi toplantınız için teklif vermek isteriz.', 32000, 'pending', timestamptz '2026-11-04 13:30+03'),
  ('5a4e0000-0000-4000-8000-000000083004', '5a4e0000-0000-4000-8000-000000080002', '5a4e0000-0000-4000-8000-000000020012', 'Zirve Teknik olarak açık alan lansmanları için sahne, ses, ışık ve LED ekranı tek ekip sağlıyoruz.', 110000, 'pending', timestamptz '2026-11-01 14:30+03'),
  ('5a4e0000-0000-4000-8000-000000083005', '5a4e0000-0000-4000-8000-000000080002', '5a4e0000-0000-4000-8000-000000020002', 'Lumen Prodüksiyon olarak İzmir’de benzer üç lansman yaptık; teknik çizim ve keşif için görüşelim.', 95000, 'shortlisted', timestamptz '2026-11-02 15:30+03'),
  ('5a4e0000-0000-4000-8000-000000083006', '5a4e0000-0000-4000-8000-000000080003', '5a4e0000-0000-4000-8000-000000020005', 'Mavi Sahne olarak caz trio karşılama, akustik yemek seti ve DJ kapanışla gala paketimizi uyarlayabiliriz.', 65000, 'pending', timestamptz '2026-11-03 16:30+03'),
  ('5a4e0000-0000-4000-8000-000000083007', '5a4e0000-0000-4000-8000-000000080003', '5a4e0000-0000-4000-8000-000000010024', 'Antalya merkezliyim, gala ve kokteyller için akustik repertuvarım ve ses sistemim hazır.', 42000, 'pending', timestamptz '2026-11-04 17:30+03'),
  ('5a4e0000-0000-4000-8000-000000083008', '5a4e0000-0000-4000-8000-000000080004', '5a4e0000-0000-4000-8000-000000010008', 'Ankara’dayım, kalabalık tören çekimlerinde ikinci fotoğrafçıyla çalışıyorum; teslim bir hafta.', 18000, 'pending', timestamptz '2026-11-01 18:30+03'),
  ('5a4e0000-0000-4000-8000-000000083009', '5a4e0000-0000-4000-8000-000000080005', '5a4e0000-0000-4000-8000-000000010012', 'Ofis partileri için house ve pop ağırlıklı set hazırlarım; ses ve ışık benden.', 22000, 'shortlisted', timestamptz '2026-11-02 10:30+03'),
  ('5a4e0000-0000-4000-8000-000000083010', '5a4e0000-0000-4000-8000-000000080005', '5a4e0000-0000-4000-8000-000000020007', 'Ritim Müzik Ajansı olarak DJ + ışık parti paketimizle 4 saatlik performans sunabiliriz.', 28000, 'pending', timestamptz '2026-11-03 11:30+03'),
  ('5a4e0000-0000-4000-8000-000000083011', '5a4e0000-0000-4000-8000-000000080006', '5a4e0000-0000-4000-8000-000000010088', 'Finans konferanslarında simültane deneyimim var; ikinci tercüman arkadaşımla birlikte çalışırız.', 40000, 'pending', timestamptz '2026-11-04 12:30+03'),
  ('5a4e0000-0000-4000-8000-000000083012', '5a4e0000-0000-4000-8000-000000080007', '5a4e0000-0000-4000-8000-000000010031', 'Kır düğünlerinde doğal ışıkla çalışıyorum; uzun versiyon ve 4 dakikalık klip teslim ederim.', 32000, 'pending', timestamptz '2026-11-01 13:30+03'),
  ('5a4e0000-0000-4000-8000-000000083013', '5a4e0000-0000-4000-8000-000000080007', '5a4e0000-0000-4000-8000-000000010033', 'İstanbul’dayım, düğün filmi ve drone çekimini aynı ekiple yapıyoruz.', 36000, 'pending', timestamptz '2026-11-02 14:30+03'),
  ('5a4e0000-0000-4000-8000-000000083014', '5a4e0000-0000-4000-8000-000000080008', '5a4e0000-0000-4000-8000-000000010084', 'Çocuk partileri için 2 saatlik gösteri, oyunlar ve balon figürleriyle gelirim.', 6000, 'pending', timestamptz '2026-11-03 15:30+03'),
  ('5a4e0000-0000-4000-8000-000000083015', '5a4e0000-0000-4000-8000-000000080009', '5a4e0000-0000-4000-8000-000000010055', 'İzmir merkezliyim ama Bursa’ya gelebilirim; kına için geleneksel gösteri hazırlarız.', 16000, 'pending', timestamptz '2026-11-04 16:30+03'),
  ('5a4e0000-0000-4000-8000-000000083016', '5a4e0000-0000-4000-8000-000000080010', '5a4e0000-0000-4000-8000-000000010082', 'Çocuklara yönelik interaktif illüzyon gösterim var, 30 dakikalık akışı birlikte planlarız.', 12000, 'pending', timestamptz '2026-11-01 17:30+03'),
  ('5a4e0000-0000-4000-8000-000000083017', '5a4e0000-0000-4000-8000-000000080011', '5a4e0000-0000-4000-8000-000000020008', 'Vizyon Cast olarak İngilizce bilen hostes ekibimizle açılışınızda kayıt ve karşılamayı üstleniriz.', 30000, 'pending', timestamptz '2026-11-02 18:30+03'),
  ('5a4e0000-0000-4000-8000-000000083018', '5a4e0000-0000-4000-8000-000000080012', '5a4e0000-0000-4000-8000-000000010020', 'Eskişehir’e gelebilirim; gitar ve vokal ile nişanlar için romantik bir repertuvarım var.', 14000, 'pending', timestamptz '2026-11-03 10:30+03')
) AS v(id, ilan, basvuran, mesaj, teklif, durum, zaman)
WHERE EXISTS (SELECT 1 FROM public.listings l WHERE l.id = v.ilan::uuid)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v.basvuran::uuid AND p.is_published);

-- Ozet (SQL Editor tabloda gosterir)
SELECT 'ilan' AS tur, count(*) FROM public.listings WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%'
UNION ALL SELECT 'basvuru', count(*) FROM public.applications WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%'
UNION ALL SELECT 'paket', count(*) FROM public.service_packages WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%'
UNION ALL SELECT 'eklenti', count(*) FROM public.service_addons WHERE id::text LIKE '5a4e0000-0000-4000-8000-00000008%';

COMMIT;
