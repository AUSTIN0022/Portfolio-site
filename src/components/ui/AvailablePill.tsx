export function AvailablePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: 'var(--color-mint-pulse)',
        color: 'var(--color-ink-black)',
        fontFamily: 'var(--font-suisseintlmono)',
        fontSize: '12px',
        borderRadius: '48px',
        padding: '4px 12px',
        letterSpacing: '-0.36px',
      }}
    >
      {children}
    </span>
  )
}
