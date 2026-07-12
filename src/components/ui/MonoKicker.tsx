export function MonoKicker({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-suisseintlmono)',
        fontSize: '12px',
        color: '#979797',
        letterSpacing: '-0.36px',
        lineHeight: 1.3,
      }}
    >
      {children}
    </div>
  )
}
