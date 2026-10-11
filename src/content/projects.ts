export interface Project {
  id: 'quizbuzz' | 'prsentinel' | 'smartformflow'
  name: string
  category: string
  tagline: string
  stack: string[]
  /** Three headline numbers, taken from the case study's own results. */
  metrics: { value: string; label: string }[]
  caseStudyUrl: string
}

export const projects: Project[] = [
  {
    id: 'quizbuzz',
    name: 'QUIZBUZZ',
    category: 'BACKEND · REAL-TIME · INFRA · 2024–2026',
    tagline:
      'Multi-tenant quiz platform load-tested to 7,500 concurrent WebSocket users against a 10K-user architecture — built solo end-to-end, from architecture to load testing.',
    stack: ['Node.js', 'TypeScript', 'Socket.IO', 'BullMQ', 'Redis', 'PostgreSQL', 'AWS', 'Terraform', 'k6'],
    metrics: [
      { value: '7,500', label: 'Peak concurrent in-quiz' },
      { value: '0', label: 'Answers scored twice' },
      { value: '24', label: 'Production bugs documented' },
    ],
    caseStudyUrl: '/work/quizbuzz',
  },
  {
    id: 'prsentinel',
    name: 'PR SENTINEL',
    category: 'AI AGENTS · GITHUB APP · 2026 · IN PROGRESS',
    tagline:
      'AI pull-request reviewer: a verified webhook queues the review, an orchestrator runs specialised agents in parallel waves with permission-scoped tools, and line comments land back on the PR.',
    stack: ['Node.js', 'TypeScript', 'Express', 'BullMQ', 'Redis', 'PostgreSQL', 'Prisma', 'Next.js', 'Vercel AI SDK'],
    metrics: [
      { value: '11', label: 'Specialised agents' },
      { value: '12×', label: 'Fewer GitHub calls' },
      { value: '7 → 68', label: 'Tests' },
    ],
    caseStudyUrl: '/work/prsentinel',
  },
  {
    id: 'smartformflow',
    name: 'SMARTFORMFLOW',
    category: 'FULLSTACK · SAAS · ASYNC · 2025–2026',
    tagline:
      'Multi-tenant event SaaS — payments, automated certificates, and WhatsApp delivery, engineered around async workers and global contact deduplication.',
    stack: ['Node.js', 'TypeScript', 'Express', 'BullMQ', 'Prisma', 'PostgreSQL', 'Next.js', 'Razorpay', 'Docker'],
    metrics: [
      { value: '25+', label: 'Database models' },
      { value: '5', label: 'Docker services' },
      { value: '0', label: 'Cross-tenant leaks' },
    ],
    caseStudyUrl: '/work/smartformflow',
  },
]
