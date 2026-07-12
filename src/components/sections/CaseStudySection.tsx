interface CaseStudySectionProps {
  id: string
  kicker: string
  heading: string
  children: React.ReactNode
}

export function CaseStudySection({ id, kicker, heading, children }: CaseStudySectionProps) {
  return (
    <section id={id} data-section style={{ marginBottom: '96px', scrollMarginTop: '80px' }}>
      <div
        style={{
          fontFamily: 'var(--font-suisseintlmono)',
          fontSize: '12px',
          color: '#979797',
          letterSpacing: '-0.36px',
          marginBottom: '12px',
        }}
      >
        {kicker}
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-suisseintlcond)',
          fontWeight: 700,
          fontSize: 'var(--fs-display-md)',
          lineHeight: 0.9,
          letterSpacing: '-0.03em',
          color: '#000000',
          marginBottom: '40px',
          textWrap: 'balance',
        }}
      >
        {heading}
      </h2>
      {children}
    </section>
  )
}
