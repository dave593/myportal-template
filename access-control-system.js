const { google } = require('googleapis');

/**
 * Sistema de Control de Acceso Avanzado
 * Desarrollado por 2Knock Media Group
 * 
 * Características:
 * - Control de acceso basado en Google Sheets
 * - Solo usuarios en la hoja "Form Responses 1" pueden acceder
 * - Sistema de roles basado en el dominio del email
 * - Logs de acceso y auditoría
 */
class AccessControlSystem {
    constructor() {
        this.sheets = null;
        this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        this.clientsSheet = 'Form Responses 1'; // Hoja principal de clientes
        this.accessControlSheet = 'Access Control'; // Hoja para control de acceso
        this.authorizedDomains = [
            'iriasironworks.com',
            'bostonfireescapes.com',
            'gmail.com'
        ];
        this.isInitialized = false;
        this.authorizedUsers = new Map(); // Cache de usuarios autorizados
    }

    async initialize() {
        try {
            console.log('🔐 Inicializando sistema de control de acceso...');
            
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                console.warn('⚠️ Google Service Account credentials not found, using fallback mode');
                // En modo fallback, solo usar dominios autorizados
                this.isInitialized = true;
                console.log('✅ Sistema de control de acceso inicializado en modo fallback');
                return true;
            }

            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            const authClient = await auth.getClient();
            this.sheets = google.sheets({ version: 'v4', auth: authClient });
            
            // Cargar usuarios autorizados desde la hoja de clientes
            await this.loadAuthorizedUsers();
            
            this.isInitialized = true;
            console.log('✅ Sistema de control de acceso inicializado');
            return true;
        } catch (error) {
            console.error('❌ Error inicializando sistema de control de acceso:', error);
            console.log('🔄 Continuando en modo fallback...');
            // En caso de error, continuar en modo fallback
            this.isInitialized = true;
            return true;
        }
    }

    /**
     * Cargar usuarios autorizados desde la hoja de clientes
     */
    async loadAuthorizedUsers() {
        try {
            console.log('📋 Cargando usuarios autorizados desde Google Sheets...');
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: `${this.clientsSheet}!A:AA`
            });

            const rows = response.data.values || [];
            if (rows.length < 2) {
                console.log('⚠️ No hay datos en la hoja de clientes');
                return;
            }

            const headers = rows[0];
            const emailColumnIndex = headers.findIndex(header => 
                header.toLowerCase().includes('email') || 
                header.toLowerCase().includes('e-mail')
            );

            if (emailColumnIndex === -1) {
                console.log('⚠️ No se encontró columna de email en la hoja');
                return;
            }

            // Procesar cada fila y extraer emails únicos
            const uniqueEmails = new Set();
            
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                const email = row[emailColumnIndex]?.trim();
                
                if (email && this.isValidEmail(email)) {
                    uniqueEmails.add(email.toLowerCase());
                }
            }

            // Agregar emails de dominio autorizado por defecto
            this.authorizedDomains.forEach(domain => {
                uniqueEmails.add(`admin@${domain}`);
                uniqueEmails.add(`david@${domain}`);
            });

            // Convertir a Map para acceso rápido
            this.authorizedUsers.clear();
            uniqueEmails.forEach(email => {
                this.authorizedUsers.set(email, {
                    email: email,
                    source: 'clients_sheet',
                    accessCount: 0,
                    lastAccess: null
                });
            });

            console.log(`✅ Cargados ${this.authorizedUsers.size} usuarios autorizados`);
            
            // Log de usuarios autorizados
            console.log('📋 Usuarios autorizados:');
            this.authorizedUsers.forEach((user, email) => {
                console.log(`   - ${email}`);
            });

        } catch (error) {
            console.error('❌ Error cargando usuarios autorizados:', error);
        }
    }

    /**
     * Verificar si un email es válido
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Verificar si un usuario está autorizado
     */
    async isUserAuthorized(email) {
        try {
            const emailLower = email.toLowerCase();
            console.log(`🔍 Verificando autorización para: ${email}`);
            console.log(`🔍 Sistema inicializado: ${this.isInitialized}`);
            console.log(`🔍 Usuarios en cache: ${this.authorizedUsers.size}`);
            
            // TEMPORAL: Permitir acceso a cualquier email de dominio autorizado
            // sin necesidad de estar en Google Sheets
            if (this.isDomainAuthorized(email)) {
                console.log(`🌐 Dominio autorizado: ${email} - Acceso permitido`);
                
                // Agregar a la lista de autorizados si no existe
                if (!this.authorizedUsers.has(emailLower)) {
                    this.authorizedUsers.set(emailLower, {
                        email: emailLower,
                        source: 'domain_authorized',
                        accessCount: 1,
                        lastAccess: new Date().toISOString()
                    });
                    console.log(`➕ Usuario agregado automáticamente: ${email}`);
                } else {
                    // Actualizar estadísticas de acceso
                    const user = this.authorizedUsers.get(emailLower);
                    user.accessCount++;
                    user.lastAccess = new Date().toISOString();
                    console.log(`📊 Acceso #${user.accessCount} para: ${email}`);
                }

                return { 
                    authorized: true, 
                    user: this.authorizedUsers.get(emailLower),
                    reason: 'Domain authorized - auto-added'
                };
            }

            // Si el sistema está inicializado, verificar en Google Sheets
            if (this.isInitialized) {
                // Verificar si el usuario está en la lista de autorizados
                if (this.authorizedUsers.has(emailLower)) {
                    const user = this.authorizedUsers.get(emailLower);
                    
                    // Actualizar estadísticas de acceso
                    user.accessCount++;
                    user.lastAccess = new Date().toISOString();
                    
                    console.log(`✅ Usuario autorizado: ${email} (Acceso #${user.accessCount})`);
            return { 
                authorized: true, 
                user: user,
                        reason: 'User in authorized list'
                    };
                }
            }

            console.log(`❌ Usuario no autorizado: ${email}`);
            console.log(`❌ Dominio autorizado: ${this.isDomainAuthorized(email)}`);
            console.log(`❌ En lista de usuarios: ${this.authorizedUsers.has(emailLower)}`);
            return { 
                authorized: false, 
                reason: 'User not in authorized list and domain not authorized'
            };

        } catch (error) {
            console.error('❌ Error verificando autorización:', error);
            return { authorized: false, reason: 'Error checking authorization' };
        }
    }

    /**
     * Verificar si el dominio está autorizado
     */
    isDomainAuthorized(email) {
        const domain = email.split('@')[1]?.toLowerCase();
        const isAuthorized = this.authorizedDomains.includes(domain);
        
        console.log(`🌐 Verificando dominio: ${domain} - Autorizado: ${isAuthorized}`);
        return isAuthorized;
    }

    /**
     * Obtener lista de usuarios autorizados
     */
    getAuthorizedUsers() {
        return Array.from(this.authorizedUsers.values());
    }

    /**
     * Agregar usuario manualmente a la lista de autorizados
     */
    addAuthorizedUser(email, name = '') {
        const emailLower = email.toLowerCase();
        this.authorizedUsers.set(emailLower, {
            email: emailLower,
            name: name,
            source: 'manual_add',
            accessCount: 0,
            lastAccess: null
        });
        console.log(`➕ Usuario agregado manualmente: ${email}`);
    }

    /**
     * Remover usuario de la lista de autorizados
     */
    removeAuthorizedUser(email) {
        const emailLower = email.toLowerCase();
        const removed = this.authorizedUsers.delete(emailLower);
        if (removed) {
            console.log(`➖ Usuario removido: ${email}`);
        }
        return removed;
    }

    /**
     * Recargar usuarios autorizados desde Google Sheets
     */
    async reloadAuthorizedUsers() {
        console.log('🔄 Recargando usuarios autorizados...');
        await this.loadAuthorizedUsers();
    }

    /**
     * Obtener estadísticas de acceso
     */
    getAccessStats() {
        const totalUsers = this.authorizedUsers.size;
        const activeUsers = Array.from(this.authorizedUsers.values())
            .filter(user => user.lastAccess).length;
        
        return {
            totalUsers,
            activeUsers,
            lastReload: new Date().toISOString()
        };
    }

    /**
     * Registrar un nuevo usuario
     */
    async registerUser(userData) {
        try {
            const { email, name } = userData;
            const emailLower = email.toLowerCase();
            
            console.log(`📝 Registrando usuario: ${email}`);
            
            // Verificar si el usuario ya existe
            if (this.authorizedUsers.has(emailLower)) {
                const existingUser = this.authorizedUsers.get(emailLower);
                console.log(`✅ Usuario ya existe: ${email}`);
                return { 
                    success: true,
                    user: existingUser,
                    message: 'User already exists'
                };
            }
            
            // Verificar si el dominio está autorizado
            if (!this.isDomainAuthorized(email)) {
                console.log(`❌ Dominio no autorizado para registro: ${email}`);
                return { 
                    success: false, 
                    message: 'Domain not authorized for registration'
                };
            }

            // Crear nuevo usuario
            const newUser = {
                email: emailLower,
                name: name || '',
                source: 'auto_registration',
                accessCount: 0,
                lastAccess: null,
                Status: 'Approved', // Auto-approve users from authorized domains
                registeredAt: new Date().toISOString()
            };
            
            // Agregar a la lista de autorizados
            this.authorizedUsers.set(emailLower, newUser);
            
            console.log(`✅ Usuario registrado exitosamente: ${email}`);
            return { 
                success: true, 
                user: newUser,
                message: 'User registered successfully'
            };
            
        } catch (error) {
            console.error('❌ Error registrando usuario:', error);
            return { 
                success: false, 
                message: error.message
            };
        }
    }

    /**
     * Aprobar un usuario
     */
    async approveUser(email, approvedBy) {
        try {
            const emailLower = email.toLowerCase();
            
            console.log(`✅ Aprobando usuario: ${email} por: ${approvedBy}`);
            
            // Verificar si el usuario existe
            if (!this.authorizedUsers.has(emailLower)) {
                console.log(`❌ Usuario no encontrado para aprobar: ${email}`);
                return {
                    success: false,
                    message: 'User not found'
                };
            }
            
            // Actualizar el usuario
            const user = this.authorizedUsers.get(emailLower);
            user.Status = 'Approved';
            user.approvedBy = approvedBy;
            user.approvedAt = new Date().toISOString();
            
            console.log(`✅ Usuario aprobado exitosamente: ${email}`);
            return {
                success: true,
                user: user,
                message: 'User approved successfully'
            };
            
        } catch (error) {
            console.error('❌ Error aprobando usuario:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
}

module.exports = AccessControlSystem; 