export function AvailablePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: 'linear-gradient(180deg, #eafde3 0%, var(--color-mint-pulse) 100%)',
        color: 'var(--color-ink-black)',
        fontFamily: 'var(--font-suisseintlmono)',
        fontSize: '12px',
        borderRadius: '48px',
        padding: '4px 12px',
        letterSpacing: '-0.36px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(209,255,202,0.45)',
      }}
    >
      {children}
    </span>
  )
}
