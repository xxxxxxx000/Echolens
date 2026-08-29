/**
 * Live maps: device GPS + OpenStreetMap / Nominatim / Overpass.
 * Optional Google Maps JS + Places if the user pastes an API key.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

let watchId = null;
let leafletMap = null;
let leafletMarker = null;
let googleMap = null;
let googleMarker = null;
let lastFix = null;
let lastAddress = '';
let lastPlaces = [];

export function getLastFix() {
  return lastFix;
}

export function getLastAddress() {
  return lastAddress;
}

export function getLastPlaces() {
  return lastPlaces;
}

export function getSavedGoogleKey() {
  try { return localStorage.getItem('echolens-gmaps-key') || ''; } catch { return ''; }
}

export function saveGoogleKey(key) {
  try {
    if (key) localStorage.setItem('echolens-gmaps-key', key);
    else localStorage.removeItem('echolens-gmaps-key');
  } catch { /* ignore */ }
}

export function startLocationWatch(onFix, onError) {
  // 1. Instant IP geolocation fallback so map immediately jumps to user's real city/location
  if (!lastFix) {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.latitude && data.longitude && !lastFix) {
          lastFix = {
            lat: data.latitude,
            lon: data.longitude,
            accuracy: 1200,
            city: data.city || 'Your City',
            region: data.region || '',
            heading: 0,
          };
          onFix?.(lastFix);
          updateMiniMapMarker(lastFix.lat, lastFix.lon, 0);
        }
      })
      .catch(() => {});
  }

  // 2. High-Accuracy Hardware GPS
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastFix = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading || lastFix?.heading || 0,
          speed: pos.coords.speed,
        };
        onFix?.(lastFix);
        updateMiniMapMarker(lastFix.lat, lastFix.lon, lastFix.heading);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000 }
    );

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastFix = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading || lastFix?.heading || 0,
          speed: pos.coords.speed,
        };
        onFix?.(lastFix);
        updateMiniMapMarker(lastFix.lat, lastFix.lon, lastFix.heading);
      },
      (err) => onError?.(err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }

  // 3. Real-time Compass Sensor for True Directional Orientation
  if (typeof window !== 'undefined' && window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (e) => {
      let heading = e.webkitCompassHeading;
      if (!heading && e.alpha !== null && e.alpha !== undefined) {
        heading = (360 - e.alpha) % 360;
      }
      if (heading !== null && heading !== undefined && lastFix) {
        lastFix.heading = Math.round(heading);
        updateMiniMapMarker(lastFix.lat, lastFix.lon, lastFix.heading);
      }
    }, true);
  }
}

