const Auth = (() => {
    const TOKEN_KEY = 'cafespot_token';
    const USER_KEY  = 'cafespot_user';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getUser() {
        try {
            return JSON.parse(localStorage.getItem(USER_KEY));
        } catch {
            return null;
        }
    }

    function setSession(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    function isLoggedIn() {
        return !!getToken();
    }

    function requireAuth() {
        if (!isLoggedIn()) {
            window.location.href = '/index.html';
            return false;
        }
        return true;
    }

    function authHeaders() {
        const token = getToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    async function safePost(url, body) {
        let resp;
        try {
            resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } catch (networkErr) {
            throw new Error('Cannot reach the server. Make sure Docker containers are running and you opened the app via http://localhost:8081 — not as a local file.');
        }

        let data;
        try {
            data = await resp.json();
        } catch {
            throw new Error(
                resp.status === 502 || resp.status === 503
                    ? 'Backend container is not responding. Run: docker compose up -d'
                    : `Unexpected server response (${resp.status}). Check docker logs cafespot-backend.`
            );
        }

        if (!resp.ok) throw new Error(data.error || `Request failed (${resp.status})`);
        return data;
    }

    async function register(username, email, password) {
        const data = await safePost(`${CONFIG.API_BASE}/auth/register`, { username, email, password });
        setSession(data.token, { username: data.username, email: data.email });
        return data;
    }

    async function login(email, password) {
        const data = await safePost(`${CONFIG.API_BASE}/auth/login`, { email, password });
        setSession(data.token, { username: data.username, email: data.email });
        return data;
    }

    function logout() {
        clearSession();
        window.location.href = '/index.html';
    }

    return { getToken, getUser, isLoggedIn, requireAuth, authHeaders, register, login, logout };
})();
