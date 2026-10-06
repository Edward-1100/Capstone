import { useEffect, useState } from 'react'

function App() {
  const [status, setStatus] = useState('loadin\'')

  useEffect(() => {
    fetch('/api/health').then((res) => res.json()).then((data) => setStatus(data.status)).catch(() => setStatus('Counldn\'t Reach Backend'))
  }, [])

  return (
    <div>
      <h1>Worldbuilder</h1>
      <p>Backend: {status}</p>
    </div>
  )
}

export default App
