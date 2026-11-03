# -*- coding: utf-8 -*-
# Sahne sentetik dunya — veri havuzlari (adlar, sehirler, kategori metinleri, sablonlar).
# Bkz. docs/envanter/39-sahne-sentetik-dunya.md. Uretec: scripts/sahne/uret.py
# Metinler kullaniciya gorunen VERIDIR (Turkce karakter serbest); kod yorumlari ASCII.

KADIN_ADLAR = [
    "Elif", "Zeynep", "Ayşe", "Defne", "Selin", "Ece", "Melis", "Nazlı", "Merve", "Büşra", "İrem", "Deniz", "Gizem",
    "Beren", "Ceren", "Damla", "Esra", "Gamze", "Hande", "İpek", "Kübra", "Leyla", "Naz", "Pınar", "Seda", "Sıla",
    "Tuğçe", "Yasemin", "Aslı", "Burcu", "Cansu", "Dilara", "Eda", "Fulya", "Gül", "Hazal", "Melike", "Nur", "Özge",
    "Sevgi", "Şebnem", "Tuba", "Yağmur", "Zehra", "Bahar", "Cemre", "Derya", "Ebru", "Feride", "Lale",
]
ERKEK_ADLAR = [
    "Mert", "Can", "Emre", "Burak", "Kerem", "Arda", "Eren", "Berk", "Cem", "Deniz", "Efe", "Furkan", "Hakan", "Kaan",
    "Mehmet", "Murat", "Onur", "Ozan", "Serkan", "Tolga", "Umut", "Yiğit", "Barış", "Caner", "Doruk", "Ege", "Gökhan",
    "Halil", "İlker", "Koray", "Levent", "Melih", "Oğuz", "Selim", "Taner", "Uğur", "Volkan", "Yusuf", "Alp", "Batuhan",
    "Çağrı", "Enes", "Fatih", "Görkem", "Kemal", "Orhan", "Sinan", "Tarık", "Utku", "Yavuz",
]
SOYADLAR = [
    "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Aydın", "Öztürk", "Arslan", "Doğan", "Kılıç", "Aslan",
    "Çetin", "Kara", "Koç", "Kurt", "Özdemir", "Şimşek", "Polat", "Korkmaz", "Taş", "Güneş", "Erdoğan", "Bulut", "Acar",
    "Keskin", "Aksoy", "Ateş", "Ünal", "Turan", "Sezer", "Yalçın", "Bozkurt", "Tekin", "Uysal", "Karaca", "Duman",
    "Avcı", "Özkan", "Kaplan", "Çakır", "Güler", "Erdem", "Sarı", "Toprak", "Aktaş", "Öz", "Soylu", "Erol", "Başak",
]

# (ad, plaka) — ilk 10 agirlikli Sahne sehirleri; tum iller asagida
SAHNE_SEHIRLER = [
    ("İstanbul", 34, 40), ("Ankara", 6, 14), ("İzmir", 35, 12), ("Antalya", 7, 8), ("Bursa", 16, 6),
    ("Muğla", 48, 5), ("Adana", 1, 4), ("Eskişehir", 26, 4), ("Gaziantep", 27, 4), ("Trabzon", 61, 3),
]
TUM_ILLER = [
    (1, "Adana"), (2, "Adıyaman"), (3, "Afyonkarahisar"), (4, "Ağrı"), (5, "Amasya"), (6, "Ankara"), (7, "Antalya"),
    (8, "Artvin"), (9, "Aydın"), (10, "Balıkesir"), (11, "Bilecik"), (12, "Bingöl"), (13, "Bitlis"), (14, "Bolu"),
    (15, "Burdur"), (16, "Bursa"), (17, "Çanakkale"), (18, "Çankırı"), (19, "Çorum"), (20, "Denizli"), (21, "Diyarbakır"),
    (22, "Edirne"), (23, "Elazığ"), (24, "Erzincan"), (25, "Erzurum"), (26, "Eskişehir"), (27, "Gaziantep"), (28, "Giresun"),
    (29, "Gümüşhane"), (30, "Hakkari"), (31, "Hatay"), (32, "Isparta"), (33, "Mersin"), (34, "İstanbul"), (35, "İzmir"),
    (36, "Kars"), (37, "Kastamonu"), (38, "Kayseri"), (39, "Kırklareli"), (40, "Kırşehir"), (41, "Kocaeli"), (42, "Konya"),
    (43, "Kütahya"), (44, "Malatya"), (45, "Manisa"), (46, "Kahramanmaraş"), (47, "Mardin"), (48, "Muğla"), (49, "Muş"),
    (50, "Nevşehir"), (51, "Niğde"), (52, "Ordu"), (53, "Rize"), (54, "Sakarya"), (55, "Samsun"), (56, "Siirt"), (57, "Sinop"),
    (58, "Sivas"), (59, "Tekirdağ"), (60, "Tokat"), (61, "Trabzon"), (62, "Tunceli"), (63, "Şanlıurfa"), (64, "Uşak"),
    (65, "Van"), (66, "Yozgat"), (67, "Zonguldak"), (68, "Aksaray"), (69, "Bayburt"), (70, "Karaman"), (71, "Kırıkkale"),
    (72, "Batman"), (73, "Şırnak"), (74, "Bartın"), (75, "Ardahan"), (76, "Iğdır"), (77, "Yalova"), (78, "Karabük"),
    (79, "Kilis"), (80, "Osmaniye"), (81, "Düzce"),
]
ILCELER = {
    "İstanbul": ["Kadıköy", "Beşiktaş", "Şişli", "Beyoğlu", "Üsküdar", "Bakırköy", "Ataşehir", "Sarıyer", "Maltepe"],
    "Ankara": ["Çankaya", "Keçiören", "Yenimahalle", "Etimesgut"], "İzmir": ["Konak", "Karşıyaka", "Bornova", "Çeşme"],
    "Antalya": ["Muratpaşa", "Konyaaltı", "Lara", "Belek"], "Bursa": ["Nilüfer", "Osmangazi", "Mudanya"],
    "Muğla": ["Bodrum", "Marmaris", "Fethiye"], "Adana": ["Seyhan", "Çukurova"], "Eskişehir": ["Tepebaşı", "Odunpazarı"],
    "Gaziantep": ["Şahinbey", "Şehitkamil"], "Trabzon": ["Ortahisar", "Akçaabat"],
}

# Etkinlik turleri (event_types.key -> ad)
ETKINLIK_TURLERI = {
    "wedding": "Düğün", "engagement": "Nişan", "henna": "Kına gecesi", "birthday": "Doğum günü", "baby_shower": "Baby shower",
    "graduation": "Mezuniyet", "circumcision": "Sünnet", "corporate": "Kurumsal", "launch": "Lansman", "fair": "Fuar",
    "conference": "Konferans", "congress": "Kongre", "gala": "Gala", "concert": "Konser", "other": "Diğer",
}

