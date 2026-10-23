/**
 * Reading a colour out of the stylesheet.
 *
 * A custom property can hold a function rather than a colour. `light-dark()`
 * does exactly that, and the browser only turns it into a colour when something
 * uses it — so asking for the property's value gives back the token stream, not
 * a colour that can be painted.
 *
 * Anything outside CSS needs the resolved value: the volume paints with the
 * three-dimensional library's own colour handling, and the graph canvas sets
 * the fill on an SVG element. Both are handed a real colour here.
 */

export interface ColourToken {
  /** The custom property to read. */
  variable: string
  /** Used when the property is missing. */
  fallback: string
}

/**
 * Resolve a set of custom properties to colours.
 *
 * One element is used to resolve all of them, so a page that reads the whole
 * palette does not leave a trail of probes behind it.
 */
export function resolveCssColors<T extends Record<string, ColourToken>>(
  tokens: T,
): { [K in keyof T]: string } {
  if (typeof document === 'undefined' || !document.body) {
    const empty = {} as { [K in keyof T]: string }
    for (const key of Object.keys(tokens) as Array<keyof T>) empty[key] = tokens[key].fallback
    return empty
  }

  const styles = getComputedStyle(document.documentElement)

  const probe = document.createElement('span')
  probe.style.display = 'none'
  document.body.appendChild(probe)

  const resolved = {} as { [K in keyof T]: string }

  for (const key of Object.keys(tokens) as Array<keyof T>) {
    const { variable, fallback } = tokens[key]
    const raw = styles.getPropertyValue(variable).trim()
    if (raw.length === 0) {
      resolved[key] = fallback
      continue
    }

    probe.style.color = `var(${variable})`
    const value = getComputedStyle(probe).color.trim()
    resolved[key] = value.length > 0 ? value : fallback
  }

  probe.remove()
  return resolved
}
