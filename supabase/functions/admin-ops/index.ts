import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

type Json = Record<string, unknown>

function jsonResponse(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
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

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (profileErr) {
    return { ok: false as const, error: 'profile_error', detail: profileErr.message }
  }
  if (!profile || profile.role !== 'admin' || profile.is_active !== true) {
    return { ok: false as const, error: 'forbidden' }
  }

  return {
    ok: true as const,
    user: {
      id: userId,
      email: userData.user.email ?? null,
      role: profile.role,
    },
  }
}

Deno.serve(async (req) => {
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
      if (!userId || !role) return jsonResponse(400, { success: false, error: 'invalid_params' })

      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId)
      if (error) return jsonResponse(500, { success: false, error: error.message })

      await bestEffortAuditLog(
        supabase,
        admin.user.id,
        action,
        { user_id: userId, role },
        'profile',
        userId,
      )
      return jsonResponse(200, { success: true, data: { user_id: userId, role } })
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

    if (action === 'list_illegal_reports') {
      const limit = Math.max(1, Math.min(100, Number(payload.limit ?? 50)))
      const { data, error } = await supabase
        .from('illegal_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return jsonResponse(500, { success: false, error: error.message })
      return jsonResponse(200, { success: true, data: data ?? [] })
    }

    return jsonResponse(400, { success: false, error: 'unknown_action' })
  } catch (e) {
    return jsonResponse(500, { success: false, error: 'exception', detail: String(e) })
  }
})
