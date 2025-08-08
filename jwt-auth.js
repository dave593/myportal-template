/**
 * JWT Authentication Handler for Frontend
 * Manages JWT tokens in localStorage and API requests
 */

class JWTAuth {
    constructor() {
        this.tokenKey = 'fire_escape_jwt_token';
        this.userKey = 'fire_escape_user_data';
        this.init();
    }

    init() {
        console.log('🔐 JWTAuth.init() called');
        
        // Check if token is in URL (from Google OAuth callback)
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (token) {
            console.log('🔐 Token found in URL, setting it...');
            const success = this.setToken(token);
            if (success) {
                console.log('✅ Token saved to localStorage successfully');
                // Remove token from URL for security
                const newUrl = window.location.pathname + window.location.search.replace(/[?&]token=[^&]*/, '').replace(/^\?&/, '?').replace(/^\?$/, '');
                window.history.replaceState({}, document.title, newUrl);
                console.log('🔐 Token removed from URL for security');
            } else {
                console.error('❌ Failed to save token to localStorage');
            }
        } else {
            console.log('🔍 No token in URL, checking localStorage...');
            const existingToken = this.getToken();
            if (existingToken) {
                console.log('✅ Found existing token in localStorage');
            } else {
                console.log('❌ No token found in localStorage');
            }
        }
        
        // Log authentication status
        console.log('🔐 Authentication status:', this.isAuthenticated());
    }

    setToken(token) {
        try {
            console.log('🔐 Setting JWT token in localStorage...');
            localStorage.setItem(this.tokenKey, token);
            console.log('✅ Token saved to localStorage');
            
            // Decode and store user data
            const userData = this.decodeToken(token);
            if (userData) {
                localStorage.setItem(this.userKey, JSON.stringify(userData));
                console.log('✅ User data saved to localStorage:', userData.email);
            } else {
                console.warn('⚠️ Could not decode token to get user data');
            }
            
            // Verify token was saved
            const savedToken = localStorage.getItem(this.tokenKey);
            if (savedToken === token) {
                console.log('✅ Token verification successful');
                return true;
            } else {
                console.error('❌ Token verification failed');
                return false;
            }
        } catch (error) {
            console.error('❌ Error setting JWT token:', error);
            return false;
        }
    }

    getToken() {
        const token = localStorage.getItem(this.tokenKey);
        if (token) {
            console.log('🔐 Token retrieved from localStorage');
        } else {
            console.log('❌ No token found in localStorage');
        }
        return token;
    }

    getUser() {
        try {
            const userData = localStorage.getItem(this.userKey);
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    }

    decodeToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Error decoding JWT token:', error);
            return null;
        }
    }

    isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;
        
        const userData = this.decodeToken(token);
        if (!userData) return false;
        
        // Check if token is expired
        const currentTime = Date.now() / 1000;
        if (userData.exp && userData.exp < currentTime) {
            this.logout();
            return false;
        }
        
        return true;
    }

    logout() {
        console.log('🔐 Logging out user...');
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        console.log('✅ User data cleared from localStorage');
        window.location.href = '/login';
    }

    // Add authorization header to fetch requests
    async fetchWithAuth(url, options = {}) {
        const token = this.getToken();
        
        if (token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        }
        
        const response = await fetch(url, options);
        
        // If unauthorized, redirect to login
        if (response.status === 401) {
            this.logout();
            return null;
        }
        
        return response;
    }

    // Check auth status with server
    async checkAuthStatus() {
        try {
            const response = await this.fetchWithAuth('/auth/status');
            if (!response) return { authenticated: false };
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error checking auth status:', error);
            return { authenticated: false };
        }
    }
}

// Create global instance
window.jwtAuth = new JWTAuth();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JWTAuth;
} 