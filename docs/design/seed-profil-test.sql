-- PROFİL REDESIGN — Test verisi (Test Pro2, DJ preset). ADIM 2 doğrulaması için.
-- MANUEL çalıştırılır (Dashboard SQL Editor). Idempotent: tekrar çalıştırılabilir
-- (category_attributes overwrite; deneyimler DELETE + INSERT). Yalnız TEST verisi.
--
-- Güvenlik: profil id'sini isimden bulur; TAM 1 satır eşleşmezse exception fırlatır.
DO $$
DECLARE
  v_id uuid;
  v_count int;
  v_cat_id bigint;
BEGIN
  SELECT count(*) INTO v_count FROM public.profiles WHERE full_name = 'Test Pro2';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Tam 1 profil bekleniyordu (full_name=%), % bulundu', 'Test Pro2', v_count;
  END IF;
  SELECT id INTO v_id FROM public.profiles WHERE full_name = 'Test Pro2';

  -- ---- Kategoriyi DJ'ye çek (slug ile; bulunamazsa exception) ----
  -- DJ preset'inin quick + modül + gruplarının TAM render'ını görebilmek için.
  SELECT id INTO v_cat_id FROM public.service_categories WHERE slug = 'dj';
  IF v_cat_id IS NULL THEN
    RAISE EXCEPTION 'service_categories slug=% bulunamadı', 'dj';
  END IF;
  UPDATE public.profiles SET primary_category_id = v_cat_id WHERE id = v_id;

  -- ---- category_attributes (DJ preset) ----
  UPDATE public.profiles
  SET category_attributes = jsonb_build_object(
    'service_region', 'Türkiye geneli',
    'experience_label', '9 yıl · 400+ etkinlik',
    'logistics', jsonb_build_object('ehliyet', true, 'sehir_disi', true, 'kendi_ekipmani', true),
    'skills', jsonb_build_array(
      jsonb_build_object('name', 'Beatmatching', 'level', 3),
      jsonb_build_object('name', 'Canlı remix', 'level', 2),
      jsonb_build_object('name', 'Işık senkronu', 'level', 2),
      jsonb_build_object('name', 'MC / mikrofon', 'level', 1)
    ),
    'section_taglines', jsonb_build_object(
      'hakkimda', 'Kalabalığı okuyan, geceyi kuran bir set anlayışı.'
    ),
    'quick', jsonb_build_object(
      'turler', 'House · Techno · Deep House',
      'deneyim', '9 yıl',
      'set_suresi', '2 – 4 saat',
      'ekipman_durumu', 'Kendi ekipmanı'
    ),
    'modules', jsonb_build_object(
      'repertuar', jsonb_build_object(
        'genres', jsonb_build_array('House', 'Techno', 'Deep House', 'Melodic'),
        'notes', 'Açılıştan peak-time''a kesintisiz geçiş; mekana göre özelleştirilmiş set.'
      ),
      'ekipman', jsonb_build_object(
        'items', jsonb_build_array('Pioneer CDJ-3000 x2', 'DJM-900NXS2 mikser', 'Kendi monitör kulaklık'),
        'venue_requirements', 'Mekânda 2 kanal DI ve topraklı priz yeterli; kalan ekipman bende.'
      ),
      'performans', jsonb_build_object(
        'details', jsonb_build_object('Set süresi', '2 – 4 saat', 'Tarz', 'Açılış → peak-time', 'Ekip', 'Solo'),
        'what_to_expect', 'Mekânın enerjisine göre kurgulanan, akışı bozmayan bir gece.',
        'setup_logistics', 'Kurulum ~45 dk; ses kontrolü için etkinlikten 1 saat önce mekanda olurum.'
      ),
      'sosyal_erisim', jsonb_build_object(
        'platforms', jsonb_build_array(
          jsonb_build_object('platform', 'Instagram', 'followers_range', '10B – 50B'),
          jsonb_build_object('platform', 'SoundCloud', 'followers_range', '1B – 5B')
        )
      )
    )
  )
  WHERE id = v_id;

  -- ---- profile_experiences (idempotent: önce temizle) ----
  DELETE FROM public.profile_experiences WHERE profile_id = v_id;

  INSERT INTO public.profile_experiences
    (profile_id, kind, group_key, title, subtitle, organization, location, period_label, description, sort_order)
  VALUES
    -- work · kulup_mekan
    (v_id, 'work', 'kulup_mekan', 'Rezidan DJ', 'Haftalık set', 'Klein Garten', 'İstanbul', '2022 – halen',
      'Cuma geceleri rezidan set; mekânın müzik kimliğini kurdum, düzenli 300+ kişilik doluluk.', 0),
    (v_id, 'work', 'kulup_mekan', 'Konuk DJ', 'Aylık program', 'Kloster', 'İstanbul', '2020 – 2022', NULL, 1),
    -- work · festival
    (v_id, 'work', 'festival', 'Ana sahne', 'Elektronik gece', 'Zorlu PSM', 'İstanbul', 'Temmuz 2024', NULL, 0),
    (v_id, 'work', 'festival', 'Açılış seti', 'Gündüz sahnesi', 'Chill-Out Festival', 'İzmir', 'Ağustos 2023',
      '8.000 kişilik açık hava sahnesinde açılış; günün tonunu belirleyen 90 dakikalık set.', 1),
    -- work · kurumsal_ozel
    (v_id, 'work', 'kurumsal_ozel', 'Lansman DJ', 'Ürün lansmanı', 'Global marka', 'İstanbul', 'Mayıs 2026', NULL, 0),
    (v_id, 'work', 'kurumsal_ozel', 'Özel davet', 'After-party', 'VIP düğün', 'Bodrum', 'Eylül 2025', NULL, 1),
    -- education
    (v_id, 'education', NULL, 'Ses Mühendisliği Sertifikası', NULL, 'SAE Institute', 'İstanbul', '2019', NULL, 0),
    (v_id, 'education', NULL, 'Elektronik Müzik Prodüksiyon', 'Online program', 'Point Blank', NULL, '2020', NULL, 1),
    -- award
    (v_id, 'award', NULL, 'Yılın Çıkış DJ''i', NULL, 'Local Beats Awards', NULL, '2023', NULL, 0);

  RAISE NOTICE 'Test Pro2 (%): category_attributes + 9 profile_experiences yazıldı.', v_id;
END $$;

-- Doğrulama (uygulama sonrası):
-- select kind, count(*) from public.profile_experiences pe join public.profiles p on p.id=pe.profile_id where p.full_name='Test Pro2' group by kind;
-- select category_attributes from public.profiles where full_name='Test Pro2';
