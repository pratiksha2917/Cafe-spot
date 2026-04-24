/**
 * script.js — CafeSpot Sydney
 * ============================
 * Covers:
 *   - Mock cafe data (swap fetch_cafes() for live Places API call)
 *   - Search by suburb
 *   - Filter chips (wifi / outdoor / open_now / food)
 *   - Radius slider
 *   - Card expand / collapse
 *   - Google Maps init stub (ready for real API key)
 *   - Map markers + highlight on card click
 *   - Haversine distance helper
 *
 * To activate Google Maps:
 *   1. Uncomment the <script> tag in index.html and add your API key.
 *   2. The initMap() function below will be called automatically by the SDK.
 */

'use strict';

/* ─────────────────────────────────────────
   Mock data — mirrors the CafeSpot HTML ref
   Replace with live Geoapify / Places API
───────────────────────────────────────── */
const CAFES = [
  {
    id: 'c1',
    name: 'Glee Coffee',
    address: '578 King St, Newtown NSW 2042',
    suburb: 'newtown',
    lat: -33.8978, lng: 151.1794,
    dist: 0.3,
    rating: 4.7, reviews: 312,
    open: true,  hours: '7am – 5pm',
    desc: 'A beloved Newtown institution known for exceptional single-origin espresso and a cosy, book-lined interior.',
    features: { wifi: true,  outdoor: false, food: true,  power: true  },
    tags: ['Specialty coffee', 'Cosy interior', 'Vegan options'],
  },
  {
    id: 'c2',
    name: 'Black Wire Records & Coffee',
    address: '402 King St, Newtown NSW 2042',
    suburb: 'newtown',
    lat: -33.8961, lng: 151.1780,
    dist: 0.5,
    rating: 4.5, reviews: 198,
    open: true,  hours: '8am – 6pm',
    desc: 'Half vinyl record store, half cafe — sip a flat white while browsing rare records. A true Newtown gem.',
    features: { wifi: true,  outdoor: false, food: false, power: false },
    tags: ['Record store', 'Flat whites', 'Unique vibe'],
  },
  {
    id: 'c3',
    name: 'Campos Coffee',
    address: '193 Missenden Rd, Newtown NSW 2042',
    suburb: 'newtown',
    lat: -33.8950, lng: 151.1840,
    dist: 0.9,
    rating: 4.8, reviews: 504,
    open: true,  hours: '6:30am – 4:30pm',
    desc: 'The Campos roastery flagship. World-class espresso bar with rotating single origins. Minimal interior, maximum coffee.',
    features: { wifi: false, outdoor: true,  food: true,  power: false },
    tags: ['Roastery', 'Award-winning', 'Specialty'],
  },
  {
    id: 'c4',
    name: 'Cow & Moon Gelato',
    address: '181 Enmore Rd, Newtown NSW 2042',
    suburb: 'newtown',
    lat: -33.9000, lng: 151.1756,
    dist: 1.1,
    rating: 4.6, reviews: 289,
    open: false, hours: '11am – 10pm (closed today)',
    desc: 'Artisan gelato cafe. World-champion gelato served fresh daily. Great for a sweet afternoon break.',
    features: { wifi: false, outdoor: true,  food: true,  power: false },
    tags: ['Gelato', 'Desserts', 'Outdoor'],
  },
  {
    id: 'c5',
    name: 'Shenkin Kitchen',
    address: '43 Enmore Rd, Newtown NSW 2042',
    suburb: 'newtown',
    lat: -33.8992, lng: 151.1768,
    dist: 1.4,
    rating: 4.4, reviews: 156,
    open: true,  hours: '7am – 4pm',
    desc: 'Israeli-inspired breakfast and brunch cafe. Excellent shakshuka, avocado toast and cold brew.',
    features: { wifi: true,  outdoor: true,  food: true,  power: true  },
    tags: ['Brunch', 'Israeli', 'Cold brew'],
  },
  {
    id: 'c6',
    name: 'Single O Surry Hills',
    address: '60-64 Reservoir St, Surry Hills NSW 2010',
    suburb: 'surry hills',
    lat: -33.8863, lng: 151.2094,
    dist: 0.8,
    rating: 4.5, reviews: 410,
    open: true,  hours: '7am – 3pm',
    desc: 'Specialty roaster with minimalist fit-out and exceptional espresso. Queue early on weekends.',
    features: { wifi: true,  outdoor: false, food: true,  power: false },
    tags: ['Specialty coffee', 'Light meals', 'Minimalist'],
  },
  {
    id: 'c7',
    name: 'Paramount Coffee Project',
    address: '80 Commonwealth St, Surry Hills NSW 2010',
    suburb: 'surry hills',
    lat: -33.8832, lng: 151.2101,
    dist: 1.0,
    rating: 4.4, reviews: 322,
    open: true,  hours: '7am – 4pm',
    desc: 'Co-created with LA\'s G&B Coffee inside the Paramount Pictures building. Outstanding brunch menu.',
    features: { wifi: false, outdoor: true,  food: true,  power: false },
    tags: ['Brunch', 'LA vibes', 'Outdoor'],
  },
];

