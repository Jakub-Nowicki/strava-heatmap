import './Loader.css'

export default function Loader({ message = 'Loading...', progress = null }) {
  return (
    <div className="loader-overlay">
      <div className="loader-content">
        <div className="loader-spinner">
          <div className="spinner-ring" />
          <span className="spinner-icon">⬡</span>
        </div>
        <p className="loader-message">{message}</p>
        {progress !== null && (
          <div className="loader-progress-wrap">
            <div className="loader-progress-bar" style={{ width: `${progress}%` }} />
            <span className="loader-progress-pct">{progress}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