# Kategori meta: ad (harness taksonomisi icin), cinsiyet karisimi (kadin orani), fiyat araligi (TL; min-min, max-max), birim,
# etkinlik turu agirliklari, arama terimleri (Commons), kullanilan diller
KATEGORILER = {
    "fotografci": dict(ad="Fotoğrafçı", emoji="📷", kadin=0.45, fiyat=(12000, 65000), birim="total", sayi=10,
        turler={"wedding": 5, "engagement": 3, "henna": 2, "corporate": 3, "launch": 2, "birthday": 2, "baby_shower": 1},
        arama=["wedding photography", "event photographer camera", "wedding couple photo shoot", "corporate event photography"]),
    "dj": dict(ad="DJ", emoji="🎧", kadin=0.25, fiyat=(8000, 45000), birim="total", sayi=9,
        turler={"wedding": 5, "engagement": 2, "birthday": 2, "corporate": 3, "launch": 2, "gala": 1, "henna": 1},
        arama=["DJ performing party", "DJ mixing turntables", "wedding DJ dance floor", "club DJ booth"]),
    "muzisyen": dict(ad="Müzisyen", emoji="🎸", kadin=0.4, fiyat=(10000, 70000), birim="total", sayi=8,
        turler={"wedding": 5, "engagement": 2, "corporate": 3, "gala": 2, "concert": 2, "birthday": 1},
        arama=["live band wedding", "acoustic guitar performance", "jazz trio concert", "wedding singer band"]),
    "videograf": dict(ad="Videograf", emoji="🎬", kadin=0.3, fiyat=(15000, 80000), birim="total", sayi=7,
        turler={"wedding": 5, "corporate": 3, "launch": 3, "engagement": 2, "conference": 1, "concert": 1},
        arama=["videographer filming wedding", "video camera operator event", "cinema camera gimbal", "film crew shooting"]),
    "sunucu": dict(ad="Sunucu", emoji="🎤", kadin=0.5, fiyat=(10000, 50000), birim="total", sayi=6,
        turler={"corporate": 5, "gala": 3, "launch": 3, "conference": 2, "wedding": 2, "fair": 1},
        arama=["master of ceremonies stage microphone", "event host speaking stage", "presenter on stage conference", "award ceremony host"]),
    "organizasyon": dict(ad="Organizasyon", emoji="🎪", kadin=0.6, fiyat=(40000, 350000), birim="total", sayi=6,
        turler={"wedding": 5, "engagement": 2, "henna": 2, "corporate": 3, "launch": 2, "birthday": 2, "baby_shower": 1},
        arama=["wedding reception decoration tables", "event decoration flowers venue", "banquet hall setup", "wedding venue decor"]),
    "hostes": dict(ad="Hostes", emoji="🙋", kadin=0.7, fiyat=(2500, 6000), birim="full_day", sayi=6,
        turler={"fair": 4, "launch": 3, "congress": 3, "conference": 2, "corporate": 3, "gala": 1},
        arama=["trade fair booth hostess", "exhibition stand staff", "conference registration desk", "trade show booth"]),
    "dansci": dict(ad="Dansçı", emoji="💃", kadin=0.6, fiyat=(8000, 45000), birim="total", sayi=6,
        turler={"wedding": 4, "henna": 4, "corporate": 2, "launch": 2, "gala": 2, "concert": 1},
        arama=["dance performance stage", "folk dance group performance", "latin dance show", "dancers performing event"]),
    "ses-isik": dict(ad="Ses & Işık", emoji="🔊", kadin=0.1, fiyat=(15000, 120000), birim="total", sayi=5,
        turler={"concert": 4, "wedding": 3, "corporate": 3, "conference": 2, "launch": 2, "fair": 1},
        arama=["stage lighting concert", "sound system speakers stage", "lighting rig event", "mixing console live sound"]),
    "model": dict(ad="Model", emoji="👠", kadin=0.65, fiyat=(5000, 25000), birim="full_day", sayi=5,
        turler={"fair": 3, "launch": 4, "corporate": 2, "other": 2},
        arama=["fashion runway show", "fashion model catwalk", "fashion photo shoot studio", "runway fashion week"]),
    "oyuncu": dict(ad="Oyuncu", emoji="🎭", kadin=0.5, fiyat=(6000, 35000), birim="full_day", sayi=5,
        turler={"corporate": 3, "launch": 3, "other": 3, "gala": 1},
        arama=["theatre actors stage play", "film set actors shooting", "theater performance stage", "drama stage performance"]),
    "sac-makyaj-styling": dict(ad="Saç & Makyaj & Styling", emoji="💄", kadin=0.9, fiyat=(4000, 25000), birim="total", sayi=5,
        turler={"wedding": 6, "engagement": 3, "henna": 3, "corporate": 1, "other": 1},
        arama=["bridal makeup artist", "makeup artist backstage", "hair stylist salon bride", "wedding hair styling"]),
    "illuzyonist": dict(ad="İllüzyonist", emoji="🎩", kadin=0.15, fiyat=(8000, 40000), birim="total", sayi=4,
        turler={"corporate": 4, "birthday": 3, "wedding": 2, "launch": 2, "gala": 1},
        arama=["magician performing stage", "magic show performance", "close-up magic cards", "illusionist show"]),
    "palyaco": dict(ad="Palyaço", emoji="🤡", kadin=0.5, fiyat=(3000, 12000), birim="total", sayi=4,
        turler={"birthday": 7, "circumcision": 2, "corporate": 1, "other": 1},
        arama=["clown children party", "face painting children festival", "balloon animals children", "children entertainer party"]),
    "tercuman": dict(ad="Tercüman", emoji="🗣️", kadin=0.6, fiyat=(5000, 20000), birim="full_day", sayi=4,
        turler={"conference": 5, "congress": 4, "fair": 3, "corporate": 2},
        arama=["interpreter booth conference", "simultaneous interpretation booth", "conference interpreter headset", "translation booth"]),
    "stand-up-komedyen": dict(ad="Stand-up Komedyen", emoji="😂", kadin=0.3, fiyat=(10000, 60000), birim="total", sayi=4,
        turler={"corporate": 5, "gala": 2, "birthday": 1, "launch": 1, "other": 2},
        arama=["stand-up comedian microphone stage", "comedy club stage performer", "comedian performing", "stand up comedy show"]),
    "karikaturist": dict(ad="Karikatürist", emoji="✏️", kadin=0.4, fiyat=(4000, 18000), birim="total", sayi=4,
        turler={"wedding": 3, "corporate": 3, "fair": 2, "birthday": 2, "launch": 1},
        arama=["caricature artist drawing event", "caricature drawing", "live sketch artist portrait", "street caricaturist"]),
    "akrobat": dict(ad="Akrobat", emoji="🤸", kadin=0.45, fiyat=(8000, 40000), birim="total", sayi=4,
        turler={"gala": 3, "launch": 3, "corporate": 2, "concert": 2, "wedding": 1},
        arama=["acrobat performance stage", "aerial acrobat silk", "fire show performer", "circus acrobatics show"]),
    "etkinlik-koordinatoru": dict(ad="Etkinlik Koordinatörü", emoji="📋", kadin=0.65, fiyat=(4000, 15000), birim="full_day", sayi=4,
        turler={"conference": 3, "corporate": 4, "launch": 2, "fair": 2, "gala": 1, "wedding": 1},
        arama=["event coordinator backstage headset", "event staff backstage", "stage manager event", "production crew event"]),
    "konusmaci": dict(ad="Konuşmacı", emoji="🎓", kadin=0.45, fiyat=(15000, 90000), birim="total", sayi=4,
        turler={"conference": 5, "corporate": 4, "congress": 2, "launch": 1},
        arama=["keynote speaker conference stage", "conference speaker audience", "speaker presenting slides", "panel discussion conference"]),
    "canli-yayin": dict(ad="Canlı Yayın", emoji="📡", kadin=0.2, fiyat=(12000, 70000), birim="total", sayi=4,
        turler={"conference": 4, "corporate": 3, "launch": 3, "concert": 2, "congress": 1},
        arama=["live streaming camera production", "broadcast camera crew event", "video switcher control room", "live stream studio setup"]),
    "influencer": dict(ad="Influencer", emoji="📱", kadin=0.6, fiyat=(10000, 80000), birim="total", sayi=4,
        turler={"launch": 5, "fair": 2, "corporate": 2, "other": 2},
        arama=["content creator smartphone filming", "influencer vlogging camera", "social media creator ring light", "vlogger filming"]),
    "drone-pilotu": dict(ad="Drone Pilotu", emoji="🚁", kadin=0.15, fiyat=(6000, 30000), birim="total", sayi=4,
        turler={"wedding": 4, "corporate": 2, "launch": 2, "concert": 2, "other": 2},
        arama=["drone pilot flying quadcopter", "aerial drone photography", "drone operator controller", "quadcopter flight outdoor"]),
}

# Ikinci rol adaylari (birincil -> ikincil secenekleri)
IKINCI_ROL = {
    "fotografci": ["videograf", "drone-pilotu"], "videograf": ["fotografci", "drone-pilotu", "canli-yayin"],
    "dj": ["ses-isik", "muzisyen"], "muzisyen": ["dj"], "sunucu": ["konusmaci", "stand-up-komedyen"], "hostes": ["model", "etkinlik-koordinatoru"],
    "akrobat": ["dansci"], "dansci": ["akrobat"], "ses-isik": ["canli-yayin", "dj"], "canli-yayin": ["videograf"],
    "model": ["oyuncu", "hostes"], "oyuncu": ["model", "sunucu"], "palyaco": ["illuzyonist"], "illuzyonist": ["palyaco"],
    "organizasyon": ["etkinlik-koordinatoru"], "etkinlik-koordinatoru": ["organizasyon", "hostes"], "konusmaci": ["sunucu"],
    "drone-pilotu": ["videograf", "fotografci"], "influencer": ["sunucu"], "karikaturist": ["illuzyonist"], "tercuman": ["sunucu"],
    "stand-up-komedyen": ["sunucu"], "sac-makyaj-styling": ["model"],
}

