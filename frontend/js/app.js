let map, markers = [], infoWindow;
let currentCafes = [], favoriteIds = new Set();
let originLat, originLng;

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.requireAuth()) return;

    const user = Auth.getUser();
    document.getElementById('userName').textContent = user?.username || 'User';
    document.getElementById('logoutBtn').addEventListener('click', Auth.logout);

    await loadFavorites();
    initAutocomplete();
    initFilters();

    document.getElementById('searchForm').addEventListener('submit', handleSearch);
    document.getElementById('favToggle').addEventListener('click', toggleFavPanel);
    document.getElementById('closeFavPanel').addEventListener('click', toggleFavPanel);
});

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        center: CONFIG.MAP_CENTER,
        zoom: CONFIG.MAP_ZOOM,
        styles: mapStyles(),
        mapTypeControl: false,
        streetViewControl: false,
    });
    infoWindow = new google.maps.InfoWindow();
}

function initAutocomplete() {
    const input    = document.getElementById('suburbInput');
    const dropdown = document.getElementById('autocompleteDropdown');
    let debounceTimer;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const val = input.value.trim();
        if (val.length < 2) { dropdown.innerHTML = ''; dropdown.hidden = true; return; }

        debounceTimer = setTimeout(async () => {
            try {
                const data = await API.autocomplete(val);
                dropdown.innerHTML = '';
                (data.predictions || []).slice(0, 6).forEach(p => {
                    const li = document.createElement('li');
                    const suburb = p.description.replace(/, .*/, '');
                    li.textContent = p.description;
                    li.addEventListener('click', () => {
                        input.value = suburb;
                        dropdown.hidden = true;
                    });
                    dropdown.appendChild(li);
                });
                dropdown.hidden = dropdown.children.length === 0;
            } catch {}
        }, 300);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.search-box')) { dropdown.hidden = true; }
    });
}

function initFilters() {
    ['filterOpen', 'filterRating', 'filterPrice'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyFilters);
    });
}

async function handleSearch(e) {
    e.preventDefault();
    const suburb = document.getElementById('suburbInput').value.trim();
    if (!suburb) return;

    const btn = document.getElementById('searchBtn');
    UI.setLoading(btn, true);
    document.getElementById('resultsGrid').innerHTML = '';
    document.getElementById('resultsCount').textContent = '';

    try {
        const geo = await API.geocode(suburb);
        if (!geo.valid) { UI.showToast(geo.error, 'error'); return; }

        originLat = geo.lat;
        originLng = geo.lng;

        map.setCenter({ lat: originLat, lng: originLng });
        map.setZoom(14);
        addOriginMarker(originLat, originLng, geo.formatted_address);

        const cafeData = await API.searchCafes(originLat, originLng, CONFIG.DEFAULT_RADIUS);
        if (!cafeData.cafes?.length) { UI.showToast('No cafes found in this area.', 'info'); return; }

        const placeIds = cafeData.cafes.map(c => c.place_id);
        const distData = await API.getDistances(originLat, originLng, placeIds);
        const distMap  = {};
        distData.distances.forEach(d => distMap[d.place_id] = d);

        currentCafes = cafeData.cafes.map(c => ({ ...c, ...distMap[c.place_id] }));
        currentCafes.sort((a, b) => (a.distance_value || 999999) - (b.distance_value || 999999));

        applyFilters();
        plotMarkers(currentCafes);

    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.setLoading(btn, false, 'Find Cafes');
    }
}

function applyFilters() {
    const onlyOpen    = document.getElementById('filterOpen')?.checked;
    const minRating   = parseFloat(document.getElementById('filterRating')?.value || '0');
    const maxPrice    = parseInt(document.getElementById('filterPrice')?.value || '4');

    let filtered = currentCafes.filter(c => {
        if (onlyOpen && c.open_now !== true) return false;
        if (c.rating && c.rating < minRating) return false;
        if (c.price_level != null && c.price_level > maxPrice) return false;
        return true;
    });

    renderCafes(filtered);
}

function renderCafes(cafes) {
    const grid  = document.getElementById('resultsGrid');
    const count = document.getElementById('resultsCount');

    count.textContent = `${cafes.length} cafe${cafes.length !== 1 ? 's' : ''} found`;
    grid.innerHTML    = cafes.map((c, i) => UI.renderCafeCard(c, favoriteIds.has(c.place_id), i + 1)).join('');

    grid.querySelectorAll('.cafe-card').forEach(card => {
        card.addEventListener('click', e => {
            if (e.target.closest('.fav-btn') || e.target.closest('.btn-details')) return;
            const placeId = card.dataset.placeId;
            const cafe    = currentCafes.find(c => c.place_id === placeId);
            if (cafe) panToMarker(cafe);
        });
    });

    grid.querySelectorAll('.fav-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            toggleFavorite(btn.dataset.placeId);
        });
    });

    grid.querySelectorAll('.btn-details').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const cafe = currentCafes.find(c => c.place_id === btn.dataset.placeId);
            if (cafe) openDetailModal(cafe);
        });
    });
}

