import {
  LegalPageShell,
  LegalSection,
  LegalSubsection,
  LegalList,
} from '@/app/components/legal-page-shell';
import {
  LEGAL_OPERATOR,
  LEGAL_CONTACT,
  MIN_USER_AGE,
} from '@/app/lib/legal-meta';

export const metadata = {
  title: 'Kullanım Koşulları — Kashe',
  description:
    'Kashe platformunun kullanım koşulları. Hak ve yükümlülükler, sorumluluk sınırları, hesap kuralları.',
};

export default function KullanimKosullariPage() {
  return (
    <LegalPageShell
      eyebrow="Hukuki · Sözleşme"
      title="Kullanım Koşulları"
      subtitle="Kashe'yi kullanırken geçerli olan kuralları, hak ve yükümlülüklerini burada sade bir dille anlatıyoruz."
    >
      <LegalSection number="01" title="Genel Tanımlar">
        <p>
          Bu Kullanım Koşulları (&ldquo;Koşullar&rdquo;), Kashe platformunu
          işleten{' '}
          <strong className="text-ink">{LEGAL_OPERATOR.legalEntity}</strong>{' '}
          (&ldquo;Kashe&rdquo;) ile platformu kullanan sen (&ldquo;Kullanıcı&rdquo;)
          arasındaki sözleşmesel ilişkiyi düzenler.
        </p>
        <p>
          Kashe; bireysel ve kurumsal kullanıcıları, etkinlik, eğlence, medya
          ve prodüksiyon alanlarındaki profesyonel hizmet sağlayıcılarla
          buluşturan <strong className="text-ink">aracı dijital pazaryeri</strong>{' '}
          platformudur.
        </p>
        <p>
          Platformda üç tür kullanıcı vardır:
        </p>
        <LegalList
          items={[
            { label: 'Hizmet Alan', description: 'Bireysel veya kurumsal olarak hizmet arayan kullanıcı.' },
            { label: 'Profesyonel Hizmet Sağlayıcı', description: 'Kendi adına etkinlik, sahne, medya veya prodüksiyon hizmeti sunan profesyonel.' },
            { label: 'Ajans / Menajer', description: 'Birden fazla profesyoneli temsil eden veya toplu hizmet paketi sunan kullanıcı.' },
          ]}
        />
      </LegalSection>

      <LegalSection number="02" title="Kashe'nin Aracı Rolü">
        <p>
          Kashe, kullanıcılar arasındaki keşif, iletişim, teklif, rezervasyon
          ve değerlendirme süreçlerini kolaylaştıran bir dijital aracıdır.
          Hizmetin <em>fiilen sunulması</em>, sözleşmesel hak ve
          yükümlülüklerin yerine getirilmesi tarafların kendi sorumluluğundadır.
        </p>
        <p>Bu çerçevede Kashe:</p>
        <LegalList
          items={[
            'Profesyonel ile müşteri arasındaki anlaşmanın tarafı değildir.',
            'Hizmetin kalitesi, zamanlaması veya sonucunu garanti etmez.',
            'Tarafların birbirine karşı doğrudan veya dolaylı taahhütlerinden sorumlu tutulamaz.',
            'Yalnızca platformun teknik altyapısının ve aracı hizmetlerin sağlanmasından sorumludur.',
          ]}
        />
      </LegalSection>

      <LegalSection number="03" title="Hesap Açma ve Kullanım">
        <LegalSubsection title="Yaş şartı">
          <p>
            Kashe&apos;yi kullanabilmek için en az{' '}
            <strong className="text-ink">{MIN_USER_AGE} yaşında</strong>{' '}
            olman gerekir. Bu yaşın altındaysan platforma kaydolamazsın;
            yapmış olduğun kayıtlar fark edildiğinde silinir.
          </p>
        </LegalSubsection>

        <LegalSubsection title="Doğru bilgi yükümlülüğü">
          <p>
            Hesap açarken ve profilini doldururken verdiğin tüm bilgilerin
            doğru, güncel ve kendine ait olduğunu kabul edersin. Yanıltıcı,
            sahte veya başkasına ait bilgi kullanılması durumunda hesabın
            askıya alınabilir veya kapatılabilir.
          </p>
        </LegalSubsection>

        <LegalSubsection title="Hesap güvenliği">
          <p>
            Parolanın gizliliğinden ve hesabın güvenliğinden sen sorumlusun.
            Hesabını başkalarıyla paylaşmamalı, şüpheli bir erişim
            durumunda derhal Kashe&apos;ye bildirmelisin.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection number="04" title="Yasaklanan Davranışlar">
        <p>
          Kashe&apos;yi kullanırken aşağıdaki davranışlardan kaçınman gerekir.
          Bu kurallara uymayan kullanıcıların hesapları askıya alınır veya
          kapatılır; gerekirse yasal işlem başlatılır.
        </p>
        <LegalList
          items={[
            'Platform dışına yönlendirme: İletişim, ödeme veya rezervasyonu Kashe dışında tamamlamak için karşı tarafa telefon, IBAN, e-posta gibi iletişim bilgisi göndermek.',
            'Yanıltıcı içerik: Sahte profil, başkasına ait fotoğraf veya portföy yüklemek, gerçek dışı portföy/referans paylaşmak.',
            'Uygunsuz içerik: Hakaret, taciz, ayrımcılık, nefret söylemi, müstehcen veya kanuna aykırı içerik paylaşmak.',
            'Spam ve dolandırıcılık: Toplu mesaj göndermek, kullanıcıları kandırmaya yönelik taktikler kullanmak, sahte yorum/puan bırakmak.',
            'Telif ihlali: Üzerinde hakka sahip olmadığın içerikleri portföye yüklemek.',
            'Otomatik araç kullanımı: Bot, scraper veya otomatik script ile platformu kullanmak; veri toplama amaçlı sistematik erişim yapmak.',
            'Güvenlik ihlali: Platform altyapısına yetkisiz erişim denemek, kötü amaçlı kod yüklemek, başka kullanıcıların hesaplarına izinsiz erişmeye çalışmak.',
          ]}
        />
      </LegalSection>

      <LegalSection number="05" title="Mesajlaşma ve İletişim Bilgisi Paylaşımı">
        <p>
          Platform içinde profesyonel ile müşteri arasındaki tüm iletişim
          Kashe mesajlaşma sistemi üzerinden yürütülmelidir. Kashe, kullanıcı
          güvenliğini ve platformun bütünlüğünü korumak amacıyla mesajlarda
          telefon numarası, IBAN, e-posta gibi platform dışı iletişim
          bilgilerinin paylaşılmasını otomatik olarak filtreleyebilir.
        </p>
        <p>
          Bu kural, hem müşterinin hem profesyonelin çıkarınadır: anlaşmazlık
          durumunda yaşananların izi platformda olur, dolandırıcılık riski
          azalır, kalite kontrolü mümkün olur.
        </p>
      </LegalSection>

      <LegalSection number="06" title="Profesyonel ve Ajans Sorumlulukları">
        <p>
          Profesyonel veya ajans olarak Kashe&apos;de profil oluşturuyorsan
          aşağıdakileri kabul edersin:
        </p>
        <LegalList
          items={[
            'Sunduğun hizmeti doğru ve eksiksiz tanımlamak; portföyünün gerçek işlerine ait olması.',
            'Aldığın rezervasyonun gerektirdiği zaman, ekipman ve niteliklere sahip olmak.',
            'Anlaşılan tarih, lokasyon ve kapsam çerçevesinde hizmeti sunmak.',
            'Bir nedenle hizmeti sunamayacak durumdaysan müşteriyi makul bir süre öncesinden bilgilendirmek ve rezervasyonu Kashe üzerinden iptal etmek.',
            'Hizmetin sunulması için gerekli yasal izin, vergi ve yetkilendirmelere sahip olmak; vergi yükümlülüklerini kendin yerine getirmek.',
            'Müşterinin kişisel bilgilerini sadece hizmetin sunulması amacıyla kullanmak, başka amaçlarla paylaşmamak.',
          ]}
        />
      </LegalSection>

      <LegalSection number="07" title="Hizmet Alan Kullanıcı Sorumlulukları">
        <p>
          Müşteri veya işletme olarak hizmet alıyorsan aşağıdakileri kabul edersin:
        </p>
        <LegalList
          items={[
            'Etkinlik bilgilerini (tarih, lokasyon, ihtiyacın kapsamı) doğru paylaşmak.',
            'Profesyonelin tekliflerini iyi niyetle değerlendirmek; rezervasyonu onayladıktan sonra makul gerekçe olmadan iptal etmemek.',
            'Hizmet sunum koşullarını (lokasyon, erişim, ekipman alanı vb.) anlaşıldığı şekilde sağlamak.',
            'Profesyonele saygılı davranmak; hizmet sırasında veya değerlendirme yaparken hakaret, ayrımcılık veya tehdit içeren ifadelerden kaçınmak.',
          ]}
        />
      </LegalSection>

      <LegalSection number="08" title="Rezervasyon ve İptal">
        <p>
          Bir teklif onaylandığında platformda <em>rezervasyon</em> oluşur.
          Rezervasyonlar, tarafların kendi aralarında belirlediği şartlarla
          (tarih, lokasyon, hizmet kapsamı, ücret, iptal politikası vb.)
          yürütülür.
        </p>
        <p>
          Her iki taraf da rezervasyonu Kashe arayüzü üzerinden iptal
          edebilir. İptal halinde:
        </p>
        <LegalList
          items={[
            'Karşı tarafa platform içi bildirim ve e-posta gönderilir.',
            'İptal sebebi (eğer belirtildiyse) kayıt altına alınır.',
            'Ödeme yapılmış (lansman sonrası dönemde) ise iade süreci, profesyonelin iptal politikasına ve Kashe&apos;nin o tarihteki kurallarına göre işler.',
          ]}
        />
        <p>
          Profesyonelin tek taraflı, makul gerekçesiz veya tekrarlanan iptalleri
          hesap performansını etkileyebilir; ciddi durumlarda hesap askıya
          alınabilir.
        </p>
      </LegalSection>

      <LegalSection number="09" title="Ücretlendirme">
        <p>
          Bu metnin yürürlüğe girdiği tarihte Kashe platformu üzerinden
          kayıt, profil oluşturma, mesajlaşma, teklif alma/verme, rezervasyon
          ve değerlendirme işlemleri <strong className="text-ink">ücretsizdir</strong>.
        </p>
        <p>İlerleyen dönemde Kashe:</p>
        <LegalList
          items={[
            'Platform üzerinden gerçekleşen işlemlerden komisyon almaya,',
            'Profesyoneller ve ajanslar için premium üyelik paketleri sunmaya,',
            'İlan ve profil öne çıkarma gibi ek hizmetler ücretlendirmeye',
          ]}
        />
        <p>
          başlayabilir. Bu tür değişiklikler kullanıcılara önceden e-posta ve
          platform içi bildirim yoluyla duyurulur. Değişikliklere itirazın
          varsa, yürürlük tarihinden önce hesabını kapatma hakkına sahipsin.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Yorum ve Puanlama">
        <p>
          Tamamlanmış bir rezervasyon sonrasında müşteri, profesyoneli
          değerlendirebilir. Yorumların:
        </p>
        <LegalList
          items={[
            'Gerçek ve dürüst deneyimi yansıtması beklenir.',
            'Hakaret, ayrımcılık veya iftira içermemelidir.',
            'Profesyonelin sunmadığı hizmete ilişkin olmamalıdır.',
          ]}
        />
        <p>
          Kashe, bu kurallara aykırı bulduğu yorumları kaldırma hakkını saklı
          tutar. Profesyonel, kendi profilindeki yorumlara yanıt verebilir
          ancak yorumun içeriğini değiştiremez veya doğrudan kaldıramaz.
        </p>
      </LegalSection>

      <LegalSection number="11" title="İçerik Hakları">
        <p>
          Platforma yüklediğin tüm içeriklerin (profil görseli, portföy,
          biyografi, mesajlar, yorumlar vb.) telif hakları sana aittir.
          Ancak, içeriklerini Kashe&apos;de görünür kılmak amacıyla,{' '}
          <em>platformda yayınlanması için gerekli olduğu ölçüde</em>,
          Kashe&apos;ye dünya çapında, ücretsiz, devredilebilir bir kullanım
          lisansı verirsin.
        </p>
        <p>
          Hesabını kapattığında bu lisans, hizmetin sürdürülmesi için zorunlu
          olmadığı sürece sona erer; ancak diğer kullanıcılar tarafından
          görülmüş yorum/puanlamalar ve uyuşmazlık yönetimi için gerekli
          işlem kayıtları saklanabilir.
        </p>
      </LegalSection>

      <LegalSection number="12" title="Sorumluluk Sınırlamaları">
        <p>
          Kashe, yasal olarak izin verilen en geniş ölçüde, aşağıdakilerden
          sorumlu tutulamaz:
        </p>
        <LegalList
          items={[
            'Profesyonel veya müşterinin platform dışında kendi aralarında yaptığı anlaşmalardan doğan uyuşmazlıklar.',
            'Profesyonelin sunduğu hizmetin kalitesi, zamanlaması veya sonucu.',
            'Hizmet sırasında üçüncü kişilere verilebilecek zararlar.',
            'Kullanıcı tarafından yüklenen içeriklerin doğruluğu, telif uygunluğu veya yasallığı.',
            'Mücbir sebep, doğal afet, internet altyapısı kesintisi gibi Kashe&apos;nin kontrolü dışındaki olaylar sebebiyle ortaya çıkan kesintiler.',
          ]}
        />
        <p>
          Yine de Kashe, kullanıcı güvenliği ve hizmet kalitesini artırmak
          için sürekli geliştirme yapar; bildirilen şikayetleri makul süre
          içinde değerlendirir.
        </p>
      </LegalSection>

      <LegalSection number="13" title="Fikri Mülkiyet">
        <p>
          Kashe markası, logosu, arayüz tasarımı, &ldquo;Doğru Yetenekler,
          Unutulmaz Etkinlikler&rdquo; sloganı ve platforma ait yazılım kodu,
          Kashe&apos;nin fikri mülkiyetidir. Yazılı izin olmaksızın
          çoğaltılamaz, dağıtılamaz veya türetilmiş eser olarak kullanılamaz.
        </p>
      </LegalSection>

      <LegalSection number="14" title="Hesabın Askıya Alınması veya Kapatılması">
        <p>Kashe; aşağıdaki durumlarda hesabını uyarısız askıya alabilir veya kapatabilir:</p>
        <LegalList
          items={[
            'Bu Koşullar veya Gizlilik Politikası&apos;na ciddi şekilde aykırı davranış.',
            'Sahte profil, başkasına ait kimlik veya yanıltıcı bilgi kullanımı.',
            'Diğer kullanıcılara yönelik tekrarlanan şikayetler veya uygunsuz davranış.',
            'Yasal düzenlemelere aykırılık veya mahkeme/kurum talebi.',
          ]}
        />
        <p>
          Kullanıcı, dilediği zaman hesabını kapatma talebi gönderebilir; bu
          durumda Gizlilik Politikası&apos;ndaki saklama süreleri çerçevesinde
          işlem yapılır.
        </p>
      </LegalSection>

      <LegalSection number="15" title="Değişiklikler">
        <p>
          Kashe, bu Kullanım Koşulları&apos;nı zaman zaman güncelleyebilir.
          Esaslı değişiklikler kullanıcılara önceden bildirilir. Değişiklik
          sonrası platformu kullanmaya devam etmen güncel koşulları kabul
          ettiğin anlamına gelir. İtirazın varsa hesabını kapatma hakkına
          sahipsin.
        </p>
      </LegalSection>

      <LegalSection number="16" title="Uygulanacak Hukuk ve Yetkili Mahkeme">
        <p>
          Bu Koşullar&apos;a ilişkin tüm uyuşmazlıklarda Türkiye Cumhuriyeti
          hukuku uygulanır. Taraflar, uyuşmazlıkların çözümünde öncelikle iyi
          niyetli görüşme yolunu denemeyi kabul eder. Çözümlenemeyen
          uyuşmazlıklarda İstanbul (Çağlayan) Mahkemeleri ve İcra Daireleri
          yetkilidir.
        </p>
      </LegalSection>

      <LegalSection number="17" title="İletişim">
        <p>
          Bu metin veya platformun kullanımı hakkında soru, geri bildirim
          veya şikayetin için:
        </p>
        <p className="bg-paper-2/50 border border-line rounded-xl p-4 mt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 block mb-1">
            E-posta
          </span>
          <a
            href={`mailto:${LEGAL_CONTACT.general}`}
            className="text-ink font-medium hover:text-terracotta transition-colors"
          >
            {LEGAL_CONTACT.general}
          </a>
          {LEGAL_CONTACT.isTemporaryEmail && (
            <span className="block mt-2 text-[12px] text-ink-50 italic">
              Bu adres geçicidir; kashe.app domain&apos;i alındıktan sonra
              kalıcı iletişim adresine güncellenecektir.
            </span>
          )}
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
