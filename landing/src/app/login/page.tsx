'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRightIcon,
  Building2Icon,
  EyeIcon,
  EyeOffIcon,
  MailIcon,
  RocketIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WorkflowIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { ThemeToggle, LangToggle } from '@/components/Controls'
import { Spinner } from '@/components/ui/spinner'
import { useAuth, slugId } from '@/lib/auth/session'
import { useI18n } from '@/lib/i18n'
import { api } from '@/deal-flow/frontend/api'
import { useAuthStore } from '@/deal-flow/frontend/store/useAuthStore'
import { cn } from '@/lib/utils'

type RoleTab = 'startup' | 'workspace'

function workspaceFromEmail(email: string) {
  const domain = email.split('@')[1]?.split('.')[0]
  const local = email.split('@')[0]
  const raw = domain || local || 'workspace'
  return slugId(raw) || 'workspace'
}

function resolveOrgId(email: string, workspaceCode: string) {
  const code = slugId(workspaceCode)
  if (code) return code
  const domain = email.split('@')[1]?.toLowerCase() || ''
  if (domain === 'nexora-flow.cloud' || domain === 'nexora.flow') return 'nexora-flow'
  return workspaceFromEmail(email)
}

function mapLoginError(code: string | null, lang: string): string | null {
  if (!code) return null
  const vi: Record<string, string> = {
    google_not_configured:
      'Google SSO chưa được cấu hình. Thêm GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET trên server.',
    missing_code: 'Google không trả về mã xác thực. Thử lại.',
    token_exchange_failed:
      'Không đổi được token Google. Kiểm tra Client Secret / Redirect URI trong Google Cloud Console.',
    redirect_uri_mismatch:
      'Redirect URI không khớp. Trong Google Cloud → Credentials, thêm đúng: https://nexora-flow.cloud/api/auth/google/callback',
    invalid_google_client:
      'Client ID hoặc Client Secret sai. Kiểm tra GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET trên Vercel.',
    userinfo_failed: 'Không lấy được thông tin tài khoản Google.',
    oauth_failed: 'Đăng nhập Google thất bại. Thử lại sau.',
    sso_session: 'Phiên SSO hết hạn. Đăng nhập lại.',
    access_denied: 'Bạn đã từ chối quyền truy cập Google.',
  }
  const en: Record<string, string> = {
    google_not_configured:
      'Google SSO is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.',
    missing_code: 'Google did not return an auth code. Try again.',
    token_exchange_failed:
      'Could not exchange the Google token. Check Client Secret / Redirect URI in Google Cloud Console.',
    redirect_uri_mismatch:
      'Redirect URI mismatch. In Google Cloud → Credentials add exactly: https://nexora-flow.cloud/api/auth/google/callback',
    invalid_google_client:
      'Invalid Client ID or Client Secret. Check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET on Vercel.',
    userinfo_failed: 'Could not fetch your Google account info.',
    oauth_failed: 'Google sign-in failed. Try again later.',
    sso_session: 'SSO session expired. Sign in again.',
    access_denied: 'You denied Google access.',
  }
  const map = lang === 'vi' ? vi : en
  return map[code] || (lang === 'vi' ? `Lỗi đăng nhập: ${code}` : `Sign-in error: ${code}`)
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function UnifiedLogin() {
  const { lang } = useI18n()
  const tx = (vi: string, en: string) => (lang === 'vi' ? vi : en)
  const router = useRouter()
  const search = useSearchParams()
  const initialTab =
    search?.get('tab') === 'workspace' || search?.get('switch') === '1'
      ? 'workspace'
      : 'startup'

  const [tab, setTab] = useState<RoleTab>(initialTab)

  // ── Startup (deal-flow portal) ─────────────────────────────────
  const setStartupAuth = useAuthStore((s) => s.setAuth)
  const [sEmail, setSEmail] = useState('')
  const [sPassword, setSPassword] = useState('')
  const [sPending, setSPending] = useState(false)
  const [sError, setSError] = useState<string | null>(null)

  // ── Workspace / intake ─────────────────────────────────────────
  const { session, ready, signIn, signOut, clearSession } = useAuth()
  const forceSwitch = search?.get('switch') === '1'
  const [wEmail, setWEmail] = useState('')
  const [wPassword, setWPassword] = useState('')
  const [workspaceCode, setWorkspaceCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [wPending, setWPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const [wError, setWError] = useState<string | null>(null)
  const [switching, setSwitching] = useState(forceSwitch)

  useEffect(() => {
    if (search?.get('tab') === 'workspace') setTab('workspace')
    if (search?.get('tab') === 'startup') setTab('startup')
  }, [search])

  useEffect(() => {
    if (ready && session && !switching && !forceSwitch && tab === 'workspace') {
      router.replace('/programs')
    }
  }, [ready, session, router, switching, forceSwitch, tab])

  useEffect(() => {
    if (forceSwitch) {
      clearSession()
      setSwitching(true)
      setTab('workspace')
    }
  }, [forceSwitch, clearSession])

  useEffect(() => {
    const err = mapLoginError(search?.get('error') ?? null, lang)
    if (err) {
      setWError(err)
      setTab('workspace')
      setGooglePending(false)
    }
  }, [search])

  const onStartupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSError(null)
    if (!sEmail || !sPassword) {
      setSError(tx('Vui lòng điền email và mật khẩu.', 'Please enter your email and password.'))
      return
    }
    setSPending(true)
    try {
      const response = await api.post('/auth/login', {
        email: sEmail.trim().toLowerCase(),
        password: sPassword,
      })
      const payload = response.data?.data ?? response.data
      const user = payload?.user
      const accessToken = payload?.accessToken
      const refreshToken = payload?.refreshToken
      if (user && accessToken) {
        // Bức tường tách tài khoản: tài khoản intake/workspace không vào được Startup Portal
        const role = String(user.role || 'startup').toLowerCase()
        if (role !== 'startup') {
          setSError(
            tx(
              'Tài khoản này thuộc Intake workspace — không thể đăng nhập Startup Portal.',
              'This account belongs to the intake workspace — it cannot sign in to the Startup Portal.',
            ),
          )
          return
        }
        const st = String(user.status || 'active').toLowerCase()
        if (st === 'pending') {
          setStartupAuth(user, accessToken, refreshToken || '')
          window.location.href = '/pending'
          return
        }
        if (st === 'rejected') {
          setSError(
            tx(
              'Tài khoản đã bị từ chối bởi admin.',
              'This account was rejected by an admin.',
            ),
          )
          return
        }
        setStartupAuth(user, accessToken, refreshToken || '')
        toast.success(tx(`Chào mừng, ${user.fullName || user.email}!`, `Welcome, ${user.fullName || user.email}!`))
        window.location.href = '/dashboard'
        return
      }
      setSError(tx('Phản hồi đăng nhập không hợp lệ.', 'Invalid login response.'))
    } catch (err: unknown) {
      const ax = err as {
        response?: {
          data?: {
            error?: { details?: string; code?: string }
            message?: string
            detail?: { code?: string; message?: string } | string
          }
        }
      }
      const code =
        ax?.response?.data?.error?.code ||
        (typeof ax?.response?.data?.detail === 'object'
          ? ax?.response?.data?.detail?.code
          : undefined)
      if (code === 'ACCOUNT_PENDING' || code === 'PENDING_APPROVAL') {
        window.location.href = '/pending'
        return
      }
      const details =
        ax?.response?.data?.error?.details ||
        (typeof ax?.response?.data?.detail === 'object'
          ? ax?.response?.data?.detail?.message
          : typeof ax?.response?.data?.detail === 'string'
            ? ax?.response?.data?.detail
            : undefined)
      const msg = ax?.response?.data?.message
      setSError(details || msg || tx('Email hoặc mật khẩu không đúng.', 'Incorrect email or password.'))
    } finally {
      setSPending(false)
    }
  }

  const onWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setWError(null)
    const cleaned = wEmail.trim().toLowerCase()
    if (!cleaned.includes('@') || wPassword.length < 1) {
      setWError(tx('Vui lòng nhập email và mật khẩu hợp lệ.', 'Please enter a valid email and password.'))
      return
    }
    setWPending(true)
    // Bức tường tách tài khoản: email đã đăng ký Startup Portal không được vào intake
    try {
      const check = await api.get('/auth/account-type', { params: { email: cleaned } })
      const type = check.data?.data?.type || check.data?.type
      if (String(type).toLowerCase() === 'startup') {
        setWError(
          tx(
            'Email này thuộc tài khoản Startup Portal — không thể đăng nhập Intake workspace. Dùng email tổ chức khác.',
            'This email belongs to a Startup Portal account — it cannot sign in to the intake workspace. Use a different organization email.',
          ),
        )
        setWPending(false)
        return
      }
    } catch {
      /* separation check unavailable — continue */
    }
    clearSession()
    const orgId = resolveOrgId(cleaned, workspaceCode)
    const elevated =
      Boolean(slugId(workspaceCode)) || cleaned.endsWith('@nexora-flow.cloud')
    try {
      // Prefer real API (admin-gated) when available
      const response = await api.post('/auth/login', {
        email: cleaned,
        password: wPassword,
      })
      const payload = response.data?.data ?? response.data
      const user = payload?.user
      if (user) {
        const st = String(user.status || 'active').toLowerCase()
        if (st === 'pending') {
          window.location.href = '/pending'
          return
        }
        if (st === 'rejected') {
          setWError(tx('Tài khoản đã bị từ chối bởi admin.', 'Account rejected by admin.'))
          return
        }
        signIn({
          email: cleaned,
          organizationId: user.organizationId || orgId,
          role: (user.role === 'owner' || user.role === 'admin' ? 'owner' : elevated ? 'owner' : 'reviewer') as any,
          displayName: user.fullName || cleaned.split('@')[0],
          userId: user.id,
        })
        router.replace('/programs')
        return
      }
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: { detail?: { code?: string; message?: string }; error?: { code?: string; details?: string }; message?: string } }
      }
      const code =
        ax?.response?.data?.error?.code ||
        (typeof ax?.response?.data?.detail === 'object'
          ? ax?.response?.data?.detail?.code
          : undefined)
      if (code === 'ACCOUNT_PENDING' || code === 'PENDING_APPROVAL') {
        window.location.href = '/pending'
        return
      }
      // Real API is the single source of truth — wrong credentials never enter
      if (ax?.response?.status === 401) {
        setWError(tx('Email hoặc mật khẩu không đúng.', 'Incorrect email or password.'))
      } else if (ax?.response?.status === 404) {
        setWError(
          tx(
            'Tài khoản chưa tồn tại. Đăng ký tài khoản tổ chức và chờ admin phê duyệt.',
            'Account not found. Register an organization account and wait for admin approval.',
          ),
        )
      } else {
        setWError(tx('Đăng nhập intake thất bại. Thử lại sau.', 'Intake sign-in failed. Try again later.'))
      }
      setWPending(false)
      return
    }
    setWError(tx('Phản hồi đăng nhập không hợp lệ.', 'Invalid login response.'))
    setWPending(false)
  }

  const onGoogle = (intent: 'workspace' | 'startup' = 'workspace') => {
    setWError(null)
    setSError(null)
    setGooglePending(true)
    if (intent === 'workspace') clearSession()
    window.location.href = `/api/auth/google?prompt=select_account&intent=${intent}`
  }

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (session && !switching && tab === 'workspace') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4">
        <Logo size={40} />
        <div className="max-w-sm text-center">
          <p className="text-sm text-muted-foreground">{tx('Phiên intake trên máy này', 'Intake session on this device')}</p>
          <p className="mt-1 font-heading text-lg font-semibold">
            {session.displayName || session.email}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{session.email}</p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button className="w-full rounded-full" onClick={() => router.replace('/programs')}>
            {tx('Vào intake workspace', 'Enter intake workspace')}
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={() => {
              signOut()
              setSwitching(true)
            }}
          >
            {tx('Đăng xuất & dùng tài khoản khác', 'Sign out & use another account')}
          </Button>
          <Button
            variant="ghost"
            className="w-full rounded-full"
            onClick={() => setTab('startup')}
          >
            {tx('Đăng nhập startup thay thế', 'Sign in as a startup instead')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-svh w-full bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-24 bottom-0 size-[24rem] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <aside className="relative z-10 hidden w-[42%] flex-col justify-between border-r border-border/60 bg-muted/20 p-10 lg:flex xl:p-12">
        <Link href="/" className="inline-flex w-fit items-center gap-2.5">
          <Logo size={32} showWordmark={false} />
          <span className="font-heading text-lg font-semibold tracking-tight">
            Nexora Flow
          </span>
        </Link>

        <div className="flex max-w-md flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Badge variant="secondary" className="w-fit">
              {tx('Một cửa đăng nhập', 'One sign-in for everything')}
            </Badge>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
              Startup match · Intake screening
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {tx('Chọn vai trò của bạn. Cùng một trang — hai không gian làm việc, logic giữ nguyên như từng portal.', 'Pick your role. One page — two workspaces, same logic as each portal.')}
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <RocketIcon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Startup</p>
                <p className="text-xs text-muted-foreground">
                  {tx('Hồ sơ, match, intro, sandbox — deal-flow A–Z.', 'Profile, matches, intros, sandbox — deal-flow A–Z.')}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2Icon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Partner / Reviewer</p>
                <p className="text-xs text-muted-foreground">
                  {tx('Chương trình intake, chấm điểm, shortlist, audit.', 'Intake programs, scoring, shortlist, audit.')}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <WorkflowIcon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{tx('AI gợi ý · người duyệt', 'AI suggests · humans approve')}</p>
                <p className="text-xs text-muted-foreground">
                  {tx('Fit có bằng chứng. Không auto-send intro.', 'Evidence-bound fit. No auto-sent intros.')}
                </p>
              </div>
            </li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nexora Flow
        </p>
      </aside>

      <main className="relative z-10 flex min-h-svh flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 lg:invisible">
            <Logo size={28} />
          </Link>
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 pb-12 pt-2 sm:items-center sm:px-6">
          <div className="w-full max-w-[420px] py-4">
            <div className="mb-6">
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                {tx('Đăng nhập', 'Sign in')}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {tx('Chọn vai trò — một form, đúng không gian làm việc của bạn.', 'Pick a role — one form, straight to your workspace.')}
              </p>
            </div>

            <Tabs
              value={tab}
              onValueChange={(v) => setTab((v as RoleTab) || 'startup')}
              className="w-full"
            >
              <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1">
                <TabsTrigger
                  value="startup"
                  className="flex items-center gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm"
                >
                  <RocketIcon className="size-3.5" />
                  Startup
                </TabsTrigger>
                <TabsTrigger
                  value="workspace"
                  className="flex items-center gap-1.5 rounded-lg py-2.5 text-xs sm:text-sm"
                >
                  <Building2Icon className="size-3.5" />
                  Intake
                </TabsTrigger>
              </TabsList>

              {/* ── Startup tab ─────────────────────────────────── */}
              <TabsContent value="startup" className="outline-none">
                <div className="grid gap-4">
                  {sError && (
                    <Alert variant="destructive">
                      <AlertDescription>{sError}</AlertDescription>
                    </Alert>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-full"
                    disabled={googlePending}
                    onClick={() => onGoogle('startup')}
                  >
                    {googlePending ? (
                      <Spinner className="size-4" />
                    ) : (
                      <>
                        <GoogleIcon className="size-4" />
                        {tx('Tiếp tục với Google', 'Continue with Google')}
                      </>
                    )}
                  </Button>
                  <div className="relative py-1 text-center text-xs text-muted-foreground">
                    <span className="relative z-10 bg-background px-2">
                      {tx('hoặc email', 'or with email')}
                    </span>
                    <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                  </div>
                <form className="grid gap-4" onSubmit={onStartupSubmit}>
                  <div className="grid gap-2">
                    <Label htmlFor="s-email">{tx('Email startup', 'Startup email')}</Label>
                    <Input
                      id="s-email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="founder@startup.com"
                      value={sEmail}
                      onChange={(e) => setSEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="s-password">{tx('Mật khẩu', 'Password')}</Label>
                    <Input
                      id="s-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      placeholder="••••••••"
                      value={sPassword}
                      onChange={(e) => setSPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="btn-glow mt-1 w-full rounded-full"
                    disabled={sPending}
                  >
                    {sPending ? (
                      <Spinner className="size-4" />
                    ) : (
                      <>
                        {tx('Vào startup portal', 'Enter startup portal')}
                        <ArrowRightIcon className="size-4" />
                      </>
                    )}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    {tx('Chưa có tài khoản?', "Don't have an account?")}{' '}
                    <Link
                      href="/register"
                      className="font-semibold text-primary hover:underline"
                    >
                      {tx('Đăng ký startup', 'Register your startup')}
                    </Link>
                  </p>
                </form>
                </div>
              </TabsContent>

              {/* ── Workspace / intake tab ──────────────────────── */}
              <TabsContent value="workspace" className="outline-none">
                <div className="grid gap-4">
                  {wError && (
                    <Alert variant="destructive">
                      <AlertDescription>{wError}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-full"
                    disabled={googlePending}
                    onClick={() => onGoogle('workspace')}
                  >
                    {googlePending ? (
                      <Spinner className="size-4" />
                    ) : (
                      <>
                        <GoogleIcon className="size-4" />
                        {tx('Tiếp tục với Google', 'Continue with Google')}
                      </>
                    )}
                  </Button>

                  <div className="relative py-1 text-center text-xs text-muted-foreground">
                    <span className="relative z-10 bg-background px-2">{tx('hoặc email', 'or with email')}</span>
                    <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                  </div>

                  <form className="grid gap-4" onSubmit={onWorkspaceSubmit}>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="w-email">{tx('Email tổ chức', 'Organization email')}</FieldLabel>
                        <InputGroup>
                          <InputGroupAddon>
                            <MailIcon />
                          </InputGroupAddon>
                          <InputGroupInput
                            id="w-email"
                            type="email"
                            autoComplete="email"
                            required
                            placeholder="name@org.com"
                            value={wEmail}
                            onChange={(e) => setWEmail(e.target.value)}
                          />
                        </InputGroup>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="w-password">{tx('Mật khẩu', 'Password')}</FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            id="w-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            required
                            placeholder="••••••••"
                            value={wPassword}
                            onChange={(e) => setWPassword(e.target.value)}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              type="button"
                              size="icon-xs"
                              onClick={() => setShowPassword((v) => !v)}
                              aria-label={showPassword ? tx('Ẩn', 'Hide') : tx('Hiện', 'Show')}
                            >
                              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                            </InputGroupButton>
                          </InputGroupAddon>
                        </InputGroup>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="w-code">{tx('Mã workspace (tuỳ chọn)', 'Workspace code (optional)')}</FieldLabel>
                        <Input
                          id="w-code"
                          placeholder={tx('vd. nexora-flow', 'e.g. nexora-flow')}
                          value={workspaceCode}
                          onChange={(e) => setWorkspaceCode(e.target.value)}
                        />
                        <FieldDescription>
                          {tx('Để trống sẽ suy ra từ domain email.', 'Leave blank to infer from your email domain.')}
                        </FieldDescription>
                      </Field>
                    </FieldGroup>
                    <Button
                      type="submit"
                      className="btn-glow w-full rounded-full"
                      disabled={wPending}
                    >
                      {wPending ? (
                        <Spinner className="size-4" />
                      ) : (
                        <>
                          {tx('Vào intake workspace', 'Enter intake workspace')}
                          <ArrowRightIcon className="size-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>

            {/* Admin has no public entry point — staff reach it via direct URL /admin only */}
            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground hover:underline">
                {tx('Chính sách bảo mật', 'Privacy policy')}
              </Link>
              <span className="mx-2">·</span>
              <Link href="/terms" className="hover:text-foreground hover:underline">
                {tx('Điều khoản sử dụng', 'Terms of service')}
              </Link>
            </p>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              <ShieldCheckIcon className="mr-1 inline size-3" />
              {tx(
                'AI gợi ý · admin duyệt tài khoản · con người quyết định deal',
                'AI suggests · admin approves accounts · humans decide deals',
              )}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <Spinner className="size-6" />
        </div>
      }
    >
      <UnifiedLogin />
    </Suspense>
  )
}
