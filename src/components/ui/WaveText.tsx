export function WaveText({ children }: { children: string }) {
  return (
    <span className="wave-text">
      {children.split('').map((char, i) => (
        <span key={i} style={{ animationDelay: `${i * 0.035}s` }}>
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </span>
  )
}
