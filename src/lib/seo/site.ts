/**
 * Single source of truth for SEO + AISEO metadata.
 *
 * Everything a search crawler OR an AI agent (ChatGPT, Perplexity, Claude,
 * Gemini, a hiring-manager's screening bot) needs to understand this site
 * without executing JavaScript is derived from this file — page metadata,
 * JSON-LD structured data, the sitemap, robots rules, and /llms.txt.
 *
 * Keep this accurate: it is the "answer sheet" AI systems read from.
 */

export const SITE_URL = 'https://austinmakasare.site'

export const person = {
  name: 'Austin Makasare',
  firstName: 'Austin',
  lastName: 'Makasare',
  jobTitle: 'Backend Engineer',
  headline: 'Backend Engineer building production systems — queues, locks, and distributed infrastructure',
  summary:
    'Backend-focused full-stack engineer with 1.5 years of full-time production experience building backend systems, async job pipelines, and cloud infrastructure. Ships real systems solo, end-to-end — from architecture and load testing to deployment.',
  email: 'austinmakasare00@gmail.com',
  bookingUrl: 'https://cal.com/austinmakasare',
  resumeUrl: '/austin-makasare-resume.pdf',
  location: {
    country: 'India',
    remote: 'Remote preferred; open to WFO in India',
  },
  availability: 'Open to SDE-2 and senior backend engineer roles',
  education: {
    degree: 'MSc Computer Science',
    graduating: 'June–July 2026',
  },
  experienceYears: 1.5,
  profiles: {
    github: 'https://github.com/AUSTIN0022/',
    linkedin: 'https://www.linkedin.com/in/austin-makasare/',
  },
} as const

/** Ordered so the most role-relevant skills lead — helps AI ranking/extraction. */
export const skills = [
  'Node.js',
  'TypeScript',
  'Distributed Systems',
  'System Design',
  'BullMQ',
  'Redis',
  'PostgreSQL',
  'Prisma',
  'Socket.IO / WebSockets',
  'Express',
  'AWS',
  'Terraform',
  'Docker',
  'Message Queues',
  'Load Testing (k6)',
  'Next.js',
  'React',
  'CI/CD (GitHub Actions)',
]

/** Keyword set shared across pages — the terms a recruiter or AI would search. */
export const keywords = [
  'Austin Makasare',
  'Backend Engineer',
  'Backend Developer',
  'Full Stack Engineer',
  'SDE-2',
  'Senior Backend Engineer',
  'Node.js developer',
  'TypeScript developer',
  'Distributed Systems',
  'System Design',
  'Redis',
  'BullMQ',
  'PostgreSQL',
  'WebSockets',
  'AWS',
  'Terraform',
  'Software Engineer portfolio',
  'hire backend engineer',
  'remote backend engineer India',
]

/** Public routes for the sitemap. `changeFrequency`/`priority` are hints. */
export const routes = [
  { path: '/', priority: 1.0, changeFrequency: 'monthly' as const },
  { path: '/work', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/work/quizbuzz', priority: 0.8, changeFrequency: 'yearly' as const },
  { path: '/work/smartformflow', priority: 0.8, changeFrequency: 'yearly' as const },
  { path: '/now', priority: 0.7, changeFrequency: 'weekly' as const },
]

export const absoluteUrl = (path: string) =>
  path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
