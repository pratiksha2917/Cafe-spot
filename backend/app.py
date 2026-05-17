"""
CafeSpot — app.py
Flask backend: JWT authentication + Google Maps API proxy + Favorites
"""

import os
import sqlite3
import requests
import time
from datetime import timedelta
from flask import Flask, request, jsonify, Response, g
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.config['JWT_SECRET_KEY'] = os.environ.get('SECRET_KEY', 'cafespot-dev-secret-change-in-prod')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

jwt = JWTManager(app)

GOOGLE_API_KEY      = os.environ.get('GOOGLE_API_KEY', 'AIzaSyBBH5WNN660-YNrkQnGopV8y4cPOatnwNw')
DB_PATH             = os.environ.get('DB_PATH', '/app/data/cafespot.db')

GEOCODING_URL       = "https://maps.googleapis.com/maps/api/geocode/json"
PLACES_URL          = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
PLACE_DETAILS_URL   = "https://maps.googleapis.com/maps/api/place/details/json"
DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"
AUTOCOMPLETE_URL    = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
PHOTO_URL           = "https://maps.googleapis.com/maps/api/place/photo"
STREETVIEW_URL      = "https://maps.googleapis.com/maps/api/streetview"
STREETVIEW_META_URL = "https://maps.googleapis.com/maps/api/streetview/metadata"


# ─── Database ─────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT UNIQUE NOT NULL,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS favorites (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id   INTEGER NOT NULL,
            place_id  TEXT NOT NULL,
            name      TEXT,
            vicinity  TEXT,
            rating    REAL,
            lat       REAL,
            lng       REAL,
            saved_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, place_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    conn.commit()
    conn.close()


# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    data     = request.get_json() or {}
    username = data.get('username', '').strip()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({'error': 'Username, email and password are required'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if '@' not in email:
        return jsonify({'error': 'Invalid email address'}), 400

    password_hash = generate_password_hash(password)
    try:
        conn = get_db()
        conn.execute(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            (username, email, password_hash)
        )
        conn.commit()
        user_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        conn.close()
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 409

    token = create_access_token(identity=str(user_id))
    return jsonify({'token': token, 'username': username, 'email': email}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data     = request.get_json() or {}
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = create_access_token(identity=str(user['id']))
    return jsonify({'token': token, 'username': user['username'], 'email': user['email']}), 200


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    conn    = get_db()
    user    = conn.execute(
        'SELECT id, username, email, created_at FROM users WHERE id = ?', (user_id,)
    ).fetchone()
    conn.close()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'id': user['id'], 'username': user['username'], 'email': user['email']})


# ─── Favorites ────────────────────────────────────────────────────────────────

@app.route('/api/favorites', methods=['GET'])
@jwt_required()
def get_favorites():
    user_id = get_jwt_identity()
    conn    = get_db()
    favs    = conn.execute(
        'SELECT * FROM favorites WHERE user_id = ? ORDER BY saved_at DESC', (user_id,)
    ).fetchall()
    conn.close()
    return jsonify({'favorites': [dict(f) for f in favs]})


@app.route('/api/favorites', methods=['POST'])
@jwt_required()
def add_favorite():
    user_id  = get_jwt_identity()
    data     = request.get_json() or {}
    place_id = data.get('place_id')
    if not place_id:
        return jsonify({'error': 'place_id required'}), 400

    try:
        conn = get_db()
        conn.execute(
            'INSERT INTO favorites (user_id, place_id, name, vicinity, rating, lat, lng) VALUES (?,?,?,?,?,?,?)',
            (user_id, place_id, data.get('name'), data.get('vicinity'),
             data.get('rating'), data.get('lat'), data.get('lng'))
        )
        conn.commit()
        conn.close()
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Already in favorites'}), 409

    return jsonify({'success': True}), 201


@app.route('/api/favorites/<place_id>', methods=['DELETE'])
@jwt_required()
def remove_favorite(place_id):
    user_id = get_jwt_identity()
    conn    = get_db()
    conn.execute('DELETE FROM favorites WHERE user_id = ? AND place_id = ?', (user_id, place_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ─── Geocode ──────────────────────────────────────────────────────────────────

@app.route('/api/geocode', methods=['POST'])
def geocode():
    data   = request.get_json() or {}
    suburb = data.get('suburb', '').strip()
    if not suburb:
        return jsonify({'valid': False, 'error': 'No suburb provided'}), 400

    query    = f"{suburb}, Sydney, NSW, Australia"
    geo_resp = requests.get(GEOCODING_URL, params={
        'address': query, 'key': GOOGLE_API_KEY, 'region': 'au', 'components': 'country:AU'
    }, timeout=10)

    geo_data = geo_resp.json()
    results  = geo_data.get('results', [])
    if not results:
        return jsonify({'valid': False, 'error': f"Could not find '{suburb}' in Sydney."})

    best      = results[0]
    location  = best['geometry']['location']
    formatted = best.get('formatted_address', '')

    if 'NSW' not in formatted and 'New South Wales' not in formatted:
        return jsonify({'valid': False, 'error': f"'{suburb}' doesn't appear to be in Sydney."})

    return jsonify({
        'valid': True,
        'lat': location['lat'],
        'lng': location['lng'],
        'formatted_address': formatted,
        'place_id': best.get('place_id'),
    })


# ─── Cafe Search ──────────────────────────────────────────────────────────────

@app.route('/api/cafes', methods=['POST'])
def search_cafes():
    data   = request.get_json() or {}
    lat    = data.get('lat')
    lng    = data.get('lng')
    radius = data.get('radius', 5000)

    if lat is None or lng is None:
        return jsonify({'error': 'lat/lng required'}), 400

    all_cafes       = []
    next_page_token = None

    for _ in range(3):
        params = {'location': f"{lat},{lng}", 'radius': radius, 'type': 'cafe', 'key': GOOGLE_API_KEY}
        if next_page_token:
            params['pagetoken'] = next_page_token

        resp      = requests.get(PLACES_URL, params=params, timeout=10)
        resp_data = resp.json()

        if resp_data.get('status') not in ('OK', 'ZERO_RESULTS'):
            break

        for place in resp_data.get('results', []):
            loc = place['geometry']['location']
            all_cafes.append({
                'place_id':           place.get('place_id'),
                'name':               place.get('name'),
                'vicinity':           place.get('vicinity'),
                'lat':                loc['lat'],
                'lng':                loc['lng'],
                'rating':             place.get('rating'),
                'user_ratings_total': place.get('user_ratings_total'),
                'price_level':        place.get('price_level'),
                'open_now':           place.get('opening_hours', {}).get('open_now'),
                'photo_reference':    (place.get('photos') or [{}])[0].get('photo_reference'),
            })

        next_page_token = resp_data.get('next_page_token')
        if not next_page_token:
            break
        time.sleep(2)

    return jsonify({'cafes': all_cafes})


# ─── Distances ────────────────────────────────────────────────────────────────

@app.route('/api/distances', methods=['POST'])
def get_distances():
    data       = request.get_json() or {}
    origin_lat = data.get('origin_lat')
    origin_lng = data.get('origin_lng')
    place_ids  = data.get('place_ids', [])

    if not place_ids:
        return jsonify({'distances': []})

    origin        = f"{origin_lat},{origin_lng}"
    CHUNK         = 25
    all_distances = []

    for i in range(0, len(place_ids), CHUNK):
        chunk        = place_ids[i:i + CHUNK]
        destinations = '|'.join(f"place_id:{pid}" for pid in chunk)

        resp    = requests.get(DISTANCE_MATRIX_URL, params={
            'origins': origin, 'destinations': destinations,
            'key': GOOGLE_API_KEY, 'mode': 'driving', 'units': 'metric',
        }, timeout=10)
        dm_data = resp.json()

        rows = (dm_data.get('rows') or [{}])[0].get('elements', [])
        for j, element in enumerate(rows):
            pid = chunk[j]
            if element.get('status') == 'OK':
                all_distances.append({
                    'place_id':       pid,
                    'distance_text':  element['distance']['text'],
                    'distance_value': element['distance']['value'],
                    'duration_text':  element['duration']['text'],
                })
            else:
                all_distances.append({'place_id': pid, 'distance_text': None,
                                      'distance_value': 999999, 'duration_text': None})

    return jsonify({'distances': all_distances})


# ─── Place Details ────────────────────────────────────────────────────────────

@app.route('/api/details/<place_id>', methods=['GET'])
def place_details(place_id):
    resp = requests.get(PLACE_DETAILS_URL, params={
        'place_id': place_id,
        'key': GOOGLE_API_KEY,
        'fields': 'name,formatted_address,formatted_phone_number,website,rating,'
                  'user_ratings_total,price_level,opening_hours,photos,reviews,geometry',
    }, timeout=10)
    return jsonify(resp.json().get('result', {}))


# ─── Photo Proxy ──────────────────────────────────────────────────────────────

@app.route('/api/photo')
def get_photo():
    ref      = request.args.get('ref', '')
    maxwidth = request.args.get('maxwidth', '400')
    if not ref:
        return jsonify({'error': 'ref required'}), 400

    resp = requests.get(PHOTO_URL, params={
        'photoreference': ref, 'maxwidth': maxwidth, 'key': GOOGLE_API_KEY
    }, timeout=10, allow_redirects=True)

    return Response(resp.content,
                    content_type=resp.headers.get('Content-Type', 'image/jpeg'),
                    status=resp.status_code)


# ─── Autocomplete ─────────────────────────────────────────────────────────────

@app.route('/api/autocomplete')
def autocomplete():
    user_input = request.args.get('input', '').strip()
    if not user_input:
        return jsonify({'predictions': []})

    resp    = requests.get(AUTOCOMPLETE_URL, params={
        'input': f"{user_input} Sydney", 'key': GOOGLE_API_KEY,
        'types': '(regions)', 'components': 'country:au',
        'location': '-33.8688,151.2093', 'radius': '50000', 'strictbounds': 'true',
    }, timeout=10)
    ac_data = resp.json()

    predictions = [
        {'description': p['description'], 'place_id': p.get('place_id')}
        for p in ac_data.get('predictions', [])
    ]
    return jsonify({'predictions': predictions})


# ─── Street View ──────────────────────────────────────────────────────────────

@app.route('/api/streetview')
def get_streetview():
    lat    = request.args.get('lat', '')
    lng    = request.args.get('lng', '')
    width  = request.args.get('width', '600')
    height = request.args.get('height', '300')

    if not lat or not lng:
        return jsonify({'error': 'lat and lng required'}), 400

    meta = requests.get(STREETVIEW_META_URL, params={
        'location': f"{lat},{lng}", 'key': GOOGLE_API_KEY
    }, timeout=10).json()

    if meta.get('status') != 'OK':
        return jsonify({'available': False}), 404

    img_resp = requests.get(STREETVIEW_URL, params={
        'location': f"{lat},{lng}", 'size': f"{width}x{height}",
        'fov': '90', 'heading': '0', 'pitch': '0', 'key': GOOGLE_API_KEY,
    }, timeout=10)

    return Response(img_resp.content,
                    content_type=img_resp.headers.get('Content-Type', 'image/jpeg'),
                    status=img_resp.status_code)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'service': 'CafeSpot API'})


# ─── Run ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=False)
