import './Loader.css'

export default function Loader({ message = 'Loading...' }) {
  return (
    <div className="loader-overlay">
      <div className="loader-content">
        <div className="loader-spinner">
          <div className="spinner-ring" />
          <span className="spinner-icon">⬡</span>
        </div>
        <p className="loader-message">{message}</p>
      </div>
    </div>
  )
}
