import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../../lib/supabase';

export default function WhatsAppResetPinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const phoneFromUrl = searchParams.get('phone') || '';

  const [phone, setPhone] = useState(phoneFromUrl);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  useEffect(() => {
    if (phoneFromUrl) {
      setPhone(phoneFromUrl);
    }
  }, [phoneFromUrl]);

  const hashPin = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!phone || !oldPin || !newPin || !confirmPin) {
      setError('Lütfen tüm alanları doldurun');
      return;
    }

    if (!/^\+90\d{10}$/.test(phone)) {
      setError('Geçerli bir telefon numarası girin (+905XXXXXXXXX)');
      return;
    }

    if (!/^\d{4}$/.test(oldPin)) {
      setError('Eski PIN 4 haneli olmalıdır');
      return;
    }

    if (!/^\d{4}$/.test(newPin)) {
      setError('Yeni PIN 4 haneli olmalıdır');
      return;
    }

    if (newPin !== confirmPin) {
      setError('Yeni PIN\'ler eşleşmiyor');
      return;
    }

    if (oldPin === newPin) {
      setError('Yeni PIN eski PIN ile aynı olamaz');
      return;
    }

    setLoading(true);

    try {
      // 1. Check if user exists and verify old PIN
      const oldPinHash = await hashPin(oldPin);
      const { data: security, error: fetchError } = await supabase
        .from('user_security')
        .select('*')
        .eq('phone', phone)
        .eq('pin_hash', oldPinHash)
        .single();

      if (fetchError || !security) {
        setError('Telefon numarası veya eski PIN hatalı');
        setLoading(false);
        return;
      }

      // 2. Check if account is locked
      if (security.is_locked) {
        const blockedUntil = new Date(security.blocked_until);
        if (blockedUntil > new Date()) {
          const remainingMinutes = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000);
          setError(`Hesabınız kilitli. ${remainingMinutes} dakika sonra tekrar deneyin.`);
          setLoading(false);
          return;
        }
      }

      // 3. Update PIN
      const newPinHash = await hashPin(newPin);
      const { error: updateError } = await supabase
        .from('user_security')
        .update({
          pin_hash: newPinHash,
          failed_attempts: 0,
          is_locked: false,
          blocked_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('phone', phone);

      if (updateError) {
        console.error('PIN update error:', updateError);
        setError('PIN güncellenirken bir hata oluştu');
        setLoading(false);
        return;
      }

      // Success
      setSuccess(true);
      setTimeout(() => {
        navigate('/profile');
      }, 2000);
    } catch (err: any) {
      console.error('Reset PIN error:', err);
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-check-line text-4xl text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">PIN Başarıyla Güncellendi!</h2>
          <p className="text-gray-600 mb-4">
            WhatsApp PIN\'iniz başarıyla değiştirildi. Artık yeni PIN ile giriş yapabilirsiniz.
          </p>
          <p className="text-sm text-gray-500">Profil sayfasına yönlendiriliyorsunuz...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-lock-password-line text-3xl text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">WhatsApp PIN Sıfırlama</h1>
          <p className="text-gray-600">
            WhatsApp güvenlik PIN\'inizi değiştirin
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start space-x-3"
          >
            <i className="ri-error-warning-line text-red-500 text-xl flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telefon Numarası
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <i className="ri-phone-line text-gray-400" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+905XXXXXXXXX"
                disabled={!!phoneFromUrl}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Örnek: +905412879705
            </p>
          </div>

          {/* Old PIN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Eski PIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <i className="ri-lock-line text-gray-400" />
              </div>
              <input
                type={showOldPin ? 'text' : 'password'}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowOldPin(!showOldPin)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer"
              >
                <i className={`${showOldPin ? 'ri-eye-off-line' : 'ri-eye-line'} text-gray-400 hover:text-gray-600`} />
              </button>
            </div>
          </div>

          {/* New PIN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Yeni PIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <i className="ri-lock-line text-gray-400" />
              </div>
              <input
                type={showNewPin ? 'text' : 'password'}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNewPin(!showNewPin)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer"
              >
                <i className={`${showNewPin ? 'ri-eye-off-line' : 'ri-eye-line'} text-gray-400 hover:text-gray-600`} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              4 haneli sayısal PIN
            </p>
          </div>

          {/* Confirm New PIN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Yeni PIN (Tekrar)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <i className="ri-lock-line text-gray-400" />
              </div>
              <input
                type={showConfirmPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPin(!showConfirmPin)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer"
              >
                <i className={`${showConfirmPin ? 'ri-eye-off-line' : 'ri-eye-line'} text-gray-400 hover:text-gray-600`} />
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-primary text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center space-x-2">
                <i className="ri-loader-4-line animate-spin" />
                <span>Güncelleniyor...</span>
              </span>
            ) : (
              'PIN\'i Güncelle'
            )}
          </button>

          {/* Back to Profile */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="w-full text-gray-600 hover:text-gray-900 py-2 text-sm font-medium transition-colors cursor-pointer"
          >
            Profil Sayfasına Dön
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <i className="ri-information-line text-blue-500 text-xl flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold mb-1">WhatsApp PIN Hakkında</p>
              <ul className="space-y-1 text-xs">
                <li>• PIN\'iniz WhatsApp üzerinden ilan vermeniz için gereklidir</li>
                <li>• 4 haneli sayısal bir kod olmalıdır</li>
                <li>• PIN\'inizi kimseyle paylaşmayın</li>
                <li>• 5 başarısız denemeden sonra hesabınız 15 dakika kilitlenir</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
