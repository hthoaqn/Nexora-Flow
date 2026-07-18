'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CheckIcon,
  Loader2Icon,
  LogOutIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  Building2Icon,
  RocketIcon,
  XIcon,
  AlertTriangleIcon,
  LayoutDashboardIcon,
  UsersIcon,
  ActivityIcon,
  ExternalLinkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MailIcon,
  ClockIcon,
  FileTextIcon,
  NetworkIcon,
  InfoIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/Logo'
import { ThemeToggle, LangToggle } from '@/components/Controls'
import { useTx } from '@/lib/tx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  adminLogin,
  adminMe,
  approveUser,
  rejectUser,
  listAdminUsers,
  getAdminStats,
  normalizeUserList,
  normalizeStats,
  roleBucket,
  formatWhen,
  relativeWhen,
  type AdminUser,
  type AdminStats,
} from '@/lib/admin-api'
import {
  clearAdminSession,
  getAdminSession,
  isAdminRole,
  setAdminSession,
  type AdminSession,
} from '@/lib/admin-session'
import { ApiError } from '@/lib/api/client'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { PageShell, Section, Toolbar } from '@/components/dashboard/Section'
import { StatCard, StatGrid } from '@/components/dashboard/StatCard'
import { FitRadarChart } from '@/components/charts/FitRadarChart'
import { PipelineBarChart } from '@/components/charts/PipelineBarChart'
import { cn } from '@/lib/utils'

type FilterStatus = 'pending' | 'active' | 'rejected' | 'all'
type FilterRole = 'all' | 'startup' | 'intake' | 'admin'
type MainTab = 'overview' | 'accounts' | 'activity'

const PAGE_SIZE = 25

