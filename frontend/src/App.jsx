import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import Login from './components/Login'
import Loader from './components/Loader'

const API = 'https://strava-heatmap-production.up.railway.app'

export default function App() {
  const [user, setUser]               = useState(undefined)
  const [stats, setStats]             = useState(null)
  const [cities, setCities]           = useState([])
  const [years, setYears]             = useState([])
  const [selectedCity, setSelectedCity]   = useState(null)
  const [selectedYear, setSelectedYear]   = useState(null)
  const [heatmapData, setHeatmapData]     = useState(null)
  const [records, setRecords]             = useState(null)
  const [monthly, setMonthly]             = useState(null)
  const [loadingMsg, setLoadingMsg]       = useState(null)

  // Check auth on load
  useEffect(() => {
    fetch(`${API}/api/me`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setUser(data))
      .catch(() => setUser(null))
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

  async function loadAll() {
    setLoadingMsg('Syncing your runs...')
    await fetch(`${API}/api/import`).catch(() => {})
    setLoadingMsg('Loading stats...')
    await Promise.allSettled([fetchStats(), fetchCities(), fetchRecords(), fetchMonthly()])
    setLoadingMsg('Loading heatmap...')
    await fetchHeatmap().catch(() => {})
    setLoadingMsg(null)
  }

  async function fetchStats() {
    const url = selectedYear
      ? `${API}/api/stats?year=${selectedYear}`
      : `${API}/api/stats`
    const res  = await fetch(url)
    const data = await res.json()
    setStats(data)
    if (!selectedYear) {
      setYears(Object.keys(data.km_per_year).map(Number).sort())
    }
  }

  async function fetchCities() {
    const url = selectedYear
      ? `${API}/api/cities?year=${selectedYear}`
      : `${API}/api/cities`
    const res  = await fetch(url)
    const data = await res.json()
    setCities(data.cities || [])
  }

  async function fetchHeatmap() {
    const params = new URLSearchParams()
    if (selectedCity) params.set('city', selectedCity)
    if (selectedYear) params.set('year', selectedYear)
    const res  = await fetch(`${API}/api/heatmap?${params}`)
    const data = await res.json()
    setHeatmapData(data)
  }

  async function fetchRecords() {
    const url = selectedYear
      ? `${API}/api/records?year=${selectedYear}`
      : `${API}/api/records`
    const res  = await fetch(url)
    const data = await res.json()
    setRecords(data)
  }

  async function fetchMonthly() {
    try {
      const url = selectedYear
        ? `${API}/api/monthly?year=${selectedYear}`
        : `${API}/api/monthly`
      const res  = await fetch(url)
      if (!res.ok) return
      const data = await res.json()
      setMonthly(data)
    } catch {}
  }

  if (user === undefined) return <Loader message="Starting up..." />
  if (!user) return <Login />

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {loadingMsg && <Loader message={loadingMsg} />}
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
        onLogout={async () => {
          await fetch(`${API}/auth/logout`, { method: 'POST' })
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
