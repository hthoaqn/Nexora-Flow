import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import {
  googleClientConfig,
  googleRedirectUri,
  oauthAppOrigin,
} from '@/lib/auth/google-oauth'

function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL || 'https://api.nexora-flow.cloud').replace(
    /\/$/,
    '',
  )
}

/** Deterministic password so Google SSO can re-login without new backend endpoint */
function ssoPassword(googleSub: string) {
  const secret = process.env.GOOGLE_CLIENT_SECRET || 'nexora-sso'
  return (
    'Ng$o' +
    createHash('sha256')
      .update(`${secret}:${googleSub}`)
      .digest('base64url')
      .slice(0, 28)
  )
}

type GoogleTokenResponse = {
  access_token?: string
  id_token?: string
  error?: string
  error_description?: string
}

type GoogleUserInfo = {
  sub: string
  email?: string
  name?: string
  picture?: string
  given_name?: string
}

type AuthPayload = {
  user?: {
    id?: string
    email?: string
    fullName?: string
    role?: string
    status?: string
  }
  accessToken?: string
  refreshToken?: string
  detail?: { code?: string; message?: string }
}

function unwrapAuth(body: unknown): AuthPayload {
  if (!body || typeof body !== 'object') return {}
  const b = body as Record<string, unknown>
  if (b.data && typeof b.data === 'object' && (b.success !== undefined || b.data)) {
    return b.data as AuthPayload
  }
  return b as AuthPayload
}

function hasTokens(p: AuthPayload) {
  return Boolean(p.accessToken && p.user)
}

function detailCode(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const b = body as Record<string, unknown>
  const d = b.detail
  if (d && typeof d === 'object' && 'code' in d)
    return String((d as { code?: string }).code || '')
  if (typeof b.code === 'string') return b.code
  return ''
}

function cookieValue(req: Request, name: string): string {
  return (
    req.headers
      .get('cookie')
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ''
  )
}

/**
 * Startup Google SSO via existing email/password auth:
 * login → register (if new) → accept ACCOUNT_PENDING tokens / pending status.
 */
async function startupSsoAuth(user: GoogleUserInfo) {
  const email = (user.email || '').toLowerCase()
  const password = ssoPassword(user.sub)
  const fullName = user.name || user.given_name || email.split('@')[0]
  const base = apiBase()
  const headers = { 'content-type': 'application/json' }

  const tryLogin = async (): Promise<{
    ok: boolean
    status: number
    payload: AuthPayload
    raw: unknown
  }> => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password }),
    })
    const raw = await res.json().catch(() => ({}))
    const payload = unwrapAuth(raw)
    if (!payload.accessToken && raw && typeof raw === 'object') {
      const r = raw as AuthPayload
      if (r.accessToken) Object.assign(payload, r)
    }
    return { ok: res.ok, status: res.status, payload, raw }
  }

  let login = await tryLogin()
  if (login.ok && hasTokens(login.payload)) return login.payload
  if (hasTokens(login.payload)) {
    if (!login.payload.user!.status) login.payload.user!.status = 'pending'
    return login.payload
  }

  const regRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      fullName,
      role: 'startup',
      agreeTerms: true,
      expectedStartupName: '',
    }),
  })
  const regRaw = await regRes.json().catch(() => ({}))
  const regPayload = unwrapAuth(regRaw)
  if ((regRes.ok || regRes.status === 201) && hasTokens(regPayload)) {
    if (!regPayload.user!.status) regPayload.user!.status = 'pending'
    return regPayload
  }

  login = await tryLogin()
  if (login.ok && hasTokens(login.payload)) return login.payload
  if (hasTokens(login.payload)) {
    if (!login.payload.user!.status) login.payload.user!.status = 'pending'
    return login.payload
  }

  const code = detailCode(login.raw) || detailCode(regRaw)
  if (
    code === 'ACCOUNT_PENDING' ||
    login.status === 403 ||
    String(
      (login.raw as { detail?: { message?: string } })?.detail?.message || '',
    )
      .toLowerCase()
      .includes('pending')
  ) {
    return {
      user: {
        id: `sso-pending-${createHash('sha256').update(email).digest('hex').slice(0, 16)}`,
        email,
        fullName,
        role: 'startup',
        status: 'pending',
      },
      accessToken: '',
      refreshToken: '',
    }
  }

  throw Object.assign(new Error('startup_sso_failed'), {
    body: login.raw || regRaw,
    status: login.status || regRes.status,
    code,
  })
}

