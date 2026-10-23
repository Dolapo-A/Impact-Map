import { useState } from 'react'

import { DetailPanel } from './DetailPanel'
import { FileCard } from './FileCard'
import { MismatchNotice } from './MismatchNotice'
import { Legend } from './Legend'
import { sampleCoverage, sampleGraph, sampleTrace } from '../lib/sampleRepo'

const CARD_WIDTH = 176
const CARD_HEIGHT = 44

interface CropFile {
  path: string
  state: 'changed' | 'affected'
  coverage: 'covered' | 'uncovered'
  x: number
  y: number
}

/**
 * A crop of the tool's own interface.
 *
 * The file cards are the product's own component at its own size, and the canvas
 * around them is the product's own canvas. Nothing here is a picture of the
 * product.
 */
const CHANNEL_FILES: CropFile[] = [
  {
    path: 'src/utils/cart.ts',
    state: 'changed',
    coverage: 'covered',
    x: 24,
    y: 24,
  },
  {
    path: 'src/utils/totals.ts',
    state: 'affected',
    coverage: 'covered',
    x: 212,
    y: 24,
  },
  {
    path: 'src/utils/format.ts',
    state: 'affected',
    coverage: 'covered',
    x: 400,
    y: 24,
  },
  {
    path: 'src/api/orders.ts',
    state: 'affected',
    coverage: 'covered',
    x: 212,
    y: 132,
  },
  {
    path: 'src/domain/reservations.ts',
    state: 'affected',
    coverage: 'uncovered',
    x: 400,
    y: 132,
  },
  {
    path: 'src/state/selectors.ts',
    state: 'affected',
    coverage: 'uncovered',
    x: 24,
    y: 132,
  },
]

/** The imports between those files, drawn the way the graph draws them. */
const CHANNEL_EDGES: Array<[string, string]> = [
  ['src/utils/totals.ts', 'src/utils/cart.ts'],
  ['src/utils/format.ts', 'src/utils/cart.ts'],
  ['src/api/orders.ts', 'src/utils/cart.ts'],
  ['src/domain/reservations.ts', 'src/utils/cart.ts'],
  ['src/state/selectors.ts', 'src/utils/cart.ts'],
  ['src/state/selectors.ts', 'src/utils/format.ts'],
]

/**
 * The state worth seeing: a file that was changed and that nothing tests.
 *
 * The two files that import it are there too, because that is what the state
 * looks like in the graph — one red badge in a cluster of purple.
 */
const PAYOFF_FILES: CropFile[] = [
  {
    path: 'src/state/selectors.ts',
    state: 'changed',
    coverage: 'uncovered',
    x: 24,
    y: 78,
  },
  {
    path: 'src/components/CartBadge.tsx',
    state: 'affected',
    coverage: 'uncovered',
    x: 212,
    y: 24,
  },
  {
    path: 'src/index.ts',
    state: 'affected',
    coverage: 'uncovered',
    x: 400,
    y: 24,
  },
]

const PAYOFF_EDGES: Array<[string, string]> = [
  ['src/components/CartBadge.tsx', 'src/state/selectors.ts'],
  ['src/index.ts', 'src/state/selectors.ts'],
]

interface Crop {
  files: CropFile[]
  edges: Array<[string, string]>
  width: number
  height: number
}

function Canvas({ crop }: { crop: Crop }) {
  const byPath = new Map(crop.files.map((file) => [file.path, file]))

  return (
    <div
      className="hero-fragment-canvas-frame"
      style={
        {
          '--canvas-w': `${crop.width}px`,
          '--canvas-h': `${crop.height}px`,
        } as React.CSSProperties
      }
    >
      <div className="hero-fragment-canvas">
        <svg
          className="hero-fragment-edges"
          viewBox={`0 0 ${crop.width} ${crop.height}`}
          aria-hidden="true"
          focusable="false"
        >
          {crop.edges.map(([importer, imported]) => {
            const from = byPath.get(importer)!
            const to = byPath.get(imported)!
            return (
              <line
                key={`${importer}-${imported}`}
                x1={from.x + CARD_WIDTH / 2}
                y1={from.y + CARD_HEIGHT / 2}
                x2={to.x + CARD_WIDTH / 2}
                y2={to.y + CARD_HEIGHT / 2}
              />
            )
          })}
        </svg>

        {crop.files.map((file) => (
          <div
            key={file.path}
            className="hero-fragment-node"
            style={{ left: file.x, top: file.y }}
          >
            <FileCard
              data={{
                path: file.path,
                state: file.state,
                isTest: false,
                coverage: file.coverage,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/** The graph and its key: the two channels, shown on the real cards. */
export function GraphFragment() {
  return (
    <div className="hero-fragment" data-ui>
      <Canvas
        crop={{ files: CHANNEL_FILES, edges: CHANNEL_EDGES, width: 600, height: 200 }}
      />
      <Legend variant="inline" />
    </div>
  )
}

/** The payoff state, in the graph it happens in. */
export function PayoffFragment() {
  return (
    <div className="hero-fragment" data-ui>
      <Canvas crop={{ files: PAYOFF_FILES, edges: PAYOFF_EDGES, width: 600, height: 200 }} />
    </div>
  )
}

/**
 * The evidence: the panel that shows the chain of imports.
 *
 * It is the real panel, with the real chain from the real sample repository,
 * and the button on it works.
 */
export function EvidenceFragment() {
  const [closed, setClosed] = useState(false)
  const [marked, setMarked] = useState(false)

  if (closed) {
    return (
      <div className="hero-fragment" data-ui>
        <button
          type="button"
          className="button"
          onClick={() => setClosed(false)}
        >
          Show the chain again
        </button>
      </div>
    )
  }

  return (
    <div className="hero-fragment" data-ui>
      <DetailPanel
        path="src/state/selectors.ts"
        graph={sampleGraph()}
        traceResult={sampleTrace(['src/utils/cart.ts'])}
        coverage={sampleCoverage()}
        isChanged={marked}
        changedCount={marked ? 2 : 1}
        onToggleChanged={() => setMarked((current) => !current)}
        onClose={() => setClosed(true)}
      />
    </div>
  )
}

/**
 * The refusal: what happens when a pull request disagrees with the folder.
 *
 * The real notice, with the real files.
 */
export function MismatchFragment() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) {
    return (
      <div className="hero-fragment" data-ui>
        <button type="button" className="button" onClick={() => setDismissed(false)}>
          Show the notice again
        </button>
      </div>
    )
  }

  return (
    <div className="hero-fragment hero-fragment-wide" data-ui>
      <MismatchNotice
        outcome={{
          kind: 'partial',
          found: ['src/utils/cart.ts', 'src/state/selectors.ts'],
          missing: ['src/api/orders.ts', 'src/utils/totals.ts'],
        }}
        found={['src/utils/cart.ts', 'src/state/selectors.ts']}
        onMarkFound={() => setDismissed(true)}
        onDismiss={() => setDismissed(true)}
      />
    </div>
  )
}
