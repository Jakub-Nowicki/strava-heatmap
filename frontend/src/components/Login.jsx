import './Login.css'

export default function Login() {
  return (
    <div className="login-page">
      {/* Animated background blobs */}
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />

      {/* Animated route lines SVG */}
      <svg className="login-routes" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <path className="route-line route-line-1" d="M 0 400 Q 200 200 400 350 T 800 300 T 1200 400" />
        <path className="route-line route-line-2" d="M 0 500 Q 300 350 500 450 T 900 380 T 1200 500" />
        <path className="route-line route-line-3" d="M 100 600 Q 350 420 600 520 T 1000 460 T 1200 600" />
        <path className="route-line route-line-4" d="M 0 300 Q 150 180 350 260 T 700 220 T 1100 300" />
      </svg>

      <div className="login-content">
        {/* Logo */}
        <div className="login-logo">
          <span className="login-logo-icon">⬡</span>
          <span className="login-logo-text">HeatRun</span>
        </div>

        {/* Hero text */}
        <h1 className="login-headline">
          Every run.<br />Every city.
        </h1>
        <p className="login-sub">
          Connect your Strava account and see your entire running history
          as a global heatmap — organized by city, year, and distance.
        </p>

        {/* Feature pills */}
        <div className="login-features">
          <div className="login-feature">
            <span className="feature-icon">⚡</span>
            <span>Instant import</span>
          </div>
          <div className="login-feature">
            <span className="feature-icon">🗺</span>
            <span>Interactive map</span>
          </div>
          <div className="login-feature">
            <span className="feature-icon">📍</span>
            <span>City breakdown</span>
          </div>
        </div>

        {/* CTA */}
        <a href="https://strava-heatmap-production.up.railway.app/auth/login" className="strava-btn">
          <img src="/btn_strava_connect_with_orange.svg" alt="Connect with Strava" className="strava-btn-img" />
        </a>

        <p className="login-note">Your data stays private — only you can see your runs.</p>
      </div>
    </div>
  )
}
