'use client'

import { MdLightMode, MdDarkMode } from 'react-icons/md'
import { applyTheme, useTheme } from '@/lib/themeStore'

/** Site-wide light/dark toggle — flips [data-theme] on <html>, which every
 * --color-bg/--color-fg reference in globals.css and the light-canvas
 * sections reads from. The permanently-black bands (StatsStrip, Statement,
 * Skills, Footer) use the literal ink-black/pure-white tokens directly and
 * don't move. */
export function ThemeToggle() {
  const theme = useTheme()

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        border: '1px solid color-mix(in srgb, var(--color-fg) 14%, transparent)',
        borderRadius: '50%',
        color: 'var(--color-fg)',
        cursor: 'pointer',
        fontSize: '16px',
      }}
    >
      {theme === 'dark' ? <MdLightMode aria-hidden /> : <MdDarkMode aria-hidden />}
    </button>
  )
}
