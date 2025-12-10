export default function Footer() {
  const handleNavigation = (path: string) => {
    if (window.REACT_APP_NAVIGATE) {
      window.REACT_APP_NAVIGATE(path);
    }
  };

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          {/* Logo & Description */}
          <div className="md:col-span-1">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 flex items-center justify-center">
                <img 
                  src="/logo.svg" 
                  alt="PazarGlobal Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-2xl font-display font-bold">
                Pazar<span className="text-cyan-400">Global</span>
              </span>
            </div>
            <p className="text-gray-400 leading-relaxed mb-6">
              AI ile saniyeler içinde ilan ver. Türkiye'nin en akıllı ilan platformu.
            </p>
            <div className="flex items-center space-x-4">
              <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                <i className="ri-facebook-fill text-lg" />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                <i className="ri-twitter-x-fill text-lg" />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                <i className="ri-instagram-fill text-lg" />
              </a>
              <a href="#" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                <i className="ri-linkedin-fill text-lg" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-lg font-bold mb-6">Platform</h3>
            <ul className="space-y-3">
              <li>
                <button onClick={() => handleNavigation('/')} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  Ana Sayfa
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigation('/listings')} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  İlanlar
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigation('/about')} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  Hakkımızda
                </button>
              </li>
              <li>
                <button onClick={() => handleNavigation('/reviews')} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  Yorumlar
                </button>
              </li>
            </ul>
          </div>

          {/* Özellikler */}
          <div>
            <h3 className="text-lg font-bold mb-6">Özellikler</h3>
            <ul className="space-y-3">
              <li>
                <a href="#features" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  AI İlan Oluşturma
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  Nasıl Çalışır
                </a>
              </li>
              <li>
                <a href="#premium" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  Premium Üyelik
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  WhatsApp AI
                </a>
              </li>
            </ul>
          </div>

          {/* Destek */}
          <div>
            <h3 className="text-lg font-bold mb-6">Destek</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  Yardım Merkezi
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  İletişim
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  Gizlilik Politikası
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
                  Kullanım Koşulları
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          <p className="text-gray-400 text-sm">
            © 2024 PazarGlobal. Tüm hakları saklıdır.
          </p>
          <a 
            href="https://readdy.ai/?origin=logo" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white text-sm transition-colors cursor-pointer"
          >
            Powered by Readdy
          </a>
        </div>
      </div>
    </footer>
  );
}