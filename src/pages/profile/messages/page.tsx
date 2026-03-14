import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavigation from '../../../components/feature/TopNavigation';
import Footer from '../../home/components/Footer';
import ChatBox from '../../../components/feature/ChatBox';
import {
  fetchOwnerConversationMessages,
  fetchOwnerInbox,
  sendOwnerReply,
  type OwnerInboxItem,
  type OwnerMessage,
} from '../../../services/agentApi';
import { supabase } from '../../../lib/supabase';

export default function ProfileMessagesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inbox, setInbox] = useState<OwnerInboxItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [messages, setMessages] = useState<OwnerMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const selectedConversation = useMemo(
    () => inbox.find((i) => i.id === selectedConversationId) || null,
    [inbox, selectedConversationId],
  );

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          navigate('/auth/login');
          return;
        }

        const rows = await fetchOwnerInbox(50);
        if (!mounted) return;
        setInbox(rows);
        if (rows.length > 0) {
          setSelectedConversationId(rows[0].id);
        }
      } catch (err) {
        console.error(err);
        if (mounted) setError('Mesaj kutusu yüklenemedi.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (loading) return;
    let mounted = true;
    const timer = window.setInterval(async () => {
      try {
        const rows = await fetchOwnerInbox(50);
        if (mounted) setInbox(rows);
      } catch {
        // fail-soft polling
      }
    }, 15000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [loading]);

  useEffect(() => {
    let mounted = true;

    const loadMessages = async () => {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }
      try {
        setLoadingMessages(true);
        const rows = await fetchOwnerConversationMessages(selectedConversationId, 100);
        if (!mounted) return;
        setMessages(rows);
      } catch (err) {
        console.error(err);
        if (mounted) setError('Mesajlar yüklenemedi.');
      } finally {
        if (mounted) setLoadingMessages(false);
      }
    };

    void loadMessages();
    return () => {
      mounted = false;
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    let mounted = true;
    const timer = window.setInterval(async () => {
      try {
        const rows = await fetchOwnerConversationMessages(selectedConversationId, 100);
        if (mounted) setMessages(rows);
      } catch {
        // fail-soft polling
      }
    }, 8000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [selectedConversationId]);

  const handleReply = async () => {
    const text = reply.trim();
    if (!text || !selectedConversationId) return;

    try {
      setSending(true);
      setError('');
      await sendOwnerReply({
        conversation_id: selectedConversationId,
        message: text,
      });
      setReply('');

      const rows = await fetchOwnerConversationMessages(selectedConversationId, 100);
      setMessages(rows);
      const refreshedInbox = await fetchOwnerInbox(50);
      setInbox(refreshedInbox);
    } catch (err) {
      console.error(err);
      setError('Yanıt gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (v?: string) => {
    if (!v) return '';
    try {
      return new Date(v).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return v;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-orange-50">
      <TopNavigation />

      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Mesaj Kutum</h1>
            <p className="text-gray-600">İlanlarınıza gelen mesajları buradan yönetebilirsiniz.</p>
          </div>
          <button
            onClick={() => navigate('/profile/listings')}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            İlanlarıma Dön
          </button>
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 border border-red-200">{error}</div>}

        {loading ? (
          <div className="bg-white rounded-2xl shadow p-8 text-gray-500">Mesaj kutusu yükleniyor...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow p-4 lg:col-span-1 max-h-[70vh] overflow-auto">
              <h2 className="font-semibold text-gray-900 mb-3">Konuşmalar</h2>
              {inbox.length === 0 ? (
                <p className="text-sm text-gray-500">Henüz mesaj yok.</p>
              ) : (
                <div className="space-y-2">
                  {inbox.map((item) => {
                    const active = item.id === selectedConversationId;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedConversationId(item.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          active ? 'border-teal-300 bg-teal-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.sender_name || 'Alıcı'}
                          </p>
                          {(item.owner_unread_count || 0) > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              {item.owner_unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 truncate">{item.last_message_preview || 'Mesaj yok'}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{formatDate(item.last_message_at)}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow p-4 lg:col-span-2 flex flex-col min-h-[70vh]">
              {!selectedConversationId ? (
                <div className="text-gray-500">Bir konuşma seçin.</div>
              ) : (
                <>
                  <div className="border-b border-gray-100 pb-3 mb-3">
                    <p className="text-sm text-gray-500">Konuşma</p>
                    <p className="font-semibold text-gray-900">
                      {selectedConversation?.sender_name || 'Alıcı'}
                    </p>
                  </div>

                  <div className="flex-1 overflow-auto space-y-3 pr-1">
                    {loadingMessages ? (
                      <p className="text-sm text-gray-500">Mesajlar yükleniyor...</p>
                    ) : messages.length === 0 ? (
                      <p className="text-sm text-gray-500">Mesaj bulunamadı.</p>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[85%] p-3 rounded-2xl ${
                            m.sender_role === 'owner'
                              ? 'ml-auto bg-teal-600 text-white'
                              : 'mr-auto bg-gray-100 text-gray-800'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                          <p className={`text-[11px] mt-1 ${m.sender_role === 'owner' ? 'text-teal-100' : 'text-gray-500'}`}>
                            {formatDate(m.created_at)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 mt-3">
                    <div className="flex gap-2">
                      <textarea
                        rows={2}
                        value={reply}
                        onChange={(e) => setReply(e.target.value.slice(0, 3000))}
                        placeholder="Yanıt yazın..."
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-300"
                      />
                      <button
                        onClick={() => void handleReply()}
                        disabled={sending || !reply.trim()}
                        className="px-4 py-2 rounded-xl bg-teal-600 text-white font-semibold disabled:opacity-60"
                      >
                        {sending ? 'Gönderiliyor...' : 'Gönder'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer />
      <ChatBox />
    </div>
  );
}
