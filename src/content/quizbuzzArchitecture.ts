/**
 * Shared data behind the QuizBuzz case study's Architecture Journey and Infra
 * Scale Simulator. Lives outside those 'use client' component files (rather
 * than being defined and exported from them) because a plain data export from
 * a 'use client' module is compiled to an opaque client reference — a Server
 * Component importing it gets a stub, not the array. Kept here so both the
 * animated client components and the server-rendered crawlable text summary
 * read from one source.
 */

export type Domain = 'core' | 'infra' | 'realtime' | 'worker' | 'payment' | 'analytics'

export type NodeDef = {
  id: string
  label: string
  sub?: string
  x: number
  y: number
  w: number
  h: number
  domain: Domain
  appear: number
}

export const NODES: NodeDef[] = [
  { id: 'org', label: 'Organization', sub: 'Tenant · host', x: 800, y: 140, w: 230, h: 92, domain: 'core', appear: 0 },
  { id: 'contest', label: 'Contest', sub: 'The core entity', x: 800, y: 360, w: 280, h: 120, domain: 'core', appear: 0 },
  { id: 'questionBank', label: 'Question Bank', sub: 'Randomized pool', x: 400, y: 360, w: 240, h: 96, domain: 'core', appear: 1 },
  { id: 'participant', label: 'Participant', sub: 'Paid registration', x: 1200, y: 470, w: 240, h: 96, domain: 'core', appear: 1 },
  { id: 'payment', label: 'Payment', sub: 'Razorpay webhook', x: 1200, y: 270, w: 240, h: 96, domain: 'payment', appear: 1 },
  { id: 'gateway', label: 'Socket.IO Gateway', sub: 'EIO4 · 10k sockets', x: 800, y: 600, w: 300, h: 108, domain: 'realtime', appear: 2 },
  { id: 'liveq', label: 'Live Questions', sub: 'Synchronized delivery', x: 430, y: 610, w: 240, h: 96, domain: 'realtime', appear: 2 },
  { id: 'redis', label: 'Redis', sub: 'Live state · pub/sub', x: 800, y: 790, w: 220, h: 92, domain: 'infra', appear: 2 },
  { id: 'postgres', label: 'PostgreSQL', sub: 'Durable store', x: 430, y: 860, w: 240, h: 96, domain: 'infra', appear: 4 },
  { id: 'submission', label: 'Submission', sub: 'Locked · idempotent', x: 1200, y: 660, w: 240, h: 96, domain: 'worker', appear: 3 },
  { id: 'bullmq', label: 'BullMQ', sub: '6 queues', x: 1200, y: 830, w: 220, h: 92, domain: 'worker', appear: 3 },
  { id: 'worker', label: 'Worker', sub: 'Evaluation · certs', x: 830, y: 920, w: 240, h: 96, domain: 'worker', appear: 3 },
  { id: 'messaging', label: 'Messaging', sub: 'SMS · Email', x: 1560, y: 300, w: 210, h: 92, domain: 'analytics', appear: 5 },
  { id: 'analytics', label: 'Analytics', sub: 'Daily rollups', x: 1580, y: 480, w: 210, h: 92, domain: 'analytics', appear: 5 },
  { id: 'leaderboard', label: 'Leaderboard', sub: 'Live ranking', x: 1580, y: 660, w: 210, h: 92, domain: 'analytics', appear: 5 },
  { id: 'certificate', label: 'Certificate', sub: 'PDF → S3', x: 1560, y: 840, w: 210, h: 92, domain: 'analytics', appear: 5 },
]

export type EdgeDef = {
  from: string
  to: string
  appear: number
  animated?: boolean
  alive?: boolean
  color?: Domain
}

export const EDGES: EdgeDef[] = [
  { from: 'org', to: 'contest', appear: 0 },
  { from: 'questionBank', to: 'contest', appear: 1 },
  { from: 'payment', to: 'participant', appear: 1, animated: true, color: 'payment' },
  { from: 'participant', to: 'contest', appear: 1 },
  { from: 'participant', to: 'gateway', appear: 2, animated: true, alive: true, color: 'realtime' },
  { from: 'gateway', to: 'liveq', appear: 2, animated: true, alive: true, color: 'realtime' },
  { from: 'gateway', to: 'redis', appear: 2, animated: true, alive: true, color: 'realtime' },
  { from: 'gateway', to: 'submission', appear: 3 },
  { from: 'submission', to: 'bullmq', appear: 3, animated: true, alive: true, color: 'worker' },
  { from: 'bullmq', to: 'worker', appear: 3, animated: true, alive: true, color: 'worker' },
  { from: 'redis', to: 'bullmq', appear: 4, animated: true, alive: true, color: 'infra' },
  { from: 'worker', to: 'postgres', appear: 4 },
  { from: 'worker', to: 'leaderboard', appear: 5, animated: true, color: 'analytics' },
  { from: 'worker', to: 'certificate', appear: 5, animated: true, color: 'analytics' },
  { from: 'worker', to: 'analytics', appear: 5, animated: true, color: 'analytics' },
  { from: 'worker', to: 'messaging', appear: 5, animated: true, color: 'analytics' },
]