function plotMarkers(cafes) {
    markers.forEach(m => m.setMap(null));
    markers = [];

    cafes.forEach((cafe, i) => {
        const marker = new google.maps.Marker({
            position: { lat: cafe.lat, lng: cafe.lng },
            map,
            title: cafe.name,
            label: { text: String(i + 1), color: '#fff', fontSize: '12px', fontWeight: 'bold' },
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#b5743a',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 16,
            },
        });

        marker.addListener('click', () => {
            infoWindow.setContent(`
                <div style="font-family:sans-serif;max-width:200px">
                    <strong>${cafe.name}</strong><br>
                    <small>${cafe.vicinity || ''}</small><br>
                    ${cafe.rating ? `★ ${cafe.rating}` : ''}
                    ${cafe.distance_text ? ` · ${cafe.distance_text}` : ''}
                </div>`);
            infoWindow.open(map, marker);

            const card = document.querySelector(`.cafe-card[data-place-id="${cafe.place_id}"]`);
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });

        markers.push(marker);
    });
}

function addOriginMarker(lat, lng, label) {
    new google.maps.Marker({
        position: { lat, lng },
        map,
        title: label,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#2563eb',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 3,
            scale: 10,
        },
        zIndex: 999,
    });
}

function panToMarker(cafe) {
    map.panTo({ lat: cafe.lat, lng: cafe.lng });
    map.setZoom(16);
    const marker = markers.find(m => m.getTitle() === cafe.name);
    if (marker) google.maps.event.trigger(marker, 'click');
}

async function toggleFavorite(placeId) {
    const cafe = currentCafes.find(c => c.place_id === placeId);
    if (!cafe) return;

    try {
        if (favoriteIds.has(placeId)) {
            await API.removeFavorite(placeId);
            favoriteIds.delete(placeId);
            UI.showToast('Removed from favourites', 'info');
        } else {
            await API.addFavorite({ place_id: placeId, name: cafe.name, vicinity: cafe.vicinity, rating: cafe.rating, lat: cafe.lat, lng: cafe.lng });
            favoriteIds.add(placeId);
            UI.showToast(`${cafe.name} saved!`, 'success');
        }
        await loadFavorites();
        applyFilters();
    } catch (err) {
        UI.showToast(err.message, 'error');
    }
}

async function loadFavorites() {
    try {
        const data = await API.getFavorites();
        favoriteIds = new Set((data.favorites || []).map(f => f.place_id));
        renderFavList(data.favorites || []);
    } catch {}
}

function renderFavList(favs) {
    const list = document.getElementById('favList');
    const count = document.getElementById('favCount');
    count.textContent = favs.length || '';
    if (!favs.length) {
        list.innerHTML = '<p class="fav-empty">No saved cafes yet.</p>';
        return;
    }
    list.innerHTML = favs.map(f => UI.renderFavoriteItem(f)).join('');
    list.querySelectorAll('.fav-remove').forEach(btn => {
        btn.addEventListener('click', async () => {
            await API.removeFavorite(btn.dataset.placeId);
            favoriteIds.delete(btn.dataset.placeId);
            await loadFavorites();
            applyFilters();
        });
    });
}

function toggleFavPanel() {
    document.getElementById('favPanel').classList.toggle('open');
}

async function openDetailModal(cafe) {
    const overlay = document.getElementById('modalContainer');
    overlay.innerHTML = '<div class="modal-overlay"><div class="modal-box modal-loading">Loading details...</div></div>';
    overlay.hidden = false;
    try {
        const detail = await API.getDetails(cafe.place_id);
        overlay.innerHTML = UI.renderDetailModal(detail, cafe);
        document.getElementById('closeModal').addEventListener('click', () => { overlay.hidden = true; overlay.innerHTML = ''; });
        overlay.addEventListener('click', e => { if (e.target === overlay.querySelector('.modal-overlay')) { overlay.hidden = true; overlay.innerHTML = ''; } });
    } catch (err) {
        overlay.innerHTML = '';
        overlay.hidden = true;
        UI.showToast('Could not load details', 'error');
    }
}

function mapStyles() {
    return [
        { featureType: 'poi.business', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    ];
}
