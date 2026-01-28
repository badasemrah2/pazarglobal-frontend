import { motion } from 'framer-motion';

const siteAIFeatures = [
  {
    icon: 'ri-magic-line',
    title: 'AI Destekli İlan Oluşturma',
    description: 'Başlık, açıklama ve kategori için akıllı önerilerle ilanınızı daha hızlı hazırlayın.',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: 'ri-mic-line',
    title: 'Sesli Asistan (Web)',
    description: 'Web chat üzerinden sesli konuşun; ses metne çevrilir, yanıtlar tekrar seslendirilebilir.',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: 'ri-search-eye-line',
    title: 'Akıllı Ürün Arama',
    description: 'Doğal dille arama yapın ve aradığınız ürüne daha hızlı ulaşın.',
    color: 'from-green-500 to-emerald-500'
  },
  {
    icon: 'ri-price-tag-3-line',
    title: 'Piyasa Fiyat Araştırması',
    description: 'AI ile güncel piyasa fiyatlarını araştırın ve fiyat aralığı hakkında fikir edinin.',
    color: 'from-orange-500 to-red-500'
  },
  {
    icon: 'ri-check-line',
    title: 'İlan Yönetimi',
    description: 'İlanlarınızı yayınlama ve silme gibi temel işlemleri AI ile yönetin.',
    color: 'from-indigo-500 to-purple-500'
  },
  {
    icon: 'ri-chat-3-line',
    title: 'WebChat Desteği',
    description: 'Site içi sohbet üzerinden hızlı yardım ve yönlendirme alın.',
    color: 'from-cyan-500 to-blue-500'
  }
];

export default function SiteAI() {
  return (
    <section className="py-24 bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
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
          <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 px-6 py-3 rounded-full mb-6 shadow-lg">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <i className="ri-sparkling-2-fill text-white text-xl" />
            </div>
            <span className="text-sm font-semibold text-white">Site AI Asistan</span>
          </div>

          <h2 className="text-5xl lg:text-6xl font-display font-bold text-gray-900 mb-6 leading-tight">
            Site Üzerinde Yapay Zeka ile
            <br />
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              Daha Kolay İlan Yönetimi
            </span>
          </h2>

          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Web sitemizdeki AI asistan, ilan oluşturma ve arama süreçlerinde pratik destek sunar.
          </p>
        </motion.div>

        {/* Comparison Banner */}
        <motion.div
          className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-2xl p-8 mb-16 text-center shadow-xl"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="text-white">
              <div className="text-sm font-semibold mb-2 opacity-90">WhatsApp AI</div>
              <div className="text-3xl font-bold">Temel İşlemler</div>
            </div>
            
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <i className="ri-arrow-right-line text-white text-3xl" />
            </div>

            <div className="text-white">
              <div className="text-sm font-semibold mb-2 opacity-90">Site AI</div>
              <div className="text-3xl font-bold">Daha Geniş Kontrol</div>
            </div>
          </div>
          
          <p className="text-white/90 mt-6 text-lg">
            Site üzerinde ilan oluşturma ve arama için daha kapsamlı bir deneyim sunar.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {siteAIFeatures.map((feature, index) => (
            <motion.div
              key={index}
              className="bg-white rounded-2xl p-6 hover:shadow-2xl transition-all duration-300 group cursor-pointer border border-gray-100"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -8 }}
            >
              <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                <i className={`${feature.icon} text-white text-2xl`} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA Section */}
        <motion.div
          className="bg-gradient-to-br from-gray-900 via-slate-800 to-zinc-900 rounded-3xl p-12 text-center shadow-2xl relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl" />
          </div>

          <div className="max-w-3xl mx-auto relative z-10">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-sparkling-2-fill text-white text-4xl" />
            </div>
            
            <h3 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Site AI Asistanını Şimdi Deneyin
            </h3>
            
            <p className="text-lg text-gray-300 mb-8">
              Sağ alttaki chat butonuna tıklayın ve yapay zeka asistanımızın gücünü keşfedin!
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="px-8 py-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-full hover:shadow-2xl hover:scale-105 transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer">
                <i className="ri-chat-3-line text-2xl" />
                <span>AI Chat'i Aç</span>
              </button>
              
              <button className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-full hover:bg-white/20 transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer border border-white/20">
                <i className="ri-play-circle-line text-xl" />
                <span>Demo İzle</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mt-12">
          {[
            { value: 'WebChat', label: 'Site içi sohbet' },
            { value: 'AI Yardım', label: 'Başlık ve açıklama' },
            { value: 'Doğal Dil', label: 'Arama desteği' },
            { value: 'İlan', label: 'Yayınla / Sil' }
          ].map((stat, index) => (
            <motion.div
              key={index}
              className="bg-white/60 backdrop-blur-sm rounded-xl p-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
