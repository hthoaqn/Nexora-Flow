'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  MailIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WorkflowIcon,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useAuth, slugId } from '@/lib/auth/session'
import { ThemeToggle } from '@/components/Controls'
import { Spinner } from '@/components/ui/spinner'

function workspaceFromEmail(email: string) {
  const domain = email.split('@')[1]?.split('.')[0]
  const local = email.split('@')[0]
  const raw = domain || local || 'workspace'
  return slugId(raw) || 'workspace'
}

/** Resolve org once at login — not changeable later from client UI */
function resolveOrgId(email: string, workspaceCode: string) {
  const code = slugId(workspaceCode)
  if (code) return code
  // Known product default for staff domains
  const domain = email.split('@')[1]?.toLowerCase() || ''
  if (domain === 'nexora-flow.cloud' || domain === 'nexora.flow') return 'nexora-flow'
  return workspaceFromEmail(email)
}

const highlights = [
  {
    icon: WorkflowIcon,
    title: 'Quy trình rõ ràng',
    body: 'Từ nhận hồ sơ đến quyết định — một không gian làm việc.',
  },
  {
    icon: SparklesIcon,
    title: 'AI hỗ trợ, người quyết',
    body: 'Gợi ý có bằng chứng. Shortlist và duyệt do con người.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Dữ liệu theo tổ chức',
    body: 'Mỗi đơn vị chỉ xem và xử lý hồ sơ trong phạm vi của mình.',
  },
]