# Bio sablonlari: {ad} {sehir} {yil} {uzmanlik} {etkinlik} — her biri 120+ karakter cikacak sekilde
BIO = {
    "fotografci": [
        "{yil} yıldır {sehir} merkezli çalışan bir etkinlik fotoğrafçısıyım. {uzmanlik} çekimlerinde doğal ışık ve anı yakalamaya odaklanırım. Teslimatı {teslim} içinde online galeriyle yaparım.",
        "Düğün ve kurumsal etkinlik fotoğrafçılığında {yil} yıllık deneyim. {sehir} ve çevre illerde çalışıyorum; {uzmanlik} ağırlıklı portföyüm var. İkinci fotoğrafçı ve drone desteği sağlayabilirim.",
    ],
    "dj": [
        "{sehir} merkezli DJ. {yil} yıldır düğün, nişan ve kurumsal etkinliklerde set yapıyorum; {uzmanlik} tarzında dinleyiciyi okuyan bir akış kurarım. Kendi ses ve ışık sistemimle gelebilirim.",
        "Pistin boş kalmadığı etkinlikler için çalışıyorum. {yil} yıllık sahne deneyimi, {uzmanlik} repertuvarı ve MC desteği. {sehir} ve Türkiye genelinde seyahat ederim.",
    ],
    "muzisyen": [
        "{uzmanlik} alanında {yil} yıldır sahne alan bir müzisyenim. {sehir} merkezliyim; düğün, kokteyl ve gala formatlarına uygun repertuvar hazırlarım, ses sistemi ihtiyacını birlikte planlarız.",
        "Canlı müzikle etkinliğin ritmini kurarım. {yil} yıllık deneyim, {uzmanlik} ağırlıklı repertuvar; solo ya da grup formatında çalışırım. {sehir} ve çevresinde ulaşım bende.",
    ],
    "videograf": [
        "{sehir} merkezli videograf. {yil} yıldır {uzmanlik} çekimleri yapıyorum; sinematik anlatım, çok kameralı kurgu ve renk düzenlemesiyle teslim ederim. Drone çekimi ve aynı gün kısa klip seçeneği sunarım.",
        "Etkinliğinizi hikaye gibi anlatan videolar üretirim. {yil} yıl deneyim, {uzmanlik} odaklı portföy; teslimatı {teslim} içinde yaparım. {sehir} ve Türkiye genelinde çalışırım.",
    ],
    "sunucu": [
        "{yil} yıldır kurumsal etkinlik, gala ve lansman sunuculuğu yapıyorum. {uzmanlik} formatında akışı sade ve enerjik tutarım; Türkçe ve İngilizce sunum yapabilirim. {sehir} merkezliyim.",
        "Sahne akışını dakikasına kadar planlayan bir sunucuyum. {yil} yıllık deneyim, {uzmanlik} ağırlıklı geçmiş; protokol ve ödül törenlerine hakimim. {sehir} ve Türkiye geneli.",
    ],
    "organizasyon": [
        "{sehir} merkezli organizasyon ekibiyiz. {yil} yıldır {uzmanlik} planlıyor, konseptten tedarikçi yönetimine kadar tek elden yürütüyoruz. Bütçeye sadık, şeffaf teklif ve günlük akış planı sunarız.",
        "Konsept, dekorasyon ve operasyonu birlikte kurgularız. {yil} yıllık deneyim, {uzmanlik} odaklı portföy. {sehir} ve çevre illerde keşif ziyareti ücretsizdir.",
    ],
    "hostes": [
        "{sehir} merkezli deneyimli host/hostes. {yil} yıldır fuar, kongre ve lansmanlarda {uzmanlik} görevleri aldım; İngilizce iletişim kurabilirim. Dakik, güler yüzlü ve protokol kurallarına hakimim.",
        "Kayıt masası, karşılama ve stand tanıtımında {yil} yıllık deneyim. {uzmanlik} formatına alışkınım; çok günlü etkinliklere uygunum. {sehir} ve çevresi.",
    ],
    "dansci": [
        "{uzmanlik} alanında {yil} yıldır sahne alan dansçıyım. {sehir} merkezli ekibimle kına girişi, açılış şovu ve kurumsal koreografiler hazırlarız; kostüm ve müzik seçimi dahildir.",
        "Sahnede enerjiyi yükselten koreografiler. {yil} yıl deneyim, {uzmanlik} ağırlıklı repertuvar; solo veya grup formatı. {sehir} ve Türkiye genelinde çalışırız.",
    ],
    "ses-isik": [
        "{sehir} merkezli ses ve ışık ekibiyiz. {yil} yıldır {uzmanlik} etkinliklerinde kurulum ve operasyon yapıyoruz; line array, dijital mikser, LED ekran ve truss sistemlerimiz kendi envanterimizdir.",
        "Konser, düğün ve kurumsal etkinlikler için ses, ışık ve sahne çözümleri. {yil} yıllık deneyim, {uzmanlik} odaklı referanslar; kurulum ekibi ve jeneratör desteği sağlarız.",
    ],
    "model": [
        "{sehir} merkezli {uzmanlik} modeli. {yil} yıldır katalog, kampanya ve podyum işlerinde çalışıyorum; set disiplinine ve yönlendirmeye alışkınım. Portföyümde e-ticaret ve lansman çekimleri var.",
        "Podyum ve fotoğraf çekimlerinde {yil} yıllık deneyim. {uzmanlik} ağırlıklı portföy; fuar ve lansmanlarda tanıtım modeli olarak da çalışırım. {sehir} ve seyahate uygunum.",
    ],
    "oyuncu": [
        "Konservatuvar sonrası {yil} yıldır {uzmanlik} projelerinde oynuyorum. {sehir} merkezliyim; reklam, kısa film ve kurumsal eğitim videolarında kamera önü deneyimim var. Doğaçlama ve seslendirme yapabilirim.",
        "{uzmanlik} alanında {yil} yıllık sahne ve set deneyimi. Kurumsal etkinliklerde interaktif performans ve rol oyunu formatlarına hakimim. {sehir} ve Türkiye geneli.",
    ],
    "sac-makyaj-styling": [
        "{sehir} merkezli saç ve makyaj sanatçısıyım. {yil} yıldır {uzmanlik} alanında çalışıyorum; prova dahil paketler, kalıcı ve ışığa dayanıklı ürünlerle gün boyu tazeleme sunarım. Gelin evine veya otele gelirim.",
        "Gelin, sahne ve çekim makyajında {yil} yıllık deneyim. {uzmanlik} ağırlıklı portföy; kalabalık hazırlıklarda ekiple çalışırım. {sehir} ve çevresi.",
    ],
    "illuzyonist": [
        "{yil} yıldır sahne ve close-up illüzyon gösterileri yapıyorum. {sehir} merkezliyim; {uzmanlik} formatında kurumsal etkinlikler, lansmanlar ve özel davetler için 30-60 dakikalık programlar hazırlarım.",
        "Masa başı sihirden sahne illüzyonuna. {yil} yıllık deneyim, {uzmanlik} ağırlıklı program; çocuk ve yetişkin izleyiciye ayrı akış. {sehir} ve Türkiye genelinde.",
    ],
    "palyaco": [
        "{sehir} merkezli çocuk animatörü ve palyaçoyum. {yil} yıldır doğum günü, okul ve AVM etkinliklerinde {uzmanlik} gösterileri yapıyorum; yüz boyama ve balon şekillendirme dahil paketlerim var.",
        "Çocukların dilinden anlayan, güvenli ve eğlenceli programlar. {yil} yıl deneyim, {uzmanlik} ağırlıklı; 2 saate kadar kesintisiz animasyon. {sehir} ve çevresi.",
    ],
    "tercuman": [
        "{uzmanlik} alanında {yil} yıllık konferans tercümanıyım. {sehir} merkezliyim; kabin ekipmanlı simultane ve ardıl çeviri yaparım, teknik ve tıbbi terminolojiye hakimim. Çevrimiçi toplantılara da katılırım.",
        "Kongre, fuar ve iş görüşmelerinde {yil} yıldır çeviri yapıyorum. {uzmanlik} dil çiftinde çalışırım; yeminli tercümanlık belgem var. {sehir} ve Türkiye geneli.",
    ],
    "stand-up-komedyen": [
        "{yil} yıldır sahnede. {sehir} merkezli stand-up komedyeniyim; {uzmanlik} formatında kurumsal etkinlikler için temiz içerikli, markaya özel yazılmış 20-45 dakikalık setler hazırlarım.",
        "Kurumun dilini öğrenip ona göre yazarım. {yil} yıllık sahne deneyimi, {uzmanlik} ağırlıklı; gala ve bayi toplantılarında ara performans. {sehir} ve Türkiye geneli.",
    ],
    "karikaturist": [
        "{sehir} merkezli karikatüristim. {yil} yıldır etkinliklerde {uzmanlik} yapıyorum; saatte 12-15 portre çizerim, dijital teslim ve baskı seçeneği sunarım. Fuar standı ve düğün için stand kurulumu dahildir.",
        "Misafirlerin hediyesini anında üretirim. {yil} yıl deneyim, {uzmanlik} odaklı portföy; kurumsal markalı kağıt ve çerçeve seçeneği. {sehir} ve çevresi.",
    ],
    "akrobat": [
        "{uzmanlik} performansçısıyım; {yil} yıldır gala, lansman ve festivallerde sahne alıyorum. {sehir} merkezliyim; kostüm, müzik ve güvenlik ekipmanı bende, açık havada da performans verebilirim.",
        "Sahne şovundan dolaşan performansa. {yil} yıl deneyim, {uzmanlik} ağırlıklı repertuvar; LED ve ateş gösterileri için izin süreçlerini biliriz. {sehir} ve Türkiye geneli.",
    ],
    "etkinlik-koordinatoru": [
        "{sehir} merkezli etkinlik koordinatörüyüm. {yil} yıldır kongre, lansman ve gala operasyonlarında {uzmanlik} görevleri yürütüyorum; dakikalık akış planı, saha ekibi ve tedarikçi takibi benim işim.",
        "Etkinlik günü sakin kalmanızı sağlarım. {yil} yıllık saha deneyimi, {uzmanlik} ağırlıklı; çok günlü ve şehir dışı işlere uygunum. {sehir} ve Türkiye geneli.",
    ],
    "konusmaci": [
        "{uzmanlik} konularında {yil} yıldır konuşma ve eğitim veriyorum. {sehir} merkezliyim; keynote, panel ve yarım günlük atölye formatlarında çalışırım, içerik kurumun hedefine göre uyarlanır.",
        "Sahnede veri ve hikayeyi birleştiririm. {yil} yıllık deneyim, {uzmanlik} ağırlıklı başlıklar; Türkçe ve İngilizce sunum. {sehir} ve çevrimiçi.",
    ],
    "canli-yayin": [
        "{sehir} merkezli canlı yayın ekibiyiz. {yil} yıldır {uzmanlik} formatında çok kameralı yayın yapıyoruz; encoder, yedek internet ve reji masası kendi envanterimizdir. Zoom, YouTube ve özel RTMP'ye yayın veririz.",
        "Hibrit etkinliklerde kesintisiz yayın. {yil} yıl deneyim, {uzmanlik} ağırlıklı referanslar; grafik ve alt bant tasarımı dahil. {sehir} ve Türkiye geneli.",
    ],
    "influencer": [
        "{uzmanlik} içerikleri üreten bir içerik üreticisiyim. {sehir} merkezliyim; {yil} yıldır marka iş birlikleri, lansman katılımı ve etkinlik günü içerik üretimi yapıyorum. Teslim: reels, story serisi ve ham çekim.",
        "Etkinliği takipçiye hissettiririm. {yil} yıllık içerik deneyimi, {uzmanlik} odaklı topluluk; fiziksel katılım ve canlı yayın seçeneği. {sehir} ve Türkiye geneli.",
    ],
    "drone-pilotu": [
        "{sehir} merkezli lisanslı drone pilotuyum. {yil} yıldır {uzmanlik} çekimleri yapıyorum; uçuş izinlerini ben alırım, 4K video ve yüksek çözünürlüklü fotoğraf teslim ederim. Kurgu ve renk dahil paketlerim var.",
        "Havadan görüntüyle etkinliğin ölçeğini gösteririm. {yil} yıl deneyim, {uzmanlik} ağırlıklı; FPV ve sinema drone seçenekleri. {sehir} ve çevre iller.",
    ],
}
UZMANLIK = {
    "fotografci": ["düğün ve nişan", "kurumsal etkinlik", "lansman ve gala", "düğün ve aile"],
    "dj": ["pop ve elektronik", "retro ve 90'lar", "latin ve pop", "karma"],
    "muzisyen": ["akustik ve pop", "caz ve lounge", "Türk Halk Müziği ve Türk Sanat Müziği", "canlı grup"],
    "videograf": ["düğün", "kurumsal ve lansman", "tanıtım filmi ve etkinlik", "konser ve sahne"],
    "sunucu": ["kurumsal ve gala", "konferans ve panel", "lansman ve açılış", "düğün ve özel davet"],
    "organizasyon": ["düğün ve nişan", "kurumsal etkinlik", "lansman ve açılış", "doğum günü ve özel parti"],
    "hostes": ["fuar ve stand", "kayıt masası ve karşılama", "VIP ve protokol", "tanıtım"],
    "dansci": ["modern ve show dans", "Latin dans", "halk oyunları ve kına", "hip-hop"],
    "ses-isik": ["konser ve festival", "düğün ve davet", "kurumsal ve konferans", "lansman"],
    "model": ["katalog ve e-ticaret", "podyum ve defile", "tanıtım ve fuar", "kampanya"],
    "oyuncu": ["reklam ve dijital", "tiyatro ve sahne", "dizi ve kısa film", "kurumsal eğitim videosu"],
    "sac-makyaj-styling": ["gelin saçı ve makyajı", "kına ve nişan makyajı", "sahne ve çekim makyajı", "moda styling"],
    "illuzyonist": ["sahne ve close-up", "mentalizm", "çocuk gösterisi", "kurumsal"],
    "palyaco": ["palyaço ve animasyon", "yüz boyama ve balon", "maskot", "bubble show"],
    "tercuman": ["İngilizce-Türkçe", "Almanca-Türkçe", "Rusça-Türkçe", "Arapça-Türkçe"],
    "stand-up-komedyen": ["kurumsal set", "tam gösteri", "doğaçlama", "roast ve özel konsept"],
    "karikaturist": ["canlı çizim", "portre karikatür", "dijital illüstrasyon", "fuar standı çizimi"],
    "akrobat": ["akrobasi ve jonglörlük", "ateş gösterisi", "LED ve ışık şovu", "stilt walker ve canlı heykel"],
    "etkinlik-koordinatoru": ["saha koordinasyonu", "backstage", "konuk akışı ve kayıt", "protokol"],
    "konusmaci": ["liderlik ve motivasyon", "yapay zeka ve dijital dönüşüm", "girişimcilik", "satış ve müşteri deneyimi"],
    "canli-yayin": ["konferans ve webinar", "lansman", "konser ve sahne", "hibrit toplantı"],
    "influencer": ["yaşam tarzı ve etkinlik", "teknoloji", "gastronomi", "moda ve güzellik"],
    "drone-pilotu": ["düğün ve dış çekim", "kurumsal tesis", "konser ve festival", "FPV"],
}
TESLIM = ["1 hafta", "2 hafta", "3-5 gün", "10 gün"]
BASLIK = {
    "fotografci": ["Anı yakalayan düğün ve etkinlik fotoğrafçısı", "Doğal ışık, sade kadrajlar", "Kurumsal etkinlik fotoğrafçısı"],
    "dj": ["Pisti boş bırakmayan DJ", "Düğün ve kurumsal DJ", "Open format DJ & MC"],
    "muzisyen": ["Canlı müzikle etkinliğin ritmi", "Akustik ve caz performansları", "Düğün orkestrası"],
    "videograf": ["Sinematik düğün ve etkinlik filmleri", "Çok kameralı kurumsal video", "Hikaye anlatan videolar"],
    "sunucu": ["Kurumsal etkinlik ve gala sunucusu", "İki dilli moderatör", "Lansman ve ödül töreni sunucusu"],
    "organizasyon": ["Konseptten operasyona tek elden", "Düğün ve davet organizasyonu", "Kurumsal etkinlik yönetimi"],
    "hostes": ["Deneyimli fuar ve kongre hostesi", "Karşılama ve kayıt masası", "VIP protokol hostesi"],
    "dansci": ["Sahne ve kına dans ekibi", "Latin dans performansı", "Modern show koreografileri"],
    "ses-isik": ["Ses, ışık ve sahne çözümleri", "Konser ve etkinlik teknik prodüksiyon", "LED ekran ve truss"],
    "model": ["Katalog ve podyum modeli", "Kampanya ve e-ticaret çekimleri", "Tanıtım ve fuar modeli"],
    "oyuncu": ["Reklam ve kurumsal video oyuncusu", "Tiyatro kökenli oyuncu", "Doğaçlama ve interaktif performans"],
    "sac-makyaj-styling": ["Gelin saçı ve makyajı", "Sahne ve çekim makyajı", "Prova dahil gelin paketi"],
    "illuzyonist": ["Sahne ve close-up illüzyon", "Mentalizm gösterisi", "Kurumsal etkinlik sihirbazı"],
    "palyaco": ["Çocuk animasyonu ve palyaço", "Yüz boyama ve balon", "Doğum günü eğlencesi"],
    "tercuman": ["Konferans tercümanı (simultane/ardıl)", "Yeminli tercüman", "Fuar ve iş görüşmesi çevirmeni"],
    "stand-up-komedyen": ["Kurumsal etkinliklere özel stand-up", "Temiz içerikli komedi", "Markaya özel yazılmış set"],
    "karikaturist": ["Etkinlikte canlı karikatür", "Portre karikatür ve illüstrasyon", "Fuar standı çizim köşesi"],
    "akrobat": ["Akrobasi ve ateş gösterisi", "LED show ve stilt walker", "Sirk performansı"],
    "etkinlik-koordinatoru": ["Etkinlik günü saha koordinatörü", "Backstage ve zaman akışı", "Kongre operasyonu"],
    "konusmaci": ["Keynote ve motivasyon konuşmacısı", "Dijital dönüşüm konuşmaları", "Liderlik atölyeleri"],
    "canli-yayin": ["Çok kameralı canlı yayın", "Hibrit etkinlik yayını", "Webinar teknik operasyonu"],
    "influencer": ["Etkinlik ve lansman içerik üreticisi", "Reels ve story serisi", "Marka iş birlikleri"],
    "drone-pilotu": ["Lisanslı drone çekimi", "Havadan düğün ve etkinlik", "FPV ve sinema drone"],
}
DILLER = {
    "varsayilan": [["Türkçe"], ["Türkçe", "İngilizce"], ["Türkçe", "İngilizce"], ["Türkçe", "İngilizce", "Almanca"]],
    "tercuman": [["Türkçe", "İngilizce"], ["Türkçe", "Almanca"], ["Türkçe", "Rusça"], ["Türkçe", "Arapça", "İngilizce"]],
}
EKIPMAN = {
    "fotografci": [["Canon R6 Mark II", "RF 24-70 f/2.8", "RF 85 f/1.2", "Profoto A10 flaş"], ["Sony A7 IV", "Sony 35 f/1.4", "Sony 70-200 f/2.8", "Godox V1"]],
    "videograf": [["Sony FX3", "DJI RS3 gimbal", "Sennheiser kablosuz mikrofon", "Aputure 300d"], ["Canon C70", "DJI Mini 4 Pro", "Atomos Ninja"]],
    "dj": [["Pioneer CDJ-3000 x2", "DJM-900NXS2", "RCF ART 912 x2", "LED par 8 adet"], ["Pioneer XDJ-XZ", "JBL EON ONE", "Sis makinesi"]],
    "muzisyen": [["Taylor 814ce", "Bose L1 Pro", "Shure SM58"], ["Nord Stage 3", "QSC K12.2 x2"]],
    "ses-isik": [["L-Acoustics Kara line array", "Yamaha QL5", "Robe Pointe x12", "LED ekran 6x3 m P3.9", "Truss 12 m"]],
    "canli-yayin": [["Blackmagic ATEM Mini Extreme", "Sony PXW-Z190 x3", "Teradek Vidiu Go", "Yedek LTE bağlantı"]],
    "drone-pilotu": [["DJI Mavic 3 Pro", "DJI Avata 2 (FPV)", "Yedek batarya x6", "ND filtre seti"]],
    "tercuman": [["Taşınabilir fısıltı sistemi (tour guide)", "Kabin kulaklık seti"]],
    "sac-makyaj-styling": [["Charlotte Tilbury & NARS kit", "Dyson Airwrap", "Profesyonel makyaj koltuğu"]],
}

