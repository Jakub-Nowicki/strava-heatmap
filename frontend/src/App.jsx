import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import Login from './components/Login'
import Loader from './components/Loader'
import PrivacyPolicy from './components/PrivacyPolicy'

const API = 'https://strava-heatmap-production.up.railway.app'
const OPT = { credentials: 'include' }

export default function App() {
  const [user, setUser]                   = useState(undefined)
  const [stats, setStats]                 = useState(null)
  const [cities, setCities]               = useState([])
  const [years, setYears]                 = useState([])
  const [selectedCity, setSelectedCity]   = useState(null)
  const [selectedYear, setSelectedYear]   = useState(null)
  const [heatmapData, setHeatmapData]     = useState(null)
  const [records, setRecords]             = useState(null)
  const [monthly, setMonthly]             = useState(null)
  const [loadingMsg, setLoadingMsg]       = useState(null)
  const [geocodePct, setGeocodePct]       = useState(null)
  const [showPrivacy, setShowPrivacy]     = useState(false)

  // Check auth on load (or complete OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authToken = params.get('auth_token')

    if (authToken) {
      // Remove the token from the URL immediately
      window.history.replaceState({}, '', window.location.pathname)
      // Exchange the one-time token for a session cookie, then fetch user
      fetch(`${API}/auth/session?token=${authToken}`, OPT)
        .then(r => r.ok ? fetch(`${API}/api/me`, OPT) : Promise.reject())
        .then(r => r.ok ? r.json() : null)
        .then(data => setUser(data))
        .catch(() => setUser(null))
    } else {
      fetch(`${API}/api/me`, OPT)
        .then(r => r.ok ? r.json() : null)
        .then(data => setUser(data))
        .catch(() => setUser(null))
    }
  }, [])

  // Load everything once authenticated
  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  // Reload heatmap when filters change
  useEffect(() => {
    if (!user) return
    fetchHeatmap()
  }, [selectedCity, selectedYear])

  // Reload cities + stats + records + monthly when year filter changes
  useEffect(() => {
    if (!user) return
    fetchCities()
    fetchStats()
    fetchRecords()
    fetchMonthly()
  }, [selectedYear])

  function runGeocoding() {
    return new Promise(resolve => {
      const es = new EventSource(`${API}/api/geocode/stream`, { withCredentials: true })
      es.addEventListener('progress', e => {
        const d = JSON.parse(e.data)
        setGeocodePct(Math.round((d.done / d.total) * 100))
      })
      es.addEventListener('complete', () => {
        setGeocodePct(100)
        es.close()
        setTimeout(resolve, 600)
      })
      es.onerror = () => { es.close(); resolve() }
    })
  }

  async function loadAll() {
    setLoadingMsg('Syncing your runs...')
    await fetch(`${API}/api/import`, OPT).catch(() => {})

    const gcRes   = await fetch(`${API}/api/geocode/count`, OPT).catch(() => null)
    const gcCount = gcRes?.ok ? (await gcRes.json()).count : 0
    if (gcCount > 0) {
      setLoadingMsg(`Assigning cities to ${gcCount} runs...`)
      setGeocodePct(0)
      await runGeocoding()
      setGeocodePct(null)
    }

    setLoadingMsg('Loading stats...')
    await Promise.allSettled([fetchStats(), fetchCities(), fetchRecords(), fetchMonthly()])
    setLoadingMsg('Loading heatmap...')
    await fetchHeatmap().catch(() => {})
    setLoadingMsg(null)
  }

  async function fetchStats() {
    const url = selectedYear ? `${API}/api/stats?year=${selectedYear}` : `${API}/api/stats`
    const res  = await fetch(url, OPT)
    const data = await res.json()
    setStats(data)
    if (!selectedYear) setYears(Object.keys(data.km_per_year).map(Number).sort())
  }

  async function fetchCities() {
    const url = selectedYear ? `${API}/api/cities?year=${selectedYear}` : `${API}/api/cities`
    const res  = await fetch(url, OPT)
    const data = await res.json()
    setCities(data.cities || [])
  }

  async function fetchHeatmap() {
    const params = new URLSearchParams()
    if (selectedCity) params.set('city', selectedCity)
    if (selectedYear) params.set('year', selectedYear)
    const res  = await fetch(`${API}/api/heatmap?${params}`, OPT)
    const data = await res.json()
    setHeatmapData(data)
  }

  async function fetchRecords() {
    const url = selectedYear ? `${API}/api/records?year=${selectedYear}` : `${API}/api/records`
    const res  = await fetch(url, OPT)
    const data = await res.json()
    setRecords(data)
  }

  async function fetchMonthly() {
    try {
      const url = selectedYear ? `${API}/api/monthly?year=${selectedYear}` : `${API}/api/monthly`
      const res  = await fetch(url, OPT)
      if (!res.ok) return
      const data = await res.json()
      setMonthly(data)
    } catch {}
  }

  async function handleDeleteAccount() {
    const res = await fetch(`${API}/api/account`, { method: 'DELETE', ...OPT })
    if (res.ok) {
      setUser(null)
      setStats(null)
      setCities([])
      setYears([])
      setHeatmapData(null)
      setRecords(null)
      setMonthly(null)
    }
  }

  if (showPrivacy) {
    return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />
  }

  if (user === undefined) return <Loader message="Starting up..." />
  if (!user) return <Login onShowPrivacy={() => setShowPrivacy(true)} />

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {loadingMsg && <Loader message={loadingMsg} progress={geocodePct} />}
      <Sidebar
        user={user}
        stats={stats}
        cities={cities}
        years={years}
        selectedCity={selectedCity}
        selectedYear={selectedYear}
        records={records}
        monthly={monthly}
        onSelectCity={setSelectedCity}
        onSelectYear={setSelectedYear}
        onShowPrivacy={() => setShowPrivacy(true)}
        onDeleteAccount={handleDeleteAccount}
        onLogout={async () => {
          await fetch(`${API}/auth/logout`, { method: 'POST', ...OPT })
          setUser(null)
        }}
      />
      <MapView
        heatmapData={heatmapData}
        selectedCity={selectedCity}
        cities={cities}
      />
    </div>
  )
}
