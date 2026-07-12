import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 — Page Not Found · Austin Makasare',
}

export default function NotFound() {
  return (
    <main
      id="main-content"
      style={{
        background: '#000000',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--section-y) var(--gutter)',
      }}
    >
      <div style={{ maxWidth: '640px', width: '100%' }}>
        <div
          style={{
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '12px',
            color: '#979797',
            letterSpacing: '-0.36px',
            marginBottom: '24px',
          }}
        >
          // 404 · NOT FOUND
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-suisseintlcond)',
            fontWeight: 700,
            fontSize: 'var(--fs-display)',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color: '#ffffff',
            marginBottom: '24px',
            textWrap: 'balance',
          }}
        >
          THIS PAGE <span style={{ color: '#fff100' }}>404&apos;D</span>.
        </h1>

        <p
          style={{
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: 1.4,
            color: '#979797',
            letterSpacing: '-0.18px',
            maxWidth: '440px',
            marginBottom: '40px',
          }}
        >
          The route you followed doesn&apos;t exist — a dead link, a typo, or something that moved.
          The systems below are still up.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <Link
            href="/"
            style={{
              background: '#ffffff',
              color: '#000000',
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '4px',
              padding: '12px 24px',
              textDecoration: 'none',
              letterSpacing: '-0.28px',
            }}
          >
            Back to home
          </Link>
          <Link
            href="/work"
            style={{
              background: 'transparent',
              color: '#ffffff',
              border: '1px solid #ffffff',
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: '4px',
              padding: '12px 24px',
              textDecoration: 'none',
              letterSpacing: '-0.28px',
            }}
          >
            View work →
          </Link>
        </div>
      </div>
    </main>
  )
}
