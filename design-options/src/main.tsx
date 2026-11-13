import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'virtual:uno.css'
// `#option` is aliased by build.mjs to Option2.tsx.
import Option from '#option'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Option />
  </StrictMode>,
)