# Ajanslar
AJANSLAR = [
    dict(ad="Nova Etkinlik", slug="ajans-nova", kat="organizasyon", sehir="İstanbul", odak=["fotografci", "dj", "muzisyen", "sunucu", "hostes", "sac-makyaj-styling", "videograf"], ekip=8, premium="agency",
         hakkinda="Nova Etkinlik, 2014'ten beri İstanbul'da düğün, nişan ve kurumsal etkinlik organizasyonu yapan tam kapsamlı bir ajanstır. Konsept tasarımı, tedarikçi yönetimi ve etkinlik günü operasyonunu tek ekipten yürütür; 60'ın üzerinde düzenli freelance iş ortağıyla çalışır."),
    dict(ad="Lumen Prodüksiyon", slug="ajans-lumen", kat="ses-isik", sehir="İstanbul", odak=["ses-isik", "canli-yayin", "drone-pilotu", "videograf"], ekip=6, premium="plus",
         hakkinda="Lumen Prodüksiyon konser, konferans ve lansmanlarda ses, ışık, LED ekran ve canlı yayın altyapısını kurar. 2.000 kişiye kadar sahne çözümleri, çok kameralı reji ve hibrit yayın hizmetini kendi ekipmanıyla sunar."),
    dict(ad="Atlas Organizasyon", slug="ajans-atlas", kat="organizasyon", sehir="Ankara", odak=["fotografci", "sunucu", "hostes", "etkinlik-koordinatoru", "ses-isik", "tercuman"], ekip=6, premium="none",
         hakkinda="Ankara merkezli Atlas Organizasyon, kamu ve özel sektör için kongre, bayi toplantısı ve protokol etkinlikleri düzenler. Kayıt sistemi, simultane çeviri ve sahne prodüksiyonu dahil anahtar teslim çözüm sunar."),
    dict(ad="Kuzey Yıldızı Events", slug="ajans-kuzey-yildizi", kat="organizasyon", sehir="İzmir", odak=["fotografci", "dj", "dansci", "sac-makyaj-styling", "organizasyon"], ekip=5, premium="none",
         hakkinda="İzmir ve Ege kıyılarında butik düğün ve kına organizasyonları. Kuzey Yıldızı Events, Çeşme, Alaçatı ve Urla'daki mekan ağıyla açık hava davetleri planlar; dekorasyon ve çiçek tasarımı ekibi kendisine aittir."),
    dict(ad="Mavi Sahne", slug="ajans-mavi-sahne", kat="muzisyen", sehir="İstanbul", odak=["muzisyen", "dj", "dansci", "akrobat", "ses-isik"], ekip=7, premium="agency",
         hakkinda="Mavi Sahne, sahne sanatçıları temsil eden bir müzik ve performans ajansıdır. Orkestra, DJ, dans ve akrobasi ekipleriyle düğün, gala ve festival programlarına sanatçı sağlar; ses ve ışık ortaklarıyla paket teklif verir."),
    dict(ad="Artı Bir Ajans", slug="ajans-arti-bir", kat="sunucu", sehir="İstanbul", odak=["sunucu", "konusmaci", "stand-up-komedyen", "illuzyonist", "tercuman"], ekip=5, premium="none",
         hakkinda="Artı Bir Ajans sunucu, konuşmacı ve komedyen portföyüyle kurumsal etkinliklerin sahne akışını kurar. Bayi toplantısı, ödül töreni ve lansmanlar için iki dilli sunucu ve ara performans sağlar."),
    dict(ad="Ritim Müzik Ajansı", slug="ajans-ritim", kat="dj", sehir="Antalya", odak=["dj", "muzisyen", "ses-isik", "dansci"], ekip=4, premium="none",
         hakkinda="Antalya merkezli Ritim Müzik Ajansı otel ve beach club etkinliklerine DJ, canlı müzik ve dans ekipleri sağlar. Sezonluk rezidans programları ve düğün paketleriyle Akdeniz bölgesinde çalışır."),
    dict(ad="Vizyon Cast Ajansı", slug="ajans-vizyon-cast", kat="model", sehir="İstanbul", odak=["model", "oyuncu", "hostes", "dansci", "influencer"], ekip=8, premium="plus",
         hakkinda="Vizyon Cast Ajansı reklam, katalog ve etkinlikler için model, oyuncu ve host kadrosu sağlar. 200'ü aşkın portföy, seçme (casting) organizasyonu ve set günü koordinasyonu hizmetleriyle marka ve prodüksiyon şirketleriyle çalışır."),
    dict(ad="Pusula Etkinlik", slug="ajans-pusula", kat="etkinlik-koordinatoru", sehir="Bursa", odak=["etkinlik-koordinatoru", "hostes", "fotografci", "ses-isik", "sunucu"], ekip=4, premium="none",
         hakkinda="Bursa merkezli Pusula Etkinlik sanayi kuruluşlarının bayi toplantısı, fabrika açılışı ve fuar katılımlarını planlar. Saha koordinasyon ekibi, hostes kadrosu ve teknik tedarikçi ağıyla Marmara bölgesinde hizmet verir."),
    dict(ad="Ekim Kreatif", slug="ajans-ekim", kat="influencer", sehir="İstanbul", odak=["influencer", "fotografci", "videograf", "canli-yayin", "drone-pilotu"], ekip=5, premium="none",
         hakkinda="Ekim Kreatif, lansman ve marka etkinliklerinin sosyal medya katmanını yönetir: içerik üreticisi eşleştirme, etkinlik günü çekim ekibi, canlı yayın ve aynı gün kurgu. Veriye dayalı raporlama sunar."),
    dict(ad="Beyaz Güvercin Organizasyon", slug="ajans-beyaz-guvercin", kat="organizasyon", sehir="Gaziantep", odak=["fotografci", "dj", "muzisyen", "sac-makyaj-styling", "dansci", "palyaco"], ekip=5, premium="none",
         hakkinda="Gaziantep ve Güneydoğu'da düğün, kına ve sünnet organizasyonları. Beyaz Güvercin, yöresel müzik ekipleri, geleneksel kına programı ve çocuk eğlencesi dahil aile etkinliklerinde 12 yıllık deneyime sahiptir."),
    dict(ad="Zirve Teknik Prodüksiyon", slug="ajans-zirve", kat="ses-isik", sehir="Ankara", odak=["ses-isik", "canli-yayin", "videograf", "tercuman", "etkinlik-koordinatoru"], ekip=4, premium="none",
         hakkinda="Zirve Teknik Prodüksiyon kongre ve konferanslara simultane çeviri kabini, ses-ışık, kayıt ve canlı yayın altyapısı sağlar. Ankara'daki kongre merkezlerinde düzenli tedarikçidir; 1.500 kişiye kadar salon kurulumu yapar."),
]

