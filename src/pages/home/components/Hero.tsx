import { motion } from 'framer-motion';
import { useState } from 'react';

export default function Hero() {
  const [showPhone, setShowPhone] = useState(true);

  const handleStartClick = () => {
    if (window.REACT_APP_NAVIGATE) {
      window.REACT_APP_NAVIGATE('/listings');
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-300/30 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-300/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      </div>

      {/* Dark Overlay for Better Text Contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/5 to-black/10" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="text-left"
          >
            <motion.h1
              className="text-6xl lg:text-7xl font-display font-black leading-tight mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                AI ile Saniyeler
              </span>
              <br />
              <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                İçinde İlan Ver
              </span>
            </motion.h1>

            <motion.p
              className="text-xl lg:text-2xl text-gray-700 mb-10 font-light leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Fotoğraf çek, konuş, yayınla. Yapay zeka her şeyi halleder.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <button 
                onClick={handleStartClick}
                className="group px-8 py-4 bg-gradient-primary text-white font-semibold rounded-full hover:shadow-2xl hover:scale-105 transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer"
              >
                <span>Hemen Başla</span>
                <i className="ri-sparkle-fill text-xl group-hover:rotate-12 transition-transform" />
              </button>
              <button 
                onClick={() => scrollToSection('how-it-works')}
                className="px-8 py-4 bg-white/80 backdrop-blur-sm text-gray-800 font-semibold rounded-full hover:bg-white hover:shadow-lg transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-play-circle-line text-xl" />
                <span>Nasıl Çalışır?</span>
              </button>
            </motion.div>

            {/* Stats */}
            <motion.div
              className="mt-16 grid grid-cols-3 gap-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <div>
                <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">500K+</div>
                <div className="text-sm text-gray-600 mt-1">Aktif Kullanıcı</div>
              </div>
              <div>
                <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">1M+</div>
                <div className="text-sm text-gray-600 mt-1">İşlenen İlan</div>
              </div>
              <div>
                <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">98%</div>
                <div className="text-sm text-gray-600 mt-1">Memnuniyet</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Visual - WhatsApp Guide */}
          {showPhone && (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative hidden lg:block"
            >
              <div className="relative">
                {/* Control Buttons */}
                <div className="absolute -top-4 right-0 z-20 flex items-center space-x-2">
                  <button
                    onClick={() => setShowPhone(false)}
                    className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer group"
                    title="Küçült"
                  >
                    <i className="ri-subtract-line text-gray-700 text-lg group-hover:text-gray-900" />
                  </button>
                  <button
                    onClick={() => setShowPhone(false)}
                    className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 transition-colors cursor-pointer group"
                    title="Kapat"
                  >
                    <i className="ri-close-line text-gray-700 text-lg group-hover:text-red-600" />
                  </button>
                </div>

                {/* WhatsApp Activation Guide Badge */}
                <motion.div
                  className="absolute -top-16 left-1/2 transform -translate-x-1/2 z-20 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                >
                  <div className="flex items-center space-x-2">
                    <i className="ri-whatsapp-fill text-xl" />
                    <span className="font-semibold text-sm">WhatsApp'ı Aktif Et: <strong>"join wrong-nice"</strong></span>
                  </div>
                </motion.div>

                {/* Main Phone Mockup - WhatsApp Chat */}
                <div className="relative z-10 bg-gradient-to-b from-gray-900 to-gray-800 rounded-[3rem] shadow-2xl p-3 transform hover:scale-105 transition-transform duration-500">
                  {/* Phone Notch */}
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-3xl z-30" />
                  
                  {/* Phone Screen */}
                  <div className="bg-white rounded-[2.5rem] overflow-hidden">
                    {/* WhatsApp Header */}
                    <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 flex items-center space-x-3">
                      <button className="cursor-pointer">
                        <i className="ri-arrow-left-line text-white text-xl" />
                      </button>
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <i className="ri-robot-2-fill text-white text-xl" />
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-semibold text-sm">Twilio WhatsApp</div>
                        <div className="text-white/80 text-xs">PazarGlobal AI</div>
                      </div>
                      <button className="cursor-pointer">
                        <i className="ri-more-2-fill text-white text-xl" />
                      </button>
                    </div>

                    {/* Chat Messages */}
                    <div className="bg-[#ECE5DD] p-4 h-[500px] overflow-y-auto">
                      {/* System Message 1 */}
                      <motion.div
                        className="mb-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.2 }}
                      >
                        <div className="bg-yellow-100 rounded-lg p-3 max-w-[85%] shadow-sm">
                          <div className="flex items-start space-x-2">
                            <i className="ri-error-warning-fill text-yellow-600 text-lg mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-800 leading-relaxed">
                                <strong>Twilio Sandbox:</strong> ⚠️ Numaranız sandbox'a bağlı değil. Önce <strong>join &lt;sandbox name&gt;</strong> göndererek bağlanmalısınız. Üyelik 72 saat sürer.
                              </p>
                              <span className="text-[10px] text-gray-500 mt-1 block">20:04</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {/* User Message */}
                      <motion.div
                        className="mb-3 flex justify-end"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.4 }}
                      >
                        <div className="bg-green-100 rounded-lg p-3 max-w-[70%] shadow-sm">
                          <p className="text-sm text-gray-800 font-medium">join wrong-nice</p>
                          <span className="text-[10px] text-gray-500 mt-1 block text-right">20:04 ✓✓</span>
                        </div>
                      </motion.div>

                      {/* System Message 2 - Success */}
                      <motion.div
                        className="mb-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.6 }}
                      >
                        <div className="bg-green-50 rounded-lg p-3 max-w-[85%] shadow-sm border border-green-200">
                          <div className="flex items-start space-x-2">
                            <i className="ri-checkbox-circle-fill text-green-600 text-lg mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-800 leading-relaxed">
                                <strong>Twilio Sandbox:</strong> ✅ Hazırsınız! Sandbox artık <strong>whatsapp:+14155238886</strong> ile mesaj gönderip alabilir. Çıkmak için <strong>stop</strong> yazın.
                              </p>
                              <span className="text-[10px] text-gray-500 mt-1 block">20:04</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {/* User Message 2 */}
                      <motion.div
                        className="mb-3 flex justify-end"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.8 }}
                      >
                        <div className="bg-green-100 rounded-lg p-3 max-w-[70%] shadow-sm">
                          <p className="text-sm text-gray-800">Selam</p>
                          <span className="text-[10px] text-gray-500 mt-1 block text-right">20:04 ✓✓</span>
                        </div>
                      </motion.div>

                      {/* AI Welcome Message */}
                      <motion.div
                        className="mb-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 2 }}
                      >
                        <div className="bg-white rounded-lg p-4 max-w-[85%] shadow-md">
                          <div className="flex items-start space-x-2 mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <i className="ri-robot-2-fill text-white text-sm" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-800 font-semibold mb-2">Selam! 👋 PazarGlobal'e hoş geldiniz!</p>
                              <p className="text-xs text-gray-700 leading-relaxed mb-3">
                                🛒 <strong>Ürün satmak istiyorsanız:</strong> Satmak istediğiniz ürünün adını ve temel özelliklerini yazın.
                              </p>
                              <p className="text-xs text-gray-700 leading-relaxed mb-3">
                                🔍 <strong>Ürün aramak istiyorsanız:</strong> Ne tür bir ürün aradığınızı söyleyin (örneğin: "ikinci el telefon", "bebek arabası", "oyuncu koltuğu").
                              </p>
                              <p className="text-xs text-gray-700 leading-relaxed">
                                Bugün PazarGlobal'de ne yapmak istersiniz, ürün mü satacaksınız yoksa bir şey mi arıyorsunuz?
                              </p>
                              <span className="text-[10px] text-gray-500 mt-2 block">20:04</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {/* Typing Indicator */}
                      <motion.div
                        className="flex items-center space-x-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2.2 }}
                      >
                        <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* WhatsApp Input */}
                    <div className="bg-gray-100 px-3 py-2 flex items-center space-x-2">
                      <button className="cursor-pointer">
                        <i className="ri-emotion-happy-line text-gray-500 text-xl" />
                      </button>
                      <div className="flex-1 bg-white rounded-full px-4 py-2">
                        <input 
                          type="text" 
                          placeholder="Mesaj yazın..." 
                          className="w-full text-xs outline-none bg-transparent"
                          disabled
                        />
                      </div>
                      <button className="cursor-pointer">
                        <i className="ri-attachment-line text-gray-500 text-xl" />
                      </button>
                      <button className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center cursor-pointer">
                        <i className="ri-mic-fill text-white text-lg" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Floating Info Cards */}
                <motion.div
                  className="absolute -top-8 -right-8 bg-white rounded-2xl shadow-xl p-4 w-48"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <i className="ri-whatsapp-fill text-green-600 text-xl" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-800">Adım 1</div>
                      <div className="text-[10px] text-gray-600">Kayıt Kodu Gönder</div>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg px-3 py-2">
                    <code className="text-xs font-mono text-green-700">join wrong-nice</code>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute -bottom-8 -left-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl shadow-xl p-4 w-48"
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <i className="ri-robot-2-fill text-white text-2xl" />
                    <div className="text-white">
                      <div className="text-xs font-bold">AI Asistan</div>
                      <div className="text-[10px] opacity-90">7/24 Aktif</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/90 leading-relaxed">
                    Saniyeler içinde ilan ver, ürün ara, fiyat takibi yap!
                  </p>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* Show Phone Button - appears when phone is hidden */}
          {!showPhone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative hidden lg:flex items-center justify-center"
            >
              <button
                onClick={() => setShowPhone(true)}
                className="px-8 py-4 bg-gradient-primary text-white font-semibold rounded-full hover:shadow-2xl hover:scale-105 transition-all flex items-center space-x-2 whitespace-nowrap cursor-pointer"
              >
                <i className="ri-smartphone-line text-xl" />
                <span>WhatsApp Rehberini Göster</span>
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <i className="ri-arrow-down-line text-3xl text-gray-400" />
      </motion.div>
    </section>
  );
}
