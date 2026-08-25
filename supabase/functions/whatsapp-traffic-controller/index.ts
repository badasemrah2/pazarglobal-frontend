/**
 * WhatsApp Traffic Controller - Edge Function
 * 
 * Traffic Police: Tüm WhatsApp trafiğini kontrol eder
 * - 10 dakikalık session timer
 * - PIN doğrulama
 * - Otomatik session timeout
 * - WebChat bypass (direkt backend'e)
 */

// @ts-ignore - Deno runtime import (ESM)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
// @ts-ignore - Local import
import { corsHeaders } from '../_shared/cors.ts';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// @ts-ignore - Deno global
const BACKEND_URL = Deno.env.get('BACKEND_URL') || 'https://pazarglobal-agent-production.up.railway.app';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const STORAGE_BUCKET = Deno.env.get('SUPABASE_STORAGE_BUCKET') || 'product-images';
// Shared secret proving to the backend that this request really came from the Edge
// traffic controller. Without it the backend cannot trust the PIN-verified user_id we
// inject, because `channel` is otherwise attacker-controlled.
const BACKEND_INTERNAL_SECRET = Deno.env.get('BACKEND_INTERNAL_SECRET') || '';
const SESSION_DURATION_MINUTES = 10;
const LAST_ACTIVITY_THROTTLE_SECONDS = 30;

function normalizeBackendBaseUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  // People sometimes set BACKEND_URL with a path already; strip common ones.
  return trimmed
    .replace(/\/chat$/i, '')
    .replace(/\/agent\/run$/i, '');
}

function buildBackendUrl(path: string): string {
  const base = normalizeBackendBaseUrl(BACKEND_URL);
  const p = (path || '').startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function backendHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (BACKEND_INTERNAL_SECRET) {
    headers['X-Internal-Secret'] = BACKEND_INTERNAL_SECRET;
  }
  return headers;
}

