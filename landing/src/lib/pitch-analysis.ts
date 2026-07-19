/**
 * Pitch / interview transcript analysis vs investor or partner "JD" (thesis).
 * Deterministic heuristic + shapes LLM prompts.
 */

export type PitchJd = {
  name?: string
  thesis?: string
  industries?: string[]
  stages?: string[]
  requirements?: string[]
  exclusion?: string[]
  description?: string
  /** Free-form JD text (partner brief / investor thesis) */
  jdText?: string
}

export type PitchAnalysisResult = {
  score: number
  summaryVi: string
  summaryEn: string
  strengths: string[]
  gapsVsJd: string[]
  improvements: string[]
  talkingPoints: string[]
  qa: { id: string; question: string }[]
  coverage: { label: string; hit: boolean; weight: number }[]
  source: 'heuristic' | 'heuristic+ollama'
}

const PITCH_TOPICS: {
  key: string
  vi: string
  en: string
  keywords: string[]
  weight: number
}[] = [
  {
    key: 'problem',
    vi: 'Vấn đề',
    en: 'Problem',
    keywords: ['problem', 'pain', 'vấn đề', 'nỗi đau', 'challenge', 'need'],
    weight: 15,
  },
  {
    key: 'solution',
    vi: 'Giải pháp',
    en: 'Solution',
    keywords: ['solution', 'product', 'giải pháp', 'sản phẩm', 'platform', 'app'],
    weight: 15,
  },
  {
    key: 'market',
    vi: 'Thị trường',
    en: 'Market',
    keywords: ['market', 'tam', 'sam', 'thị trường', 'customer', 'khách hàng', 'icp'],
    weight: 12,
  },
  {
    key: 'traction',
    vi: 'Traction',
    en: 'Traction',
    keywords: ['traction', 'mrr', 'revenue', 'users', 'pilot', 'doanh thu', 'khách'],
    weight: 15,
  },
  {
    key: 'team',
    vi: 'Đội ngũ',
    en: 'Team',
    keywords: ['team', 'founder', 'đội ngũ', 'kỹ sư', 'engineer', 'cto'],
    weight: 12,
  },
  {
    key: 'business',
    vi: 'Mô hình KD',
    en: 'Business model',
    keywords: ['business model', 'pricing', 'cac', 'ltv', 'mô hình', 'giá'],
    weight: 12,
  },
  {
    key: 'ask',
    vi: 'Ask / gọi vốn',
    en: 'The ask',
    keywords: ['raise', 'funding', 'seed', 'gọi vốn', 'vòng', 'use of funds', 'ask'],
    weight: 10,
  },
  {
    key: 'why_now',
    vi: 'Why now',
    en: 'Why now',
    keywords: ['why now', 'timing', 'tại sao bây giờ', 'trend', 'ai'],
    weight: 9,
  },
]

