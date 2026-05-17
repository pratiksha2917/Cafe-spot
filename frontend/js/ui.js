const UI = (() => {

    function showToast(message, type = 'info') {
        const existing = document.getElementById('toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function setLoading(element, isLoading, text = 'Search') {
        if (isLoading) {
            element.disabled = true;
            element.innerHTML = `<span class="spinner"></span> Searching...`;
        } else {
            element.disabled = false;
            element.textContent = text;
        }
    }

    function starRating(rating) {
        if (!rating) return '<span class="no-rating">No rating</span>';
        const full  = Math.floor(rating);
        const half  = rating % 1 >= 0.5 ? 1 : 0;
        const empty = 5 - full - half;
        return (
            '<span class="stars">' +
            '★'.repeat(full) +
            (half ? '½' : '') +
            '☆'.repeat(empty) +
            `</span> <span class="rating-num">${rating.toFixed(1)}</span>`
        );
    }

    function priceBadge(level) {
        if (level == null) return '';
        const map  = { 0: 'Free', 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };
        return `<span class="price-badge price-${level}">${map[level] || ''}</span>`;
    }

    function openNowBadge(openNow) {
        if (openNow == null) return '';
        return openNow
            ? '<span class="badge badge-open">Open Now</span>'
            : '<span class="badge badge-closed">Closed</span>';
    }

    function renderCafeCard(cafe, isFavorite, rank) {
        const photoSrc = cafe.photo_reference
            ? API.photoUrl(cafe.photo_reference, 400)
            : 'https://via.placeholder.com/400x200/c8a97e/fff?text=No+Photo';

        const distText = cafe.distance_text
            ? `<span class="distance">🚗 ${cafe.distance_text} · ${cafe.duration_text}</span>`
            : '';

        const favIcon = isFavorite ? '❤️' : '🤍';

        return `
        <div class="cafe-card" data-place-id="${cafe.place_id}" data-lat="${cafe.lat}" data-lng="${cafe.lng}">
            <div class="cafe-rank">#${rank}</div>
            <button class="fav-btn" data-place-id="${cafe.place_id}" title="${isFavorite ? 'Remove from favourites' : 'Add to favourites'}">${favIcon}</button>
            <img class="cafe-photo" src="${photoSrc}" alt="${cafe.name}" loading="lazy"
                 onerror="this.src='https://via.placeholder.com/400x200/c8a97e/fff?text=No+Photo'">
            <div class="cafe-body">
                <h3 class="cafe-name">${cafe.name}</h3>
                <p class="cafe-address">${cafe.vicinity || ''}</p>
                <div class="cafe-meta">
                    ${starRating(cafe.rating)}
                    ${cafe.user_ratings_total ? `<span class="review-count">(${cafe.user_ratings_total.toLocaleString()})</span>` : ''}
                    ${priceBadge(cafe.price_level)}
                    ${openNowBadge(cafe.open_now)}
                </div>
                ${distText}
                <button class="btn-details" data-place-id="${cafe.place_id}" data-lat="${cafe.lat}" data-lng="${cafe.lng}">
                    View Details
                </button>
            </div>
        </div>`;
    }

    function renderFavoriteItem(fav) {
        return `
        <div class="fav-item" data-place-id="${fav.place_id}">
            <div class="fav-info">
                <span class="fav-name">${fav.name || 'Unknown cafe'}</span>
                <span class="fav-addr">${fav.vicinity || ''}</span>
                ${fav.rating ? `<span class="fav-rating">★ ${fav.rating}</span>` : ''}
            </div>
            <button class="fav-remove" data-place-id="${fav.place_id}" title="Remove">✕</button>
        </div>`;
    }

    function renderDetailModal(detail, cafe) {
        const photos = (detail.photos || []).slice(0, 3).map(p =>
            `<img src="${API.photoUrl(p.photo_reference, 600)}" alt="Photo" class="detail-photo">`
        ).join('');

        const hours = detail.opening_hours
            ? (detail.opening_hours.weekday_text || []).map(h => `<li>${h}</li>`).join('')
            : '<li>Hours not available</li>';

        const reviews = (detail.reviews || []).slice(0, 3).map(r => `
            <div class="review">
                <div class="review-header">
                    <strong>${r.author_name}</strong>
                    <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                    <span class="review-time">${r.relative_time_description}</span>
                </div>
                <p>${r.text}</p>
            </div>`).join('');

        const streetViewImg = `<img src="${API.streetViewUrl(cafe.lat, cafe.lng)}"
            alt="Street View" class="streetview-img"
            onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
            <div class="no-streetview" style="display:none">Street View not available</div>`;

        return `
        <div class="modal-overlay" id="detailModal">
            <div class="modal-box">
                <button class="modal-close" id="closeModal">✕</button>
                <div class="modal-photos">${photos || streetViewImg}</div>
                ${photos ? `<div class="modal-streetview">${streetViewImg}</div>` : ''}
                <div class="modal-content">
                    <h2>${detail.name || cafe.name}</h2>
                    <p class="modal-address">📍 ${detail.formatted_address || cafe.vicinity}</p>
                    <div class="modal-meta">
                        ${detail.rating ? `<span>★ ${detail.rating} (${(detail.user_ratings_total || 0).toLocaleString()} reviews)</span>` : ''}
                        ${detail.formatted_phone_number ? `<span>📞 ${detail.formatted_phone_number}</span>` : ''}
                        ${detail.website ? `<a href="${detail.website}" target="_blank" class="modal-link">🌐 Website</a>` : ''}
                    </div>
                    <div class="modal-hours">
                        <h4>Opening Hours</h4>
                        <ul>${hours}</ul>
                    </div>
                    ${reviews ? `<div class="modal-reviews"><h4>Recent Reviews</h4>${reviews}</div>` : ''}
                </div>
            </div>
        </div>`;
    }

    return { showToast, setLoading, renderCafeCard, renderFavoriteItem, renderDetailModal };
})();
