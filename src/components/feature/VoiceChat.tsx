import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceChatProps {
  onTranscriptReady: (text: string) => void;
  isEnabled?: boolean;
  selectedVoice?: SpeechSynthesisVoice | null;
}

export default function VoiceChat({
  onTranscriptReady,
  isEnabled = true,
  selectedVoice: externalSelectedVoice = null
}: VoiceChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [isCorrecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [internalSelectedVoice, setInternalSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  
  // Use external voice if provided, otherwise use internal
  const selectedVoice = externalSelectedVoice || internalSelectedVoice;

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const onTranscriptReadyRef = useRef(onTranscriptReady);
  const lastEmittedTextRef = useRef('');
  const lastEmittedAtRef = useRef(0);
  const isStoppingRef = useRef(false);
  const finalChunksRef = useRef<string[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onTranscriptReadyRef.current = onTranscriptReady;
  }, [onTranscriptReady]);

  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'tr-TR';
      recognitionRef.current.continuous = false; // Single utterance mode reduces duplicate chunks on mobile
      recognitionRef.current.interimResults = true; // Show partial results

      const collapseConsecutiveDuplicateWords = (text: string): string => {
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length <= 1) return text.trim();

        const collapsed: string[] = [];
        for (const word of words) {
          const prev = collapsed[collapsed.length - 1];
          if (!prev || prev.toLocaleLowerCase('tr-TR') !== word.toLocaleLowerCase('tr-TR')) {
            collapsed.push(word);
          }
        }
        return collapsed.join(' ').trim();
      };

      const clearFlushTimer = () => {
        if (flushTimerRef.current) {
          window.clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
      };

      const flushFinalTranscript = () => {
        clearFlushTimer();

        const raw = finalChunksRef.current.join(' ').replace(/\s+/g, ' ').trim();
        finalChunksRef.current = [];
        if (!raw) return;

        const dedupedRaw = collapseConsecutiveDuplicateWords(raw);
        setTranscript(dedupedRaw);

        const corrected = correctBrandNames(dedupedRaw).replace(/\s+/g, ' ').trim();
        if (!corrected) return;

        const now = Date.now();
        if (corrected === lastEmittedTextRef.current && now - lastEmittedAtRef.current < 2000) {
          return;
        }

        lastEmittedTextRef.current = corrected;
        lastEmittedAtRef.current = now;
        setCorrectedText(corrected);
        onTranscriptReadyRef.current(corrected);
      };

      recognitionRef.current.onresult = async (event: any) => {
        // Process only NEW results from resultIndex to avoid re-adding older final chunks.
        let interimTranscript = '';
        const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : 0;

        for (let i = startIndex; i < event.results.length; i++) {
          const chunk = String(event.results[i]?.[0]?.transcript || '').trim();
          if (!chunk) continue;
          if (event.results[i].isFinal) {
            const normalizedChunk = chunk.replace(/\s+/g, ' ').trim();
            const lastChunk = finalChunksRef.current[finalChunksRef.current.length - 1];
            if (!lastChunk || lastChunk.toLocaleLowerCase('tr-TR') !== normalizedChunk.toLocaleLowerCase('tr-TR')) {
              finalChunksRef.current.push(normalizedChunk);
            }
          } else {
            interimTranscript += `${chunk} `;
          }
        }

        const mergedFinal = finalChunksRef.current.join(' ').trim();
        const interimClean = interimTranscript.trim();
        if (interimClean || mergedFinal) {
          setTranscript(`${mergedFinal}${mergedFinal && interimClean ? ' ' : ''}${interimClean}`.trim());
        }

        if (finalChunksRef.current.length > 0) {
          clearFlushTimer();
          flushTimerRef.current = window.setTimeout(() => {
            flushFinalTranscript();
            stopListening();
          }, 550);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError(`Ses tanıma hatası: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        if (finalChunksRef.current.length > 0) {
          flushFinalTranscript();
        }
        isStoppingRef.current = false;
        setIsListening(false);
      };
    } else {
      setError('Tarayıcınız ses tanımayı desteklemiyor. Chrome veya Edge kullanın.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    // Initialize Speech Synthesis
    synthRef.current = window.speechSynthesis;

    // Auto-select default voice if not provided externally
    if (!externalSelectedVoice) {
      const loadDefaultVoice = () => {
        const availableVoices = synthRef.current?.getVoices() || [];
        const turkishVoices = availableVoices.filter(v => v.lang.startsWith('tr'));
        if (turkishVoices.length > 0) {
          const preferredVoice =
            turkishVoices.find(v => v.name.includes('Emel')) ||
            turkishVoices.find(v => v.name.toLowerCase().includes('female')) ||
            turkishVoices[turkishVoices.length > 1 ? 1 : 0];

          setInternalSelectedVoice(prev => {
            if (prev) return prev;
            console.log('🎤 Default voice selected:', preferredVoice.name);
            return preferredVoice;
          });
        }
      };

      loadDefaultVoice();
      setTimeout(loadDefaultVoice, 100);
      if (synthRef.current) {
        synthRef.current.onvoiceschanged = loadDefaultVoice;
      }
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [externalSelectedVoice]);

  const startListening = () => {
    if (!isEnabled) return;
    
    setError(null);
    setTranscript('');
    setCorrectedText('');
    isStoppingRef.current = false;
    finalChunksRef.current = [];
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setError('Mikrofon başlatılamadı. İzin verdiğinizden emin olun.');
      }
    }
  };

  const stopListening = () => {
    if (isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const correctBrandNames = (text: string): string => {
    // Fast brand name correction (no backend call needed)
    const brandMap: Record<string, string> = {
      // Otomotiv
      'sitroen': 'Citroen', 'citron': 'Citroen', 'stroen': 'Citroen',
      'reno': 'Renault', 'porşe': 'Porsche', 'mersedes': 'Mercedes',
      'bımvı': 'BMW', 'foksvagen': 'Volkswagen', 'toyta': 'Toyota',
      'pejo': 'Peugeot', 'hundai': 'Hyundai',
      // Elektronik
      'ayfon': 'iPhone', 'aypad': 'iPad', 'samsıng': 'Samsung',
      'huavey': 'Huawei', 'şiyomi': 'Xiaomi',
      // Parfüm
      'kelvin klein': 'Calvin Klein', 'calvin klein': 'Calvin Klein',
      'selin dion': 'Celine Dion', 'selin diyor': 'Celine Dior',
      'poison': 'Poison', 'poyzın': 'Poison',
      'diyor': 'Dior', 'şanel': 'Chanel', 'lanköm': 'Lancôme',
      'gucci': 'Gucci', 'versaçe': 'Versace', 'hugo boss': 'Hugo Boss',
      'lakost': 'Lacoste', 'lakos': 'Lacoste', 'lagos': 'Lacoste'
    };

    let corrected = text;
    for (const [wrong, correct] of Object.entries(brandMap)) {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
      corrected = corrected.replace(regex, correct);
    }
    
    return corrected;
  };

  const speak = useCallback((text: string) => {
    if (!synthRef.current || !isEnabled) return;

    const convertNumberToWords = (num: number): string => {
      const ones = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
      const tens = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
      const hundreds = ['', 'yüz', 'iki yüz', 'üç yüz', 'dört yüz', 'beş yüz', 'altı yüz', 'yedi yüz', 'sekiz yüz', 'dokuz yüz'];

      if (num === 0) return 'sıfır';
      if (num < 10) return ones[num];
      if (num < 100) {
        const ten = Math.floor(num / 10);
        const one = num % 10;
        return tens[ten] + (one > 0 ? ' ' + ones[one] : '');
      }
      if (num < 1000) {
        const hundred = Math.floor(num / 100);
        const remainder = num % 100;
        return hundreds[hundred] + (remainder > 0 ? ' ' + convertNumberToWords(remainder) : '');
      }
      return num.toString();
    };

    // Clean text for voice (remove emojis, URLs, and technical content)
    let cleanText = text;

    // Normalize cases where digits are attached to words so TTS can read them.
    // Examples: "iPhone13" -> "iPhone 13", "ilan1" -> "ilan 1"
    // Keep it language-agnostic (works for TR + EN brand names).
    cleanText = cleanText
      .replace(/([A-Za-zÇĞİÖŞÜçğıöşüİı]+)(\d+)/g, '$1 $2')
      .replace(/(\d+)([A-Za-zÇĞİÖŞÜçğıöşüİı]+)/g, '$1 $2');

    // Normalize "1 nolu" / "1'nolu" forms into a speak-friendly phrase.
    // Example: "1 nolu ilan" -> "bir numaralı ilan"
    cleanText = cleanText.replace(/\b(\d{1,3})\s*'?nolu\b/gi, (_match, num) => {
      const n = parseInt(num, 10);
      if (Number.isFinite(n)) return `${convertNumberToWords(n)} numaralı`;
      return `${num} numaralı`;
    });

    // Convert short model/ordinal numbers after a word for better Turkish TTS.
    // Example: "iPhone 12" -> "iPhone on iki"
    cleanText = cleanText.replace(/([A-Za-zÇĞİÖŞÜçğıöşüİı]{2,})\s+(\d{1,2})\b/g, (_match, word, num) => {
      const n = parseInt(num, 10);
      if (Number.isFinite(n)) return `${word} ${convertNumberToWords(n)}`;
      return `${word} ${num}`;
    });
    
    // Format Turkish phone numbers for voice (multiple formats)
    // +905412879705 → "sıfır beş dört bir, iki sekiz yedi, doksan yedi sıfır beş"
    cleanText = cleanText.replace(/\+90(\d{3})(\d{3})(\d{4})/g, (match, p1, p2, p3) => {
      const digits = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
      const part1 = p1.split('').map(d => digits[parseInt(d)]).join(' ');
      const part2 = p2.split('').map(d => digits[parseInt(d)]).join(' ');
      const part3 = p3.split('').map(d => digits[parseInt(d)]).join(' ');
      return `telefon: ${part1}, ${part2}, ${part3}`;
    });
    
    // Also format phone without +90
    cleanText = cleanText.replace(/\b0(\d{3})(\d{3})(\d{4})\b/g, (match, p1, p2, p3) => {
      const digits = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
      const part1 = p1.split('').map(d => digits[parseInt(d)]).join(' ');
      const part2 = p2.split('').map(d => digits[parseInt(d)]).join(' ');
      const part3 = p3.split('').map(d => digits[parseInt(d)]).join(' ');
      return `telefon: ${part1}, ${part2}, ${part3}`;
    });
    
    // Format other numbers (prices, counts, etc.) - read digit by digit for clarity
    // Example: "375.000 ₺" → "üç yüz yetmiş beş bin lira"
    // But for simplicity, just read large numbers as-is, only format 3-6 digit numbers
    cleanText = cleanText.replace(/\b(\d{3,6})\s*(₺|TL|lira)?\b/gi, (match, num, currency) => {
      const n = parseInt(num);
      if (n >= 1000) {
        // For large numbers, use Turkish number names
        const thousands = Math.floor(n / 1000);
        const remainder = n % 1000;
        let result = '';
        if (thousands > 0) {
          result += `${thousands === 1 ? 'bin' : convertNumberToWords(thousands) + ' bin'}`;
        }
        if (remainder > 0) {
          result += ` ${convertNumberToWords(remainder)}`;
        }
        return result + (currency ? ' lira' : '');
      }
      return convertNumberToWords(n) + (currency ? ' lira' : '');
    });
    
    cleanText = cleanText
      // Remove only URL lines (not following text)
      .replace(/^https?:\/\/[^\s]+$/gm, '')
      // Remove "Fotoğraflar:" label only, keep following text
      .replace(/Fotoğraflar:\s*/g, '')
      // Remove remaining inline URLs
      .replace(/https?:\/\/[^\s]+/g, '')
      // Remove emojis
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{FE0F}\u{200D}]/gu, '')
      // Remove number emojis (1️⃣, 2️⃣, etc.)
      .replace(/\d\u{FE0F}?\u{20E3}/gu, '')
      // Simplify repeated listing titles in cards
      .replace(/^"([^"]+)"\s*$/gm, '')
      // Clean up multiple spaces and newlines
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    // Cancel any ongoing speech immediately
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'tr-TR';
    utterance.rate = 1.1;  // Slightly faster for responsiveness
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Apply selected voice (pre-loaded)
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error('🔊 Speech error:', e);
      setIsSpeaking(false);
    };

    // Speak immediately without delay
    synthRef.current.speak(utterance);
  }, [isEnabled, selectedVoice]);

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  // Expose speak function to parent (always expose when enabled)
  useEffect(() => {
    if (isEnabled) {
      console.log('✅ VoiceChat: Exposing speak function');
      (window as any).speakResponse = speak;
    }
    return () => {
      console.log('🗑️ VoiceChat: Cleaning up speak function');
      delete (window as any).speakResponse;
    };
  }, [isEnabled, speak]);

  return (
    <div className="voice-chat-container relative flex items-center gap-2">
      {/* Microphone Button */}
      <motion.button
        onClick={isListening ? stopListening : startListening}
        disabled={!isEnabled || isCorrecting}
        title={isListening ? "Dinlemeyi Durdur" : "Konuşmaya Başla"}
        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50'
            : 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:shadow-lg hover:shadow-purple-500/50'
        } ${!isEnabled || isCorrecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        whileHover={{ scale: isEnabled && !isCorrecting ? 1.05 : 1 }}
        whileTap={{ scale: isEnabled && !isCorrecting ? 0.95 : 1 }}
        animate={isListening ? { scale: [1, 1.1, 1] } : {}}
        transition={isListening ? { repeat: Infinity, duration: 1.5 } : {}}
      >
        <i className={`${isListening ? 'ri-stop-circle-line' : 'ri-mic-line'} text-xl text-white`} />
        
        {isListening && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-red-300"
            animate={{ scale: [1, 1.5], opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </motion.button>

      {/* Status Indicators */}
      <AnimatePresence>
        {(transcript || correctedText || error || isCorrecting) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-14 right-0 max-w-xs bg-white rounded-2xl shadow-2xl p-4 space-y-2 z-50"
          >
            {error && (
              <div className="text-sm text-red-600 flex items-start gap-2">
                <i className="ri-error-warning-line text-lg mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {isCorrecting && (
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <i className="ri-loader-4-line text-lg animate-spin" />
                <span>Metin düzeltiliyor...</span>
              </div>
            )}

            {transcript && !isCorrecting && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 font-medium">Ham Metin:</div>
                <div className="text-sm text-gray-700 italic">{transcript}</div>
              </div>
            )}

            {correctedText && !isCorrecting && (
              <div className="space-y-1">
                <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <i className="ri-check-line" />
                  Düzeltilmiş:
                </div>
                <div className="text-sm text-gray-900 font-medium">{correctedText}</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speaker Control (when AI is speaking) */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={stopSpeaking}
            title="Konuşmayı Durdur"
            className="absolute bottom-14 right-0 w-10 h-10 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center shadow-lg cursor-pointer z-50"
          >
            <i className="ri-volume-up-line text-lg text-white animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
