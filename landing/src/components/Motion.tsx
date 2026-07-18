'use client'

import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

/**
 * Landing motion: Lenis + hero + manifesto scrub + scroll-visible IO.
 */
export function Motion() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      document.documentElement.classList.add('no-motion')
      return
    }

    gsap.registerPlugin(ScrollTrigger)
    const root = document.documentElement
    root.classList.add('js-motion', 'lenis')

    const desktop = window.matchMedia('(min-width: 1021px)').matches
    const fine = window.matchMedia('(pointer: fine)').matches
    const mobile = window.matchMedia('(max-width: 768px)').matches

    // ── Lenis ────────────────────────────────────────────────────
    const lenis = new Lenis({
      lerp: mobile ? 0.14 : 0.08,
      smoothWheel: true,
      wheelMultiplier: mobile ? 0.85 : 0.95,
      touchMultiplier: 1.2,
      autoRaf: false,
    })
    lenis.on('scroll', ScrollTrigger.update)

    const onTicker = (time: number) => {
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(onTicker)
    gsap.ticker.lagSmoothing(0)

    const cleanups: Array<() => void> = []

    // ── Manifesto sticky scrub ───────────────────────────────────
    // Classic sticky progress: p = -track.top / (trackH - viewH)
    // Linear across full runway so the ending never jumps after ~"finds".
    const setupManifesto = () => {
      const track = document.querySelector<HTMLElement>('[data-manifesto-track]')
      if (!track) return () => {}

      const DIM = 0.16
      const BRIGHT = 1
      // Soft per-char fade width (in character slots)
      const RAMP = 6

      const getChars = () =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-manifesto-char]'))
      const getHint = () =>
        document.querySelector<HTMLElement>('[data-manifesto-hint]')

      const setChar = (el: HTMLElement, op: number) => {
        el.style.setProperty('--mc-op', String(op))
        el.style.opacity = String(op)
      }

      const paint = (rawProgress: number) => {
        const chars = getChars()
        if (!chars.length) return
        const n = chars.length
        // Clamp only — NO ease that piles most letters into first half of scroll
        const p = rawProgress < 0 ? 0 : rawProgress > 1 ? 1 : rawProgress
        // Map 0→1 across all chars; last char fully lit only at p≈1
        // head goes from 0 to n (not n+RAMP) so we don't finish early
        const head = p * n
        for (let i = 0; i < n; i++) {
          // Each char ramps over RAMP slots of "head" travel
          let t = (head - i + RAMP * 0.15) / RAMP
          if (t < 0) t = 0
          else if (t > 1) t = 1
          // Smoothstep for softer edges
          const s = t * t * (3 - 2 * t)
          setChar(chars[i], DIM + s * (BRIGHT - DIM))
        }
        // Guarantee full bright only at true end
        if (p >= 0.995) {
          for (let i = 0; i < n; i++) setChar(chars[i], 1)
        }
        const hint = getHint()
        if (hint) hint.style.opacity = String(Math.max(0, 0.9 * (1 - p)))
      }

      /**
       * Sticky-scrub progress while the tall track is pinned in view.
       * Matches CSS sticky top (~5.75rem desktop / 4.75rem mobile).
       * Linear 0→1 over full runway — no early jump to 1.
       */
      const measureProgress = () => {
        const rect = track.getBoundingClientRect()
        const viewH = window.innerHeight
        const trackH = Math.max(1, track.offsetHeight)
        const scrollable = Math.max(1, trackH - viewH)
        const stickyTop =
          window.matchMedia('(max-width: 768px)').matches ? 76 : 92
        // 0 when track top reaches sticky offset; 1 after full track scroll
        const traveled = stickyTop - rect.top
        if (traveled <= 0) return 0
        if (traveled >= scrollable) return 1
        return traveled / scrollable
      }

      const onScroll = () => paint(measureProgress())

      const mo = new MutationObserver(() => {
        requestAnimationFrame(onScroll)
      })
      mo.observe(track, { childList: true, subtree: true, characterData: true })

      const onLang = () => {
        window.setTimeout(onScroll, 0)
        window.setTimeout(onScroll, 60)
        window.setTimeout(onScroll, 160)
      }
      window.addEventListener('nf-lang-change', onLang)

      paint(0)
      const unsub = lenis.on('scroll', onScroll) as unknown
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onScroll, { passive: true })

      // Do NOT paint(1) on partial leave — that was snapping the ending
      requestAnimationFrame(onScroll)
      window.setTimeout(onScroll, 80)
      window.setTimeout(onScroll, 400)

      return () => {
        if (typeof unsub === 'function') (unsub as () => void)()
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('resize', onScroll)
        window.removeEventListener('nf-lang-change', onLang)
        mo.disconnect()
      }
    }
    cleanups.push(setupManifesto())

    // ── data-rise: Lenis-safe scroll check + IO backup ───────────
    const setupRiseIO = () => {
      const collect = () =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-rise]')).filter(
          (el) =>
            !el.closest('header#top') && !el.closest('[data-manifesto-track]'),
        )

      const reveal = (el: HTMLElement) => {
        if (el.classList.contains('is-visible') || el.classList.contains('is-revealed')) {
          return
        }
        el.classList.add('is-visible', 'is-revealed')
        el.style.opacity = '1'
        el.style.transform = 'none'
        el.style.visibility = 'visible'
      }

      const check = () => {
        const viewH = window.innerHeight
        collect().forEach((el) => {
          if (el.classList.contains('is-visible')) return
          const r = el.getBoundingClientRect()
          // Reveal as soon as any part is reasonably in view
          if (r.top < viewH * 0.92 && r.bottom > 48) reveal(el)
        })
      }

      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) reveal(e.target as HTMLElement)
          }
        },
        { threshold: 0.01, rootMargin: '0px 0px 10% 0px' },
      )

      const observeAll = () => {
        collect().forEach((el) => {
          if (!el.classList.contains('is-visible')) io.observe(el)
        })
      }

      observeAll()
      check()

      const unsub = lenis.on('scroll', check) as unknown
      window.addEventListener('scroll', check, { passive: true })
      window.addEventListener('resize', check, { passive: true })
      window.addEventListener('nf-lang-change', () => {
        window.setTimeout(() => {
          observeAll()
          check()
        }, 80)
      })

      // After sticky track, force-check more often once past mid page
      const tCheck = window.setInterval(check, 500)

      return () => {
        if (typeof unsub === 'function') (unsub as () => void)()
        window.removeEventListener('scroll', check)
        window.removeEventListener('resize', check)
        io.disconnect()
        window.clearInterval(tCheck)
      }
    }
    cleanups.push(setupRiseIO())

    // ── Top scroll progress bar ──────────────────────────────────
    const progressBar = document.querySelector<HTMLElement>('[data-scroll-progress]')
    if (progressBar) {
      const paintBar = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
        progressBar.style.transform = `scaleX(${p})`
      }
      paintBar()
      lenis.on('scroll', paintBar)
      window.addEventListener('scroll', paintBar, { passive: true })
      window.addEventListener('resize', paintBar, { passive: true })
      cleanups.push(() => {
        window.removeEventListener('scroll', paintBar)
        window.removeEventListener('resize', paintBar)
      })
    }

    const forceShow = (el: Element) => {
      const node = el as HTMLElement
      gsap.killTweensOf(node)
      gsap.set(node, {
        autoAlpha: 1,
        y: 0,
        x: 0,
        scale: 1,
        clearProps: 'transform,filter',
      })
      node.classList.add('is-revealed')
      node.style.opacity = '1'
      node.style.visibility = 'visible'
    }

    const ctx = gsap.context(() => {
      // ── Hero ───────────────────────────────────────────────────
      const heroRises = gsap.utils.toArray<HTMLElement>('header#top .rise')
      const heroCard = document.querySelector<HTMLElement>('header#top [data-tilt]')

      gsap.set(heroRises, { autoAlpha: 0, y: 30 })
      if (heroCard) gsap.set(heroCard, { autoAlpha: 0, y: 44, scale: 0.97 })

      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.06 })
      if (heroRises.length) {
        heroTl.to(heroRises, { autoAlpha: 1, y: 0, duration: 0.72, stagger: 0.085 }, 0)
      }
      if (heroCard) {
        heroTl.to(heroCard, { autoAlpha: 1, y: 0, scale: 1, duration: 0.88 }, 0.2)
      }
      heroTl.add(() => {
        heroRises.forEach((el) => el.classList.add('is-revealed'))
        if (heroCard) heroCard.classList.add('is-revealed')
      })

      if (desktop) {
        const heroContent = document.querySelector<HTMLElement>(
          'header#top > .relative.z-10, header#top .relative.z-10',
        )
        if (heroContent) {
          gsap.to(heroContent, {
            autoAlpha: 0.55,
            y: -20,
            ease: 'none',
            scrollTrigger: {
              trigger: 'header#top',
              start: 'top top',
              end: 'bottom top',
              scrub: 0.65,
            },
          })
        }
      }

      // ── Stat count-up ──────────────────────────────────────────
      gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
        const raw = el.dataset.count ?? el.textContent ?? ''
        const m = raw.match(/^(\d+)(.*)$/)
        if (!m) return
        const target = parseInt(m[1], 10)
        const suffix = m[2]
        const counter = { v: 0 }
        el.textContent = `0${suffix}`
        ScrollTrigger.create({
          trigger: el,
          start: 'top 92%',
          once: true,
          onEnter: () => {
            gsap.to(counter, {
              v: target,
              duration: 1.4,
              ease: 'power3.out',
              onUpdate: () => {
                el.textContent = `${Math.round(counter.v)}${suffix}`
              },
            })
          },
        })
      })

      gsap.utils.toArray<HTMLElement>('.section-kicker').forEach((kicker) => {
        if (kicker.classList.contains('is-on')) return
        ScrollTrigger.create({
          trigger: kicker,
          start: 'top 92%',
          once: true,
          onEnter: () => kicker.classList.add('is-on'),
        })
      })
    })

    // ── Spotlight cards — cursor-tracked glow ────────────────────
    if (fine) {
      document.querySelectorAll<HTMLElement>('.spotlight-card').forEach((el) => {
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect()
          el.style.setProperty('--mx', `${e.clientX - r.left}px`)
          el.style.setProperty('--my', `${e.clientY - r.top}px`)
        }
        el.addEventListener('pointermove', move)
        cleanups.push(() => el.removeEventListener('pointermove', move))
      })
    }

    // ── Tilt / magnet ────────────────────────────────────────────
    if (fine && desktop) {
      document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect()
          const x = (e.clientX - r.left) / r.width - 0.5
          const y = (e.clientY - r.top) / r.height - 0.5
          gsap.to(el, {
            rotateY: x * 7,
            rotateX: -y * 5,
            transformPerspective: 1000,
            duration: 0.4,
            ease: 'power2.out',
            overwrite: 'auto',
          })
        }
        const leave = () =>
          gsap.to(el, {
            rotateX: 0,
            rotateY: 0,
            duration: 0.7,
            ease: 'power3.out',
            overwrite: 'auto',
          })
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerleave', leave)
        cleanups.push(() => {
          el.removeEventListener('pointermove', move)
          el.removeEventListener('pointerleave', leave)
        })
      })

      document
        .querySelectorAll<HTMLElement>(
          'header#top .btn-glow, #cta .btn-glow, .cta-shell .btn-glow',
        )
        .forEach((el) => {
          const move = (e: PointerEvent) => {
            const r = el.getBoundingClientRect()
            gsap.to(el, {
              x: (e.clientX - (r.left + r.width / 2)) * 0.14,
              y: (e.clientY - (r.top + r.height / 2)) * 0.16,
              duration: 0.28,
              ease: 'power2.out',
              overwrite: 'auto',
            })
          }
          const leave = () =>
            gsap.to(el, {
              x: 0,
              y: 0,
              duration: 0.45,
              ease: 'power3.out',
              overwrite: 'auto',
            })
          el.addEventListener('pointermove', move)
          el.addEventListener('pointerleave', leave)
          cleanups.push(() => {
            el.removeEventListener('pointermove', move)
            el.removeEventListener('pointerleave', leave)
          })
        })
    }

    const refresh = () => ScrollTrigger.refresh()
    const t1 = window.setTimeout(refresh, 100)
    const t2 = window.setTimeout(refresh, 600)
    window.addEventListener('load', refresh)
    document.fonts?.ready?.then(refresh).catch(() => {})

    const failsafe = window.setTimeout(() => {
      document
        .querySelectorAll<HTMLElement>(
          '[data-rise], header#top .rise, header#top .float-chip, header#top [data-tilt]',
        )
        .forEach((el) => {
          el.classList.add('is-visible', 'is-revealed')
          el.style.opacity = '1'
          el.style.transform = 'none'
          el.style.visibility = 'visible'
          const op = parseFloat(getComputedStyle(el).opacity)
          const vis = getComputedStyle(el).visibility
          if (vis === 'hidden' || Number.isNaN(op) || op < 0.5) forceShow(el)
        })
    }, 2500)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(failsafe)
      window.removeEventListener('load', refresh)
      cleanups.forEach((fn) => fn())
      ctx.revert()
      gsap.ticker.remove(onTicker)
      lenis.destroy()
      ScrollTrigger.getAll().forEach((st) => st.kill())
      root.classList.remove('js-motion', 'lenis')
    }
  }, [])

  return null
}

export default Motion
