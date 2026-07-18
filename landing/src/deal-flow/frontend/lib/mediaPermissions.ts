/**
 * Shared camera/mic access for Pitch / Proof / Connections video answers.
 * Explains *why* permission fails — browser often skips the prompt when
 * already blocked, insecure context, or Permissions-Policy denies.
 */

export type MediaAccessResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; code: string; messageVi: string; messageEn: string }

function policyAllows(feature: 'camera' | 'microphone'): boolean | null {
  try {
    // @ts-expect-error legacy + modern
    const fp = document.featurePolicy || document.permissionsPolicy
    if (fp?.allowsFeature) return !!fp.allowsFeature(feature)
  } catch {
    /* */
  }
  return null
}

async function permissionState(
  name: 'camera' | 'microphone',
): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    // Some browsers throw TypeError for camera/microphone query
    const st = await navigator.permissions?.query({
      name: name as PermissionName,
    })
    if (st?.state === 'granted' || st?.state === 'denied' || st?.state === 'prompt') {
      return st.state
    }
  } catch {
    /* Safari / Firefox quirks */
  }
  return 'unknown'
}

/**
 * Request camera + mic. Falls back to video-only if mic fails.
 * Always call from a user gesture (click).
 */
export async function requestCameraMic(
  lang: 'vi' | 'en' = 'vi',
): Promise<MediaAccessResult> {
  if (typeof window === 'undefined') {
    return {
      ok: false,
      code: 'SSR',
      messageVi: 'Chỉ chạy trên trình duyệt.',
      messageEn: 'Browser only.',
    }
  }

  if (!window.isSecureContext && location.hostname !== 'localhost') {
    return {
      ok: false,
      code: 'INSECURE',
      messageVi:
        'Camera chỉ hoạt động trên HTTPS. Mở https://nexora-flow.cloud (không dùng HTTP).',
      messageEn:
        'Camera requires HTTPS. Open https://nexora-flow.cloud (not HTTP).',
    }
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      ok: false,
      code: 'NO_API',
      messageVi:
        'Trình duyệt không hỗ trợ camera (mediaDevices). Dùng Chrome/Edge/Safari mới nhất.',
      messageEn:
        'This browser has no mediaDevices API. Use latest Chrome/Edge/Safari.',
    }
  }

  const camPolicy = policyAllows('camera')
  if (camPolicy === false) {
    return {
      ok: false,
      code: 'POLICY',
      messageVi:
        'Trang đang chặn camera (policy cũ / cache). Tải lại cứng: Cmd/Ctrl+Shift+R.',
      messageEn:
        'Page policy blocks the camera (stale cache). Hard-refresh: Cmd/Ctrl+Shift+R.',
    }
  }

  const camPerm = await permissionState('camera')
  if (camPerm === 'denied') {
    return {
      ok: false,
      code: 'DENIED_PERSISTED',
      messageVi:
        'Camera đã bị chặn trước đó — trình duyệt sẽ KHÔNG hỏi lại. Bấm biểu tượng 🔒/camera bên trái thanh địa chỉ → Cho phép Camera & Micro → Tải lại trang.',
      messageEn:
        'Camera was blocked earlier — the browser will NOT re-prompt. Click the lock/camera icon left of the URL → Allow Camera & Mic → Reload.',
    }
  }

  const videoConstraints: MediaTrackConstraints = {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
    return { ok: true, stream }
  } catch (e1: unknown) {
    const err = e1 as DOMException
    // Mic blocked but camera ok — try video only
    if (
      err?.name === 'NotAllowedError' ||
      err?.name === 'PermissionDeniedError'
    ) {
      // Already covered persisted deny; if user just clicked Deny on prompt:
      return {
        ok: false,
        code: 'USER_DENIED',
        messageVi:
          'Bạn vừa từ chối quyền camera/micro. Bấm 🔒 cạnh URL → Site settings → Allow, rồi thử lại.',
        messageEn:
          'You denied camera/mic. Click 🔒 next to the URL → Site settings → Allow, then retry.',
      }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      })
      return { ok: true, stream }
    } catch (e2: unknown) {
      const err2 = e2 as DOMException
      const name = err2?.name || 'Error'
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return {
          ok: false,
          code: 'NO_DEVICE',
          messageVi:
            'Không tìm thấy camera. Cắm webcam / cho phép app dùng camera trên macOS System Settings → Privacy.',
          messageEn:
            'No camera found. Plug in a webcam or allow camera in OS privacy settings.',
        }
      }
      if (name === 'NotReadableError' || name === 'TrackStartError') {
        return {
          ok: false,
          code: 'IN_USE',
          messageVi:
            'Camera đang được app khác dùng (Zoom/Meet). Tắt app đó rồi thử lại.',
          messageEn:
            'Camera is in use by another app (Zoom/Meet). Close it and retry.',
        }
      }
      if (name === 'SecurityError') {
        return {
          ok: false,
          code: 'SECURITY',
          messageVi:
            'Trình duyệt chặn camera (security). Dùng HTTPS và không chặn trong site settings.',
          messageEn:
            'Browser security blocked the camera. Use HTTPS and allow in site settings.',
        }
      }
      return {
        ok: false,
        code: name,
        messageVi: `Không mở được camera (${name}). ${err2?.message || ''}`.trim(),
        messageEn: `Could not open camera (${name}). ${err2?.message || ''}`.trim(),
      }
    }
  }
}

export function mediaErrorToast(
  result: Extract<MediaAccessResult, { ok: false }>,
  lang: string,
) {
  return lang === 'en' ? result.messageEn : result.messageVi
}

export function pickRecorderMime(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  for (const m of candidates) {
    if (
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported?.(m)
    ) {
      return m
    }
  }
  return 'video/webm'
}
