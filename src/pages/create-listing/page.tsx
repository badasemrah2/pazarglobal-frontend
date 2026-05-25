import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import TopNavigation from '../../components/feature/TopNavigation';
import Footer from '../home/components/Footer';
import ChatBox from '../../components/feature/ChatBox';
import { supabase } from '../../lib/supabase';
import { generateListingKeywordsFallback } from '../../lib/listingKeywords';
import { toCanonicalCondition } from '../../lib/condition';
import { useAuthStore } from '../../stores/authStore';
import { fetchCategoryOptions } from '../../services/agentApi';
import { FALLBACK_CATEGORY_OPTIONS } from '../../constants/categories';
import { buildListingPath } from '../../lib/seo';

type FormData = {
  title: string;
  description: string;
  price: string;
  category: string;
  condition: string;
  location: string;
};

type UploadedMediaItem = {
  file: File;
  previewUrl: string;
  kind: 'image' | 'video';
};

const SUPPORTED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_MEDIA_ITEMS = 10;
const MAX_TOTAL_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_SIZE_MB = 0.9;

const conditions = [
  'Sıfır',
  '2. El',
  'Az Kullanılmış'
];

// AI Suggestions based on category
const titleSuggestions: Record<string, string[]> = {
  'Otomotiv': [
    'Temiz Bakımlı [Marka] [Model]',
    'Sıfır Ayarında [Araç Tipi]',
    'Az Km\'de Hasarsız [Marka]'
  ],
  'Elektronik': [
    'Sıfır Kutusunda [Ürün]',
    'Garantili [Marka] [Model]',
    'Hiç Kullanılmamış [Ürün]'
  ],
  'Ev & Yaşam': [
    'Tertemiz [Ürün]',
    'Az Kullanılmış [Ürün]',
    'Sıfır Gibi [Ürün]'
  ],
  'Moda & Aksesuar': [
    'Orijinal [Marka] [Ürün]',
    'Hiç Giyilmedi [Ürün]',
    'Etiketli [Marka] [Ürün]'
  ],
  'Spor & Outdoor': [
    'Az Kullanılmış [Ürün]',
    'Profesyonel [Ürün]',
    'Sıfır Ayarında [Ürün]'
  ],
  'Kitap & Hobi': [
    'Koleksiyon [Ürün]',
    'Nadir Bulunan [Ürün]',
    'Yeni [Ürün]'
  ],
  'Mobilya': [
    'Sıfır Gibi [Ürün]',
    'Lüks [Ürün]',
    'Temiz [Ürün]'
  ],
  'Diğer': [
    'Kaliteli [Ürün]',
    'Uygun Fiyat [Ürün]',
    'Acil Satılık [Ürün]'
  ]
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

        const quality = 0.9;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;

        const tryCompress = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Resim sıkıştırılamadı'));
                return;
              }

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

const formatMegabytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export default function CreateListingPage() {
  const [categories, setCategories] = useState(FALLBACK_CATEGORY_OPTIONS);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const opts = await fetchCategoryOptions();
        if (mounted && Array.isArray(opts) && opts.length > 0) {
          setCategories(opts);
        }
      } catch {
        // Keep fallback list
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const navigate = useNavigate();
  const [isScrolled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMediaItem[]>([]);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedMediaRef = useRef<UploadedMediaItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const { user, customUser } = useAuthStore();
  
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: '',
    location: '',
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});

  // AI Assistant States
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);

  useEffect(() => {
    uploadedMediaRef.current = uploadedMedia;
  }, [uploadedMedia]);

  useEffect(() => {
    return () => {
      uploadedMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const totalMediaBytes = uploadedMedia.reduce((sum, item) => sum + item.file.size, 0);

  // Kullanıcı girişi kontrolü - Hem Supabase hem WhatsApp auth
  useEffect(() => {
    const checkAuth = async () => {
      if (user) {
        setUserId(user.id);
        setAuthChecked(true);
        return;
      }

      if (customUser) {
        setUserId(customUser.id);
        setAuthChecked(true);
        return;
      }

      const sessionToken = localStorage.getItem('session_token');
      const storedUserId = localStorage.getItem('user_id');

      if (sessionToken && storedUserId) {
        try {
          const { data, error } = await supabase.functions.invoke('auth-verify', {
            body: { session_token: sessionToken }
          });

          if (!error && data.success) {
            setUserId(storedUserId);
            setAuthChecked(true);
            return;
          }
        } catch (err) {
          console.error('Session verification error:', err);
        }
      }

      try {
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();
        
        if (supabaseUser) {
          setUserId(supabaseUser.id);
          setAuthChecked(true);
          return;
        }
      } catch (err) {
        console.error('Supabase auth error:', err);
      }

      alert('İlan vermek için giriş yapmalısınız');
      navigate('/auth/login');
    };

    checkAuth();
  }, [navigate, user, customUser]);

  // Auth kontrolü tamamlanmadan form gösterme
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-purple-600 animate-spin" />
          <p className="text-sm text-gray-600 mt-4">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // AI: Generate Title Suggestions
  const generateTitleSuggestion = async () => {
    if (!formData.category) {
      alert('⚠️ Önce kategori seçin');
      return;
    }

    // Başlık boşsa, kullanıcıdan bilgi iste
    if (!formData.title.trim()) {
      alert('💡 İpucu: Önce ürününüz hakkında kısa bir başlık yazın (örn: "Laptop"), AI bunu iyileştirecek.');
      return;
    }
    
    setAiLoading(true);
    
    try {
      console.log('AI isteği gönderiliyor...', {
        category: formData.category,
        title: formData.title,
        condition: formData.condition
      });
      
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'suggest_title',
          category: formData.category,
          title: formData.title,
          condition: toCanonicalCondition(formData.condition) || '2. El'
        }
      });

      console.log('AI yanıtı:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Edge Function hatası');
      }

      if (data?.success) {
        handleInputChange('title', data.result);
        alert('✨ AI başlık önerisi uygulandı!');
      } else {
        throw new Error(data?.error || 'AI yanıt veremedi');
      }
    } catch (error: any) {
      console.error('AI error:', error);
      
      // Detaylı hata mesajı
      let errorMessage = 'AI önerisi alınamadı.';
      
      if (error.message?.includes('API anahtarı')) {
        errorMessage = '⚠️ OpenAI API anahtarı yapılandırılmamış!\n\nLütfen Supabase Dashboard\'a gidin:\n1. Edge Functions → Secrets\n2. OPENAI_API_KEY ekleyin\n3. Edge Function\'ı yeniden deploy edin';
      } else if (error.message?.includes('Failed to send')) {
        errorMessage = '⚠️ Edge Function\'a bağlanılamadı!\n\nLütfen kontrol edin:\n1. Edge Function deploy edildi mi?\n2. Supabase bağlantısı aktif mi?';
      } else if (error.message) {
        errorMessage = `Hata: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setAiLoading(false);
    }
  };

  // AI: Apply Title Suggestion
  const applyTitleSuggestion = (suggestion: string) => {
    handleInputChange('title', suggestion);
    setShowTitleSuggestions(false);
  };

  // AI: Improve Description
  const improveDescription = async () => {
    if (!formData.description.trim()) {
      alert('⚠️ Önce bir açıklama yazın, AI bunu iyileştirecek.');
      return;
    }

    setAiLoading(true);
    
    try {
      console.log('AI isteği gönderiliyor...', {
        category: formData.category,
        title: formData.title,
        description: formData.description
      });
      
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'improve_text',
          category: formData.category,
          title: formData.title,
          description: formData.description
        }
      });

      console.log('AI yanıtı:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Edge Function hatası');
      }

      if (data?.success) {
        handleInputChange('description', data.result);
        alert('🪄 Metniniz AI tarafından iyileştirildi!');
      } else {
        throw new Error(data?.error || 'AI yanıt veremedi');
      }
    } catch (error: any) {
      console.error('AI error:', error);
      
      let errorMessage = 'Metin iyileştirilemedi.';
      
      if (error.message?.includes('API anahtarı')) {
        errorMessage = '⚠️ OpenAI API anahtarı yapılandırılmamış!';
      } else if (error.message?.includes('Failed to send')) {
        errorMessage = '⚠️ Edge Function\'a bağlanılamadı!';
      } else if (error.message) {
        errorMessage = `Hata: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setAiLoading(false);
    }
  };

  // AI: Generate Description Template
  const generateDescriptionTemplate = async () => {
    if (!formData.category) {
      alert('⚠️ Önce kategori seçin');
      return;
    }

    // Başlık varsa daha iyi şablon üret
    if (!formData.title.trim()) {
      alert('💡 İpucu: Önce bir başlık yazın, AI daha iyi açıklama üretecek.');
      return;
    }
    
    setAiLoading(true);
    
    try {
      console.log('AI isteği gönderiliyor...', {
        category: formData.category,
        title: formData.title
      });
      
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'suggest_description',
          category: formData.category,
          title: formData.title || 'Ürün'
        }
      });

      console.log('AI yanıtı:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Edge Function hatası');
      }

      if (data?.success) {
        handleInputChange('description', data.result);
        alert('📝 AI açıklama şablonu oluşturuldu!');
      } else {
        throw new Error(data?.error || 'AI yanıt veremedi');
      }
    } catch (error: any) {
      console.error('AI error:', error);
      
      let errorMessage = 'Açıklama şablonu oluşturulamadı.';
      
      if (error.message?.includes('API anahtarı')) {
        errorMessage = '⚠️ OpenAI API anahtarı yapılandırılmamış!';
      } else if (error.message?.includes('Failed to send')) {
        errorMessage = '⚠️ Edge Function\'a bağlanılamadı!';
      } else if (error.message) {
        errorMessage = `Hata: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setAiLoading(false);
    }
  };

  // AI: Suggest Price
  const suggestPrice = async () => {
    if (!formData.category || !formData.title) {
      alert('⚠️ Önce kategori ve başlık girin');
      return;
    }

    // Başlık çok kısa ise uyar
    if (formData.title.trim().length < 3) {
      alert('💡 İpucu: Daha detaylı bir başlık yazın (örn: "Dell Laptop i7"), AI daha doğru fiyat önerecek.');
      return;
    }

    setAiLoading(true);
    
    try {
      console.log('AI isteği gönderiliyor...', {
        category: formData.category,
        title: formData.title,
        description: formData.description,
        condition: formData.condition
      });
      
      const { data, error } = await supabase.functions.invoke('ai-assistant-cached', {
        body: {
          action: 'suggest_price',
          category: formData.category,
          title: formData.title,
          description: formData.description,
          condition: formData.condition || 'Az Kullanılmış'
        }
      });

      console.log('AI yanıtı:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Edge Function hatası');
      }

      if (data?.success) {
        // Yeni cache-aware response format
        const suggestedPrice = data.price || 0;
        const isCached = data.cached || false;
        const confidence = data.confidence || 0;
        const resultText = data.result || '';
        
        handleInputChange('price', suggestedPrice.toString());
        
        // Kullanıcıya bilgi ver
        const cacheInfo = isCached ? '⚡ Cache\'den alındı (anında)' : '🔍 Güncel piyasa verisi';
        const confidenceInfo = confidence > 0 ? `\n🎯 Güvenilirlik: ${(confidence * 100).toFixed(0)}%` : '';
        
        alert(`💰 AI Fiyat Önerisi: ${resultText}\n\n${cacheInfo}${confidenceInfo}\n\nÖnerilen fiyat forma eklendi: ${suggestedPrice.toLocaleString('tr-TR')} ₺`);
      } else {
        throw new Error(data?.error || 'AI yanıt veremedi');
      }
    } catch (error: any) {
      console.error('AI error:', error);
      
      let errorMessage = 'Fiyat önerisi alınamadı.';
      
      if (error.message?.includes('API anahtarı')) {
        errorMessage = '⚠️ OpenAI API anahtarı yapılandırılmamış!';
      } else if (error.message?.includes('Failed to send')) {
        errorMessage = '⚠️ Edge Function\'a bağlanılamadı!';
      } else if (error.message) {
        errorMessage = `Hata: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      return;
    }

    setCompressing(true);

    try {
      const nextMedia: UploadedMediaItem[] = [];
      const unsupportedFiles: string[] = [];

      for (const file of files) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (isImage && !SUPPORTED_IMAGE_FORMATS.includes(file.type)) {
          unsupportedFiles.push(file.name);
          continue;
        }

        if (!isImage && !isVideo) {
          unsupportedFiles.push(file.name);
          continue;
        }

        let processedFile = file;
        if (isImage) {
          const fileSizeMB = file.size / (1024 * 1024);
          if (fileSizeMB > MAX_IMAGE_SIZE_MB) {
            processedFile = await compressImage(file, MAX_IMAGE_SIZE_MB);
          }
        }

        nextMedia.push({
          file: processedFile,
          previewUrl: URL.createObjectURL(processedFile),
          kind: isVideo ? 'video' : 'image',
        });
      }

      if (unsupportedFiles.length > 0) {
        alert(`⚠️ Desteklenmeyen dosyalar atlandı:\n${unsupportedFiles.join('\n')}\n\nDesteklenen görsel formatları: JPG, PNG, GIF, WebP`);
      }

      if (nextMedia.length === 0) {
        return;
      }

      if (uploadedMedia.length + nextMedia.length > MAX_MEDIA_ITEMS) {
        nextMedia.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        alert(`En fazla ${MAX_MEDIA_ITEMS} adet fotoğraf veya video yükleyebilirsiniz.`);
        return;
      }

      const nextTotalBytes = totalMediaBytes + nextMedia.reduce((sum, item) => sum + item.file.size, 0);
      if (nextTotalBytes > MAX_TOTAL_MEDIA_BYTES) {
        nextMedia.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        alert(`Toplam medya yükleme kapasitesi ${formatMegabytes(MAX_TOTAL_MEDIA_BYTES)}. Mevcut seçimle toplam ${formatMegabytes(nextTotalBytes)} oluyor.`);
        return;
      }

      setUploadedMedia((prev) => [...prev, ...nextMedia]);
    } catch (error) {
      console.error('Medya işleme hatası:', error);
      alert('Medya işlenirken bir hata oluştu');
    } finally {
      setCompressing(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setUploadedMedia((prev) => {
      const item = prev[index];
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.title.trim()) newErrors.title = 'Başlık gerekli';
    if (!formData.description.trim()) newErrors.description = 'Açıklama gerekli';
    if (!formData.price || parseFloat(formData.price) <= 0) newErrors.price = 'Geçerli bir fiyat girin';
    if (!formData.category) newErrors.category = 'Kategori seçin';
    if (!formData.condition) newErrors.condition = 'Durum seçin';
    if (!formData.location.trim()) newErrors.location = 'Konum gerekli';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadedPaths: string[] = [];

    // Kullanıcı telefon numarasını al
    let userPhone = '';
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', userId)
        .single();
      
      userPhone = profileData?.phone?.replace(/\D/g, '') || userId || 'unknown';
    } catch (err) {
      console.error('Telefon numarası alınamadı:', err);
      userPhone = userId || 'unknown';
    }

    // Geçici listing ID oluştur (gerçek ID insert sonrası gelecek)
    const tempListingId = `temp_${Date.now()}`;

    for (const { file } of uploadedMedia) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      
      // ✅ Doğru path yapısı: tel_no/listing_id/resim.jpeg
      const filePath = `${userPhone}/${tempListingId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Medya yükleme hatası');
      }

      uploadedPaths.push(filePath);
    }

    return uploadedPaths;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (uploadedMedia.length === 0) {
      alert('En az 1 fotoğraf veya video yüklemelisiniz');
      return;
    }

    if (!userId) {
      alert('Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      navigate('/auth/login');
      return;
    }

    setLoading(true);

    try {
      // Kullanıcı bilgilerini al
      let userPhone = '';
      let userName = '';
      
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('phone, full_name')
          .eq('id', userId)
          .single();
        
        userPhone = profileData?.phone || '';
        userName = profileData?.full_name || 'Satıcı';
      } catch (err) {
        console.error('Profil bilgileri alınamadı:', err);
      }

      const imagePaths = await uploadImages();

      const dbCondition = toCanonicalCondition(formData.condition) || '2. El';

      // Keywords: best-effort LLM via Edge Function, fallback to deterministic.
      let kw = generateListingKeywordsFallback({
        title: formData.title,
        category: formData.category,
        description: formData.description,
        condition: dbCondition,
      });
      let keywordSource: 'llm' | 'fallback' = 'fallback';

      const llmKeywordsEnabled = (import.meta as any)?.env?.VITE_ENABLE_LLM_KEYWORDS === 'true';
      if (llmKeywordsEnabled) {
        try {
          const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-assistant', {
            body: {
              action: 'generate_keywords',
              category: formData.category,
              title: formData.title,
              description: formData.description,
              condition: dbCondition,
            },
          });

          if (!aiError && aiData?.success && aiData?.result?.keywords?.length) {
            kw = {
              keywords: aiData.result.keywords,
              keywords_text: aiData.result.keywords_text || aiData.result.keywords.join(' '),
            };
            keywordSource = 'llm';
          }
        } catch (err) {
          console.warn('AI keyword üretimi başarısız, fallback kullanılıyor:', err);
        }
      }

      // ✅ Metadata (PII yok): provenance + search
      const metadata = {
        source: 'web',
        created_via: 'manual',
        client_app: 'pazarglobal-frontend',
        flow_version: '2026-01-04',
        keyword_source: keywordSource,
        created_at_client: new Date().toISOString(),
        keywords: kw.keywords,
        keywords_text: kw.keywords_text,
        attributes: {},
      };

      // ✅ Güvenli: ilan oluşturma + resim taşıma işlemlerini Edge Function üzerinden yap
      // Bu sayede tarayıcıdan tabloya doğrudan yazmaya gerek kalmaz (RLS sıkılaştırılabilir).
      const sessionToken = localStorage.getItem('session_token') || undefined;
      const { data: fnData, error: fnError } = await supabase.functions.invoke('create-listing', {
        body: {
          title: formData.title,
          description: formData.description,
          price: parseFloat(formData.price),
          category: formData.category,
          condition: dbCondition,
          location: formData.location,
          image_paths: imagePaths,
          metadata,
          session_token: sessionToken,
        },
      });

      if (fnError || !fnData?.success || !fnData?.listing?.id) {
        console.error('create-listing function error:', fnError, fnData);
        throw new Error(fnData?.error || fnError?.message || 'İlan oluşturulamadı');
      }

      alert('İlan başarıyla oluşturuldu! 🎉');
      navigate(buildListingPath(fnData.listing.id, formData.title));
    } catch (error: any) {
      console.error('Error creating listing:', error);
      
      if (error.message?.includes('violates foreign key constraint')) {
        alert('Kullanıcı bilgisi doğrulanamadı. Lütfen çıkış yapıp tekrar giriş yapın.');
        localStorage.removeItem('session_token');
        localStorage.removeItem('user_id');
        navigate('/auth/login');
      } else {
        alert('İlan oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50">
      <TopNavigation isScrolled={isScrolled} />

      <div className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Header with AI Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h1 className="text-4xl lg:text-5xl font-display font-bold">
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  Yeni İlan Oluştur
                </span>
              </h1>
              
              {/* AI Assistant Toggle */}
              <button
                onClick={() => setShowAIAssistant(!showAIAssistant)}
                className={`px-4 py-2 rounded-full flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                  showAIAssistant
                    ? 'bg-gradient-primary text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-500'
                }`}
              >
                <i className="ri-robot-2-line text-lg" />
                <span className="text-sm font-medium">AI Asistan</span>
              </button>
            </div>
            <p className="text-lg text-gray-600">
              Ürününüzü satmak için detayları doldurun
            </p>
          </motion.div>

          {/* AI Assistant Panel */}
          <AnimatePresence>
            {showAIAssistant && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl p-6 text-white">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <i className="ri-robot-2-fill text-2xl" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold mb-2">🤖 AI Asistan Aktif</h3>
                      <p className="text-sm text-white/90 mb-4">
                        Merhaba! İlan oluştururken size yardımcı olabilirim. Başlık önerileri, açıklama şablonları ve fiyat önerileri sunabilirim.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={generateTitleSuggestion}
                          disabled={!formData.category || aiLoading}
                          className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {aiLoading ? (
                            <>
                              <i className="ri-loader-4-line animate-spin mr-1" />
                              Yükleniyor...
                            </>
                          ) : (
                            '✨ Başlık Öner'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={generateDescriptionTemplate}
                          disabled={!formData.category || aiLoading}
                          className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {aiLoading ? (
                            <>
                              <i className="ri-loader-4-line animate-spin mr-1" />
                              Yükleniyor...
                            </>
                          ) : (
                            '📝 Açıklama Şablonu'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={improveDescription}
                          disabled={!formData.description.trim() || aiLoading}
                          className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {aiLoading ? (
                            <>
                              <i className="ri-loader-4-line animate-spin mr-1" />
                              Yükleniyor...
                            </>
                          ) : (
                            '🪄 Metni İyileştir'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={suggestPrice}
                          disabled={!formData.category || !formData.title || aiLoading}
                          className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {aiLoading ? (
                            <>
                              <i className="ri-loader-4-line animate-spin mr-1" />
                              Yükleniyor...
                            </>
                          ) : (
                            '💰 Fiyat Öner'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl shadow-xl p-4 sm:p-8 space-y-6"
          >
            {/* Media Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Ürün Medyaları <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4">
                {uploadedMedia.map((media, index) => (
                  <div key={`${media.file.name}-${index}`} className="relative group">
                    {media.kind === 'video' ? (
                      <>
                        <video
                          src={media.previewUrl}
                          className="w-full h-24 object-cover rounded-lg bg-black"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white">
                            <i className="ri-play-fill text-lg" />
                          </span>
                        </div>
                      </>
                    ) : (
                      <img
                        src={media.previewUrl}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    )}
                    <span className="absolute bottom-1 left-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {media.kind === 'video' ? 'Video' : 'Foto'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      aria-label={`Resmi kaldır ${index + 1}`}
                    >
                      <i className="ri-close-line text-sm" />
                    </button>
                  </div>
                ))}
                
                {uploadedMedia.length < MAX_MEDIA_ITEMS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={compressing}
                    className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-purple-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {compressing ? (
                      <>
                        <i className="ri-loader-4-line text-2xl text-purple-500 animate-spin" />
                        <span className="text-xs text-gray-500 mt-1">İşleniyor...</span>
                      </>
                    ) : (
                      <>
                        <i className="ri-add-line text-2xl text-gray-400" />
                        <span className="text-xs text-gray-500 mt-1">Ekle</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,video/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
                title="Medya dosyaları seç"
                aria-label="Resim veya video yükle"
              />
              <p className="text-xs text-gray-500 mt-2">
                Fotoğraf ve videoyu birlikte yükleyebilirsiniz. Fotoğraflar otomatik olarak {MAX_IMAGE_SIZE_MB.toFixed(1)} MB seviyesine sıkıştırılır. En fazla {MAX_MEDIA_ITEMS} dosya ve toplam {formatMegabytes(MAX_TOTAL_MEDIA_BYTES)} yükleyebilirsiniz.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Kullanım: {uploadedMedia.length}/{MAX_MEDIA_ITEMS} dosya • {formatMegabytes(totalMediaBytes)} / {formatMegabytes(MAX_TOTAL_MEDIA_BYTES)}
              </p>
            </div>

            {/* Category & Condition */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Kategori <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer text-sm ${
                    errors.category ? 'border-red-500' : 'border-gray-300'
                  }`}
                  aria-label="İlan kategorisi seç"
                  title="Kategori seçin"
                >
                  <option value="">Kategori Seçin</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Durum <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.condition}
                  onChange={(e) => handleInputChange('condition', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer text-sm ${
                    errors.condition ? 'border-red-500' : 'border-gray-300'
                  }`}
                  aria-label="Ürün durumu seç"
                  title="Durum seçin"
                >
                  <option value="">Durum Seçin</option>
                  {conditions.map(cond => (
                    <option key={cond} value={cond}>{cond}</option>
                  ))}
                </select>
                {errors.condition && <p className="text-red-500 text-xs mt-1">{errors.condition}</p>}
              </div>
            </div>

            {/* Title with AI Suggestions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  İlan Başlığı <span className="text-red-500">*</span>
                </label>
                {showAIAssistant && formData.category && (
                  <button
                    type="button"
                    onClick={generateTitleSuggestion}
                    disabled={aiLoading || !formData.title.trim()}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiLoading ? (
                      <>
                        <i className="ri-loader-4-line animate-spin mr-1" />
                        Yükleniyor...
                      </>
                    ) : (
                      '✨ İyileştir'
                    )}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Örn: Dell Laptop i7 16GB RAM"
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
              {showAIAssistant && formData.category && !formData.title.trim() && (
                <p className="text-xs text-gray-500 mt-1">
                  💡 Önce ürününüzü kısaca yazın (örn: "Laptop"), AI iyileştirecek
                </p>
              )}
              
              {/* Title Suggestions Dropdown */}
              <AnimatePresence>
                {showTitleSuggestions && formData.category && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 bg-white border border-purple-200 rounded-lg shadow-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700">💡 Başlık Önerileri</span>
                      <button
                        type="button"
                        onClick={() => setShowTitleSuggestions(false)}
                        className="text-gray-400 hover:text-gray-600 cursor-pointer"
                        aria-label="Önerileri kapat"
                      >
                        <i className="ri-close-line" />
                      </button>
                    </div>
                    {titleSuggestions[formData.category]?.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyTitleSuggestion(suggestion)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Description with AI Tools */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Açıklama <span className="text-red-500">*</span>
                </label>
                {showAIAssistant && formData.description.trim() && (
                  <button
                    type="button"
                    onClick={improveDescription}
                    disabled={aiLoading}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {aiLoading ? (
                      <>
                        <i className="ri-loader-4-line animate-spin mr-1" />
                        İyileştiriliyor...
                      </>
                    ) : (
                      <>🪄 Metni İyileştir</>
                    )}
                  </button>
                )}
              </div>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Ürününüz hakkında detaylı bilgi verin..."
                rows={5}
                maxLength={1000}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <div className="flex items-center justify-between mt-1">
                {errors.description && <p className="text-red-500 text-xs">{errors.description}</p>}
                <p className="text-xs text-gray-500 ml-auto">
                  {formData.description.length}/1000
                </p>
              </div>
            </div>

            {/* Price & Location */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Fiyat (₺) <span className="text-red-500">*</span>
                  </label>
                  {showAIAssistant && formData.category && formData.title && (
                    <button
                      type="button"
                      onClick={suggestPrice}
                      disabled={aiLoading}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      💰 Öner
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm ${
                    errors.price ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Konum <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Örn: İstanbul, Kadıköy"
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm ${
                    errors.location ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location}</p>}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={() => navigate('/listings')}
                className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition-all whitespace-nowrap cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={loading || compressing}
                className="px-8 py-3 text-sm font-semibold text-white bg-gradient-primary rounded-full hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2" />
                    Yükleniyor...
                  </>
                ) : (
                  <>
                    <i className="ri-check-line mr-2" />
                    İlanı Yayınla
                  </>
                )}
              </button>
            </div>
          </motion.form>
        </div>
      </div>

      <Footer />
      <ChatBox />
    </div>
  );
}
