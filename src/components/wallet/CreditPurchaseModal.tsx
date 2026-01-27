import { useState, useEffect } from 'react';

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string; // Will be used for payment gateway
  onSuccess: () => void;
}

// Fiyatlandırma: 55 kredi = 11 TL (1 ilan maliyeti)
// Baz fiyat: 1 kredi = 0.20 TL
const BASE_PRICE_PER_CREDIT = 0.20;
const BULK_DISCOUNT_PERCENT = 20; // 550+ kredi için %20 indirim
const MIN_CUSTOM_CREDITS = 550;

const CREDIT_PACKAGES = [
  {
    id: 'starter',
    credits: 55,
    price: 11,
    originalPrice: 11,
    discount: 0,
    label: 'Başlangıç',
    description: '1 ilan yayınlama',
    popular: false,
  },
  {
    id: 'standard',
    credits: 165,
    price: 29,
    originalPrice: 33,
    discount: 12,
    label: 'Standart',
    description: '3 ilan yayınlama',
    popular: true,
  },
];

export default function CreditPurchaseModal({
  isOpen,
  onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId: _userId, // Will be used for payment gateway integration
  onSuccess,
}: CreditPurchaseModalProps) {
  const [selectedPackage, setSelectedPackage] = useState<string>('standard');
  const [customCredits, setCustomCredits] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // Özel miktar için fiyat hesaplama
  const customCreditsNum = parseInt(customCredits) || 0;
  const isValidCustom = customCreditsNum >= MIN_CUSTOM_CREDITS;
  const customOriginalPrice = customCreditsNum * BASE_PRICE_PER_CREDIT;
  const customDiscountedPrice = customOriginalPrice * (1 - BULK_DISCOUNT_PERCENT / 100);
  const customSavings = customOriginalPrice - customDiscountedPrice;

  // Reset custom input when switching modes
  useEffect(() => {
    if (!isCustomMode) {
      setCustomCredits('');
    }
  }, [isCustomMode]);

  if (!isOpen) return null;

  const handlePurchase = async () => {
    let credits: number;
    let price: number;

    if (isCustomMode) {
      if (!isValidCustom) {
        setError(`Minimum ${MIN_CUSTOM_CREDITS} kredi girmelisiniz.`);
        return;
      }
      credits = customCreditsNum;
      price = Math.round(customDiscountedPrice * 100) / 100;
    } else {
      const pkg = CREDIT_PACKAGES.find((p) => p.id === selectedPackage);
      if (!pkg) return;
      credits = pkg.credits;
      price = pkg.price;
    }

    setProcessing(true);
    setError('');

    try {
      // TODO: Ödeme gateway entegrasyonu (iyzico/stripe/paytr)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      alert(`Ödeme sistemi henüz entegre edilmedi.\n\nKredi: ${credits}\nTutar: ${price.toFixed(2)} ₺`);
      
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ödeme işlemi başarısız oldu';
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  const getCurrentPrice = () => {
    if (isCustomMode) {
      return isValidCustom ? customDiscountedPrice.toFixed(2) : '—';
    }
    return CREDIT_PACKAGES.find((p) => p.id === selectedPackage)?.price || 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Kredi Satın Al</h2>
              <p className="text-sm opacity-90">İlan yayınlamak için kredi yükleyin</p>
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

          {/* Hazır Paketler */}
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-gray-700">Hazır Paketler</h3>
            {CREDIT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => {
                  setSelectedPackage(pkg.id);
                  setIsCustomMode(false);
                }}
                className={`w-full p-4 rounded-xl border-2 transition-all cursor-pointer text-left relative ${
                  selectedPackage === pkg.id && !isCustomMode
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-2 right-4 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    Popüler
                  </span>
                )}
                
                <div className="flex items-center justify-between pl-8">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{pkg.label}</span>
                      {pkg.discount > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          %{pkg.discount} indirim
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-semibold text-teal-600">{pkg.credits} kredi</span>
                      <span className="mx-1">•</span>
                      <span>{pkg.description}</span>
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold text-xl text-gray-900">{pkg.price} ₺</div>
                    {pkg.discount > 0 && (
                      <div className="text-xs text-gray-400 line-through">
                        {pkg.originalPrice} ₺
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Selection indicator */}
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPackage === pkg.id && !isCustomMode
                        ? 'border-teal-500 bg-teal-500'
                        : 'border-gray-300'
                    }`}
                  >
                    {selectedPackage === pkg.id && !isCustomMode && (
                      <i className="ri-check-line text-white text-sm"></i>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Özel Miktar */}
          <div className="border-t border-gray-200 pt-6">
            <div
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                isCustomMode
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Selection indicator */}
                <button
                  type="button"
                  onClick={() => setIsCustomMode(true)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                    isCustomMode
                      ? 'border-teal-500 bg-teal-500'
                      : 'border-gray-300'
                  }`}
                  aria-label="Özel miktar seç"
                >
                  {isCustomMode && (
                    <i className="ri-check-line text-white text-sm"></i>
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setIsCustomMode(true)}
                      className="font-bold text-gray-900"
                    >
                      Özel Miktar
                    </button>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      %{BULK_DISCOUNT_PERCENT} indirim
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {MIN_CUSTOM_CREDITS}+ kredi için istediğiniz miktarı girin
                  </p>

                  {isCustomMode && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={customCredits}
                          onChange={(e) => setCustomCredits(e.target.value)}
                          placeholder={`Min. ${MIN_CUSTOM_CREDITS}`}
                          min={MIN_CUSTOM_CREDITS}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-gray-600 font-medium">kredi</span>
                      </div>

                      {customCreditsNum > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          {isValidCustom ? (
                            <>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Normal fiyat:</span>
                                <span className="text-gray-400 line-through">{customOriginalPrice.toFixed(2)} ₺</span>
                              </div>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">İndirim (%{BULK_DISCOUNT_PERCENT}):</span>
                                <span className="text-green-600">-{customSavings.toFixed(2)} ₺</span>
                              </div>
                              <div className="flex justify-between font-bold border-t border-gray-200 pt-2 mt-2">
                                <span className="text-gray-900">Toplam:</span>
                                <span className="text-teal-600 text-lg">{customDiscountedPrice.toFixed(2)} ₺</span>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-orange-600">
                              <i className="ri-information-line mr-1"></i>
                              Minimum {MIN_CUSTOM_CREDITS} kredi girmelisiniz
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600">
              <i className="ri-information-line mr-1"></i>
              Krediler hesabınıza anında yüklenir. 1 ilan yayınlama = 55 kredi
            </p>
          </div>

          {/* Purchase Button */}
          <button
            onClick={handlePurchase}
            disabled={processing || (isCustomMode && !isValidCustom)}
            className="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-4 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                İşleniyor...
              </span>
            ) : (
              <span>{getCurrentPrice()} ₺ Öde</span>
            )}
          </button>

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
