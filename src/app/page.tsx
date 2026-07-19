'use client'

import { Nav } from '@/components/nav/Nav'
import { Hero } from '@/components/sections/Hero'
import { StatsStrip } from '@/components/sections/StatsStrip'
import { About } from '@/components/sections/About'
import { Principles } from '@/components/sections/Principles'
import { Work } from '@/components/sections/Work'
import { Skills } from '@/components/sections/Skills'
import { Now } from '@/components/sections/Now'
import { CtaTiles } from '@/components/sections/CtaTiles'
import { Footer } from '@/components/sections/Footer'
import { CurvedRise } from '@/components/ui/CurvedRise'
import { useScrollAnimation } from '@/hooks/useScrollAnimation'
import { JsonLd } from '@/components/seo/JsonLd'
import { profilePageSchema } from '@/lib/seo/jsonLd'

export default function Home() {
  useScrollAnimation()

  return (
    <>
      <JsonLd data={profilePageSchema()} />
      <Nav />
      <main id="main-content">
        <Hero />
        <CurvedRise>
          <StatsStrip />
        </CurvedRise>
        <About />
        <Principles />
        <Work />
        <CurvedRise>
          <Skills />
        </CurvedRise>
        <Now />
        <CtaTiles />
      </main>
      <Footer />
    </>
  )
}