KURUMLAR = [
    dict(ad="Teknopark Yazılım A.Ş.", slug="kurum-teknopark", sektor="teknoloji", sehir="İstanbul", turler=["launch", "conference", "corporate"]),
    dict(ad="Marmara Perakende Grubu", slug="kurum-marmara-perakende", sektor="perakende", sehir="İstanbul", turler=["launch", "fair", "corporate"]),
    dict(ad="Anadolu İlaç", slug="kurum-anadolu-ilac", sektor="ilaç", sehir="Ankara", turler=["congress", "conference", "corporate"]),
    dict(ad="Ege Otomotiv", slug="kurum-ege-otomotiv", sektor="otomotiv", sehir="İzmir", turler=["launch", "fair", "gala"]),
    dict(ad="Boğaziçi Finans", slug="kurum-bogazici-finans", sektor="finans", sehir="İstanbul", turler=["gala", "conference", "corporate"]),
    dict(ad="Akdeniz Gıda", slug="kurum-akdeniz-gida", sektor="gıda", sehir="Antalya", turler=["fair", "launch", "corporate"]),
    dict(ad="Başkent Eğitim Kurumları", slug="kurum-baskent-egitim", sektor="eğitim", sehir="Ankara", turler=["graduation", "conference", "corporate"]),
    dict(ad="Mavi Deniz Turizm", slug="kurum-mavi-deniz", sektor="turizm", sehir="Muğla", turler=["gala", "corporate", "concert"]),
]

