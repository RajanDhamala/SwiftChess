import DemoApp from './demo/DemoApp'
import LandingPage from './Pages/LandingPage'

function App() {
  const path = window.location.pathname

  if (path === '/npm-test' || path === '/nm-test') {
    return <DemoApp />
  }

  return <LandingPage />
}

export default App
