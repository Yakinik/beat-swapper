import { render } from 'preact'

import { App } from './App'
import './global.css'

const root = document.getElementById('app')
if (root) render(<App />, root)
