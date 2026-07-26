import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Barlow_Condensed, JetBrains_Mono, Inter, Geist } from 'next/font/google'
import { Providers } from './providers'
import { ServiceWorkerCleanup } from '@/components/util/ServiceWorkerCleanup'
import FloatingShootToggleHost from '@/components/shoot/FloatingShootToggleHost'
import { JsonLd } from '@/components/seo/JsonLd'
import { personSchema, websiteSchema } from '@/lib/seo/jsonLd'
import { SITE_URL, keywords, person } from '@/lib/seo/site'
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

// Matches the reference portfolio's hero display face (Geist, at font-black
// weight) — used only for the hero's two big headline lines, not the rest
// of the site's Suisse Int'l type system.
const heroDisplay = Geist({
  weight: ['700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-hero-display',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Austin Makasare — Full-Stack Software Engineer',
    // Child pages set only their page name; this appends the brand.
    template: '%s · Austin Makasare',
  },
  description:
    'Full-Stack Software Engineer building production systems — queues, locks, and distributed infrastructure. 1.5 years of production experience. Open to SDE-2 and senior backend roles.',
  applicationName: 'Austin Makasare — Portfolio',
  authors: [{ name: person.name, url: SITE_URL }],
  creator: person.name,
  publisher: person.name,
  keywords,
  category: 'technology',
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  openGraph: {
    title: 'Austin Makasare — Backend Engineer',
    description:
      'Backend Engineer building production systems that scale — queues, locks, and distributed infrastructure. Open to SDE-2 and senior backend roles.',
    url: SITE_URL,
    siteName: 'Austin Makasare',
    locale: 'en_US',
    type: 'profile',
    firstName: person.firstName,
    lastName: person.lastName,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Austin Makasare — Full-Stack Software Engineer',
    description: 'Full-Stack Software Engineer building systems that scale.',
  },
  verification: {
    // Add the token from Google Search Console when the domain is verified:
    // google: 'your-google-site-verification-token',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${suisseCondFallback.variable} ${suisseMonoFallback.variable} ${suisseFallback.variable} ${heroDisplay.variable}`}
      suppressHydrationWarning
    >

      <body suppressHydrationWarning>

        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('theme-preference');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`}
        </Script>
        <JsonLd data={[personSchema(), websiteSchema()]} />
        <ServiceWorkerCleanup />
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <FloatingShootToggleHost />
      </body>
    </html>
  )
}
