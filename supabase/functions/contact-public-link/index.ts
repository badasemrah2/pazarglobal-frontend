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

function tokenString() {
  const rnd = crypto.randomUUID().replace(/-/g, '')
  const ts = Date.now().toString(36)
  return `${rnd}${ts}`
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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, { success: false, error: 'missing_env' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { success: false, error: 'invalid_json' })
  }

  const listingId = String(body?.listing_id ?? '').trim()
  if (!listingId) {
    return jsonResponse(400, { success: false, error: 'missing_listing_id' })
  }

  const { data: listing, error: listingErr } = await supabase
    .from('listings')
    .select('id, user_id, status, expires_at')
    .eq('id', listingId)
    .maybeSingle()

  if (listingErr) {
    return jsonResponse(500, { success: false, error: 'listing_lookup_failed', detail: listingErr.message })
  }

  if (!listing?.id || !listing?.user_id) {
    return jsonResponse(404, { success: false, error: 'listing_not_contactable' })
  }

  const status = String(listing.status ?? '').trim().toLowerCase()
  const blockedStatuses = new Set(['deleted', 'removed', 'rejected', 'blocked', 'banned', 'expired'])
  if (blockedStatuses.has(status)) {
    return jsonResponse(404, { success: false, error: 'listing_not_contactable' })
  }

  const nowIso = new Date().toISOString()
  const { data: existingRows, error: existingErr } = await supabase
    .from('contact_tokens')
    .select('id, token, listing_id, owner_user_id, expires_at, revoked')
    .eq('listing_id', listingId)
    .eq('revoked', false)
    .gte('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)

  if (existingErr) {
    return jsonResponse(500, { success: false, error: 'token_lookup_failed', detail: existingErr.message })
  }

  const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null
  if (existing?.token) {
    return jsonResponse(200, {
      success: true,
      data: {
        listing_id: listingId,
        token: String(existing.token),
        contact_path: `/contact/${String(existing.token)}`,
      },
    })
  }

  const expiresAt =
    listing.expires_at ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const token = tokenString()
  const { data: createdRows, error: createErr } = await supabase
    .from('contact_tokens')
    .insert({
      listing_id: listingId,
      owner_user_id: String(listing.user_id),
      token,
      expires_at: expiresAt,
      revoked: false,
    })
    .select('token')
    .limit(1)

  if (createErr) {
    return jsonResponse(500, { success: false, error: 'token_create_failed', detail: createErr.message })
  }

  const created = Array.isArray(createdRows) && createdRows.length > 0 ? createdRows[0] : null
  const createdToken = String(created?.token ?? token).trim()

  if (!createdToken) {
    return jsonResponse(500, { success: false, error: 'token_generation_failed' })
  }

  return jsonResponse(200, {
    success: true,
    data: {
      listing_id: listingId,
      token: createdToken,
      contact_path: `/contact/${createdToken}`,
    },
  })
})
