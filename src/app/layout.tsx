import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed, JetBrains_Mono, Inter } from 'next/font/google'
import { Providers } from './providers'
import { ServiceWorkerCleanup } from '@/components/util/ServiceWorkerCleanup'
import './globals.css'

const suisseCondFallback = Barlow_Condensed({
  weight: '700',
  subsets: ['latin'],
  variable: '--font-suisseintlcond-fallback',
  display: 'swap',
})

const suisseMonoFallback = JetBrains_Mono({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-suisseintlmono-fallback',
  display: 'swap',
})

const suisseFallback = Inter({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-suisseintl-fallback',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Austin Makasare — Backend Engineer',
  description:
    'Backend Engineer building production systems — queues, locks, and distributed infrastructure. Available for SDE-2 roles.',
  metadataBase: new URL('https://austinmakasare.site'),
  openGraph: {
    title: 'Austin Makasare — Backend Engineer',
    description: 'Building systems that scale.',
    url: 'https://austinmakasare.site',
    siteName: 'Austin Makasare',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Austin Makasare — Backend Engineer',
    description: 'Building systems that scale.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${suisseCondFallback.variable} ${suisseMonoFallback.variable} ${suisseFallback.variable}`}
    >
      {/* suppressHydrationWarning: browser extensions (Grammarly etc.) mutate
          <body> with data-gr-* attributes before React hydrates, which is
          otherwise reported as a hydration mismatch we can't control. */}
      <body suppressHydrationWarning>
        <ServiceWorkerCleanup />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
