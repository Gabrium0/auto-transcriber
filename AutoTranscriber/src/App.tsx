import './App.css'
import TranscriptList from './features/live-session/components/TranscriptList'

function App() {
  return (
    <div className="app-container">
      {/* <h1>AutoTranscriber</h1> */}
      <svg 
        viewBox="0 0 800 200" 
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: '18%',
          height: 'auto',
          margin: '0px',
          filter: 'drop-shadow(2px 4px 6px rgb(255, 255, 255))' 
        }}
      >
        <text 
          x="50%" 
          y="50%" 
          dominantBaseline="middle" 
          textAnchor="middle" 
          fontFamily="Arial, Helvetica, sans-serif" 
          fontSize="100"
        >
          <tspan fill="#555555" fontWeight="bold">Auto</tspan>
          <tspan fill="#6173db" fontWeight="normal">Transcriber</tspan>
        </text>
      </svg>

      <div className="transcript-box">
        <TranscriptList />
      </div>
    </div>
  )
}

export default App