// @ts-nocheck
/**
 * Diff approval table — shadcn Table + Checkbox. Fully bilingual (VI/EN).
 */
import React, { useEffect, useState } from 'react'
import { StartupProfileDTO } from '../../types'
import { Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { usePortalI18n } from '../i18n'

interface CompareChangesProps {
  currentProfile: StartupProfileDTO | null
  draftProfile: StartupProfileDTO
  selectedFields: string[]
  onChangeSelection: (fields: string[]) => void
  onConfirm: () => void
  onCancel: () => void
  isSaving: boolean
}

interface DifferenceItem {
  field: string
  label: string
  currentValue: string
  proposedValue: string
}

export const FIELD_LABELS: Record<string, string> = {
  startupName: 'Tên Startup',
  website: 'Website',
  contactEmail: 'Email liên hệ',
  phoneNumber: 'Số điện thoại',
  foundingYear: 'Năm thành lập',
  address: 'Địa chỉ',
  country: 'Quốc gia',
  stage: 'Giai đoạn phát triển',
  businessModel: 'Mô hình kinh doanh',
  description: 'Mô tả ngắn',
  problemStatement: 'Vấn đề đang giải quyết',
  solutionDescription: 'Giải pháp',
  productDescription: 'Mô tả sản phẩm',
  fundingNeed: 'Nhu cầu gọi vốn',
  currency: 'Loại tiền tệ',
  industries: 'Lĩnh vực hoạt động',
  technologies: 'Công nghệ cốt lõi',
  markets: 'Thị trường hoạt động',
  targetCustomers: 'Khách hàng mục tiêu',
  partnershipNeeds: 'Hình thức hợp tác cần tìm',
  teamCapabilities: 'Năng lực cốt lõi của đội ngũ',
}

export const FIELD_LABELS_EN: Record<string, string> = {
  startupName: 'Startup name',
  website: 'Website',
  contactEmail: 'Contact email',
  phoneNumber: 'Phone number',
  foundingYear: 'Founding year',
  address: 'Address',
  country: 'Country',
  stage: 'Development stage',
  businessModel: 'Business model',
  description: 'Short description',
  problemStatement: 'Problem statement',
  solutionDescription: 'Solution',
  productDescription: 'Product description',
  fundingNeed: 'Funding need',
  currency: 'Currency',
  industries: 'Industries',
  technologies: 'Core technologies',
  markets: 'Markets',
  targetCustomers: 'Target customers',
  partnershipNeeds: 'Partnership needs',
  teamCapabilities: 'Team capabilities',
}

export function fieldLabel(key: string, lang: string): string {
  const map = lang === 'vi' ? FIELD_LABELS : FIELD_LABELS_EN
  return map[key] || FIELD_LABELS[key] || key
}

export default function CompareChanges({
  currentProfile,
  draftProfile,
  selectedFields,
  onChangeSelection,
  onConfirm,
  onCancel,
  isSaving,
}: CompareChangesProps) {
  const { lang } = usePortalI18n()
  const tx = (vi: string, en: string) => (lang === 'vi' ? vi : en)
  const [differences, setDifferences] = useState<DifferenceItem[]>([])

  useEffect(() => {
    const list: DifferenceItem[] = []
    const emptyLabel = tx('Chưa cung cấp', 'Not provided')

    Object.keys(FIELD_LABELS).forEach((key) => {
      const currentVal = currentProfile
        ? currentProfile[key as keyof StartupProfileDTO]
        : undefined
      const draftVal = draftProfile[key as keyof StartupProfileDTO]

      const formatVal = (v: any) => {
        if (v === undefined || v === null || v === '') return emptyLabel
        if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : emptyLabel
        if (key === 'fundingNeed')
          return `${Number(v).toLocaleString()} ${draftProfile.currency}`
        return String(v)
      }

      const currStr = formatVal(currentVal)
      const draftStr = formatVal(draftVal)

      if (currStr !== draftStr) {
        list.push({
          field: key,
          label: fieldLabel(key, lang),
          currentValue: currStr,
          proposedValue: draftStr,
        })
      }
    })

    setDifferences(list)

    if (selectedFields.length === 0 && list.length > 0) {
      onChangeSelection(list.map((d) => d.field))
    }
  }, [currentProfile, draftProfile, lang])

  const handleToggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      onChangeSelection(selectedFields.filter((f) => f !== field))
    } else {
      onChangeSelection([...selectedFields, field])
    }
  }

  if (differences.length === 0) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Check className="size-6" />
          </span>
          <div>
            <h4 className="font-heading font-semibold">
              {tx('Không có thay đổi', 'No changes')}
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              {tx('Draft trùng khớp hồ sơ chính thức.', 'The draft matches the official profile.')}
            </p>
          </div>
          <Button variant="outline" onClick={onCancel}>
            {tx('Quay lại', 'Back')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none">
      <CardHeader className="border-b py-4!">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{tx('So sánh & phê duyệt', 'Compare & approve')}</CardTitle>
            <CardDescription className="mt-1">
              {differences.length}{' '}
              {tx(
                'trường khác biệt — chọn trường ghi vào hồ sơ chính thức.',
                'fields differ — pick which ones to write to the official profile.',
              )}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="tabular-nums">
            {selectedFields.length}/{differences.length} {tx('chọn', 'selected')}
          </Badge>
        </div>
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={() => onChangeSelection(differences.map((d) => d.field))}
          >
            {tx('Chọn tất cả', 'Select all')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-lg"
            onClick={() => onChangeSelection([])}
          >
            {tx('Bỏ chọn', 'Clear')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12 pl-4">{tx('Áp dụng', 'Apply')}</TableHead>
              <TableHead className="w-40">{tx('Trường', 'Field')}</TableHead>
              <TableHead>{tx('Hiện tại', 'Current')}</TableHead>
              <TableHead className="bg-primary/5 text-primary">
                {tx('Đề xuất (draft)', 'Proposed (draft)')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {differences.map((item) => {
              const checked = selectedFields.includes(item.field)
              return (
                <TableRow
                  key={item.field}
                  data-state={checked ? 'selected' : undefined}
                  className="cursor-pointer"
                  onClick={() => handleToggleField(item.field)}
                >
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => handleToggleField(item.field)}
                      aria-label={`${tx('Chọn', 'Select')} ${item.label}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium whitespace-normal">
                    {item.label}
                  </TableCell>
                  <TableCell className="max-w-[200px] whitespace-normal text-muted-foreground line-through">
                    {item.currentValue}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'max-w-[220px] whitespace-normal font-medium',
                      checked && 'bg-primary/5',
                    )}
                  >
                    {item.proposedValue}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3 border-t py-4 sm:flex-row sm:items-center sm:justify-between">
        <Alert className="border-amber-500/30 bg-amber-500/10 py-2 sm:max-w-md">
          <AlertTriangle className="size-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-900 dark:text-amber-200">
            {tx(
              'Chỉ các trường đã chọn được ghi đè hồ sơ confirmed. Trường bỏ chọn giữ nguyên.',
              'Only selected fields overwrite the confirmed profile. Unselected fields stay unchanged.',
            )}
          </AlertDescription>
        </Alert>
        <div className="flex shrink-0 justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            {tx('Hủy', 'Cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSaving || selectedFields.length === 0}
          >
            {isSaving
              ? tx('Đang lưu…', 'Saving…')
              : tx('Xác nhận & lưu hồ sơ', 'Confirm & save profile')}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
