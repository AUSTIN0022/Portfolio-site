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
        background: active
          ? 'linear-gradient(180deg, #eafde3 0%, var(--color-mint-pulse) 100%)'
          : 'var(--color-surface-mist)',
        borderRadius: '20px',
        padding: '6px 12px',
        letterSpacing: '-0.36px',
        cursor: 'default',
        display: 'inline-block',
        boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(209,255,202,0.4)' : 'none',
        transition: 'background 0.3s var(--ease-spring), box-shadow 0.3s var(--ease-spring), transform 0.3s var(--ease-spring)',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'linear-gradient(180deg, #eafde3 0%, var(--color-mint-pulse) 100%)'
          e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(209,255,202,0.4)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--color-surface-mist)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'translateY(0)'
        }
      }}
    >
      {children}
    </span>
  )
}
