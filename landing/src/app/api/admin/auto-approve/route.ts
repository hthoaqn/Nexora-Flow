/**
 * POST /api/admin/auto-approve
 * Temporary hackathon helper: auto-approve pending accounts for judges.
 *
 * Body:
 *   { userId: string }           — approve one
 *   { allPending: true }         — sweep all pending
 *   { email?: string }           — optional audit only
 *
 * Env: AUTO_APPROVE_PENDING=true (default), ADMIN_BOOTSTRAP_USER_ID
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  approveAllPending,
  approveUserById,
  isAutoApproveEnabled,
} from '@/lib/auto-approve-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!isAutoApproveEnabled()) {
    return NextResponse.json(
      {
        success: false,
        message: 'Auto-approve disabled (set AUTO_APPROVE_PENDING=true)',
      },
      { status: 403 },
    )
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  if (body?.allPending === true || body?.sweep === true) {
    const result = await approveAllPending(Number(body?.limit) || 100)
    return NextResponse.json({
      success: true,
      data: {
        mode: 'sweep',
        total: result.total,
        approvedCount: result.approved.length,
        failedCount: result.failed.length,
        approved: result.approved,
        failed: result.failed,
      },
      message: `Approved ${result.approved.length}/${result.total} pending`,
    })
  }

  const userId = String(body?.userId || body?.user_id || '').trim()
  if (!userId) {
    return NextResponse.json(
      { success: false, message: 'userId or allPending required' },
      { status: 400 },
    )
  }

  const result = await approveUserById(
    userId,
    body?.note || 'Hackathon auto-approve (judges demo)',
  )

  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.error || 'approve failed', data: result },
      { status: 502 },
    )
  }

  return NextResponse.json({
    success: true,
    data: result,
    message: 'Account approved',
  })
}

/** GET — health / flag status (no side effects) */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      enabled: isAutoApproveEnabled(),
      endpoint: 'POST /api/admin/auto-approve',
      modes: ['userId', 'allPending'],
    },
  })
}
