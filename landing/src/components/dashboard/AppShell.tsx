'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BriefcaseIcon,
  Building2Icon,
  ChevronsUpDownIcon,
  Columns2Icon,
  FileTextIcon,
  FolderKanbanIcon,
  GitCompareArrowsIcon,
  HandshakeIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  TrophyIcon,
  ListFilterIcon,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAuth, maskEmail, orgLabel } from '@/lib/auth/session'
import { ThemeToggle, LangToggle } from '@/components/Controls'
import { useTx } from '@/lib/tx'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  ProductTutorial,
  TutorialTrigger,
  useTutorial,
} from '@/components/tutorial/ProductTutorial'
import { IntakeModeProvider, useIntakeMode, type IntakeMode } from '@/lib/intake-mode'
import { OrganizationSheet } from '@/components/dashboard/OrganizationSheet'

/** Primary tabs only — advanced tools stay reachable by URL */
export const programNav = [
  { segment: 'overview', label: 'Tổng quan', labelEn: 'Overview', short: 'TQ', icon: LayoutDashboardIcon },
  { segment: 'applications', label: 'Hồ sơ', labelEn: 'Applications', short: 'HS', icon: FileTextIcon },
  { segment: 'ranking', label: 'Xếp hạng', labelEn: 'Ranking', short: 'XH', icon: TrophyIcon },
  { segment: 'report', label: 'Báo cáo', labelEn: 'Report', short: 'BC', icon: BriefcaseIcon },
] as const

/** Secondary tools — settings + audit live in user menu only */
export const programNavMore = [
  { segment: 'compare', label: 'So sánh', labelEn: 'Compare', short: 'SS', icon: Columns2Icon },
] as const

/** Search mode: lighter program nav (no ranking-first) */
const programNavSearch = [
  { segment: 'overview', label: 'Tổng quan', labelEn: 'Overview', short: 'TQ', icon: LayoutDashboardIcon },
  { segment: 'applications', label: 'Hồ sơ', labelEn: 'Applications', short: 'HS', icon: FileTextIcon },
] as const

export function parseProgramId(pathname: string): string | null {
  const m = pathname.match(/^\/programs\/([^/]+)/)
  if (!m || m[1] === 'new') return null
  return m[1]
}

function pageTitle(pathname: string, mode: IntakeMode): string {
  if (pathname.startsWith('/dealflow')) return 'Kết nối Startup'
  if (pathname === '/programs') {
    return mode === 'search' ? 'Tìm hồ sơ phù hợp' : 'Chọn lọc dự án'
  }
  if (pathname === '/programs/new') return 'Tạo chương trình'
  if (pathname.startsWith('/matching')) return 'Tìm hồ sơ phù hợp'
  if (pathname.startsWith('/settings/organization')) return 'Tổ chức'
  if (pathname.startsWith('/settings/library')) return 'Thư viện'
  if (pathname.startsWith('/applications/')) return 'Hồ sơ'
  if (pathname.includes('/overview')) return 'Tổng quan'
  if (pathname.includes('/applications')) return 'Hồ sơ'
  if (pathname.includes('/ranking')) return 'Xếp hạng'
  if (pathname.includes('/compare')) return 'So sánh'
  if (pathname.includes('/report')) return 'Báo cáo'
  if (pathname.includes('/audit')) return 'Nhật ký'
  if (pathname.includes('/settings')) return 'Cài đặt'
  return 'Workspace'
}

function roleLabel(role?: string) {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  if (role === 'reviewer') return 'Reviewer'
  return role || 'Member'
}

function CloseOnNavigate() {
  const pathname = usePathname() ?? ''
  const { isMobile, setOpenMobile } = useSidebar()
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [pathname, isMobile, setOpenMobile])
  return null
}

