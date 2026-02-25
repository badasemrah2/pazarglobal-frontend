import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type Json = Record<string, unknown>

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  })
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('Authorization') || req.headers.get('authorization')
  if (!auth) return null
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : null
}

function isUuid(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'no-store',
      },
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'method_not_allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, { success: false, error: 'missing_env' })
  }

  const jwt = getBearerToken(req)
  if (!jwt) {
    return jsonResponse(401, { success: false, error: 'missing_bearer', message: 'Şikayet için giriş yapmalısınız.' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
  if (userErr || !userData?.user?.id) {
    return jsonResponse(401, {
      success: false,
      error: 'unauthorized',
      message: 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.',
      detail: userErr?.message ?? null,
    })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { success: false, error: 'invalid_json' })
  }

  const listingId = String(body?.listing_id ?? '').trim()
  const reason = String(body?.reason ?? '').trim()
  const evidence = body?.evidence ?? null

  if (!isUuid(listingId)) {
    return jsonResponse(400, { success: false, error: 'invalid_listing_id', message: 'Geçerli bir ilan kimliği gerekli.' })
  }
  if (!reason) {
    return jsonResponse(400, { success: false, error: 'missing_reason', message: 'Şikayet sebebi zorunludur.' })
  }

  const reporterUserId = userData.user.id

  const { data: existing, error: dupErr } = await supabase
    .from('illegal_reports')
    .select('id, created_at')
    .eq('reporter_user', reporterUserId)
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (dupErr) {
    return jsonResponse(500, {
      success: false,
      error: 'duplicate_check_failed',
      message: 'Mevcut şikayet kontrolü yapılamadı.',
      detail: dupErr.message,
    })
  }

  if (existing?.id) {
    return jsonResponse(200, {
      success: true,
      duplicate: true,
      message: 'Bu ilan için daha önce şikayet oluşturdunuz.',
      data: existing,
    })
  }

  const payload = {
    reporter_user: reporterUserId,
    listing_id: listingId,
    reason,
    evidence,
    reviewed: false,
  }

  const { data: inserted, error: insErr } = await supabase
    .from('illegal_reports')
    .insert(payload)
    .select('*')
    .single()

  if (insErr) {
    return jsonResponse(500, {
      success: false,
      error: 'insert_failed',
      message: 'Şikayet kaydedilemedi.',
      detail: insErr.message,
      code: insErr.code ?? null,
      hint: insErr.hint ?? null,
    })
  }

  return jsonResponse(200, {
    success: true,
    duplicate: false,
    message: 'Şikayetiniz alındı, inceleme kuyruğuna eklendi.',
    data: inserted,
  })
})
