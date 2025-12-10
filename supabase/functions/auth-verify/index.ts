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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { session_token } = await req.json();

    if (!session_token) {
      return new Response(
        JSON.stringify({ success: false, message: 'Session token gerekli' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Session'ı kontrol et
    const { data: security, error } = await supabase
      .from('user_security')
      .select(`
        user_id,
        session_expires_at,
        users:user_id (
          id,
          phone,
          email,
          full_name,
          is_active
        )
      `)
      .eq('session_token', session_token)
      .single();

    if (error || !security) {
      return new Response(
        JSON.stringify({ success: false, message: 'Geçersiz session' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Session süresi dolmuş mu kontrol et
    const expiresAt = new Date(security.session_expires_at);
    if (expiresAt < new Date()) {
      return new Response(
        JSON.stringify({ success: false, message: 'Session süresi dolmuş' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Kullanıcı aktif mi kontrol et
    if (!security.users.is_active) {
      return new Response(
        JSON.stringify({ success: false, message: 'Hesap aktif değil' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: security.users.id,
          phone: security.users.phone,
          email: security.users.email,
          full_name: security.users.full_name
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Bir hata oluştu' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});