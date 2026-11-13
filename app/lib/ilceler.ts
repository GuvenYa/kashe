import { aramaKatla } from '@/app/lib/arama';

/**
 * BUYUKSEHIR ILCELERI (Duzeltme 14-B, bulgu 126, Fahri satir 27; karar 5-B).
 *
 * Yalniz 30 buyuksehir ilinde ilce LISTESI var (519 ilce); diger 51 ilde
 * "ilce / mekan" serbest metin kalir. Il secilince formlar bu listeden bir
 * ilce acilir kutusu gosterir, mekan ayrica serbest metindir.
 *
 * KAYNAK: PTT posta kodu listesi (pk_list), `turkey-neighbourhoods` 4.0.3
 * paketi uzerinden (Mart 2024 verisi). Il basina ilce sayilari 6360 sayili
 * Kanun sonrasi yapiyla ayni (toplam 519). Yeni ilce kurulursa ya da ad
 * degisirse YALNIZ bu dosya guncellenir; veritabaninda ilce tablosu yok.
 *
 * ANAHTAR il ADIDIR ve `turkish_cities.name` ile ayni yazilir; esleme yine de
 * Turkce harf duyarsiz yapilir (`aramaKatla`). Ilceler Turkce alfabe
 * sirasinda.
 *
 * KAYDEDILEN DEGER degismedi: konum tek metin alaninda durur,
 * "<mekan>, <ilce>, <Il>" (parcalar istege bagli, il SONDA). Ayristirma ve
 * birlestirme asagidaki yardimcilarla tek yerden yapilir.
 */
