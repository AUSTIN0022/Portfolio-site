'use client'

import { useRef, useEffect, useCallback, type CSSProperties, type ReactNode } from 'react'

interface Spark {
  x: number
  y: number
  angle: number
  startTime: number
}

interface ClickSparkProps {
  sparkColor?: string
  sparkSize?: number
  sparkRadius?: number
  sparkCount?: number
  duration?: number
  easing?: 'linear' | 'ease-in' | 'ease-in-out' | 'ease-out'
  extraScale?: number
  children?: ReactNode
}

// React Bits' ClickSpark, adapted to TypeScript. Wraps the whole app: an
// onClick at the wrapper catches every click that bubbles through it
// (links, buttons, empty space alike) and draws a short-lived burst of
// lines from the click point on a full-bleed canvas that sits above the
// content but ignores pointer events, so it never blocks a real click.
const ClickSpark = ({
  sparkColor = '#fff',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1.0,
  children,
}: ClickSparkProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sparksRef = useRef<Spark[]>([])

  // The canvas is viewport-sized and fixed, not document-sized: a canvas the
  // height of a long page (QuizBuzz is ~15 viewports) is a huge bitmap the
  // browser had to repaint on every clear.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  const easeFunc = useCallback(
    (t: number) => {
      switch (easing) {
        case 'linear':
          return t
        case 'ease-in':
          return t * t
        case 'ease-in-out':
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        default:
          return t * (2 - t)
      }
    },
    [easing]
  )

  // The loop only runs while sparks are alive — it used to clear the canvas
  // every frame forever, forcing a repaint even with nothing to draw.
  const animationIdRef = useRef(0)

  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime
        if (elapsed >= duration) {
          return false
        }

        const progress = elapsed / duration
        const eased = easeFunc(progress)

        const distance = eased * sparkRadius * extraScale
        const lineLength = sparkSize * (1 - eased)

        const x1 = spark.x + distance * Math.cos(spark.angle)
        const y1 = spark.y + distance * Math.sin(spark.angle)
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle)
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle)

        ctx.strokeStyle = sparkColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()

        return true
      })

      animationIdRef.current = sparksRef.current.length ? requestAnimationFrame(draw) : 0
    },
    [sparkColor, sparkSize, sparkRadius, duration, easeFunc, extraScale]
  )

  useEffect(() => () => cancelAnimationFrame(animationIdRef.current), [])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Decorative motion — skip spawning sparks under reduced-motion, same
    // policy the rest of the site's JS-driven animation follows.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const x = e.clientX
    const y = e.clientY

    const now = performance.now()
    const newSparks: Spark[] = Array.from({ length: sparkCount }, (_, i) => ({
      x,
      y,
      angle: (2 * Math.PI * i) / sparkCount,
      startTime: now,
    }))

    sparksRef.current.push(...newSparks)
    if (!animationIdRef.current) animationIdRef.current = requestAnimationFrame(draw)
  }

  const wrapperStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
  }

  const canvasStyle: CSSProperties = {
    display: 'block',
    userSelect: 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
  }

  return (
    <div style={wrapperStyle} onClick={handleClick}>
      <canvas ref={canvasRef} style={canvasStyle} />
      {children}
    </div>
  )
}

export default ClickSpark