# Musteri (client) hesaplari: (ad, soyad, sehir) uretec rastgele secer

# Konusma sablonlari — {tur} etkinlik turu adi (kucuk), {tarih} gun.ay, {sehir}, {sehir_de} (bulunma ekli: Istanbul'da / Izmir'de / Gaziantep'te),
# {kisi} konuk sayisi, {ad} profesyonel adi. Ek uyumu uret.py ek_de() ile (bulgular #26).
MUSTERI_ACILIS = [
    "Merhaba, {tarih} tarihinde {sehir_de} {tur} organizasyonumuz var. Yaklaşık {kisi} kişi bekliyoruz. Müsait misiniz, fiyat bilgisi alabilir miyim?",
    "Selam {ad} Bey/Hanım, profilinizi Kashe'de gördüm. {tur} için {tarih} günü düşünüyoruz, {sehir}. Paket içerikleriniz nedir?",
    "Merhaba, {sehir_de} {tarih} tarihli {tur} etkinliğimiz için teklif rica ediyorum. Mekan henüz kesinleşmedi ama tarih sabit.",
    "İyi günler, {tur} için sizinle çalışmak istiyoruz. Tarih {tarih}, yer {sehir}, davetli sayısı {kisi} civarı. Ücret ve koşullarınızı paylaşır mısınız?",
    "Merhaba, referans üzerine yazıyorum. {tarih} günü {sehir_de} {tur} var; o gün uygun musunuz? Bütçe aralığımızı da yazdım.",
]
PRO_YANIT = [
    "Merhaba, teşekkürler. {tarih} tarihi şu an için müsait. Detayları konuşup size özel bir teklif hazırlayayım; mekan ve saat bilgisini de alabilir miyim?",
    "Merhaba, {tur} için o tarihte uygunum. Standart paketim ve ekleri için teklifi birazdan gönderiyorum; sorularınız olursa buradayım.",
    "Selam, yazdığınız için teşekkürler. {sehir} için ulaşım dahil fiyat verebilirim. Program akışını paylaşırsanız teklifi ona göre netleştiririm.",
    "Merhaba! Takvimde {tarih} boş görünüyor. Birkaç soru: etkinlik kaç saat sürecek, mekan açık mı kapalı mı? Ardından teklifi iletirim.",
]
MUSTERI_DEVAM = [
    "Mekan {ilce} tarafında, kapalı salon. Saat 19.00'da başlayıp gece yarısına kadar sürecek.",
    "Teşekkürler. Toplam süre 5-6 saat olur. Bütçe konusunda biraz esneğiz, önemli olan deneyim.",
    "Harika. Program akışını yarın paylaşırım. Bir de ödeme koşullarınızı öğrenebilir miyim?",
    "Açık hava, {ilce}. Yağmur planı için alternatif de var. Ekibiniz kaç kişi geliyor?",
]
PRO_DEVAM = [
    "Anladım, teşekkürler. Teklifi hazırladım; %30 kapora ile tarih kesinleşir, kalanı etkinlik günü. İptal koşulları teklifte yazıyor.",
    "Süper. Açık hava için ek ekipman gerekebilir, onu teklife ayrı kalem olarak ekledim. İsterseniz çıkarabiliriz.",
    "Tamamdır. Ekip 2 kişi geliyor, ulaşım bizden. Teklif ekte, geçerlilik 14 gün.",
]
MUSTERI_KAPANIS_OLUMLU = ["Teklif uygun, onaylıyorum. Görüşmek üzere!", "Harika, teklifi kabul ettik. Detayları etkinlik haftası konuşuruz.", "Tamamdır, onayladım. Kaporayı bugün gönderiyorum."]
MUSTERI_KAPANIS_OLUMSUZ = ["Teşekkürler, bütçemizi biraz aştı; başka bir seçenekle ilerleyeceğiz.", "Değerlendirdik, bu sefer farklı bir tarzda ilerlemeye karar verdik. İlginiz için teşekkürler.", "Maalesef tarih değişti, şimdilik iptal ediyoruz."]
PRO_TESEKKUR = ["Teşekkürler, görüşmek üzere!", "Harika, not aldım. Etkinlik haftası son kontrol için yazarım.", "Anlayışla karşılıyorum, başka bir etkinlikte görüşmek dileğiyle."]
TEKLIF_ACIKLAMA = {
    "fotografci": ["{tur} günü 8 saat çekim, 2 fotoğrafçı, 600+ düzenlenmiş fotoğraf, online galeri ve USB teslim.", "{tur} çekimi (6 saat), tek fotoğrafçı, 400+ düzenlenmiş kare, 2 hafta içinde online galeri."],
    "dj": ["{tur} için 5 saat DJ performansı, ses sistemi (2 adet 1.000 W), temel ışık, MC anonsları ve kurulum/söküm dahil.", "{tur} DJ seti (4 saat), kendi ses ve ışık sistemimle, sis makinesi dahil."],
    "muzisyen": ["{tur} için 3 set canlı performans (toplam 2,5 saat), ses sistemi dahil, repertuvar seçimi birlikte.", "Kokteyl saatinde akustik performans (90 dk) + yemek boyunca lounge seti."],
    "videograf": ["{tur} günü 8 saat çekim, 2 kamera + drone, 4-6 dk hikaye klibi ve tam uzunluk kayıt, teslim 3 hafta.", "{tur} için 1 kamera 5 saat çekim, kurgu ve renk dahil 3 dk özet video."],
    "sunucu": ["{tur} sunuculuğu (tam gün), akış planı toplantısı ve prova dahil; Türkçe-İngilizce.", "{tur} sahne akışı sunuculuğu (4 saat), açılış ve kapanış anonsları, ödül töreni yönetimi."],
    "organizasyon": ["{tur} organizasyonu: konsept, dekorasyon, masa düzeni, tedarikçi koordinasyonu ve etkinlik günü 3 kişilik operasyon ekibi.", "{tur} için koordinasyon paketi: tedarikçi yönetimi, akış planı ve gün boyu saha ekibi."],
    "hostes": ["{tur} için {kisi_h} hostes, tam gün (8 saat), kıyafet ve ulaşım dahil.", "Kayıt masası ve karşılama için 2 hostes, 2 gün."],
    "dansci": ["{tur} için 4 kişilik dans ekibi, 2 gösteri (toplam 25 dk), kostüm ve müzik dahil.", "Kına girişi ve 15 dakikalık show programı, 3 dansçı."],
    "ses-isik": ["{tur} için ses sistemi (line array), 12 robot ışık, sahne 6x4 m, teknik operatör ve kurulum dahil.", "Ses ve ışık paketi: 2.000 W sistem, 8 LED par, kablosuz mikrofon x4, operatör."],
    "model": ["{tur} için tanıtım modeli, tam gün, kıyafet marka tarafından sağlanır.", "Katalog çekimi, 1 gün, 40 kombin."],
    "oyuncu": ["Kurumsal eğitim videosu için 1 gün set, rol oyunu sahneleri, seslendirme dahil.", "{tur} için interaktif performans (2 saat), senaryo hazırlığı dahil."],
    "sac-makyaj-styling": ["Gelin saçı ve makyajı, prova dahil, düğün günü gelin evinde hizmet ve 1 tazeleme.", "Kına makyajı ve saç, 2 kişi, mekanda hizmet."],
    "illuzyonist": ["{tur} için 45 dakikalık sahne illüzyon gösterisi + 1 saat close-up masa gezisi.", "Çocuk sihirbaz gösterisi (40 dk), interaktif."],
    "palyaco": ["{tur} için 2 saat animasyon: palyaço gösterisi, yüz boyama, balon şekillendirme ve oyunlar.", "1,5 saat çocuk animasyonu, 2 animatör."],
    "tercuman": ["{tur} için simultane çeviri (İngilizce-Türkçe), 2 tercüman, tam gün, kabin ekipmanı hariç.", "Ardıl çeviri, yarım gün."],
    "stand-up-komedyen": ["{tur} için kuruma özel yazılmış 30 dakikalık stand-up seti, 1 ön görüşme dahil.", "Gala ara performansı 20 dk, markaya özel içerik."],
    "karikaturist": ["{tur} için 3 saat canlı karikatür, saatte ~12 portre, markalı kağıt ve stand dahil.", "4 saat canlı çizim, dijital teslim seçeneği."],
    "akrobat": ["{tur} için 2 kişilik akrobasi şovu (2 x 10 dk) + karşılama performansı.", "Ateş gösterisi 15 dk, güvenlik ekipmanı dahil."],
    "etkinlik-koordinatoru": ["{tur} günü saha koordinasyonu (10 saat), akış planı hazırlığı ve tedarikçi takibi.", "2 günlük kongre koordinasyonu, 1 asistanla."],
    "konusmaci": ["{tur} için 45 dakikalık keynote konuşma + 15 dk soru-cevap, içerik uyarlaması dahil.", "Yarım günlük atölye (3 saat), materyal dahil."],
    "canli-yayin": ["{tur} için 3 kameralı canlı yayın, reji, grafik ve yedek bağlantı; YouTube + Zoom eş zamanlı.", "Tek kameralı webinar yayını, 2 saat."],
    "influencer": ["{tur} için etkinlik günü katılımı, 3 reels + 8 story, 1 hafta içinde yayın.", "Lansman içerik paketi: 1 video + story serisi."],
    "drone-pilotu": ["{tur} için 2 saat drone çekimi, 4K video ve 30 düzenlenmiş fotoğraf, uçuş izni dahil.", "Hava çekimi ve 60 sn kurgulu klip."],
}
IPTAL_POLITIKA = ["Etkinliğe 30 günden önce iptalde kapora iade edilir; sonrasında kapora iade edilmez.", "15 gün öncesine kadar ücretsiz iptal, sonrasında %30 kesinti.", None]
YORUMLAR = {
    5: ["Her şey kusursuzdu. Zamanında geldi, misafirlerimizle çok iyi iletişim kurdu, sonuç beklediğimizin üzerinde. Kesinlikle tavsiye ederim.",
        "Profesyonel, güler yüzlü ve işinin ehli. Etkinlik boyunca hiçbir aksaklık yaşamadık, teslimat da söz verdiği gibiydi.",
        "Harika bir deneyimdi. Ekip çok ilgiliydi, misafirler hâlâ konuşuyor. Tekrar çalışmak isteriz.",
        "Çok memnun kaldık. Fiyat-performans olarak da gayet iyiydi. Teşekkürler!"],
    4: ["Genel olarak çok iyiydi, sadece kurulum biraz uzun sürdü. Sonuçtan memnunuz.",
        "İşini iyi yapıyor, iletişim hızlıydı. Küçük bir gecikme dışında sorun yaşamadık.",
        "Beklentimizi karşıladı. Teslim süresi biraz uzadı ama sonuç güzel."],
    3: ["Ortalama bir deneyimdi. Vaat edilen bazı detaylar eksikti, ama genel olarak idare etti.",
        "İletişimde zorlandık, etkinlik günü ise sorunsuzdu."],
    2: ["Maalesef beklediğimiz özeni görmedik. Geç geldi ve program aksadı."],
}
YORUM_YANIT = ["Güzel sözleriniz için teşekkür ederim, sizinle çalışmak keyifti!", "Geri bildiriminiz için teşekkürler, bir sonraki etkinlikte görüşmek üzere.", "Gecikme için tekrar özür dilerim, değerlendirmeniz için teşekkürler."]

