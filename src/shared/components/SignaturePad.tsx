import { useEffect, useRef } from 'react'
import { Button } from 'antd'
import { Eraser } from 'lucide-react'

interface Props {
  /** PNG data URL of the signature; '' or undefined = blank pad. */
  value?: string
  onChange?: (dataUrl: string) => void
  height?: number
}

const INK = '#1f2937'

/**
 * A draw-to-sign canvas that plugs into antd forms (value/onChange contract).
 * The pad is always white with dark ink — like paper — so the captured image
 * reads correctly in both themes and when printed. Strokes are committed to
 * the form as a PNG data URL on pointer-up; Clear resets the value to ''.
 */
function SignaturePad({ value, onChange, height = 180 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  // Last data URL we emitted — lets the value-sync effect skip our own echoes.
  // Starts as null (never equal to any value) so the mount run always sizes
  // and paints the canvas.
  const exported = useRef<string | null>(null)

  const resetCanvas = () => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    const w = wrap.clientWidth
    canvas.width = w * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, height)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = INK
  }

  const drawFromDataUrl = (url: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr)
    }
    img.src = url
  }

  // Keep the raster in sync with the form value (mount, load, form reset).
  useEffect(() => {
    if ((value ?? '') === exported.current) return
    exported.current = value ?? ''
    resetCanvas()
    if (value) drawFromDataUrl(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => ({
    x: e.nativeEvent.offsetX,
    y: e.nativeEvent.offsetY,
  })

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pos(e)
    // A tap should still leave a visible dot.
    strokeTo(last.current)
  }

  const strokeTo = (p: { x: number; y: number }) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current) strokeTo(pos(e))
  }

  const onPointerUp = () => {
    if (!drawing.current) return
    drawing.current = false
    const url = canvasRef.current?.toDataURL('image/png') ?? ''
    exported.current = url
    onChange?.(url)
  }

  const clear = () => {
    resetCanvas()
    exported.current = ''
    onChange?.('')
  }

  return (
    <div ref={wrapRef}>
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height,
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: '#ffffff',
          touchAction: 'none',
          cursor: 'crosshair',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 4,
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-subtle)' }}>
          Sign inside the box
        </span>
        <Button
          type="text"
          size="small"
          icon={<Eraser size={14} />}
          disabled={!value}
          onClick={clear}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}

export default SignaturePad
