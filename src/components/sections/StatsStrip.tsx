const stats = [
  { number: '7.5K', label: 'PEAK CONCURRENT WS' },
  { number: '100%', label: 'SOLO-BUILT END-TO-END' },
  { number: '2YR', label: 'INDUSTRY EXPERIENCE' },
]

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
          <div key={i} className="stat-cell">
            <div
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
              {stat.number}
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
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
