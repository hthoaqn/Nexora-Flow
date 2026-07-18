'use client'

import { useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

/** Liquid iridescent background — a fullscreen fragment shader doing domain-warped noise. */
export function LiquidBg({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const isLight = resolvedTheme === 'light'
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const gl = canvas.getContext('webgl', { antialias: false, alpha: true })
    if (!gl) return

    const vsrc = `
      attribute vec2 p;
      void main() { gl_Position = vec4(p, 0.0, 1.0); }
    `
    
    // Optimized FBM loop: Reduced iteration count from 5 to 4 to dramatically decrease shader calculations
    const fsrc = `
      precision highp float;
      uniform vec2 uRes;
      uniform float uTime;
      uniform int uIsLight;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = p * 2.03 + vec2(1.7, 9.2);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uRes;
        vec2 p = uv * vec2(uRes.x / uRes.y, 1.0) * 1.6;
        float t = uTime * 0.06;

        vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
        vec2 r = vec2(fbm(p + 2.6 * q + vec2(1.7, 9.2) + t * 0.7),
                      fbm(p + 2.6 * q + vec2(8.3, 2.8) - t * 0.5));
        float f = fbm(p + 2.4 * r);

        vec3 ink, purpleColor, whiteColor;
        if (uIsLight == 1) {
          ink = vec3(0.98, 0.98, 0.98);
          purpleColor = vec3(0.88, 0.82, 0.98);
          whiteColor = vec3(1.0, 1.0, 1.0);
        } else {
          ink = vec3(0.012, 0.012, 0.024);
          purpleColor = vec3(0.65, 0.35, 0.98);
          whiteColor = vec3(0.95, 0.95, 1.0);
        }

        vec3 col = ink;
        col = mix(col, purpleColor * 0.75, smoothstep(0.32, 0.9, f) * q.x);
        col = mix(col, whiteColor * 0.7, smoothstep(0.45, 0.95, f) * r.y * 0.9);
        
        float spec = pow(smoothstep(0.62, 0.7, f) * (1.0 - smoothstep(0.7, 0.78, f)), 1.5);
        col += vec3(spec) * 0.55;

        float vign = smoothstep(1.25, 0.35, length(uv - vec2(0.5)));
        gl_FragColor = vec4(col * vign, 1.0);
      }
    `

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vsrc))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fsrc))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'uRes')
    const uTime = gl.getUniformLocation(prog, 'uTime')
    const uIsLight = gl.getUniformLocation(prog, 'uIsLight')

    gl.uniform1i(uIsLight, isLight ? 1 : 0)

    const resize = () => {
      const scale = 0.4 // scale factor optimized for performance on retina devices
      canvas.width = canvas.clientWidth * scale
      canvas.height = canvas.clientHeight * scale
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    let raf: number
    const t0 = performance.now()

    // Dynamic visibility check to halt drawing loops off-screen
    let isIntersecting = true
    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting
        if (isIntersecting && !reduce) {
          raf = requestAnimationFrame(draw)
        } else {
          cancelAnimationFrame(raf)
        }
      },
      { threshold: 0.01 }
    )
    observer.observe(canvas)

    const draw = () => {
      if (!isIntersecting) return
      gl.uniform1f(uTime, reduce ? 30 : (performance.now() - t0) / 1000)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!reduce) raf = requestAnimationFrame(draw)
    }

    if (!reduce) {
      draw()
    } else {
      gl.uniform1f(uTime, 30)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [resolvedTheme])

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
export default LiquidBg