function normalize(s: string) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function analyzePitchTranscript(input: {
  transcript: string
  lang?: 'vi' | 'en'
  jd?: PitchJd | null
  durationSec?: number
}): PitchAnalysisResult {
  const transcript = String(input.transcript || '').trim()
  const tNorm = normalize(transcript)
  const words = tNorm.split(/\s+/).filter(Boolean)
  const lang = input.lang === 'en' ? 'en' : 'vi'
  const jd = input.jd || {}

  const coverage = PITCH_TOPICS.map((topic) => {
    const hit = topic.keywords.some((k) => tNorm.includes(normalize(k)))
    return { label: lang === 'en' ? topic.en : topic.vi, hit, weight: topic.weight }
  })

  const coveredWeight = coverage.filter((c) => c.hit).reduce((s, c) => s + c.weight, 0)
  const totalWeight = coverage.reduce((s, c) => s + c.weight, 0)
  let score = Math.round((coveredWeight / totalWeight) * 85)

  // Length / substance
  if (words.length < 30) score = Math.min(score, 35)
  else if (words.length < 80) score = Math.min(score, 55)
  else if (words.length > 120) score += 5

  // JD keyword overlap (industries, thesis, requirements)
  const jdBlob = normalize(
    [
      jd.thesis,
      jd.description,
      jd.jdText,
      ...(jd.industries || []),
      ...(jd.stages || []),
      ...(jd.requirements || []),
    ]
      .filter(Boolean)
      .join(' '),
  )
  const jdTokens = Array.from(
    new Set(
      jdBlob
        .split(/[^a-z0-9à-ỹ]+/i)
        .filter((w) => w.length >= 4)
        .slice(0, 40),
    ),
  )
  const jdHits = jdTokens.filter((tok) => tNorm.includes(tok))
  if (jdTokens.length > 0) {
    const ratio = jdHits.length / Math.min(jdTokens.length, 12)
    score += Math.round(ratio * 15)
  }

  // Duration soft check (too short pitch)
  if (input.durationSec != null && input.durationSec < 45) {
    score = Math.min(score, 50)
  }

  score = Math.max(15, Math.min(95, score))

  const missing = coverage.filter((c) => !c.hit)
  const strengths = coverage
    .filter((c) => c.hit)
    .slice(0, 4)
    .map((c) =>
      lang === 'en'
        ? `Covered “${c.label}” clearly in the pitch`
        : `Đã chạm chủ đề “${c.label}” trong phần nói`,
    )

  if (jdHits.length) {
    strengths.unshift(
      lang === 'en'
        ? `Aligned language with investor focus (${jdHits.slice(0, 4).join(', ')})`
        : `Có từ khóa khớp thesis/JD đối tác (${jdHits.slice(0, 4).join(', ')})`,
    )
  }
  if (!strengths.length) {
    strengths.push(
      lang === 'en'
        ? 'Recording captured — flesh out structure next'
        : 'Đã ghi được nội dung — cần cấu trúc rõ hơn',
    )
  }

  const gapsVsJd: string[] = []
  if (jd.industries?.length) {
    const indHit = jd.industries.some((i) => tNorm.includes(normalize(i)))
    if (!indHit) {
      gapsVsJd.push(
        lang === 'en'
          ? `Did not mention industries this investor prioritizes: ${jd.industries.slice(0, 3).join(', ')}`
          : `Chưa nhắc ngành nhà đầu tư ưu tiên: ${jd.industries.slice(0, 3).join(', ')}`,
      )
    }
  }
  if (jd.stages?.length) {
    const stHit = jd.stages.some((s) => tNorm.includes(normalize(s)))
    if (!stHit) {
      gapsVsJd.push(
        lang === 'en'
          ? `Stage fit not stated vs investor preference (${jd.stages.join(', ')})`
          : `Chưa nêu stage so với preference quỹ (${jd.stages.join(', ')})`,
      )
    }
  }
  for (const m of missing.slice(0, 4)) {
    gapsVsJd.push(
      lang === 'en'
        ? `Missing pitch section: ${m.label}`
        : `Thiếu phần pitch: ${m.label}`,
    )
  }
  if (jd.requirements?.length) {
    for (const req of jd.requirements.slice(0, 2)) {
      if (!tNorm.includes(normalize(req).slice(0, 12))) {
        gapsVsJd.push(
          lang === 'en'
            ? `Investor requirement not addressed: ${req}`
            : `Yêu cầu nhà đầu tư chưa chạm: ${req}`,
        )
      }
    }
  }

  const improvements = [
    ...missing.slice(0, 3).map((m) =>
      lang === 'en'
        ? `Add a 20–30s block on “${m.label}” with one concrete number`
        : `Thêm 20–30s về “${m.label}” kèm 1 con số cụ thể`,
    ),
    lang === 'en'
      ? 'Open with problem → solution → traction → ask in first 90 seconds'
      : 'Mở đầu 90s: vấn đề → giải pháp → traction → ask',
    ...(jd.name
      ? [
          lang === 'en'
            ? `Name-check why ${jd.name} thesis fits your company`
            : `Nói rõ vì sao thesis của ${jd.name} khớp startup bạn`,
        ]
      : []),
  ].slice(0, 6)

  const talkingPoints = [
    lang === 'en'
      ? 'One-liner: who you serve + outcome in one sentence'
      : 'One-liner: phục vụ ai + outcome trong 1 câu',
    lang === 'en'
      ? 'Beachhead customer + why they pay now'
      : 'Khách hàng beachhead + vì sao trả tiền ngay',
    lang === 'en'
      ? 'Ask amount + use of funds + 12-month milestone'
      : 'Số tiền gọi + use of funds + mốc 12 tháng',
  ]

  const invName = jd.name || (lang === 'en' ? 'this investor' : 'nhà đầu tư này')
  const qa = [
    {
      id: 'q1',
      question:
        lang === 'en'
          ? `How does your product map to ${invName}'s thesis${jd.thesis ? ` (“${String(jd.thesis).slice(0, 80)}…”)` : ''}?`
          : `Sản phẩm map thế nào với thesis của ${invName}${jd.thesis ? ` (“${String(jd.thesis).slice(0, 80)}…”)` : ''}?`,
    },
    {
      id: 'q2',
      question:
        lang === 'en'
          ? 'What is your strongest traction metric, and what would falsify your thesis in 6 months?'
          : 'Metric traction mạnh nhất là gì, và điều gì làm sai thesis trong 6 tháng?',
    },
    {
      id: 'q3',
      question:
        lang === 'en'
          ? 'Why are you the right team for this market vs incumbents?'
          : 'Vì sao team bạn thắng market so với incumbent?',
    },
  ]

  const summaryVi =
    words.length < 20
      ? `Transcript quá ngắn (${words.length} từ) — điểm ${score}/100. Hãy nói lại rõ problem → solution → traction → ask, và khớp thesis của ${invName}.`
      : `Điểm pitch (heuristic) ${score}/100 so với JD/thesis ${invName}. Đã cover ${coverage.filter((c) => c.hit).length}/${coverage.length} chủ đề. ${gapsVsJd[0] || 'Cấu trúc khá ổn — tinh chỉnh số liệu.'}`

  const summaryEn =
    words.length < 20
      ? `Transcript too short (${words.length} words) — score ${score}/100. Re-pitch with problem → solution → traction → ask, aligned to ${invName}.`
      : `Pitch score (heuristic) ${score}/100 vs ${invName} JD/thesis. Covered ${coverage.filter((c) => c.hit).length}/${coverage.length} topics. ${gapsVsJd[0] || 'Structure is OK — sharpen metrics.'}`

  return {
    score,
    summaryVi,
    summaryEn,
    strengths: strengths.slice(0, 5),
    gapsVsJd: gapsVsJd.slice(0, 6),
    improvements: improvements.slice(0, 6),
    talkingPoints,
    qa,
    coverage,
    source: 'heuristic',
  }
}