export default function AdminPage() {
  const { tx, lang } = useTx()
  const loc = lang === 'en' ? 'en' : 'vi'

  const [session, setSession] = useState<AdminSession | null>(null)
  const [ready, setReady] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginPending, setLoginPending] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const [tab, setTab] = useState<MainTab>('overview')
  const [status, setStatus] = useState<FilterStatus>('pending')
  const [roleFilter, setRoleFilter] = useState<FilterRole>('all')
  const [q, setQ] = useState('')
  const [appliedQ, setAppliedQ] = useState('')
  const [page, setPage] = useState(1)

  const [items, setItems] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [snapshot, setSnapshot] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [apiMissing, setApiMissing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)

  const [detail, setDetail] = useState<AdminUser | null>(null)
  const [rejectTarget, setRejectTarget] = useState<AdminUser | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [approveTarget, setApproveTarget] = useState<AdminUser | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false)

  const loadInFlight = useRef(false)
  const lastLoadAt = useRef(0)
  const snapshotLoaded = useRef(false)
  const tokenRef = useRef<string | null>(null)
  tokenRef.current = session?.accessToken ?? null

  useEffect(() => {
    let cancelled = false
    const s = getAdminSession()
    if (!s?.accessToken || !isAdminRole(s.user.role)) {
      setReady(true)
      return
    }
    setSession(s)
    setReady(true)

    void adminMe(s.accessToken)
      .then((me) => {
        if (cancelled) return
        const user = (me as { user?: AdminUser }).user || (me as AdminUser)
        if (!isAdminRole(user.role) || String(user.status || 'active') === 'pending') {
          clearAdminSession()
          setSession(null)
          return
        }
        const next: AdminSession = {
          accessToken: s.accessToken,
          refreshToken: s.refreshToken,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName || user.displayName,
            role: user.role,
            status: user.status,
          },
        }
        setAdminSession(next)
        setSession((prev) => {
          if (
            prev?.user.id === next.user.id &&
            prev?.accessToken === next.accessToken &&
            prev?.user.role === next.user.role
          ) {
            return prev
          }
          return next
        })
      })
      .catch((e) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 401) {
          clearAdminSession()
          setSession(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const loadSnapshot = useCallback(async (token: string) => {
    if (snapshotLoaded.current) return
    try {
      const res = await listAdminUsers(token, { limit: 100, page: 1 })
      const { items: rows } = normalizeUserList(res as any)
      setSnapshot(rows)
      snapshotLoaded.current = true
    } catch {
      /* optional analytics — ignore */
    }
  }, [])

  const load = useCallback(
    async (opts?: {
      status?: FilterStatus
      role?: FilterRole
      q?: string
      page?: number
      force?: boolean
    }) => {
      const token = tokenRef.current
      if (!token) return
      if (loadInFlight.current) return

      const now = Date.now()
      if (!opts?.force && now - lastLoadAt.current < 800) return

      const st = opts?.status ?? status
      const rf = opts?.role ?? roleFilter
      const query = (opts?.q ?? appliedQ).trim()
      const pg = opts?.page ?? page

      // Map UI role filter → API role param when possible
      let roleParam: string | undefined
      if (rf === 'startup') roleParam = 'startup'
      else if (rf === 'admin') roleParam = 'admin'
      else if (rf === 'intake') roleParam = 'owner' // primary intake role; client also keeps owner/reviewer

      loadInFlight.current = true
      lastLoadAt.current = now
      setLoading(true)
      setLoadError(null)
      setApiMissing(false)

      try {
        const [listRes, statsRes] = await Promise.all([
          listAdminUsers(token, {
            status: st === 'all' ? undefined : st,
            role: roleParam,
            q: query || undefined,
            page: pg,
            limit: PAGE_SIZE,
          }),
          getAdminStats(token).catch(() => null),
        ])
        let { items: rows, total: n } = normalizeUserList(listRes as any)

        // Client-side intake filter refinement (owner/reviewer/admin_org)
        if (rf === 'intake') {
          rows = rows.filter((u) => roleBucket(u.role) === 'intake')
        }

        setItems(rows)
        setTotal(n)
        setSelected([])
        if (statsRes) setStats(normalizeStats(statsRes))
        setRateLimited(false)
        void loadSnapshot(token)
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 501)) {
          setApiMissing(true)
          setItems([])
          setTotal(0)
        } else if (e instanceof ApiError && e.status === 401) {
          clearAdminSession()
          setSession(null)
          toast.error(tx('Phiên admin hết hạn', 'Admin session expired'))
        } else if (e instanceof ApiError && e.status === 403) {
          setLoadError(tx('Không có quyền admin NIC', 'Not a NIC platform admin'))
        } else if (e instanceof ApiError && e.status === 429) {
          setRateLimited(true)
          setLoadError(
            tx(
              'Rate limit — đợi vài giây rồi bấm Làm mới.',
              'Rate limited — wait then click Refresh.',
            ),
          )
        } else {
          setLoadError(e instanceof Error ? e.message : tx('Lỗi tải', 'Load error'))
        }
      } finally {
        loadInFlight.current = false
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, roleFilter, appliedQ, page, loadSnapshot],
  )

  const sessionToken = session?.accessToken ?? null
  useEffect(() => {
    if (!sessionToken || rateLimited) return
    void load({ force: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, status, roleFilter, appliedQ, page])

  // ── Derived insights (from snapshot + current stats) ──────────
  const insights = useMemo(() => {
    const src = snapshot.length ? snapshot : items
    const byRole = { startup: 0, intake: 0, admin: 0, other: 0 }
    const byStatus = { pending: 0, active: 0, rejected: 0, suspended: 0, other: 0 }
    for (const u of src) {
      byRole[roleBucket(u.role)]++
      const s = String(u.status || '').toLowerCase()
      if (s in byStatus) (byStatus as any)[s]++
      else byStatus.other++
    }
    const pendingStartup = src.filter(
      (u) => roleBucket(u.role) === 'startup' && String(u.status).toLowerCase() === 'pending',
    ).length
    const pendingIntake = src.filter(
      (u) => roleBucket(u.role) === 'intake' && String(u.status).toLowerCase() === 'pending',
    ).length
    const recent = [...src]
      .sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime()
        const tb = new Date(b.createdAt || 0).getTime()
        return tb - ta
      })
      .slice(0, 8)
    const reviewed = [...src]
      .filter((u) => u.reviewedAt)
      .sort((a, b) => {
        const ta = new Date(a.reviewedAt || 0).getTime()
        const tb = new Date(b.reviewedAt || 0).getTime()
        return tb - ta
      })
      .slice(0, 8)
    const orgs = new Map<string, number>()
    for (const u of src) {
      const key =
        u.organizationName ||
        u.organizationId ||
        (roleBucket(u.role) === 'startup' ? u.expectedStartupName : null)
      if (key) orgs.set(String(key), (orgs.get(String(key)) || 0) + 1)
    }
    const topOrgs = [...orgs.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)

    return {
      byRole,
      byStatus,
      pendingStartup,
      pendingIntake,
      recent,
      reviewed,
      topOrgs,
      sampleSize: src.length,
    }
  }, [snapshot, items])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // ── Auth ─────────────────────────────────────────────────────
  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)
    setLoginPending(true)
    try {
      const auth = await adminLogin(email, password)
      const role = auth.user?.role
      const st = String(auth.user?.status || 'active').toLowerCase()
      if (!isAdminRole(role)) {
        setLoginError(
          tx(
            'Tài khoản không phải admin platform NIC.',
            'This account is not a NIC platform admin.',
          ),
        )
        return
      }
      if (st === 'pending' || st === 'rejected') {
        setLoginError(
          tx('Tài khoản admin không hợp lệ (pending/rejected).', 'Invalid admin account status.'),
        )
        return
      }
      const next: AdminSession = {
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        user: {
          id: auth.user.id,
          email: auth.user.email,
          fullName: auth.user.fullName,
          role: auth.user.role,
          status: auth.user.status,
        },
      }
      setAdminSession(next)
      setRateLimited(false)
      snapshotLoaded.current = false
      setSession(next)
      toast.success(tx('Đăng nhập NIC Admin thành công', 'NIC Admin signed in'))
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setLoginError(
          tx('Rate limit — đợi 30–60s rồi thử lại.', 'Rate limited — wait 30–60s.'),
        )
      } else {
        setLoginError(
          err instanceof Error ? err.message : tx('Đăng nhập thất bại', 'Sign-in failed'),
        )
      }
    } finally {
      setLoginPending(false)
    }
  }

  const onApprove = async (u: AdminUser, note?: string) => {
    if (!session) return
    setActionId(u.id)
    try {
      await approveUser(session.accessToken, u.id, note)
      toast.success(tx(`Đã duyệt ${u.email}`, `Approved ${u.email}`))
      setApproveTarget(null)
      setApproveNote('')
      setDetail(null)
      snapshotLoaded.current = false
      void load({ force: true })
      void loadSnapshot(session.accessToken)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tx('Duyệt thất bại', 'Approve failed'))
    } finally {
      setActionId(null)
    }
  }

  const onReject = async () => {
    if (!session || !rejectTarget) return
    if (!rejectReason.trim()) {
      toast.error(tx('Nhập lý do từ chối', 'Enter a reject reason'))
      return
    }
    setActionId(rejectTarget.id)
    try {
      await rejectUser(session.accessToken, rejectTarget.id, rejectReason.trim())
      toast.success(
        tx(`Đã từ chối ${rejectTarget.email}`, `Rejected ${rejectTarget.email}`),
      )
      setRejectTarget(null)
      setRejectReason('')
      setDetail(null)
      snapshotLoaded.current = false
      void load({ force: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tx('Từ chối thất bại', 'Reject failed'))
    } finally {
      setActionId(null)
    }
  }

  const bulkApprove = async () => {
    if (!session || selected.length === 0) return
    setBulkBusy(true)
    let ok = 0
    let fail = 0
    for (const id of selected) {
      try {
        await approveUser(session.accessToken, id)
        ok++
      } catch {
        fail++
      }
    }
    setBulkBusy(false)
    setSelected([])
    snapshotLoaded.current = false
    toast.success(
      tx(
        `Duyệt xong: ${ok}${fail ? `, lỗi ${fail}` : ''}`,
        `Approved: ${ok}${fail ? `, failed ${fail}` : ''}`,
      ),
    )
    void load({ force: true })
  }

  const bulkReject = async () => {
    if (!session || selected.length === 0) return
    if (!rejectReason.trim()) {
      toast.error(tx('Nhập lý do từ chối', 'Enter a reject reason'))
      return
    }
    setBulkBusy(true)
    let ok = 0
    let fail = 0
    for (const id of selected) {
      try {
        await rejectUser(session.accessToken, id, rejectReason.trim())
        ok++
      } catch {
        fail++
      }
    }
    setBulkBusy(false)
    setSelected([])
    setBulkRejectOpen(false)
    setRejectReason('')
    snapshotLoaded.current = false
    toast.success(
      tx(
        `Từ chối xong: ${ok}${fail ? `, lỗi ${fail}` : ''}`,
        `Rejected: ${ok}${fail ? `, failed ${fail}` : ''}`,
      ),
    )
    void load({ force: true })
  }

  const roleBadge = (role: string) => {
    const b = roleBucket(role)
    if (b === 'startup')
      return (
        <Badge className="gap-1 bg-primary/15 text-primary">
          <RocketIcon className="size-3" />
          Startup
        </Badge>
      )
    if (b === 'admin')
      return (
        <Badge className="gap-1">
          <ShieldCheckIcon className="size-3" />
          Admin
        </Badge>
      )
    if (b === 'intake')
      return (
        <Badge variant="secondary" className="gap-1">
          <Building2Icon className="size-3" />
          Intake
        </Badge>
      )
    return <Badge variant="outline">{role || '—'}</Badge>
  }

  const statusBadge = (s?: string) => {
    const v = String(s || '').toLowerCase()
    if (v === 'pending')
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        >
          {tx('Chờ duyệt', 'Pending')}
        </Badge>
      )
    if (v === 'active')
      return (
        <Badge className="bg-primary/15 text-primary">{tx('Đã duyệt', 'Active')}</Badge>
      )
    if (v === 'rejected')
      return (
        <Badge
          variant="outline"
          className="border-rose-500/40 bg-rose-500/10 text-rose-700"
        >
          {tx('Từ chối', 'Rejected')}
        </Badge>
      )
    if (v === 'suspended')
      return (
        <Badge variant="outline" className="border-orange-500/40 bg-orange-500/10">
          {tx('Tạm khóa', 'Suspended')}
        </Badge>
      )
    return <Badge variant="outline">{s || '—'}</Badge>
  }

  const pendingCount = stats?.pending ?? insights.byStatus.pending
  const allIds = useMemo(() => items.map((u) => u.id), [items])
  const allSelected = allIds.length > 0 && selected.length === allIds.length
  const someSelected = selected.length > 0 && !allSelected

  // ── Login screen ─────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-6 text-primary" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="relative flex min-h-svh w-full bg-background">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 top-0 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -right-24 bottom-0 size-[24rem] rounded-full bg-primary/10 blur-3xl" />
        </div>
        <main className="relative z-10 mx-auto flex w-full max-w-md flex-col justify-center px-4 py-12">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2">
              <Logo size={28} />
            </Link>
            <div className="flex items-center gap-2">
              <LangToggle />
              <ThemeToggle />
            </div>
          </div>
          <div className="portal-hero p-6 sm:p-8">
            <div className="portal-chip mb-3 w-fit">
              <ShieldCheckIcon className="size-3" />
              NIC · Platform Admin
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {tx('Trung tâm điều hành NIC', 'NIC Control Center')}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {tx(
                'Quản trị toàn nền tảng: duyệt tài khoản Startup & Intake, giám sát queue, điều phối deal-flow.',
                'Platform ops: approve Startup & Intake accounts, monitor queues, steer deal-flow.',
              )}
            </p>
            <form className="mt-6 grid gap-4" onSubmit={onLogin}>
              {loginError ? (
                <Alert variant="destructive">
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@nexora-flow.cloud"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-pass">{tx('Mật khẩu', 'Password')}</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="btn-glow w-full rounded-full"
                disabled={loginPending}
              >
                {loginPending ? (
                  <Spinner className="size-4" />
                ) : (
                  tx('Vào NIC Admin', 'Enter NIC Admin')
                )}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">
                {tx('← Startup / Intake sign-in', '← Startup / Intake sign-in')}
              </Link>
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ── Dashboard — full admin shell with sidebar ────────────────
  const adminNav = [
    {
      id: 'overview' as MainTab,
      label: tx('Tổng quan', 'Overview'),
      icon: LayoutDashboardIcon,
    },
    {
      id: 'accounts' as MainTab,
      label: tx('Tài khoản', 'Accounts'),
      icon: UsersIcon,
    },
    {
      id: 'activity' as MainTab,
      label: tx('Hoạt động', 'Activity'),
      icon: ActivityIcon,
    },
  ]

  return (
    <div className="flex min-h-svh bg-background">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-border/70 bg-muted/20 md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border/60 px-4">
          <Logo size={28} showWordmark={false} />
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold">NIC Admin</p>
            <p className="truncate text-[10px] text-muted-foreground">Control center</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          <p className="mb-1 px-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {tx('Quản trị', 'Manage')}
          </p>
          {adminNav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                tab === item.id
                  ? 'bg-primary/15 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
              {item.id === 'accounts' && pendingCount > 0 ? (
                <Badge className="ml-auto h-5 min-w-5 justify-center px-1.5 text-[10px]">
                  {pendingCount}
                </Badge>
              ) : null}
            </button>
          ))}
          <p className="mb-1 mt-4 px-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {tx('Nền tảng', 'Platform')}
          </p>
          {[
            { href: '/matching', label: tx('Matching giao thoa', 'Cross matching'), icon: NetworkIcon },
            { href: '/programs', label: tx('Chương trình Intake', 'Intake programs'), icon: FileTextIcon },
            { href: '/settings/organization', label: tx('Tổ chức / NEEDS_REVIEW', 'Org / NEEDS_REVIEW'), icon: Building2Icon },
            { href: '/dashboard', label: tx('Startup portal', 'Startup portal'), icon: RocketIcon },
            { href: '/pending', label: tx('Màn chờ user', 'User pending'), icon: ClockIcon },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              <ExternalLinkIcon className="ml-auto size-3 opacity-50" />
            </Link>
          ))}
        </nav>
        <div className="border-t border-border/60 p-3">
          <div className="mb-2 truncate px-2 text-xs">
            <p className="font-medium">{session.user.fullName || 'Admin'}</p>
            <p className="text-muted-foreground">{session.user.email}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full rounded-full"
            onClick={() => {
              clearAdminSession()
              setSession(null)
              setItems([])
              setStats(null)
              setSnapshot([])
              snapshotLoaded.current = false
            }}
          >
            <LogOutIcon data-icon="inline-start" />
            {tx('Đăng xuất', 'Sign out')}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="inline-flex shrink-0 items-center gap-2 md:hidden">
            <Logo size={28} showWordmark={false} />
          </Link>
          <Badge variant="secondary" className="gap-1">
            <ShieldCheckIcon className="size-3" />
            NIC Admin
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">
              {session.user.fullName || session.user.email}
              <span className="mx-1.5 text-border">·</span>
              <span className="text-foreground/80">{session.user.role}</span>
            </p>
          </div>
          {/* Mobile tab switcher */}
          <div className="flex gap-1 md:hidden">
            {adminNav.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={tab === item.id ? 'default' : 'outline'}
                className="rounded-full px-2"
                onClick={() => setTab(item.id)}
              >
                <item.icon className="size-3.5" />
              </Button>
            ))}
          </div>
          <LangToggle />
          <ThemeToggle />
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={loading}
            onClick={() => {
              setRateLimited(false)
              snapshotLoaded.current = false
              void load({ force: true })
              if (session.accessToken) void loadSnapshot(session.accessToken)
            }}
          >
            {loading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            <span className="hidden sm:inline">{tx('Làm mới', 'Refresh')}</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <PageShell>
          <PageHeader
            title={tx('Trung tâm điều hành NIC', 'NIC Control Center')}
            description={tx(
              'Quản lý toàn bộ vòng đời tài khoản trên Nexora Flow: Startup founders, Intake workspaces (owner/reviewer), và hàng đợi phê duyệt. AI gợi ý — NIC quyết định ai được vào hệ thống.',
              'Manage the full account lifecycle on Nexora Flow: Startup founders, Intake workspaces (owner/reviewer), and the approval queue. AI suggests — NIC decides who enters the system.',
            )}
            meta={
              <>
                <Badge variant="secondary" className="gap-1">
                  <NetworkIcon className="size-3" />
                  Platform-wide
                </Badge>
                <Badge variant="outline">
                  {total} {tx('trong bộ lọc', 'in filter')}
                </Badge>
                {pendingCount > 0 ? (
                  <Badge className="gap-1">
                    <AlertTriangleIcon className="size-3" />
                    {pendingCount} {tx('chờ duyệt', 'pending')}
                  </Badge>
                ) : null}
              </>
            }
          />

          {apiMissing ? (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangleIcon className="size-4 text-amber-600" />
              <AlertTitle>
                {tx('API admin chưa sẵn sàng', 'Admin API not ready')}
              </AlertTitle>
              <AlertDescription className="text-xs">
                GET /api/admin/stats · GET /api/admin/users · POST …/approve|reject
              </AlertDescription>
            </Alert>
          ) : null}

          {loadError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>{loadError}</span>
                {rateLimited ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      setRateLimited(false)
                      setLoadError(null)
                      void load({ force: true })
                    }}
                  >
                    {tx('Thử lại', 'Retry')}
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs
            value={tab}
            onValueChange={(v) => setTab((v as MainTab) || 'overview')}
            className="w-full"
          >
            <TabsList className="mb-4 grid h-auto w-full grid-cols-3 gap-1 rounded-xl p-1 sm:w-auto sm:inline-grid">
              <TabsTrigger value="overview" className="gap-1.5 rounded-lg py-2 text-xs sm:text-sm">
                <LayoutDashboardIcon className="size-3.5" />
                {tx('Tổng quan', 'Overview')}
              </TabsTrigger>
              <TabsTrigger value="accounts" className="gap-1.5 rounded-lg py-2 text-xs sm:text-sm">
                <UsersIcon className="size-3.5" />
                {tx('Tài khoản', 'Accounts')}
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5 rounded-lg py-2 text-xs sm:text-sm">
                <ActivityIcon className="size-3.5" />
                {tx('Hoạt động', 'Activity')}
              </TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW ───────────────────────────────────── */}
            <TabsContent value="overview" className="outline-none">
              <div className="flex flex-col gap-4">
                <StatGrid className="lg:grid-cols-4">
                  <StatCard
                    label={tx('Chờ duyệt', 'Pending')}
                    value={stats?.pending ?? insights.byStatus.pending}
                    hint={tx('Cần NIC xác nhận', 'Needs NIC confirmation')}
                    icon={AlertTriangleIcon}
                  />
                  <StatCard
                    label={tx('Đang hoạt động', 'Active')}
                    value={stats?.active ?? insights.byStatus.active}
                    hint={tx('Được vào portal', 'Can access portal')}
                    icon={CheckIcon}
                  />
                  <StatCard
                    label={tx('Từ chối', 'Rejected')}
                    value={stats?.rejected ?? insights.byStatus.rejected}
                    hint={tx('Không được vào', 'Blocked')}
                    icon={XIcon}
                  />
                  <StatCard
                    label={tx('Tổng (mẫu)', 'Total (sample)')}
                    value={
                      stats?.total ??
                      (stats
                        ? (stats.pending || 0) + (stats.active || 0) + (stats.rejected || 0)
                        : insights.sampleSize)
                    }
                    hint={
                      insights.sampleSize
                        ? tx(
                            `Snapshot ${insights.sampleSize} user gần nhất`,
                            `Snapshot of last ${insights.sampleSize} users`,
                          )
                        : 'platform'
                    }
                    icon={UsersIcon}
                  />
                </StatGrid>

                <StatGrid className="lg:grid-cols-4">
                  <StatCard
                    label={tx('Startup chờ', 'Startup pending')}
                    value={stats?.startupPending ?? insights.pendingStartup}
                    icon={RocketIcon}
                  />
                  <StatCard
                    label={tx('Intake chờ', 'Intake pending')}
                    value={stats?.intakePending ?? insights.pendingIntake}
                    icon={Building2Icon}
                  />
                  <StatCard
                    label={tx('Startup (mẫu)', 'Startups (sample)')}
                    value={stats?.startupTotal ?? insights.byRole.startup}
                    icon={RocketIcon}
                  />
                  <StatCard
                    label={tx('Intake (mẫu)', 'Intake (sample)')}
                    value={stats?.intakeTotal ?? insights.byRole.intake}
                    icon={Building2Icon}
                  />
                </StatGrid>

                <div className="grid gap-4 lg:grid-cols-2">
                  <PipelineBarChart
                    title={tx('Trạng thái tài khoản', 'Account status')}
                    description={tx('Theo stats + snapshot', 'From stats + snapshot')}
                    data={[
                      {
                        name: tx('Chờ', 'Pending'),
                        value: stats?.pending ?? insights.byStatus.pending,
                      },
                      {
                        name: tx('Active', 'Active'),
                        value: stats?.active ?? insights.byStatus.active,
                      },
                      {
                        name: tx('Từ chối', 'Rejected'),
                        value: stats?.rejected ?? insights.byStatus.rejected,
                      },
                      {
                        name: 'Startup',
                        value: insights.byRole.startup,
                      },
                      {
                        name: 'Intake',
                        value: insights.byRole.intake,
                      },
                    ]}
                  />
                  <FitRadarChart
                    title={tx('Sức khỏe platform', 'Platform health')}
                    description={tx('Tín hiệu vận hành (0–100)', 'Ops signals (0–100)')}
                    data={[
                      {
                        dim: 'PendingQ',
                        score: Math.max(
                          0,
                          100 - (stats?.pending ?? insights.byStatus.pending) * 8,
                        ),
                        baseline: 70,
                      },
                      {
                        dim: 'Active',
                        score: Math.min(
                          100,
                          (stats?.active ?? insights.byStatus.active) * 3,
                        ),
                        baseline: 50,
                      },
                      {
                        dim: 'Startup',
                        score: Math.min(100, insights.byRole.startup * 5),
                        baseline: 40,
                      },
                      {
                        dim: 'Intake',
                        score: Math.min(100, insights.byRole.intake * 8),
                        baseline: 40,
                      },
                      {
                        dim: 'Reviewed',
                        score: Math.min(100, insights.reviewed.length * 12),
                        baseline: 45,
                      },
                      {
                        dim: 'Coverage',
                        score: Math.min(100, insights.sampleSize * 2),
                        baseline: 50,
                      },
                    ]}
                    showBaseline
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <Section
                    title={tx('Phạm vi NIC Admin', 'NIC Admin scope')}
                    description={tx(
                      'Bạn điều khiển ai được vào hệ thống',
                      'You control who enters the system',
                    )}
                    className="lg:col-span-1"
                  >
                    <ul className="flex flex-col gap-3 text-sm">
                      <li className="flex gap-2.5">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <RocketIcon className="size-4" />
                        </span>
                        <div>
                          <p className="font-medium">Startup</p>
                          <p className="text-xs text-muted-foreground">
                            {tx(
                              'Founder đăng ký / Google SSO → pending → duyệt mới vào /dashboard, match, sandbox.',
                              'Founder register / Google SSO → pending → approve to unlock dashboard, match, sandbox.',
                            )}
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2Icon className="size-4" />
                        </span>
                        <div>
                          <p className="font-medium">Intake workspace</p>
                          <p className="text-xs text-muted-foreground">
                            {tx(
                              'Owner / reviewer — quản lý chương trình, upload deck, chấm điểm, quyết định shortlist.',
                              'Owner / reviewer — programs, deck upload, scoring, shortlist decisions.',
                            )}
                          </p>
                        </div>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileTextIcon className="size-4" />
                        </span>
                        <div>
                          <p className="font-medium">
                            {tx('Hồ sơ nộp (applications)', 'Submitted applications')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tx(
                              'Duyệt NEEDS_REVIEW tại Tổ chức / chi tiết hồ sơ — không phải trang này.',
                              'Moderate NEEDS_REVIEW in Organization / application detail — not this page.',
                            )}
                          </p>
                        </div>
                      </li>
                    </ul>
                  </Section>

                  <Section
                    title={tx('Phân bổ vai trò (snapshot)', 'Role mix (snapshot)')}
                    description={tx(
                      `Từ ${insights.sampleSize} user gần nhất`,
                      `From last ${insights.sampleSize} users`,
                    )}
                    className="lg:col-span-1"
                  >
                    <div className="flex flex-col gap-2.5">
                      {(
                        [
                          ['startup', insights.byRole.startup, RocketIcon],
                          ['intake', insights.byRole.intake, Building2Icon],
                          ['admin', insights.byRole.admin, ShieldCheckIcon],
                          ['other', insights.byRole.other, UserRoundIcon],
                        ] as const
                      ).map(([key, count, Icon]) => {
                        const max = Math.max(
                          1,
                          insights.byRole.startup,
                          insights.byRole.intake,
                          insights.byRole.admin,
                          insights.byRole.other,
                        )
                        return (
                          <div key={key} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="inline-flex items-center gap-1.5 font-medium capitalize">
                                <Icon className="size-3.5 text-muted-foreground" />
                                {key}
                              </span>
                              <span className="tabular-nums text-muted-foreground">{count}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary/80 transition-all"
                                style={{ width: `${(count / max) * 100}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Section>

                  <Section
                    title={tx('Lối tắt vận hành', 'Ops shortcuts')}
                    description={tx('Điều hướng nhanh', 'Jump into workflows')}
                    className="lg:col-span-1"
                  >
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        className="justify-between rounded-xl"
                        onClick={() => {
                          setStatus('pending')
                          setRoleFilter('all')
                          setPage(1)
                          setTab('accounts')
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <AlertTriangleIcon className="size-4 text-amber-600" />
                          {tx('Hàng đợi chờ duyệt', 'Pending queue')}
                        </span>
                        <Badge variant="secondary">{pendingCount}</Badge>
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-between rounded-xl"
                        onClick={() => {
                          setStatus('pending')
                          setRoleFilter('startup')
                          setPage(1)
                          setTab('accounts')
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <RocketIcon className="size-4 text-primary" />
                          {tx('Startup chờ', 'Startup pending')}
                        </span>
                        <ChevronRightIcon className="size-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-between rounded-xl"
                        onClick={() => {
                          setStatus('pending')
                          setRoleFilter('intake')
                          setPage(1)
                          setTab('accounts')
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Building2Icon className="size-4" />
                          {tx('Intake chờ', 'Intake pending')}
                        </span>
                        <ChevronRightIcon className="size-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-between rounded-xl"
                        render={<Link href="/programs" />}
                        nativeButton={false}
                      >
                        <span className="inline-flex items-center gap-2">
                          <FileTextIcon className="size-4" />
                          {tx('Chương trình Intake', 'Intake programs')}
                        </span>
                        <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-between rounded-xl"
                        render={<Link href="/settings/organization" />}
                        nativeButton={false}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Building2Icon className="size-4" />
                          {tx('Duyệt hồ sơ NEEDS_REVIEW', 'Review applications')}
                        </span>
                        <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-between rounded-xl"
                        render={<Link href="/pending" />}
                        nativeButton={false}
                      >
                        <span className="inline-flex items-center gap-2">
                          <ClockIcon className="size-4" />
                          {tx('Màn chờ user (/pending)', 'User pending screen')}
                        </span>
                        <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </Section>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Section
                    title={tx('Đăng ký gần đây', 'Recent sign-ups')}
                    description={tx('User mới nhất trong snapshot', 'Newest users in snapshot')}
                    action={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() => setTab('accounts')}
                      >
                        {tx('Xem tất cả', 'View all')}
                      </Button>
                    }
                  >
                    {insights.recent.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {tx('Chưa có dữ liệu.', 'No data yet.')}
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {insights.recent.map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              className="flex w-full items-start gap-3 rounded-xl border bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                              onClick={() => {
                                setDetail(u)
                                setTab('accounts')
                              }}
                            >
                              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background">
                                <UserRoundIcon className="size-4 text-muted-foreground" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <p className="truncate text-sm font-medium">
                                    {u.fullName || u.displayName || u.email}
                                  </p>
                                  {roleBadge(u.role)}
                                  {statusBadge(u.status)}
                                </div>
                                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {relativeWhen(u.createdAt, loc)}
                                  {u.expectedStartupName || u.organizationName
                                    ? ` · ${u.expectedStartupName || u.organizationName}`
                                    : ''}
                                </p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>

                  <Section
                    title={tx('Org / startup nổi bật', 'Top orgs / startups')}
                    description={tx(
                      'Gom theo organizationName / expectedStartupName',
                      'Grouped by organizationName / expectedStartupName',
                    )}
                  >
                    {insights.topOrgs.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {tx(
                          'Chưa có org/startup name trên user.',
                          'No org/startup names on users yet.',
                        )}
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {insights.topOrgs.map(([name, count]) => (
                          <li
                            key={name}
                            className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-2.5"
                          >
                            <span className="inline-flex min-w-0 items-center gap-2">
                              <Building2Icon className="size-4 shrink-0 text-muted-foreground" />
                              <span className="truncate text-sm font-medium">{name}</span>
                            </span>
                            <Badge variant="secondary" className="tabular-nums">
                              {count}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                </div>

                <Alert>
                  <InfoIcon className="size-4" />
                  <AlertTitle>
                    {tx('Hai lớp duyệt khác nhau', 'Two different approval layers')}
                  </AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed">
                    <strong>1. Tài khoản (trang này)</strong> — user.pending → active.{' '}
                    <strong>2. Hồ sơ nộp</strong> — application NEEDS_REVIEW tại{' '}
                    <Link href="/settings/organization" className="text-primary underline">
                      /settings/organization
                    </Link>{' '}
                    hoặc chi tiết application. Cả hai đều thuộc vòng kiểm soát NIC.
                  </AlertDescription>
                </Alert>
              </div>
            </TabsContent>

            {/* ── ACCOUNTS ───────────────────────────────────── */}
            <TabsContent value="accounts" className="outline-none">
              <Section
                title={tx('Danh sách tài khoản nền tảng', 'Platform accounts')}
                description={tx(
                  'Email · vai trò · trạng thái · org/startup · thời điểm · lịch sử duyệt',
                  'Email · role · status · org/startup · timestamps · review history',
                )}
                action={
                  <Badge variant="outline">
                    {total} {tx('kết quả', 'results')}
                  </Badge>
                }
              >
                <Toolbar className="mb-3 flex-col items-stretch gap-2 border-0 bg-muted/30 p-2 shadow-none sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1">
                    <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-9 pl-9"
                      placeholder={tx(
                        'Email, tên, startup, org…',
                        'Email, name, startup, org…',
                      )}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setPage(1)
                          setAppliedQ(q.trim())
                        }
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => {
                      setPage(1)
                      setAppliedQ(q.trim())
                    }}
                  >
                    {tx('Tìm', 'Search')}
                  </Button>
                  <Select
                    value={roleFilter}
                    onValueChange={(v) => {
                      setPage(1)
                      setRoleFilter((v as FilterRole) || 'all')
                    }}
                  >
                    <SelectTrigger size="sm" className="w-full sm:w-[140px]">
                      <SelectValue placeholder={tx('Vai trò', 'Role')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">{tx('Mọi vai trò', 'All roles')}</SelectItem>
                        <SelectItem value="startup">Startup</SelectItem>
                        <SelectItem value="intake">Intake</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-1.5">
                    {(['pending', 'active', 'rejected', 'all'] as FilterStatus[]).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={status === s ? 'default' : 'outline'}
                        className="rounded-full"
                        onClick={() => {
                          setPage(1)
                          setRateLimited(false)
                          setStatus(s)
                        }}
                      >
                        {s === 'pending'
                          ? tx('Chờ', 'Pending')
                          : s === 'active'
                            ? tx('Active', 'Active')
                            : s === 'rejected'
                              ? tx('Từ chối', 'Rejected')
                              : tx('All', 'All')}
                      </Button>
                    ))}
                  </div>
                </Toolbar>

                {selected.length > 0 ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2.5">
                    <Badge variant="secondary">
                      {selected.length} {tx('đã chọn', 'selected')}
                    </Badge>
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={bulkBusy || rateLimited}
                      onClick={() => void bulkApprove()}
                    >
                      {bulkBusy ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <CheckIcon data-icon="inline-start" />
                      )}
                      {tx('Duyệt đã chọn', 'Approve selected')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={bulkBusy || rateLimited}
                      onClick={() => {
                        setRejectReason('')
                        setBulkRejectOpen(true)
                      }}
                    >
                      <XIcon data-icon="inline-start" />
                      {tx('Từ chối đã chọn', 'Reject selected')}
                    </Button>
                  </div>
                ) : null}

                <div className="overflow-x-auto rounded-xl border border-border/70">
                  {loading && items.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                      <Loader2Icon className="size-4 animate-spin" />
                      {tx('Đang tải…', 'Loading…')}
                    </div>
                  ) : items.length === 0 ? (
                    <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                      {tx(
                        'Không có tài khoản trong bộ lọc này.',
                        'No accounts in this filter.',
                      )}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10 pl-3">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={(v) =>
                                setSelected(v === true ? [...allIds] : [])
                              }
                              aria-label={tx('Chọn tất cả', 'Select all')}
                              className={someSelected ? 'opacity-70' : undefined}
                            />
                          </TableHead>
                          <TableHead>{tx('Tài khoản', 'Account')}</TableHead>
                          <TableHead>{tx('Vai trò', 'Role')}</TableHead>
                          <TableHead>{tx('Trạng thái', 'Status')}</TableHead>
                          <TableHead className="hidden lg:table-cell">
                            {tx('Org / Startup', 'Org / Startup')}
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            {tx('Đăng ký', 'Signed up')}
                          </TableHead>
                          <TableHead className="hidden xl:table-cell">
                            {tx('Duyệt lúc', 'Reviewed')}
                          </TableHead>
                          <TableHead className="pr-4 text-right">
                            {tx('Thao tác', 'Actions')}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((u) => {
                          const checked = selected.includes(u.id)
                          return (
                            <TableRow
                              key={u.id}
                              data-state={checked ? 'selected' : undefined}
                              className="cursor-pointer"
                              onClick={() => setDetail(u)}
                            >
                              <TableCell
                                className="pl-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) =>
                                    setSelected((prev) =>
                                      v === true
                                        ? Array.from(new Set([...prev, u.id]))
                                        : prev.filter((x) => x !== u.id),
                                    )
                                  }
                                  aria-label={u.email}
                                />
                              </TableCell>
                              <TableCell className="max-w-[220px] whitespace-normal">
                                <div className="flex items-start gap-2">
                                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                    <UserRoundIcon className="size-4 text-muted-foreground" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">
                                      {u.fullName || u.displayName || '—'}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {u.email}
                                    </p>
                                    <p className="truncate font-mono text-[10px] text-muted-foreground/70">
                                      {u.id.slice(0, 8)}…
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{roleBadge(u.role)}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {statusBadge(u.status)}
                                  {u.rejectReason ? (
                                    <span className="max-w-[120px] truncate text-[10px] text-rose-600">
                                      {u.rejectReason}
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="hidden max-w-[140px] truncate text-xs text-muted-foreground lg:table-cell">
                                {u.expectedStartupName ||
                                  u.organizationName ||
                                  u.organizationId ||
                                  '—'}
                              </TableCell>
                              <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                                <div className="flex flex-col">
                                  <span>{relativeWhen(u.createdAt, loc)}</span>
                                  <span className="text-[10px] opacity-70">
                                    {formatWhen(u.createdAt, loc === 'vi' ? 'vi-VN' : 'en-US')}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                                {u.reviewedAt ? relativeWhen(u.reviewedAt, loc) : '—'}
                              </TableCell>
                              <TableCell
                                className="pr-4 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {String(u.status).toLowerCase() === 'pending' ? (
                                  <div className="flex justify-end gap-1.5">
                                    <Button
                                      size="sm"
                                      className="rounded-full"
                                      disabled={
                                        actionId === u.id || bulkBusy || rateLimited
                                      }
                                      onClick={() => setApproveTarget(u)}
                                    >
                                      {actionId === u.id ? (
                                        <Spinner data-icon="inline-start" />
                                      ) : (
                                        <CheckIcon data-icon="inline-start" />
                                      )}
                                      {tx('Duyệt', 'Approve')}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-full"
                                      disabled={
                                        actionId === u.id || bulkBusy || rateLimited
                                      }
                                      onClick={() => {
                                        setRejectTarget(u)
                                        setRejectReason('')
                                      }}
                                    >
                                      <XIcon data-icon="inline-start" />
                                      {tx('Từ chối', 'Reject')}
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-full"
                                    onClick={() => setDetail(u)}
                                  >
                                    {tx('Chi tiết', 'Details')}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {tx('Trang', 'Page')} {page}/{totalPages} · {total}{' '}
                    {tx('tài khoản', 'accounts')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeftIcon className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={page >= totalPages || loading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <ChevronRightIcon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </Section>
            </TabsContent>

            {/* ── ACTIVITY ───────────────────────────────────── */}
            <TabsContent value="activity" className="outline-none">
              <div className="grid gap-4 lg:grid-cols-2">
                <Section
                  title={tx('Vừa được duyệt / từ chối', 'Recently reviewed')}
                  description={tx('Theo reviewedAt', 'By reviewedAt')}
                >
                  {insights.reviewed.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      {tx(
                        'Chưa có reviewedAt trong snapshot — approve/reject sẽ xuất hiện ở đây.',
                        'No reviewedAt in snapshot yet — approvals will show here.',
                      )}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {insights.reviewed.map((u) => (
                        <li
                          key={u.id}
                          className="flex items-start gap-3 rounded-xl border bg-muted/20 px-3 py-2.5"
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                              String(u.status).toLowerCase() === 'active'
                                ? 'bg-primary/15 text-primary'
                                : 'bg-rose-500/10 text-rose-600',
                            )}
                          >
                            {String(u.status).toLowerCase() === 'active' ? (
                              <CheckIcon className="size-4" />
                            ) : (
                              <XIcon className="size-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-medium">
                                {u.fullName || u.email}
                              </p>
                              {statusBadge(u.status)}
                              {roleBadge(u.role)}
                            </div>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {relativeWhen(u.reviewedAt, loc)}
                              {u.reviewedBy ? ` · by ${u.reviewedBy.slice(0, 8)}…` : ''}
                              {u.rejectReason ? ` · ${u.rejectReason}` : ''}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section
                  title={tx('Hàng đợi đăng ký mới', 'New registration queue')}
                  description={tx('Pending trong snapshot', 'Pending in snapshot')}
                >
                  {insights.recent.filter((u) => String(u.status).toLowerCase() === 'pending')
                    .length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      {tx('Queue trống — tốt.', 'Queue empty — nice.')}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {insights.recent
                        .filter((u) => String(u.status).toLowerCase() === 'pending')
                        .map((u) => (
                          <li
                            key={u.id}
                            className="flex items-center justify-between gap-2 rounded-xl border bg-muted/20 px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {u.fullName || u.email}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {u.email} · {relativeWhen(u.createdAt, loc)}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                size="sm"
                                className="rounded-full"
                                disabled={rateLimited}
                                onClick={() => setApproveTarget(u)}
                              >
                                <CheckIcon className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                disabled={rateLimited}
                                onClick={() => {
                                  setRejectTarget(u)
                                  setRejectReason('')
                                }}
                              >
                                <XIcon className="size-3.5" />
                              </Button>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </Section>
              </div>
            </TabsContent>
          </Tabs>
        </PageShell>
      </main>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRoundIcon className="size-5 text-primary" />
              {detail?.fullName || detail?.displayName || detail?.email}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-1.5 pt-1">
              {detail ? roleBadge(detail.role) : null}
              {detail ? statusBadge(detail.status) : null}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="grid gap-2 text-sm">
              {(
                [
                  [tx('Email', 'Email'), detail.email, MailIcon],
                  [tx('User ID', 'User ID'), detail.id, InfoIcon],
                  [tx('Vai trò (raw)', 'Role (raw)'), detail.role, ShieldCheckIcon],
                  [tx('Trạng thái', 'Status'), detail.status, ActivityIcon],
                  [
                    tx('Startup dự kiến', 'Expected startup'),
                    detail.expectedStartupName || '—',
                    RocketIcon,
                  ],
                  [
                    tx('Tổ chức', 'Organization'),
                    detail.organizationName || detail.organizationId || '—',
                    Building2Icon,
                  ],
                  [
                    tx('Đăng ký lúc', 'Registered'),
                    formatWhen(detail.createdAt, loc === 'vi' ? 'vi-VN' : 'en-US'),
                    ClockIcon,
                  ],
                  [
                    tx('Cập nhật', 'Updated'),
                    formatWhen(detail.updatedAt, loc === 'vi' ? 'vi-VN' : 'en-US'),
                    ClockIcon,
                  ],
                  [
                    tx('Duyệt lúc', 'Reviewed at'),
                    formatWhen(detail.reviewedAt, loc === 'vi' ? 'vi-VN' : 'en-US'),
                    CheckIcon,
                  ],
                  [tx('Duyệt bởi', 'Reviewed by'), detail.reviewedBy || '—', UserRoundIcon],
                  [
                    tx('Lý do từ chối', 'Reject reason'),
                    detail.rejectReason || '—',
                    XIcon,
                  ],
                  [
                    tx('Đăng nhập gần nhất', 'Last login'),
                    formatWhen(detail.lastLoginAt, loc === 'vi' ? 'vi-VN' : 'en-US'),
                    ClockIcon,
                  ],
                ] as const
              ).map(([label, value, Icon]) => (
                <div
                  key={String(label)}
                  className="flex items-start gap-3 rounded-lg border px-3 py-2"
                >
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      {label}
                    </p>
                    <p className="break-all text-sm font-medium">{value || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {detail && String(detail.status).toLowerCase() === 'pending' ? (
              <>
                <Button
                  className="rounded-full"
                  disabled={rateLimited || actionId === detail.id}
                  onClick={() => {
                    setApproveTarget(detail)
                    setDetail(null)
                  }}
                >
                  <CheckIcon data-icon="inline-start" />
                  {tx('Duyệt', 'Approve')}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={rateLimited}
                  onClick={() => {
                    setRejectTarget(detail)
                    setRejectReason('')
                    setDetail(null)
                  }}
                >
                  <XIcon data-icon="inline-start" />
                  {tx('Từ chối', 'Reject')}
                </Button>
              </>
            ) : null}
            <Button variant="ghost" className="rounded-full" onClick={() => setDetail(null)}>
              {tx('Đóng', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve with optional note */}
      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tx('Duyệt tài khoản', 'Approve account')}</DialogTitle>
            <DialogDescription>{approveTarget?.email}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>{tx('Ghi chú (tuỳ chọn)', 'Note (optional)')}</Label>
            <Input
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder={tx('VD: Đã xác minh email NIC', 'e.g. NIC email verified')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>
              {tx('Hủy', 'Cancel')}
            </Button>
            <Button
              disabled={!approveTarget || actionId === approveTarget?.id}
              onClick={() =>
                approveTarget && void onApprove(approveTarget, approveNote.trim() || undefined)
              }
            >
              {tx('Xác nhận duyệt', 'Confirm approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tx('Từ chối tài khoản', 'Reject account')}</DialogTitle>
            <DialogDescription>{rejectTarget?.email}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>{tx('Lý do *', 'Reason *')}</Label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={tx(
                'VD: Email không hợp lệ / spam / ngoài phạm vi NIC',
                'e.g. Invalid email / spam / out of NIC scope',
              )}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              {tx('Hủy', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void onReject()}>
              {tx('Xác nhận từ chối', 'Confirm reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkRejectOpen} onOpenChange={setBulkRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {tx('Từ chối hàng loạt', 'Bulk reject')} ({selected.length})
            </DialogTitle>
            <DialogDescription>
              {tx(
                'Lý do áp dụng cho tất cả tài khoản đã chọn.',
                'This reason applies to every selected account.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>{tx('Lý do *', 'Reason *')}</Label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRejectOpen(false)}>
              {tx('Hủy', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={bulkBusy}
              onClick={() => void bulkReject()}
            >
              {tx('Xác nhận từ chối', 'Confirm reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