export const BUYUKSEHIR_ILCELERI: Readonly<Record<string, readonly string[]>> = {
  Adana: [
    'Aladağ', 'Ceyhan', 'Çukurova', 'Feke', 'İmamoğlu', 'Karaisalı', 'Karataş', 'Kozan',
    'Pozantı', 'Saimbeyli', 'Sarıçam', 'Seyhan', 'Tufanbeyli', 'Yumurtalık', 'Yüreğir',
  ],
  Ankara: [
    'Akyurt', 'Altındağ', 'Ayaş', 'Bala', 'Beypazarı', 'Çamlıdere', 'Çankaya', 'Çubuk',
    'Elmadağ', 'Etimesgut', 'Evren', 'Gölbaşı', 'Güdül', 'Haymana', 'Kahramankazan',
    'Kalecik', 'Keçiören', 'Kızılcahamam', 'Mamak', 'Nallıhan', 'Polatlı', 'Pursaklar',
    'Sincan', 'Şereflikoçhisar', 'Yenimahalle',
  ],
  Antalya: [
    'Akseki', 'Aksu', 'Alanya', 'Demre', 'Döşemealtı', 'Elmalı', 'Finike', 'Gazipaşa',
    'Gündoğmuş', 'İbradı', 'Kaş', 'Kemer', 'Kepez', 'Konyaaltı', 'Korkuteli', 'Kumluca',
    'Manavgat', 'Muratpaşa', 'Serik',
  ],
  'Aydın': [
    'Bozdoğan', 'Buharkent', 'Çine', 'Didim', 'Efeler', 'Germencik', 'İncirliova',
    'Karacasu', 'Karpuzlu', 'Koçarlı', 'Köşk', 'Kuşadası', 'Kuyucak', 'Nazilli', 'Söke',
    'Sultanhisar', 'Yenipazar',
  ],
  'Balıkesir': [
    'Altıeylül', 'Ayvalık', 'Balya', 'Bandırma', 'Bigadiç', 'Burhaniye', 'Dursunbey',
    'Edremit', 'Erdek', 'Gömeç', 'Gönen', 'Havran', 'İvrindi', 'Karesi', 'Kepsut',
    'Manyas', 'Marmara', 'Savaştepe', 'Sındırgı', 'Susurluk',
  ],
  Bursa: [
    'Büyükorhan', 'Gemlik', 'Gürsu', 'Harmancık', 'İnegöl', 'İznik', 'Karacabey',
    'Keles', 'Kestel', 'Mudanya', 'Mustafakemalpaşa', 'Nilüfer', 'Orhaneli',
    'Orhangazi', 'Osmangazi', 'Yenişehir', 'Yıldırım',
  ],
  Denizli: [
    'Acıpayam', 'Babadağ', 'Baklan', 'Bekilli', 'Beyağaç', 'Bozkurt', 'Buldan', 'Çal',
    'Çameli', 'Çardak', 'Çivril', 'Güney', 'Honaz', 'Kale', 'Merkezefendi', 'Pamukkale',
    'Sarayköy', 'Serinhisar', 'Tavas',
  ],
  'Diyarbakır': [
    'Bağlar', 'Bismil', 'Çermik', 'Çınar', 'Çüngüş', 'Dicle', 'Eğil', 'Ergani', 'Hani',
    'Hazro', 'Kayapınar', 'Kocaköy', 'Kulp', 'Lice', 'Silvan', 'Sur', 'Yenişehir',
  ],
  Erzurum: [
    'Aşkale', 'Aziziye', 'Çat', 'Hınıs', 'Horasan', 'İspir', 'Karaçoban', 'Karayazı',
    'Köprüköy', 'Narman', 'Oltu', 'Olur', 'Palandöken', 'Pasinler', 'Pazaryolu',
    'Şenkaya', 'Tekman', 'Tortum', 'Uzundere', 'Yakutiye',
  ],
  'Eskişehir': [
    'Alpu', 'Beylikova', 'Çifteler', 'Günyüzü', 'Han', 'İnönü', 'Mahmudiye',
    'Mihalgazi', 'Mihalıççık', 'Odunpazarı', 'Sarıcakaya', 'Seyitgazi', 'Sivrihisar',
    'Tepebaşı',
  ],
  Gaziantep: [
    'Araban', 'İslahiye', 'Karkamış', 'Nizip', 'Nurdağı', 'Oğuzeli', 'Şahinbey',
    'Şehitkamil', 'Yavuzeli',
  ],
  Hatay: [
    'Altınözü', 'Antakya', 'Arsuz', 'Belen', 'Defne', 'Dörtyol', 'Erzin', 'Hassa',
    'İskenderun', 'Kırıkhan', 'Kumlu', 'Payas', 'Reyhanlı', 'Samandağ', 'Yayladağı',
  ],
  'İstanbul': [
    'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
    'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
    'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
    'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
    'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer', 'Silivri',
    'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla', 'Ümraniye', 'Üsküdar',
    'Zeytinburnu',
  ],
  'İzmir': [
    'Aliağa', 'Balçova', 'Bayındır', 'Bayraklı', 'Bergama', 'Beydağ', 'Bornova', 'Buca',
    'Çeşme', 'Çiğli', 'Dikili', 'Foça', 'Gaziemir', 'Güzelbahçe', 'Karabağlar',
    'Karaburun', 'Karşıyaka', 'Kemalpaşa', 'Kınık', 'Kiraz', 'Konak', 'Menderes',
    'Menemen', 'Narlıdere', 'Ödemiş', 'Seferihisar', 'Selçuk', 'Tire', 'Torbalı',
    'Urla',
  ],
  'Kahramanmaraş': [
    'Afşin', 'Andırın', 'Çağlayancerit', 'Dulkadiroğlu', 'Ekinözü', 'Elbistan',
    'Göksun', 'Nurhak', 'Onikişubat', 'Pazarcık', 'Türkoğlu',
  ],
  Kayseri: [
    'Akkışla', 'Bünyan', 'Develi', 'Felahiye', 'Hacılar', 'İncesu', 'Kocasinan',
    'Melikgazi', 'Özvatan', 'Pınarbaşı', 'Sarıoğlan', 'Sarız', 'Talas', 'Tomarza',
    'Yahyalı', 'Yeşilhisar',
  ],
  Kocaeli: [
    'Başiskele', 'Çayırova', 'Darıca', 'Derince', 'Dilovası', 'Gebze', 'Gölcük',
    'İzmit', 'Kandıra', 'Karamürsel', 'Kartepe', 'Körfez',
  ],
  Konya: [
    'Ahırlı', 'Akören', 'Akşehir', 'Altınekin', 'Beyşehir', 'Bozkır', 'Cihanbeyli',
    'Çeltik', 'Çumra', 'Derbent', 'Derebucak', 'Doğanhisar', 'Emirgazi', 'Ereğli',
    'Güneysınır', 'Hadim', 'Halkapınar', 'Hüyük', 'Ilgın', 'Kadınhanı', 'Karapınar',
    'Karatay', 'Kulu', 'Meram', 'Sarayönü', 'Selçuklu', 'Seydişehir', 'Taşkent',
    'Tuzlukçu', 'Yalıhüyük', 'Yunak',
  ],
  Malatya: [
    'Akçadağ', 'Arapgir', 'Arguvan', 'Battalgazi', 'Darende', 'Doğanşehir', 'Doğanyol',
    'Hekimhan', 'Kale', 'Kuluncak', 'Pütürge', 'Yazıhan', 'Yeşilyurt',
  ],
  Manisa: [
    'Ahmetli', 'Akhisar', 'Alaşehir', 'Demirci', 'Gölmarmara', 'Gördes', 'Kırkağaç',
    'Köprübaşı', 'Kula', 'Salihli', 'Sarıgöl', 'Saruhanlı', 'Selendi', 'Soma',
    'Şehzadeler', 'Turgutlu', 'Yunusemre',
  ],
  Mardin: [
    'Artuklu', 'Dargeçit', 'Derik', 'Kızıltepe', 'Mazıdağı', 'Midyat', 'Nusaybin',
    'Ömerli', 'Savur', 'Yeşilli',
  ],
  Mersin: [
    'Akdeniz', 'Anamur', 'Aydıncık', 'Bozyazı', 'Çamlıyayla', 'Erdemli', 'Gülnar',
    'Mezitli', 'Mut', 'Silifke', 'Tarsus', 'Toroslar', 'Yenişehir',
  ],
  'Muğla': [
    'Bodrum', 'Dalaman', 'Datça', 'Fethiye', 'Kavaklıdere', 'Köyceğiz', 'Marmaris',
    'Menteşe', 'Milas', 'Ortaca', 'Seydikemer', 'Ula', 'Yatağan',
  ],
  Ordu: [
    'Akkuş', 'Altınordu', 'Aybastı', 'Çamaş', 'Çatalpınar', 'Çaybaşı', 'Fatsa',
    'Gölköy', 'Gülyalı', 'Gürgentepe', 'İkizce', 'Kabadüz', 'Kabataş', 'Korgan',
    'Kumru', 'Mesudiye', 'Perşembe', 'Ulubey', 'Ünye',
  ],
  Sakarya: [
    'Adapazarı', 'Akyazı', 'Arifiye', 'Erenler', 'Ferizli', 'Geyve', 'Hendek',
    'Karapürçek', 'Karasu', 'Kaynarca', 'Kocaali', 'Pamukova', 'Sapanca', 'Serdivan',
    'Söğütlü', 'Taraklı',
  ],
  Samsun: [
    '19 Mayıs', 'Alaçam', 'Asarcık', 'Atakum', 'Ayvacık', 'Bafra', 'Canik', 'Çarşamba',
    'Havza', 'İlkadım', 'Kavak', 'Ladik', 'Salıpazarı', 'Tekkeköy', 'Terme',
    'Vezirköprü', 'Yakakent',
  ],
  'Şanlıurfa': [
    'Akçakale', 'Birecik', 'Bozova', 'Ceylanpınar', 'Eyyübiye', 'Halfeti', 'Haliliye',
    'Harran', 'Hilvan', 'Karaköprü', 'Siverek', 'Suruç', 'Viranşehir',
  ],
  'Tekirdağ': [
    'Çerkezköy', 'Çorlu', 'Ergene', 'Hayrabolu', 'Kapaklı', 'Malkara',
    'Marmaraereğlisi', 'Muratlı', 'Saray', 'Süleymanpaşa', 'Şarköy',
  ],
  Trabzon: [
    'Akçaabat', 'Araklı', 'Arsin', 'Beşikdüzü', 'Çarşıbaşı', 'Çaykara', 'Dernekpazarı',
    'Düzköy', 'Hayrat', 'Köprübaşı', 'Maçka', 'Of', 'Ortahisar', 'Sürmene', 'Şalpazarı',
    'Tonya', 'Vakfıkebir', 'Yomra',
  ],
  Van: [
    'Bahçesaray', 'Başkale', 'Çaldıran', 'Çatak', 'Edremit', 'Erciş', 'Gevaş',
    'Gürpınar', 'İpekyolu', 'Muradiye', 'Özalp', 'Saray', 'Tuşba',
  ],
};

