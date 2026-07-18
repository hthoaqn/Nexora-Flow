/**
 * Generate NIC HR screening report as .docx (browser-side).
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from 'docx'
import { saveAs } from 'file-saver'
import type { NicHrReport, HrCandidateRow } from '@/lib/nic-report'
import { recommendationLabel, statusLabel } from '@/lib/nic-report'

function p(text: string, opts?: { bold?: boolean; size?: number; color?: string }) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ?? 20, // half-points → 10pt
        color: opts?.color,
        font: 'Calibri',
      }),
    ],
  })
}

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 200, after: 160 },
    children: [new TextRun({ text, bold: true, size: 32, font: 'Calibri' })],
  })
}

function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Calibri' })],
  })
}

function cell(text: string, opts?: { bold?: boolean; width?: number; shade?: string }) {
  return new TableCell({
    width: { size: opts?.width ?? 2000, type: WidthType.DXA },
    shading: opts?.shade ? { type: 'clear' as const, fill: opts.shade } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || '—',
            bold: opts?.bold,
            size: 18,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  })
}

function candidateTable(rows: HrCandidateRow[], lang: 'vi' | 'en') {
  const header = new TableRow({
    children: [
      cell(lang === 'vi' ? '#' : '#', { bold: true, width: 500, shade: 'EEF2FF' }),
      cell(lang === 'vi' ? 'Startup' : 'Startup', { bold: true, width: 2200, shade: 'EEF2FF' }),
      cell(lang === 'vi' ? 'Điểm' : 'Score', { bold: true, width: 900, shade: 'EEF2FF' }),
      cell(lang === 'vi' ? 'Gợi ý' : 'Rec.', { bold: true, width: 1200, shade: 'EEF2FF' }),
      cell(lang === 'vi' ? 'Ngành / Stage' : 'Industry / Stage', {
        bold: true,
        width: 2200,
        shade: 'EEF2FF',
      }),
      cell(lang === 'vi' ? 'Lý do' : 'Reasons', { bold: true, width: 2800, shade: 'EEF2FF' }),
    ],
  })

  const body = rows.map((c, i) => {
    const score = c.screeningScore ?? c.fitScore ?? '—'
    return new TableRow({
      children: [
        cell(String(i + 1), { width: 500 }),
        cell(c.name, { width: 2200 }),
        cell(String(score), { width: 900 }),
        cell(recommendationLabel(c.recommendation, lang), { width: 1200 }),
        cell(`${c.industries} / ${c.stage}`, { width: 2200 }),
        cell(c.reasons.join('; '), { width: 2800 }),
      ],
    })
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...body],
  })
}

export async function buildNicHrDocxBlob(
  report: NicHrReport,
  lang: 'vi' | 'en' = 'vi',
): Promise<Blob> {
  const isVi = lang === 'vi'
  const f = report.funnel
  const when = new Date(report.generatedAt).toLocaleString(isVi ? 'vi-VN' : 'en-US')

  const children: (Paragraph | Table)[] = [
    h1(isVi ? 'BÁO CÁO SÀNG LỌC NIC (HR Deal-flow)' : 'NIC SCREENING REPORT (Deal-flow HR)'),
    p(
      isVi
        ? 'Vai trò: Nhân sự NIC lọc hồ sơ startup → xếp shortlist → gửi lãnh đạo / mentor.'
        : 'Role: NIC staff as HR — filter startups → shortlist → send to leadership / mentors.',
      { color: '555555' },
    ),
    p(`${isVi ? 'Chương trình' : 'Program'}: ${report.program.name}`, { bold: true, size: 22 }),
    p(`${isVi ? 'Mục tiêu' : 'Objective'}: ${report.program.objective || '—'}`),
    p(
      `${isVi ? 'Ngành ưu tiên' : 'Priority industries'}: ${report.program.priorityIndustries.join(', ') || '—'}`,
    ),
    p(
      `${isVi ? 'Giai đoạn' : 'Stages'}: ${report.program.acceptedStages.join(', ') || '—'} · ${isVi ? 'Địa bàn' : 'Regions'}: ${report.program.locations.join(', ') || '—'}`,
    ),
    p(
      `${isVi ? 'Chỉ tiêu chọn' : 'Selection quota'}: ${report.program.expectedSelections ?? '—'}`,
    ),
    p(
      `${isVi ? 'Người lập' : 'Prepared by'}: ${report.generatedBy.name || report.generatedBy.email} (${report.generatedBy.role || 'staff'}) · ${when}`,
    ),

    h2(isVi ? '1. Tóm tắt điều hành' : '1. Executive summary'),
    p(isVi ? report.executiveSummaryVi : report.executiveSummaryEn),

    h2(isVi ? '2. Phễu hồ sơ (funnel)' : '2. Application funnel'),
    p(
      isVi
        ? `Tổng: ${f.total} · Chờ duyệt: ${f.needsReview} · Eligible: ${f.eligible} · Đã chấm: ${f.scored} · Shortlist: ${f.shortlisted} · Interview: ${f.interview} · Accepted: ${f.accepted} · Rejected: ${f.rejected} · matchingOptIn: ${f.matchingOptIn}`
        : `Total: ${f.total} · Needs review: ${f.needsReview} · Eligible: ${f.eligible} · Scored: ${f.scored} · Shortlist: ${f.shortlisted} · Interview: ${f.interview} · Accepted: ${f.accepted} · Rejected: ${f.rejected} · matchingOptIn: ${f.matchingOptIn}`,
    ),

    h2(isVi ? '3. Shortlist đề xuất (ưu tiên intro)' : '3. Proposed shortlist (intro priority)'),
  ]

  if (report.shortlist.length) {
    children.push(candidateTable(report.shortlist, lang))
  } else {
    children.push(
      p(isVi ? '(Chưa có startup đủ điều kiện shortlist.)' : '(No shortlist candidates yet.)'),
    )
  }

  children.push(
    h2(isVi ? '4. Ứng viên phỏng vấn' : '4. Interview candidates'),
  )
  if (report.interview.length) {
    children.push(candidateTable(report.interview, lang))
  } else {
    children.push(p(isVi ? '(Trống)' : '(Empty)'))
  }

  children.push(h2(isVi ? '5. Giữ lại (HOLD)' : '5. Hold pool'))
  if (report.hold.length) {
    children.push(candidateTable(report.hold.slice(0, 20), lang))
  } else {
    children.push(p(isVi ? '(Trống)' : '(Empty)'))
  }

  children.push(
    h2(isVi ? '6. Chi tiết từng startup trong báo cáo' : '6. Per-startup detail'),
  )

  for (const c of report.candidates.slice(0, 40)) {
    const score = c.screeningScore ?? c.fitScore ?? '—'
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 60 },
        children: [
          new TextRun({
            text: `${c.name}  ·  ${recommendationLabel(c.recommendation, lang)}  ·  score ${score}`,
            bold: true,
            size: 22,
            font: 'Calibri',
          }),
        ],
      }),
      p(
        `${isVi ? 'Trạng thái pipeline' : 'Pipeline status'}: ${statusLabel(String(c.status))} · Opt-in: ${c.matchingOptIn ? 'yes' : 'no'} · ${c.industries} / ${c.stage}`,
      ),
      p(
        `${isVi ? 'Lý do' : 'Reasons'}: ${c.reasons.join(' | ') || '—'}`,
      ),
      p(`${isVi ? 'Rủi ro' : 'Risks'}: ${c.risks.join(' | ') || '—'}`, {
        color: '884400',
      }),
      p(
        `${isVi ? 'File' : 'File'}: ${c.fileName || '—'} · ID: ${c.applicationId}`,
        { size: 16, color: '666666' },
      ),
    )
  }

  children.push(
    h2(isVi ? '7. Cam kết quy trình' : '7. Process note'),
    p(
      isVi
        ? 'AI chỉ hỗ trợ quyết định (decision support). Shortlist / intro / từ chối cuối cùng do nhân sự NIC xác nhận. Báo cáo này có thể đính kèm email gửi mentor, ban giám khảo hoặc lãnh đạo chương trình.'
        : 'AI is decision support only. Final shortlist / intro / reject is confirmed by NIC staff. Attach this report to email for mentors, jury, or program leadership.',
    ),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: 'Nexora Flow · NIC Deal-flow Matchmaker',
          italics: true,
          size: 18,
          color: '666666',
          font: 'Calibri',
        }),
      ],
    }),
  )

  const doc = new Document({
    creator: 'Nexora Flow',
    title: `NIC Report — ${report.program.name}`,
    description: 'NIC HR screening summary',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.7),
              bottom: convertInchesToTwip(0.7),
              left: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
            },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}

export async function downloadNicHrDocx(report: NicHrReport, lang: 'vi' | 'en' = 'vi') {
  const blob = await buildNicHrDocxBlob(report, lang)
  const safe = report.program.name.replace(/[^\w\-]+/g, '_').slice(0, 40)
  const date = new Date().toISOString().slice(0, 10)
  saveAs(blob, `NIC_Report_${safe}_${date}.docx`)
}
