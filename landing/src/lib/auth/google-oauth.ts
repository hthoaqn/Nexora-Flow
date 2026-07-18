/**
 * Shared Google OAuth helpers — redirect_uri must match EXACTLY between
 * authorize, token exchange, and Google Cloud Console.
 */

export function oauthAppOrigin(req: Request): string {
  // Prefer the host the browser actually used (Vercel sets x-forwarded-*)
  const xfHost = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const xfProto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim()
  if (xfHost) {
    const host = xfHost.split(',')[0].trim()
    // Always https for production domains
    const proto =
      host.includes('localhost') || host.startsWith('127.')
        ? xfProto || 'http'
        : 'https'
    return `${proto}://${host}`.replace(/\/$/, '')
  }

  const env = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '')
  if (env) return env

  return 'https://nexora-flow.cloud'
}

export function googleRedirectUri(req: Request): string {
  return `${oauthAppOrigin(req)}/api/auth/google/callback`
}

/** Authorized redirect URIs to register in Google Cloud Console */
export const GOOGLE_REDIRECT_URIS_DOC = [
  'https://nexora-flow.cloud/api/auth/google/callback',
  // Preview deploys (optional):
  // 'https://*.vercel.app/api/auth/google/callback' — Google needs exact URLs, add each preview if needed
]

export function googleClientConfig() {
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    ''
  ).trim()
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim()
  return { clientId, clientSecret }
}
