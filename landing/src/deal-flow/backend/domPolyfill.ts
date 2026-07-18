/**
 * Node.js has no DOMMatrix — pdf-parse / pdfjs may touch it at import time.
 * Import this module FIRST before any pdf-related require.
 */
export function ensureDomMatrixPolyfill() {
  if (typeof globalThis.DOMMatrix !== 'undefined') return

  // Minimal stub — enough for library load / init
  // @ts-expect-error Node runtime
  globalThis.DOMMatrix = class DOMMatrix {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0
    constructor(_init?: unknown) {}
    multiplySelf() {
      return this
    }
    preMultiplySelf() {
      return this
    }
    translateSelf() {
      return this
    }
    scaleSelf() {
      return this
    }
    rotateSelf() {
      return this
    }
    invertSelf() {
      return this
    }
    inverse() {
      return this
    }
    transformPoint(p?: { x?: number; y?: number }) {
      return { x: p?.x ?? 0, y: p?.y ?? 0, z: 0, w: 1 }
    }
    toFloat32Array() {
      return new Float32Array([1, 0, 0, 1, 0, 0])
    }
    toFloat64Array() {
      return new Float64Array([1, 0, 0, 1, 0, 0])
    }
    toString() {
      return 'matrix(1, 0, 0, 1, 0, 0)'
    }
  }
}

ensureDomMatrixPolyfill()
