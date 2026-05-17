const API = (() => {

    async function request(path, options = {}) {
        let resp;
        try {
            resp = await fetch(`${CONFIG.API_BASE}${path}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...Auth.authHeaders(),
                    ...(options.headers || {}),
                },
            });
        } catch {
            throw new Error('Cannot reach the server. Open the app via http://localhost:8081 and make sure Docker is running.');
        }

        if (resp.status === 401) {
            Auth.logout();
            throw new Error('Session expired. Please log in again.');
        }

        let data;
        try {
            data = await resp.json();
        } catch {
            throw new Error(
                resp.status === 502 || resp.status === 503
                    ? 'Backend is not responding. Run: docker compose up -d'
                    : `Unexpected server response (${resp.status}).`
            );
        }

        if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
        return data;
    }

    async function geocode(suburb) {
        return request('/geocode', {
            method: 'POST',
            body: JSON.stringify({ suburb }),
        });
    }

    async function searchCafes(lat, lng, radius = CONFIG.DEFAULT_RADIUS) {
        return request('/cafes', {
            method: 'POST',
            body: JSON.stringify({ lat, lng, radius }),
        });
    }

    async function getDistances(originLat, originLng, placeIds) {
        return request('/distances', {
            method: 'POST',
            body: JSON.stringify({ origin_lat: originLat, origin_lng: originLng, place_ids: placeIds }),
        });
    }

    async function getDetails(placeId) {
        return request(`/details/${placeId}`);
    }

    async function autocomplete(input) {
        const resp = await fetch(
            `${CONFIG.API_BASE}/autocomplete?input=${encodeURIComponent(input)}`,
            { headers: Auth.authHeaders() }
        );
        return resp.json();
    }

    async function getFavorites() {
        return request('/favorites');
    }

    async function addFavorite(cafe) {
        return request('/favorites', {
            method: 'POST',
            body: JSON.stringify(cafe),
        });
    }

    async function removeFavorite(placeId) {
        return request(`/favorites/${placeId}`, { method: 'DELETE' });
    }

    function photoUrl(ref, maxwidth = 400) {
        return `${CONFIG.API_BASE}/photo?ref=${encodeURIComponent(ref)}&maxwidth=${maxwidth}`;
    }

    function streetViewUrl(lat, lng, width = 600, height = 280) {
        return `${CONFIG.API_BASE}/streetview?lat=${lat}&lng=${lng}&width=${width}&height=${height}`;
    }

    return {
        geocode, searchCafes, getDistances, getDetails,
        autocomplete, getFavorites, addFavorite, removeFavorite,
        photoUrl, streetViewUrl,
    };
})();