/** Katlanmis il adi -> listedeki anahtar. */
const IL_ANAHTARLARI = new Map(
  Object.keys(BUYUKSEHIR_ILCELERI).map((il) => [aramaKatla(il), il])
);

/**
 * Eski ya da yaygin baska yazimlar (katlanmis il -> katlanmis yazim -> liste
 * adi). Kashe AI'nin metinden cikardigi ya da eski kayitta duran ad listedeki
 * adla eslessin diye; listeye yeni ilce EKLEMEZ.
 */
const DIGER_YAZIMLAR: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ankara: { kazan: 'Kahramankazan' },
  istanbul: { eyup: 'Eyüpsultan' },
  samsun: { ondokuzmayis: '19 Mayıs', 'ondokuz mayis': '19 Mayıs' },
  tekirdag: { 'marmara ereglisi': 'Marmaraereğlisi' },
  bursa: { 'mustafa kemalpasa': 'Mustafakemalpaşa' },
  kahramanmaras: { 'oniki subat': 'Onikişubat', '12 subat': 'Onikişubat' },
};

/** Il buyuksehirse ilce listesi; degilse `null` (serbest metin). */
export function ilceListesi(
  il: string | null | undefined
): readonly string[] | null {
  const anahtar = IL_ANAHTARLARI.get(aramaKatla((il ?? '').trim()));
  return anahtar ? BUYUKSEHIR_ILCELERI[anahtar] : null;
}

