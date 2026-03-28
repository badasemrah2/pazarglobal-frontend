import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import VoiceChat from './VoiceChat';
import VoiceSelector from './VoiceSelector';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import './ChatBox.css';
import { conditionBadgeClass, toCanonicalCondition } from '../../lib/condition';
import { fetchPublicContactLink } from '../../services/agentApi';
import { buildListingPath } from '../../lib/seo';

type Message = {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  listings?: any[]; // İlan bilgileri için
};

type Tab = 'general' | 'listing' | 'support';

// Supabase client is shared via src/lib/supabase to avoid multiple GoTrue instances.
const PUBLIC_BUCKET = 'product-images';
const AGENT_API_BASE =
  (import.meta.env as any).VITE_AGENT_API_BASE?.trim() ||
  (import.meta.env as any).NEXT_PUBLIC_AGENT_API_BASE?.trim() ||
  '';

const isInvalidRefreshTokenError = (error: any): boolean => {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('invalid refresh token') || message.includes('refresh token not found');
};

const getAccessTokenOrThrow = async (): Promise<string> => {
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.data?.session?.access_token) {
    return sessionResult.data.session.access_token;
  }

  const refreshResult = await supabase.auth.refreshSession();
  if (refreshResult.data?.session?.access_token) {
    return refreshResult.data.session.access_token;
  }

  if (isInvalidRefreshTokenError(sessionResult.error) || isInvalidRefreshTokenError(refreshResult.error)) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    throw new Error('Oturum süresi dolmuş görünüyor. Lütfen tekrar giriş yapın.');
  }

  throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
};

const getVerifiedWebchatUserContext = async (
  fallbackUserId: string,
  fallbackPhone?: string
): Promise<{ userId: string; phone?: string; accessToken: string }> => {
  const accessToken = await getAccessTokenOrThrow();

  const { data: userData, error } = await supabase.auth.getUser(accessToken);
  if (error || !userData?.user?.id) {
    throw new Error('Kimlik doğrulaması başarısız. Lütfen tekrar giriş yapın.');
  }

  return {
    userId: userData.user.id,
    phone: fallbackPhone,
    accessToken,
  };
};