function mapLoginError(code: string | null): string | null {
  if (!code) return null
  const map: Record<string, string> = {
    google_not_configured:
      'Google SSO chưa được cấu hình. Thêm GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET trên server.',
    missing_code: 'Google không trả về mã xác thực. Thử lại.',
    token_exchange_failed: 'Không đổi được token Google. Kiểm tra Client Secret / Redirect URI.',
    userinfo_failed: 'Không lấy được thông tin tài khoản Google.',
    oauth_failed: 'Đăng nhập Google thất bại. Thử lại sau.',
    sso_session: 'Phiên SSO hết hạn. Đăng nhập lại.',
    access_denied: 'Bạn đã từ chối quyền truy cập Google.',
  }
  return map[code] || `Lỗi đăng nhập: ${code}`
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

function LoginForm() {
  const { session, ready, signIn, signOut, clearSession } = useAuth()
  const router = useRouter()
  const search = useSearchParams()
  const forceSwitch = search?.get('switch') === '1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [workspaceCode, setWorkspaceCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalid, setInvalid] = useState({ email: false, password: false })
  // When already logged in, do NOT silent-redirect if user wants to switch
  const [switching, setSwitching] = useState(forceSwitch)

  useEffect(() => {
    // Only auto-enter workspace if a session exists and user is not switching accounts
    if (ready && session && !switching && !forceSwitch) {
      router.replace('/programs')
    }
  }, [ready, session, router, switching, forceSwitch])

  useEffect(() => {
    if (forceSwitch) {
      // Clear sticky identity so form is clean
      clearSession()
      setSwitching(true)
    }
  }, [forceSwitch, clearSession])

  useEffect(() => {
    const err = mapLoginError(search?.get('error') ?? null)
    if (err) {
      setError(err)
      setGooglePending(false)
    }
  }, [search])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const cleaned = email.trim().toLowerCase()
    const nextInvalid = {
      email: !cleaned || !cleaned.includes('@'),
      password: password.length < 1,
    }
    setInvalid(nextInvalid)
    if (nextInvalid.email || nextInvalid.password) {
      setError('Vui lòng nhập email và mật khẩu hợp lệ.')
      return
    }
    setPending(true)
    // Wipe previous account first (Viet Hoang etc.) then write new identity
    clearSession()
    const orgId = resolveOrgId(cleaned, workspaceCode)
    const elevated =
      Boolean(slugId(workspaceCode)) ||
      cleaned.endsWith('@nexora-flow.cloud')
    signIn({
      email: cleaned,
      organizationId: orgId,
      role: elevated ? 'owner' : 'reviewer',
      displayName: cleaned.split('@')[0],
    })
    router.replace('/programs')
  }

  const onGoogle = () => {
    setError(null)
    setGooglePending(true)
    // Must clear local session BEFORE OAuth, else old name can rehydrate
    clearSession()
    window.location.href = '/api/auth/google?prompt=select_account'
  }

  const onSwitchAccount = () => {
    signOut()
    setSwitching(true)
    setEmail('')
    setPassword('')
    setWorkspaceCode('')
    setError(null)
    router.replace('/workspace/login?switch=1')
  }

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-6" />
      </div>
    )
  }

  // Already signed in — offer continue OR switch (never trap on old account)
  if (session && !switching) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4">
        <Logo size={40} />
        <div className="max-w-sm text-center">
          <p className="text-sm text-muted-foreground">Phiên trên máy này</p>
          <p className="mt-1 font-heading text-lg font-semibold">
            {session.displayName || session.email}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{session.email}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Máy khác / người khác phải đăng xuất hoặc dùng tài khoản Google khác.
            Tên tổ chức trên dashboard ≠ tên người đăng nhập.
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2">
          <Button className="w-full rounded-full" onClick={() => router.replace('/programs')}>
            Vào workspace
          </Button>
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={onSwitchAccount}
          >
            Đăng xuất &amp; dùng tài khoản khác
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-svh w-full bg-background">
      {/* Soft ambient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-32 top-0 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-24 bottom-0 size-[24rem] rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Desktop brand panel */}
      <aside className="relative z-10 hidden w-[44%] flex-col justify-between border-r border-border/60 bg-muted/20 p-10 lg:flex xl:p-12">
        <Link href="/" className="inline-flex w-fit items-center gap-2.5">
          <Logo size={32} showWordmark={false} />
          <span className="font-heading text-lg font-semibold tracking-tight">
            Nexora Flow
          </span>
        </Link>

        <div className="flex max-w-md flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Badge variant="secondary" className="w-fit">
              Intake · Screening
            </Badge>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
              Sàng lọc startup có bằng chứng, quyết định do con người.
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Nhận pitch deck, xác nhận hồ sơ, chấm điểm theo rubric và shortlist trong một
              workspace.
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Nexora Flow
        </p>
      </aside>

      {/* Form */}
      <main className="relative z-10 flex min-h-svh flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2 lg:invisible">
            <Logo size={28} />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 pb-12 pt-2 sm:items-center sm:px-6 sm:pt-0">
          <div className="w-full max-w-[400px] shrink-0 py-4">
            <div className="mb-6">
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                Chào mừng trở lại
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Đăng nhập để mở không gian làm việc của bạn.
              </p>
            </div>

            {/* Google SSO */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mb-5 h-11 w-full gap-2.5 border-border/80 bg-background shadow-xs hover:bg-muted/40"
              disabled={googlePending || pending}
              onClick={onGoogle}
            >
              {googlePending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <GoogleIcon className="size-[18px] shrink-0" />
              )}
              {googlePending ? 'Đang chuyển tới Google…' : 'Tiếp tục với Google'}
            </Button>

            {/* Divider — avoid Separator w-full inside flex (clips text) */}
            <div className="relative mb-5">
              <div aria-hidden className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  hoặc email
                </span>
              </div>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <FieldGroup>
                <Field data-invalid={invalid.email || undefined}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <InputGroup className="h-11">
                    <InputGroupAddon align="inline-start">
                      <MailIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      aria-invalid={invalid.email || undefined}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (invalid.email) setInvalid((s) => ({ ...s, email: false }))
                      }}
                    />
                  </InputGroup>
                </Field>

                <Field data-invalid={invalid.password || undefined}>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel htmlFor="password">Mật khẩu</FieldLabel>
                    <button
                      type="button"
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setError('Liên hệ admin tổ chức để đặt lại mật khẩu.')
                      }
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <InputGroup className="h-11">
                    <InputGroupInput
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="current-password"
                      placeholder="Nhập mật khẩu"
                      value={password}
                      aria-invalid={invalid.password || undefined}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (invalid.password) setInvalid((s) => ({ ...s, password: false }))
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        type="button"
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription className="sr-only">Mật khẩu tài khoản</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="workspace">Mã workspace (tùy chọn)</FieldLabel>
                  <Input
                    id="workspace"
                    name="workspace"
                    autoComplete="organization"
                    placeholder="vd. nexora-flow"
                    value={workspaceCode}
                    onChange={(e) => setWorkspaceCode(e.target.value)}
                    className="h-11 font-mono text-sm"
                  />
                  <FieldDescription>
                    Chỉ nhập nếu admin mời bạn. Không có mã → workspace theo domain email.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" size="lg" className="h-11 w-full" disabled={pending || googlePending}>
                {pending ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Đang đăng nhập…
                  </>
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRightIcon data-icon="inline-end" />
                  </>
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Chưa có tài khoản?{' '}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() =>
                  setError('Liên hệ owner tổ chức để được mời vào workspace.')
                }
              >
                Yêu cầu quyền truy cập
              </button>
            </p>

            <div className="mt-4 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/" />}
                nativeButton={false}
              >
                ← Về trang chủ
              </Button>
            </div>
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
      <LoginForm />
    </Suspense>
  )
}
