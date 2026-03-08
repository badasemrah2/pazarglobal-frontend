
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type TopNavigationProps = {
  isScrolled?: boolean;
};

export default function TopNavigation({ isScrolled: isScrolledProp }: TopNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolledInternal, setIsScrolledInternal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isScrolled = typeof isScrolledProp === 'boolean' ? isScrolledProp : isScrolledInternal;

  useEffect(() => {
    // If parent controls scroll state, skip internal listener.
    if (typeof isScrolledProp === 'boolean') return;

    const handleScroll = () => {
      setIsScrolledInternal(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isScrolledProp]);

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const isHomePage = location.pathname === '/';

  const go = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled || !isHomePage
          ? 'bg-white shadow-md'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <img
              src="/logo-readdy.png?v=1"
              alt="PazarGlobal"
              title="PazarGlobal"
              className="h-8 w-auto"
            />
            <span className="text-xl sm:text-2xl font-display font-bold leading-none">
              <span className="text-blue-800">Pazar</span>
              <span className="text-sky-400">Global</span>
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => navigate('/')}
              className={`font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isScrolled || !isHomePage
                  ? 'text-gray-700 hover:text-teal-600'
                  : 'text-white hover:text-teal-200'
              }`}
            >
              Ana Sayfa
            </button>
            <button
              onClick={() => navigate('/listings')}
              className={`font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isScrolled || !isHomePage
                  ? 'text-gray-700 hover:text-teal-600'
                  : 'text-white hover:text-teal-200'
              }`}
            >
              İlanlar
            </button>
            <button
              onClick={() => navigate('/about')}
              className={`font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isScrolled || !isHomePage
                  ? 'text-gray-700 hover:text-teal-600'
                  : 'text-white hover:text-teal-200'
              }`}
            >
              Hakkımızda
            </button>
            <button
              onClick={() => navigate('/reviews')}
              className={`font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isScrolled || !isHomePage
                  ? 'text-gray-700 hover:text-teal-600'
                  : 'text-white hover:text-teal-200'
              }`}
            >
              Yorumlar
            </button>
          </div>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className={`md:hidden h-10 w-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                isScrolled || !isHomePage
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-white/85 text-gray-800 hover:bg-white'
              }`}
              aria-label="Menüyü Aç/Kapat"
              title="Menü"
            >
              <i className={isMobileMenuOpen ? 'ri-close-line text-xl' : 'ri-menu-line text-xl'} />
            </button>

            {user ? (
              <>
                <button
                  onClick={() => navigate('/create-listing')}
                  className="hidden md:block bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  İlan Ver
                </button>

                <button
                  onClick={() => navigate('/profile/listings')}
                  className={`hidden md:flex font-medium transition-colors cursor-pointer whitespace-nowrap items-center gap-2 ${
                    isScrolled || !isHomePage
                      ? 'text-gray-700 hover:text-teal-600'
                      : 'text-white hover:text-teal-200'
                  }`}
                >
                  <i className="ri-folder-user-line text-xl"></i>
                  <span className="hidden md:inline">İlanlarım</span>
                </button>
                <button
                  onClick={() => navigate('/profile')}
                  className={`hidden md:flex font-medium transition-colors cursor-pointer whitespace-nowrap items-center gap-2 ${
                    isScrolled || !isHomePage
                      ? 'text-gray-700 hover:text-teal-600'
                      : 'text-white hover:text-teal-200'
                  }`}
                >
                  <i className="ri-user-line text-xl"></i>
                  <span className="hidden md:inline">Profil</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/auth/login')}
                  className={`hidden md:block font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isScrolled || !isHomePage
                      ? 'text-gray-700 hover:text-teal-600'
                      : 'text-white hover:text-teal-200'
                  }`}
                >
                  Giriş Yap
                </button>
                <button
                  onClick={() => navigate('/auth/register')}
                  className="hidden md:block bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Kayıt Ol
                </button>
              </>
            )}
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-gray-100">
            <div className="pt-3 grid gap-2">
              <button onClick={() => go('/')} className="text-left px-2 py-2 text-gray-700 hover:text-teal-600 font-medium">Ana Sayfa</button>
              <button onClick={() => go('/listings')} className="text-left px-2 py-2 text-gray-700 hover:text-teal-600 font-medium">İlanlar</button>
              <button onClick={() => go('/about')} className="text-left px-2 py-2 text-gray-700 hover:text-teal-600 font-medium">Hakkımızda</button>
              <button onClick={() => go('/reviews')} className="text-left px-2 py-2 text-gray-700 hover:text-teal-600 font-medium">Yorumlar</button>

              {user ? (
                <>
                  <button onClick={() => go('/create-listing')} className="text-left px-2 py-2 text-gray-700 hover:text-teal-600 font-medium">İlan Ver</button>
                  <button onClick={() => go('/profile/listings')} className="text-left px-2 py-2 text-gray-700 hover:text-teal-600 font-medium">İlanlarım</button>
                  <button onClick={() => go('/profile')} className="text-left px-2 py-2 text-gray-700 hover:text-teal-600 font-medium">Profil</button>
                </>
              ) : (
                <>
                  <button onClick={() => go('/auth/login')} className="text-left px-2 py-2 text-gray-700 hover:text-teal-600 font-medium">Giriş Yap</button>
                  <button onClick={() => go('/auth/register')} className="text-left px-2 py-2 text-gray-700 hover:text-teal-600 font-medium">Kayıt Ol</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
