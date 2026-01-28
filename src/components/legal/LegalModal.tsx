import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms' | 'kvkk';
}

export default function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const getTitle = () => {
    switch (type) {
      case 'privacy':
        return 'Gizlilik Politikası';
      case 'terms':
        return 'Kullanım Koşulları';
      case 'kvkk':
        return 'KVKK Aydınlatma Metni';
      default:
        return '';
    }
  };

  const getContent = () => {
    switch (type) {
      case 'privacy':
        return (
          <div className="space-y-6">
            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">1. Giriş</h3>
              <p className="text-gray-700 leading-relaxed">
                PazarGlobal olarak, kullanıcılarımızın gizliliğine büyük önem veriyoruz. Bu Gizlilik Politikası, 
                platformumuz üzerinden topladığımız kişisel verilerin nasıl kullanıldığını, saklandığını ve 
                korunduğunu açıklamaktadır.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">2. Toplanan Bilgiler</h3>
              <p className="text-gray-700 leading-relaxed mb-3">
                Platformumuz üzerinden aşağıdaki bilgiler toplanabilir:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Ad, soyad ve iletişim bilgileri (e-posta, telefon)</li>
                <li>WhatsApp iletişim bilgileri (ilan verme için)</li>
                <li>Oluşturulan ilan bilgileri ve görseller</li>
                <li>Kullanıcı etkileşim verileri (görüntüleme, arama geçmişi)</li>
                <li>IP adresi ve cihaz bilgileri</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">3. Verilerin Kullanımı</h3>
              <p className="text-gray-700 leading-relaxed mb-3">
                Toplanan veriler şu amaçlarla kullanılır:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Platform hizmetlerinin sunulması ve iyileştirilmesi</li>
                <li>İlan oluşturma ve yayınlama işlemlerinin gerçekleştirilmesi</li>
                <li>AI destekli öneri ve fiyat araştırması hizmetlerinin sağlanması</li>
                <li>Kullanıcı destek hizmetlerinin verilmesi</li>
                <li>Güvenlik ve dolandırıcılık önleme faaliyetleri</li>
                <li>Yasal yükümlülüklerin yerine getirilmesi</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">4. Veri Güvenliği</h3>
              <p className="text-gray-700 leading-relaxed">
                Kişisel verileriniz, endüstri standardı güvenlik önlemleriyle korunmaktadır. Verilerinize 
                yetkisiz erişim, değiştirme veya ifşa edilmesini önlemek için teknik ve idari tedbirler 
                alınmıştır. Tüm veriler şifrelenmiş bağlantılar üzerinden iletilir ve güvenli sunucularda 
                saklanır.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">5. Üçüncü Taraf Paylaşımı</h3>
              <p className="text-gray-700 leading-relaxed">
                Kişisel verileriniz, açık rızanız olmadan üçüncü taraflarla paylaşılmaz. Sadece hizmet 
                sağlayıcılarımız (bulut altyapı, ödeme sistemleri, AI servisleri) ile sınırlı ve gerekli 
                ölçüde paylaşım yapılır. Bu sağlayıcılar da veri koruma yükümlülükleri altındadır.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">6. Çerezler (Cookies)</h3>
              <p className="text-gray-700 leading-relaxed">
                Platformumuz, kullanıcı deneyimini iyileştirmek için çerezler kullanmaktadır. Çerezler, 
                oturum bilgilerini saklamak, tercihlerinizi hatırlamak ve platform performansını analiz 
                etmek için kullanılır. Tarayıcı ayarlarınızdan çerezleri reddedebilirsiniz.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">7. Kullanıcı Hakları</h3>
              <p className="text-gray-700 leading-relaxed mb-3">
                KVKK kapsamında şu haklara sahipsiniz:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
                <li>İşlenmişse bilgi talep etme</li>
                <li>Verilerin işlenme amacını öğrenme</li>
                <li>Yurt içi/dışı aktarım bilgilerini talep etme</li>
                <li>Verilerin düzeltilmesini isteme</li>
                <li>Verilerin silinmesini veya yok edilmesini talep etme</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">8. İletişim</h3>
              <p className="text-gray-700 leading-relaxed">
                Gizlilik politikamız hakkında sorularınız için: <strong>destek@pazarglobal.com</strong>
              </p>
            </section>

            <section>
              <p className="text-sm text-gray-500 italic">
                Son Güncelleme: 28 Ocak 2026
              </p>
            </section>
          </div>
        );

      case 'terms':
        return (
          <div className="space-y-6">
            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">1. Hizmet Kapsamı</h3>
              <p className="text-gray-700 leading-relaxed">
                PazarGlobal, kullanıcıların yapay zeka destekli teknoloji ile hızlı ve kolay bir şekilde 
                ilan oluşturmasını, yayınlamasını ve arama yapmasını sağlayan bir online platformdur. 
                Platform, WhatsApp entegrasyonu ve web tabanlı arayüz üzerinden hizmet vermektedir.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">2. Kullanıcı Yükümlülükleri</h3>
              <p className="text-gray-700 leading-relaxed mb-3">
                Platformu kullanarak aşağıdaki koşulları kabul etmiş sayılırsınız:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>18 yaşından büyük olduğunuzu beyan edersiniz</li>
                <li>Verdiğiniz bilgilerin doğru ve güncel olmasından sorumlusunuz</li>
                <li>Yasalara aykırı içerik paylaşmayacağınızı taahhüt edersiniz</li>
                <li>Hesap güvenliğinden ve şifrenizden siz sorumlusunuz</li>
                <li>Platformu kötüye kullanmayacağınızı kabul edersiniz</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">3. İlan Kuralları</h3>
              <p className="text-gray-700 leading-relaxed mb-3">
                İlan yayınlarken aşağıdaki kurallara uymanız gerekmektedir:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Yasadışı ürün veya hizmet ilanı vermek yasaktır</li>
                <li>Yanıltıcı, sahte veya aldatıcı bilgi içeren ilanlar kabul edilmez</li>
                <li>Telif hakkı ihlali yapan içerikler yayınlanamaz</li>
                <li>Müstehcen, tehditkar veya nefret söylemi içeren ilanlar yasaktır</li>
                <li>Aynı ilanı tekrarlı olarak yayınlamak (spam) yasaktır</li>
                <li>Başkasının fotoğraflarını izinsiz kullanmak yasaktır</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">4. Ücretlendirme ve Ödemeler</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                PazarGlobal, temel hizmetleri ücretsiz olarak sunarken, Premium üyelik paketleri ücretlidir. 
                Premium üyelik avantajları: öncelikli listeleme, premium rozet, öne çıkan ilanlar, hediye 
                kredi ve özel destek. Ödemeler güvenli ödeme altyapısı üzerinden gerçekleştirilir. İptal ve 
                iade politikaları hakkında detaylı bilgi için destek ekibimizle iletişime geçebilirsiniz.
              </p>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">Kredi Sistemi</h4>
                <p className="text-gray-700 leading-relaxed mb-2">
                  Yapay zeka ile ilan yayınlama işlemleri <strong>kredi sistemine</strong> tabidir. Her ilan 
                  yayınlama işlemi için belirli miktarda kredi harcanır. Kredi paketleri platformumuz üzerinden 
                  satın alınabilir.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Kredi fiyatları, yıllık olarak veya platformun gerekli gördüğü zamanlarda enflasyon oranına 
                  göre güncellenebilir. Herhangi bir fiyat değişikliği öncesinde kullanıcılar, <strong>profil 
                  bölümündeki fiyatlandırma sayfasından</strong> güncel bilgilere ulaşabilirler. Değişiklikler 
                  platform üzerinden duyurulacaktır.
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">5. Fikri Mülkiyet Hakları</h3>
              <p className="text-gray-700 leading-relaxed">
                Platform üzerindeki tüm içerik, tasarım, logo, yazılım ve ticari markalar PazarGlobal'e 
                aittir ve telif hakkı yasalarıyla korunmaktadır. Kullanıcılar, yükledikleri içeriklerin 
                haklarına sahip olduklarını veya kullanım izni aldıklarını beyan ederler.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">6. Sorumluluk Sınırlaması</h3>
              <p className="text-gray-700 leading-relaxed">
                PazarGlobal, platformda yer alan ilanların doğruluğundan, kullanıcılar arası işlemlerden 
                veya ürün/hizmet kalitesinden sorumlu değildir. Platform, aracı bir hizmet sağlar ve 
                kullanıcılar kendi sorumluluklarında işlem yaparlar. Kullanıcılar arası anlaşmazlıklar 
                doğrudan taraflar arasında çözülmelidir.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">7. Hesap Kapatma ve Askıya Alma</h3>
              <p className="text-gray-700 leading-relaxed">
                PazarGlobal, kullanım koşullarını ihlal eden kullanıcıların hesaplarını uyarı vermeksizin 
                askıya alma veya tamamen kapatma hakkını saklı tutar. Kullanıcılar, hesaplarını istedikleri 
                zaman kapatabilirler.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">8. Değişiklikler</h3>
              <p className="text-gray-700 leading-relaxed">
                PazarGlobal, kullanım koşullarını önceden haber vermeksizin değiştirme hakkına sahiptir. 
                Değişiklikler platform üzerinde yayınlandığı anda yürürlüğe girer. Kullanıcıların düzenli 
                olarak bu sayfayı kontrol etmeleri önerilir.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">9. Uygulanacak Hukuk</h3>
              <p className="text-gray-700 leading-relaxed">
                Bu kullanım koşulları Türkiye Cumhuriyeti yasalarına tabidir. Ortaya çıkabilecek 
                anlaşmazlıklarda Türkiye mahkemeleri yetkilidir.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">10. İletişim</h3>
              <p className="text-gray-700 leading-relaxed">
                Kullanım koşulları hakkında sorularınız için: <strong>destek@pazarglobal.com</strong>
              </p>
            </section>

            <section>
              <p className="text-sm text-gray-500 italic">
                Son Güncelleme: 28 Ocak 2026
              </p>
            </section>
          </div>
        );

      case 'kvkk':
        return (
          <div className="space-y-6">
            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Veri Sorumlusu</h3>
              <p className="text-gray-700 leading-relaxed">
                <strong>PazarGlobal</strong>, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") 
                uyarınca veri sorumlusu sıfatıyla, kişisel verilerinizin işlenmesi, saklanması ve 
                korunması konusunda sizi bilgilendirmek isteriz.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">1. İşlenen Kişisel Veriler</h3>
              <p className="text-gray-700 leading-relaxed mb-3">
                Platformumuz üzerinden aşağıdaki kişisel verileriniz işlenebilir:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li><strong>Kimlik Bilgileri:</strong> Ad, soyad, doğum tarihi</li>
                <li><strong>İletişim Bilgileri:</strong> E-posta adresi, telefon numarası, WhatsApp numarası</li>
                <li><strong>Konum Bilgileri:</strong> Şehir, ilçe (ilan vermek için)</li>
                <li><strong>İşlem Güvenliği Bilgileri:</strong> IP adresi, cihaz bilgileri, çerez kayıtları</li>
                <li><strong>Görsel/İşitsel Veriler:</strong> Ürün fotoğrafları, profil görselleri</li>
                <li><strong>İşlem Bilgileri:</strong> İlan geçmişi, arama kayıtları, satın alma geçmişi</li>
                <li><strong>Finansal Bilgiler:</strong> Ödeme bilgileri (üçüncü taraf ödeme sağlayıcısı üzerinden)</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">2. Kişisel Verilerin İşlenme Amaçları</h3>
              <p className="text-gray-700 leading-relaxed mb-3">
                Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Platform üyelik ve hesap yönetimi işlemlerinin gerçekleştirilmesi</li>
                <li>İlan oluşturma, yayınlama ve arama hizmetlerinin sunulması</li>
                <li>AI destekli içerik oluşturma ve fiyat araştırma hizmetlerinin sağlanması</li>
                <li>WhatsApp entegrasyonu üzerinden iletişim ve hizmet sunumu</li>
                <li>Kullanıcı destek hizmetlerinin verilmesi</li>
                <li>Ödeme işlemlerinin gerçekleştirilmesi ve faturalandırma</li>
                <li>Platform güvenliğinin sağlanması ve dolandırıcılık önleme</li>
                <li>Kullanıcı deneyiminin iyileştirilmesi ve kişiselleştirilmesi</li>
                <li>Yasal yükümlülüklerin yerine getirilmesi</li>
                <li>İstatistiksel analiz ve raporlama</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">3. Kişisel Verilerin Aktarılması</h3>
              <p className="text-gray-700 leading-relaxed mb-3">
                Kişisel verileriniz, yukarıda belirtilen amaçlarla ve KVKK'nın öngördüğü şartlara uygun 
                olarak aşağıdaki taraflara aktarılabilir:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Bulut altyapı hizmet sağlayıcıları (Supabase, Railway)</li>
                <li>AI hizmet sağlayıcıları (OpenAI, Perplexity AI)</li>
                <li>İletişim platformları (Twilio - WhatsApp Business API)</li>
                <li>Ödeme altyapı sağlayıcıları</li>
                <li>Yasal düzenlemeler gereği yetkili kamu kurum ve kuruluşları</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">4. Kişisel Verilerin Toplanma Yöntemi</h3>
              <p className="text-gray-700 leading-relaxed">
                Kişisel verileriniz, platform üzerinden kayıt formları, ilan oluşturma araçları, WhatsApp 
                mesajlaşma, çerezler ve benzeri teknolojiler aracılığıyla otomatik veya otomatik olmayan 
                yöntemlerle toplanmaktadır.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">5. Kişisel Verilerin Saklanma Süresi</h3>
              <p className="text-gray-700 leading-relaxed">
                Kişisel verileriniz, işleme amacının gerektirdiği süre boyunca ve yasal saklama 
                yükümlülüklerine uygun olarak saklanır. Saklama süresinin dolması veya işleme amacının 
                ortadan kalkması halinde verileriniz silinir, yok edilir veya anonim hale getirilir.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">6. KVKK Kapsamında Haklarınız</h3>
              <p className="text-gray-700 leading-relaxed mb-3">
                KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
                <li>Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme</li>
                <li>Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme</li>
                <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
                <li>Kişisel verilerinizin eksik veya yanlış işlenmiş olması halinde düzeltilmesini isteme</li>
                <li>KVKK'da öngörülen şartlar çerçevesinde kişisel verilerinizin silinmesini veya yok edilmesini isteme</li>
                <li>Düzeltme, silme ve yok edilme işlemlerinin kişisel verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme</li>
                <li>İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme</li>
                <li>Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">7. Başvuru Yöntemi</h3>
              <p className="text-gray-700 leading-relaxed mb-3">
                KVKK'dan doğan haklarınızı kullanmak için başvurunuzu aşağıdaki yöntemlerle yapabilirsiniz:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700 mb-2">
                  <strong>E-posta:</strong> kvkk@pazarglobal.com
                </p>
                <p className="text-gray-700 mb-2">
                  <strong>Platform İçi:</strong> Profil ayarlarınızdan "Veri Talebi" formu üzerinden
                </p>
                <p className="text-gray-700">
                  <strong>Yazılı Başvuru:</strong> Noter aracılığıyla veya ıslak imzalı olarak şirket adresimize
                </p>
              </div>
              <p className="text-gray-700 leading-relaxed mt-3">
                Başvurularınız en geç 30 gün içinde ücretsiz olarak sonuçlandırılacaktır. Ancak, işlemin 
                ayrıca bir maliyeti gerektirmesi halinde, Kişisel Verileri Koruma Kurulu tarafından 
                belirlenen tarifedeki ücret alınabilir.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">8. Güvenlik Önlemleri</h3>
              <p className="text-gray-700 leading-relaxed">
                Kişisel verilerinizin güvenliğini sağlamak için idari ve teknik tedbirler alınmıştır. 
                Verileriniz şifrelenmiş kanallar üzerinden iletilir, güvenli sunucularda saklanır ve 
                erişim yetkilendirme sistemleriyle korunur. Düzenli güvenlik denetimleri yapılmaktadır.
              </p>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">9. İletişim Bilgileri</h3>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-gray-700 mb-2">
                  <strong>Veri Sorumlusu:</strong> PazarGlobal
                </p>
                <p className="text-gray-700 mb-2">
                  <strong>E-posta:</strong> kvkk@pazarglobal.com
                </p>
                <p className="text-gray-700">
                  <strong>Destek:</strong> destek@pazarglobal.com
                </p>
              </div>
            </section>

            <section>
              <p className="text-sm text-gray-500 italic">
                Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca hazırlanmıştır.
                <br />
                Son Güncelleme: 28 Ocak 2026
              </p>
            </section>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={onClose}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden my-8"
            >
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 px-8 py-6 flex items-center justify-between z-10">
                <h2 className="text-2xl font-bold text-white">{getTitle()}</h2>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Kapat"
                >
                  <i className="ri-close-line text-2xl text-white" />
                </button>
              </div>

              {/* Content */}
              <div className="px-8 py-6 overflow-y-auto max-h-[calc(85vh-120px)]">
                {getContent()}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 px-8 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all cursor-pointer"
                >
                  Anladım, Kapat
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