/* ─────────────────────────────────────────
   App state
───────────────────────────────────────── */
let activeFilter   = 'all';
let activeRadiusKm = 5;
let expandedId     = null;   // id of the currently expanded card
let mapInstance    = null;   // Google Maps Map object (set by initMap)
let mapMarkers     = [];     // active marker objects

/* ─────────────────────────────────────────
   Haversine — great-circle distance in km
   Used to filter by radius once real
   GPS coords come from the API response.
───────────────────────────────────────── */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function toRad(deg) { return deg * Math.PI / 180; }

/* ─────────────────────────────────────────
   fetchCafes — mock search
   In production: call Geoapify or Google
   Places Nearby Search, parse JSON into
   the same shape as CAFES above.
───────────────────────────────────────── */
function fetchCafes(suburb) {
  const q = suburb.trim().toLowerCase();
  return CAFES.filter(c => c.suburb === q);
}

/* ─────────────────────────────────────────
   Filter & radius helpers
───────────────────────────────────────── */
function applyFilters(cafes) {
  return cafes.filter(c => {
    // Radius
    if (c.dist > activeRadiusKm) return false;
    // Chips
    if (activeFilter === 'all')     return true;
    if (activeFilter === 'open')    return c.open;
    return c.features[activeFilter] === true;
  });
}

/* ─────────────────────────────────────────
   Render helpers
───────────────────────────────────────── */
function starsHtml(rating) {
  const full  = Math.round(rating);
  const empty = 5 - full;
  return '★'.repeat(full) + '<span style="opacity:.3">★</span>'.repeat(empty);
}

function featDot(val) {
  return `<span class="feat-dot ${val ? 'yes' : 'no'}"></span>`;
}

function cardHtml(cafe, index) {
  const expanded = expandedId === cafe.id;
  const mapsUrl  = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.address)}`;

  return `
  <div class="cafe-card${expanded ? ' expanded' : ''}"
       id="card-${cafe.id}"
       role="listitem"
       onclick="toggleExpand('${cafe.id}')"
       style="animation-delay:${index * 0.04}s">

    <div class="card-top">
      <div>
        <p class="card-name">${cafe.name}</p>
        <p class="card-addr">${cafe.address}</p>
      </div>
      <span class="card-dist">${cafe.dist.toFixed(1)} km</span>
    </div>

    <div class="card-meta">
      <span class="badge ${cafe.open ? 'open' : 'closed'}">
        ${cafe.open ? 'Open' : 'Closed'} · ${cafe.hours}
      </span>
      <span>
        <span class="stars">${starsHtml(cafe.rating)}</span>
        <span class="rating-num">${cafe.rating} (${cafe.reviews})</span>
      </span>
    </div>

    <div class="card-expand">
      <p class="card-desc">${cafe.desc}</p>

      <p class="section-label">What's available</p>
      <div class="features-grid">
        <div class="feat-item">${featDot(cafe.features.wifi)}    Wi-Fi</div>
        <div class="feat-item">${featDot(cafe.features.outdoor)} Outdoor seating</div>
        <div class="feat-item">${featDot(cafe.features.food)}    Food available</div>
        <div class="feat-item">${featDot(cafe.features.power)}   Power outlets</div>
      </div>

      <p class="section-label">Tags</p>
      <div class="tags-row">
        ${cafe.tags.map(t => `<span class="badge">${t}</span>`).join('')}
      </div>

      <button class="map-link-btn"
        onclick="event.stopPropagation(); window.open('${mapsUrl}','_blank')">
        View on Google Maps →
      </button>
    </div>
  </div>`;
}

/* ─────────────────────────────────────────
   renderResults — main render call
───────────────────────────────────────── */
function renderResults() {
  const suburb  = document.getElementById('locInput').value.trim() || 'Newtown';
  const raw     = fetchCafes(suburb);
  const visible = applyFilters(raw);

  // Results header
  const header = document.getElementById('resultsHeader');
  if (raw.length === 0) {
    header.innerHTML = `No results for <strong>${suburb}</strong> in mock data`;
  } else {
    header.innerHTML = `Showing <strong>${visible.length} cafe${visible.length !== 1 ? 's' : ''}</strong> near <strong>${suburb}</strong>`;
  }

  // Cards
  const el = document.getElementById('results');
  if (!visible.length) {
    el.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">☕</span>
        No cafes match this filter.<br>Try a different one or widen the radius.
      </div>`;
  } else {
    el.innerHTML = visible.map((c, i) => cardHtml(c, i)).join('');
  }

  // Map markers
  updateMarkers(visible);
}

