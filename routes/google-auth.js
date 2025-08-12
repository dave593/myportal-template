const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const AccessControlSystem = require('../access-control-system');

/**
 * Rutas de Autenticación con Google OAuth
 * Desarrollado por 2Knock Media Group
 */
class GoogleAuthRoutes {
    constructor() {
        this.accessControl = new AccessControlSystem();
        this.authorizedUsers = [
            'david@iriasironworks.com',
            'newcustomers@iriasironworks.com',
            // Agregar más emails autorizados aquí
        ];
    }

    /**
     * Verificar si un email está autorizado
     */
    async isAuthorized(email) {
        console.log(`🔍 Verificando autorización para: ${email}`);
        
        // Primero verificar dominio autorizado
        if (!this.accessControl.isDomainAuthorized(email)) {
            console.log(`❌ Dominio no autorizado: ${email}`);
            return false;
        }

        // Luego verificar en el sistema de control de acceso
        const authResult = await this.accessControl.isUserAuthorized(email);
        console.log(`🔍 Resultado de autorización:`, authResult);
        
        return authResult.authorized;
    }

    /**
     * Generar JWT token
     */
    generateToken(user) {
        return jwt.sign(
            {
                id: user.email,
                email: user.email,
                name: user.name,
                picture: user.picture,
                role: 'user'
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
    }

    /**
     * Iniciar autenticación con Google
     */
    async initiateGoogleAuth(req, res) {
        try {
            let clientId, clientSecret;
            
            // Cargar credenciales desde variables de entorno
            clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
            clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
            
            console.log('🔍 Checking OAuth credentials...');
            console.log('Client ID:', clientId ? 'SET' : 'NOT SET');
            console.log('Client Secret:', clientSecret ? 'SET' : 'NOT SET');
            
            // Verificar si las credenciales están configuradas
            if (!clientId || clientId === 'your-google-client-id-here' || 
                !clientSecret || clientSecret === 'your-google-client-secret-here') {
                console.error('❌ Google OAuth credentials not configured');
                res.writeHead(302, { 'Location': '/login?error=oauth_not_configured' });
                return res.end();
            }
            
            const host = req.headers.host || 'fire-escape-reports-628784106563.us-central1.run.app';
            
            // Forzar HTTP para localhost en desarrollo
            let protocol = 'https';
            if (host.includes('localhost') || host.includes('127.0.0.1')) {
                protocol = 'http';
            } else {
                protocol = req.headers['x-forwarded-proto'] || 'https';
            }
            
            const redirectUri = `${protocol}://${host}/auth/google/callback`;
            
            const oauth2Client = new OAuth2Client(
                clientId,
                clientSecret,
                redirectUri
            );

            const scopes = [
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile'
            ];

            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                prompt: 'consent'
            });

            console.log('🔐 Iniciando autenticación con Google:', authUrl);
            res.writeHead(302, { 'Location': authUrl });
            res.end();
        } catch (error) {
            console.error('❌ Error iniciando autenticación con Google:', error);
            res.writeHead(302, { 'Location': '/login?error=auth_init_failed' });
            res.end();
        }
    }

