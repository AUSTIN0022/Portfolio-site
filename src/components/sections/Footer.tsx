'use client'

const linkColumns = [
  {
    heading: 'Work',
    links: [
      { label: 'All Projects', href: '/work' },
      { label: 'QuizBuzz', href: '/work/quizbuzz' },
      { label: 'SmartFormFlow', href: '/work/smartformflow' },
    ],
  },
  {
    heading: 'Me',
    links: [
      { label: 'About', href: '/#about' },
      { label: 'Skills', href: '/#skills' },
      { label: 'Now', href: '/now' },
    ],
  },
  {
    heading: 'Connect',
    links: [
      { label: 'GitHub', href: 'https://github.com/AUSTIN0022/' },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/austin-makasare/' },
    ],
  },
  {
    heading: 'Get in touch',
    links: [
      { label: 'Book a Call', href: 'https://cal.com/austinmakasare' },
      { label: 'Resume', href: '/austin-makasare-resume.pdf' },
    ],
  },
]

export function Footer() {
  return (
    <footer id="contact" style={{ background: 'var(--color-ink-black)', padding: 'var(--section-y) var(--gutter) 40px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'var(--footer-cols)',
            gap: 'var(--footer-gap)',
            paddingBottom: '64px',
            borderBottom: '1px solid #222',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-suisseintl)',
                fontWeight: 500,
                fontSize: '20px',
                color: 'var(--color-pure-white)',
                marginBottom: '8px',
              }}
            >
              A·M
            </div>
            <div
              style={{
                fontFamily: 'var(--font-suisseintl)',
                fontWeight: 500,
                fontSize: '16px',
                color: 'var(--color-pure-white)',
                marginBottom: '24px',
              }}
            >
              Austin Makasare
            </div>
            <div
              style={{
                fontFamily: 'var(--font-suisseintl)',
                fontWeight: 400,
                fontSize: '14px',
                color: 'var(--color-steel-gray)',
                marginBottom: '8px',
              }}
            >
              Have questions or want to work together?
            </div>
            <div
              style={{
                fontFamily: 'var(--font-suisseintl)',
                fontWeight: 400,
                fontSize: '14px',
                color: 'var(--color-steel-gray)',
              }}
            >
              Drop a line →{' '}
              <a
                href="mailto:austinmakasare00@gmail.com"
                style={{
                  color: 'var(--color-ink-black)',
                  background: 'var(--color-mint-pulse)',
                  padding: '1px 4px',
                  borderRadius: '2px',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                austinmakasare00@gmail.com
              </a>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'var(--footer-links-cols)', gap: '32px' }}>
            {linkColumns.map((col) => (
              <div key={col.heading}>
                <div
                  style={{
                    fontFamily: 'var(--font-suisseintlmono)',
                    fontSize: '12px',
                    color: 'var(--color-muted-on-dark)',
                    letterSpacing: '-0.36px',
                    marginBottom: '16px',
                  }}
                >
                  {col.heading}
                </div>
                {col.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    style={{
                      display: 'block',
                      fontFamily: 'var(--font-suisseintl)',
                      fontWeight: 400,
                      fontSize: '14px',
                      color: 'var(--color-steel-gray)',
                      textDecoration: 'none',
                      marginBottom: '8px',
                      letterSpacing: '-0.28px',
                    }}
                    className="hover:text-white transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '24px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              color: 'var(--color-muted-on-dark)',
              letterSpacing: '-0.36px',
            }}
          >
            Austin Makasare © 2026 · All rights reserved
          </span>
          <BackToTop />
          <div style={{ display: 'flex', gap: '16px' }}>
            <a
              href="https://github.com/AUSTIN0022/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--font-suisseintlmono)',
                fontSize: '12px',
                color: 'var(--color-muted-on-dark)',
                textDecoration: 'none',
                letterSpacing: '-0.36px',
              }}
            >
              GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/austin-makasare/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--font-suisseintlmono)',
                fontSize: '12px',
                color: 'var(--color-muted-on-dark)',
                textDecoration: 'none',
                letterSpacing: '-0.36px',
              }}
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function BackToTop() {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      style={{
        fontFamily: 'var(--font-suisseintlmono)',
        fontSize: '12px',
        color: 'var(--color-muted-on-dark)',
        background: 'transparent',
        border: '1px solid var(--color-border-on-dark)',
        borderRadius: '4px',
        padding: '6px 12px',
        cursor: 'pointer',
        letterSpacing: '-0.36px',
      }}
    >
      ↑ Back to top
    </button>
  )
}
