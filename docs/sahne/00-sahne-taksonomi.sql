-- SAHNE 00 — taksonomi guvencesi: 23 kategori eksikse ekler (rolu trg_faz3 tetikleyicisi turetir). Dalda 0 satir beklenir.
-- Adlar yalniz EKSIK kategori icin kullanilir; mevcut satirlara dokunulmaz.
INSERT INTO public.service_categories (slug, name_tr, emoji, sort_order, is_active, layer)
SELECT v.slug, v.ad, v.emoji, v.sira, true, 'legacy_role' FROM (VALUES
('fotografci', 'Fotoğrafçı', '📷', 0),
('dj', 'DJ', '🎧', 10),
('muzisyen', 'Müzisyen', '🎸', 20),
('videograf', 'Videograf', '🎬', 30),
('sunucu', 'Sunucu', '🎤', 40),
('organizasyon', 'Organizasyon', '🎪', 50),
('hostes', 'Hostes', '🙋', 60),
('dansci', 'Dansçı', '💃', 70),
('ses-isik', 'Ses & Işık', '🔊', 80),
('model', 'Model', '👠', 90),
('oyuncu', 'Oyuncu', '🎭', 100),
('sac-makyaj-styling', 'Saç & Makyaj & Styling', '💄', 110),
('illuzyonist', 'İllüzyonist', '🎩', 120),
('palyaco', 'Palyaço', '🤡', 130),
('tercuman', 'Tercüman', '🗣️', 140),
('stand-up-komedyen', 'Stand-up Komedyen', '😂', 150),
('karikaturist', 'Karikatürist', '✏️', 160),
('akrobat', 'Akrobat', '🤸', 170),
('etkinlik-koordinatoru', 'Etkinlik Koordinatörü', '📋', 180),
('konusmaci', 'Konuşmacı', '🎓', 190),
('canli-yayin', 'Canlı Yayın', '📡', 200),
('influencer', 'Influencer', '📱', 210),
('drone-pilotu', 'Drone Pilotu', '🚁', 220)
) AS v(slug, ad, emoji, sira)
WHERE NOT EXISTS (SELECT 1 FROM public.service_categories c WHERE c.slug = v.slug);
SELECT (SELECT count(*) FROM public.service_categories WHERE slug IN ('fotografci','dj','muzisyen','videograf','sunucu','organizasyon','hostes','dansci','ses-isik','model','oyuncu','sac-makyaj-styling','illuzyonist','palyaco','tercuman','stand-up-komedyen','karikaturist','akrobat','etkinlik-koordinatoru','konusmaci','canli-yayin','influencer','drone-pilotu')) AS kategori,
       (SELECT count(*) FROM public.service_roles WHERE slug IN ('fotografci','dj','muzisyen','videograf','sunucu','organizasyon','hostes','dansci','ses-isik','model','oyuncu','sac-makyaj-styling','illuzyonist','palyaco','tercuman','stand-up-komedyen','karikaturist','akrobat','etkinlik-koordinatoru','konusmaci','canli-yayin','influencer','drone-pilotu')) AS rol;
