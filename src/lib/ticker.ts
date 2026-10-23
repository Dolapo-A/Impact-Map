/**
 * A clock for movement.
 *
 * Animation frames are the right clock for animation: they are tied to the
 * screen, so the movement matches what the reader sees. But a browser that is
 * not painting hands out very few of them, and a graph that is halfway through
 * a rearrangement would sit still until the reader came back to the window.
 * So the clock falls back to a timer once the frames stop arriving.
 *
 * The step returns true while there is more movement to do.
 */
export interface Ticker {
  start: () => void
  stop: () => void
}

/** How long to wait for a frame before assuming the page is not painting. */
const FRAME_TIMEOUT_MS = 150

export function createTicker(step: (now: number) => boolean): Ticker {
  let stopped = false
  let running = false
  let frame = 0
  let timer = 0
  let watchdog = 0
  let useTimer = false

  const clear = () => {
    cancelAnimationFrame(frame)
    clearTimeout(timer)
    clearTimeout(watchdog)
  }

  const run = (now: number) => {
    if (stopped) return
    if (step(now)) {
      schedule()
    } else {
      stopped = true
    }
  }

  const schedule = () => {
    if (stopped) return

    if (useTimer) {
      timer = window.setTimeout(() => run(performance.now()), 16)
      return
    }

    frame = requestAnimationFrame(run)
    watchdog = window.setTimeout(() => {
      if (stopped) return
      cancelAnimationFrame(frame)
      useTimer = true
      // The frame that never came is not going to come. Move on to the timer.
      schedule()
    }, FRAME_TIMEOUT_MS)
  }

  return {
    start: () => {
      if (running || stopped) return
      running = true
      schedule()
    },
    stop: () => {
      stopped = true
      running = false
      clear()
    },
  }
}
