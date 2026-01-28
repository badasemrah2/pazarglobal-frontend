import { useState } from 'react';

interface PremiumPackagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string; // Will be used for backend API
  currentBalance: number;
  onSuccess: () => void;
}

// Premium Paketleri: Gold, Platinum, Diamond
// Premium = TL ile satın alınır (kredi değil!)
// Hediye kredi = bonus olarak verilir
const PREMIUM_PACKAGES = [
  {
    id: 'gold',
    name: 'Gold',
    icon: 'ri-medal-line',
    color: 'from-yellow-400 to-yellow-500',
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-300',
    price: 79, // TL
    bonusCredits: 55, // Hediye kredi (1 ilan = 11 TL değerinde)
    duration: 7,
    features: [
      'İlanlarınız üst sıralarda görünür',
      '⭐ Gold rozeti',
      '7 gün boyunca öne çıkma',
    ],
    popular: false,
  },
  {
    id: 'platinum',
    name: 'Platinum',
    icon: 'ri-vip-crown-line',
    color: 'from-slate-400 to-slate-500',
    textColor: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
    price: 149, // TL
    bonusCredits: 110, // Hediye kredi (2 ilan = 22 TL değerinde)
    duration: 15,
    features: [
      'İlanlarınız üst sıralarda görünür',
      '💎 Platinum rozeti',
      '15 gün boyunca öne çıkma',
      'Öne çıkan ilanlar bölümünde',
    ],
    popular: true,
  },
  {
    id: 'diamond',
    name: 'Diamond',
    icon: 'ri-vip-diamond-line',
    color: 'from-cyan-400 to-blue-500',
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    price: 249, // TL
    bonusCredits: 165, // Hediye kredi (3 ilan = 33 TL değerinde)
    duration: 30,
    features: [
      'İlanlarınız üst sıralarda görünür',
      '💠 Diamond rozeti',
      '30 gün boyunca öne çıkma',
      'Öne çıkan ilanlar bölümünde',
      'Öncelikli destek',
    ],
    popular: false,
  },
];

export default function PremiumPackagesModal({
  isOpen,
  onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId: _userId, // Will be used for backend API
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentBalance: _currentBalance,
  onSuccess,
}: PremiumPackagesModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<string>('platinum');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const selectedPkg = PREMIUM_PACKAGES.find((p) => p.id === selectedPackage);

  const handlePurchase = async () => {
    const pkg = PREMIUM_PACKAGES.find((p) => p.id === selectedPackage);
    if (!pkg) return;

    setProcessing(true);
    setError('');

    try {
      // TODO: Ödeme gateway entegrasyonu
      // 1. Ödeme al (TL)
      // 2. Kullanıcıyı premium yap (is_premium = true)
      // 3. premium_until = now + duration days
      // 4. premium_badge = pkg.id
      // 5. Hediye kredileri ekle (wallet_transactions + wallets)
      
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      alert(`Ödeme sistemi henüz entegre edilmedi.\n\nPaket: ${pkg.name}\nFiyat: ${pkg.price} ₺\nSüre: ${pkg.duration} gün\nHediye Kredi: ${pkg.bonusCredits}`);
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'İşlem başarısız oldu');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-yellow-500 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <i className="ri-vip-crown-fill"></i>
                Premium Üyelik
              </h2>
              <p className="text-sm opacity-90">İlanlarınızı öne çıkarın, daha fazla alıcıya ulaşın</p>
            </div>
            <button
              onClick={onClose}
              title="Kapat"
              aria-label="Modalı kapat"
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            {PREMIUM_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={`w-full p-4 rounded-xl border-2 transition-all cursor-pointer text-left relative overflow-hidden ${
                  selectedPackage === pkg.id
                    ? `${pkg.borderColor} ${pkg.bgColor}`
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-2 right-4 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    En Popüler
                  </span>
                )}
                
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pkg.color} flex items-center justify-center flex-shrink-0`}>
                    <i className={`${pkg.icon} text-2xl text-white`}></i>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`font-bold ${pkg.textColor}`}>{pkg.name}</h3>
                      <div className="text-right">
                        <span className="font-bold text-xl text-gray-900">{pkg.price}</span>
                        <span className="text-sm text-gray-500 ml-1">₺</span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-500 mb-2">{pkg.duration} gün geçerli</p>
                    
                    <ul className="space-y-1">
                      {pkg.features.map((feature, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-center gap-1">
                          <i className="ri-check-line text-green-500"></i>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* Bonus Credits Badge */}
                    {pkg.bonusCredits > 0 && (
                      <div className="mt-3 inline-flex items-center gap-1 bg-teal-100 text-teal-700 text-xs font-semibold px-2 py-1 rounded-full">
                        <i className="ri-gift-line"></i>
                        +{pkg.bonusCredits} kredi hediye
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Selection indicator */}
                {selectedPackage === pkg.id && (
                  <div className="absolute top-4 right-4">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${pkg.color} flex items-center justify-center`}>
                      <i className="ri-check-line text-white text-sm"></i>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Benefits Summary */}
          <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border border-orange-100">
            <h4 className="text-sm font-semibold text-orange-800 mb-2 flex items-center gap-2">
              <i className="ri-star-line"></i>
              Premium Avantajları
            </h4>
            <ul className="text-xs text-orange-700 space-y-1">
              <li>✓ İlanlarınız arama sonuçlarında üst sıralarda görünür</li>
              <li>✓ Profilinizde premium rozet</li>
              <li>✓ Öne çıkan ilanlar bölümünde görünürlük</li>
              <li>✓ Hediye kredi ile ilan yayınlama</li>
            </ul>
          </div>

          {/* Purchase Button */}
          <button
            onClick={handlePurchase}
            disabled={processing}
            className="w-full mt-6 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                İşleniyor...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <i className="ri-vip-crown-line text-xl"></i>
                {selectedPkg?.price} ₺ - {selectedPkg?.name} Satın Al
              </span>
            )}
          </button>

          {/* Payment Info */}
          <p className="text-xs text-gray-500 text-center mt-3">
            Ödeme sistemi aktif edildiğinde premium üyeliğiniz anında açılır
          </p>

          {/* Payment Methods */}
          <div className="mt-4 flex items-center justify-center gap-2 text-gray-400">
            <i className="ri-visa-line text-2xl"></i>
            <i className="ri-mastercard-line text-2xl"></i>
            <span className="text-xs">Güvenli ödeme</span>
          </div>
        </div>
      </div>
    </div>
  );
}
