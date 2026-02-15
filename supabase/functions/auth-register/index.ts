import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, email, name, pin } = await req.json();

    console.log('📝 Kayıt başlıyor:', { phone, email, name });

    // Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 1️⃣ Supabase Auth ile kullanıcı oluştur
    console.log('1️⃣ Supabase Auth kullanıcısı oluşturuluyor...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      phone: phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        name: name,
        full_name: name,
      }
    });

    if (authError) {
      console.error('❌ Auth hatası:', authError);
      throw new Error(`Auth kullanıcısı oluşturulamadı: ${authError.message}`);
    }

    const userId = authData.user.id;
    console.log('✅ Auth kullanıcısı oluşturuldu:', userId);

    // 2️⃣ PIN hash oluştur
    console.log('2️⃣ PIN hash oluşturuluyor...');
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const pinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    console.log('✅ PIN hash oluşturuldu');

    // 3️⃣ Profiles tablosuna kayıt
    console.log('3️⃣ Profiles tablosuna kayıt yapılıyor...');
    const baseProfile = {
      id: userId,
      phone: phone,
      email: email,
      full_name: name,
      display_name: name,
      is_verified: false,
      is_active: true,
    };

    // Current schema prefers `role`. Older deployments used `user_role`.
    let profileError = (await supabaseAdmin.from('profiles').insert({
      ...baseProfile,
      role: 'user',
    })).error;

    if (profileError && String(profileError.message || '').toLowerCase().includes('column')) {
      profileError = (await supabaseAdmin.from('profiles').insert({
        ...baseProfile,
        user_role: 'user',
      })).error;
    }

    if (profileError) {
      console.error('❌ Profile hatası:', profileError);
      // Auth kullanıcısını sil
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Profil oluşturulamadı: ${profileError.message}`);
    }
    console.log('✅ Profile oluşturuldu');

    // 4️⃣ User Security tablosuna kayıt
    console.log('4️⃣ User Security tablosuna kayıt yapılıyor...');
    const { error: securityError } = await supabaseAdmin
      .from('user_security')
      .insert({
        user_id: userId,
        pin_hash: pinHash,
        pin_attempts: 0,
        is_locked: false,
      });

    if (securityError) {
      console.error('❌ Security hatası:', securityError);
      // Rollback
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Güvenlik kaydı oluşturulamadı: ${securityError.message}`);
    }
    console.log('✅ Security kaydı oluşturuldu');

    // 5️⃣ Rate Limits tablosuna kayıt
    console.log('5️⃣ Rate Limits tablosuna kayıt yapılıyor...');
    const { error: rateLimitError } = await supabaseAdmin
      .from('rate_limits')
      .insert({
        user_id: userId,
        request_count: 0,
        last_request_at: new Date().toISOString(),
      });

    if (rateLimitError) {
      console.error('❌ Rate Limit hatası:', rateLimitError);
      // Rollback
      await supabaseAdmin.from('user_security').delete().eq('user_id', userId);
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Rate limit kaydı oluşturulamadı: ${rateLimitError.message}`);
    }
    console.log('✅ Rate limit kaydı oluşturuldu');

    // 6️⃣ Session token oluştur
    console.log('6️⃣ Session token oluşturuluyor...');
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (sessionError) {
      console.error('⚠️ Session hatası:', sessionError);
    }

    console.log('✅ Kayıt başarılı!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Kayıt başarılı',
        user: {
          id: userId,
          phone: phone,
          email: email,
          name: name,
        },
        session_token: sessionData?.properties?.hashed_token || null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('💥 Kayıt hatası:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});