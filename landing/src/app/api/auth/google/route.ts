import { NextResponse } from 'next/server'

function appOrigin(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL
  if (env) return env.replace(/\/$/, '')
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  return 'https://nexora-flow.cloud'
}

export async function GET(req: Request) {
  const clientId =
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  if (!clientId) {
    return NextResponse.redirect(
      new URL('/workspace/login?error=google_not_configured', appOrigin(req)),
    )
  }

  const { searchParams } = new URL(req.url)
  // Always force account picker so switching Google users works
  const prompt = searchParams.get('prompt') || 'select_account'

  const redirectUri = `${appOrigin(req)}/api/auth/google/callback`
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('access_type', 'online')
  url.searchParams.set('prompt', prompt)
  url.searchParams.set('include_granted_scopes', 'true')

  // Clear any stale SSO cookie server-side before new login
  const res = NextResponse.redirect(url.toString())
  res.cookies.set('nexora.sso', '', { path: '/', maxAge: 0 })
  return res
}
