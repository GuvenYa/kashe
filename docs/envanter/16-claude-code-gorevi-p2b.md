# Claude Code gorevi — FAZ 4c / P2b: sihirbaz metin kutularinda 6-7 saniyelik gecikme (URL guncellemesi sunucuya gidiyor)

Asagidaki metni oldugu gibi Claude Code'a ver. P3'ten ONCE kosulur (kucuk, tek dosya). Kaynak: P2 canli turunda Guven'in
gozlemi — sihirbazdaki metin/sayi kutularina yazarken her karakter 6-7 saniye sonra beliriyor, silerken de ayni.

---

Kashe reposundasin. `app/etkinlik-sihirbazi/sihirbaz-client.tsx` ve `page.tsx`'i oku. Uretimde sihirbazin metin ve sayi
kutularinda (ilce, katilimci, butce alt/ust, adet, baslik) her tus 6-7 saniye gecikmeli yaziliyor. Neden: kutular
DOGRUDAN URL parametresinden okunuyor (`params.get(...)`) ve her `onChange` `guncelle()` -> `router.push(...)` cagiriyor;
`router.push` Next App Router'da SUNUCU bilesenini yeniden calistirir (page.tsx her seferinde `service_categories`,
`turkish_cities`, `event_types` ve sayac icin `v_providers_public` sorgularini kosar, RSC yuku iner), karakter ancak bu
tur tamamlaninca gorunur. `page.tsx` `searchParams` OKUMUYOR — yani URL degisince sunucuya gitmeye hic gerek yok.

Duzeltme (URL = tek gercek ilkesi KORUNUR; giris donusunde ve geri/ileri tusunda secimler yine URL'den gelir):

1. `guncelle()` sunucuya gitmesin: `router.push` yerine tarayicinin yerel gecmis API'si. Next 14.1+ (bizde 16) `window.history.pushState`
   / `replaceState` cagrilarini App Router ile senkronlar; `useSearchParams` ve `usePathname` guncellenir, sunucu bileseni
   YENIDEN CALISMAZ.
   - `guncelle(yamalar, { gecmis?: 'push' | 'replace' })`: varsayilan `replace` (alan duzenlemeleri gecmis kaydi
     uretmesin); `adim` degisen cagrilar `push` (geri tusu adimlar arasinda dolassin — bugunku davranis).
   - Uygulama: `const url = qs ? \`${pathname}?${qs}\` : pathname; window.history[gecmis === 'push' ? 'pushState' : 'replaceState'](null, '', url);`
     (`null` state; Next kendi state'ini korur). `router` yalniz giris yonlendirmesi ve `/etkinliklerim/<id>`'ye gidis icin kalir.
2. Metin ve sayi kutulari yerel state ile kontrol edilsin, URL'ye yazim yine her degisimde (artik ucuz):
   `ilce`, `katilimci`, `butce_min`, `butce_max`, `baslik`, `adet` (rol basina) icin `useState(params.get(...) ?? '')`;
   `onChange` -> `setX(v)` + `guncelle({ x: v || null })`. Gosterilen deger yerel state'ten gelir (anlik). URL disaridan
   degisirse (geri tusu, Analiz et sonucu, giris donusu) yerel state'i URL'den tazele: `useEffect(() => { setX(params.get('x') ?? '') }, [params])`
   — ama kullanicinin yazdigini ezmemek icin yalniz URL degeri yerel degerden FARKLI ve odak o kutuda DEGILSE
   (`document.activeElement !== inputRef.current`) ya da daha basit: URL'den okunan degeri `key` olarak kullanip kutuyu
   yeniden monte etme — hangisini sectiysen raporla. Select/tarih/onay kutusu/cipler dogrudan URL'den okumaya devam
   edebilir (tek etkilesimlik; gecikme kaynagi degil) — ama onlar da artik `router.push` cagirmadigi icin aninda olur.
3. "Analiz et" sonucu URL'ye tek seferde yazilir (`push`), "Atla" `push`, "Devam"/"Geri" `push`, alan duzenlemeleri `replace`.
4. `metin` textarea zaten yerel state; giris yonlendirmesinden once URL'ye `metin` yaziliyor mu kontrol et (redirect
   hedefinde `metin` olmali — P2 kabulu); degilse `girisYolu` icinde ekle.

Dogrulama:
- `npx tsc --noEmit` bos; `npm run build` basarili.
- `grep -n "router.push" app/etkinlik-sihirbazi/sihirbaz-client.tsx` -> yalniz giris yonlendirmesi (2) ve `/etkinliklerim/` (1).
- `grep -n "history\.\(pushState\|replaceState\)" app/etkinlik-sihirbazi/sihirbaz-client.tsx` -> `guncelle` icinde.
- Onizleme (yerel dev yeter; Network sekmesi acik): adim 2'de ilceye 20 karakter hizli yaz -> aninda yazilir, hicbir
  RSC/`?_rsc=` istegi gitmez; adim 3'te katilimci/butce ayni; adim 4'te adet ayni; adim degistirince URL `?adim=` guncellenir
  ve geri tusu onceki adima doner (secimler durur); sayfayi yenileyince (F5) secimler URL'den geri gelir; "Atla" ->
  adim 1; oturumsuz "Onayla" -> `/giris?redirect=` icinde tum parametreler (ilce, katilimci, baslik dahil).
- Sayac (adim 1-4) aninda guncellenmeye devam eder.

Yapilmayacaklar: page.tsx sorgulari, adim icerikleri, onay/Analiz mantigi, `actions.ts` degismez. Migration yok.

Rapor: degisen dosya, tsc/build, grep ciktilari, Network gozlemi (RSC istegi yok), secilen yerel-state senkron yontemi.
Commit ATMA.
