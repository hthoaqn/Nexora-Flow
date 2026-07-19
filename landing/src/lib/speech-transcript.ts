/**
 * Browser speech-to-text via Web Speech API (Chrome/Edge/Safari).
 * Used while recording pitch / interview video to produce a transcript
 * without uploading audio to a separate STT service.
 */

export type SpeechRecognitionHandle = {
  stop: () => void
  abort: () => void
}

function getRecognitionCtor(): (new () => any) | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function isSpeechRecognitionSupported() {
  return !!getRecognitionCtor()
}

/**
 * Start continuous speech recognition.
 * Returns handle to stop; final transcript via onFinal / onUpdate.
 */
export function startSpeechTranscript(opts: {
  lang?: 'vi' | 'en'
  onUpdate?: (partial: string, finalSoFar: string) => void
  onError?: (message: string) => void
}): SpeechRecognitionHandle | null {
  const Ctor = getRecognitionCtor()
  if (!Ctor) {
    opts.onError?.(
      opts.lang === 'en'
        ? 'Speech recognition not supported in this browser (try Chrome).'
        : 'Trình duyệt không hỗ trợ nhận dạng giọng nói (thử Chrome).',
    )
    return null
  }

  const rec = new Ctor()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = opts.lang === 'en' ? 'en-US' : 'vi-VN'
  rec.maxAlternatives = 1

  let finalText = ''

  rec.onresult = (event: any) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const r = event.results[i]
      const t = String(r[0]?.transcript || '')
      if (r.isFinal) {
        finalText = `${finalText} ${t}`.replace(/\s+/g, ' ').trim()
      } else {
        interim += t
      }
    }
    opts.onUpdate?.(interim, finalText)
  }

  rec.onerror = (ev: any) => {
    const code = String(ev?.error || '')
    // 'no-speech' / 'aborted' are common — don't hard-fail the pitch
    if (code === 'not-allowed') {
      opts.onError?.(
        opts.lang === 'en'
          ? 'Microphone blocked for speech recognition.'
          : 'Micro bị chặn cho nhận dạng giọng nói.',
      )
    }
  }

  try {
    rec.start()
  } catch {
    /* already started */
  }

  return {
    stop: () => {
      try {
        rec.stop()
      } catch {
        /* */
      }
    },
    abort: () => {
      try {
        rec.abort()
      } catch {
        /* */
      }
    },
  }
}
