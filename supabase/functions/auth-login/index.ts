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
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { phone, pin } = await req.json();

    console.log('Login attempt:', { phone, pin_length: pin?.length });

    // Kullanıcıyı bul
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, phone, name, email')
      .eq('phone', phone)
      .maybeSingle();

    if (userError || !user) {
      console.log('User not found:', userError);
      return new Response(
        JSON.stringify({ error: 'Kullanıcı bulunamadı' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User found:', user.id);

    // Security bilgisini al
    const { data: security, error: securityError } = await supabase
      .from('user_security')
      .select('pin_hash, failed_attempts, is_locked')
      .eq('user_id', user.id)
      .maybeSingle();

    if (securityError || !security) {
      console.log('Security not found:', securityError);
      return new Response(
        JSON.stringify({ error: 'Güvenlik bilgisi bulunamadı' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Security found:', { is_locked: security.is_locked, failed_attempts: security.failed_attempts });

    // Hesap kilitli mi?
    if (security.is_locked) {
      return new Response(
        JSON.stringify({ error: 'Hesabınız kilitlendi. Lütfen destek ile iletişime geçin.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PIN kontrolü
    const pinHash = await hashPin(pin);
    console.log('PIN check:', { provided: pinHash, stored: security.pin_hash, match: pinHash === security.pin_hash });

    if (pinHash !== security.pin_hash) {
      // Başarısız deneme sayısını artır
      const newFailedAttempts = (security.failed_attempts || 0) + 1;
      const shouldLock = newFailedAttempts >= 5;

      await supabase
        .from('user_security')
        .update({
          failed_attempts: newFailedAttempts,
          is_locked: shouldLock,
        })
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ 
          error: shouldLock 
            ? 'Çok fazla başarısız deneme. Hesabınız kilitlendi.' 
            : `Hatalı PIN. Kalan deneme: ${5 - newFailedAttempts}`
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Başarılı giriş - failed_attempts sıfırla
    await supabase
      .from('user_security')
      .update({
        failed_attempts: 0,
        last_login_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    // Session token oluştur
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
        },
        session: {
          token: sessionToken,
          expiresAt,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Giriş başarısız' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});