    /**
     * Callback de Google OAuth
     */
    async handleGoogleCallback(req, res) {
        try {
            console.log('🔄 Starting Google callback...');
            const url = new URL(req.url, `http://${req.headers.host}`);
            const code = url.searchParams.get('code');
            
            console.log('🔄 Code received:', code ? 'YES' : 'NO');
            
            if (!code) {
                console.error('❌ No se recibió código de autorización');
                res.writeHead(302, { 'Location': '/login?error=no_auth_code' });
                return res.end();
            }

            let clientId, clientSecret;
            
            // Cargar credenciales desde variables de entorno
            clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
            clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
            
            const host = req.headers.host || 'fire-escape-reports-628784106563.us-central1.run.app';
            
            // Forzar HTTP para localhost en desarrollo
            let protocol = 'https';
            if (host.includes('localhost') || host.includes('127.0.0.1')) {
                protocol = 'http';
            } else {
                protocol = req.headers['x-forwarded-proto'] || 'https';
            }
            
            const redirectUri = `${protocol}://${host}/auth/google/callback`;
            
            const oauth2Client = new OAuth2Client(
                clientId,
                clientSecret,
                redirectUri
            );

            console.log('🔄 Exchanging code for tokens...');
            // Intercambiar código por tokens
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            console.log('🔄 Tokens received successfully');

            console.log('🔄 Getting user info...');
            // Obtener información del usuario
            const userinfo = await oauth2Client.request({
                url: 'https://www.googleapis.com/oauth2/v2/userinfo'
            });
            console.log('🔄 User info received:', userinfo.data.email);

            const user = {
                email: userinfo.data.email,
                name: userinfo.data.name,
                picture: userinfo.data.picture
            };

            console.log('👤 Usuario autenticado:', user.email);

            // Verificar si el usuario está autorizado
            const isAuthorized = await this.isAuthorized(user.email);
            if (!isAuthorized) {
                console.warn('⚠️ Usuario no autorizado intentó acceder:', user.email);
                
                // Intentar registrar al usuario si es de dominio autorizado
                if (this.accessControl.isDomainAuthorized(user.email)) {
                    const registrationResult = await this.accessControl.registerUser({
                        email: user.email,
                        name: user.name
                    });
                    
                    if (registrationResult.success) {
                        if (registrationResult.user.Status === 'Approved') {
                            console.log(`✅ Usuario auto-aprobado: ${user.email}`);
                        } else {
                            console.log(`📝 Usuario registrado pendiente de aprobación: ${user.email}`);
                            res.writeHead(302, { 'Location': '/login?error=pending_approval' });
                            return res.end();
                        }
                    } else {
                        console.log(`❌ Error registrando usuario: ${user.email} - ${registrationResult.message}`);
                        res.writeHead(302, { 'Location': '/login?error=registration_failed' });
                        return res.end();
                    }
                } else {
                    res.writeHead(302, { 'Location': '/login?error=unauthorized_domain' });
                    return res.end();
                }
            }

            // Generar JWT token
            const token = this.generateToken(user);

            console.log('✅ Usuario autenticado exitosamente:', user.email);

            // Establecer cookie con el token JWT para autenticación global
            const cookieOptions = {
                httpOnly: false, // Permitir acceso desde JavaScript
                secure: true,    // Solo HTTPS
                sameSite: 'lax', // Protección CSRF
                maxAge: 24 * 60 * 60 * 1000, // 24 horas
                path: '/'
            };

            // Redirigir al dashboard con JWT token en URL y cookie
            res.writeHead(302, { 
                'Location': `/dashboard-clientes.html?success=authenticated&token=${encodeURIComponent(token)}`,
                'Set-Cookie': `fire_escape_jwt_token=${token}; HttpOnly=false; Secure; SameSite=Lax; Max-Age=86400; Path=/`
            });
            res.end();
        } catch (error) {
            console.error('❌ Error en callback de Google:', error);
            res.writeHead(302, { 'Location': '/login?error=auth_callback_failed' });
            res.end();
        }
    }

    /**
     * Verificar estado de autenticación
     */
    async checkAuthStatus(req, res) {
        try {
            console.log('🔍 Checking auth status for user:', req.user?.email);
            
            if (!req.user) {
                console.log('❌ No user found in request');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    authenticated: false,
                    message: 'No autenticado'
                }));
                return;
            }

            // Verificar si el usuario sigue autorizado
            const isAuthorized = await this.isAuthorized(req.user.email);
            if (!isAuthorized) {
                console.log('❌ User not authorized:', req.user.email);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    authenticated: false,
                    message: 'Usuario no autorizado'
                }));
                return;
            }

            console.log('✅ User authenticated and authorized:', req.user.email);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                authenticated: true,
                user: req.user
            }));
        } catch (error) {
            console.error('❌ Error verificando estado de autenticación:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                authenticated: false,
                error: 'Error interno'
            }));
        }
    }

    /**
     * Cerrar sesión
     */
    async logout(req, res) {
        try {
            const userEmail = req.user?.email;
            
            console.log('👋 Usuario cerró sesión:', userEmail);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Sesión cerrada exitosamente'
            }));
        } catch (error) {
            console.error('❌ Error cerrando sesión:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Error cerrando sesión'
            }));
        }
    }

    /**
     * Middleware para proteger rutas
     */
    requireAuth() {
        return async (req, res, next) => {
            if (!req.user) {
                return res.redirect('/login');
            }

            const isAuthorized = await this.isAuthorized(req.user.email);
            if (!isAuthorized) {
                return res.redirect('/login?error=unauthorized');
            }

            next();
        };
    }

    /**
     * Middleware para API endpoints
     */
    requireApiAuth() {
        return (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                return res.status(401).json({
                    error: true,
                    message: 'Token de autenticación requerido'
                });
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                
                if (!this.isAuthorized(decoded.email)) {
                    return res.status(403).json({
                        error: true,
                        message: 'Usuario no autorizado'
                    });
                }

                req.user = decoded;
                next();
            } catch (error) {
                return res.status(401).json({
                    error: true,
                    message: 'Token inválido'
                });
            }
        };
    }
}

module.exports = GoogleAuthRoutes; 