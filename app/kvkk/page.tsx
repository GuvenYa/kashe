import { TopNav } from "@/app/components/sections/top-nav";

export const metadata = {
  title: "KVKK Aydınlatma Metni — Kashe",
};

export default function KvkkPage() {
  return (
    <>
      <TopNav />
      <main className="min-h-[60vh] bg-paper px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto kashe-prose">
          <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight mb-2">
            KVKK Aydınlatma Metni
          </h1>
          <p className="text-sm text-ink-72 mb-8">
            Son güncelleme: Haziran 2026
          </p>

          <p>
            İşbu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması
            Kanunu (&ldquo;KVKK&rdquo;) kapsamında, Kashe platformu
            (&ldquo;Kashe&rdquo;, &ldquo;Platform&rdquo;) tarafından kişisel
            verilerinizin hangi amaçlarla işlendiği, kimlere aktarılabileceği ve
            sahip olduğunuz haklar konusunda sizi bilgilendirmek amacıyla
            hazırlanmıştır.
          </p>

          <h2>1. Veri Sorumlusu</h2>
          <p>
            Kişisel verileriniz, veri sorumlusu sıfatıyla Kashe tarafından, bu
            metinde açıklanan kapsam ve amaçlarla işlenmektedir. Kashe, hizmet
            alan kullanıcılar ile hizmet sağlayıcı profesyonelleri ve ajansları
            bir araya getiren aracı bir dijital platform olarak faaliyet
            gösterir. Sorularınız için{" "}
            <a href="mailto:kasheofficial@gmail.com">
              kasheofficial@gmail.com
            </a>{" "}
            adresinden bize ulaşabilirsiniz.
          </p>

          <h2>2. İşlenen Kişisel Veriler</h2>
          <p>
            Platformu kullanımınıza bağlı olarak aşağıdaki veri kategorileri
            işlenebilir:
          </p>
          <ul>
            <li>
              <strong>Kimlik ve iletişim verileri:</strong> ad soyad, e-posta
              adresi, telefon numarası, şehir bilgisi.
            </li>
            <li>
              <strong>Profil ve içerik verileri:</strong> profil açıklaması,
              portföy görselleri/videoları, hizmet ve paket bilgileri, kategori
              ve fiyat tercihleri.
            </li>
            <li>
              <strong>İşlem verileri:</strong> ilanlar, başvurular, teklif ve
              rezervasyon talepleri, mesajlaşma içerikleri, değerlendirme ve
              puanlamalar.
            </li>
            <li>
              <strong>Kullanım verileri:</strong> platforma erişim kayıtları,
              oturum bilgileri ve hizmetin işleyişi için gerekli teknik veriler.
            </li>
          </ul>

          <h2>3. Kişisel Verilerin İşlenme Amaçları</h2>
          <ul>
            <li>Üyelik kaydının oluşturulması ve hesabın yönetilmesi,</li>
            <li>
              Hizmet alan kullanıcılar ile profesyoneller arasında iletişim,
              teklif, rezervasyon ve eşleşme süreçlerinin yürütülmesi,
            </li>
            <li>
              Platform güvenliğinin sağlanması, kötüye kullanımın ve
              dolandırıcılığın önlenmesi,
            </li>
            <li>Yasal yükümlülüklerin yerine getirilmesi,</li>
            <li>
              Kullanıcı deneyiminin iyileştirilmesi ve hizmet kalitesinin
              artırılması.
            </li>
          </ul>

          <h2>4. Kişisel Verilerin Aktarılması</h2>
          <p>
            Kişisel verileriniz, hizmetin gereği olarak ilgili diğer kullanıcıya
            (örneğin teklif gönderdiğiniz profesyonele veya başvurduğunuz ilan
            sahibine) sınırlı ölçüde görünür kılınabilir. Bunun dışında
            verileriniz; barındırma, e-posta gönderimi ve teknik altyapı
            hizmeti aldığımız tedarikçilerle, yalnızca hizmetin sağlanması için
            gerekli olduğu ölçüde ve sözleşmesel gizlilik yükümlülükleri
            altında paylaşılabilir. Yasal olarak yetkili kamu kurumlarının
            talepleri doğrultusunda mevzuatın gerektirdiği aktarımlar yapılır.
          </p>

          <h2>5. Kişisel Verilerin Toplanma Yöntemi ve Hukuki Sebebi</h2>
          <p>
            Kişisel verileriniz, platforma üye olmanız, profil oluşturmanız ve
            platformu kullanmanız sırasında elektronik ortamda toplanır.
            Verileriniz; sözleşmenin kurulması ve ifası, hukuki yükümlülüklerin
            yerine getirilmesi, meşru menfaat ve gerekli hallerde açık rızanız
            hukuki sebeplerine dayanılarak işlenir.
          </p>

          <h2>6. KVKK Kapsamındaki Haklarınız</h2>
          <p>
            KVKK&rsquo;nın 11. maddesi uyarınca; kişisel verilerinizin işlenip
            işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme,
            işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,
            eksik veya yanlış işlenmiş verilerin düzeltilmesini, ilgili mevzuata
            uygun olarak silinmesini veya yok edilmesini isteme ve işlenen
            verilerin münhasıran otomatik sistemler ile analiz edilmesi
            sonucunda aleyhinize bir sonucun ortaya çıkmasına itiraz etme
            haklarına sahipsiniz.
          </p>
          <p>
            Bu haklarınızı kullanmak için{" "}
            <a href="mailto:kasheofficial@gmail.com">
              kasheofficial@gmail.com
            </a>{" "}
            adresine başvurabilirsiniz. Talepleriniz, mevzuatta öngörülen
            süreler içinde sonuçlandırılır.
          </p>

          <h2>7. Değişiklikler</h2>
          <p>
            Kashe, işbu aydınlatma metnini mevzuattaki değişiklikler veya
            hizmetlerdeki güncellemeler doğrultusunda zaman zaman
            güncelleyebilir. Güncel metin her zaman bu sayfada yayımlanır.
          </p>

          <p className="text-sm text-ink-72 mt-8 border-t border-line pt-6">
            Bu metin genel bilgilendirme amaçlıdır ve hukuki danışmanlık yerine
            geçmez. Nihai metnin yürürlüğe girmeden önce bir hukuk uzmanı
            tarafından gözden geçirilmesi önerilir.
          </p>
        </div>
      </main>
    </>
  );
}