export type ObjectType = 'monitor' | 'forms' | 'systems' | 'backend' | 'infra'

export interface Project {
  id: string
  name: string
  category: string
  tagline: string
  stack: string[]
  objectType: ObjectType
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
    objectType: 'monitor',
    caseStudyUrl: '/work/quizbuzz',
  },
  {
    id: 'smartformflow',
    name: 'SMARTFORMFLOW',
    category: 'FULLSTACK · SAAS · ASYNC · 2025–2026',
    tagline:
      'Multi-tenant event SaaS — payments, automated certificates, and WhatsApp delivery, engineered around async workers and global contact deduplication.',
    stack: ['Node.js', 'TypeScript', 'Express', 'BullMQ', 'Prisma', 'PostgreSQL', 'Next.js', 'Razorpay', 'Docker'],
    objectType: 'forms',
    caseStudyUrl: '/work/smartformflow',
  },
]
