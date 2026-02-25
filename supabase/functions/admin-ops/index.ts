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

function asText(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function sanitizeLikeQuery(q: string): string {
  // Escape % and _ which are wildcards in LIKE/ILIKE.
  return q.replace(/[%_]/g, (m) => `\\${m}`)
}

async function bestEffortAuditLog(
  supabase: ReturnType<typeof createClient>,
  adminUserId: string,
  action: string,
  payload: Record<string, unknown>,
  resourceType: string,
  resourceId?: string | null,
) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: adminUserId,
      action: `admin_${action}`,
      resource_type: resourceType,
      resource_id: resourceId && isUuid(resourceId) ? resourceId : null,
      source: 'admin-ops',
      response_status: 'success',
      request_data: payload,
      metadata: {},
    })
  } catch {
    // best-effort
  }
}

async function requireAdmin(supabase: ReturnType<typeof createClient>, jwt: string) {
  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
  if (userErr || !userData?.user) {
    return { ok: false as const, error: 'unauthorized', detail: userErr?.message }
  }

  const userId = userData.user.id

  // Profiles schema has historically drifted (role vs user_role; is_active vs status).
  // Try the current expected columns first, then fall back when we detect missing columns.
  const readProfile = async (select: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .eq('id', userId)
      .maybeSingle()
    return { data: data as any, error }
  }

  const looksLikeMissingColumn = (message?: string | null) => {
    const m = (message || '').toLowerCase()
    return (
      m.includes('could not find the') ||
      (m.includes('column') && m.includes('does not exist')) ||
      m.includes('not found in the schema cache')
    )
  }

  // Try a few known schema variants.
  const selects = [
    'id, role, is_active',
    'id, role, status',
    'id, user_role, is_active',
    'id, user_role, status',
    'id, role',
    'id, user_role',
  ]

  let lastErr: any = null
  let profile: any = null
  for (const sel of selects) {
    const res = await readProfile(sel)
    if (!res.error) {
      profile = res.data
      lastErr = null
      break
    }
    lastErr = res.error
    if (!looksLikeMissingColumn(res.error.message)) {
      // Not a schema-cache/missing-column issue; don't keep retrying.
      break
    }
  }

  if (lastErr) {
    return { ok: false as const, error: 'profile_error', detail: lastErr.message }
  }

  const rawRole = (profile?.role ?? profile?.user_role ?? '') as string
  const role = String(rawRole || '').trim().toLowerCase()

  // Active can be represented as boolean (is_active) or string status.
  const isActiveBool = profile?.is_active
  const status = String(profile?.status ?? '').trim().toLowerCase()
  const isActive =
    typeof isActiveBool === 'boolean'
      ? isActiveBool
      : status
        ? status === 'active' || status === 'enabled'
        : true // if neither column exists, fail-open for activity (admin check still enforced)

  if (!profile || role !== 'admin' || isActive !== true) {
    return {
      ok: false as const,
      error: 'forbidden',
      detail: !profile
        ? 'missing_profile'
        : isActive !== true
          ? 'inactive_user'
          : `role_not_admin:${role || 'empty'}`,
    }
  }

  return {
    ok: true as const,
    user: {
      id: userId,
      email: userData.user.email ?? null,
      role: role,
    },
  }
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
    return jsonResponse(401, { success: false, error: 'missing_bearer' })
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

  const action = String(body?.action ?? '')
  const payload = (body?.payload ?? {}) as Record<string, unknown>

  const admin = await requireAdmin(supabase, jwt)
  if (!admin.ok) {
    return jsonResponse(admin.error === 'forbidden' ? 403 : 401, {
      success: false,
      error: admin.error,
      detail: (admin as any).detail ?? null,
    })
  }

  try {
    if (action === 'whoami') {
      return jsonResponse(200, { success: true, data: admin.user })
    }

    // --- User lookup helpers (admin UI) ---
    if (action === 'lookup_user') {
      const userId = asText(payload.user_id).trim()
      if (!isUuid(userId)) return jsonResponse(400, { success: false, error: 'invalid_user_id' })

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, display_name, role, is_active')
        .eq('id', userId)
        .maybeSingle()

      if (error) return jsonResponse(500, { success: false, error: error.message })
      if (!data) return jsonResponse(404, { success: false, error: 'not_found' })
      return jsonResponse(200, { success: true, data })
    }

    if (action === 'search_users') {
      const qRaw = asText(payload.query).trim()
      const limit = Math.min(Math.max(Number(payload.limit ?? 10) || 10, 1), 25)
      if (!qRaw || qRaw.length < 2) {
        return jsonResponse(200, { success: true, data: [] })
      }

      // If the query is a UUID, do an exact id match as well.
      if (isUuid(qRaw)) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, display_name, role, is_active')
          .eq('id', qRaw)
          .limit(1)
        if (error) return jsonResponse(500, { success: false, error: error.message })
        return jsonResponse(200, { success: true, data: data ?? [] })
      }

      const q = sanitizeLikeQuery(qRaw)
      const pattern = `%${q}%`

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, display_name, role, is_active')
        .or(
          `full_name.ilike.${pattern},display_name.ilike.${pattern},email.ilike.${pattern}`,
        )
        .limit(limit)

      if (error) return jsonResponse(500, { success: false, error: error.message })
      return jsonResponse(200, { success: true, data: data ?? [] })
    }

    if (action === 'set_promo_deadline') {
      const deadline = String(payload.deadline ?? '')
      if (!deadline) return jsonResponse(400, { success: false, error: 'missing_deadline' })

      const { error: upErr } = await supabase
        .from('promo_config')
        .upsert({ id: 1, free_unlimited_until: deadline }, { onConflict: 'id' })
      if (upErr) return jsonResponse(500, { success: false, error: upErr.message })

      const { error: wErr } = await supabase
        .from('wallets')
        .update({ free_unlimited_until: deadline })
        .neq('user_id', '00000000-0000-0000-0000-000000000000')
      if (wErr) return jsonResponse(500, { success: false, error: wErr.message })

      await bestEffortAuditLog(supabase, admin.user.id, action, { deadline }, 'promo_config', null)
      return jsonResponse(200, { success: true, data: { deadline } })
    }

    if (action === 'credit_wallet') {
      const userId = String(payload.user_id ?? '')
      const amount = Number(payload.amount ?? 0)
      const reference = String(payload.reference ?? 'admin_adjustment')
      const metadata = (payload.metadata ?? {}) as Record<string, unknown>
      if (!userId || !Number.isFinite(amount) || amount === 0) {
        return jsonResponse(400, { success: false, error: 'invalid_params' })
      }

      const { data: existing, error: getErr } = await supabase
        .from('wallets')
        .select('user_id, balance_bigint')
        .eq('user_id', userId)
        .maybeSingle()
      if (getErr) return jsonResponse(500, { success: false, error: getErr.message })

      if (!existing) {
        const { error: insErr } = await supabase
          .from('wallets')
          .insert({ user_id: userId, balance_bigint: 0 })
        if (insErr) return jsonResponse(500, { success: false, error: insErr.message })
      }

      const currentBal = Number(existing?.balance_bigint ?? 0)
      const newBal = currentBal + Math.trunc(amount)

      const { error: balErr } = await supabase
        .from('wallets')
        .update({ balance_bigint: newBal })
        .eq('user_id', userId)
      if (balErr) return jsonResponse(500, { success: false, error: balErr.message })

      // best-effort tx record
      const kind = amount >= 0 ? 'credit' : 'debit'
      await supabase.from('wallet_transactions').insert({
        user_id: userId,
        amount_bigint: Math.trunc(amount),
        kind,
        reference,
        metadata: { ...metadata, admin_user_id: admin.user.id },
      })

      await bestEffortAuditLog(
        supabase,
        admin.user.id,
        action,
        { user_id: userId, amount, reference },
        'wallet',
        userId,
      )
      return jsonResponse(200, { success: true, data: { user_id: userId, new_balance: newBal } })
    }

    if (action === 'set_user_active') {
      const userId = String(payload.user_id ?? '')
      const isActive = Boolean(payload.is_active)
      if (!userId) return jsonResponse(400, { success: false, error: 'missing_user_id' })

      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', userId)
      if (error) return jsonResponse(500, { success: false, error: error.message })

      await bestEffortAuditLog(
        supabase,
        admin.user.id,
        action,
        { user_id: userId, is_active: isActive },
        'profile',
        userId,
      )
      return jsonResponse(200, { success: true, data: { user_id: userId, is_active: isActive } })
    }

    if (action === 'set_user_role') {
      const userId = String(payload.user_id ?? '')
      const role = String(payload.role ?? '')
      const normalizedRole = role.trim().toLowerCase()
      if (!userId || !normalizedRole) return jsonResponse(400, { success: false, error: 'invalid_params' })

      if (!['admin', 'assist', 'user'].includes(normalizedRole)) {
        return jsonResponse(400, { success: false, error: 'invalid_role', detail: normalizedRole })
      }

      // Prefer `role`, fall back to `user_role` for older schemas.
      let upErr = (await supabase
        .from('profiles')
        .update({ role: normalizedRole })
        .eq('id', userId)).error

      if (upErr && String(upErr.message || '').toLowerCase().includes('column')) {
        upErr = (await supabase
          .from('profiles')
          .update({ user_role: normalizedRole })
          .eq('id', userId)).error
      }

      if (upErr) return jsonResponse(500, { success: false, error: upErr.message })

      await bestEffortAuditLog(
        supabase,
        admin.user.id,
        action,
        { user_id: userId, role: normalizedRole },
        'profile',
        userId,
      )
      return jsonResponse(200, { success: true, data: { user_id: userId, role: normalizedRole } })
    }

    if (action === 'set_listing_premium') {
      const listingId = String(payload.listing_id ?? '')
      const isPremium = Boolean(payload.is_premium)
      const premiumUntil = payload.premium_until ?? null
      const premiumBadge = payload.premium_badge ?? null
      if (!listingId) return jsonResponse(400, { success: false, error: 'missing_listing_id' })

      const { error } = await supabase
        .from('listings')
        .update({
          is_premium: isPremium,
          premium_until: premiumUntil,
          premium_badge: premiumBadge,
        })
        .eq('id', listingId)
      if (error) return jsonResponse(500, { success: false, error: error.message })

      await bestEffortAuditLog(
        supabase,
        admin.user.id,
        action,
        { listing_id: listingId, is_premium: isPremium, premium_until: premiumUntil, premium_badge: premiumBadge },
        'listing',
        listingId,
      )
      return jsonResponse(200, { success: true, data: { listing_id: listingId, is_premium: isPremium } })
    }

    if (action === 'hide_listing') {
      const listingId = String(payload.listing_id ?? '')
      const hidden = Boolean(payload.hidden)
      if (!listingId) return jsonResponse(400, { success: false, error: 'missing_listing_id' })

      const status = hidden ? 'hidden' : 'active'
      const { error } = await supabase
        .from('listings')
        .update({ status })
        .eq('id', listingId)
      if (error) return jsonResponse(500, { success: false, error: error.message })

      await bestEffortAuditLog(
        supabase,
        admin.user.id,
        action,
        { listing_id: listingId, status },
        'listing',
        listingId,
      )
      return jsonResponse(200, { success: true, data: { listing_id: listingId, status } })
    }

    if (action === 'get_listing_owner') {
      const listingId = String(payload.listing_id ?? '').trim()
      if (!isUuid(listingId)) return jsonResponse(400, { success: false, error: 'invalid_listing_id' })

      const { data, error } = await supabase
        .from('listings')
        .select('id, user_id, title, status')
        .eq('id', listingId)
        .maybeSingle()

      if (error) return jsonResponse(500, { success: false, error: error.message })
      if (!data) return jsonResponse(404, { success: false, error: 'listing_not_found' })
      if (!data.user_id) return jsonResponse(404, { success: false, error: 'listing_owner_not_found' })

      return jsonResponse(200, {
        success: true,
        data: {
          listing_id: data.id,
          owner_user_id: data.user_id,
          title: data.title ?? null,
          status: data.status ?? null,
        },
      })
    }

    if (action === 'list_illegal_reports') {
      const limit = Math.max(1, Math.min(100, Number(payload.limit ?? 50)))
      const offset = Math.max(0, Number(payload.offset ?? 0) || 0)
      const reviewedRaw = payload.reviewed
      const listingId = String(payload.listing_id ?? '').trim()
      const reporterUser = String(payload.reporter_user ?? '').trim()
      const reasonQuery = String(payload.reason_query ?? '').trim()

      let query = supabase
        .from('illegal_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (typeof reviewedRaw === 'boolean') {
        query = query.eq('reviewed', reviewedRaw)
      }
      if (isUuid(listingId)) {
        query = query.eq('listing_id', listingId)
      }
      if (isUuid(reporterUser)) {
        query = query.eq('reporter_user', reporterUser)
      }
      if (reasonQuery) {
        query = query.ilike('reason', `%${sanitizeLikeQuery(reasonQuery)}%`)
      }

      const { data, error } = await query
      if (error) return jsonResponse(500, { success: false, error: error.message })
      return jsonResponse(200, { success: true, data: data ?? [] })
    }

    if (action === 'review_illegal_report') {
      const reportId = String(payload.report_id ?? '').trim()
      const reviewed = Boolean(payload.reviewed ?? true)
      if (!reportId) return jsonResponse(400, { success: false, error: 'report_id_required' })

      const updatePayload: Record<string, unknown> = {
        reviewed,
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'review_notes')) {
        updatePayload.review_notes = payload.review_notes ?? null
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'reviewed_by')) {
        updatePayload.reviewed_by = payload.reviewed_by ?? null
      }
      if (reviewed) {
        updatePayload.reviewed_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('illegal_reports')
        .update(updatePayload)
        .eq('id', reportId)
        .select('*')
        .single()

      if (error) return jsonResponse(500, { success: false, error: error.message })
      return jsonResponse(200, { success: true, data })
    }

    if (action === 'list_image_safety_flags') {
      const limit = Math.max(1, Math.min(200, Number(payload.limit ?? 100)))
      const offset = Math.max(0, Number(payload.offset ?? 0) || 0)
      const onlyPending = Boolean(payload.only_pending ?? false)
      const status = String(payload.status ?? '').trim().toLowerCase()
      const flagTypeQuery = String(payload.flag_type_query ?? '').trim()
      const userId = String(payload.user_id ?? '').trim()

      let query = supabase
        .from('image_safety_flags')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (onlyPending) {
        query = query.or('status.is.null,status.eq.pending')
      }
      if (status) {
        query = query.eq('status', status)
      }
      if (flagTypeQuery) {
        query = query.ilike('flag_type', `%${sanitizeLikeQuery(flagTypeQuery)}%`)
      }
      if (isUuid(userId)) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query
      if (error) return jsonResponse(500, { success: false, error: error.message })
      return jsonResponse(200, { success: true, data: data ?? [] })
    }

    if (action === 'review_image_safety_flag') {
      const flagId = String(payload.flag_id ?? '').trim()
      const status = String(payload.status ?? 'reviewed').trim().toLowerCase()
      const notes = payload.notes ?? null
      const reviewer = payload.reviewer ?? admin.user.id

      if (!isUuid(flagId)) return jsonResponse(400, { success: false, error: 'invalid_flag_id' })
      if (!['pending', 'reviewed', 'false_positive', 'blocked'].includes(status)) {
        return jsonResponse(400, { success: false, error: 'invalid_status', detail: status })
      }

      const { data, error } = await supabase
        .from('image_safety_flags')
        .update({
          status,
          notes,
          reviewer,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', flagId)
        .select('*')
        .single()

      if (error) return jsonResponse(500, { success: false, error: error.message })
      return jsonResponse(200, { success: true, data })
    }

    return jsonResponse(400, { success: false, error: 'unknown_action' })
  } catch (e) {
    return jsonResponse(500, { success: false, error: 'exception', detail: String(e) })
  }
})
