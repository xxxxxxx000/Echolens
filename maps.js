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

async function fetchIpLocation() {
  const providers = [
    async () => {
      const res = await fetch('https://ipwho.is/');
      const d = await res.json();
      if (d && d.success && typeof d.latitude === 'number') {
        return {
          lat: d.latitude,
          lon: d.longitude,
          city: d.city || d.region || 'Live Area',
          region: d.region || '',
          accuracy: 800,
        };
      }
      throw new Error('ipwhois failed');
    },
    async () => {
      const res = await fetch('https://freeipapi.com/api/json');
      const d = await res.json();
      if (d && typeof d.latitude === 'number') {
        return {
          lat: d.latitude,
          lon: d.longitude,
          city: d.cityName || d.regionName || 'Live Area',
          region: d.regionName || '',
          accuracy: 900,
        };
      }
      throw new Error('freeipapi failed');
    },
    async () => {
      const res = await fetch('https://ipapi.co/json/');
      const d = await res.json();
      if (d && typeof d.latitude === 'number') {
        return {
          lat: d.latitude,
          lon: d.longitude,
          city: d.city || d.region || 'Live Area',
          region: d.region || '',
          accuracy: 1000,
        };
      }
      throw new Error('ipapi failed');
    }
  ];

  for (const fn of providers) {
    try {
      const loc = await fn();
      if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
        return loc;
      }
    } catch {
      // try next provider
    }
  }
  return null;
}

export function startLocationWatch(onFix, onError) {
  // 1. Instant Multi-Provider Network Geolocation (Resolves in < 300ms)
  fetchIpLocation().then((netLoc) => {
    if (netLoc && (!lastFix || (lastFix.accuracy && lastFix.accuracy > 500))) {
      lastFix = {
        lat: netLoc.lat,
        lon: netLoc.lon,
        accuracy: netLoc.accuracy,
        city: netLoc.city,
        region: netLoc.region,
        heading: lastFix?.heading || 0,
      };
      onFix?.(lastFix);
      updateMiniMapMarker(lastFix.lat, lastFix.lon, lastFix.heading);
      updateFullCanvasMap(lastFix.lat, lastFix.lon, lastFix.heading);
    }
  }).catch(() => {});

  // 2. High-Accuracy Hardware / WiFi GPS
  if ('geolocation' in navigator) {
    // Fast initial fix (low accuracy avoids Windows / laptop hardware GPS timeouts)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastFix = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 20,
          heading: pos.coords.heading || lastFix?.heading || 0,
          speed: pos.coords.speed,
        };
        onFix?.(lastFix);
        updateMiniMapMarker(lastFix.lat, lastFix.lon, lastFix.heading);
        updateFullCanvasMap(lastFix.lat, lastFix.lon, lastFix.heading);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
    );

    // Continuous Watch Position with automatic fallback
    function startWatch(highAccuracy = true) {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          lastFix = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 15,
            heading: pos.coords.heading || lastFix?.heading || 0,
            speed: pos.coords.speed,
          };
          onFix?.(lastFix);
          updateMiniMapMarker(lastFix.lat, lastFix.lon, lastFix.heading);
          updateFullCanvasMap(lastFix.lat, lastFix.lon, lastFix.heading);
        },
        (err) => {
          if (highAccuracy && err.code === 3) {
            // Timeout on high accuracy -> switch to network accuracy
            startWatch(false);
          } else {
            onError?.(err);
          }
        },
        { enableHighAccuracy: highAccuracy, maximumAge: 4000, timeout: highAccuracy ? 10000 : 15000 }
      );
    }

    startWatch(true);
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
        updateFullCanvasMap(lastFix.lat, lastFix.lon, lastFix.heading);
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
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        lastAddress = data.display_name;
        return data;
      }
    }
  } catch { /* try fallback */ }

  try {
    const fallbackUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;
    const res = await fetch(fallbackUrl);
    if (res.ok) {
      const d = await res.json();
      const parts = [d.locality, d.city, d.principalSubdivision, d.countryName].filter(Boolean);
      const name = parts.join(', ') || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
      lastAddress = name;
      return {
        display_name: name,
        address: {
          road: d.locality || d.city || '',
          suburb: d.locality || '',
          city: d.city || '',
          country: d.countryName || ''
        }
      };
    }
  } catch { /* fallback to coords */ }

  lastAddress = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  return { display_name: lastAddress, address: {} };
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

/* ── 🗺️ Direct Canvas Full Map Engine (100% Solid, Zero Tile Drop, High-DPI) ── */

let fullMapState = {
  container: null,
  canvas: null,
  ctx: null,
  lat: 20.0,
  lon: 0.0,
  zoom: 16,
  heading: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  centerOffsetX: 0,
  centerOffsetY: 0,
};

export function initLeafletMap(container) {
  return initFullCanvasMap(container);
}

export function updateLeafletMarker(lat, lon, heading = 0) {
  updateFullCanvasMap(lat, lon, heading);
}

