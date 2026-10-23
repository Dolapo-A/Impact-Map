import { useTheme, type ThemePreference } from '../hooks/useTheme'

const OPTIONS: Array<{ value: ThemePreference; label: string; title: string }> = [
  { value: 'system', label: 'Auto', title: "Follow your system's light or dark setting" },
  { value: 'light', label: 'Light', title: 'Always use the light palette' },
  { value: 'dark', label: 'Dark', title: 'Always use the dark palette' },
]

/**
 * The theme switch.
 *
 * Three states, because "always dark" and "whatever my machine says" are
 * different intentions and a single on/off cannot tell them apart.
 */
export function ThemeSwitcher() {
  const { preference, setTheme } = useTheme()

  return (
    <div className="theme-switcher" role="group" aria-label="Colour theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`theme-option${preference === option.value ? ' is-active' : ''}`}
          aria-pressed={preference === option.value}
          title={option.title}
          onClick={() => setTheme(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
