import { useState } from 'react'
import './Sidebar.css'

const MONTH_LABELS = ['J','F','M','A','M','J','J','A','S','O','N','D']
const MONTH_NAMES  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function Sparkline({ monthly }) {
  if (!monthly) return null
  const { year, months } = monthly
  if (!months) return null
  const W   = 252
  const H   = 48
  const PAD = 3
  const max = Math.max(...months, 1)

  const pts = months.map((v, i) => ({
    x: PAD + (i / 11) * (W - PAD * 2),
    y: H - PAD - (v / max) * (H - PAD * 2),
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const fillPath = linePath + ` L ${pts[11].x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`

  return (
    <div className="sparkline-section">
      <div className="sparkline-header">
        <span className="section-label">MONTHLY KM</span>
        <span className="sparkline-year">{year}</span>
      </div>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="sparkline-svg"
      >
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#FC4C02" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FC4C02" stopOpacity="0"    />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#sparkFill)" />
        <path d={linePath} fill="none" stroke="#FC4C02" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => months[i] > 0 && (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill="#FC4C02" />
        ))}
      </svg>
      <div className="sparkline-labels">
        {MONTH_LABELS.map((m, i) => (
          <span key={i} className={months[i] > 0 ? 'spark-lbl-active' : ''}>{m}</span>
        ))}
      </div>
    </div>
  )
}

function RecordsStrip({ records }) {
  if (!records) return null
  const { longest_run, best_month } = records
  if (!longest_run?.distance_km && !best_month?.km) return null

  const monthName = best_month?.month ? MONTH_NAMES[best_month.month - 1] : null

  return (
    <div className="records-strip">
      {longest_run?.distance_km && (
        <div className="record-card">
          <span className="record-icon">⚡</span>
          <div className="record-body">
            <span className="record-label">LONGEST RUN</span>
            <span className="record-value">{longest_run.distance_km} km</span>
            <span className="record-sub" title={longest_run.name}>
              {longest_run.name?.length > 18
                ? longest_run.name.slice(0, 18) + '…'
                : longest_run.name}
            </span>
          </div>
        </div>
      )}
      {best_month?.km && (
        <div className="record-card">
          <span className="record-icon">📅</span>
          <div className="record-body">
            <span className="record-label">BEST MONTH</span>
            <span className="record-value">{Math.round(best_month.km)} km</span>
            <span className="record-sub">{monthName} {best_month.year}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Sidebar({
  user, stats, cities, years,
  selectedCity, selectedYear,
  records, monthly,
  onSelectCity, onSelectYear,
  onShowPrivacy, onDeleteAccount, onLogout,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  const totalKm   = stats?.total_km   ?? '—'
  const totalRuns = stats?.total_runs ?? '—'

  const verifiedCities  = cities.filter(c => c.city !== 'Unverified')
  const unverifiedEntry = cities.find(c => c.city === 'Unverified')
  const maxKm           = verifiedCities.length > 0 ? verifiedCities[0].km : 1

  function handleCityClick(city) {
    onSelectCity(selectedCity === city ? null : city)
  }

  async function handleDeleteConfirmed() {
    setDeleting(true)
    await onDeleteAccount()
    setDeleting(false)
    setConfirmDelete(false)
  }

  return (
    <aside className="sidebar">

      {/* Header */}
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">⬡</span>
          <span className="logo-text">HeatRun</span>
        </div>
        <p className="logo-sub">Running Heatmap</p>
        {user && (
          <div className="user-row">
            {user.profile && (
              <img className="user-avatar" src={user.profile} alt="" />
            )}
            <div className="user-info">
              <p className="user-name">{user.firstname} {user.lastname}</p>
              <a
                className="strava-profile-link"
                href={`https://www.strava.com/athletes/${user.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Strava ↗
              </a>
            </div>
            <button className="logout-btn" onClick={onLogout} title="Sign out">↪</button>
          </div>
        )}
      </div>

      {/* Total stats */}
      <div className="stats-row">
        <div className="stat-box">
          <span className="stat-value">{Number(totalKm).toLocaleString()}</span>
          <span className="stat-label">km total</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">{Number(totalRuns).toLocaleString()}</span>
          <span className="stat-label">runs</span>
        </div>
      </div>

      {/* Personal records */}
      <RecordsStrip records={records} />

      {/* Year filter */}
      <div className="section">
        <p className="section-label">YEAR</p>
        <div className="year-pills">
          <button
            className={`pill ${!selectedYear ? 'active' : ''}`}
            onClick={() => onSelectYear(null)}
          >All</button>
          {years.map(y => (
            <button
              key={y}
              className={`pill ${selectedYear === y ? 'active' : ''}`}
              onClick={() => onSelectYear(y)}
            >{y}</button>
          ))}
        </div>
      </div>

      {/* Monthly sparkline */}
      <Sparkline monthly={monthly} />

      {/* City list */}
      <div className="section cities-section">
        <p className="section-label">CITIES</p>
        <div className="city-list">

          {/* All cities */}
          <div
            className={`city-item ${!selectedCity ? 'active' : ''}`}
            onClick={() => onSelectCity(null)}
          >
            <div className="city-top">
              <span className="city-name">All Cities</span>
              <div className="city-right">
                <span className="city-km">{Number(totalKm).toLocaleString()} km</span>
              </div>
            </div>
            <div className="city-bar-track">
              <div className="city-bar" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Verified cities */}
          {verifiedCities.map(c => (
            <div
              key={c.city}
              className={`city-item ${selectedCity === c.city ? 'active' : ''}`}
              onClick={() => handleCityClick(c.city)}
            >
              <div className="city-top">
                <span className="city-name">{c.city}</span>
                <div className="city-right">
                  <span className="runs-badge">{c.runs}</span>
                  <span className="city-km">{Number(c.km).toLocaleString()} km</span>
                </div>
              </div>
              <div className="city-bar-track">
                <div
                  className="city-bar"
                  style={{ width: `${Math.max(2, (c.km / maxKm) * 100)}%` }}
                />
              </div>
            </div>
          ))}

          {/* Unverified entry */}
          {unverifiedEntry && (
            <div
              className={`city-item city-item-unverified ${selectedCity === 'Unverified' ? 'active' : ''}`}
              onClick={() => handleCityClick('Unverified')}
            >
              <div className="city-top">
                <div className="city-name-row">
                  <span className="unverified-icon">◌</span>
                  <span className="city-name">{unverifiedEntry.city}</span>
                </div>
                <div className="city-right">
                  <span className="runs-badge runs-badge-muted">{unverifiedEntry.runs}</span>
                  <span className="city-km">{Number(unverifiedEntry.km).toLocaleString()} km</span>
                </div>
              </div>
              <div className="city-bar-track">
                <div
                  className="city-bar city-bar-muted"
                  style={{ width: `${Math.max(2, (unverifiedEntry.km / maxKm) * 100)}%` }}
                />
              </div>
              <span className="unverified-note">GPS not recorded</span>
            </div>
          )}

        </div>
      </div>

      {/* Footer: Strava badge + links */}
      <div className="sidebar-footer">

        {/* Powered by Strava */}
        <div className="strava-badge">
          <a href="https://www.strava.com" target="_blank" rel="noopener noreferrer">
            <img src="/api_logo_pwrdBy_strava_horiz_white.svg" alt="Powered by Strava" className="strava-badge-img" />
          </a>
        </div>

        {/* Support + Privacy links */}
        <div className="footer-links">
          <a href="mailto:support@heatrun.app" className="footer-link">Support</a>
          <span className="footer-dot">·</span>
          <button className="footer-link footer-link-btn" onClick={onShowPrivacy}>Privacy Policy</button>
          <span className="footer-dot">·</span>
          <button
            className="footer-link footer-link-btn footer-link-danger"
            onClick={() => setConfirmDelete(true)}
          >
            Delete Account
          </button>
        </div>

      </div>

      {/* Delete account confirmation overlay */}
      {confirmDelete && (
        <div className="delete-overlay">
          <div className="delete-dialog">
            <p className="delete-title">Delete your account?</p>
            <p className="delete-body">
              This permanently deletes all your runs and account data from HeatRun.
              Your Strava account is not affected.
            </p>
            <div className="delete-actions">
              <button
                className="delete-cancel"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="delete-confirm"
                onClick={handleDeleteConfirmed}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}

    </aside>
  )
}
