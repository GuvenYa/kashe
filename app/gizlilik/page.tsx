import {
  LegalPageShell,
  LegalSection,
  LegalSubsection,
  LegalList,
} from '@/app/components/legal-page-shell';
import {
  LEGAL_OPERATOR,
  LEGAL_CONTACT,
  THIRD_PARTY_PROCESSORS,
  MIN_USER_AGE,
} from '@/app/lib/legal-meta';

export const metadata = {
  title: 'Gizlilik Politikası — Kashe',
  description:
    'Kashe gizlilik politikası ve KVKK aydınlatma metni. Kişisel verilerin nasıl işlendiği, kullanıcı hakları ve iletişim bilgileri.',
};

export default function GizlilikPage() {
  return (
    <LegalPageShell
      eyebrow="KVKK · Gizlilik"
      title="Gizlilik Politikası"
      subtitle="Kişisel verilerini nasıl işlediğimizi, neyi koruduğumuzu ve haklarını burada şeffaf şekilde anlatıyoruz."
    >
      <LegalSection number="01" title="Veri Sorumlusu">
        <p>
          Bu Gizlilik Politikası, Kashe platformunu işleten{' '}
          <strong className="text-ink">{LEGAL_OPERATOR.legalEntity}</strong>{' '}
          tarafından (bundan sonra &ldquo;Kashe&rdquo; veya &ldquo;biz&rdquo;
          olarak anılacaktır), 6698 sayılı Kişisel Verilerin Korunması Kanunu
          (&ldquo;KVKK&rdquo;) kapsamında Veri Sorumlusu sıfatıyla
          hazırlanmıştır.
        </p>
        <p>
          Kashe; bireysel ve kurumsal kullanıcıları, etkinlik, eğlence, medya
          ve prodüksiyon alanlarında profesyonel hizmet sağlayıcılar ile
          buluşturan bir <em>aracı dijital pazaryeri platformu</em>dur. Hizmet
          fiilen profesyonel veya ajans tarafından sunulur; Kashe taraflar
          arasında keşif, iletişim, teklif, rezervasyon ve değerlendirme
          süreçlerini kolaylaştırır.
        </p>
      </LegalSection>

      <LegalSection number="02" title="İşlediğimiz Veriler">
        <p>
          Platformu kullanmak için aşağıdaki kişisel verileri işliyoruz. Her
          bir veri kategorisi belirli ve sınırlı bir amaç için kullanılır.
        </p>

        <LegalSubsection title="Kimlik ve iletişim bilgileri">
          <LegalList
            items={[
              { label: 'Ad ve soyad', description: 'Profilinde ve mesajlaşmada görünür.' },
              { label: 'E-posta adresi', description: 'Hesap erişimi ve bildirimler için.' },
              { label: 'Şehir bilgisi', description: 'Hizmet bölgeni ve aramaları doğru sonuçlandırmak için.' },
              { label: 'Profil görseli ve biyografi', description: 'Kullanıcı tarafından isteğe bağlı eklenir.' },
            ]}
          />
        </LegalSubsection>

        <LegalSubsection title="Profesyonel / ajans verileri">
          <LegalList
            items={[
              { label: 'Hizmet kategorisi ve detayları', description: 'Hangi hizmeti sunduğun, çalışma bölgen, fiyat aralığın.' },
              { label: 'Portföy içerikleri', description: 'Senin tarafından yüklenen görsel ve metinler.' },
              { label: 'Firma/ajans adı', description: 'Tüzel kişi olarak kayıtlıysan profil görünür adın.' },
            ]}
          />
        </LegalSubsection>

        <LegalSubsection title="Platform kullanım verileri">
          <LegalList
            items={[
              { label: 'Mesajlaşma içerikleri', description: 'Diğer kullanıcılarla yaptığın yazışmalar; uyuşmazlık durumunda inceleme için saklanır.' },
              { label: 'Teklif ve rezervasyon kayıtları', description: 'Verdiğin/aldığın teklifler, rezervasyon bilgileri.' },
              { label: 'Değerlendirmeler', description: 'Bıraktığın ve aldığın yorum ile puanlamalar.' },
              { label: 'Son aktiflik zamanı', description: 'Platformda en son ne zaman aktif olduğunu gösterir.' },
            ]}
          />
        </LegalSubsection>

        <LegalSubsection title="Teknik veriler">
          <p>
            Hesabını koruma ve hizmeti iyileştirme amacıyla; oturum
            tanımlayıcıları (çerezler dahil), tarayıcı türü, IP adresi ve
            cihaz bilgisi gibi standart teknik veriler işlenir.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection number="03" title="İşleme Amaçlarımız">
        <p>
          Kişisel verilerini aşağıdaki amaçlar dışında kullanmayız:
        </p>
        <LegalList
          items={[
            'Hesabını oluşturmak ve sürdürmek',
            'Sana uygun profesyonelleri/işleri göstermek, arama ve filtreleme yapmana izin vermek',
            'Diğer kullanıcılarla iletişim kurmanı sağlamak (mesajlaşma, teklif, rezervasyon)',
            'İşlemsel e-posta bildirimleri göndermek (yeni mesaj, teklif, rezervasyon onayı vb.)',
            'Platformu kötüye kullanım, dolandırıcılık ve uygunsuz içeriklere karşı korumak',
            'Yasal yükümlülüklerimizi yerine getirmek (vergi, KVKK, mahkeme talepleri vb.)',
            'Platformun teknik altyapısını geliştirmek, hata ayıklamak',
          ]}
        />
      </LegalSection>

      <LegalSection number="04" title="Veri Paylaşımı">
        <p>
          Verilerini, hizmeti sürdürmek için zorunlu olan üçüncü taraf altyapı
          sağlayıcılarımızla paylaşırız. Hiçbir verini reklam veya pazarlama
          amacıyla satmayız.
        </p>

        <LegalSubsection title="Veri işleyicilerimiz">
          <div className="space-y-3 mt-3">
            {THIRD_PARTY_PROCESSORS.map((p) => (
              <div key={p.name} className="bg-paper-2/50 border border-line rounded-xl p-4">
                <p className="font-display font-semibold text-ink text-sm">
                  {p.name}
                </p>
                <p className="text-[13px] text-ink-72 mt-0.5">
                  <span className="font-medium">Amaç:</span> {p.purpose}
                </p>
                <p className="text-[13px] text-ink-72">
                  <span className="font-medium">Lokasyon:</span> {p.location}
                </p>
                <a
                  href={p.privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta hover:underline"
                >
                  Gizlilik politikası →
                </a>
              </div>
            ))}
          </div>
        </LegalSubsection>

        <LegalSubsection title="Yurt dışına aktarım">
          <p>
            Yukarıda belirtilen Resend ve Vercel hizmetleri sebebiyle bazı
            verilerin Amerika Birleşik Devletleri&apos;nde işlenmekte, Supabase
            hizmeti üzerinden ise Avrupa Birliği (Frankfurt) sınırları içinde
            saklanmaktadır. Bu aktarımlar, KVKK madde 9 kapsamında ve
            hizmetin sunulması için gerekli olduğu ölçüde gerçekleştirilir.
          </p>
        </LegalSubsection>

        <LegalSubsection title="Yasal yükümlülük halinde">
          <p>
            Mahkeme kararı, savcılık talebi veya benzeri yasal zorunluluk
            halinde verileri ilgili kuruma iletmek durumundayız. Böyle bir
            durumda, hukuken mümkün olduğu ölçüde seni bilgilendiririz.
          </p>
        </LegalSubsection>
      </LegalSection>

      <LegalSection number="05" title="Saklama Süresi">
        <p>
          Kişisel verilerini, hizmeti sürdürdüğümüz süre boyunca ve sonrasında
          yasal yükümlülüklerin gerektirdiği süre kadar saklarız. Hesabını
          silmek istersen{' '}
          <a
            href={`mailto:${LEGAL_CONTACT.privacy}`}
            className="text-terracotta hover:underline"
          >
            {LEGAL_CONTACT.privacy}
          </a>{' '}
          adresinden bize ulaşabilirsin; talebini en kısa sürede
          değerlendiririz. Bazı veriler vergi, ticaret kanunu ve uyuşmazlık
          yönetimi gibi yasal zorunluluklar sebebiyle daha uzun süre
          saklanabilir.
        </p>
      </LegalSection>

      <LegalSection number="06" title="Çerezler">
        <p>
          Kashe, hizmeti sunmak için zorunlu çerezler (oturum, kimlik
          doğrulama) ve tercihlerinizi hatırlamak için işlevsel çerezler
          kullanır. Şu an için pazarlama veya reklam çerezi kullanmıyoruz.
          Tarayıcı ayarlarından çerezleri kapatabilirsin, ancak bu durumda
          platformun bazı özellikleri çalışmayabilir.
        </p>
      </LegalSection>

      <LegalSection number="07" title="Haklarınız (KVKK Madde 11)">
        <p>
          KVKK kapsamında sahip olduğun haklar şunlardır:
        </p>
        <LegalList
          items={[
            'Kişisel verilerinin işlenip işlenmediğini öğrenmek',
            'İşleniyorsa buna ilişkin bilgi talep etmek',
            'İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenmek',
            'Yurt içi veya yurt dışında verilerin aktarıldığı üçüncü kişileri bilmek',
            'Eksik veya yanlış işlenmiş verilerin düzeltilmesini istemek',
            'KVKK 7. maddede öngörülen şartlar çerçevesinde verilerin silinmesini veya yok edilmesini istemek',
            'Yapılan düzeltme/silme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini istemek',
            'İşlenen verilerin münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhine bir sonucun ortaya çıkmasına itiraz etmek',
            'Verilerin kanuna aykırı işlenmesi sebebiyle zarara uğraman halinde zararın giderilmesini talep etmek',
          ]}
        />
        <p className="mt-4">
          Bu haklarını kullanmak için{' '}
          <a
            href={`mailto:${LEGAL_CONTACT.privacy}`}
            className="text-terracotta hover:underline"
          >
            {LEGAL_CONTACT.privacy}
          </a>{' '}
          adresinden bize yazılı olarak ulaşabilirsin. Talebini, KVKK&apos;da
          belirtilen yasal süreler içinde değerlendirip yanıtlarız.
        </p>
      </LegalSection>

      <LegalSection number="08" title="Çocuklar">
        <p>
          Kashe yalnızca <strong className="text-ink">{MIN_USER_AGE} yaşını doldurmuş</strong>{' '}
          kullanıcılara açıktır. {MIN_USER_AGE} yaşından küçük bir kullanıcının
          hesap açtığını fark edersek hesap askıya alınır ve veriler silinir.
          Bu yaşın altında olduğunu fark eden bir veli, vasi veya kullanıcı
          bizimle iletişime geçerek hesabın kapatılmasını talep edebilir.
        </p>
      </LegalSection>

      <LegalSection number="09" title="Güvenlik">
        <p>
          Kişisel verilerinin güvenliğini sağlamak için sektörde kabul gören
          teknik ve idari önlemleri alıyoruz: şifrelenmiş bağlantı (HTTPS),
          oturum güvenliği, parola hashleme, veri tabanı seviyesinde erişim
          kontrolü (Row Level Security). Bununla birlikte, internet ortamında
          %100 güvenlik garantisi sunmak teknik olarak mümkün değildir;
          olağanüstü bir veri ihlali yaşandığında ilgili mevzuat çerçevesinde
          seni ve Kişisel Verileri Koruma Kurumu&apos;nu en kısa sürede
          bilgilendiririz.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Değişiklikler">
        <p>
          Bu Gizlilik Politikası&apos;nı zaman zaman güncelleyebiliriz. Esaslı
          değişiklikler olduğunda kayıtlı e-posta adresinle veya platform
          içinde bildirim yoluyla seni haberdar ederiz. Güncellemenin yürürlük
          tarihi metnin başındaki &ldquo;Son güncelleme&rdquo; alanından takip
          edilebilir.
        </p>
      </LegalSection>

      <LegalSection number="11" title="İletişim">
        <p>
          Bu metin veya kişisel verilerinin işlenmesi hakkında sorun, görüş
          veya talebin varsa şu adresten bize ulaşabilirsin:
        </p>
        <p className="bg-paper-2/50 border border-line rounded-xl p-4 mt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 block mb-1">
            E-posta
          </span>
          <a
            href={`mailto:${LEGAL_CONTACT.privacy}`}
            className="text-ink font-medium hover:text-terracotta transition-colors"
          >
            {LEGAL_CONTACT.privacy}
          </a>
          {LEGAL_CONTACT.isTemporaryEmail && (
            <span className="block mt-2 text-[12px] text-ink-50 italic">
              Bu adres geçicidir; kashe.app domain&apos;i alındıktan sonra
              kvkk@kashe.app olarak değişecek ve burada güncellenecektir.
            </span>
          )}
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
