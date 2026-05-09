import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopNavigation from '../../components/feature/TopNavigation';
import Footer from '../home/components/Footer';
import ChatBox from '../../components/feature/ChatBox';
import { isOwnedByViewer, resolveViewerUserId } from '../../lib/listingOwnership';
import { fetchPublicContactLink, resolveContactToken, sendMessageViaContactToken } from '../../services/agentApi';
import { useAuthStore } from '../../stores/authStore';

export default function ContactPage() {
  const navigate = useNavigate();
  const { token = '', listingId = '' } = useParams<{ token?: string; listingId?: string }>();
  const { user, customUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ownerName, setOwnerName] = useState('İlan Sahibi');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [listingTitle, setListingTitle] = useState('');
  const [message, setMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [resolvedToken, setResolvedToken] = useState('');

  const senderUserId = useMemo(() => {
    const viewerUserId = resolveViewerUserId({ userId: user?.id, customUserId: customUser?.id });
    return viewerUserId || undefined;
  }, [customUser?.id, user?.id]);
  const isAuthenticated = Boolean(senderUserId);
  const isOwnListingTarget = isOwnedByViewer(senderUserId, ownerUserId);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const routeToken = token.trim();
      const routeListingId = listingId.trim();

      if (!routeToken && !routeListingId) {
        setError('Geçersiz bağlantı.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        let activeToken = routeToken;
        if (!activeToken && routeListingId) {
          const linkRes = await fetchPublicContactLink(routeListingId);
          activeToken = String(linkRes?.data?.token || '').trim();
        }

        if (!activeToken) {
          setError('Mesaj bağlantısı oluşturulamadı. Lütfen tekrar deneyin.');
          return;
        }

        setResolvedToken(activeToken);

        const res = await resolveContactToken(activeToken);
        if (!mounted) return;

        const listing = res.data?.listing;
        if (!listing) {
          setError('Bu iletişim bağlantısı geçersiz veya süresi dolmuş.');
          return;
        }

        setOwnerUserId(String(listing.owner_user_id || '').trim());
        setOwnerName(listing.owner_name || 'İlan Sahibi');
        setListingTitle(listing.title || 'İlan');
      } catch (err) {
        console.error(err);
        if (mounted) setError('Bağlantı doğrulanamadı. Lütfen tekrar deneyin.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [token, listingId]);

  const handleSend = async () => {
    if (!senderUserId) {
      setError('Mesaj göndermek için giriş yapmanız gerekiyor.');
      navigate('/auth/login');
      return;
    }

    if (isOwnListingTarget) {
      setError('Kendi ilanınıza mesaj gönderemezsiniz.');
      return;
    }

    const cleanMessage = message.trim();
    if (!cleanMessage) {
      setError('Lütfen mesaj yazın.');
      return;
    }

    try {
      setSending(true);
      setError('');
      const res = await sendMessageViaContactToken({
        token: resolvedToken,
        message: cleanMessage,
        sender_name: senderName.trim() || undefined,
        channel: 'web',
      });

      if (!res.success) {
        throw new Error('Mesaj gönderilemedi');
      }

      setSent(true);
      setMessage('');
    } catch (err) {
      console.error(err);
      const messageText = err instanceof Error ? err.message : 'Mesaj gönderilemedi. Lütfen tekrar deneyin.';
      const lower = messageText.toLowerCase();
      if (lower.includes('self_contact_not_allowed')) {
        setError('Kendi ilanınıza mesaj gönderemezsiniz.');
      } else if (lower.includes('giriş yapmanız gerekiyor') || lower.includes('unauthorized')) {
        setError('Mesaj göndermek için giriş yapmanız gerekiyor.');
      } else {
        setError('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <TopNavigation isScrolled={false} />

      <div className="pt-24 pb-16 px-6">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-6 md:p-8">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Bağlantı doğrulanıyor...</div>
          ) : error ? (
            <div className="text-center py-6">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={() => navigate('/listings')}
                className="px-5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                İlanlara Dön
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">İlan Sahibine Mesaj Gönder</h1>
              <p className="text-gray-500 mb-1">İlan: <span className="font-medium text-gray-800">{listingTitle}</span></p>
              <p className="text-gray-500 mb-6">Alıcı: <span className="font-medium text-gray-800">{ownerName}</span></p>

              {sent && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
                  Mesajınız iletildi. İlan sahibi site içi mesaj kutusundan size dönüş yapabilir.
                </div>
              )}

              {isOwnListingTarget ? (
                <div className="space-y-4">
                  <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    Bu sizin ilanınız. Kendi ilanınıza site içi mesaj gönderemezsiniz.
                  </div>
                  <button
                    onClick={() => navigate('/profile/listings')}
                    className="w-full py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                  >
                    İlanlarıma Dön
                  </button>
                </div>
              ) : !isAuthenticated ? (
              <div className="space-y-4">
                <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
                  İlan sahibine mesaj göndermek için önce giriş yapmanız gerekiyor.
                </div>
                <button
                  onClick={() => navigate('/auth/login')}
                  className="w-full py-3 rounded-xl bg-gradient-primary text-white font-semibold hover:shadow-md"
                >
                  Giriş Yap
                </button>
              </div>
              ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Adınız (opsiyonel)</label>
                  <input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value.slice(0, 120))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="Örn: Ahmet"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">Mesajınız</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 3000))}
                    rows={6}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="Merhaba, ilan hakkında bilgi alabilir miyim?"
                  />
                </div>

                <button
                  onClick={() => void handleSend()}
                  disabled={sending}
                  className="w-full py-3 rounded-xl bg-gradient-primary text-white font-semibold hover:shadow-md disabled:opacity-60"
                >
                  {sending ? 'Gönderiliyor...' : 'Mesajı Gönder'}
                </button>
              </div>
              )}
            </>
          )}
        </div>
      </div>

      <Footer />
      <ChatBox />
    </div>
  );
}
