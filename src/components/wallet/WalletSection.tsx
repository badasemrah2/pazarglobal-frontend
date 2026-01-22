import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import CreditPurchaseModal from './CreditPurchaseModal';
import PremiumPackagesModal from './PremiumPackagesModal';

interface WalletTransaction {
  id: string;
  amount_bigint: number;
  kind: string;
  reference: string;
  created_at: string;
}

interface WalletSectionProps {
  userId: string;
}

export default function WalletSection({ userId }: WalletSectionProps) {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (userId) {
        await fetchWalletData();
      }
    };
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const fetchWalletData = async () => {
    try {
      // Bakiye al
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance_bigint')
        .eq('user_id', userId)
        .single();

      if (wallet) {
        setBalance(wallet.balance_bigint || 0);
      }

      // Son işlemleri al
      const { data: txs } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (txs) {
        setTransactions(txs);
      }
    } catch (err) {
      console.error('Cüzdan bilgileri alınamadı:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (kind: string) => {
    switch (kind) {
      case 'purchase':
        return 'ri-add-circle-line text-green-500';
      case 'listing_publish':
        return 'ri-megaphone-line text-orange-500';
      case 'premium_purchase':
        return 'ri-vip-crown-line text-yellow-500';
      case 'refund':
        return 'ri-refund-line text-blue-500';
      default:
        return 'ri-exchange-line text-gray-500';
    }
  };

  const getTransactionLabel = (kind: string) => {
    switch (kind) {
      case 'purchase':
        return 'Kredi Yükleme';
      case 'listing_publish':
        return 'İlan Yayınlama';
      case 'premium_purchase':
        return 'Premium Satın Alma';
      case 'refund':
        return 'İade';
      default:
        return 'İşlem';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-16 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <i className="ri-wallet-3-line text-3xl text-teal-600"></i>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Cüzdanım</h2>
              <p className="text-sm text-gray-600">Kredi bakiyeniz ve işlemleriniz</p>
            </div>
          </div>
        </div>

        {/* Bakiye Kartı */}
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl p-6 mb-6 text-white">
          <p className="text-sm opacity-90 mb-1">Mevcut Bakiye</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{balance}</span>
            <span className="text-lg opacity-90">kredi</span>
          </div>
          <p className="text-xs opacity-75 mt-2">
            ≈ {((balance / 55) * 11).toFixed(2)} ₺ değerinde
          </p>
        </div>

        {/* Aksiyon Butonları */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setShowCreditModal(true)}
            className="flex items-center justify-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer"
          >
            <i className="ri-add-circle-line text-xl"></i>
            <span>Kredi Al</span>
          </button>
          <button
            onClick={() => setShowPremiumModal(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-50 to-orange-50 hover:from-yellow-100 hover:to-orange-100 text-orange-700 font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer"
          >
            <i className="ri-vip-crown-line text-xl"></i>
            <span>Premium</span>
          </button>
        </div>

        {/* Son İşlemler */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Son İşlemler</h3>
          {transactions.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-lg">
              <i className="ri-exchange-line text-3xl text-gray-400 mb-2"></i>
              <p className="text-sm text-gray-500">Henüz işlem yok</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <i className={`${getTransactionIcon(tx.kind)} text-xl`}></i>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {getTransactionLabel(tx.kind)}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <span
                    className={`font-semibold ${
                      tx.amount_bigint >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {tx.amount_bigint >= 0 ? '+' : ''}
                    {tx.amount_bigint} kredi
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreditPurchaseModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        userId={userId}
        onSuccess={fetchWalletData}
      />
      <PremiumPackagesModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        userId={userId}
        currentBalance={balance}
        onSuccess={fetchWalletData}
      />
    </>
  );
}
