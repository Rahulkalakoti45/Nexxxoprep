import { BrowserRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { InterviewProvider } from './context/InterviewContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <InterviewProvider>
      <App />
    </InterviewProvider>
  </BrowserRouter>,
)