export async function GET(req: Request) {
  const origin = oauthAppOrigin(req)
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')
  const state = searchParams.get('state') || 'workspace'
  const cookieIntent = decodeURIComponent(cookieValue(req, 'nexora.sso.intent') || state)
  const intent =
    cookieIntent === 'startup' || state === 'startup' ? 'startup' : 'workspace'
  const failTab = intent === 'startup' ? 'startup' : 'workspace'

  if (oauthError) {
    return NextResponse.redirect(
      new URL(
        `/login?tab=${failTab}&error=${encodeURIComponent(oauthError)}`,
        origin,
      ),
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?tab=${failTab}&error=missing_code`, origin),
    )
  }

  const { clientId, clientSecret } = googleClientConfig()

  if (!clientId || !clientSecret) {
    console.error('[google oauth] missing client id/secret', {
      hasId: !!clientId,
      hasSecret: !!clientSecret,
    })
    return NextResponse.redirect(
      new URL(`/login?tab=${failTab}&error=google_not_configured`, origin),
    )
  }

  // MUST match authorize redirect_uri exactly (cookie from start, else recompute)
  const storedRedirect = decodeURIComponent(
    cookieValue(req, 'nexora.sso.redirect_uri') || '',
  )
  const redirectUri = storedRedirect || googleRedirectUri(req)

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenJson = (await tokenRes.json()) as GoogleTokenResponse
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error('[google oauth] token exchange failed', {
        status: tokenRes.status,
        error: tokenJson.error,
        description: tokenJson.error_description,
        redirectUri,
        clientIdPrefix: clientId.slice(0, 16),
        secretLen: clientSecret.length,
      })
      // Surface a more specific code for redirect mismatch
      const gErr = String(tokenJson.error || '')
      const desc = String(tokenJson.error_description || '').toLowerCase()
      let errCode = 'token_exchange_failed'
      if (
        gErr === 'redirect_uri_mismatch' ||
        desc.includes('redirect_uri')
      ) {
        errCode = 'redirect_uri_mismatch'
      } else if (
        gErr === 'invalid_client' ||
        desc.includes('client') ||
        desc.includes('secret')
      ) {
        errCode = 'invalid_google_client'
      }
      return NextResponse.redirect(
        new URL(`/login?tab=${failTab}&error=${errCode}`, origin),
      )
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    const user = (await userRes.json()) as GoogleUserInfo

    if (!userRes.ok || !user.email) {
      return NextResponse.redirect(
        new URL(`/login?tab=${failTab}&error=userinfo_failed`, origin),
      )
    }

    if (intent === 'startup') {
      try {
        const data = await startupSsoAuth(user)
        if (!data.user) throw new Error('startup_sso_no_user')
        const payload = {
          intent: 'startup' as const,
          user: data.user,
          accessToken: data.accessToken || '',
          refreshToken: data.refreshToken || '',
        }
        const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
          'base64url',
        )
        const res = NextResponse.redirect(
          new URL('/auth/callback?provider=google&intent=startup', origin),
        )
        res.cookies.set('nexora.sso', encoded, {
          httpOnly: false,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 180,
        })
        res.cookies.set('nexora.sso.intent', '', { path: '/', maxAge: 0 })
        res.cookies.set('nexora.sso.redirect_uri', '', { path: '/', maxAge: 0 })
        return res
      } catch (e) {
        console.error('startup sso', e)
        return NextResponse.redirect(
          new URL('/login?tab=startup&error=oauth_failed', origin),
        )
      }
    }

    // Intake / workspace SSO
    const email = user.email.toLowerCase()
    const domain = email.split('@')[1] || 'workspace'
    let organizationId = (domain.split('.')[0] || 'workspace')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 48)
    if (
      domain === 'nexora-flow.cloud' ||
      domain.endsWith('.nexora-flow.cloud')
    ) {
      organizationId = 'nexora-flow'
    }

    const payload = {
      intent: 'workspace' as const,
      userId: `google-${user.sub}`,
      email,
      displayName: user.name || user.given_name || email.split('@')[0],
      organizationId,
      role: 'owner' as const,
      picture: user.picture || '',
      provider: 'google' as const,
    }

    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    )

    const res = NextResponse.redirect(
      new URL('/auth/callback?provider=google&intent=workspace', origin),
    )
    res.cookies.set('nexora.sso', encoded, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 180,
    })
    res.cookies.set('nexora.sso.intent', '', { path: '/', maxAge: 0 })
    res.cookies.set('nexora.sso.redirect_uri', '', { path: '/', maxAge: 0 })
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.redirect(
      new URL(`/login?tab=${failTab}&error=oauth_failed`, origin),
    )
  }
}
