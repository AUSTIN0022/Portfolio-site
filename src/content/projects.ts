import type { ObjectType } from '@/components/three/ProjectObject'

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
      'Multi-tenant quiz platform scaled to 10,000 concurrent WebSocket users — built solo end-to-end, from architecture to load testing.',
    stack: ['Node.js', 'TypeScript', 'Socket.IO', 'BullMQ', 'Redis', 'PostgreSQL', 'AWS', 'Terraform', 'k6'],
    objectType: 'monitor',
    caseStudyUrl: '/work/quizbuzz',
  },
  {
    id: 'smartformflow',
    name: 'SMARTFORMFLOW',
    category: 'FULLSTACK · SAAS · ASYNC · 2025–2026',
    tagline:
      'Google Forms Pro — dynamic form builder with payments, automated certificates, WhatsApp messaging, and global contact deduplication.',
    stack: ['Node.js', 'TypeScript', 'Express', 'BullMQ', 'Prisma', 'PostgreSQL', 'Next.js', 'Razorpay', 'Docker'],
    objectType: 'forms',
    caseStudyUrl: '/work/smartformflow',
  },
]
