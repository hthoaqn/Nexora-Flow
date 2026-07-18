import { NextResponse } from 'next/server'

function appOrigin(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL
  if (env) return env.replace(/\/$/, '')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  return 'https://nexora-flow.cloud'
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
  email_verified?: boolean
  name?: string
  picture?: string
  given_name?: string
}

export async function GET(req: Request) {
  const origin = appOrigin(req)
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/workspace/login?error=${encodeURIComponent(oauthError)}`, origin),
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL('/workspace/login?error=missing_code', origin))
  }

  const clientId =
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL('/workspace/login?error=google_not_configured', origin),
    )
  }

  const redirectUri = `${origin}/api/auth/google/callback`

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
      console.error('Google token error', tokenJson)
      return NextResponse.redirect(
        new URL('/workspace/login?error=token_exchange_failed', origin),
      )
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    const user = (await userRes.json()) as GoogleUserInfo

    if (!userRes.ok || !user.email) {
      return NextResponse.redirect(
        new URL('/workspace/login?error=userinfo_failed', origin),
      )
    }

    // Hand session to client via short-lived cookie (one-shot hydrate)
    // organizationId from email domain — NOT the person's display name
    const email = user.email.toLowerCase()
    const domain = email.split('@')[1] || 'workspace'
    let organizationId = (domain.split('.')[0] || 'workspace')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 48)
    // Staff / product domain → shared demo workspace
    if (domain === 'nexora-flow.cloud' || domain.endsWith('.nexora-flow.cloud')) {
      organizationId = 'nexora-flow'
    }

    const payload = {
      userId: `google-${user.sub}`,
      email,
      // Personal identity only — never used as organization title
      displayName: user.name || user.given_name || email.split('@')[0],
      organizationId,
      role: 'owner' as const,
      picture: user.picture || '',
      provider: 'google' as const,
    }

    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url',
    )

    const res = NextResponse.redirect(new URL('/auth/callback?provider=google', origin))
    // Client page must read this once. Keep non-httpOnly, short TTL.
    // Always Secure on the public site (HTTPS); Lax so top-level OAuth redirect sends it.
    res.cookies.set('nexora.sso', encoded, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 180,
    })
    return res
  } catch (e) {
    console.error(e)
    return NextResponse.redirect(new URL('/workspace/login?error=oauth_failed', origin))
  }
}