function toPublicMediaUrl(path?: string): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${STORAGE_BUCKET}/${trimmed}`;
}

interface IncomingRequest {
  source: 'whatsapp' | 'webchat';
  phone?: string;
  user_id?: string;
  message: string;
  media_paths?: string[];
  media_type?: string;
  conversation_history?: any[];
  draft_listing_id?: string;
  prefill_listing_data?: Record<string, unknown>;
  session_token?: string;
  user_context?: Record<string, any>;
}

// @ts-ignore - Deno.serve
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore - Deno global
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore - Deno global
      // Support both SUPABASE_SERVICE_KEY and SUPABASE_SERVICE_ROLE_KEY
      Deno.env.get('SUPABASE_SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData: IncomingRequest = await req.json();

    // ═══════════════════════════════════════════════════════════
    // 1. WEBCHAT - JSON olarak backend'e ilet
    // (Backend'te /web-chat SSE stream döndürüyor; burada JSON gerekir)
    // ═══════════════════════════════════════════════════════════
    if (requestData.source === 'webchat') {
      console.log('🌐 WebChat request - forwarding to backend (/agent/run)');

      const backendPayload = {
        user_id: requestData.user_id || requestData.phone || 'webchat',
        phone: requestData.phone,
        // Declare the real channel: webchat must go through JWT verification and must
        // never inherit the JWT-free whatsapp trust path.
        channel: 'webchat',
        message: requestData.message,
        conversation_history: requestData.conversation_history || [],
        media_paths: requestData.media_paths,
        media_type: requestData.media_type,
        draft_listing_id: requestData.draft_listing_id,
        prefill_listing_data: requestData.prefill_listing_data,
        session_token: requestData.session_token,
        user_context: requestData.user_context,
      };

      const callerAuth = req.headers.get('Authorization') || '';
      const backendResponse = await fetch(buildBackendUrl('/agent/run'), {
        method: 'POST',
        headers: backendHeaders(callerAuth ? { Authorization: callerAuth } : {}),
        body: JSON.stringify(backendPayload),
      });

      const backendData = await backendResponse.json();

      return new Response(JSON.stringify(backendData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: backendResponse.status,
      });
    }

    // ═══════════════════════════════════════════════════════════
    // 2. WHATSAPP TRAFFIC CONTROL - Session & PIN kontrolü
    // ═══════════════════════════════════════════════════════════
    
    const { phone, message } = requestData;

    if (!phone) {
      return new Response(
        JSON.stringify({
          success: false,
          response: '❌ Telefon numarası gerekli',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`📱 WhatsApp request from: ${phone}`);

    // ───────────────────────────────────────────────────────────
    // 2.1. Aktif Session Kontrolü
    // ───────────────────────────────────────────────────────────
    
    const { data: sessions, error: sessionError } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('phone', phone)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (sessionError) {
      console.error('❌ Session query error:', sessionError);
      return new Response(
        JSON.stringify({
          success: false,
          response: '❌ Sistem hatası. Lütfen tekrar deneyin.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const activeSession = sessions && sessions.length > 0 ? sessions[0] : null;

    // ───────────────────────────────────────────────────────────
    // 2.2. Session Var ve Geçerli mi? (10 dakika kontrolü)
    // ───────────────────────────────────────────────────────────
    
    if (activeSession) {
      const now = new Date();
      const expiresAtRaw = activeSession.expires_at || null;
      const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;

      // Fallback for legacy sessions (shouldn't happen if schema is correct)
      const sessionStart = new Date(activeSession.created_at);
      const derivedExpiresAt = new Date(sessionStart.getTime() + SESSION_DURATION_MINUTES * 60 * 1000);
      const effectiveExpiresAt = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : derivedExpiresAt;

      const secondsLeft = Math.floor((effectiveExpiresAt.getTime() - now.getTime()) / 1000);
      console.log(`⏰ Session seconds left: ${secondsLeft}`);

      // Session still valid → TRAFİĞİ GEÇİR ✅
      if (secondsLeft > 0) {
        // Kullanıcı "iptal" dedi mi? (WORD BOUNDARY kontrolü - "Açıklama" gibi false positives önlenir)
        const cancelKeywords = ['iptal', 'vazgeç', 'kapat', 'çık', 'cancel', 'stop'];
        const messageWords = message.toLowerCase().split(/\s+/);
        const isCancelRequest = cancelKeywords.some(keyword => 
          messageWords.includes(keyword)
        );

        if (isCancelRequest) {
          // Session'ı kapat
          await supabase
            .from('user_sessions')
            .update({
              is_active: false,
              ended_at: now.toISOString(),
              end_reason: 'user_cancelled'
            })
            .eq('id', activeSession.id);

          console.log('❌ User cancelled - session closed');

          return new Response(
            JSON.stringify({
              success: true,
              response: '✅ İşlem iptal edildi. Oturumunuz kapatıldı.\n\nYeni işlem için PIN kodunuzu girin.',
              require_pin: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Last activity güncelle (throttled to reduce DB writes)
        const lastActivityRaw = activeSession.last_activity || null;
        const lastActivity = lastActivityRaw ? new Date(lastActivityRaw) : null;
        const lastActivityAgeSeconds = lastActivity && !Number.isNaN(lastActivity.getTime())
          ? (now.getTime() - lastActivity.getTime()) / 1000
          : Number.POSITIVE_INFINITY;

        if (lastActivityAgeSeconds >= LAST_ACTIVITY_THROTTLE_SECONDS) {
          await supabase
            .from('user_sessions')
            .update({ last_activity: now.toISOString() })
            .eq('id', activeSession.id);
        }

        console.log('✅ Session valid - forwarding to backend');
        console.log(`🔍 DEBUG USER_ID FLOW: Edge Function injecting user_id=${activeSession.user_id} (from session ${activeSession.id})`);

        // Backend'e ilet
        // Inject session metadata so backend can always attribute actions correctly.
        const injectedSessionContext = {
          session_token: activeSession.session_token,
          session_id: activeSession.id,
          session_expires_at: effectiveExpiresAt.toISOString(),
          session_last_activity: now.toISOString(),
          session_type: activeSession.session_type,
          source: 'whatsapp',
        };

        const mediaUrls = (requestData.media_paths || [])
          .map((path) => toPublicMediaUrl(path) || '')
          .filter(Boolean);

        const backendPayload = {
          user_id: activeSession.user_id,
          phone,
          channel: 'whatsapp',
          message: requestData.message,
          conversation_history: requestData.conversation_history || [],
          media_paths: mediaUrls,
          media_type: requestData.media_type || null,
          draft_listing_id: requestData.draft_listing_id,
          prefill_listing_data: requestData.prefill_listing_data,
          session_token: activeSession.session_token || activeSession.id || phone,
          user_context: requestData.user_context,
        };

        const backendResponse = await fetch(buildBackendUrl('/agent/run'), {
          method: 'POST',
          headers: backendHeaders(),
          body: JSON.stringify(backendPayload),
        });

        const backendData = await backendResponse.json();
        const normalizedResponse = {
          success: Boolean(backendData?.success),
          response: backendData?.response || backendData?.message || '',
          intent: backendData?.intent,
          data: backendData?.data,
          user_id: activeSession.user_id,
          session: injectedSessionContext,
        };

        // İşlem tamamlandı mı kontrol et (agent response'unda success ve completion flag)
        if (backendData.success && backendData.intent?.includes('complet')) {
          await supabase
            .from('user_sessions')
            .update({
              is_active: false,
              ended_at: now.toISOString(),
              end_reason: 'operation_completed'
            })
            .eq('id', activeSession.id);

          console.log('✅ Operation completed - session closed');
          
          normalizedResponse.response += '\n\n✅ İşlem tamamlandı. Oturumunuz kapatıldı.';
        }

        return new Response(JSON.stringify(normalizedResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: backendResponse.status,
        });
      } else {
        // Session expired → SESSION TIMEOUT ⏰
        await supabase
          .from('user_sessions')
          .update({
            is_active: false,
            ended_at: now.toISOString(),
            end_reason: 'timeout'
          })
          .eq('id', activeSession.id);
        console.log('⏰ Session expired (10 min) - closed');

        return new Response(
          JSON.stringify({
            success: false,
            require_pin: true,
            response: '⏰ Oturumunuz sona erdi (10 dakika).\n\nGüvenlik için PIN kodunuzu tekrar girin:',
            session_expired: true,
            user_id: activeSession.user_id,
            session_id: activeSession.id,
            session_token: activeSession.session_token,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
    }

    // ───────────────────────────────────────────────────────────
    // 2.3. Session Yok → Mesaj PIN mi Kontrol Et
    // ───────────────────────────────────────────────────────────
    
    const isPinMessage = /^\d{4,6}$/.test(message.trim());

    if (isPinMessage) {
      console.log('🔑 PIN detected - verifying...');

      // PIN Doğrulama
      const { data: verifyResult, error: verifyError } = await supabase
        .rpc('verify_pin', {
          p_phone: phone,
          p_pin: message.trim()
        });

      if (verifyError) {
        console.error('❌ PIN verify error:', verifyError);
        return new Response(
          JSON.stringify({
            success: false,
            response: '❌ PIN doğrulama hatası. Lütfen tekrar deneyin.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      const result = verifyResult && verifyResult.length > 0 ? verifyResult[0] : null;

      if (result && result.success) {
        // YENİ 10 DAKİKALIK SESSION AÇ ✅
        const now = new Date();
        const expiresAt = new Date(now.getTime() + SESSION_DURATION_MINUTES * 60 * 1000);

        // Defensive: close any existing active sessions for this phone (avoid unique/logic conflicts)
        await supabase
          .from('user_sessions')
          .update({
            is_active: false,
            ended_at: now.toISOString(),
            end_reason: 'manual',
          })
          .eq('phone', phone)
          .eq('is_active', true);

        const { data: newSession, error: sessionCreateError } = await supabase
          .from('user_sessions')
          .insert({
            user_id: result.user_id,
            phone: phone,
            session_token: crypto.randomUUID(),
            is_active: true,
            expires_at: expiresAt.toISOString(),
            last_activity: now.toISOString(),
            session_type: 'timed',
            ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          })
          .select()
          .single();

        if (sessionCreateError) {
          console.error('❌ Session create error:', sessionCreateError);
          return new Response(
            JSON.stringify({
              success: false,
              response: '❌ Oturum oluşturma hatası.',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }

        console.log(`✅ New session created - expires in ${SESSION_DURATION_MINUTES} min`);

        return new Response(
          JSON.stringify({
            success: true,
            response: `✅ Giriş başarılı!\n\n🕐 ${SESSION_DURATION_MINUTES} dakika boyunca işlem yapabilirsiniz.\n\nNe yapmak istersiniz?`,
            session_token: newSession.session_token,
            expires_at: expiresAt.toISOString(),
            user_id: result.user_id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Hatalı PIN ❌
        console.log('❌ Invalid PIN');
        
        return new Response(
          JSON.stringify({
            success: false,
            response: result?.message || '❌ Hatalı PIN kodu. Lütfen tekrar deneyin.',
            require_pin: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
    }

    // ───────────────────────────────────────────────────────────
    // 2.4. Session Yok ve Mesaj PIN Değil → PIN İSTE
    // ───────────────────────────────────────────────────────────
    
    console.log('🔒 No session - requesting PIN');

    return new Response(
      JSON.stringify({
        success: false,
        require_pin: true,
        response: '🔒 Güvenlik için 4 haneli PIN kodunuzu girin:\n\n(PIN kodunuzu profil ayarlarından oluşturabilirsiniz)',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
    );

  } catch (error: unknown) {
    console.error('💥 Unexpected error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({
        success: false,
        response: '❌ Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
        error: errorMessage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
