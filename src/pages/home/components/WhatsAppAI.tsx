import { motion } from 'framer-motion';

const TWILIO_WHATSAPP_NUMBER = '14155238886';
const TWILIO_WHATSAPP_E164 = '+14155238886';
const TWILIO_SANDBOX_JOIN = 'wrong-nice';
const WHATSAPP_QUICK_LINK = `https://wa.me/${TWILIO_WHATSAPP_NUMBER}?text=${encodeURIComponent(`join ${TWILIO_SANDBOX_JOIN}`)}`;

const whatsappFeatures = [
  {
    icon: 'ri-advertisement-line',
    title: 'WhatsApp\'tan İlan Ver',
    description: 'Fotoğraf gönderin veya yazın. AI ilan taslağınızı hızlıca oluşturur.'
  },
  {
    icon: 'ri-search-eye-line',
    title: 'İlan Arama',
    description: 'WhatsApp üzerinden arama yapın, uygun ilanları hızlıca bulun.'
  },
  {
    icon: 'ri-upload-cloud-2-line',
    title: 'Fotoğrafla İlan',
    description: 'Ürün fotoğrafı gönderin, ilan oluşturma sürecini kolayca başlatın.'
  },
  {
    icon: 'ri-price-tag-3-line',
    title: 'Piyasa Fiyat Araştırması',
    description: 'AI ile güncel piyasa fiyatlarını araştırın ve fiyat aralığı hakkında fikir edinin.'
  },
  {
    icon: 'ri-check-double-line',
    title: 'Yayınla / Sil',
    description: 'İlanlarınızı WhatsApp üzerinden yayınlayın veya kaldırın.'
  },
  {
    icon: 'ri-customer-service-2-line',
    title: '7/24 Destek',
    description: 'WhatsApp üzerinden istediğiniz zaman AI asistanımızla iletişime geçin.'
  }
];

export default function WhatsAppAI() {
  return (
    <section className="py-24 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 w-72 h-72 bg-green-400 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-emerald-400 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center space-x-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full mb-6 shadow-lg">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <i className="ri-whatsapp-line text-white text-xl" />
            </div>
            <span className="text-sm font-semibold text-gray-700">WhatsApp AI Asistan</span>
          </div>

          <h2 className="text-5xl lg:text-6xl font-display font-bold text-gray-900 mb-6 leading-tight">
            WhatsApp'tan Yapay Zeka ile
            <br />
            <span className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Her Şeyi Yönetin
            </span>
          </h2>

          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Twilio entegrasyonu ile WhatsApp üzerinden çalışan yapay zeka asistanımız, 
            ilan oluşturma, ilan arama ve temel yönetim işlemleri için 7/24 yanınızda.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {whatsappFeatures.map((feature, index) => (
            <motion.div
              key={index}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 hover:shadow-xl transition-all duration-300 group cursor-pointer border border-green-100"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <i className={`${feature.icon} text-white text-2xl`} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-3xl p-12 text-center shadow-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="max-w-3xl mx-auto">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-whatsapp-fill text-white text-4xl" />
            </div>
            
            <h3 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              WhatsApp AI Asistanını Hemen Başlat
            </h3>
            
            <p className="text-lg text-white/90 mb-8">
              Telefon numaranızı kaydedin, WhatsApp'tan "Merhaba" yazın ve yapay zeka asistanınız aktif olsun!
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={WHATSAPP_QUICK_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-white text-green-600 font-semibold rounded-full hover:shadow-2xl hover:scale-105 transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-whatsapp-line text-2xl" />
                <span>WhatsApp'a Bağlan</span>
              </a>
              
              <a
                href="#twilio-sandbox-kullanim"
                className="px-8 py-4 bg-white/20 backdrop-blur-sm text-white font-semibold rounded-full hover:bg-white/30 transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer border border-white/30"
              >
                <i className="ri-question-line text-xl" />
                <span>Nasıl Çalışır?</span>
              </a>
            </div>

            <div id="twilio-sandbox-kullanim" className="mt-8 text-left bg-black/20 border border-white/20 rounded-2xl p-5 md:p-6">
              <p className="text-sm md:text-base font-semibold text-white mb-3">
                Twilio Sandbox Kullanim Talimati
              </p>
              <p className="text-sm text-white/90 leading-relaxed mb-4">
                Twilio Sandbox: Numaraniz sandbox'a bagli degilse once <span className="font-semibold">join {TWILIO_SANDBOX_JOIN}</span> gondererek baglanmalisiniz.
                Uyelik 72 saat surer.
              </p>

              <div className="space-y-2 text-sm font-mono text-white/95 bg-black/25 rounded-xl p-4">
                <p>20:04</p>
                <p>{`join ${TWILIO_SANDBOX_JOIN}`}</p>
                <p>20:04 ✓✓</p>
                <p>{`Twilio Sandbox: Hazirsiniz! Sandbox artik whatsapp:${TWILIO_WHATSAPP_E164} ile mesaj gonderip alabilir. Cikmak icin stop yazin.`}</p>
                <p>20:04</p>
                <p>Selam</p>
                <p>20:04 ✓✓</p>
                <p>
                  Selam! Pazarglobal'e hos geldiniz!<br />
                  Urun satmak istiyorsaniz urununuzu yazin veya fotograf gonderin.<br />
                  Urun aramak istiyorsaniz ne aradiginizi yazin.
                </p>
              </div>

              <p className="text-xs text-white/80 mt-4">
                Hizli baslangic: WhatsApp'a Baglan butonuna bastiginizda dogrudan Twilio numarasina yonlendirilirsiniz.
              </p>
            </div>

            <p className="text-sm text-white/80 mt-6">
              <i className="ri-shield-check-line mr-2" />
              Güvenli Twilio altyapısı • Verileriniz şifrelenir
            </p>
          </div>
        </motion.div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <motion.div
            className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-3xl font-bold text-green-600 mb-2">Anında</div>
            <p className="text-sm text-gray-600">Mesaj gönder, saniyeler içinde yanıt al</p>
          </motion.div>

          <motion.div
            className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <div className="text-3xl font-bold text-emerald-600 mb-2">7/24</div>
            <p className="text-sm text-gray-600">Gece gündüz her zaman aktif</p>
          </motion.div>

          <motion.div
            className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <div className="text-3xl font-bold text-teal-600 mb-2">Kolay</div>
            <p className="text-sm text-gray-600">WhatsApp üzerinden hızlı ve pratik kullanım</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