/**
 * Serbest metni ilin ilce listesiyle esler (Turkce harf duyarsiz).
 * Eslesmezse '' doner; uydurma ilce yazilmaz.
 */
export function ilceEslestir(
  ham: string | null | undefined,
  il: string | null | undefined
): string {
  const liste = ilceListesi(il);
  const n = aramaKatla((ham ?? '').trim()).replace(/\s+/g, ' ');
  if (!liste || !n) return '';
  const tam = liste.find((i) => aramaKatla(i) === n);
  if (tam) return tam;
  return DIGER_YAZIMLAR[aramaKatla((il ?? '').trim())]?.[n] ?? '';
}

/**
 * Il degisince ilce secimi: yeni ilin listesinde varsa kalir, yoksa bosalir
 * (Kadikoy secili iken Ankara'ya gecilirse ilce temizlenir).
 */
export function ilceTasi(yeniIl: string, ilce: string): string {
  return ilceListesi(yeniIl) ? ilceEslestir(ilce, yeniIl) : '';
}

/**
 * Il degisince SERBEST ilce metni (sihirbazdaki "ilce / semt" alani: Kashe AI
 * metinden cikarir ya da kullanici yazar):
 *   - yeni ilin listesinde varsa listedeki yazimiyla kalir,
 *   - eski ilin LISTESINDEN secilmisse yeni ile tasinmaz (bosalir),
 *   - listede olmayan serbest metin (semt) korunur.
 */
export function ilceMetniTasi(
  eskiIl: string,
  yeniIl: string,
  ilce: string
): string {
  const metin = ilce.trim();
  if (!metin) return '';
  const yeni = ilceEslestir(metin, yeniIl);
  if (yeni) return yeni;
  if (ilceEslestir(metin, eskiIl)) return '';
  return metin;
}

