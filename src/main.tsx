import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* いちばん外側で包み、どの画面で起きた想定外のエラーも受け止める */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
