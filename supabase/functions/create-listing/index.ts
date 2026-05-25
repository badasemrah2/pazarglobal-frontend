import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CreateListingRequest = {
  title: string;
  description?: string | null;
  price: number;
  category: string;
  condition: string;
  location?: string | null;

  // Uploaded image paths (typically temp paths). Example: "+905xx/temp_xxx/file.jpg"
  image_paths?: string[];

  // Optional metadata used by search/UX. Must not include sensitive data.
  metadata?: Record<string, unknown>;

  // Optional: custom session (WhatsApp/Web) verification
  session_token?: string;
};

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function safeNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(n)) return NaN;
  return n;
}

function extractPhoneFromPath(path: string): string | null {
  const trimmed = (path || '').trim().replace(/^\/+/, '');
  if (!trimmed) return null;
  const first = trimmed.split('/')[0]?.trim();
  if (!first) return null;
  // Basic: +90..., 90..., or digits. Keep as-is if it looks like a phone-ish prefix.
  if (/^\+?\d{8,15}$/.test(first)) return first;
  return first; // fallback; we only use it as a folder prefix
}

function fileNameFromPath(path: string): string | null {
  const p = (path || '').trim().replace(/\/+$/, '');
  if (!p) return null;
  const parts = p.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function isVideoPath(path: string): boolean {
  const trimmed = (path || '').trim();
  if (!trimmed) return false;
  return trimmed.startsWith('data:video/') || /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(?:$|[?#])/i.test(trimmed);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_KEY') ?? '';
    const bucket = Deno.env.get('SUPABASE_STORAGE_BUCKET') ?? 'product-images';

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase env vars' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = (await req.json().catch(() => null)) as CreateListingRequest | null;
    if (!body) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const title = normalizeText(body.title);
    const category = normalizeText(body.category);
    const condition = normalizeText(body.condition);
    const description = (body.description ?? null) as string | null;
    const location = (body.location ?? null) as string | null;
    const price = safeNumber(body.price);

    if (!title || !category || !condition || !Number.isFinite(price) || price < 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing/invalid fields (title, category, condition, price)',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 1) Resolve user_id via JWT (preferred) or custom session_token.
    let userId: string | null = null;

    const jwt = getBearerToken(req);
    if (jwt) {
      const { data, error } = await supabase.auth.getUser(jwt);
      if (!error && data?.user?.id) {
        userId = data.user.id;
      }
    }

    if (!userId && body.session_token) {
      const { data: security, error } = await supabase
        .from('user_security')
        .select('user_id, session_expires_at, users:user_id (id, is_active)')
        .eq('session_token', body.session_token)
        .maybeSingle();

      if (!error && security?.user_id) {
        const expiresAt = security.session_expires_at ? new Date(security.session_expires_at) : null;
        const isExpired = expiresAt ? expiresAt < new Date() : true;
        const isActive = !!security.users?.is_active;

        if (!isExpired && isActive) {
          userId = security.user_id;
        }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // 2) Fetch profile (best-effort) for denormalized listing fields.
    let userName = 'Satıcı';
    let userPhone = '';
    let phoneVisibility: 'public' | 'hidden' = 'public';
    let nameVisibility: 'public' | 'hidden' = 'public';
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, phone_visibility, name_visibility')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.full_name) userName = profile.full_name;
      if (profile?.phone) userPhone = profile.phone;
      if (profile?.phone_visibility === 'hidden') phoneVisibility = 'hidden';
      if (profile?.name_visibility === 'hidden') nameVisibility = 'hidden';
    } catch {
      // ignore
    }

    // 3) Insert listing (store temp paths first; then move if provided)
    const listingId = crypto.randomUUID();

    const imagePaths = Array.isArray(body.image_paths) ? body.image_paths.filter(Boolean) : [];
    const phonePrefix = (imagePaths.length ? extractPhoneFromPath(imagePaths[0]) : null) || userPhone || 'unknown';

    const { data: inserted, error: insertError } = await supabase
      .from('listings')
      .insert({
        id: listingId,
        user_id: userId,
        title,
        description,
        price,
        category,
        condition,
        location,
        image_url: null,
        images: imagePaths,
        metadata: body.metadata ?? {},
        user_name: userName,
        user_phone: userPhone,
        phone_visibility: phoneVisibility,
        name_visibility: nameVisibility,
        status: 'active',
        is_premium: false,
        view_count: 0,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 4) If there are images, move them into stable folder: {phone}/{listingId}/{filename}
    let finalImagePaths = imagePaths;
    let primaryImageUrl: string | null = null;

    if (imagePaths.length > 0) {
      const moved: string[] = [];
      for (const oldPath of imagePaths) {
        const filename = fileNameFromPath(oldPath);
        if (!filename) {
          moved.push(oldPath);
          continue;
        }
        const newPath = `${phonePrefix}/${listingId}/${filename}`;

        const { error: moveError } = await supabase.storage.from(bucket).move(oldPath, newPath);
        if (moveError) {
          moved.push(oldPath);
        } else {
          moved.push(newPath);
        }
      }

      finalImagePaths = moved;

      // Compute public URL for the first non-video asset so image-only surfaces keep a valid cover.
      const firstImage = finalImagePaths.find((path) => !isVideoPath(path));
      if (firstImage) {
        primaryImageUrl = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${firstImage}`;
      }

      // Update listing with final image paths + primary URL
      await supabase
        .from('listings')
        .update({
          images: finalImagePaths,
          image_url: primaryImageUrl,
        })
        .eq('id', listingId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        listing: {
          ...inserted,
          images: finalImagePaths,
          image_url: primaryImageUrl ?? inserted.image_url,
        },
      }),
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
