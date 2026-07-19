/**
 * JSON-LD (schema.org) structured-data generators.
 *
 * These render as <script type="application/ld+json"> and are the canonical
 * machine-readable description of Austin and his work. Google uses them for
 * rich results; AI agents and LLM-powered recruiter tools parse them to answer
 * "who is this person, what can they do, are they available, how do I reach
 * them" — without guessing from prose.
 */
import { SITE_URL, absoluteUrl, person, skills } from './site'
import { projects } from '@/content/projects'

const PERSON_ID = `${SITE_URL}/#person`
const SITE_ID = `${SITE_URL}/#website`

/** Person — the primary entity. Availability + contact are first-class here. */
export function personSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: person.name,
    givenName: person.firstName,
    familyName: person.lastName,
    jobTitle: person.jobTitle,
    description: person.summary,
    url: SITE_URL,
    email: `mailto:${person.email}`,
    image: absoluteUrl('/opengraph-image'),
    knowsAbout: skills,
    sameAs: [person.profiles.github, person.profiles.linkedin, person.bookingUrl],
    alumniOf: {
      '@type': 'EducationalOrganization',
      name: `${person.education.degree} (graduating ${person.education.graduating})`,
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: person.location.country,
    },
    seeks: {
      '@type': 'Demand',
      name: person.availability,
    },
    workLocation: {
      '@type': 'Place',
      name: person.location.remote,
    },
  }
}

/** WebSite — enables sitelinks + names the publisher entity. */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE_URL,
    name: `${person.name} — ${person.jobTitle}`,
    description: person.headline,
    inLanguage: 'en',
    author: { '@id': PERSON_ID },
    publisher: { '@id': PERSON_ID },
  }
}

/** ProfilePage — signals to AI/search that the homepage IS the person's profile. */
export function profilePageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: SITE_URL,
    name: `${person.name} — ${person.jobTitle}`,
    mainEntity: { '@id': PERSON_ID },
    about: { '@id': PERSON_ID },
    isPartOf: { '@id': SITE_ID },
  }
}

/** One CreativeWork per project — lets AI enumerate concrete, verifiable work. */
export function projectSchema(projectId: string) {
  const project = projects.find((p) => p.id === projectId)
  if (!project) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': `${SITE_URL}${project.caseStudyUrl}#project`,
    name: project.name,
    headline: `${project.name} — ${project.category}`,
    abstract: project.tagline,
    description: project.tagline,
    url: absoluteUrl(project.caseStudyUrl),
    keywords: project.stack,
    author: { '@id': PERSON_ID },
    creator: { '@id': PERSON_ID },
    isPartOf: { '@id': SITE_ID },
  }
}

/** CollectionPage + ItemList for /work — the machine-readable project index. */
export function workCollectionSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    url: absoluteUrl('/work'),
    name: `Work — ${person.name}`,
    description: `Production systems built by ${person.name}.`,
    isPartOf: { '@id': SITE_ID },
    about: { '@id': PERSON_ID },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: projects.map((project, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: absoluteUrl(project.caseStudyUrl),
        name: project.name,
      })),
    },
  }
}

/** BreadcrumbList — helps crawlers + AI understand site hierarchy. */
export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  }
}