export function stopLocationWatch() {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

export async function reverseGeocode(lat, lon) {
  const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('Address lookup failed');
  const data = await res.json();
  lastAddress = data.display_name || '';
  return data;
}

export async function nearbyPlaces(lat, lon, radius = 250) {
  const query = `[out:json][timeout:12];(node(around:${radius},${lat},${lon})[amenity];node(around:${radius},${lat},${lon})[shop];);out body 15;`;
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error('Nearby search failed');
  const data = await res.json();
  lastPlaces = (data.elements || [])
    .filter((n) => n.tags && (n.tags.name || n.tags.amenity || n.tags.shop))
    .slice(0, 10)
    .map((n) => ({
      name: n.tags.name || n.tags.amenity || n.tags.shop,
      kind: n.tags.amenity || n.tags.shop || 'place',
      lat: n.lat,
      lon: n.lon,
    }));
  return lastPlaces;
}

export function initLeafletMap(container) {
  if (typeof window.L === 'undefined' || !container) return null;
  if (leafletMap) {
    setTimeout(() => leafletMap.invalidateSize(), 80);
    return leafletMap;
  }
  const center = lastFix ? [lastFix.lat, lastFix.lon] : [20, 0];
  const zoom = lastFix ? 17 : 2;
  leafletMap = window.L.map(container, { zoomControl: true }).setView(center, zoom);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(leafletMap);
  setTimeout(() => leafletMap.invalidateSize(), 80);
  return leafletMap;
}

export function updateLeafletMarker(lat, lon) {
  if (!leafletMap || typeof window.L === 'undefined') return;
  const pos = [lat, lon];
  if (!leafletMarker) {
    leafletMarker = window.L.circleMarker(pos, {
      radius: 10,
      color: '#ffffff',
      weight: 3,
      fillColor: '#6d54e8',
      fillOpacity: 1,
    }).addTo(leafletMap);
  } else {
    leafletMarker.setLatLng(pos);
  }
  leafletMap.setView(pos, 17, { animate: true });
}

export async function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return true;
  if (!apiKey) return false;
  await new Promise((resolve, reject) => {
    const existing = document.getElementById('gmaps-sdk');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'gmaps-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
  return Boolean(window.google?.maps);
}

export function initGoogleMap(container, lat, lon) {
  if (!window.google?.maps || !container) return null;
  const center = { lat, lng: lon };
  googleMap = new window.google.maps.Map(container, {
    center,
    zoom: 17,
    disableDefaultUI: false,
    clickableIcons: true,
  });
  googleMarker = new window.google.maps.Marker({ position: center, map: googleMap, title: 'You are here' });
  return googleMap;
}

export function updateGoogleMarker(lat, lon) {
  if (!googleMap || !window.google?.maps) return;
  const pos = { lat, lng: lon };
  if (googleMarker) googleMarker.setPosition(pos);
  googleMap.setCenter(pos);
}

export async function googleNearby(lat, lon) {
  if (!googleMap || !window.google?.maps?.places) return [];
  const service = new window.google.maps.places.PlacesService(googleMap);
  return new Promise((resolve) => {
    service.nearbySearch(
      { location: { lat, lng: lon }, radius: 250, type: 'point_of_interest' },
      (results, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
          resolve([]);
          return;
        }
        lastPlaces = results.slice(0, 10).map((p) => ({
          name: p.name,
          kind: (p.types && p.types[0]) || 'place',
          lat: p.geometry?.location?.lat?.(),
          lon: p.geometry?.location?.lng?.(),
        }));
        resolve(lastPlaces);
      }
    );
  });
}

/* ── Geo utilities for AR overlay ── */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Bearing (in degrees, 0-360) from point A to point B.
 */
export function bearingFromTo(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * DEG2RAD;
  const y = Math.sin(dLon) * Math.cos(lat2 * DEG2RAD);
  const x =
    Math.cos(lat1 * DEG2RAD) * Math.sin(lat2 * DEG2RAD) -
    Math.sin(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.cos(dLon);
  return ((Math.atan2(y, x) * RAD2DEG) + 360) % 360;
}

/**
 * Haversine distance in meters between two GPS coordinates.
 */
export function distanceBetween(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── High-Reliability Direct Canvas Mini-Map Engine (Zero-Glitch, 100% Solid) ── */

const tileCache = new Map();
const activeCanvases = new Map();

function latLonToTileFraction(lat, lon, zoom) {
  const x = ((lon + 180) / 360) * Math.pow(2, zoom);
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom);
  return { x, y };
}

function getTileImage(url, onTileLoaded) {
  if (tileCache.has(url)) {
    const item = tileCache.get(url);
    if (item.loaded) return item.img;
    return null;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  tileCache.set(url, { img, loaded: false });
  img.onload = () => {
    const cached = tileCache.get(url);
    if (cached) cached.loaded = true;
    if (onTileLoaded) onTileLoaded();
  };
  img.onerror = () => {
    // Graceful fallback to CartoDB Voyager
    const fallbackUrl = url.replace('https://tile.openstreetmap.org', 'https://a.basemaps.cartocdn.com/rastertiles/voyager');
    if (!tileCache.has(fallbackUrl)) {
      const fbImg = new Image();
      fbImg.crossOrigin = 'anonymous';
      tileCache.set(fallbackUrl, { img: fbImg, loaded: false });
      fbImg.onload = () => {
        const cached = tileCache.get(fallbackUrl);
        if (cached) cached.loaded = true;
        tileCache.set(url, { img: fbImg, loaded: true });
        if (onTileLoaded) onTileLoaded();
      };
      fbImg.src = fallbackUrl;
    }
  };
  img.src = url;
  return null;
}

function renderCanvasMiniMap(canvas, lat, lon, zoom = 15, heading = 0) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const { x, y } = latLonToTileFraction(lat, lon, zoom);
  const minX = Math.floor(x) - 1;
  const maxX = Math.floor(x) + 1;
  const minY = Math.floor(y) - 1;
  const maxY = Math.floor(y) + 1;

  const tileSize = 256;

  // 3x3 Tile Grid guarantees 100% full coverage in all directions
  for (let tx = minX; tx <= maxX; tx++) {
    for (let ty = minY; ty <= maxY; ty++) {
      const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
      const img = getTileImage(tileUrl, () => renderCanvasMiniMap(canvas, lat, lon, zoom, heading));

      const px = Math.round((tx - x) * tileSize + w / 2);
      const py = Math.round((ty - y) * tileSize + h / 2);

      if (img) {
        ctx.drawImage(img, px, py, tileSize, tileSize);
      } else {
        ctx.fillStyle = '#14151b';
        ctx.fillRect(px, py, tileSize, tileSize);
      }
    }
  }

  // User location GPS Beacon with Navigation Direction Pointer
  const cx = w / 2;
  const cy = h / 2;
  const rad = ((heading || 0) * Math.PI) / 180;

  // Directional vision & movement cone
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);

  // Vision cone
  const coneGrad = ctx.createRadialGradient(0, 0, 4, 0, -32, 38);
  coneGrad.addColorStop(0, 'rgba(34, 197, 94, 0.7)');
  coneGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 36, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
  ctx.closePath();
  ctx.fillStyle = coneGrad;
  ctx.fill();

  // Navigation Direction Arrow
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(-7, -7);
  ctx.lineTo(0, -10);
  ctx.lineTo(7, -7);
  ctx.closePath();
  ctx.fillStyle = '#22c55e';
  ctx.fill();

  ctx.restore();

  // Outer aura ring
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
  ctx.fill();

  // White contrast ring
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Emerald center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e';
  ctx.fill();
}

export function initMiniMap(container, key = 'default') {
  if (!container) return null;
  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.className = 'canvas-mini-map';
  canvas.width = 250;  // 2x retina
  canvas.height = 220;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.borderRadius = '14px';
  canvas.style.objectFit = 'cover';
  container.appendChild(canvas);

  const initialLat = lastFix ? lastFix.lat : 40.7128;
  const initialLon = lastFix ? lastFix.lon : -74.0060;
  const initialHeading = lastFix ? lastFix.heading : 0;

  activeCanvases.set(key, { canvas, lat: initialLat, lon: initialLon, zoom: 15, heading: initialHeading });
  renderCanvasMiniMap(canvas, initialLat, initialLon, 15, initialHeading);

  return canvas;
}

export function updateMiniMapMarker(lat, lon, heading = 0) {
  activeCanvases.forEach((item) => {
    item.lat = lat;
    item.lon = lon;
    if (heading !== undefined) item.heading = heading;
    renderCanvasMiniMap(item.canvas, lat, lon, item.zoom || 15, item.heading || 0);
  });
}
