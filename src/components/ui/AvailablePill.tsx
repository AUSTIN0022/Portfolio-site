export function AvailablePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: '#d1ffca',
        color: '#000000',
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
