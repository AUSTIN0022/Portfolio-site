'use client'

import { useCountUp } from '@/hooks/useCountUp'

const stats = [
  { target: 7.5, decimals: 1, suffix: 'K', label: 'PEAK CONCURRENT WS' },
  { target: 100, decimals: 0, suffix: '%', label: 'SOLO-BUILT END-TO-END' },
  { target: 2, decimals: 0, suffix: 'YR', label: 'INDUSTRY EXPERIENCE' },
]

function Stat({ target, decimals, suffix, label }: (typeof stats)[number]) {
  const { ref, display } = useCountUp(target, { decimals, suffix })
  return (
    <div className="stat-cell">
      <div
        ref={ref}
        data-gsap="stat"
        style={{
          fontFamily: 'var(--font-suisseintlcond)',
          fontWeight: 700,
          fontSize: 'var(--fs-display)',
          lineHeight: 0.9,
          letterSpacing: '-0.03em',
          color: 'var(--color-pure-white)',
        }}
      >
        {display}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-suisseintlmono)',
          fontSize: '12px',
          color: 'var(--color-steel-gray)',
          letterSpacing: '-0.36px',
          marginTop: '12px',
        }}
      >
        {label}
      </div>
    </div>
  )
}

export function StatsStrip() {
  return (
    <section
      className="surface-ambient"
      style={{ background: 'var(--color-ink-black)', padding: 'var(--section-y) var(--gutter)' }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'var(--stats-cols)',
        }}
      >
        {stats.map((stat, i) => (
          <Stat key={i} {...stat} />
        ))}
      </div>
    </section>
  )
}