function ModeSwitch() {
  const { tx } = useTx()
  const { mode, setMode } = useIntakeMode()
  const router = useRouter()
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'

  const pick = (m: IntakeMode) => {
    setMode(m)
    if (m === 'search') router.push('/matching')
    else router.push('/programs')
  }

  const btn = (
    m: IntakeMode,
    Icon: typeof SearchIcon,
    labelVi: string,
    labelEn: string,
  ) => {
    const active = mode === m
    return (
      <button
        type="button"
        title={tx(labelVi, labelEn)}
        onClick={() => pick(m)}
        className={cn(
          'inline-flex min-w-0 items-center justify-center gap-1 rounded-md transition-colors',
          collapsed ? 'size-8' : 'h-7 flex-1 px-1.5',
          active
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-background hover:text-foreground',
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        {!collapsed ? (
          <span className="truncate text-[10px] font-semibold leading-none">
            {tx(labelVi, labelEn)}
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <div
      className={cn(
        'px-2 pb-1.5',
        collapsed && 'flex flex-col items-center gap-0.5 px-1',
      )}
    >
      {!collapsed ? (
        <p className="mb-1 px-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {tx('Chế độ', 'Mode')}
        </p>
      ) : null}
      <div
        className={cn(
          'rounded-lg border border-border/70 bg-muted/40 p-0.5',
          collapsed ? 'flex flex-col gap-0.5' : 'flex gap-0.5',
        )}
      >
        {btn('search', SearchIcon, 'Tìm hồ sơ', 'Find')}
        {btn('select', ListFilterIcon, 'Chọn lọc', 'Pick')}
      </div>
    </div>
  )
}

function NavBrand() {
  const { session } = useAuth()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="lg"
          tooltip="Nexora Flow"
          render={<Link href="/programs" />}
        >
          <Logo size={32} showWordmark={false} />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">Nexora Flow</span>
            <span className="truncate text-xs text-muted-foreground">
              {orgLabel(session?.organizationId)}
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function NavMain() {
  const { tx } = useTx()
  const pathname = usePathname() ?? ''
  const { session } = useAuth()
  const { mode } = useIntakeMode()
  const canCreate = session?.role !== 'reviewer'

  const items =
    mode === 'search'
      ? [
          {
            href: '/matching',
            label: 'Tìm hồ sơ phù hợp',
            labelEn: 'Find fitting apps',
            icon: GitCompareArrowsIcon,
            match: (p: string) => p.startsWith('/matching'),
          },
          {
            href: '/programs',
            label: 'Chương trình',
            labelEn: 'Programs',
            icon: FolderKanbanIcon,
            match: (p: string) =>
              p === '/programs' ||
              p === '/programs/new' ||
              /^\/programs\/[^/]+/.test(p),
          },
          {
            href: '/dealflow',
            label: 'Kết nối Startup',
            labelEn: 'Startup deal-flow',
            icon: HandshakeIcon,
            match: (p: string) => p.startsWith('/dealflow'),
          },
        ]
      : [
          {
            href: '/programs',
            label: 'Chọn lọc dự án',
            labelEn: 'Shortlist projects',
            icon: ListFilterIcon,
            match: (p: string) =>
              p === '/programs' ||
              p === '/programs/new' ||
              /^\/programs\/[^/]+/.test(p),
          },
          {
            href: '/matching',
            label: 'So khớp phụ',
            labelEn: 'Side matching',
            icon: GitCompareArrowsIcon,
            match: (p: string) => p.startsWith('/matching'),
          },
          {
            href: '/dealflow',
            label: 'Kết nối Startup',
            labelEn: 'Startup deal-flow',
            icon: HandshakeIcon,
            match: (p: string) => p.startsWith('/dealflow'),
          },
        ]

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        {mode === 'search'
          ? tx('Khám phá hồ sơ', 'Discover apps')
          : tx('Chọn lọc chương trình', 'Program shortlist')}
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.href + item.label}>
            <SidebarMenuButton
              tooltip={tx(item.label, item.labelEn)}
              isActive={item.match(pathname)}
              render={<Link href={item.href} />}
            >
              <item.icon />
              <span>{tx(item.label, item.labelEn)}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {canCreate && mode === 'select' ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={tx('Tạo chương trình', 'New program')}
              isActive={pathname === '/programs/new'}
              render={<Link href="/programs/new" />}
            >
              <PlusIcon />
              <span>{tx('Tạo chương trình', 'New program')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavProgram({ programId }: { programId: string }) {
  const { tx } = useTx()
  const pathname = usePathname() ?? ''
  const { mode } = useIntakeMode()

  const primary = mode === 'search' ? programNavSearch : programNav
  const more = mode === 'search' ? programNavMore : programNavMore

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        {mode === 'search'
          ? tx('Xem chi tiết', 'Inspect program')
          : tx('Chương trình hiện tại', 'Current program')}
      </SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={tx('Tất cả chương trình', 'All programs')}
            render={<Link href="/programs" />}
          >
            <FolderKanbanIcon />
            <span>{tx('Danh sách', 'All programs')}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {primary.map((item) => {
          const href = `/programs/${programId}/${item.segment}`
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <SidebarMenuItem key={item.segment}>
              <SidebarMenuButton
                tooltip={tx(item.label, item.labelEn)}
                isActive={active}
                render={<Link href={href} />}
              >
                <item.icon />
                <span>{tx(item.label, item.labelEn)}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
        {mode === 'select'
          ? more.map((item) => {
              const href = `/programs/${programId}/${item.segment}`
              const active = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <SidebarMenuItem key={item.segment}>
                  <SidebarMenuButton
                    tooltip={tx(item.label, item.labelEn)}
                    isActive={active}
                    render={<Link href={href} />}
                    className="opacity-80"
                  >
                    <item.icon />
                    <span className="text-muted-foreground">
                      {tx(item.label, item.labelEn)}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })
          : null}
        {mode === 'search' ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={tx('Chạy so khớp', 'Run matching')}
              isActive={pathname.startsWith('/matching')}
              render={<Link href="/matching" />}
            >
              <GitCompareArrowsIcon />
              <span>{tx('Chạy so khớp', 'Run matching')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavUser() {
  const { tx } = useTx()
  const { session, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const programId = React.useMemo(() => parseProgramId(pathname), [pathname])
  const { isMobile } = useSidebar()
  const [orgOpen, setOrgOpen] = React.useState(false)
  const name = session?.displayName || session?.email?.split('@')[0] || 'User'
  const email = session?.email || ''
  const initials =
    (name || email || 'N')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase() || 'U'

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  size="lg"
                  className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                />
              }
            >
              <Avatar className="size-8 rounded-lg grayscale">
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {roleLabel(session?.role)}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--anchor-width) min-w-56 rounded-lg"
              side={isMobile ? 'bottom' : 'right'}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {maskEmail(email)}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setOrgOpen(true)}>
                  <Building2Icon />
                  {tx('Tổ chức', 'Organization')}
                </DropdownMenuItem>
                {programId ? (
                  <>
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(`/programs/${programId}/settings`)
                      }
                    >
                      <Settings2Icon />
                      {tx('Cài đặt chương trình', 'Program settings')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(`/programs/${programId}/audit`)
                      }
                    >
                      <HistoryIcon />
                      {tx('Nhật ký', 'Audit log')}
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuItem
                  onClick={() => router.push('/settings/library-readiness')}
                >
                  <LibraryIcon />
                  {tx('Thư viện', 'Library')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  signOut()
                  router.replace('/workspace/login?switch=1')
                }}
              >
                <LogOutIcon />
                {tx('Đăng xuất', 'Sign out')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <OrganizationSheet open={orgOpen} onOpenChange={setOrgOpen} />
    </>
  )
}

function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname() ?? ''
  const programId = React.useMemo(() => parseProgramId(pathname), [pathname])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavBrand />
        <ModeSwitch />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
        {programId ? <NavProgram programId={programId} /> : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function SiteHeader({
  title,
  onTutorial,
}: {
  title: string
  onTutorial?: () => void
}) {
  const { tx } = useTx()
  const { mode } = useIntakeMode()
  return (
    <header className="dash-header sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/60 bg-background/75 backdrop-blur-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-vertical:h-4 data-vertical:self-auto"
        />
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink render={<Link href="/programs" />}>
                {tx('Không gian tiếp nhận', 'Intake workspace')}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage className="truncate font-medium">
                {tx(title)}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <span
          className={cn(
            'hidden rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide md:inline-flex',
            mode === 'search'
              ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
              : 'border-primary/30 bg-primary/10 text-primary',
          )}
        >
          {mode === 'search'
            ? tx('Chế độ tìm hồ sơ', 'Find-apps mode')
            : tx('Chế độ chọn lọc', 'Shortlist mode')}
        </span>
        {onTutorial ? <TutorialTrigger onClick={onTutorial} /> : null}
        <LangToggle />
        <ThemeToggle />
      </div>
    </header>
  )
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth()
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const { mode } = useIntakeMode()
  const title = pageTitle(pathname, mode)
  const tutorial = useTutorial('intake')

  React.useEffect(() => {
    if (!ready) return
    if (!session) router.replace('/workspace/login')
  }, [ready, session, router])

  // Deep link /settings/organization → open programs (sheet is from user menu)
  React.useEffect(() => {
    if (pathname.startsWith('/settings/organization')) {
      router.replace('/programs')
    }
  }, [pathname, router])

  if (!ready || !session) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Spinner className="size-5" />
      </div>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 64)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <ProductTutorial
        audience="intake"
        open={tutorial.open}
        onOpenChange={(v) => {
          if (!v) tutorial.dismiss(true)
          else tutorial.setOpen(true)
        }}
        onDone={() => tutorial.dismiss(true)}
      />
      <CloseOnNavigate />
      <AppSidebar variant="inset" />
      <SidebarInset className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="dash-ambient" aria-hidden />
        <SiteHeader title={title} onTutorial={tutorial.reopen} />
        {/* Full content frame: stretch L/R/T/B inside inset, equal padding */}
        <div className="@container/main flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div
            key={`${pathname}-${mode}`}
            className="page-enter flex w-full min-h-full flex-1 flex-col p-3 sm:p-4 lg:p-5"
          >
            <div className="flex w-full min-h-0 flex-1 flex-col">{children}</div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <IntakeModeProvider>
      <AppShellInner>{children}</AppShellInner>
    </IntakeModeProvider>
  )
}
