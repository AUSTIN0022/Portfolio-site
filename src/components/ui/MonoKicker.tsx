export function MonoKicker({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={className}
      style={{
        fontFamily: 'var(--font-suisseintlmono)',
        fontSize: '12px',
        color: 'var(--color-muted-on-light)',
        letterSpacing: '-0.36px',
        lineHeight: 1.3,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
