// @ts-nocheck
'use client'

import React, { useEffect, useState } from 'react'
import { api } from '../api'
import { usePortalI18n } from '../i18n'
import {
  BookOpen,
  Search,
  Building2,
  ChevronLeft,
  ChevronRight,
  Globe,
  ExternalLink,
} from 'lucide-react'
import {
  PortalHero,
  PortalEmpty,
  SoftButton,
  DemoBadge,
} from '../components/PortalUI'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

const ORG_LABELS = {
  CORPORATE: 'Corporate',
  VENTURE_CAPITAL: 'VC',
  INCUBATOR: 'Incubator',
  GOVERNMENT_AGENCY: 'Government',
  corporation: 'Corporate',
  investment_fund: 'VC',
  incubator: 'Incubator',
  innovation_organization: 'Innovation',
  research_institution: 'Research',
}

function orgLabel(type) {
  if (!type) return '—'
  return ORG_LABELS[type] || String(type).replace(/_/g, ' ')
}

export default function Partners() {
  const { t } = usePortalI18n()
  const [partners, setPartners] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit] = useState(8)
  const [search, setSearch] = useState('')
  const [orgType, setOrgType] = useState('')

  const fetchPartners = async () => {
    setLoading(true)
    try {
      const res = await api.get('/partners', {
        params: { page, limit, search, organizationType: orgType },
      })
      if (res.data?.success) {
        const d = res.data.data
        setPartners(d?.items || [])
        setTotal(d?.total || 0)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPartners()
  }, [page, orgType])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    fetchPartners()
  }

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="space-y-5">
      <PortalHero
        eyebrow={
          <>
            <BookOpen className="size-3" />
            {t.partners.title}
          </>
        }
        title={t.partners.title}
        description={t.partners.lead}
        actions={
          <Badge variant="secondary" className="tabular-nums">
            {total} {t.partners.count}
          </Badge>
        }
      />

      <div className="portal-card p-4">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              placeholder={t.partners.searchPh}
            />
          </div>
          <select
            value={orgType}
            onChange={(e) => {
              setOrgType(e.target.value)
              setPage(1)
            }}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none sm:w-52 dark:bg-input/30"
          >
            <option value="">{t.partners.allOrg}</option>
            <option value="CORPORATE">Corporate</option>
            <option value="VENTURE_CAPITAL">VC</option>
            <option value="INCUBATOR">Incubator</option>
            <option value="GOVERNMENT_AGENCY">Government</option>
          </select>
          <SoftButton type="submit" size="sm" className="rounded-full">
            {t.search}
          </SoftButton>
        </form>
      </div>

      {loading ? (
        <div className="portal-card space-y-3 p-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : partners.length > 0 ? (
        <div className="portal-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[200px] pl-4">{t.partners.colOrg}</TableHead>
                <TableHead className="hidden sm:table-cell">{t.partners.colType}</TableHead>
                <TableHead className="hidden md:table-cell">{t.partners.colMarket}</TableHead>
                <TableHead className="hidden lg:table-cell">{t.partners.colInterest}</TableHead>
                <TableHead className="w-[1%] pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((p) => (
                <TableRow key={p.id} className="group">
                  <TableCell className="max-w-[280px] pl-4 whitespace-normal">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary transition-transform group-hover:scale-105">
                        <Building2 className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-medium leading-tight">
                            {p.organizationName}
                          </p>
                          {p.isDemo ? <DemoBadge label={t.demo} /> : null}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {p.description || '—'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary" className="font-normal capitalize">
                      {orgLabel(p.organizationType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden max-w-[160px] md:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Globe className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {p.preferredMarkets?.slice(0, 2).join(', ') || '—'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-[200px] lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(p.interestedIndustries || []).slice(0, 3).map((ind) => (
                        <Badge key={ind} variant="outline" className="font-normal">
                          {ind}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {p.website ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg"
                        render={
                          <a
                            href={p.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Website"
                          />
                        }
                        nativeButton={false}
                      >
                        <ExternalLink className="size-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {t.page} {page}/{totalPages} · {partners.length}/{total}
            </span>
            <div className="flex gap-1">
              <Button
                size="icon-sm"
                variant="outline"
                className="rounded-lg"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="outline"
                className="rounded-lg"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <PortalEmpty
          icon={<Search className="size-5" />}
          title={t.partners.emptyTitle}
          description={t.partners.emptyDesc}
          action={
            <SoftButton
              size="sm"
              variant="outline"
              onClick={() => {
                setSearch('')
                setOrgType('')
                setPage(1)
                setTimeout(fetchPartners, 0)
              }}
            >
              {t.partners.clear}
            </SoftButton>
          }
        />
      )}
    </div>
  )
}
