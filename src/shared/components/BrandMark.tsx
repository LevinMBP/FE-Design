import { useId } from 'react'

/**
 * The Venturo mark: a node-graph "M" with a violet→blue vertical gradient.
 * The gradient is in user space, so each node/edge picks up its colour from
 * its position (violet at the top, indigo mid, blue at the base) — matching
 * the source artwork. Colour comes from the gradient, not `currentColor`, so
 * it looks identical on light and dark backgrounds.
 */

// [x, y, r] on a 0–100 × 0–92 canvas.
const NODES: [number, number, number][] = [
  [20, 18, 7], // 0 top-left
  [80, 18, 7], // 1 top-right
  [37, 41, 6], // 2 mid-left
  [63, 41, 6], // 3 mid-right
  [50, 62, 6.5], // 4 centre
  [15, 76, 6.5], // 5 bottom-left
  [85, 76, 6.5], // 6 bottom-right
]

// Node index pairs that are connected by an edge.
const EDGES: [number, number][] = [
  [0, 5], [0, 4], [2, 5], [2, 4], [4, 5], // left half
  [1, 6], [1, 4], [3, 6], [3, 4], [4, 6], // right half
]

interface BrandMarkProps {
  size?: number
  className?: string
  /** When set, the mark is exposed to assistive tech with this label. */
  title?: string
}

function BrandMark({ size = 28, className, title }: BrandMarkProps) {
  const gradId = `venturo-mark-${useId().replace(/:/g, '')}`
  const paint = `url(#${gradId})`
  return (
    <svg
      className={className}
      width={size}
      height={(size * 92) / 100}
      viewBox="0 0 100 92"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient
          id={gradId}
          gradientUnits="userSpaceOnUse"
          x1="50"
          y1="12"
          x2="50"
          y2="82"
        >
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.5" stopColor="#6366f1" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>

      <g
        stroke={paint}
        strokeOpacity="0.4"
        strokeWidth="3.5"
        strokeLinecap="round"
      >
        {EDGES.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={NODES[a][0]}
            y1={NODES[a][1]}
            x2={NODES[b][0]}
            y2={NODES[b][1]}
          />
        ))}
      </g>

      <g fill={paint}>
        {NODES.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
      </g>
    </svg>
  )
}

export default BrandMark
