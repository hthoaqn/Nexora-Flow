/**
 * Deterministic match strength/weakness analysis from score breakdown.
 * Used as offline fallback when Ollama/DeepSeek is unavailable;
 * also shapes prompts for the AI chatbot.
 */

export type DimKey =
  | 'industry'
  | 'technology'
  | 'stage'
  | 'partnership'
  | 'funding'
  | 'market'
  | 'capability'

export const DIM_META: Record<
  DimKey,
  { weight: number; vi: string; en: string; tipVi: string; tipEn: string }
> = {
  industry: {
    weight: 0.25,
    vi: 'Lĩnh vực',
    en: 'Industry',
    tipVi: 'Bổ sung / làm rõ ngành trong hồ sơ cho khớp thesis đối tác.',
    tipEn: 'Clarify industries so they align with partner thesis.',
  },
  technology: {
    weight: 0.15,
    vi: 'Công nghệ',
    en: 'Technology',
    tipVi: 'Liệt kê stack, IP, mô-đun tech cốt lõi rõ hơn.',
    tipEn: 'List core stack, IP, and tech modules more clearly.',
  },
  stage: {
    weight: 0.15,
    vi: 'Giai đoạn',
    en: 'Stage',
    tipVi: 'Điều chỉnh stage (MVP/seed…) hoặc nhắm partner phù hợp giai đoạn.',
    tipEn: 'Adjust stage (MVP/seed…) or target stage-aligned partners.',
  },
  partnership: {
    weight: 0.15,
    vi: 'Hợp tác',
    en: 'Partnership',
    tipVi: 'Nêu rõ nhu cầu: pilot, đầu tư, R&D, tech transfer…',
    tipEn: 'State needs: pilot, investment, R&D, tech transfer…',
  },
  funding: {
    weight: 0.1,
    vi: 'Gọi vốn',
    en: 'Funding',
    tipVi: 'Cập nhật ticket size / currency khớp dải đầu tư của quỹ.',
    tipEn: 'Update ticket size/currency to partner investment range.',
  },
  market: {
    weight: 0.1,
    vi: 'Thị trường',
    en: 'Market',
    tipVi: 'Bổ sung thị trường mục tiêu (VN, SEA…).',
    tipEn: 'Add target markets (VN, SEA…).',
  },
  capability: {
    weight: 0.1,
    vi: 'Năng lực',
    en: 'Capability',
    tipVi: 'Team, traction, điều kiện bắt buộc còn thiếu.',
    tipEn: 'Fill team, traction, and missing hard requirements.',
  },
}

export type DimInsight = {
  key: DimKey
  score: number // 0–100
  weight: number
  weighted: number // contribution to total
  labelVi: string
  labelEn: string
  level: 'strong' | 'ok' | 'weak' | 'critical'
  tipVi: string
  tipEn: string
}

export type MatchInsight = {
  totalScore: number
  strengths: DimInsight[]
  weaknesses: DimInsight[]
  all: DimInsight[]
  summaryVi: string
  summaryEn: string
  nextActionsVi: string[]
  nextActionsEn: string[]
  /** Graph nodes for diagram */
  diagram: {
    startupLabel: string
    partnerLabel: string
    edges: { key: DimKey; score: number; labelVi: string; labelEn: string }[]
  }
}

function clamp100(raw: number): number {
  let n = Number(raw)
  if (!Number.isFinite(n)) return 0
  if (n > 0 && n <= 1) n *= 100
  while (n > 100) n /= 100
  return Math.max(0, Math.min(100, Math.round(n)))
}

function levelOf(score: number): DimInsight['level'] {
  if (score >= 80) return 'strong'
  if (score >= 55) return 'ok'
  if (score >= 30) return 'weak'
  return 'critical'
}

