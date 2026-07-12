// Body paragraph
export function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-suisseintl)',
        fontWeight: 400,
        fontSize: '16px',
        lineHeight: 1.6,
        color: '#000000',
        letterSpacing: '-0.32px',
        marginBottom: '20px',
      }}
    >
      {children}
    </p>
  )
}

// Lead paragraph (slightly larger, used for section intros)
export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-suisseintl)',
        fontWeight: 400,
        fontSize: '20px',
        lineHeight: 1.4,
        color: '#000000',
        letterSpacing: '-0.22px',
        marginBottom: '32px',
      }}
    >
      {children}
    </p>
  )
}

// A single decision/insight callout — white card
export function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: '32px',
        marginBottom: '24px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-suisseintlmono)',
          fontSize: '12px',
          color: '#979797',
          letterSpacing: '-0.36px',
          marginBottom: '12px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-suisseintl)',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: 1.5,
          color: '#000000',
          letterSpacing: '-0.32px',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// Metric stat — large condensed number + label below, used in Results section
export function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <div
        style={{
          fontFamily: 'var(--font-suisseintlcond)',
          fontWeight: 700,
          fontSize: 'var(--fs-display-lg)',
          lineHeight: 0.9,
          letterSpacing: '-0.03em',
          color: '#000000',
          marginBottom: '8px',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-suisseintlmono)',
          fontSize: '12px',
          color: '#979797',
          letterSpacing: '-0.36px',
        }}
      >
        {label}
      </div>
    </div>
  )
}

// A three-column metric grid wrapper
export function MetricGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'clamp(24px, 4vw, 48px)',
        background: '#ffffff',
        borderRadius: '24px',
        padding: 'clamp(28px, 5vw, 48px)',
        marginBottom: '40px',
      }}
    >
      {children}
    </div>
  )
}

// A decision card — the "problem → approach → outcome" pattern
export function DecisionCard({
  number,
  problem,
  approach,
  outcome,
  shipped,
}: {
  number: number
  problem: string
  approach: string
  outcome: string
  shipped: boolean
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '24px',
        padding: '32px',
        marginBottom: '24px',
        display: 'grid',
        gridTemplateColumns: '48px 1fr',
        gap: '24px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-suisseintlcond)',
          fontWeight: 700,
          fontSize: '48px',
          lineHeight: 0.9,
          color: '#e5e7eb',
          letterSpacing: '-1.44px',
        }}
      >
        {String(number).padStart(2, '0')}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span
            style={{
              fontFamily: 'var(--font-suisseintlmono)',
              fontSize: '12px',
              color: shipped ? '#000000' : '#979797',
              background: shipped ? '#d1ffca' : '#f3f3f3',
              borderRadius: '20px',
              padding: '3px 10px',
              letterSpacing: '-0.36px',
            }}
          >
            {shipped ? 'SHIPPED' : 'DESIGNED'}
          </span>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '12px',
            color: '#979797',
            letterSpacing: '-0.36px',
            marginBottom: '6px',
          }}
        >
          PROBLEM
        </div>
        <p
          style={{
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 500,
            fontSize: '16px',
            lineHeight: 1.4,
            color: '#000000',
            letterSpacing: '-0.32px',
            marginBottom: '20px',
          }}
        >
          {problem}
        </p>
        <div
          style={{
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '12px',
            color: '#979797',
            letterSpacing: '-0.36px',
            marginBottom: '6px',
          }}
        >
          APPROACH
        </div>
        <p
          style={{
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 400,
            fontSize: '15px',
            lineHeight: 1.5,
            color: '#444444',
            letterSpacing: '-0.32px',
            marginBottom: '20px',
          }}
        >
          {approach}
        </p>
        <div
          style={{
            fontFamily: 'var(--font-suisseintlmono)',
            fontSize: '12px',
            color: '#979797',
            letterSpacing: '-0.36px',
            marginBottom: '6px',
          }}
        >
          OUTCOME
        </div>
        <p
          style={{
            fontFamily: 'var(--font-suisseintl)',
            fontWeight: 400,
            fontSize: '15px',
            lineHeight: 1.5,
            color: '#444444',
            letterSpacing: '-0.32px',
          }}
        >
          {outcome}
        </p>
      </div>
    </div>
  )
}
