import type { IconType } from 'react-icons'
import {
  SiNodedotjs,
  SiTypescript,
  SiPostgresql,
  SiRedis,
  SiNextdotjs,
  SiPrisma,
  SiDocker,
  SiSocketdotio,
  SiTerraform,
  SiK6,
  SiExpress,
  SiRazorpay,
  SiGithubactions,
  SiSharp,
  SiZod,
  SiVitest,
} from 'react-icons/si'
import { FaAws } from 'react-icons/fa6'
import { MdApi, MdBolt, MdAccountTree, MdQueue, MdPictureAsPdf } from 'react-icons/md'

const neutralColor = 'var(--color-fg-muted)'

// Single source of truth for every tech-stack mark used across the site —
// the Hero tags, About's skill list, and the /work cards + case study
// pages all resolve icons through this same map, so a name always renders
// with the same logo everywhere it appears. Keyed by a normalized label
// (lowercased, version/suffix stripped) so "Express 5", "Prisma 7", and
// "AWS S3" resolve to the same mark as their bare product name. Everything
// here is a real brand mark except BullMQ and PDFKit (no simple-icons
// entry) and the three architecture-concept labels, which get a
// representative neutral icon instead of a logo.
const TECH_ICONS: Record<string, { Icon: IconType; color: string }> = {
  'node.js': { Icon: SiNodedotjs, color: '#339933' },
  typescript: { Icon: SiTypescript, color: '#3178C6' },
  postgresql: { Icon: SiPostgresql, color: '#4169E1' },
  redis: { Icon: SiRedis, color: '#DC382D' },
  bullmq: { Icon: MdQueue, color: neutralColor },
  'next.js': { Icon: SiNextdotjs, color: '#000000' },
  prisma: { Icon: SiPrisma, color: '#2D3748' },
  aws: { Icon: FaAws, color: '#FF9900' },
  docker: { Icon: SiDocker, color: '#2496ED' },
  'rest apis': { Icon: MdApi, color: neutralColor },
  'event-driven': { Icon: MdBolt, color: neutralColor },
  'system design': { Icon: MdAccountTree, color: neutralColor },
  'socket.io': { Icon: SiSocketdotio, color: '#010101' },
  terraform: { Icon: SiTerraform, color: '#7B42BC' },
  k6: { Icon: SiK6, color: '#7D64FF' },
  express: { Icon: SiExpress, color: '#000000' },
  razorpay: { Icon: SiRazorpay, color: '#0C2451' },
  'github actions': { Icon: SiGithubactions, color: '#2088FF' },
  pdfkit: { Icon: MdPictureAsPdf, color: neutralColor },
  sharp: { Icon: SiSharp, color: '#99CC00' },
  zod: { Icon: SiZod, color: '#3E67B1' },
  vitest: { Icon: SiVitest, color: '#6E9F18' },
}

const iconStyle = { display: 'inline-flex', marginRight: '6px', verticalAlign: '-2px' }

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+\d+$/, '') // "Express 5" -> "express", "Prisma 7" -> "prisma"
    .replace(/\s+s3$/, '') // "AWS S3" -> "aws"
    .trim()
}

/** Returns the brand-colored icon for a tech-stack label, or null if this label has no mapped mark. */
export function getTechIcon(label: string) {
  const entry = TECH_ICONS[normalizeLabel(label)]
  if (!entry) return null
  const { Icon, color } = entry
  return <Icon color={color} style={iconStyle} />
}
