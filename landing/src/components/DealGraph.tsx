'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useTheme } from 'next-themes'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export function DealGraph() {
  const mountRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const isLight = resolvedTheme === 'light'
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(
      52,
      mount.clientWidth / mount.clientHeight,
      0.1,
      300
    )
    camera.position.set(0, 4.5, 40)

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // ---- particle galaxy --------------------------------------------------
    // Light mode: darker violet + NormalBlending (Additive washes out on white)
    const COUNT = isLight ? 4800 : 4200
    const PURPLE = new THREE.Color(isLight ? 0x5b21b6 : 0xc084fc) // violet-800 / violet-400
    const ACCENT = new THREE.Color(isLight ? 0x7c3aed : 0xffffff) // violet-600 / white

    const aRadius = new Float32Array(COUNT)
    const aAngle = new Float32Array(COUNT)
    const aY = new Float32Array(COUNT)
    const aColor = new Float32Array(COUNT * 3)
    const aSize = new Float32Array(COUNT)
    const aPhase = new Float32Array(COUNT)

    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5

    for (let i = 0; i < COUNT; i++) {
      const r = 3.5 + Math.pow(Math.random(), 0.72) * 16.5
      aRadius[i] = r
      const arm = Math.random() < 0.5 ? 0 : Math.PI
      aAngle[i] = arm + r * 0.32 + gauss() * 0.55
      aY[i] = gauss() * (0.5 + r * 0.06)

      const isStartup = Math.random() < 0.6
      const c = isStartup ? PURPLE : ACCENT
      const tint = 0.82 + Math.random() * 0.35
      aColor[i * 3] = c.r * tint
      aColor[i * 3 + 1] = c.g * tint
      aColor[i * 3 + 2] = c.b * tint

      // Larger points in light mode so they read on pale canvas
      aSize[i] = (isLight ? 1.05 : 0.7) + Math.pow(Math.random(), 2.5) * (isLight ? 3.2 : 2.6)
      aPhase[i] = Math.random() * Math.PI * 2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    geo.setAttribute('aRadius', new THREE.BufferAttribute(aRadius, 1))
    geo.setAttribute('aAngle', new THREE.BufferAttribute(aAngle, 1))
    geo.setAttribute('aY', new THREE.BufferAttribute(aY, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40)

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      // Additive = invisible on white; Normal = readable in light mode
      blending: isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uLight: { value: isLight ? 1.0 : 0.0 },
      },
      vertexShader: /* glsl */ `
        attribute float aRadius;
        attribute float aAngle;
        attribute float aY;
        attribute vec3  aColor;
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uLight;
        varying vec3 vColor;
        varying float vFlare;

        void main() {
          float speed = 0.55 / (0.6 + aRadius * 0.22);
          float ang = aAngle + uTime * speed;
          vec3 pos = vec3(cos(ang) * aRadius, aY + sin(uTime * 0.5 + aPhase) * 0.25, sin(ang) * aRadius);

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;

          float flare = pow(max(0.0, sin(uTime * 0.55 + aPhase * 7.0)), 24.0);
          vFlare = flare;
          vColor = aColor;

          float sizeBoost = mix(1.0, 1.35, uLight);
          gl_PointSize = aSize * sizeBoost * (1.0 + flare * 2.2) * uPixelRatio * (36.0 / -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vFlare;
        uniform float uLight;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          float core = smoothstep(0.5, 0.02, d);
          float glow = exp(-d * 5.0);
          // Light mode needs higher alpha to survive pale backgrounds
          float aCore = mix(0.9, 0.98, uLight);
          float aGlow = mix(0.35, 0.55, uLight);
          float a = core * aCore + glow * aGlow;
          a *= mix(1.0, 0.92, uLight);
          vec3 col = vColor * (0.85 + vFlare * 2.6) + vec3(vFlare * 0.6);
          // Slight darken core for light mode contrast
          col *= mix(1.0, 0.92, uLight);
          gl_FragColor = vec4(col, a);
        }
      `,
    })

    const galaxy = new THREE.Points(geo, mat)
    galaxy.rotation.x = 0.42
    galaxy.rotation.z = -0.06
    scene.add(galaxy)

    const makeGlow = (hex: string, scale: number, x: number, opacity: number) => {
      const cv = document.createElement('canvas')
      cv.width = cv.height = 128
      const g = cv.getContext('2d')
      if (g) {
        const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
        grd.addColorStop(0, hex)
        grd.addColorStop(0.45, hex.replace(/[\d.]+\)$/, '0.35)').replace(/^rgba/, 'rgba'))
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = grd
        g.fillRect(0, 0, 128, 128)
      }
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(cv),
          transparent: true,
          opacity,
          blending: isLight ? THREE.NormalBlending : THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
      sp.scale.setScalar(scale)
      sp.position.x = x
      return sp
    }
    if (isLight) {
      scene.add(makeGlow('rgba(91,33,182,0.75)', 28, -3.5, 0.42))
      scene.add(makeGlow('rgba(124,58,237,0.55)', 24, 4, 0.32))
    } else {
      scene.add(makeGlow('rgba(192,132,252,0.85)', 26, -3.5, 0.32))
      scene.add(makeGlow('rgba(255,255,255,0.7)', 22, 4, 0.32))
    }

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    
    let bloom: UnrealBloomPass | null = null
    if (!isLight) {
      bloom = new UnrealBloomPass(
        new THREE.Vector2(mount.clientWidth, mount.clientHeight),
        0.85,
        0.85,
        0.12
      )
      composer.addPass(bloom)
    }

    const target = { x: 0, y: 0 }
    const onPointer = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1
      target.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onPointer)

    const onResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
      composer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    const clock = new THREE.Clock()
    let raf: number
    let entered = 0

    // Dynamic Visibility check using IntersectionObserver
    let isIntersecting = true
    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = entry.isIntersecting
        if (isIntersecting && !reduceMotion) {
          clock.getDelta() // Reset delta timer
          raf = requestAnimationFrame(tick)
        } else {
          cancelAnimationFrame(raf)
        }
      },
      { threshold: 0.01 }
    )
    observer.observe(renderer.domElement)

    const tick = () => {
      if (!isIntersecting) return
      const t = clock.getElapsedTime()
      mat.uniforms.uTime.value = reduceMotion ? 12 : t

      if (!reduceMotion) {
        entered = Math.min(1, t / 2.5)
        const ease = 1 - Math.pow(1 - entered, 3)
        const dive = Math.min(1, window.scrollY / (window.innerHeight * 0.92))
        camera.position.z = 46 - ease * 12 - dive * 14
        if (bloom) {
          bloom.strength = 0.85 + dive * 0.75
        }
        camera.position.x += (target.x * 2.4 - camera.position.x) * 0.03
        camera.position.y += (4.5 + target.y * -1.4 - camera.position.y) * 0.03
      }
      camera.lookAt(0, 0, 0)

      if (isLight) {
        renderer.render(scene, camera)
      } else {
        composer.render()
      }
      raf = requestAnimationFrame(tick)
    }

    if (reduceMotion) {
      camera.position.z = 34
      camera.lookAt(0, 0, 0)
      if (isLight) {
        renderer.render(scene, camera)
      } else {
        composer.render()
      }
    } else {
      tick()
    }

    renderer.domElement.style.opacity = '0'
    renderer.domElement.style.transition = 'opacity 1.4s ease'
    requestAnimationFrame(() => (renderer.domElement.style.opacity = '1'))

    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('resize', onResize)
      composer.dispose()
      renderer.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Sprite) {
          if (o.geometry) o.geometry.dispose()
          if (o.material) {
            if (Array.isArray(o.material)) {
              o.material.forEach((m) => {
                if (m.map) m.map.dispose()
                m.dispose()
              })
            } else {
              if (o.material.map) o.material.map.dispose()
              o.material.dispose()
            }
          }
        }
      })
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
  }, [resolvedTheme])

  return <div ref={mountRef} className="hero-canvas" aria-hidden="true" />
}
export default DealGraph
