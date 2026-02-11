import './App.css'
import TranscriptList from './features/live-session/components/TranscriptList'

function App() {
  return (
    <div className="app-container">
      <h1>AutoTranscriber</h1>
      <div className="transcript-box">
        <TranscriptList />
      </div>
    </div>
  )
}

export default App