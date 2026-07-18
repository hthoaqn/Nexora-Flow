import { NextResponse } from 'next/server'
import {
  googleClientConfig,
  googleRedirectUri,
  oauthAppOrigin,
} from '@/lib/auth/google-oauth'

/**
 * Google OAuth start.
 * Query: intent=workspace|startup (default workspace)
 *        prompt=select_account (default)
 */
export async function GET(req: Request) {
  const { clientId } = googleClientConfig()
  const origin = oauthAppOrigin(req)

  if (!clientId) {
    return NextResponse.redirect(
      new URL('/login?tab=workspace&error=google_not_configured', origin),
    )
  }

  const { searchParams } = new URL(req.url)
  const prompt = searchParams.get('prompt') || 'select_account'
  const intent =
    searchParams.get('intent') === 'startup' ? 'startup' : 'workspace'

  const redirectUri = googleRedirectUri(req)
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('access_type', 'online')
  url.searchParams.set('prompt', prompt)
  url.searchParams.set('include_granted_scopes', 'true')
  url.searchParams.set('state', intent)

  console.info('[google oauth start]', {
    redirectUri,
    intent,
    clientIdPrefix: clientId.slice(0, 12),
  })

  const res = NextResponse.redirect(url.toString())
  res.cookies.set('nexora.sso', '', { path: '/', maxAge: 0 })
  res.cookies.set('nexora.sso.intent', intent, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  // Remember exact redirect_uri used at authorize time (must match token exchange)
  res.cookies.set('nexora.sso.redirect_uri', redirectUri, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