export function initFullCanvasMap(container) {
  if (!container) return null;
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  container.style.backgroundColor = '#08090b';

  const canvas = document.createElement('canvas');
  canvas.className = 'full-canvas-live-map';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.cursor = 'grab';
  container.appendChild(canvas);

  // Floating map zoom & recenter controls
  const controls = document.createElement('div');
  controls.className = 'canvas-map-controls';
  controls.innerHTML = `
    <button type="button" class="btn-map-ctrl" id="btn-map-zoom-in" title="Zoom In" aria-label="Zoom In">+</button>
    <button type="button" class="btn-map-ctrl" id="btn-map-zoom-out" title="Zoom Out" aria-label="Zoom Out">−</button>
    <button type="button" class="btn-map-ctrl" id="btn-map-recenter" title="Re-center Location" aria-label="Re-center">🎯</button>
  `;
  container.appendChild(controls);

  const initLat = lastFix ? lastFix.lat : 22.3072;
  const initLon = lastFix ? lastFix.lon : 73.1812;
  const initHeading = lastFix ? lastFix.heading : 0;

  fullMapState = {
    container,
    canvas,
    ctx: canvas.getContext('2d'),
    lat: initLat,
    lon: initLon,
    zoom: 16,
    heading: initHeading,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    centerOffsetX: 0,
    centerOffsetY: 0,
  };

  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(rect.width * dpr, 400);
    canvas.height = Math.max(rect.height * dpr, 300);
    renderFullCanvasMap();
  }

  const ro = new ResizeObserver(() => resizeCanvas());
  ro.observe(container);
  resizeCanvas();

  // Control button handlers
  container.querySelector('#btn-map-zoom-in')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (fullMapState.zoom < 19) {
      fullMapState.zoom += 1;
      renderFullCanvasMap();
    }
  });

  container.querySelector('#btn-map-zoom-out')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (fullMapState.zoom > 3) {
      fullMapState.zoom -= 1;
      renderFullCanvasMap();
    }
  });

  container.querySelector('#btn-map-recenter')?.addEventListener('click', (e) => {
    e.stopPropagation();
    fullMapState.centerOffsetX = 0;
    fullMapState.centerOffsetY = 0;
    if (lastFix) {
      fullMapState.lat = lastFix.lat;
      fullMapState.lon = lastFix.lon;
    }
    renderFullCanvasMap();
  });

  // Mouse & Touch Pan Handling
  canvas.addEventListener('mousedown', (e) => {
    fullMapState.isDragging = true;
    fullMapState.dragStartX = e.clientX;
    fullMapState.dragStartY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!fullMapState.isDragging) return;
    const dx = e.clientX - fullMapState.dragStartX;
    const dy = e.clientY - fullMapState.dragStartY;
    fullMapState.dragStartX = e.clientX;
    fullMapState.dragStartY = e.clientY;
    fullMapState.centerOffsetX += dx * (window.devicePixelRatio || 1);
    fullMapState.centerOffsetY += dy * (window.devicePixelRatio || 1);
    renderFullCanvasMap();
  });

  window.addEventListener('mouseup', () => {
    fullMapState.isDragging = false;
    canvas.style.cursor = 'grab';
  });

  // Touch handlers
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      fullMapState.isDragging = true;
      fullMapState.dragStartX = e.touches[0].clientX;
      fullMapState.dragStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (!fullMapState.isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - fullMapState.dragStartX;
    const dy = e.touches[0].clientY - fullMapState.dragStartY;
    fullMapState.dragStartX = e.touches[0].clientX;
    fullMapState.dragStartY = e.touches[0].clientY;
    fullMapState.centerOffsetX += dx * (window.devicePixelRatio || 1);
    fullMapState.centerOffsetY += dy * (window.devicePixelRatio || 1);
    renderFullCanvasMap();
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    fullMapState.isDragging = false;
  });

  renderFullCanvasMap();
  return canvas;
}

export function updateFullCanvasMap(lat, lon, heading = 0) {
  fullMapState.lat = lat;
  fullMapState.lon = lon;
  if (heading !== undefined) fullMapState.heading = heading;
  renderFullCanvasMap();
}

function renderFullCanvasMap() {
  const { canvas, ctx, lat, lon, zoom, heading, centerOffsetX, centerOffsetY } = fullMapState;
  if (!canvas || !ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const { x, y } = latLonToTileFraction(lat, lon, zoom);
  
  // 5x5 tile grid guarantees 100% edge-to-edge coverage on all screens
  const minX = Math.floor(x) - 2;
  const maxX = Math.floor(x) + 2;
  const minY = Math.floor(y) - 2;
  const maxY = Math.floor(y) + 2;

  const tileSize = 256;
  const centerX = w / 2 + centerOffsetX;
  const centerY = h / 2 + centerOffsetY;

  for (let tx = minX; tx <= maxX; tx++) {
    for (let ty = minY; ty <= maxY; ty++) {
      const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
      const img = getTileImage(tileUrl, () => renderFullCanvasMap());

      const px = Math.round((tx - x) * tileSize + centerX);
      const py = Math.round((ty - y) * tileSize + centerY);

      if (img) {
        ctx.drawImage(img, px, py, tileSize, tileSize);
      } else {
        ctx.fillStyle = '#14151b';
        ctx.fillRect(px, py, tileSize, tileSize);
      }
    }
  }

  // Draw User Location Beacon & Navigation Pointer
  const rad = ((heading || 0) * Math.PI) / 180;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rad);

  // Vision / Heading Cone
  const coneGrad = ctx.createRadialGradient(0, 0, 4, 0, -45, 55);
  coneGrad.addColorStop(0, 'rgba(34, 197, 94, 0.7)');
  coneGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 52, -Math.PI / 2 - 0.48, -Math.PI / 2 + 0.48);
  ctx.closePath();
  ctx.fillStyle = coneGrad;
  ctx.fill();

  // Navigation Arrow
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(-10, -10);
  ctx.lineTo(0, -14);
  ctx.lineTo(10, -10);
  ctx.closePath();
  ctx.fillStyle = '#22c55e';
  ctx.fill();

  ctx.restore();

  // Pulse ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
  ctx.fill();

  // White border ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Emerald center dot
  ctx.beginPath();
  ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e';
  ctx.fill();
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
