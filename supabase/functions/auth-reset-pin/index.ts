import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_KEY') ?? '';

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase env vars' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => null);
    const phone = String(body?.phone ?? '').trim();
    const oldPin = String(body?.old_pin ?? '').trim();
    const newPin = String(body?.new_pin ?? '').trim();

    if (!phone || !oldPin || !newPin) {
      return new Response(
        JSON.stringify({ success: false, error: 'phone, old_pin, new_pin required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!/^\+90\d{10}$/.test(phone)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid phone format' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!/^\d{4}$/.test(oldPin) || !/^\d{4}$/.test(newPin)) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN must be 4 digits' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (oldPin === newPin) {
      return new Response(
        JSON.stringify({ success: false, error: 'New PIN cannot match old PIN' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const oldPinHash = await hashPin(oldPin);
    const { data: security, error: fetchError } = await supabase
      .from('user_security')
      .select('*')
      .eq('phone', phone)
      .eq('pin_hash', oldPinHash)
      .maybeSingle();

    if (fetchError || !security) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telefon numarası veya eski PIN hatalı' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Locked check (best-effort)
    if (security.is_locked && security.blocked_until) {
      const blockedUntil = new Date(security.blocked_until);
      if (blockedUntil > new Date()) {
        const remainingMinutes = Math.ceil((blockedUntil.getTime() - Date.now()) / 60000);
        return new Response(
          JSON.stringify({ success: false, error: `Hesabınız kilitli. ${remainingMinutes} dakika sonra tekrar deneyin.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
    }

    const newPinHash = await hashPin(newPin);
    const { error: updateError } = await supabase
      .from('user_security')
      .update({
        pin_hash: newPinHash,
        failed_attempts: 0,
        is_locked: false,
        blocked_until: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', security.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN güncellenirken bir hata oluştu' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