export function analyzeMatch(input: {
  totalScore?: number
  scoreBreakdown?: Partial<Record<DimKey, number>> | null
  matchedReasons?: string[]
  risks?: string[]
  missingRequirements?: string[]
  recommendation?: string
  startupName?: string
  partnerName?: string
}): MatchInsight {
  const b = input.scoreBreakdown || {}
  const all: DimInsight[] = (Object.keys(DIM_META) as DimKey[]).map((key) => {
    const meta = DIM_META[key]
    const score = clamp100(Number(b[key] ?? 0))
    return {
      key,
      score,
      weight: meta.weight,
      weighted: Math.round(score * meta.weight * 10) / 10,
      labelVi: meta.vi,
      labelEn: meta.en,
      level: levelOf(score),
      tipVi: meta.tipVi,
      tipEn: meta.tipEn,
    }
  })

  const strengths = all
    .filter((d) => d.level === 'strong' || d.level === 'ok')
    .sort((a, b) => b.score - a.score)
  const weaknesses = all
    .filter((d) => d.level === 'weak' || d.level === 'critical')
    .sort((a, b) => a.score - b.score)

  const total =
    clamp100(Number(input.totalScore ?? 0)) ||
    Math.round(all.reduce((s, d) => s + d.score * d.weight, 0))

  const topW = weaknesses.slice(0, 3)
  const topS = strengths.slice(0, 3)

  const summaryVi =
    total >= 80
      ? `Độ khớp cao (${total}). Điểm mạnh: ${topS.map((d) => d.labelVi).join(', ') || 'đồng đều'}.`
      : total >= 55
        ? `Độ khớp khá (${total}). Cần cải thiện: ${topW.map((d) => d.labelVi).join(', ') || 'một số chiều'}.`
        : `Độ khớp thấp (${total}). Nguyên nhân chính: ${topW.map((d) => `${d.labelVi} (${d.score})`).join(', ') || 'thiếu dữ liệu hồ sơ'}.`

  const summaryEn =
    total >= 80
      ? `High fit (${total}). Strengths: ${topS.map((d) => d.labelEn).join(', ') || 'balanced'}.`
      : total >= 55
        ? `Moderate fit (${total}). Improve: ${topW.map((d) => d.labelEn).join(', ') || 'some dimensions'}.`
        : `Low fit (${total}). Main gaps: ${topW.map((d) => `${d.labelEn} (${d.score})`).join(', ') || 'thin profile data'}.`

  const nextActionsVi = [
    ...topW.slice(0, 3).map((d) => d.tipVi),
    ...(input.missingRequirements || []).slice(0, 2).map((m) => `Bổ sung yêu cầu còn thiếu: ${m}`),
    ...(input.risks || []).slice(0, 1).map((r) => `Giảm rủi ro: ${r}`),
  ].slice(0, 5)

  const nextActionsEn = [
    ...topW.slice(0, 3).map((d) => d.tipEn),
    ...(input.missingRequirements || []).slice(0, 2).map((m) => `Fill missing requirement: ${m}`),
    ...(input.risks || []).slice(0, 1).map((r) => `Mitigate risk: ${r}`),
  ].slice(0, 5)

  return {
    totalScore: total,
    strengths,
    weaknesses,
    all,
    summaryVi,
    summaryEn,
    nextActionsVi: nextActionsVi.length
      ? nextActionsVi
      : ['Hồ sơ đã khá cân — có thể gửi intro hoặc chạy lại so khớp sau khi cập nhật deck.'],
    nextActionsEn: nextActionsEn.length
      ? nextActionsEn
      : ['Profile is fairly balanced — send intro or re-match after updating your deck.'],
    diagram: {
      startupLabel: input.startupName || 'Startup',
      partnerLabel: input.partnerName || 'Partner',
      edges: all.map((d) => ({
        key: d.key,
        score: d.score,
        labelVi: d.labelVi,
        labelEn: d.labelEn,
      })),
    },
  }
}

/** Build system+user prompt context for chat / LLM analysis */
export function buildMatchChatContext(input: {
  lang: 'vi' | 'en'
  insight: MatchInsight
  startup?: Record<string, unknown> | null
  partner?: Record<string, unknown> | null
  reasons?: string[]
  risks?: string[]
  recommendation?: string
}): string {
  const { insight, lang } = input
  const lines = [
    lang === 'vi'
      ? 'Bạn là cố vấn deal-flow Nexora Flow. Giải thích điểm số so khớp, điểm mạnh/yếu, gợi ý cải thiện hồ sơ. Trả lời rõ, có cấu trúc, tiếng Việt trừ khi user hỏi tiếng Anh.'
      : 'You are a Nexora Flow deal-flow coach. Explain match scores, strengths/weaknesses, and profile improvements. Be structured and practical.',
    '',
    `Total score: ${insight.totalScore}`,
    `Summary: ${lang === 'vi' ? insight.summaryVi : insight.summaryEn}`,
    'Dimensions:',
    ...insight.all.map(
      (d) =>
        `- ${d.key}: ${d.score}/100 (weight ${Math.round(d.weight * 100)}%) level=${d.level}`,
    ),
    `Strengths: ${insight.strengths.map((d) => d.key).join(', ') || '—'}`,
    `Weaknesses: ${insight.weaknesses.map((d) => d.key).join(', ') || '—'}`,
    `Reasons: ${(input.reasons || []).join(' | ') || '—'}`,
    `Risks: ${(input.risks || []).join(' | ') || '—'}`,
    `Recommendation: ${input.recommendation || '—'}`,
    `Startup: ${JSON.stringify(input.startup || {}).slice(0, 1500)}`,
    `Partner: ${JSON.stringify(input.partner || {}).slice(0, 1500)}`,
  ]
  return lines.join('\n')
}

