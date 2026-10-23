import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { resolveCssColors } from '../lib/css'

/**
 * The reader's choice of theme.
 *
 * `system` follows the operating system, and changes with it while the page is
 * open. `light` and `dark` pin it.
 */
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'impact-map:theme'

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Storage can be blocked outright. A theme is not worth failing over.
  }
  return 'system'
}

function applyPreference(preference: ThemePreference): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  // Removing the attribute hands the decision back to the operating system.
  if (preference === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', preference)
}

function systemScheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface ThemeValue {
  preference: ThemePreference
  /** The scheme actually in use, whichever way it was decided. */
  resolved: ResolvedTheme
  setTheme: (next: ThemePreference) => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

/**
 * The page's colours are decided in CSS through `light-dark()`, so all this has
 * to do is put one attribute on the root element. The resolved scheme is
 * reported as well, for the parts of the app that draw with a library's own
 * colours rather than the stylesheet's — the graph canvas and the volume.
 *
 * The choice is the only thing this application remembers. Nothing about the
 * repository, the analysis or the files is ever written down.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const initial = readPreference()
    // Applied here, before anything below reads a colour, because the first
    // render of the page happens before any effect has run. A part of the app
    // that draws with the stylesheet's colours — the volume — would otherwise
    // paint itself in the old theme.
    applyPreference(initial)
    return initial
  })
  const [system, setSystem] = useState<ResolvedTheme>(systemScheme)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      // Nothing to do: without storage the theme lasts for this visit only.
    }
  }, [preference])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const list = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystem(list.matches ? 'dark' : 'light')
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [])

  const setTheme = useCallback((next: ThemePreference) => {
    // Applied before the state changes, for the same reason: the page redraws
    // in the new theme, so anything that reads a colour during that redraw has
    // to find the new theme already in place.
    applyPreference(next)
    setPreference(next)
  }, [])

  const value = useMemo<ThemeValue>(
    () => ({
      preference,
      resolved: preference === 'system' ? system : preference,
      setTheme,
    }),
    [preference, setTheme, system],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside a ThemeProvider')
  return value
}

/**
 * A colour from the stylesheet.
 *
 * Some parts of the app draw with a library's own colours rather than the
 * stylesheet's — the graph canvas and the volume. This reads the value the
 * stylesheet has settled on, so those parts follow the theme without keeping a
 * second copy of the palette.
 */
export function useCssColor(name: string, fallback: string): string {
  const { resolved } = useTheme()

  return useMemo(
    () => resolveCssColors({ value: { variable: name, fallback } }).value,
    [fallback, name, resolved],
  )
}