# Ajans teklif basliklari ve kurum etkinlikleri
ETKINLIK_BASLIK = {
    "wedding": ["{ad1} & {ad2} Düğünü", "{ad1} ve {ad2} Düğün Daveti"], "engagement": ["{ad1} & {ad2} Nişanı"], "henna": ["{ad1} Kına Gecesi"],
    "birthday": ["{ad1} Doğum Günü Partisi", "{ad1} 40. Yaş Partisi"], "baby_shower": ["{ad1} Baby Shower"], "graduation": ["{kurum} Mezuniyet Töreni"],
    "circumcision": ["{ad1} Sünnet Düğünü"], "corporate": ["{kurum} Bayi Toplantısı", "{kurum} Yıl Sonu Partisi", "{kurum} Şirket Pikniği"],
    "launch": ["{kurum} Ürün Lansmanı", "{kurum} Yeni Sezon Lansmanı"], "fair": ["{kurum} Fuar Standı", "{kurum} Fuar Katılımı"],
    "conference": ["{kurum} Teknoloji Konferansı", "{kurum} Liderlik Zirvesi"], "congress": ["{kurum} Ulusal Kongre"], "gala": ["{kurum} Ödül Gecesi", "{kurum} Gala Yemeği"],
    "concert": ["{kurum} Yaz Konseri"], "other": ["{kurum} Çalışan Buluşması"],
}
GOREVLER = ["Mekan keşfi ve ölçü alma", "Tedarikçi tekliflerini toplama", "Akış planı taslağı", "Müşteri onayı için teklif revizyonu", "Ekip brifingi",
            "Kostüm ve prova takvimi", "Teknik ihtiyaç listesi", "Etkinlik günü saha planı", "Davetli listesi kontrolü", "Fatura ve tahsilat takibi"]
