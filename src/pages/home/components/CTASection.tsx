import { motion } from 'framer-motion';

const premiumFeatures = [
  'Öncelikli listeleme',
  'Premium rozet',
  'Öne çıkan ilanlar',
  'Hediye kredi',
  'Özel destek',
];

export default function CTASection() {
  return (
    <section id="premium" className="py-24 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-0 bg-white rounded-[3rem] overflow-hidden shadow-2xl">
          {/* Left Visual */}
          <div className="relative bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-600 p-16 flex flex-col justify-center overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
            </div>

            <motion.div
              className="relative z-10"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="text-xs uppercase tracking-wider text-white/80 mb-6 font-semibold">
                Premium'a Geç
              </div>

              <div className="space-y-2">
                <motion.div
                  className="text-6xl lg:text-7xl font-black text-white"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                >
                  DAHA HIZLI
                </motion.div>
                <motion.div
                  className="text-7xl lg:text-8xl font-black text-white"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                >
                  DAHA ÇOK
                </motion.div>
                <motion.div
                  className="text-8xl lg:text-9xl font-black text-white"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                >
                  SATIŞ
                </motion.div>
              </div>

              {/* Floating Phone Mockup */}
              <motion.div
                className="mt-12"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <div className="relative w-48 h-auto">
                  <img
                    src="https://readdy.ai/api/search-image?query=premium%20smartphone%20mockup%20with%20golden%20crown%20badge%20and%20star%20icons%20floating%20around%2C%20luxury%20product%20photography%2C%20purple%20and%20pink%20gradient%20background%2C%203D%20rendered%20premium%20badges%2C%20professional%20tech%20illustration&width=300&height=400&seq=premium-phone-1&orientation=portrait"
                    alt="Premium"
                    className="w-full h-auto rounded-2xl shadow-2xl"
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Right Content */}
          <div className="p-16 flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-gray-900 mb-8 leading-tight">
                Premium Üyelik ile Farkı Yaşa
              </h2>

              {/* Features List */}
              <div className="space-y-5 mb-12">
                {premiumFeatures.map((feature, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center space-x-4"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center">
                      <i className="ri-check-line text-white text-lg" />
                    </div>
                    <span className="text-lg text-gray-700">{feature}</span>
                  </motion.div>
                ))}
              </div>

              {/* CTA Button */}
              <motion.button
                className="w-full py-5 bg-gradient-primary text-white text-lg font-semibold rounded-full hover:shadow-2xl transition-all flex items-center justify-center space-x-3 group whitespace-nowrap cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span>Premium'a Başla</span>
                <i className="ri-arrow-right-line text-2xl group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <p className="text-center text-sm text-gray-500 mt-6">
                Paketle birlikte hediye kredi kazan
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}