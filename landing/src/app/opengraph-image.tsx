import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Nexora Flow — AI Deal-flow Matchmaker'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #12081f 0%, #1a1028 55%, #2a1245 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 9999,
              background: '#a78bfa',
              boxShadow: '0 0 40px #a78bfa',
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>
            NEXORA FLOW
          </div>
        </div>
        <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, maxWidth: 980 }}>
          From pitch deck to the right meeting.
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 30,
            color: '#c4b5fd',
            maxWidth: 900,
            lineHeight: 1.4,
          }}
        >
          AI deal-flow matchmaker · evidence-bound scores · humans approve
        </div>
        <div
          style={{
            marginTop: 56,
            display: 'flex',
            gap: 14,
            fontSize: 22,
            color: '#e9e4f5',
          }}
        >
          {['Deck analysis', 'Ranked partners', 'Intro drafts', 'Auto-scheduling'].map(
            (chip) => (
              <div
                key={chip}
                style={{
                  display: 'flex',
                  padding: '10px 22px',
                  borderRadius: 9999,
                  border: '1px solid rgba(167,139,250,0.5)',
                  background: 'rgba(167,139,250,0.12)',
                }}
              >
                {chip}
              </div>
            ),
          )}
        </div>
      </div>
    ),
    { ...size },
  )
}