export type Stage = {
  key: string
  index: string
  title: string
  subtitle: string
  why?: string
  focus: { x: number; y: number; scale: number }
  active: string[] | 'ALL'
}

export const STAGES: Stage[] = [
  {
    key: 'intro',
    index: '01',
    title: 'You are looking at QuizBuzz',
    subtitle: 'Every contest begins as a single entity. Everything else grows out of it.',
    focus: { x: 800, y: 350, scale: 2.6 },
    active: ['org', 'contest'],
  },
  {
    key: 'register',
    index: '02',
    title: 'A participant joins',
    subtitle: 'Registration is paid and verified before a single question is served.',
    why: 'Money clears via the Razorpay webhook before any compute is spent — no free load on the system.',
    focus: { x: 1030, y: 380, scale: 1.5 },
    active: ['contest', 'questionBank', 'payment', 'participant'],
  },
  {
    key: 'live',
    index: '03',
    title: 'The doors open',
    subtitle: '10,000 WebSocket connections open at once, on one synchronized clock.',
    why: 'Redis holds the shared live state, so a socket survives across any server instance.',
    focus: { x: 700, y: 650, scale: 1.7 },
    active: ['participant', 'gateway', 'liveq', 'redis'],
  },
  {
    key: 'submit',
    index: '04',
    title: 'An answer is submitted',
    subtitle: 'It locks idempotently, then hands off to a background queue.',
    why: 'Heavy work runs async on BullMQ so the API stays under 100 ms during the peak.',
    focus: { x: 1050, y: 800, scale: 1.7 },
    active: ['gateway', 'submission', 'bullmq', 'worker', 'redis'],
  },
  {
    key: 'infra',
    index: '05',
    title: 'The system holds',
    subtitle: 'Redis keeps the live state and every job; Postgres makes the result durable.',
    focus: { x: 620, y: 820, scale: 1.6 },
    active: ['redis', 'bullmq', 'worker', 'postgres'],
  },
  {
    key: 'results',
    index: '06',
    title: 'Results, automatically',
    subtitle: 'One worker fans out: score, leaderboard, certificate, and messaging — per participant.',
    focus: { x: 1350, y: 560, scale: 1.4 },
    active: ['worker', 'leaderboard', 'certificate', 'analytics', 'messaging'],
  },
  {
    key: 'whole',
    index: '07',
    title: 'That’s the whole system.',
    subtitle: 'Payments, real-time, queues, workers, infrastructure — assembled in front of you.',
    focus: { x: 940, y: 540, scale: 0.8 },
    active: 'ALL',
  },
]

export const REQUEST_PATH = ['payment', 'participant', 'gateway', 'submission', 'bullmq', 'worker', 'certificate']
export const REQUEST_LABELS = [
  'registration paid ✓',
  'websocket opened',
  'answer submitted',
  'queued for evaluation',
  'worker scoring…',
  'certificate issued ✓',
]

export type Beat = {
  key: string
  index: string
  title: string
  subtitle: string
  why?: string
  mode: 'idle' | 'live'
  participants: number
  target: number
}

export const BEATS: Beat[] = [
  { key: 'idle', index: '01', title: 'Idle mode', subtitle: 'Between contests, one small instance runs everything. Near-zero cost.', why: 'A single t3.medium hosts backend, worker and a local Docker Redis — about $35/month.', mode: 'idle', participants: 0, target: 1 },
  { key: 'open', index: '02', title: 'Registration opens', subtitle: 'The first few hundred participants arrive. The load balancer comes online.', mode: 'live', participants: 800, target: 2 },
  { key: 'ramp', index: '03', title: '2,500 participants', subtitle: 'Numbers climb toward the live contest. Utilisation rises but holds.', mode: 'live', participants: 2500, target: 4 },
  { key: 'spike', index: '04', title: 'The contest goes live', subtitle: '7,000 connect at once. CPU pins past its threshold, latency balloons — under stress.', why: 'WebSocket load is memory- and IO-bound, so the crunch shows up as heap + latency, not only CPU.', mode: 'live', participants: 7000, target: 4 },
  { key: 'scale', index: '05', title: 'Auto Scaling responds', subtitle: 'CPU crosses 80%, the policy trips, and fresh t3.medium instances boot. The ALB spreads the load.', why: 'Peak demand is known in advance from registrations, so capacity is pre-warmed — not reactively chased.', mode: 'live', participants: 7000, target: 8 },
  { key: 'steady', index: '06', title: 'Steady at scale', subtitle: 'Eight instances, load balanced near 55%, latency flat — 7,500 live participants.', mode: 'live', participants: 7500, target: 8 },
  { key: 'control', index: '07', title: 'Now you drive it', subtitle: 'Take control: set the participant count, simulate a spike, kill an instance, or drop Redis — and watch it survive.', mode: 'live', participants: 5000, target: 5 },
]
