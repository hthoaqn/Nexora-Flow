// @ts-nocheck
/**
 * Startup shell — lean nav like Intake: core path in sidebar, extras in user menu.
 */
'use client'

import React from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  UserRound,
  Sparkles,
  Link2,
  BookOpen,
  LogOut,
  Gamepad2,
  Home,
  ChevronsUpDown,
  Handshake,
  ClipboardCheck,
  Bell,
} from 'lucide-react'
import { unreadNotificationCount } from '@/investor/lib/evaluationStore'
import { useAuthStore } from '../store/useAuthStore'
import { useStartupStore } from '../store/useStartupStore'
import { usePortalI18n } from '../i18n'
import { isInvestorPipelineEnabled } from '@/investor/flags'
import { Logo } from '@/components/Logo'
import { ThemeToggle, LangToggle } from '@/components/Controls'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
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
import {
  ProductTutorial,
  TutorialTrigger,
  useTutorial,
} from '@/components/tutorial/ProductTutorial'

interface LayoutProps {
  children: React.ReactNode
}

/** Only the main path — everything else is in the user menu */
function useNavItems() {
  const { t } = usePortalI18n()
  return [
    { to: '/dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { to: '/setup', label: t.nav.setup, icon: UserRound },
    { to: '/matches', label: t.nav.matches, icon: Sparkles },
    { to: '/connections', label: t.nav.connections, icon: Link2 },
  ]
}

function CloseOnNavigate() {
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [pathname, isMobile, setOpenMobile])
  return null
}

function NavBrand() {
  const { t } = usePortalI18n()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip={t.brand} render={<a href="/" />}>
          <Logo size={32} showWordmark={false} />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{t.brand}</span>
            <span className="truncate text-xs text-muted-foreground">
              {t.brandSub}
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function NavMain() {
  const { pathname } = useLocation()
  const items = useNavItems()
  const { lang } = usePortalI18n()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        {lang === 'en' ? 'Main path' : 'Làm việc chính'}
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const active =
            pathname === item.to || pathname.startsWith(`${item.to}/`)
          return (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton
                tooltip={item.label}
                isActive={active}
                render={<NavLink to={item.to} end={item.to === '/dashboard'} />}
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
  const { user, clearAuth } = useAuthStore()
  const { isMobile } = useSidebar()
  const { t, lang } = usePortalI18n()
  const navigate = useNavigate()
  const invOn = isInvestorPipelineEnabled()
  const name = user?.fullName || user?.email?.split('@')[0] || t.founder
  const email = user?.email || ''
  const initials =
    (name || email || 'S')
      .replace(/[^a-zA-Z0-9À-ỹ]/g, '')
      .slice(0, 2)
      .toUpperCase() || 'S'
  const [unread, setUnread] = React.useState(0)
  React.useEffect(() => {
    if (!user?.id || !invOn) return
    setUnread(unreadNotificationCount(user.id))
    const t = window.setInterval(() => {
      setUnread(unreadNotificationCount(user.id))
    }, 4000)
    return () => clearInterval(t)
  }, [user?.id, invOn])

  const logout = () => {
    clearAuth()
    try {
      useStartupStore.getState().clearStartupState()
    } catch {
      /* ignore */
    }
    window.location.href = '/login?tab=startup'
  }

  const go = (to: string) => () => navigate(to)

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
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary/15 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {t.founder}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56 rounded-xl"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/15 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={go('/setup')}>
                <UserRound />
                {t.profileMenu}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={go('/sandbox')}>
                <Gamepad2 />
                {lang === 'en' ? 'Sandbox (sim)' : 'Phòng giả lập'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={go('/partners')}>
                <BookOpen />
                {lang === 'en' ? 'Partner directory' : 'Danh bạ đối tác'}
              </DropdownMenuItem>
              {invOn ? (
                <>
                  <DropdownMenuItem onClick={go('/investor-matches')}>
                    <Handshake />
                    {t.nav.investorMatches}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={go('/evaluations')}>
                    <ClipboardCheck />
                    {t.nav.evaluations}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={go('/notifications')}>
                    <Bell />
                    {lang === 'en' ? 'Notifications' : 'Thông báo'}
                    {unread > 0 ? (
                      <Badge className="ml-auto tabular-nums">{unread}</Badge>
                    ) : null}
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem render={<a href="/" />}>
                <Home />
                {t.home}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut />
              {t.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <NavBrand />
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
        {/* No cross-link to the intake workspace — the two sides stay separate */}
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
  const { confirmedProfile, isDirty } = useStartupStore()
  const { t } = usePortalI18n()

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
              <span className="text-muted-foreground">{t.brandSub}</span>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage className="truncate font-medium">
                {title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden max-w-[9rem] truncate text-xs text-muted-foreground lg:inline">
            {confirmedProfile?.startupName || t.unnamed}
          </span>
          {isDirty ? (
            <Badge
              variant="outline"
              className="hidden gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 sm:inline-flex"
            >
              {t.draft}
            </Badge>
          ) : null}
          {confirmedProfile ? (
            <Badge
              variant="outline"
              className="hidden gap-1 border-primary/30 bg-primary/10 text-primary sm:inline-flex"
            >
              {t.confirmed}
            </Badge>
          ) : null}
          {onTutorial ? <TutorialTrigger onClick={onTutorial} /> : null}
          <LangToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation()
  const items = useNavItems()
  const hit = items.find(
    (n) => pathname === n.to || pathname.startsWith(`${n.to}/`),
  )
  // Titles for routes only in user menu
  const extraTitle: Record<string, string> = {
    '/sandbox': 'Sandbox',
    '/partners': 'Partners',
    '/investor-matches': 'Investors',
    '/evaluations': 'Evaluations',
    '/notifications': 'Notifications',
  }
  let title = hit?.label || 'Startup'
  for (const [prefix, label] of Object.entries(extraTitle)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      title = label
      break
    }
  }
  const tutorial = useTutorial('startup')

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
        audience="startup"
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
        <div className="@container/main flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="page-enter flex w-full min-h-full flex-1 flex-col p-3 sm:p-4 lg:p-5">
            <div className="flex w-full min-w-0 flex-1 flex-col">{children}</div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