TEDARIKCILER = [("Lezzet Catering", "catering"), ("Çiçek Atölyesi Flora", "decor"), ("Marmara Tente Çadır", "venue"), ("Hızlı Vale", "transport"),
                ("Prizma LED Kiralama", "stage_technical"), ("Bodrum Sahil Mekan", "venue"), ("Kule Güvenlik", "security"), ("Nota Piyano Kiralama", "sound_light"),
                ("Baskı Evi Promosyon", "print_promo"), ("Sahne Ekipman Kiralama", "stage_technical")]
KISILER = [("Kurumsal İletişim Müdürü", "Pazarlama"), ("Etkinlik Sorumlusu", "İK"), ("Satın Alma Uzmanı", "Satın Alma"), ("Gelin Annesi", None), ("Damat", None), ("Genel Müdür Asistanı", "Yönetim")]
LEAD_BASLIK = ["{kurum} yıl sonu partisi", "{ad} düğün organizasyonu", "{kurum} lansman sahne prodüksiyonu", "{ad} nişan daveti", "{kurum} bayi toplantısı teknik paket"]

# Performans modulu metinleri (bulgular #32): kategoriye ozel; (what_to_expect, setup_logistics, ek detaylar)
PERFORMANS_METNI = {
    "dj": [("Açılışta ortam müziği, yemek sonrası tempo yükseltme ve gece yarısına doğru dans seti; istek parçalar akışa yedirilir.",
            "Mekana 2 saat önce kurulum; ses sistemi yoksa kendi setim gelir, ışık için mekanla koordinasyon.", {"Set": "DJ booth + kontrolcü", "Mikrofon": "Anons için 1 kablosuz"}),
           ("Düğün ve kurumsal davetlerde iki bölümlü set: dinleti ve dans. Çiftin özel parçaları ve ilk dans önceden provalanır.",
            "Kurulum 90 dk, ses kontrolü 30 dk; jeneratör gereken açık havada önceden bilgi isterim.", {"Set": "Pioneer standart kurulum", "Yedek": "İkinci laptop + kablolu yedek"})],
    "muzisyen": [("Karşılama kokteylinde akustik, yemekte hafif repertuvar, sonrasında canlı dans müziği; set listesi etkinlik sahibiyle birlikte netleşir.",
                  "Ekip mekana 2 saat önce gelir; monitör ve mikrofon ihtiyacı teknik ekibe önceden iletilir.", {"Set süresi": "3 x 45 dk", "Ekip": "Trio / kuartet"}),
                 ("Canlı performans ara vermeden akışa eşlik eder; istek parçalar repertuvar dahilinde o anda eklenir.",
                  "Sahne ölçüsü ve elektrik hattı kurulum öncesi teyit edilir; ses sistemi mekandan ya da anlaşmalı tedarikçiden.", {"Set süresi": "2 x 60 dk", "Prova": "Etkinlik günü 30 dk"})],
    "sunucu": [("Açılış konuşması, program akışı yönetimi, konuk ve konuşmacı anonsları, ödül töreni sunumu; metin ve akış önceden birlikte çalışılır.",
                "Etkinlikten 1 saat önce mekanda, kulis ve sahne provası; metin değişiklikleri son ana kadar alınır.", {"Dil": "Türkçe / İngilizce", "Kıyafet": "Etkinlik konseptine uygun"}),
               ("Kurumsal lansman ve gala sunumu; sahne enerjisi etkinliğin tonuna göre ayarlanır, interaktif bölümler eklenebilir.",
                "Akış dokümanı etkinlikten 2 gün önce; prova mekanda 45 dk.", {"Deneyim": "Canlı yayın sunumu dahil", "Ekstra": "Yarışma / çekiliş yönetimi"})],
    "dansci": [("Açılış gösterisi ve program arası performanslar; koreografi etkinlik temasına göre uyarlanır, kostüm dahildir.",
                "Sahne zemini ve ölçüsü önceden kontrol edilir; ısınma ve prova için 60 dk alan.", {"Gösteri": "2 x 10 dk", "Ekip": "2-6 dansçı"}),
               ("Modern ve geleneksel dans gösterileri; ekip koreografisi ya da solo performans seçeneği.",
                "Mekana 90 dk önce varış, kostüm değişimi için kulis gerekir.", {"Gösteri": "15 dk", "Müzik": "Kendi kaydımız"})],
    "illuzyonist": [("Masa arası yakın illüzyon ve sahne gösterisi; seyirci katılımlı numaralarla etkileşimli bir akış.",
                     "Sahne gösterisi için 60 dk kurulum, yakın illüzyon için kurulum gerekmez.", {"Gösteri": "Sahne 30 dk + yakın 60 dk", "Yaş": "Her yaş grubu"}),
                    ("Kurumsal etkinliklere uyarlanmış mentalizm ve illüzyon gösterisi; markaya özel final numarası hazırlanabilir.",
                     "Ses sistemi ve yaka mikrofonu mekandan; ışık için basit bir spot yeterli.", {"Gösteri": "40 dk", "Prova": "Mekanda 30 dk"})],
    "palyaco": [("Çocuklarla oyunlar, balon figürleri, yüz boyama ve kısa gösteri; yaş grubuna göre akış.",
                 "Etkinlikten 30 dk önce mekanda; 3x3 m alan ve bir masa yeterli.", {"Süre": "2 saat", "Ekip": "1-2 kişi"}),
                ("Doğum günü ve sünnet eğlencesi: sihirbazlık, danslı oyunlar, pasta anı yönetimi.",
                 "Açık havada gölgelik alan rica edilir; ses sistemi kendi hoparlörümüzle.", {"Süre": "90 dk", "Ekstra": "Mini disko"})],
    "stand-up-komedyen": [("Etkinliğe özel yazılmış bölümler içeren stand-up gösterisi; kurumsal etkinliklerde ekip ve sektör esprileri önceden onaylanır.",
                           "Sahne, yaka ya da el mikrofonu ve ışık yeterli; prova gerekmez, teknik kontrol 20 dk.", {"Gösteri": "30-45 dk", "İçerik": "Kurumsal uyumlu"}),
                          ("Gala ve lansmanlarda açılış gösterisi ya da program arası performans; interaktif bölümler seyirciyle.",
                           "Etkinlikten 1 saat önce mekanda; akış sorumlusuyla kısa brifing.", {"Gösteri": "20-30 dk", "Dil": "Türkçe"})],
    "karikaturist": [("Canlı karikatür: konuklar 3-5 dakikada çizilir, çizimler anında hediye edilir; kurumsal etkinliklerde logo baskılı kağıt kullanılabilir.",
                      "Bir masa, iki sandalye ve aydınlatma yeterli; 30 dk kurulum.", {"Hız": "12-15 kişi / saat", "Süre": "2-4 saat"}),
                     ("Dijital canlı karikatür: tabletle çizim, ekranda yansıtma ve anında e-posta/QR ile paylaşım.",
                      "Ekran ve HDMI bağlantısı mekandan; kurulum 45 dk.", {"Hız": "10-12 kişi / saat", "Format": "Dijital + baskı"})],
    "akrobat": [("Akrobasi ve hava gösterisi (kumaş, çember); açılış ya da program arasında 2 performans.",
                 "Asma noktası ve yük kapasitesi önceden teyit edilir; güvenlik alanı 4x4 m; kurulum 2 saat.", {"Gösteri": "2 x 8 dk", "Ekip": "2-4 kişi"}),
                ("Yer akrobasisi ve LED gösterisi; sahne ölçüsüne göre uyarlanır, mekan yüksekliği 4 m yeterli.",
                 "Prova için 60 dk; sahne zemini kaymaz olmalı.", {"Gösteri": "12 dk", "Müzik": "Kendi kaydımız"})],
}