// Generate or retrieve unique user ID
const getUserId = (): string => {
  let userId = localStorage.getItem('web_user_id');
  if (!userId) {
    userId = `web_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('web_user_id', userId);
  }
  return userId;
};

// Parse listing data from message
const parseListings = (content: string): { cleanContent: string; listings: any[] } => {
  const searchCacheMatch = content.match(/\[SEARCH_CACHE\]({.*})/s);
  if (searchCacheMatch) {
    try {
      const cacheData = JSON.parse(searchCacheMatch[1]);
      const cleanContent = content.replace(/\[SEARCH_CACHE\].*$/s, '').trim();
      return { cleanContent, listings: cacheData.results || [] };
    } catch (e) {
      console.error('Failed to parse listings:', e);
    }
  }
  return { cleanContent: content, listings: [] };
};

const toClickableMarkdown = (content: string): string => {
  if (!content) return '';

  // Convert only plain http/https URLs to markdown links so ReactMarkdown renders them clickable.
  // IMPORTANT: Do not touch URLs that are already inside markdown links/images like [text](url) or ![alt](url).
  // Example: "Mesaj Gönder: https://..." -> "Mesaj Gönder: [https://...](https://...)"
  return content.replace(/(^|[\s>])(https?:\/\/[^\s<>()\[\]]+)/g, (fullMatch: string, prefix: string, rawUrl: string) => {
    const trailingMatch = rawUrl.match(/[.,!?;:]+$/);
    const trailing = trailingMatch ? trailingMatch[0] : '';
    const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;

    if (!url) return fullMatch;

    return `${prefix}[${url}](${url})${trailing}`;
  });
};

// Deduplicate path list (keeps order of first occurrence)
const dedupePaths = (paths: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of paths) {
    if (p && !seen.has(p)) {
      seen.add(p);
      result.push(p);
    }
  }
  return result;
};

// Resim sıkıştırma fonksiyonu
const compressImage = async (file: File, maxSizeMB: number = 0.9): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maksimum boyut kontrolü (uzun kenar max 1920px)
        const maxDimension = 1920;
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Kalite ayarı ile sıkıştırma
        const quality = 0.9;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;

        const tryCompress = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Resim sıkıştırılamadı'));
                return;
              }

              // Eğer boyut hala büyükse, kaliteyi düşür
              if (blob.size > maxSizeBytes && q > 0.1) {
                tryCompress(q - 0.1);
              } else {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              }
            },
            'image/jpeg',
            q
          );
        };

        tryCompress(quality);
      };
      img.onerror = () => reject(new Error('Resim yüklenemedi'));
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
  });
};

// Supabase'e resim yükleme fonksiyonu
const uploadImageToSupabase = async (file: File, userId: string): Promise<{ storagePath: string; publicUrl: string }> => {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
  
  // Kullanıcı telefon numarasını almaya çalış
  let userPhone = userId;
  try {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', userId)
      .single();
    
    if (profileData?.phone) {
      userPhone = profileData.phone.replace(/\D/g, '');
    }
  } catch (err) {
    console.error('Telefon numarası alınamadı, userId kullanılacak:', err);
  }

  // Geçici listing ID (gerçek ID agent tarafından oluşturulacak)
  const tempListingId = `webchat_${Date.now()}`;
  
  // Path: userPhone/listing_id/image.jpg
  const storagePath = `${userPhone}/${tempListingId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(storagePath, file);

  if (uploadError) {
    console.error('Supabase upload error:', uploadError);
    throw new Error(`Resim yüklenemedi: ${uploadError.message}`);
  }

  // Public URL oluştur
  const { data: publicUrlData } = supabase.storage
    .from(PUBLIC_BUCKET)
    .getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: publicUrlData.publicUrl
  };
};

export default function ChatBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, customUser } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('listing');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: 'Merhaba! Ben PazarAI. Size nasıl yardımcı olabilirim? İlan vermek için fotoğraf gönderebilir veya ürününüzü anlatabilirsiniz.',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(3);
  const [detailListing, setDetailListing] = useState<any>(null);
  const [detailContactLoading, setDetailContactLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentMessageRef = useRef<string>('');
  const conversationHistory = useRef<Array<{ role: string; content: string }>>([]);
  const pendingMediaPathsRef = useRef<string[]>([]);
  const pendingMediaPublicMapRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const search = location.search || '';
    if (!search) return;

    const params = new URLSearchParams(search);
    if (params.get('openChat') === '1') {
      setIsOpen(true);
    }
  }, [location.search]);

  const clearPendingMedia = () => {
    pendingMediaPathsRef.current = [];
    pendingMediaPublicMapRef.current = {};
  };

  const addPendingMediaItems = (items: Array<{ path: string; publicUrl?: string }>) => {
    if (!items || items.length === 0) return;
    const mapSnapshot = { ...pendingMediaPublicMapRef.current };
    const incomingPaths: string[] = [];
    items.forEach(({ path, publicUrl }) => {
      if (!path) return;
      incomingPaths.push(path);
      if (publicUrl) {
        mapSnapshot[path] = publicUrl;
      } else if (!mapSnapshot[path]) {
        mapSnapshot[path] = path;
      }
    });
    const merged = dedupePaths([...pendingMediaPathsRef.current, ...incomingPaths]);
    const filteredMap: Record<string, string> = {};
    merged.forEach((path) => {
      filteredMap[path] = mapSnapshot[path] || path;
    });
    pendingMediaPathsRef.current = merged;
    pendingMediaPublicMapRef.current = filteredMap;
  };

  const getPublicUrlsForPaths = (paths: string[]) => {
    if (!paths || paths.length === 0) return [];
    return paths.map((path) => pendingMediaPublicMapRef.current[path] || path);
  };

  const commitAssistantResponse = (rawContent: string, aiMessageId?: string, forcedListings?: any[]) => {
    const { cleanContent, listings } = parseListings(rawContent || '');
    const resolvedListings = forcedListings && forcedListings.length > 0 ? forcedListings : listings;

    if (!cleanContent && (!resolvedListings || resolvedListings.length === 0)) {
      return;
    }

    if (cleanContent) {
      conversationHistory.current.push({
        role: 'assistant',
        content: cleanContent,
      });

      const lc = cleanContent.toLowerCase();
      if (lc.includes('ilan yayınlandı') || lc.includes('✅ ilan yayınlandı')) {
        clearPendingMedia();
      }
      if (lc.includes('iptal edildi') || lc.startsWith('iptal') || lc.includes('işlemi iptal')) {
        clearPendingMedia();
      }
    }

    setMessages((prev) => {
      const updated = [...prev];
      if (aiMessageId) {
        const existingIndex = updated.findIndex((m) => m.id === aiMessageId);
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            content: cleanContent,
            listings: resolvedListings && resolvedListings.length > 0 ? resolvedListings : undefined,
          };
          return updated;
        }
      }

      return [
        ...updated,
        {
          id: aiMessageId || `${Date.now()}`,
          type: 'ai',
          content: cleanContent,
          timestamp: new Date(),
          listings: resolvedListings && resolvedListings.length > 0 ? resolvedListings : undefined,
        },
      ];
    });

    if (voiceMode && (window as any).speakResponse && cleanContent) {
      setTimeout(() => (window as any).speakResponse(cleanContent), 150);
    }
  };

  // Direct agent API sender
  const sendMessageToAgentDirect = async (
    message: string,
    mediaPayload: { storagePaths: string[]; publicUrls: string[] },
    resolvedUserId: string
  ) => {
    if (!AGENT_API_BASE) {
      throw new Error('VITE_AGENT_API_BASE tanımlı değil. Agent API adresini .env dosyanıza ekleyin.');
    }
    
    // Get authenticated user context
    const phoneNumber = customUser?.phone || user?.phone;
    const { userId: verifiedUserId, accessToken } = await getVerifiedWebchatUserContext(
      resolvedUserId,
      phoneNumber || undefined
    );
    
    // Use V3 API endpoint - Single LLM Brain
    const endpoint = `${AGENT_API_BASE.replace(/\/$/, '')}/api/v3/message`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,  // JWT token for security
      },
      body: JSON.stringify({
        user_id: verifiedUserId,
        message,
        media_urls: mediaPayload.publicUrls.length > 0 ? mediaPayload.publicUrls : undefined,
        channel: 'webchat',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '<failed to read response body>');
      throw new Error(`Agent hatası (${response.status}): ${errorText || response.statusText || 'Bilinmeyen hata'}`);
    }

    const json = await response.json();
    const assistantText = json.text || json.message || json.response || '';
    const listings = json.data?.listings || json.listings || json.listing_preview;
    if (assistantText) {
      commitAssistantResponse(assistantText, undefined, listings);
    }
    if (mediaPayload.publicUrls.length > 0) {
      clearPendingMedia();
    }
    return true;
  };

  const requestMediaAnalysis = async (storagePaths: string[], resolvedUserId: string) => {
    if (!AGENT_API_BASE || storagePaths.length === 0) {
      return false;
    }
    const publicUrls = getPublicUrlsForPaths(storagePaths);
    if (publicUrls.length === 0) {
      return false;
    }
    
    // Get authenticated user context
    const phoneNumber = customUser?.phone || user?.phone;
    const { userId: verifiedUserId, phone, accessToken } = await getVerifiedWebchatUserContext(
      resolvedUserId,
      phoneNumber || undefined
    );
    
    const endpoint = `${AGENT_API_BASE.replace(/\/$/, '')}/api/v3/webchat/media/analyze`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,  // JWT token for security
        },
        body: JSON.stringify({
          session_id: verifiedUserId,
          user_id: verifiedUserId,
          phone_number: phone || undefined,
          media_urls: publicUrls,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '<failed to read response body>');
        throw new Error(`Media analysis hatası (${response.status}): ${errorText || response.statusText || 'Bilinmeyen hata'}`);
      }

      const json = await response.json();
      const assistantText = json.message || json.response || '';
      if (assistantText) {
        commitAssistantResponse(assistantText, undefined, json.data?.listings);
      }

      // The backend /webchat/media/analyze endpoint already persists these media URLs into
      // the draft/session. Clear pending media so we don't resend the same URLs on the next
      // text message (which causes duplicated image counters / flow confusion).
      clearPendingMedia();
      return true;
    } catch (err) {
      console.error('Media analysis request failed:', err);
      return false;
    }
  };

  const sendMessageToAgent = async (message: string, options?: { mediaPaths?: string[]; mediaType?: string }) => {
    setIsTyping(true);
    setIsConnecting(true);
    setError(null);
    currentMessageRef.current = '';
    const storedUserId = localStorage.getItem('user_id');
    const resolvedUserId = customUser?.id || user?.id || storedUserId || getUserId();

    conversationHistory.current.push({
      role: 'user',
      content: message,
    });

    const mediaStoragePaths = dedupePaths(options?.mediaPaths || []);
    const mediaPublicUrls = getPublicUrlsForPaths(mediaStoragePaths);
    try {
      await sendMessageToAgentDirect(
        message,
        { storagePaths: mediaStoragePaths, publicUrls: mediaPublicUrls },
        resolvedUserId
      );
      setIsTyping(false);
      setIsConnecting(false);
      return;
    } catch (err: any) {
      console.error('Agent bağlantı hatası:', err);

      let errorMessage = 'Bağlantı hatası. Lütfen tekrar deneyin.';

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = 'Agent API adresine ulaşılamıyor. CORS veya network hatası olabilir.';
      } else if (String(err?.message || '').toLowerCase().includes('oturum')) {
        errorMessage = 'Oturum süreniz dolmuş olabilir. Lütfen tekrar giriş yapın.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setIsTyping(false);
      setIsConnecting(false);

      const errorAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: "⚠️ Üzgünüm, şu anda Agent API'ye bağlanamıyorum. Backend'in çalıştığından ve VITE_AGENT_API_BASE'in doğru olduğundan emin olduktan sonra tekrar deneyin.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorAiMessage]);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    const messageToSend = inputValue;
    setInputValue('');

    if (messageToSend.toLowerCase().trim().startsWith('iptal')) {
      clearPendingMedia();
    }
    
    // Include any pending media from image uploads
    const mediaPaths = pendingMediaPathsRef.current || [];
    
    // Send to agent backend
    const options = mediaPaths.length > 0 ? { mediaPaths, mediaType: 'image' } : undefined;
    sendMessageToAgent(messageToSend, options);
  };

  const handleQuickAction = (action: string) => {
    const quickMessages: Record<string, string> = {
      'create': 'Yeni bir ilan oluşturmak istiyorum',
      'price': 'Ürünüm için fiyat önerisi alabilir miyim?',
      'improve': 'İlan metnini iyileştirmek istiyorum',
      'search': 'Tüm ilanları göster',
      'seller': 'Satıcı bulmak istiyorum',
      'help': 'Yardım almak istiyorum',
    };

    const message = quickMessages[action];
    if (message) {
      const newMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
      sendMessageToAgent(message);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // allow selecting the same file again
    e.target.value = '';

    if (files.length === 0) return;

    // Desteklenen formatları kontrol et
    const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const unsupportedFiles = imageFiles.filter(f => !supportedFormats.includes(f.type));
    
    if (unsupportedFiles.length > 0) {
      const formatNames = unsupportedFiles.map(f => f.name.split('.').pop()?.toUpperCase()).join(', ');
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: `⚠️ Desteklenmeyen format: ${formatNames}\n\nDesteklenen formatlar: JPG, PNG, GIF, WebP\n\nLütfen resmi farklı formatta kaydedin.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }
    
    const validImageFiles = imageFiles.filter(f => supportedFormats.includes(f.type));
    if (validImageFiles.length === 0) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: '⚠️ Lütfen sadece fotoğraf yükleyin (JPG, PNG, GIF, WebP).',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    // LIMIT: Maximum 5 photos per upload (user-friendly limit)
    if (validImageFiles.length > 5) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'ai',
        content: `⚠️ Tek seferde en fazla 5 fotoğraf yükleyebilirsiniz. İlk 5 tanesi yüklenecek.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
    const limitedFiles = validImageFiles.slice(0, 5);

    const run = async () => {
      const resolvedUserId = customUser?.id || user?.id || localStorage.getItem('user_id') || getUserId();
      const uploadedItems: Array<{ path: string; publicUrl: string }> = [];

      setIsTyping(true);
      try {
        for (const file of limitedFiles) {
          try {
            const fileSizeMB = file.size / (1024 * 1024);
            let uploadFile = file;
            if (fileSizeMB > 0.9) {
              uploadFile = await compressImage(file, 0.9);
            }

            const { storagePath, publicUrl } = await uploadImageToSupabase(uploadFile, resolvedUserId);
            uploadedItems.push({ path: storagePath, publicUrl });

            const uploadedMessage: Message = {
              id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
              type: 'user',
              content: `📷 ${file.name} yüklendi (${(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, uploadedMessage]);

            console.log('📸 Uploading image - storagePath:', storagePath, 'publicUrl:', publicUrl);
          } catch (uploadErr: any) {
            console.error('Upload error:', uploadErr);
            const errorMessage: Message = {
              id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
              type: 'ai',
              content: `⚠️ Görsel yüklenemedi: ${uploadErr?.message || 'Bilinmeyen hata'}`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
          }
        }

        if (uploadedItems.length > 0) {
          addPendingMediaItems(uploadedItems);
          const uniquePaths = dedupePaths(uploadedItems.map((item) => item.path));
          const analysisShown = await requestMediaAnalysis(uniquePaths, resolvedUserId);
          if (!analysisShown) {
            const intentQuestion: Message = {
              id: `${Date.now()}_intent_q`,
              type: 'ai',
              content: `📸 ${uniquePaths.length} fotoğraf başarıyla yüklendi!\n\nBu ürün için ne yapmak istiyorsunuz?\n• 📝 İlan oluşturmak (satmak)\n• 🔍 Benzer ürünleri aramak`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, intentQuestion]);
          }
        }
      } finally {
        setIsTyping(false);
      }
    };

    run();

    // Note: video support removed here; this input only accepts images
  };

  const toggleVoiceMode = () => {
    setVoiceMode(!voiceMode);
  };

  const handleVoiceTranscript = (text: string) => {
    // Add corrected voice text as user message
    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    
    // Send to agent
    sendMessageToAgent(text);
  };

  // Removed: Speech is now triggered immediately in sendMessageToAgent

  const quickActions = [
    { id: 'create', icon: 'ri-add-circle-line', label: 'İlan Oluştur', color: 'from-purple-500 to-blue-500' },
    { id: 'search', icon: 'ri-search-line', label: 'İlan Ara', color: 'from-cyan-500 to-green-500' },
    { id: 'improve', icon: 'ri-edit-line', label: 'Metni İyileştir', color: 'from-orange-500 to-pink-500' },
  ];

  // Message grouping (WhatsApp style)
  const groupMessages = (messages: Message[]) => {
    const grouped: Message[][] = [];
    let currentGroup: Message[] = [];
    let lastType: 'user' | 'ai' | null = null;

    messages.forEach((msg, idx) => {
      const timeDiff = idx > 0 
        ? (new Date(msg.timestamp).getTime() - new Date(messages[idx - 1].timestamp).getTime()) / 1000 
        : 0;

      // Group if same type and within 60 seconds
      if (msg.type === lastType && timeDiff < 60) {
        currentGroup.push(msg);
      } else {
        if (currentGroup.length > 0) {
          grouped.push(currentGroup);
        }
        currentGroup = [msg];
        lastType = msg.type;
      }
    });

    if (currentGroup.length > 0) {
      grouped.push(currentGroup);
    }

    return grouped;
  };

  const renderListingCard = (listing: any) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const imageUrls = listing.signed_images?.map((imagePath: string) => {
      if (imagePath.startsWith('http')) {
        return imagePath;
      }
      return `${supabaseUrl}/storage/v1/object/public/product-images/${imagePath}`;
    }) || [];

    const mainImage = imageUrls[0] || 'https://readdy.ai/api/search-image?query=product%20placeholder%20simple%20clean%20background&width=400&height=300&seq=placeholder&orientation=landscape';

    return (
      <motion.div
        key={listing.id}
        whileHover={{ scale: 1.02 }}
        onClick={() => setDetailListing(listing)}
        className={`listing-card ${listing.is_premium ? 'listing-card-premium' : ''}`}
      >
        <div className="flex items-start space-x-4">
          {/* Thumbnail with badges */}
          <div className="listing-card-image">
            <img
              src={mainImage}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            {/* Premium Badge */}
            {listing.is_premium && (
              <div className="listing-card-badge">
                {(() => {
                  const badge = String(listing.premium_badge || '').trim().toLowerCase();
                  const ui =
                    badge === 'gold'
                      ? { icon: 'ri-arrow-up-line', label: 'GOLD' }
                      : badge === 'platinum'
                        ? { icon: 'ri-vip-crown-line', label: 'PLATINUM' }
                        : badge === 'diamond'
                          ? { icon: 'ri-vip-diamond-fill', label: 'DIAMOND' }
                          : { icon: 'ri-vip-crown-fill', label: 'PREMIUM' };
                  return (
                    <>
                      <i className={ui.icon} />
                      <span>{ui.label}</span>
                    </>
                  );
                })()}
              </div>
            )}
            {/* Photo count */}
            {imageUrls.length > 1 && (
              <div className="listing-card-photo-count">
                <i className="ri-image-line text-xs" />
                <span>{imageUrls.length}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <h4 className="text-base font-bold text-gray-900 mb-1 line-clamp-2">
              {listing.title}
            </h4>
            
            {/* Price */}
            <div className="flex items-baseline space-x-2 mb-2">
              <span className="text-2xl font-extrabold text-purple-600">
                {listing.price?.toLocaleString('tr-TR')} ₺
              </span>
            </div>

            {/* Meta tags */}
            <div className="flex flex-wrap gap-2 mb-2">
              {listing.category && (
                <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  <i className="ri-price-tag-3-fill mr-1 text-xs" />
                  {listing.category}
                </span>
              )}
              
              {listing.condition && (
                <span
                  className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${conditionBadgeClass(
                    listing.condition
                  )}`}
                >
                  {toCanonicalCondition(listing.condition)}
                </span>
              )}

              {listing.location && (
                <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                  <i className="ri-map-pin-line mr-1 text-xs" />
                  {listing.location}
                </span>
              )}
            </div>

            {/* View count & timestamp */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center space-x-1">
                <i className="ri-eye-line" />
                <span>{listing.view_count || 0} görüntülenme</span>
              </span>
              {listing.created_at && (
                <span>{formatDistanceToNow(new Date(listing.created_at), { locale: tr, addSuffix: true })}</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Inline detail modal
  const renderListingDetailModal = () => {
    if (!detailListing) return null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const imageUrls = detailListing.signed_images?.map((imagePath: string) => {
      if (imagePath.startsWith('http')) {
        return imagePath;
      }
      return `${supabaseUrl}/storage/v1/object/public/product-images/${imagePath}`;
    }) || [];

    const handleDetailContact = async () => {
      const listingId = String(detailListing?.id || '').trim();
      if (!listingId || detailContactLoading) return;
      try {
        setDetailContactLoading(true);
        const path = `/contact/listing/${encodeURIComponent(listingId)}`;
        setDetailListing(null);
        setIsOpen(false);
        navigate(path);
      } catch {
        alert('Mesaj bağlantısı oluşturulamadı. Lütfen tekrar deneyin.');
      } finally {
        setDetailContactLoading(false);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-overlay"
        onClick={() => setDetailListing(null)}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Image Carousel */}
          {imageUrls.length > 0 && (
            <div className="relative h-80 bg-gray-900">
              <Swiper
                pagination={{ clickable: true }}
                navigation
                modules={[Pagination, Navigation]}
                className="h-full"
              >
                {imageUrls.map((img: string, idx: number) => (
                  <SwiperSlide key={idx}>
                    <img src={img} alt={`${detailListing.title} - ${idx + 1}`} className="w-full h-80 object-contain" />
                  </SwiperSlide>
                ))}
              </Swiper>
              
              <button
                onClick={() => setDetailListing(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                aria-label="Modal'ı kapat"
                title="Kapat"
              >
                <i className="ri-close-line text-2xl" />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Title & Price */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {detailListing.title}
              </h2>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold text-purple-600">
                  {detailListing.price?.toLocaleString('tr-TR')} ₺
                </span>
              </div>
            </div>

            {/* Description */}
            {detailListing.description && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Açıklama</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {detailListing.description}
                </p>
              </div>
            )}

            {/* Metadata */}
            {detailListing.metadata && Object.keys(detailListing.metadata).length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(detailListing.metadata).map(([key, value]) => (
                  <div key={key} className="bg-purple-50 rounded-lg p-3">
                    <span className="text-xs text-purple-600 font-medium uppercase">{key}</span>
                    <p className="text-gray-900 font-semibold mt-1">{String(value)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={() => void handleDetailContact()}
                disabled={detailContactLoading}
                className="flex-1 bg-gradient-primary hover:opacity-90 text-white font-semibold py-3 rounded-xl flex items-center justify-center space-x-2 transition-colors disabled:opacity-60"
              >
                <i className="ri-message-3-line text-xl" />
                <span>{detailContactLoading ? 'Hazırlanıyor...' : 'Mesaj Gönder'}</span>
              </button>
              <button 
                onClick={() => {
                  navigate(buildListingPath(detailListing.id, detailListing.title));
                  setDetailListing(null);
                  setIsOpen(false);
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center space-x-2 transition-colors"
              >
                <i className="ri-external-link-line text-xl" />
                <span>Detayları Gör</span>
              </button>
              <button 
                className="w-12 h-12 bg-pink-100 hover:bg-pink-200 text-pink-600 rounded-xl flex items-center justify-center transition-colors"
                aria-label="Favorilere ekle"
                title="Favorilere Ekle"
              >
                <i className="ri-heart-line text-xl" />
              </button>
              <button 
                className="w-12 h-12 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl flex items-center justify-center transition-colors"
                aria-label="İlanı paylaş"
                title="Paylaş"
              >
                <i className="ri-share-line text-xl" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const renderListingCards = (listings: any[]) => {
    return (
      <div className="space-y-3 mt-2">
        {listings.slice(0, displayCount).map((listing) => renderListingCard(listing))}

        {/* Daha Fazla Göster Butonu */}
        {listings.length > displayCount && (
          <button
            onClick={() => setDisplayCount(prev => prev + 3)}
            className="w-full py-2 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
          >
            Daha fazla göster ({listings.length - displayCount} ilan daha)
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {/* FAB Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-primary rounded-full shadow-2xl flex items-center justify-center z-50 hover:scale-110 transition-transform animate-pulse-slow cursor-pointer"
          >
            <i className="ri-chat-ai-line text-3xl text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed inset-0 z-50 flex h-[100dvh] w-screen flex-col overflow-hidden bg-white md:inset-auto md:bottom-6 md:right-6 md:h-[700px] md:w-[440px] md:rounded-3xl md:shadow-2xl"
          >
            {/* Header */}
            <div className="bg-gradient-primary p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <i className="ri-robot-2-fill text-2xl text-white" />
                </div>
                <div>
                  <div className="text-white font-semibold">PazarAI Asistan</div>
                  <div className="flex items-center space-x-1 text-white/80 text-xs">
                    <div className={`w-2 h-2 rounded-full ${isConnecting ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse`} />
                    <span>{isConnecting ? 'Bağlanıyor...' : 'Çevrimiçi'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {/* Voice Selector - Shows when voice mode is enabled */}
                {voiceMode && (
                  <VoiceSelector
                    selectedVoice={selectedVoice}
                    onVoiceSelect={setSelectedVoice}
                  />
                )}
                
                <button
                  onClick={toggleVoiceMode}
                  title={voiceMode ? "Sesli Modu Kapat" : "Sesli Modu Aç"}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    voiceMode ? 'bg-white/30 text-white' : 'hover:bg-white/20 text-white/80'
                  }`}
                >
                  <i className={`${voiceMode ? 'ri-volume-up-fill' : 'ri-volume-mute-line'} text-xl`} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Küçült"
                  className="w-8 h-8 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                >
                  <i className="ri-subtract-line text-white text-xl" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Kapat"
                  className="w-8 h-8 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-white text-xl" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              {[
                { id: 'general', label: 'Genel Sohbet' },
                { id: 'listing', label: 'İlan Asistanı' },
                { id: 'support', label: 'Destek' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors relative whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id ? 'text-purple-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-primary"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Error Banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <i className="ri-error-warning-line text-red-500" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700 cursor-pointer"
                  aria-label="Hatayı kapat"
                >
                  <i className="ri-close-line" />
                </button>
              </motion.div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {groupMessages(messages).map((group, groupIdx) => {
                const isUser = group[0].type === 'user';
                return (
                  <motion.div
                    key={`group-${groupIdx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="flex space-x-2 max-w-[85%]">
                      {/* Avatar - Show only for first message in group */}
                      {!isUser && (
                        <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 self-start">
                          <i className="ri-robot-2-fill text-white text-lg" />
                        </div>
                      )}
                      
                      <div className="space-y-1 flex-1">
                        {group.map((message, msgIdx) => {
                          // Parse listings from message content
                          let listings: any[] = [];
                          let cleanContent = message.content;
                          
                          const cacheMatch = message.content.match(/\[SEARCH_CACHE\]({.*})/s);
                          if (cacheMatch) {
                            try {
                              const cacheData = JSON.parse(cacheMatch[1]);
                              listings = cacheData.results || [];
                              cleanContent = message.content.replace(/\[SEARCH_CACHE\]({.*})/s, '').trim();
                            } catch (e) {
                              console.error('Failed to parse listings:', e);
                            }
                          }

                          return (
                            <div key={message.id} className="space-y-2">
                              <div
                                className={`message-bubble rounded-2xl px-4 py-3 ${
                                  isUser
                                    ? 'message-user bg-gradient-primary text-white'
                                    : 'message-ai bg-white text-gray-800 shadow-md'
                                }`}
                              >
                                {isUser ? (
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {cleanContent.replace(/\n{3,}/g, '\n\n').trim()}
                                  </p>
                                ) : (
                                  <ReactMarkdown
                                    className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5"
                                    components={{
                                      code({ inline, children, ...props }: any) {
                                        return inline ? (
                                          <code className="bg-purple-50 text-purple-700 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                                            {children}
                                          </code>
                                        ) : (
                                          <code className="block bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-x-auto" {...props}>
                                            {children}
                                          </code>
                                        );
                                      },
                                      a({ href, children, ...props }: any) {
                                        return (
                                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline" {...props}>
                                            {children}
                                          </a>
                                        );
                                      },
                                      img({ src, alt, ...props }: any) {
                                        return (
                                          <img
                                            src={src || ''}
                                            alt={alt || ''}
                                            className="my-2 rounded-lg max-h-64 w-full object-cover"
                                            {...props}
                                          />
                                        );
                                      },
                                    }}
                                  >
                                    {toClickableMarkdown(cleanContent.replace(/\n{3,}/g, '\n\n').trim())}
                                  </ReactMarkdown>
                                )}
                              </div>

                              {/* Listing Cards */}
                              {listings.length > 0 && renderListingCards(listings)}
                            
                              {/* Timestamp - Show only on last message of group */}
                              {msgIdx === group.length - 1 && (
                                <div className={`text-xs text-gray-400 px-2 ${isUser ? 'text-right' : 'text-left'}`}>
                                  {formatDistanceToNow(new Date(message.timestamp), { locale: tr, addSuffix: true })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Avatar for user - Show on right */}
                      {isUser && (
                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 self-start">
                          <i className="ri-user-line text-white text-lg" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start items-start space-x-2"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0">
                    <i className="ri-robot-2-fill text-white text-lg" />
                  </div>
                  <div className="bg-white rounded-2xl px-5 py-4 shadow-md">
                    <div className="flex items-center space-x-3">
                      {/* Animated magnifying glass icon */}
                      <motion.div
                        animate={{
                          rotate: [0, 10, -10, 10, 0],
                          scale: [1, 1.1, 1, 1.1, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        className="text-purple-600"
                      >
                        <i className="ri-search-line text-2xl" />
                      </motion.div>
                      
                      {/* Loading text with dots animation */}
                      <div className="flex items-center space-x-1">
                        <span className="text-sm text-gray-700 font-medium">İlan aranıyor</span>
                        <div className="flex space-x-1">
                          <motion.span
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                            className="text-gray-700"
                          >
                            .
                          </motion.span>
                          <motion.span
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                            className="text-gray-700"
                          >
                            .
                          </motion.span>
                          <motion.span
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                            className="text-gray-700"
                          >
                            .
                          </motion.span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Quick Actions */}
              {activeTab === 'listing' && messages.length <= 2 && !isTyping && (
                <div className="space-y-2 pt-4">
                  <p className="text-xs text-gray-500 text-center mb-3">Hızlı İşlemler</p>
                  {quickActions.map((action, index) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => handleQuickAction(action.id)}
                      className={`w-full py-3 px-4 bg-gradient-to-r ${action.color} text-white rounded-xl hover:shadow-lg transition-all flex items-center space-x-3 whitespace-nowrap cursor-pointer`}
                    >
                      <i className={`${action.icon} text-xl`} />
                      <span className="text-sm font-medium">{action.label}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-4">
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 flex items-center justify-center space-x-3 py-2"
                >
                  <div className="flex space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1 bg-red-500 rounded-full"
                        animate={{ height: [8, 24, 8] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-red-500 font-medium">Kaydediliyor...</span>
                </motion.div>
              )}

              <div className="flex min-w-0 items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  aria-label="Fotoğraf seç"
                />
                <button
                  onClick={handleFileUpload}
                  disabled={isTyping}
                  className="h-10 w-10 shrink-0 cursor-pointer rounded-full text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center"
                  aria-label="Fotoğraf yükle"
                >
                  <i className="ri-attachment-line text-xl" />
                </button>

                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={voiceMode ? "🎤 Sesli mod aktif - Mikrofona konuşun veya yazın" : "Mesajınızı yazın..."}
                  disabled={isTyping}
                  className="min-w-0 flex-1 resize-none rounded-full border border-gray-300 px-4 py-2 text-sm transition-colors focus:border-purple-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  rows={1}
                />

                {/* Voice Chat Button (when voice mode active) */}
                {voiceMode && (
                  <div className="relative">
                    <VoiceChat
                      onTranscriptReady={handleVoiceTranscript}
                      isEnabled={voiceMode}
                      selectedVoice={selectedVoice}
                    />
                  </div>
                )}
                
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isTyping}
                  title="Gönder"
                  className="h-10 w-10 shrink-0 cursor-pointer rounded-full bg-gradient-primary text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center"
                >
                  <i className="ri-send-plane-fill text-lg" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline Detail Modal */}
      <AnimatePresence>
        {detailListing && renderListingDetailModal()}
      </AnimatePresence>
    </>
  );
}


