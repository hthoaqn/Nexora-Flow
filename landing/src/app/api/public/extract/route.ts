/**
 * Public Gemini deck extraction for /apply flow (no startup auth).
 * Uses same AiService as portal OCR.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// pdf-parse needs DOMMatrix before AiService import
import '@/deal-flow/backend/domPolyfill'
import { ensureDomMatrixPolyfill } from '@/deal-flow/backend/domPolyfill'
ensureDomMatrixPolyfill()

import { NextRequest, NextResponse } from 'next/server'

const ALLOWED = new Set(['.pdf', '.docx', '.pptx', '.txt', '.md', '.csv'])

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: 'File required', error: { code: 'FILE_REQUIRED' } },
        { status: 400 },
      )
    }

    const name = file.name || 'deck.pdf'
    const ext = name.includes('.')
      ? name.slice(name.lastIndexOf('.')).toLowerCase()
      : ''
    if (!ALLOWED.has(ext) && !file.type.includes('pdf')) {
      return NextResponse.json(
        {
          success: false,
          message: 'Supported: PDF, DOCX, PPTX, TXT, MD, CSV',
          error: { code: 'INVALID_FILE_TYPE' },
        },
        { status: 400 },
      )
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          message: 'Max 25MB',
          error: { code: 'FILE_TOO_LARGE' },
        },
        { status: 400 },
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    // Polyfill again right before dynamic import (Turbopack chunk isolation)
    ensureDomMatrixPolyfill()
    const { AiService } = await import('@/deal-flow/backend/aiService')

    let extraction: any
    try {
      extraction = await AiService.extractFromDocumentBuffer(
        buf,
        name.replace(/[^a-zA-Z0-9.-]/g, '_'),
        file.type || 'application/octet-stream',
      )
    } catch (extractErr: any) {
      const em = String(extractErr?.message || extractErr || '')
      // Graceful fallback if PDF stack still blows up — return empty profile
      if (/DOMMatrix|Canvas|ImageData|Path2D/i.test(em)) {
        console.warn('[public/extract] PDF stack error, empty profile fallback:', em)
        extraction = {
          fields: [],
          warnings: [
            'PDF engine unavailable on server — fill the form manually or try DOCX/PPTX.',
          ],
          mode: 'fallback',
          rawText: '',
          profile: {},
        }
      } else {
        throw extractErr
      }
    }

    // Normalize to flat profile fields for apply wizard
    const fields = Array.isArray(extraction?.fields) ? extraction.fields : []
    const profile: Record<string, unknown> = {}
    const map: Record<string, string> = {
      startup_name: 'startupName',
      startupName: 'startupName',
      company_name: 'startupName',
      contact_email: 'contactEmail',
      contactEmail: 'contactEmail',
      email: 'contactEmail',
      website: 'website',
      industry: 'industry',
      industries: 'industry',
      stage: 'stage',
      startup_stage: 'stage',
      location: 'location',
      country: 'location',
      problem: 'problem',
      problem_statement: 'problem',
      problemStatement: 'problem',
      solution: 'solution',
      solution_description: 'solution',
      solutionDescription: 'solution',
      product: 'product',
      product_description: 'product',
      productDescription: 'product',
      team: 'team',
      founder: 'team',
      description: 'description',
      business_model: 'businessModel',
      businessModel: 'businessModel',
      customer: 'description',
      technology: 'product',
    }
    // type → form field (Gemini dynamic types)
    const typeMap: Record<string, string> = {
      company_name: 'startupName',
      email: 'contactEmail',
      website: 'website',
      industry: 'industry',
      startup_stage: 'stage',
      location: 'location',
      problem: 'problem',
      solution: 'solution',
      team: 'team',
      founder: 'team',
      description: 'description',
      product: 'product',
      business_model: 'description',
      technology: 'product',
      customer: 'description',
      market: 'location',
    }

    for (const f of fields) {
      const typeKey = String(f.type || '')
      const raw = String(f.mappedField || f.field || typeKey || '')
      // strip unique suffix like startupName_company_name_0
      const base = raw.split('_').slice(0, 2).join('_')
      const key =
        map[raw] ||
        map[f.mappedField] ||
        typeMap[typeKey] ||
        map[base] ||
        (raw.startsWith('startupName') ? 'startupName' : '') ||
        (raw.includes('contactEmail') || raw.includes('email')
          ? 'contactEmail'
          : '')
      if (!key || key === 'other') continue
      let val = f.value
      if (Array.isArray(val)) val = val.join(', ')
      if (val != null && String(val).trim() !== '' && profile[key] == null) {
        profile[key] = val
      }
    }

    const p = extraction?.profile || extraction?.standardFields
    if (p && typeof p === 'object') {
      for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
        const key = map[k] || typeMap[k] || k
        if (profile[key] != null) continue
        if (v && typeof v === 'object' && v !== null && 'value' in (v as object)) {
          const inner = (v as { value: unknown }).value
          if (inner != null && inner !== '')
            profile[key] = Array.isArray(inner) ? inner.join(', ') : inner
        } else if (v != null && v !== '') {
          profile[key] = Array.isArray(v) ? v.join(', ') : v
        }
      }
    }

    const hasKey =
      !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)
    const isDemo =
      extraction?.mode === 'demo' ||
      (!hasKey && Object.keys(profile).length === 0)

    return NextResponse.json({
      success: true,
      message: 'ok',
      data: {
        profile,
        fields,
        warnings: [
          ...(Array.isArray(extraction?.warnings) ? extraction.warnings : []),
          ...(Object.keys(profile).length === 0
            ? [
                'Không trích được trường dữ liệu từ file — kiểm tra PDF có lớp text. Bạn vẫn có thể điền form thủ công.',
              ]
            : []),
        ],
        mode: extraction?.mode || 'gemini',
        is_demo: isDemo || extraction?.mode === 'demo',
        rawTextPreview: String(extraction?.rawText || '').slice(0, 800),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Extraction failed'
    console.error('[public/extract]', e)
    return NextResponse.json(
      {
        success: false,
        message: msg,
        error: { code: 'EXTRACT_FAILED', details: msg },
      },
      { status: 500 },
    )
  }
}
