export function CtaTiles() {
  return (
    <section style={{ background: 'var(--color-pure-white)' }}>
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'var(--cta-cols)',
        }}
      >
        <a
          href="https://cal.com/austinmakasare"
          target="_blank"
          rel="noopener noreferrer"
          className="cta-tile"
          style={{
            display: 'block',
            padding: 'clamp(48px, 8vw, 80px) var(--gutter)',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          <span className="cta-tile-fill" />
          <div
            className="cta-tile-content cta-tile-head"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-suisseintlcond)',
                fontWeight: 700,
                fontSize: 'var(--fs-display-lg)',
                lineHeight: 0.9,
                letterSpacing: '-0.03em',
                color: 'var(--color-ink-black)',
              }}
            >
              BOOK A CALL
            </h2>
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '1px solid var(--color-ink-black)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}
            >
              ↗
            </div>
          </div>
          <p
            className="cta-tile-content"
            style={{
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 400,
              fontSize: '14px',
              lineHeight: 1.3,
              color: 'var(--color-graphite)',
              letterSpacing: '-0.28px',
            }}
          >
            Let&apos;s talk. Book a 30-minute intro to explore working together.
          </p>
        </a>

        <a
          href="/austin-makasare-resume.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="cta-tile"
          style={{ display: 'block', padding: 'clamp(48px, 8vw, 80px) var(--gutter)', textDecoration: 'none', cursor: 'pointer' }}
        >
          <span className="cta-tile-fill" />
          <div
            className="cta-tile-content cta-tile-head"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-suisseintlcond)',
                fontWeight: 700,
                fontSize: 'var(--fs-display-lg)',
                lineHeight: 0.9,
                letterSpacing: '-0.03em',
                color: 'var(--color-ink-black)',
              }}
            >
              VIEW RESUME
            </h2>
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '1px solid var(--color-ink-black)',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}
            >
              ↗
            </div>
          </div>
          <p
            className="cta-tile-content"
            style={{
              fontFamily: 'var(--font-suisseintl)',
              fontWeight: 400,
              fontSize: '14px',
              lineHeight: 1.3,
              color: 'var(--color-graphite)',
              letterSpacing: '-0.28px',
            }}
          >
            Download my full resume — experience, projects, and education.
          </p>
        </a>
      </div>
    </section>
  )
}
