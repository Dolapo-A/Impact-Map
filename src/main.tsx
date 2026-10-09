import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import './styles/theme.css'
import './styles/app.css'
// `@xyflow/react/dist/style.css` — the subpath is the only one the package exports
// for the full stylesheet. It must be imported as a module (via the package name),
// not as a raw path into `node_modules/`: a raw path bypasses Vite's module
// pipeline, so the request falls through to the HTML fallback and the stylesheet
// never loads. Without it React Flow's edges pane stays 0x0, and every edge is
// drawn ~69px above where its node actually sits.
import '@xyflow/react/dist/style.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)