export function buildPitchAnalysisPrompt(input: {
  lang: 'vi' | 'en'
  transcript: string
  jd?: PitchJd | null
  heuristic: PitchAnalysisResult
  durationSec?: number
}) {
  const jd = input.jd || {}
  return [
    input.lang === 'vi'
      ? 'Bạn là coach pitch Nexora Flow. Phân tích transcript pitch/phỏng vấn so với JD/thesis nhà đầu tư. Trả lời tiếng Việt, cấu trúc rõ, actionable. Không bịa số ngoài transcript.'
      : 'You are a Nexora Flow pitch coach. Analyze the pitch/interview transcript against investor JD/thesis. Structured, actionable. Do not invent numbers not in the transcript.',
    '',
    `DurationSec: ${input.durationSec ?? 'n/a'}`,
    `HeuristicScore: ${input.heuristic.score}`,
    `Investor/Partner: ${jd.name || '—'}`,
    `Thesis: ${jd.thesis || '—'}`,
    `Industries: ${(jd.industries || []).join(', ') || '—'}`,
    `Stages: ${(jd.stages || []).join(', ') || '—'}`,
    `Requirements: ${(jd.requirements || []).join(' | ') || '—'}`,
    `JD: ${(jd.jdText || jd.description || '').slice(0, 1200)}`,
    '',
    'Transcript:',
    input.transcript.slice(0, 6000),
    '',
    input.lang === 'vi'
      ? `Trả JSON thuần (không markdown) với keys:
score (0-100 number),
summary (string),
strengths (string[] max 5),
gapsVsJd (string[] max 6),
improvements (string[] max 6),
talkingPoints (string[] max 4),
qa (array of {id, question} exactly 3 follow-up questions).`
      : `Return pure JSON (no markdown) keys:
score (0-100 number),
summary (string),
strengths (string[] max 5),
gapsVsJd (string[] max 6),
improvements (string[] max 6),
talkingPoints (string[] max 4),
qa (array of {id, question} exactly 3).`,
  ].join('\n')
}

export function parsePitchLlmJson(
  raw: string,
  fallback: PitchAnalysisResult,
  lang: 'vi' | 'en',
): PitchAnalysisResult {
  try {
    const cleaned = String(raw || '')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start < 0 || end <= start) return fallback
    const obj = JSON.parse(cleaned.slice(start, end + 1))
    const score = Math.max(
      0,
      Math.min(100, Math.round(Number(obj.score ?? fallback.score))),
    )
    const qa = Array.isArray(obj.qa)
      ? obj.qa.slice(0, 3).map((q: any, i: number) => ({
          id: String(q.id || `q${i + 1}`),
          question: String(q.question || ''),
        }))
      : fallback.qa
    return {
      ...fallback,
      score,
      summaryVi: lang === 'vi' ? String(obj.summary || fallback.summaryVi) : fallback.summaryVi,
      summaryEn: lang === 'en' ? String(obj.summary || fallback.summaryEn) : fallback.summaryEn,
      strengths: Array.isArray(obj.strengths)
        ? obj.strengths.map(String).slice(0, 5)
        : fallback.strengths,
      gapsVsJd: Array.isArray(obj.gapsVsJd)
        ? obj.gapsVsJd.map(String).slice(0, 6)
        : fallback.gapsVsJd,
      improvements: Array.isArray(obj.improvements)
        ? obj.improvements.map(String).slice(0, 6)
        : fallback.improvements,
      talkingPoints: Array.isArray(obj.talkingPoints)
        ? obj.talkingPoints.map(String).slice(0, 4)
        : fallback.talkingPoints,
      qa: qa.filter((q: { question: string }) => q.question),
      source: 'heuristic+ollama',
    }
  } catch {
    return fallback
  }
}
