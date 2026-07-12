import Link from 'next/link'
import { MonoKicker } from '@/components/ui/MonoKicker'
import { nowData } from '@/content/now'

const rows = [
  { icon: '🏗', label: 'BUILDING', value: nowData.building },
  { icon: '📖', label: 'LEARNING', value: nowData.learning },
  { icon: '📍', label: 'STATUS', value: nowData.status },
]

export function Now() {
  return (
    <section id="now" style={{ background: '#e5e7eb', padding: 'var(--section-y) var(--gutter)' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <MonoKicker>// NOW</MonoKicker>
        <div
          style={{
            marginTop: '48px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0',
            maxWidth: '640px',
          }}
        >
          {rows.map((row, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                gap: '24px',
                padding: '24px 0',
                borderBottom: '1px solid #000000',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-suisseintlmono)',
                  fontSize: '12px',
                  color: '#444444',
                  letterSpacing: '-0.36px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>{row.icon}</span>
                <span>{row.label}</span>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-suisseintl)',
                  fontWeight: 400,
                  fontSize: '16px',
                  lineHeight: 1.33,
                  color: '#000000',
                  letterSpacing: '-0.32px',
                }}
              >
                {row.value}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '32px' }}>
          <Link
            href="/now"
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              color: '#444444',
              letterSpacing: '-0.36px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            className="hover:text-black transition-colors duration-200"
          >
            See full context →
          </Link>
        </div>
      </div>
    </section>
  )
}
