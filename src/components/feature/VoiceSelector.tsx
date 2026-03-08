import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface VoiceSelectorProps {
  selectedVoice: SpeechSynthesisVoice | null;
  onVoiceSelect: (voice: SpeechSynthesisVoice) => void;
}

export default function VoiceSelector({ selectedVoice, onVoiceSelect }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis?.getVoices() || [];
      console.log('🎤 Available voices:', availableVoices.length, 'voices loaded');
      
      // Filter Turkish voices and exclude Tolga (has audio quality issues)
      const turkishVoices = availableVoices.filter(v => 
        v.lang.startsWith('tr') && !v.name.toLowerCase().includes('tolga')
      );
      const voicesToUse = turkishVoices.length > 0 ? turkishVoices : 
        availableVoices.filter(v => !v.name.toLowerCase().includes('tolga'));
      
      console.log('🎤 Using', voicesToUse.length, 'voices for selection (Tolga filtered out)');
      setVoices(voicesToUse);
    };

    // Voices might not be loaded immediately - try multiple times
    loadVoices();
    setTimeout(loadVoices, 100);
    setTimeout(loadVoices, 500);
    
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        title={voices.length > 0 ? "Ses Seçimi" : "Sesler yükleniyor..."}
        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <i className="ri-user-voice-line text-xl text-white/80" />
      </button>

      {/* Voice Selection Menu */}
      {showMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="absolute top-12 right-0 z-[9999] w-[min(320px,calc(100vw-2rem))] max-h-[300px] overflow-y-auto overflow-x-hidden rounded-lg bg-gray-800 p-3 shadow-xl"
        >
          <div className="text-xs text-gray-400 px-2 py-1 font-semibold border-b border-gray-700 mb-2">
            Ses Seçin: {voices.length > 0 ? `(${voices.length} ses)` : 'Yükleniyor...'}
          </div>
          {voices.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">
              Sesler yükleniyor...
            </div>
          ) : (
            voices.map((voice, index) => {
              const isFemale = voice.name.toLowerCase().includes('female') || 
                              voice.name.toLowerCase().includes('kadın') ||
                              voice.name.toLowerCase().includes('woman') ||
                              voice.name.toLowerCase().includes('emel');
              const icon = isFemale ? '♀️' : '♂️';
              
              return (
                <button
                  key={index}
                  onClick={() => {
                    onVoiceSelect(voice);
                    setShowMenu(false);
                    console.log('🎤 Voice selected:', voice.name);
                  }}
                  className={`w-full px-4 py-2.5 rounded-md hover:bg-white/10 transition-all text-sm flex items-center gap-3 ${
                    selectedVoice?.name === voice.name ? 'bg-purple-500/30 text-white font-medium' : 'text-gray-300'
                  }`}
                >
                  <span className="text-base flex-shrink-0">{icon}</span>
                  <span className="flex-1 text-left leading-tight">{voice.name}</span>
                </button>
              );
            })
          )}
        </motion.div>
      )}
    </div>
  );
}