export const CHAT_SUGGESTIONS_VI = [
  'Vì sao điểm tổng lại thấp như vậy?',
  'Điểm mạnh của hồ sơ mình với đối tác này là gì?',
  'Cần sửa field nào trong hồ sơ để tăng điểm?',
  'Nên gửi intro ngay hay cải thiện hồ sơ trước?',
  'So sánh chiều Lĩnh vực vs Giai đoạn giúp tôi',
  'Viết giúp tôi draft intro ngắn',
  'Giải thích trọng số 7 chiều matching',
]

export const CHAT_SUGGESTIONS_EN = [
  'Why is the total score low?',
  'What are my strengths with this partner?',
  'Which profile fields should I improve?',
  'Should I send an intro now or improve first?',
  'Compare Industry vs Stage dimensions for me',
  'Draft a short intro message for me',
  'Explain the 7 matching weights',
]

/**
 * Offline / no-LLM coach reply from structured insight + user question.
 * Keeps the chatbot usable when Ollama is down.
 */
export function heuristicChatReply(input: {
  lang: 'vi' | 'en'
  question: string
  insight: MatchInsight
  reasons?: string[]
  risks?: string[]
  recommendation?: string
  startupName?: string
  partnerName?: string
}): string {
  const L = input.lang === 'en'
  const q = String(input.question || '').toLowerCase()
  const { insight } = input
  const partner = input.partnerName || insight.diagram.partnerLabel
  const startup = input.startupName || insight.diagram.startupLabel

  const dimLines = insight.all
    .map(
      (d) =>
        `- **${L ? d.labelEn : d.labelVi}** (${Math.round(d.weight * 100)}%): ${d.score}/100 · ${d.level}`,
    )
    .join('\n')

  const wantsWhy =
    /vì sao|why|thấp|low|score|điểm|gap|yếu|weak/.test(q)
  const wantsStrong =
    /mạnh|strength|strong|điểm mạnh/.test(q)
  const wantsImprove =
    /cải thiện|improve|sửa|field|hồ sơ|profile|tăng điểm|boost/.test(q)
  const wantsIntro =
    /intro|giới thiệu|gửi|send|draft|thư/.test(q)
  const wantsWeights =
    /trọng số|weight|7 chiều|dimension|công thức|formula/.test(q)
  const wantsCompare =
    /so sánh|compare|vs|versus/.test(q)
  const wantsNow =
    /ngay|now|nên gửi|should i/.test(q)

  if (wantsWeights) {
    return L
      ? `**7 match dimensions (weights)**\n${dimLines}\n\n**Total ≈ weighted sum** of dimension scores (0–100 each).\nCurrent total for **${startup} ↔ ${partner}**: **${insight.totalScore}**.`
      : `**7 chiều so khớp (trọng số)**\n${dimLines}\n\n**Tổng ≈ tổng có trọng số** các chiều (0–100).\nĐiểm hiện tại **${startup} ↔ ${partner}**: **${insight.totalScore}**.`
  }

  if (wantsStrong) {
    const list =
      insight.strengths.length === 0
        ? L
          ? 'No dimension ≥ 55 yet — focus on profile completeness first.'
          : 'Chưa có chiều ≥ 55 — ưu tiên làm đầy hồ sơ trước.'
        : insight.strengths
            .map(
              (d) =>
                `- **${L ? d.labelEn : d.labelVi}**: ${d.score}/100`,
            )
            .join('\n')
    return L
      ? `**Strengths with ${partner}**\n${list}\n\n${insight.summaryEn}`
      : `**Điểm mạnh với ${partner}**\n${list}\n\n${insight.summaryVi}`
  }

  if (wantsIntro) {
    return L
      ? `**Intro draft** (edit before send):\n\nHi ${partner},\n\nWe are **${startup}**. On Nexora Flow our fit score is **${insight.totalScore}/100**.\nKey alignment: ${insight.strengths
          .slice(0, 2)
          .map((d) => d.labelEn)
          .join(', ') || 'shared themes'}.\nWe would love to explore a pilot / partnership.\n\nBest regards`
      : `**Draft intro** (chỉnh lại trước khi gửi):\n\nXin chào ${partner},\n\nChúng tôi là **${startup}**. Trên Nexora Flow độ khớp là **${insight.totalScore}/100**.\nĐiểm khớp chính: ${insight.strengths
          .slice(0, 2)
          .map((d) => d.labelVi)
          .join(', ') || 'các chủ đề chung'}.\nMong được trao đổi pilot / hợp tác.\n\nTrân trọng`
  }

  if (wantsCompare) {
    const sorted = [...insight.all].sort((a, b) => b.score - a.score)
    const top = sorted[0]
    const bot = sorted[sorted.length - 1]
    return L
      ? `**Dimension comparison**\nBest: **${top.labelEn}** (${top.score})\nWeakest: **${bot.labelEn}** (${bot.score})\n\n${dimLines}\n\nTip for weakest: ${bot.tipEn}`
      : `**So sánh chiều**\nCao nhất: **${top.labelVi}** (${top.score})\nThấp nhất: **${bot.labelVi}** (${bot.score})\n\n${dimLines}\n\nGợi ý chiều yếu: ${bot.tipVi}`
  }

  if (wantsImprove || wantsWhy || wantsNow || !q) {
    const weak =
      insight.weaknesses.length === 0
        ? L
          ? 'No critical weak dimensions — refine messaging and send intro.'
          : 'Không có chiều yếu nghiêm trọng — tinh chỉnh message và gửi intro.'
        : insight.weaknesses
            .map(
              (d) =>
                `- **${L ? d.labelEn : d.labelVi}** (${d.score}): ${L ? d.tipEn : d.tipVi}`,
            )
            .join('\n')

    const sendAdvice =
      insight.totalScore >= 70
        ? L
          ? 'Score is solid — you **can send an intro now**, then keep polishing the deck.'
          : 'Điểm khá tốt — **có thể gửi intro ngay**, song song cải thiện deck.'
        : insight.totalScore >= 45
          ? L
            ? 'Moderate fit — **improve 1–2 weak fields first**, then intro.'
            : 'Fit trung bình — **sửa 1–2 field yếu trước**, rồi gửi intro.'
          : L
            ? 'Low fit — **do not mass-send intros**; fix weak dimensions or target other partners.'
            : 'Fit thấp — **đừng spam intro**; sửa chiều yếu hoặc chọn partner khác.'

    const reasons =
      (input.reasons || []).length > 0
        ? `\n\n**Match reasons:**\n${(input.reasons || []).map((r) => `- ${r}`).join('\n')}`
        : ''
    const risks =
      (input.risks || []).length > 0
        ? `\n\n**Risks:**\n${(input.risks || []).map((r) => `- ${r}`).join('\n')}`
        : ''

    return L
      ? `**Why score is ${insight.totalScore}** (${startup} ↔ ${partner})\n\n${insight.summaryEn}\n\n**Weak dimensions (main drag):**\n${weak}\n\n**Next actions:**\n${insight.nextActionsEn.map((a) => `- ${a}`).join('\n')}\n\n**Intro timing:** ${sendAdvice}${reasons}${risks}\n\n_${input.recommendation ? `Engine: ${input.recommendation}` : ''}_\n\n_(Heuristic coach — enable Ollama DeepSeek R1 for deeper chat.)_`
      : `**Vì sao điểm ${insight.totalScore}** (${startup} ↔ ${partner})\n\n${insight.summaryVi}\n\n**Chiều yếu (kéo điểm xuống):**\n${weak}\n\n**Việc nên làm:**\n${insight.nextActionsVi.map((a) => `- ${a}`).join('\n')}\n\n**Gửi intro?** ${sendAdvice}${reasons}${risks}\n\n_${input.recommendation ? `Engine: ${input.recommendation}` : ''}_\n\n_(Coach heuristic — bật Ollama DeepSeek R1 để chat sâu hơn.)_`
  }

  // generic fallback
  return L
    ? `${insight.summaryEn}\n\n**All dimensions**\n${dimLines}\n\nAsk me: why low score, strengths, which fields to fix, intro draft, or weights.`
    : `${insight.summaryVi}\n\n**Các chiều**\n${dimLines}\n\nBạn có thể hỏi: vì sao thấp, điểm mạnh, field cần sửa, draft intro, hoặc trọng số.`
}
