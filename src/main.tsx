import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { ThemeProvider } from './hooks/useTheme'
// `@xyflow/react/dist/style.css` — the subpath is the only one the package exports
// for the full stylesheet. It must be imported as a module (via the package name),
// not as a raw path into `node_modules/`: a raw path bypasses Vite's module
// pipeline, so the request falls through to the HTML fallback and the stylesheet
// never loads. Without it React Flow's edges pane stays 0x0, and every edge is
// drawn ~69px above where its node actually sits.
//
// It is imported before the app's own stylesheets on purpose: the library's
// rules are the floor, and this project's rules are the ones that get to
// override them.
import '@xyflow/react/dist/style.css'
import './styles/theme.css'
import './styles/hero.css'
import './styles/app.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

// The page hides parts of itself until they scroll into view. This marker says
// the script is running, so that hiding is allowed; without it everything is
// simply there.
document.documentElement.dataset.js = 'true'

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
