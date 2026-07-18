'use client'

/**
 * Organization settings as a side sheet — opened from user menu.
 * Keeps main nav free of a dedicated "Tổ chức" page link.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Building2Icon, ExternalLinkIcon, ShieldCheckIcon } from 'lucide-react'
import { useTx } from '@/lib/tx'
import { useAuth, maskEmail, orgLabel } from '@/lib/auth/session'
import { getOrganizationMe, upsertOrganization } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrganizationSheet({ open, onOpenChange }: Props) {
  const { tx } = useTx()
  const { session } = useAuth()
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const canEdit = session?.role === 'owner' || session?.role === 'admin'

  const load = useCallback(async () => {
    if (!session || !open) return
    setLoading(true)
    const fallback =
      session.organizationId === 'nexora-flow'
        ? 'Nexora Flow'
        : orgLabel(session.organizationId)
    try {
      const org = await getOrganizationMe(session)
      const raw = (org.name || '').trim()
      const looksPersonal =
        raw.split(/\s+/).length >= 2 &&
        !/flow|inc|corp|lab|fund|ventures|studio|org|team|workspace/i.test(raw)
      setName(raw && !looksPersonal ? raw : fallback)
      setWebsite(org.website || '')
      setDescription(org.description || '')
    } catch {
      setName(fallback)
    } finally {
      setLoading(false)
    }
  }, [session, open])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session || !canEdit) return
    const cleanName = name.trim()
    if (cleanName.length < 2) {
      toast.error(
        tx(
          'Tên tổ chức tối thiểu 2 ký tự.',
          'Organization name needs at least 2 characters.',
        ),
      )
      return
    }
    setSaving(true)
    try {
      await upsertOrganization(session, {
        name: cleanName,
        website: (website || '').trim(),
        description: (description || '').trim().slice(0, 2000),
      })
      toast.success(tx('Đã lưu tổ chức', 'Organization saved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tx('Lỗi', 'Error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="border-b border-border/60">
          <SheetTitle className="flex items-center gap-2">
            <Building2Icon className="size-4 text-primary" />
            {tx('Tổ chức', 'Organization')}
          </SheetTitle>
          <SheetDescription>
            {tx(
              'Thông tin workspace — chỉnh tại đây, không cần trang riêng.',
              'Workspace details — edit here, no separate page.',
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner className="size-5" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="capitalize">
                  {session?.role || '—'}
                </Badge>
                <Badge variant="outline" className="max-w-[14rem] truncate">
                  {orgLabel(session?.organizationId)}
                </Badge>
              </div>

              <form id="org-sheet-form" onSubmit={onSave} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{tx('Tên tổ chức', 'Organization name')}</Label>
                  <Input
                    required
                    minLength={2}
                    maxLength={200}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!canEdit}
                    autoComplete="organization"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://"
                    disabled={!canEdit}
                    inputMode="url"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{tx('Mô tả', 'Description')}</Label>
                  <Textarea
                    className="min-h-20 resize-y"
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </form>

              <dl className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{tx('Tên', 'Name')}</dt>
                  <dd className="truncate font-medium">
                    {session?.displayName || '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate font-medium">
                    {maskEmail(session?.email)}
                  </dd>
                </div>
              </dl>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {tx(
                  'Duyệt tài khoản đăng ký nằm ở trang Quản trị. Hồ sơ chương trình duyệt trong từng chương trình.',
                  'Account approval is on Admin. Program applications are reviewed inside each program.',
                )}
              </p>
            </>
          )}
        </div>

        <SheetFooter className="border-t border-border/60 sm:flex-col">
          {canEdit ? (
            <Button
              type="submit"
              form="org-sheet-form"
              disabled={saving || loading}
              className="w-full rounded-full"
            >
              {saving ? <Spinner data-icon="inline-start" /> : null}
              {tx('Lưu thay đổi', 'Save changes')}
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="w-full rounded-full"
            render={<Link href="/admin" />}
            nativeButton={false}
            onClick={() => onOpenChange(false)}
          >
            <ShieldCheckIcon data-icon="inline-start" />
            {tx('Trang duyệt tài khoản', 'Account admin')}
            <ExternalLinkIcon data-icon="inline-end" className="opacity-60" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
