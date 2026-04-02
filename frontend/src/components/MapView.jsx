import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './MapView.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const HEATMAP_LAYER = {
  id: 'runs-heat',
  type: 'heatmap',
  source: 'runs',
  paint: {
    'heatmap-weight': 0.3,
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 12, 1.8],
    'heatmap-color': [
      'interpolate', ['linear'], ['heatmap-density'],
      0,    'rgba(0,0,0,0)',
      0.1,  '#1a0a00',
      0.3,  '#7a1e00',
      0.5,  '#FC4C02',
      0.75, '#ff8c42',
      1,    '#ffffff',
    ],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 10, 4, 14, 8],
    'heatmap-opacity': 0.85,
  },
}

export default function MapView({ heatmapData, selectedCity, cities }) {
  const mapContainer = useRef(null)
  const map          = useRef(null)

  // Init map once
  useEffect(() => {
    if (map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [0, 30],
      zoom: 1.5,
      projection: 'globe',
    })

    map.current.on('load', () => {
      map.current.addSource('runs', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.current.addLayer(HEATMAP_LAYER)
    })
  }, [])

  // Update heatmap data when it changes
  useEffect(() => {
    if (!map.current || !heatmapData) return

    const update = () => {
      const src = map.current.getSource('runs')
      if (src) src.setData(heatmapData)
    }

    if (map.current.isStyleLoaded()) {
      update()
    } else {
      map.current.once('load', update)
    }
  }, [heatmapData])

  // Fly to selected city
  useEffect(() => {
    if (!map.current || !selectedCity) return

    const city = cities.find(c => c.city === selectedCity)
    if (!city?.center_lat || !city?.center_lng) return

    map.current.flyTo({
      center: [city.center_lng, city.center_lat],
      zoom: 11,
      duration: 2400,
      curve: 1.4,
      speed: 0.8,
      easing: t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2,
      essential: true,
    })
  }, [selectedCity, cities])

  // Reset to globe when deselected
  useEffect(() => {
    if (!map.current || selectedCity) return
    map.current.flyTo({ center: [0, 30], zoom: 1.5, duration: 1800 })
  }, [selectedCity])

  return <div ref={mapContainer} className="map-container" />
}
