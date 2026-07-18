'use client'

import { useTx } from '@/lib/tx'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  getPublicApplication,
  publicConfirmApplication,
  publicUpdateConsent,
} from '@/lib/api/client'
import type { Application, ProfileValues } from '@/lib/api/types'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { ErrorAlert } from '@/components/dashboard/ErrorAlert'
import { LoadingBlock } from '@/components/dashboard/LoadingBlock'
import { ThemeToggle } from '@/components/Controls'
import { Spinner } from '@/components/ui/spinner'
import { PROFILE_FIELD_LABELS } from '@/lib/status'

const accessKey = (id: string) => `nexora.access.${id}`

const FIELDS = [
  'startupName',
  'contactEmail',
  'website',
  'industry',
  'stage',
  'location',
  'problem',
  'solution',
  'team',
  'product',
]

export default function MyApplicationPage() {
  const { tx } = useTx()
  const params = useParams()
  const applicationId = String(params?.applicationId ?? "")

  const [accessCode, setAccessCode] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [app, setApp] = useState<Application | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [matchingOptIn, setMatchingOptIn] = useState(false)

  useEffect(() => {
    try {
      const t = sessionStorage.getItem(accessKey(applicationId))
      if (t) {
        setToken(t)
        setAccessCode(t)
      }
    } catch {
      /* ignore */
    }
  }, [applicationId])

  const load = useCallback(
    async (t: string) => {
      setLoading(true)
      setError(null)
      try {
        const data = await getPublicApplication(applicationId, t)
        setApp(data)
        setMatchingOptIn(!!data.matchingOptIn)
        const base: Record<string, string> = {}
        const src = data.confirmedProfile || data.submittedProfile || {}
        FIELDS.forEach((k) => {
          const v = src[k]
          base[k] = v == null ? '' : Array.isArray(v) ? v.join(', ') : String(v)
        })
        if (data.aiProfile) {
          FIELDS.forEach((k) => {
            if (!base[k] && data.aiProfile?.[k]) {
              const f = data.aiProfile[k]
              if (f && typeof f === 'object' && 'value' in f) {
                const val = (f as { value: unknown }).value
                base[k] = Array.isArray(val) ? val.join(', ') : String(val ?? '')
              }
            }
          })
        }
        setForm(base)
        try {
          sessionStorage.setItem(accessKey(applicationId), t)
        } catch {
          /* ignore */
        }
      } catch {
        setError(tx('Không mở được hồ sơ. Kiểm tra mã truy cập hoặc thử lại sau khi nộp.', 'Could not open the application. Check your access code or try again after submitting.'))
        setApp(null)
      } finally {
        setLoading(false)
      }
    },
    [applicationId],
  )

  useEffect(() => {
    if (token) void load(token)
  }, [token, load])

  const onUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessCode.trim()) return
    setToken(accessCode.trim())
  }

  const onConfirm = async () => {
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      const confirmedProfile: ProfileValues = {}
      Object.entries(form).forEach(([k, v]) => {
        if (!v.trim()) return
        if (k === 'industry')
          confirmedProfile[k] = v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        else confirmedProfile[k] = v.trim()
      })
      const next = await publicConfirmApplication(applicationId, token, {
        confirmedProfile,
        matchingOptIn,
        consentPolicyVersion: 'nexora-consent-v1',
      })
      setApp(next)
      toast.success(tx('Đã xác nhận hồ sơ', 'Application confirmed'))
    } catch {
      setError(tx('Xác nhận không thành công. Vui lòng thử lại.', 'Confirmation failed. Please try again.'))
      toast.error(tx('Xác nhận thất bại', 'Confirmation failed'))
    } finally {
      setSaving(false)
    }
  }

  const onConsent = async (value: boolean) => {
    if (!token) return
    setSaving(true)
    try {
      const next = await publicUpdateConsent(applicationId, token, {
        matchingOptIn: value,
        policyVersion: 'nexora-consent-v1',
        reason: value ? 'Applicant granted' : 'Applicant revoked',
      })
      setApp(next)
      setMatchingOptIn(value)
      toast.success(value ? tx('Đã bật quyền matching', 'Matching consent enabled') : tx('Đã thu hồi quyền matching', 'Matching consent revoked'))
    } catch {
      toast.error(tx('Cập nhật không thành công', 'Update failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      <header className="flex items-center justify-between border-b bg-background px-4 py-4">
        <Link href="/">
          <Logo size={28} />
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 py-10">
        <div>
          <h1 className="font-heading text-2xl font-bold">{tx('Hồ sơ của bạn', 'Your application')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tx('Xem trạng thái và xác nhận thông tin startup.', 'Check status and confirm your startup details.')}
          </p>
        </div>

        {!token || !app ? (
          <Card>
            <CardHeader>
              <CardTitle>{tx('Mở hồ sơ', 'Open application')}</CardTitle>
              <CardDescription>
                {tx('Nếu bạn vừa nộp trên thiết bị này, hệ thống sẽ tự mở. Nếu không, nhập mã truy cập nhận được khi nộp.', 'If you just submitted on this device it opens automatically. Otherwise, enter the access code you received.')}
              </CardDescription>
            </CardHeader>
            <form onSubmit={onUnlock}>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel>{tx('Mã truy cập', 'Access code')}</FieldLabel>
                    <Input
                      type="password"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder={tx('Nhập mã truy cập', 'Enter access code')}
                      autoComplete="off"
                    />
                  </Field>
                </FieldGroup>
                {error ? (
                  <div className="mt-4">
                    <ErrorAlert message={error} />
                  </div>
                ) : null}
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? <Spinner data-icon="inline-start" /> : null}
                  {loading ? tx('Đang mở…', 'Opening…') : tx('Mở hồ sơ', 'Open application')}
                </Button>
              </CardFooter>
            </form>
          </Card>
        ) : loading ? (
          <LoadingBlock />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <StatusBadge status={app.status} />
            </div>
            {error ? <ErrorAlert message={error} /> : null}

            <Card>
              <CardHeader>
                <CardTitle>{tx('Xác nhận thông tin', 'Confirm details')}</CardTitle>
                <CardDescription>{tx('Kiểm tra và chỉnh sửa trước khi gửi cho ban tổ chức.', 'Review and edit before sending to the organizers.')}</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  {FIELDS.map((k) => (
                    <Field key={k}>
                      <FieldLabel>{PROFILE_FIELD_LABELS[k] || k}</FieldLabel>
                      <Input
                        value={form[k] || ''}
                        onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
                      />
                    </Field>
                  ))}
                  <Field orientation="horizontal">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="my-optin"
                        checked={matchingOptIn}
                        onCheckedChange={(v) => setMatchingOptIn(v === true)}
                      />
                      <Label htmlFor="my-optin" className="font-normal">
                        {tx('Cho phép matching sau này', 'Allow future matching')}
                      </Label>
                    </div>
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter>
                <Button disabled={saving} onClick={() => void onConfirm()}>
                  {saving ? <Spinner data-icon="inline-start" /> : null}
                  {tx('Xác nhận hồ sơ', 'Confirm application')}
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{tx('Quyền matching', 'Matching consent')}</CardTitle>
                <CardDescription>{tx('Bạn có thể bật hoặc thu hồi bất cứ lúc nào.', 'You can enable or revoke this at any time.')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={saving || matchingOptIn}
                  onClick={() => void onConsent(true)}
                >
                  {tx('Bật', 'Enable')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || !matchingOptIn}
                  onClick={() => void onConsent(false)}
                >
                  {tx('Thu hồi', 'Revoke')}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
