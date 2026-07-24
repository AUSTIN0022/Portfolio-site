export function Statement() {
  return (
    <section
      className="surface-ambient"
      aria-label="Principles are cheap, here's the proof"
      style={{
        background: 'var(--color-ink-black)',
        padding: 'var(--section-y) var(--gutter)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <p
        data-gsap="heading"
        style={{
          fontFamily: 'var(--font-suisseintlcond)',
          fontWeight: 700,
          fontSize: 'var(--fs-display-lg)',
          lineHeight: 0.9,
          letterSpacing: '-0.03em',
          color: 'var(--color-pure-white)',
          maxWidth: '960px',
          textWrap: 'balance',
        }}
      >
        PRINCIPLES ARE CHEAP. HERE&apos;S THE PROOF.
      </p>
    </section>
  )
}
