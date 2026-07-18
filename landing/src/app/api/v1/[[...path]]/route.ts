/**
 * Deal-flow Express API adapter for Next App Router.
 * Bridges Web Request → Node-like stream req so multer + express.json work.
 */

// pdf-parse may require DOMMatrix at module init
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-expect-error minimal stub
  globalThis.DOMMatrix = class DOMMatrix {
    multiplySelf() {
      return this
    }
    inverse() {
      return this
    }
  }
}

import type { NextRequest } from 'next/server'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Express } from 'express'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

let appPromise: Promise<Express> | null = null

function getApp() {
  if (!appPromise) {
    appPromise = import('@/deal-flow/createApp').then((m) => m.createDealFlowApp())
  }
  return appPromise
}

function toNodeRequest(req: NextRequest, body: Buffer): IncomingMessage {
  const url = new URL(req.url)
  const readable = Readable.from(body.length ? [body] : []) as IncomingMessage

  Object.assign(readable, {
    method: req.method,
    url: url.pathname + url.search,
    originalUrl: url.pathname + url.search,
    headers: Object.fromEntries(req.headers.entries()),
    httpVersion: '1.1',
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    socket: { remoteAddress: '127.0.0.1', encrypted: url.protocol === 'https:' },
    connection: {},
  })

  return readable
}

function createNodeResponse(resolve: (res: Response) => void): ServerResponse {
  const headerMap = new Map<string, number | string | string[]>()
  let statusCode = 200
  const chunks: Buffer[] = []
  let ended = false

  const res = {
    statusCode: 200,
    headersSent: false,
    statusMessage: '',
    setHeader(name: string, value: number | string | readonly string[]) {
      headerMap.set(name.toLowerCase(), value as string | string[] | number)
      return res
    },
    getHeader(name: string) {
      return headerMap.get(name.toLowerCase())
    },
    getHeaders() {
      const out: Record<string, number | string | string[]> = {}
      headerMap.forEach((v, k) => {
        out[k] = v
      })
      return out
    },
    removeHeader(name: string) {
      headerMap.delete(name.toLowerCase())
    },
    writeHead(code: number, maybeHeaders?: unknown) {
      statusCode = code
      res.statusCode = code
      if (maybeHeaders && typeof maybeHeaders === 'object') {
        Object.entries(maybeHeaders as Record<string, string>).forEach(([k, v]) =>
          res.setHeader(k, v),
        )
      }
      res.headersSent = true
      return res
    },
    write(chunk: unknown, encoding?: unknown, cb?: unknown) {
      if (chunk != null) {
        const buf = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(
              String(chunk),
              (typeof encoding === 'string' ? encoding : 'utf8') as BufferEncoding,
            )
        chunks.push(buf)
      }
      if (typeof encoding === 'function') encoding()
      if (typeof cb === 'function') cb()
      return true
    },
    end(chunk?: unknown, encoding?: unknown, cb?: unknown) {
      if (ended) return res
      if (chunk != null && typeof chunk !== 'function') {
        res.write(chunk, encoding)
      }
      ended = true
      res.headersSent = true
      const headers = new Headers()
      headerMap.forEach((value, key) => {
        if (Array.isArray(value)) value.forEach((v) => headers.append(key, String(v)))
        else if (value != null) headers.set(key, String(value))
      })
      // Avoid conflicting content-length with stream body
      headers.delete('content-length')
      const body = Buffer.concat(chunks)
      resolve(new Response(body, { status: statusCode, headers }))
      const done = typeof chunk === 'function' ? chunk : typeof encoding === 'function' ? encoding : cb
      if (typeof done === 'function') done()
      return res
    },
    status(code: number) {
      statusCode = code
      res.statusCode = code
      return res
    },
    json(data: unknown) {
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify(data))
      return res
    },
    send(data: unknown) {
      if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
        return res.json(data)
      }
      res.end(data as never)
      return res
    },
    on() {
      return res
    },
    once() {
      return res
    },
    emit() {
      return false
    },
    pipe() {
      return res
    },
    cork() {},
    uncork() {},
  }

  return res as unknown as ServerResponse
}

async function handle(req: NextRequest): Promise<Response> {
  try {
    const app = await getApp()
    const body = Buffer.from(await req.arrayBuffer())
    const nodeReq = toIncomingMessage(req, body)
    // Content-length for body parsers
    if (body.length && !nodeReq.headers['content-length']) {
      nodeReq.headers['content-length'] = String(body.length)
    }

    return await new Promise<Response>((resolve, reject) => {
      const nodeRes = createNodeResponse(resolve)
      try {
        app(nodeReq as never, nodeRes as never, (err?: unknown) => {
          if (err) reject(err)
        })
      } catch (e) {
        reject(e)
      }
    })
  } catch (e) {
    console.error('[api/v1] handler error', e)
    return Response.json(
      {
        success: false,
        message: 'API error',
        data: null,
        error: { code: 'INTERNAL', details: e instanceof Error ? e.message : String(e) },
      },
      { status: 500 },
    )
  }
}

function toIncomingMessage(req: NextRequest, body: Buffer): IncomingMessage {
  return toNodeRequest(req, body)
}

export async function GET(req: NextRequest) {
  return handle(req)
}
export async function POST(req: NextRequest) {
  return handle(req)
}
export async function PUT(req: NextRequest) {
  return handle(req)
}
export async function PATCH(req: NextRequest) {
  return handle(req)
}
export async function DELETE(req: NextRequest) {
  return handle(req)
}
export async function OPTIONS(req: NextRequest) {
  return handle(req)
}
