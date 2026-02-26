import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavigation from '../../../components/feature/TopNavigation';
import { supabase } from '../../../lib/supabase';
import { normalizePhoneTR } from '../../../lib/phone';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateField = (name: keyof typeof formData, value: string, nextForm = formData) => {
    if (name === 'name') {
      if (!value.trim()) return 'Ad Soyad zorunludur';
      if (value.trim().length < 2) return 'Ad Soyad en az 2 karakter olmalıdır';
      return '';
    }
    if (name === 'email') {
      if (!value.trim()) return 'E-posta zorunludur';
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
      return emailOk ? '' : 'Geçerli bir e-posta girin';
    }
    if (name === 'phone') {
      if (!value.trim()) return 'Telefon numarası zorunludur';
      const normalized = normalizePhoneTR(value);
      return normalized ? '' : 'Geçerli telefon girin (+905XXXXXXXXX)';
    }
    if (name === 'password') {
      if (!value) return 'Şifre zorunludur';
      if (value.length < 6) return 'Şifre en az 6 karakter olmalıdır';
      return '';
    }
    if (name === 'confirmPassword') {
      if (!value) return 'Şifre tekrarı zorunludur';
      if (value !== nextForm.password) return 'Şifreler eşleşmiyor';
      return '';
    }
    return '';
  };

  const updateField = (name: keyof typeof formData, value: string) => {
    const next = { ...formData, [name]: value };
    setFormData(next);
    setError('');
    setFieldErrors((prev) => {
      const nextErrors = { ...prev };
      nextErrors[name] = validateField(name, value, next);
      if (name === 'password' || name === 'confirmPassword') {
        nextErrors.confirmPassword = validateField('confirmPassword', next.confirmPassword, next);
      }
      return nextErrors;
    });
  };

  const validateForm = (data = formData) => {
    const nextErrors: Record<string, string> = {};
    (Object.keys(data) as Array<keyof typeof data>).forEach((k) => {
      const msg = validateField(k, data[k], data);
      if (msg) nextErrors[k] = msg;
    });
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      setError('Lütfen formdaki hataları düzeltin');
      return;
    }

    setLoading(true);

    try {
      const normalizedPhone = normalizePhoneTR(formData.phone);
      if (!normalizedPhone) {
        throw new Error('Geçerli bir telefon numarası girin (+905XXXXXXXXX)');
      }

      // ⚠️ GÜVENLİK: Telefon numarasının daha önce kullanılıp kullanılmadığını kontrol et
      const { data: existingPhone } = await supabase
        .from('profiles')
        .select('id, phone')
        .eq('phone', normalizedPhone)
        .limit(1);

      if (existingPhone && existingPhone.length > 0) {
        throw new Error('Bu telefon numarası zaten kayıtlı. Lütfen giriş yapın veya farklı bir numara kullanın.');
      }

      // Supabase Auth ile kayıt
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/login`,
          data: {
            full_name: formData.name,
            display_name: formData.name,
            phone: normalizedPhone,
          },
        },
      });

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        // Profil bilgilerini güncelle
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.name,
            display_name: formData.name,
            phone: normalizedPhone,
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('Profil güncelleme hatası:', profileError);
        }

        setSuccess('Kayıt başarılı! Giriş yapabilirsiniz.');
        
        setTimeout(() => {
          navigate('/auth/login');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Kayıt hatası:', err);
      setError(err.message || 'Kayıt sırasında bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-orange-50">
      <TopNavigation />
      
      <div className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Kayıt Ol</h1>
              <p className="text-gray-600">Hemen ücretsiz hesap oluşturun</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Adınız ve soyadınız"
                  disabled={loading}
                />
                {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-posta
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="ornek@email.com"
                  disabled={loading}
                />
                {fieldErrors.email && <p className="text-xs text-red-600 mt-1">{fieldErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon Numarası
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="+90 5XX XXX XX XX"
                  disabled={loading}
                />
                {fieldErrors.phone && <p className="text-xs text-red-600 mt-1">{fieldErrors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şifre
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="En az 6 karakter"
                  disabled={loading}
                />
                {fieldErrors.password && <p className="text-xs text-red-600 mt-1">{fieldErrors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Şifre Tekrar
                </label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Şifrenizi tekrar girin"
                  disabled={loading}
                />
                {fieldErrors.confirmPassword && <p className="text-xs text-red-600 mt-1">{fieldErrors.confirmPassword}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {loading ? 'Kayıt Yapılıyor...' : 'Kayıt Ol'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Zaten hesabınız var mı?{' '}
                <button
                  onClick={() => navigate('/auth/login')}
                  className="text-teal-600 hover:text-teal-700 font-semibold cursor-pointer"
                >
                  Giriş Yap
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
