'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Building2Icon,
  ChevronsUpDownIcon,
  Columns2Icon,
  FileTextIcon,
  FolderKanbanIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  LogOutIcon,
  PlusIcon,
  Settings2Icon,
  TrophyIcon,
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
import { ThemeToggle } from '@/components/Controls'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const mainNav = [
  {
    href: '/programs',
    label: 'Chương trình',
    icon: FolderKanbanIcon,
    match: (p: string) =>
      p === '/programs' || p === '/programs/new' || /^\/programs\/[^/]+/.test(p),
  },
  {
    href: '/settings/organization',
    label: 'Tổ chức',
    icon: Building2Icon,
    match: (p: string) => p.startsWith('/settings/organization'),
  },
  {
    href: '/settings/library-readiness',
    label: 'Thư viện',
    icon: LibraryIcon,
    match: (p: string) => p.startsWith('/settings/library'),
  },
] as const

export const programNav = [
  { segment: 'overview', label: 'Tổng quan', short: 'TQ', icon: LayoutDashboardIcon },
  { segment: 'applications', label: 'Hồ sơ', short: 'HS', icon: FileTextIcon },
  { segment: 'ranking', label: 'Xếp hạng', short: 'XH', icon: TrophyIcon },
  { segment: 'compare', label: 'So sánh', short: 'SS', icon: Columns2Icon },
  { segment: 'audit', label: 'Nhật ký', short: 'NK', icon: HistoryIcon },
  { segment: 'settings', label: 'Cài đặt', short: 'CĐ', icon: Settings2Icon },
] as const

export function parseProgramId(pathname: string): string | null {
  const m = pathname.match(/^\/programs\/([^/]+)/)
  if (!m || m[1] === 'new') return null
  return m[1]
}

function pageTitle(pathname: string): string {
  if (pathname === '/programs') return 'Chương trình'
  if (pathname === '/programs/new') return 'Tạo chương trình'
  if (pathname.startsWith('/settings/organization')) return 'Tổ chức'
  if (pathname.startsWith('/settings/library')) return 'Thư viện'
  if (pathname.startsWith('/applications/')) return 'Hồ sơ'
  if (pathname.includes('/overview')) return 'Tổng quan'
  if (pathname.includes('/applications')) return 'Hồ sơ'
  if (pathname.includes('/ranking')) return 'Xếp hạng'
  if (pathname.includes('/compare')) return 'So sánh'
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
  const pathname = usePathname() ?? ""
  const { isMobile, setOpenMobile } = useSidebar()
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [pathname, isMobile, setOpenMobile])
  return null
}

/** Brand header — matches dashboard-01: plain size=lg menu button, no double box */
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
            <span className="truncate text-xs capitalize">
              {orgLabel(session?.organizationId)}
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function NavMain() {
  const pathname = usePathname() ?? ""
  const { session } = useAuth()
  const canCreate = session?.role !== 'reviewer'

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {mainNav.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              tooltip={item.label}
              isActive={item.match(pathname)}
              render={<Link href={item.href} />}
            >
              <item.icon />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {canCreate ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Tạo chương trình"
              isActive={pathname === '/programs/new'}
              render={<Link href="/programs/new" />}
            >
              <PlusIcon />
              <span>Tạo chương trình</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavProgram({ programId }: { programId: string }) {
  const pathname = usePathname() ?? ""

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Program</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Tất cả chương trình"
            render={<Link href="/programs" />}
          >
            <FolderKanbanIcon />
            <span>Danh sách</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {programNav.map((item) => {
          const href = `/programs/${programId}/${item.segment}`
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <SidebarMenuItem key={item.segment}>
              <SidebarMenuButton
                tooltip={item.label}
                isActive={active}
                render={<Link href={href} />}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function NavUser() {
  const { session, signOut } = useAuth()
  const router = useRouter()
  const { isMobile } = useSidebar()
  const name = session?.displayName || session?.email?.split('@')[0] || 'User'
  const email = session?.email || ''
  const initials = (name || email || 'N')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase() || 'U'

  return (
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
                    <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
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
              <DropdownMenuItem onClick={() => router.push('/settings/organization')}>
                <Building2Icon />
                Tổ chức
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                signOut()
                // switch=1 forces clean login form (no sticky previous account)
                router.replace('/workspace/login?switch=1')
              }}
            >
              <LogOutIcon />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname() ?? ""
  const programId = React.useMemo(() => parseProgramId(pathname), [pathname])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavBrand />
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

function SiteHeader({ title }: { title: string }) {
  return (
    <header className="dash-header flex h-(--header-height) shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
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
                Workspace
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage className="truncate">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <ThemeToggle />
      </div>
    </header>
  )
}

/** Compact program strip for in-page navigation */
export function ProgramTabs({ programId }: { programId: string }) {
  const pathname = usePathname() ?? ""

  return (
    <nav
      aria-label="Program"
      className={cn(
        'mb-4 flex gap-0.5 overflow-x-auto overscroll-x-contain rounded-full border bg-card/85 p-1 shadow-sm backdrop-blur-md',
        '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {programNav.map((item) => {
        const href = `/programs/${programId}/${item.segment}`
        const active = pathname === href || pathname.startsWith(`${href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.segment}
            href={href}
            data-active={active}
            className={cn('tab-pill shrink-0 gap-1.5 text-xs')}
          >
            <Icon className="size-3.5 opacity-80" />
            <span className="sm:hidden">{item.short}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth()
  const router = useRouter()
  const pathname = usePathname() ?? ""
  const title = pageTitle(pathname)

  React.useEffect(() => {
    if (!ready) return
    if (!session) router.replace('/workspace/login')
  }, [ready, session, router])

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
      <CloseOnNavigate />
      {/* inset = canvas bg-sidebar + floating content card — official dashboard-01 look */}
      <AppSidebar variant="inset" />
      <SidebarInset className="relative">
        <div className="dash-ambient" aria-hidden />
        <SiteHeader title={title} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col">
            <div
              key={pathname}
              className="page-enter w-full flex-1 px-3 py-3 sm:px-4 sm:py-4 lg:px-6"
            >
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