/* ─────────────────────────────────────────
   User interactions
───────────────────────────────────────── */
function doSearch() {
  expandedId = null;
  renderResults();
}

// Also trigger search on Enter key in the input
document.getElementById('locInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

function toggleFilter(el, key) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  activeFilter = key;
  renderResults();
}

function onRadiusChange(val) {
  activeRadiusKm = Number(val);
  document.getElementById('radiusVal').textContent = `${val} km`;
  renderResults();
}

function toggleExpand(id) {
  expandedId = expandedId === id ? null : id;
  renderResults();

  // Pan map to this cafe if map is active
  if (mapInstance) {
    const cafe = CAFES.find(c => c.id === id);
    if (cafe && expandedId === id) {
      mapInstance.panTo({ lat: cafe.lat, lng: cafe.lng });
      mapInstance.setZoom(16);
      highlightMarker(id);
    }
  }
}

/* ─────────────────────────────────────────
   Google Maps integration
   initMap() is called by the Maps SDK
   once it loads (see index.html <script>).
───────────────────────────────────────── */

/**
 * initMap — called by Google Maps SDK callback.
 * Centre on Sydney CBD by default; zooms to
 * current results once a search is run.
 */
function initMap() {
  const sydneyCBD = { lat: -33.8688, lng: 151.2093 };

  mapInstance = new google.maps.Map(document.getElementById('map'), {
    center: sydneyCBD,
    zoom: 14,
    styles: mapStyleDark(),  // espresso-toned map style
    disableDefaultUI: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  });

  // Hide the placeholder once the real map loads
  document.getElementById('mapPlaceholder').style.display = 'none';

  // Render markers for initial results
  renderResults();
}

/**
 * updateMarkers — clear old pins, add new ones.
 * Called by renderResults() every time the list updates.
 */
function updateMarkers(cafes) {
  if (!mapInstance) return;

  // Clear existing markers
  mapMarkers.forEach(m => m.setMap(null));
  mapMarkers = [];

  if (!cafes.length) return;

  const bounds = new google.maps.LatLngBounds();

  cafes.forEach(cafe => {
    const marker = new google.maps.Marker({
      position : { lat: cafe.lat, lng: cafe.lng },
      map      : mapInstance,
      title    : cafe.name,
      icon     : markerIcon(cafe.open),
      animation: google.maps.Animation.DROP,
    });

    // Click marker → expand the matching card
    marker.addListener('click', () => {
      expandedId = cafe.id;
      renderResults();
      document.getElementById(`card-${cafe.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    marker._cafeId = cafe.id;
    mapMarkers.push(marker);
    bounds.extend(marker.getPosition());
  });

  mapInstance.fitBounds(bounds);
}

/**
 * highlightMarker — bounce the pin for the expanded cafe.
 */
function highlightMarker(cafeId) {
  mapMarkers.forEach(m => {
    const isTarget = m._cafeId === cafeId;
    m.setAnimation(isTarget ? google.maps.Animation.BOUNCE : null);
    // Stop bouncing after 1.4 s (2 cycles)
    if (isTarget) setTimeout(() => m.setAnimation(null), 1400);
  });
}

/**
 * markerIcon — gold pin for open cafes, muted for closed.
 */
function markerIcon(isOpen) {
  return {
    path        : google.maps.SymbolPath.CIRCLE,
    fillColor   : isOpen ? '#f5c842' : '#a89070',
    fillOpacity : 1,
    strokeColor : '#1a1008',
    strokeWeight: 2,
    scale       : 9,
  };
}

/**
 * mapStyleDark — custom espresso-toned map style.
 * Paste into the Google Maps style wizard to preview.
 */
function mapStyleDark() {
  return [
    { elementType: 'geometry',   stylers: [{ color: '#ebe3d5' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#4a3520' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f0e8' }] },
    { featureType: 'road',        elementType: 'geometry',   stylers: [{ color: '#ffffff' }] },
    { featureType: 'road',        elementType: 'geometry.stroke', stylers: [{ color: '#e0d5c0' }] },
    { featureType: 'water',       elementType: 'geometry',   stylers: [{ color: '#b8cfd8' }] },
    { featureType: 'poi.park',    elementType: 'geometry',   stylers: [{ color: '#d4e8c2' }] },
    { featureType: 'poi.business',stylers: [{ visibility: 'off' }] },
    { featureType: 'transit',     stylers: [{ visibility: 'simplified' }] },
  ];
}

/* ─────────────────────────────────────────
   Boot — render on page load
───────────────────────────────────────── */
renderResults();
