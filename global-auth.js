/**
 * Sistema de Autenticación Global
 * Se ejecuta en todas las páginas para mantener la sesión activa
 */

class GlobalAuth {
    constructor() {
        this.tokenKey = 'fire_escape_jwt_token';
        this.init();
    }

    init() {
        console.log('🔐 GlobalAuth inicializando...');
        
        // Verificar si estamos en la página de login
        if (window.location.pathname === '/login.html') {
            console.log('🔐 En página de login, saltando verificación');
            return;
        }

        // Verificar autenticación
        this.checkAuth();
        
        // Configurar verificación periódica
        setInterval(() => this.checkAuth(), 5 * 60 * 1000); // Cada 5 minutos
    }

    async checkAuth() {
        try {
            const token = this.getToken();
            
            if (!token) {
                console.log('🔒 No hay token, redirigiendo a login');
                this.redirectToLogin();
                return;
            }

            // Verificar si el token es válido
            const isValid = await this.verifyToken(token);
            if (!isValid) {
                console.log('🔒 Token inválido, redirigiendo a login');
                this.clearToken();
                this.redirectToLogin();
                return;
            }

            console.log('✅ Autenticación válida');
        } catch (error) {
            console.error('❌ Error verificando autenticación:', error);
            this.redirectToLogin();
        }
    }

    getToken() {
        // 1. Intentar obtener de localStorage
        let token = localStorage.getItem(this.tokenKey);
        
        // 2. Si no está en localStorage, intentar de sessionStorage
        if (!token) {
            token = sessionStorage.getItem(this.tokenKey);
        }
        
        // 3. Si no está en sessionStorage, intentar de URL parameters
        if (!token) {
            const urlParams = new URLSearchParams(window.location.search);
            token = urlParams.get('token') || urlParams.get('access_token');
            
            // Si se encontró en URL, guardarlo en localStorage
            if (token) {
                console.log('🔑 Token encontrado en URL, guardando en localStorage');
                localStorage.setItem(this.tokenKey, token);
                
                // Limpiar URL
                const newUrl = new URL(window.location);
                newUrl.searchParams.delete('token');
                newUrl.searchParams.delete('access_token');
                newUrl.searchParams.delete('success');
                window.history.replaceState({}, document.title, newUrl.pathname);
            }
        }
        
        return token;
    }

    async verifyToken(token) {
        try {
            const response = await fetch('/auth/status', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            return data.authenticated === true;
        } catch (error) {
            console.error('Error verificando token:', error);
            return false;
        }
    }

    clearToken() {
        localStorage.removeItem(this.tokenKey);
        sessionStorage.removeItem(this.tokenKey);
        
        // También limpiar cookies
        document.cookie = `${this.tokenKey}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    redirectToLogin() {
        // Solo redirigir si no estamos ya en login
        if (window.location.pathname !== '/login.html') {
            console.log('🔄 Redirigiendo a login...');
            window.location.href = '/login.html';
        }
    }

    // Método para obtener token para uso en API calls
    getAuthToken() {
        return this.getToken();
    }

    // Método para verificar si está autenticado
    isAuthenticated() {
        return !!this.getToken();
    }
}

// Inicializar autenticación global cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.globalAuth = new GlobalAuth();
    });
} else {
    window.globalAuth = new GlobalAuth();
}

// Exportar para uso en otros módulos
window.GlobalAuth = GlobalAuth;
