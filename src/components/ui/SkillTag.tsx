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
        color: '#000000',
        background: active ? '#d1ffca' : '#f3f3f3',
        borderRadius: '20px',
        padding: '6px 12px',
        letterSpacing: '-0.36px',
        cursor: 'default',
        display: 'inline-block',
        transition: 'background 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = '#d1ffca'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = '#f3f3f3'
      }}
    >
      {children}
    </span>
  )
}
