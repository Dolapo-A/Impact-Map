import { useEffect, useRef } from 'react'

/**
 * Reveal a block as it comes into view.
 *
 * The parts of a section arrive in order — the heading, then the text, then the
 * picture — rather than the whole block fading in at once. The state is written
 * to the element as an attribute, so the stylesheet decides what "arrived"
 * looks like and the reduced-motion case is one rule away.
 *
 * Nothing is hidden unless the page knows it can put it back: the root element
 * carries `data-js`, and the hidden state is written only under it. If the
 * script never runs, the content is simply there.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    if (typeof IntersectionObserver === 'undefined') {
      element.dataset.revealed = 'true'
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          element.dataset.revealed = 'true'
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return ref
}
