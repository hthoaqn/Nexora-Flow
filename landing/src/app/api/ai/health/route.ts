import { NextResponse } from 'next/server'
import { ollamaConfig, ollamaHealth } from '@/lib/ai/ollama'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const cfg = ollamaConfig()
  const health = await ollamaHealth()
  return NextResponse.json({
    success: true,
    data: {
      provider: 'ollama',
      baseUrl: cfg.baseUrl,
      configuredModel: cfg.model,
      online: health.ok,
      models: health.models,
      error: health.error || null,
      features: {
        matchAnalysis: true,
        chat: true,
        stream: true,
        offline: true,
      },
    },
  })
}
