export function AvailablePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        background: 'var(--color-chip-bg)',
        color: 'var(--color-fg)',
        fontFamily: 'var(--font-suisseintlmono)',
        fontSize: '12px',
        borderRadius: '48px',
        padding: '4px 12px 4px 10px',
        letterSpacing: '-0.36px',
      }}
    >
      <span
        aria-hidden
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: 'var(--color-green)',
          boxShadow: '0 0 0 3px rgba(68, 248, 122, 0.18)',
          flexShrink: 0,
        }}
      />
      {children}
    </span>
  )
}
