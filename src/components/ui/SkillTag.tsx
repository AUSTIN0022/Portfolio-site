'use client'

export function SkillTag({
  children,
  active = false,
}: {
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-suisseintlmono)',
        fontSize: '12px',
        color: 'var(--color-ink-black)',
        background: active ? 'var(--color-mint-pulse)' : 'var(--color-surface-mist)',
        borderRadius: '20px',
        padding: '6px 12px',
        letterSpacing: '-0.36px',
        cursor: 'default',
        display: 'inline-block',
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--color-mint-pulse)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--color-surface-mist)'
      }}
    >
      {children}
    </span>
  )
}
