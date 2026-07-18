'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRightIcon,
  Building2Icon,
  LockIcon,
  MailIcon,
  RocketIcon,
  ShieldCheckIcon,
  UserIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ThemeToggle, LangToggle } from '@/components/Controls'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/deal-flow/frontend/api'
import { useAuthStore } from '@/deal-flow/frontend/store/useAuthStore'
import { useI18n } from '@/lib/i18n'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.6 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.7H12z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.3l3 2.2C7.7 7.3 9.7 6.2 12 6.2c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.6 2.8 12 2.8 8.3 2.8 5.1 4.9 3.9 7.3z"
      />
      <path
        fill="#4A90E2"
        d="M12 21.2c2.5 0 4.6-.8 6.1-2.2l-2.9-2.2c-.8.6-1.9 1-3.2 1-3.5 0-6.5-2.4-7.5-5.6l-3 2.3C3 18.9 7.1 21.2 12 21.2z"
      />
      <path
        fill="#FBBC05"
        d="M4.5 14.2c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9l-3-2.3C1.2 9.4 1 10.7 1 12.3s.2 2.9.7 4.2l2.8-2.3z"
      />
    </svg>
  )
}

export default function RegisterPage() {
  const { lang } = useI18n()
  const tx = (vi: string, en: string) => (lang === 'vi' ? vi : en)
  const setAuth = useAuthStore((s) => s.setAuth)

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [expectedStartupName, setExpectedStartupName] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onGoogle = () => {
    setError(null)
    setGooglePending(true)
    window.location.href = '/api/auth/google?prompt=select_account&intent=startup'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName || !email || !password || !confirmPassword) {
      setError(tx('Vui lòng điền đầy đủ các trường bắt buộc.', 'Please fill in all required fields.'))
      return
    }
    if (password !== confirmPassword) {
      setError(tx('Mật khẩu xác nhận không trùng khớp.', 'Password confirmation does not match.'))
      return
    }
    if (!agreeTerms) {
      setError(tx('Bạn phải đồng ý với điều khoản dịch vụ.', 'You must agree to the terms of service.'))
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        fullName: fullName.trim(),
        role: 'startup',
        expectedStartupName: expectedStartupName.trim() || undefined,
        agreeTerms,
      })
      const payload = response.data?.data ?? response.data
      const user = payload?.user
      const accessToken = payload?.accessToken
      const refreshToken = payload?.refreshToken
      if (user && accessToken) {
        setAuth(user, accessToken, refreshToken || '')
        // Prefer pending until admin approves (unless API returns active)
        const st = String(user.status || 'pending').toLowerCase()
        if (st === 'active') {
          toast.success(
            tx(
              'Đăng ký thành công! Tiếp theo hãy hoàn thiện hồ sơ.',
              'Registered! Next, complete your profile.',
            ),
          )
          window.location.href = '/setup'
          return
        }
        if (st === 'rejected') {
          setError(
            tx(
              'Tài khoản đã bị từ chối. Liên hệ admin NIC.',
              'Account was rejected. Contact a NIC admin.',
            ),
          )
          return
        }
        toast.success(
          tx(
            'Đăng ký thành công — chờ admin duyệt tài khoản.',
            'Registered — waiting for admin approval.',
          ),
        )
        window.location.href = '/pending'
        return
      }
      setError(tx('Phản hồi đăng ký không hợp lệ.', 'Invalid registration response.'))
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: { details?: string }; message?: string } }
      }
      setError(
        ax?.response?.data?.error?.details ||
          ax?.response?.data?.message ||
          tx('Không đăng ký được. Email có thể đã tồn tại.', 'Could not register. This email may already exist.'),
      )
    } finally {
      setLoading(false)
    }
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
              Startup account
            </Badge>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
              {tx('Tạo tài khoản — từ deck đến đúng cuộc họp.', 'Create an account — from deck to the right meeting.')}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {tx('Chuẩn hóa hồ sơ, match có bằng chứng, soạn intro và đặt lịch. AI gợi ý, bạn duyệt.', 'Standardized profiles, evidence-bound matches, drafted intros and scheduling. AI suggests, you approve.')}
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <RocketIcon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{tx('Hồ sơ + extract deck', 'Profile + deck extraction')}</p>
                <p className="text-xs text-muted-foreground">
                  {tx('Upload pitch deck, duyệt field AI, xác nhận hồ sơ.', 'Upload your pitch deck, review AI fields, confirm your profile.')}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2Icon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Match & connect</p>
                <p className="text-xs text-muted-foreground">
                  {tx('Shortlist partner, lý do fit, gửi intro có kiểm soát.', 'Partner shortlist, fit reasoning, controlled intros.')}
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheckIcon className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{tx('Dữ liệu của bạn', 'Your data')}</p>
                <p className="text-xs text-muted-foreground">
                  {tx('Tài khoản startup riêng, tách khỏi intake workspace.', 'A separate startup account, isolated from the intake workspace.')}
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
                {tx('Đăng ký startup', 'Register your startup')}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {tx('Tạo tài khoản founder — sau đó thiết lập hồ sơ và chạy match.', 'Create a founder account — then set up your profile and run matching.')}
              </p>
            </div>

            <div className="grid gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-full"
                disabled={googlePending || loading}
                onClick={onGoogle}
              >
                {googlePending ? (
                  <Spinner className="size-4" />
                ) : (
                  <>
                    <GoogleIcon className="size-4" />
                    {tx('Đăng ký với Google', 'Sign up with Google')}
                  </>
                )}
              </Button>

              <div className="relative py-1 text-center text-xs text-muted-foreground">
                <span className="relative z-10 bg-background px-2">
                  {tx('hoặc email', 'or with email')}
                </span>
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              </div>

            <form className="grid gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="fullName">{tx('Họ và tên người đại diện *', 'Representative full name *')}</Label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    required
                    className="pl-9"
                    placeholder="Nguyễn Văn A"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">{tx('Email công việc *', 'Work email *')}</Label>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    className="pl-9"
                    placeholder="contact@startup.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="startup">{tx('Tên startup (tuỳ chọn)', 'Startup name (optional)')}</Label>
                <div className="relative">
                  <Building2Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="startup"
                    className="pl-9"
                    placeholder="AquaSense AI"
                    value={expectedStartupName}
                    onChange={(e) => setExpectedStartupName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="password">{tx('Mật khẩu *', 'Password *')}</Label>
                  <div className="relative">
                    <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      required
                      className="pl-9"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm">{tx('Xác nhận *', 'Confirm *')}</Label>
                  <div className="relative">
                    <LockIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm"
                      type="password"
                      required
                      className="pl-9"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                <Checkbox
                  checked={agreeTerms}
                  onCheckedChange={(v) => setAgreeTerms(v === true)}
                  className="mt-0.5"
                />
                <span>
                  {tx('Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của Nexora Flow.', 'I agree to the Nexora Flow terms of use and privacy policy.')}
                </span>
              </label>

              <Button
                type="submit"
                className="btn-glow mt-1 w-full rounded-full"
                disabled={loading || googlePending}
              >
                {loading ? (
                  <Spinner className="size-4" />
                ) : (
                  <>
                    {tx('Đăng ký & thiết lập hồ sơ', 'Register & set up profile')}
                    <ArrowRightIcon className="size-4" />
                  </>
                )}
              </Button>
            </form>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {tx('Đã có tài khoản?', 'Already have an account?')}{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                {tx('Đăng nhập', 'Sign in')}
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
