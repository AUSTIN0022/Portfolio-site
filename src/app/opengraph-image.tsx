import { ImageResponse } from 'next/og'

export const alt = 'Austin Makasare — Backend Engineer building systems that scale'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Dynamic social-share card. Rendered at build/request time, so link
// previews (LinkedIn, Slack, iMessage, Twitter) show a branded card
// instead of a blank thumbnail. System fonts only — ImageResponse can't
// reach the Suisse/Google web fonts, but the composition carries the brand.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#000000',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 24,
            letterSpacing: -0.5,
            color: '#979797',
            fontFamily: 'monospace',
          }}
        >
          // AUSTIN MAKASARE
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: -3,
            color: '#ffffff',
            textTransform: 'uppercase',
          }}
        >
          <span>Backend engineer</span>
          <span>
            building <span style={{ color: '#fff100' }}>systems</span>
          </span>
          <span>that scale.</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: 26,
            color: '#ffffff',
          }}
        >
          <span style={{ color: '#979797', fontFamily: 'monospace', fontSize: 22 }}>
            Queues · Locks · Distributed infrastructure
          </span>
          <span
            style={{
              background: '#d1ffca',
              color: '#000000',
              fontFamily: 'monospace',
              fontSize: 20,
              borderRadius: 48,
              padding: '8px 20px',
            }}
          >
            AVAILABLE FOR WORK
          </span>
        </div>
      </div>
    ),
    size
  )
}
