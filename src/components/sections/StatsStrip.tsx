const stats = [
  { number: '10K+', label: 'CONCURRENT USERS' },
  { number: '2', label: 'PRODUCTION SYSTEMS' },
  { number: '1.5YR', label: 'INDUSTRY EXPERIENCE' },
]

export function StatsStrip() {
  return (
    <section style={{ background: 'var(--color-ink-black)', padding: 'var(--section-y) var(--gutter)' }}>
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
