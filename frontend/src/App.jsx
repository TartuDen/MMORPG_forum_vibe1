import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="container">
        <h1>MMO/RPG Game Community Forum</h1>
        <p>Welcome to the forum</p>
        <button onClick={() => setCount((count) => count + 1)}>
          Count: {count}
        </button>
      </div>
    </>
  )
}

export default App