/** Il + ilce + mekan -> kaydedilen konum metni ("<mekan>, <ilce>, <Il>"). */
export function konumBirlestir(il: string, ilce: string, mekan: string): string {
  const m = mekan.trim();
  if (!il) return m;
  return [m, ilce, il].filter(Boolean).join(', ');
}

/**
 * Kaydedilen konum metnini ilce ve mekana ayirir. `il` cagiranin cozdugu il
 * adidir (`ilEslestir`); bossa metnin tamami mekandir.
 *
 *   "Zorlu PSM, Besiktas, Istanbul" -> ilce "Besiktas", mekan "Zorlu PSM"
 *   "Besiktas, Istanbul"            -> ilce "Besiktas", mekan ""
 *   "Moda sahili, Istanbul"         -> ilce "",         mekan "Moda sahili"
 *   "Mengen, Bolu" (liste yok)      -> ilce "",         mekan "Mengen"
 *
 * Il metnin SONUNDA degilse eski "Istanbul, Besiktas" ve "Istanbul / Sisli"
 * yazimlari denenir (il basta ve ardindan virgul ya da egik cizgi; Duzeltme
 * 18: ikincisi eski kayitlarda cok); o da degilse mekan bos doner (il adi
 * mekan metninin icinde gecmis olabilir - "Ankara Caddesi" -, kalan guvenle
 * ayrilamaz).
 */
export function konumCoz(
  ham: string | null | undefined,
  il: string
): { ilce: string; mekan: string } {
  const metin = (ham ?? '').trim();
  if (!il) return { ilce: '', mekan: metin };

  const kucuk = metin.toLocaleLowerCase('tr');
  const kucukIl = il.toLocaleLowerCase('tr');
  let kalan = '';
  if (kucuk.endsWith(kucukIl)) {
    kalan = metin.slice(0, metin.length - il.length);
  } else if (kucuk.startsWith(kucukIl) && /^\s*[,/]/.test(metin.slice(il.length))) {
    kalan = metin.slice(il.length);
  }
  kalan = kalan.replace(/^[,/\s]+|[,/\s]+$/g, '');

  if (!kalan || !ilceListesi(il)) return { ilce: '', mekan: kalan };

  const parcalar = kalan
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const sondaki = ilceEslestir(parcalar[parcalar.length - 1], il);
  if (sondaki) {
    return { ilce: sondaki, mekan: parcalar.slice(0, -1).join(', ') };
  }
  const bastaki = parcalar.length > 1 ? ilceEslestir(parcalar[0], il) : '';
  if (bastaki) {
    return { ilce: bastaki, mekan: parcalar.slice(1).join(', ') };
  }
  return { ilce: '', mekan: kalan };
}

/**
 * Kaydedilen konum metnini il + ilce + mekan KUTULARINA dagitir (Duzeltme 18,
 * `KonumAlani`). `il` cagiranin cozdugu il adidir (`ilEslestir`).
 *
 * `konumCoz`dan farki: cozulemeyen metin KAYBOLMAZ. Il adi metnin icinde
 * gecip kalan guvenle ayrilamiyorsa ("Ankara Caddesi 12") il BOS doner ve
 * metnin tamami mekan kutusuna yazilir; aksi halde kullanici ilce sectiginde
 * kutuda gorunmeyen eski metin sessizce silinirdi.
 */
export function konumKutulari(
  ham: string | null | undefined,
  il: string
): { il: string; ilce: string; mekan: string } {
  const metin = (ham ?? '').trim();
  if (!metin || !il) return { il: '', ilce: '', mekan: metin };
  const cozum = konumCoz(metin, il);
  if (cozum.ilce || cozum.mekan) return { il, ...cozum };
  // Yalniz il adi ("Istanbul", "istanbul", "Istanbul,").
  const yalin = metin.replace(/[,/\s]+/g, ' ').trim();
  if (aramaKatla(yalin) === aramaKatla(il)) return { il, ilce: '', mekan: '' };
  return { il: '', ilce: '', mekan: metin };
}
