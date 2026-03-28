import { motion } from 'framer-motion';
import { useAuthStore } from '../../../stores/authStore';

const steps = [
  {
    number: '01',
    title: 'Fotoğraf Çek',
    description: 'Ürününüzün fotoğrafını çekin veya galeriden seçin. AI otomatik olarak ürünü tanıyacak.',
    icon: 'ri-camera-line',
    color: 'from-purple-500 to-blue-500',
  },
  {
    number: '02',
    title: 'AI ile Konuş',
    description: 'Sesli veya yazılı olarak ürününüzü anlatın. AI sizin için profesyonel bir ilan metni oluştursun.',
    icon: 'ri-chat-voice-line',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    number: '03',
    title: 'Fiyat Önerisi Al',
    description: 'Piyasa ve platform verilerine göre en uygun fiyat önerisini alın. Hızlı satış garantisi.',
    icon: 'ri-price-tag-3-line',
    color: 'from-cyan-500 to-green-500',
  },
  {
    number: '04',
    title: 'Yayınla',
    description: 'Tek tıkla ilanınızı yayınlayın. Binlerce alıcıya anında ulaşın.',
    icon: 'ri-rocket-line',
    color: 'from-green-500 to-emerald-500',
  },
];

export default function HowItWorks() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  const handleTryNowClick = async () => {
    const isAuthenticated = await checkAuth();
    const targetPath = isAuthenticated ? '/create-listing' : '/auth/login';

    if (window.REACT_APP_NAVIGATE) {
      window.REACT_APP_NAVIGATE(targetPath);
      return;
    }

    window.location.href = targetPath;
  };

  return (
    <section id="how-it-works" className="py-24 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-5xl lg:text-6xl font-display font-bold mb-6">
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Nasıl Çalışır?
            </span>
          </h2>
          <p className="text-xl text-gray-600 font-light">
            4 basit adımda ilanınız hazır
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              className="relative"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-20 left-full w-full h-0.5 bg-gradient-to-r from-gray-300 to-transparent -z-10" />
              )}

              <div className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 h-full">
                {/* Number Badge */}
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} mb-6`}>
                  <span className="text-2xl font-bold text-white">{step.number}</span>
                </div>

                {/* Icon */}
                <div className="mb-6">
                  <i className={`${step.icon} text-5xl bg-gradient-to-br ${step.color} bg-clip-text text-transparent`} />
                </div>

                {/* Content */}
                <h3 className="text-2xl font-display font-bold text-gray-900 mb-4">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <button
            onClick={() => void handleTryNowClick()}
            className="px-10 py-4 bg-gradient-primary text-white font-semibold rounded-full hover:shadow-2xl hover:scale-105 transition-all flex items-center space-x-2 mx-auto whitespace-nowrap cursor-pointer"
          >
            <span>Hemen Dene</span>
            <i className="ri-arrow-right-line text-xl" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}