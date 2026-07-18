// @ts-nocheck
'use client'

/**
 * Module 9 — In-app notification center.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import { usePortalI18n } from '../i18n'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/investor/lib/evaluationStore'
import {
  PortalHero,
  PortalEmpty,
  SoftButton,
} from '../components/PortalUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function NotificationsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { lang } = usePortalI18n()
  const tx = (vi, en) => (lang === 'en' ? en : vi)
  const [items, setItems] = useState([])

  const reload = () => {
    if (!user?.id) return
    setItems(listNotifications(user.id))
  }

  useEffect(() => {
    reload()
  }, [user?.id])

  const unread = items.filter((n) => !n.read).length

  return (
    <div className="flex w-full flex-col gap-4">
      <PortalHero
        eyebrow={
          <>
            <Bell className="size-3" />
            {tx('Thông báo', 'Notifications')}
          </>
        }
        title={tx('Trung tâm thông báo', 'Notification center')}
        description={tx(
          'Kiểm chứng, yêu cầu thông tin, quyết định cuối.',
          'Evaluations, info requests, final decisions.',
        )}
        actions={
          <SoftButton
            size="sm"
            variant="outline"
            onClick={() => {
              if (user?.id) markAllNotificationsRead(user.id)
              reload()
            }}
          >
            <CheckCheck className="size-3.5" />
            {tx('Đọc hết', 'Mark all read')}
          </SoftButton>
        }
      />

      {unread > 0 ? (
        <Badge className="w-fit">{unread} {tx('chưa đọc', 'unread')}</Badge>
      ) : null}

      {items.length === 0 ? (
        <PortalEmpty
          title={tx('Chưa có thông báo', 'No notifications')}
          description={tx(
            'Khi có mutual match hoặc yêu cầu mới, sẽ hiện ở đây.',
            'Mutual matches and requests will show here.',
          )}
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/40',
                  !n.read && 'bg-primary/5',
                )}
                onClick={() => {
                  markNotificationRead(n.id)
                  reload()
                  if (n.href) navigate(n.href)
                }}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">
                    {lang === 'en' ? n.titleEn : n.title}
                  </p>
                  {!n.read ? (
                    <span className="size-1.5 rounded-full bg-primary" />
                  ) : null}
                  <Badge variant="outline" className="text-[9px]">
                    {n.kind}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === 'en' ? n.bodyEn : n.body}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
