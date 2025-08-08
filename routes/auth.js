const { helpers: securityHelpers } = require('../config/security');
const AuthMiddleware = require('../middleware/auth');
const ValidationMiddleware = require('../middleware/validation');
const SecurityMiddleware = require('../middleware/security');

/**
 * Authentication Routes
 * Handles user authentication, registration, and token management
 */
class AuthRoutes {
    constructor() {
        this.router = require('express').Router();
        this.setupRoutes();
    }

    setupRoutes() {
        // User registration
        this.router.post('/register',
            SecurityMiddleware.configureAuthRateLimit(),
            ValidationMiddleware.sanitizeInput,
            SecurityMiddleware.preventSQLInjection,
            SecurityMiddleware.preventXSS,
            ...ValidationMiddleware.userRegistrationRules(),
            ValidationMiddleware.handleValidationErrors,
            this.registerUser.bind(this)
        );

        // User login
        this.router.post('/login',
            SecurityMiddleware.configureAuthRateLimit(),
            ValidationMiddleware.sanitizeInput,
            SecurityMiddleware.preventSQLInjection,
            SecurityMiddleware.preventXSS,
            ...ValidationMiddleware.authenticationRules(),
            ValidationMiddleware.handleValidationErrors,
            this.loginUser.bind(this)
        );

        // Token refresh
        this.router.post('/refresh',
            SecurityMiddleware.configureAuthRateLimit(),
            ValidationMiddleware.sanitizeInput,
            SecurityMiddleware.preventSQLInjection,
            this.refreshToken.bind(this)
        );

        // Logout
        this.router.post('/logout',
            AuthMiddleware.authenticateToken,
            this.logout.bind(this)
        );

        // Change password
        this.router.post('/change-password',
            AuthMiddleware.authenticateToken,
            SecurityMiddleware.configureAuthRateLimit(),
            ValidationMiddleware.sanitizeInput,
            SecurityMiddleware.preventSQLInjection,
            SecurityMiddleware.preventXSS,
            ...ValidationMiddleware.passwordChangeRules(),
            ValidationMiddleware.handleValidationErrors,
            this.changePassword.bind(this)
        );

        // Get current user
        this.router.get('/me',
            AuthMiddleware.authenticateToken,
            this.getCurrentUser.bind(this)
        );

        // Verify token
        this.router.get('/verify',
            AuthMiddleware.optionalAuth,
            this.verifyToken.bind(this)
        );

        return this.router;
    }

    /**
     * Register a new user
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async registerUser(req, res) {
        try {
            const { fullName, email, password, confirmPassword, role, company } = req.body;

            // Check if user already exists (in a real app, this would check the database)
            const existingUser = this.findUserByEmail(email);
            if (existingUser) {
                return res.status(409).json({
                    error: true,
                    message: 'User with this email already exists',
                    code: 'USER_EXISTS'
                });
            }

            // Hash password
            const hashedPassword = await securityHelpers.hashPassword(password);

            // Create user object
            const user = {
                id: securityHelpers.generateSecureToken(16),
                fullName,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: role || 'user',
                company: company || 'Default Company',
                permissions: this.getDefaultPermissions(role || 'user'),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // In a real application, save to database
            // await db.createUser(user);

            // Generate tokens
            const accessToken = securityHelpers.generateJWT({
                id: user.id,
                email: user.email,
                role: user.role,
                company: user.company,
                permissions: user.permissions
            });

            const refreshToken = securityHelpers.generateRefreshToken({
                id: user.id,
                email: user.email,
                role: user.role,
                company: user.company,
                permissions: user.permissions
            });

            console.log(`[AUTH] New user registered: ${user.email}`, {
                ip: req.ip,
                role: user.role,
                timestamp: new Date().toISOString()
            });

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user: {
                        id: user.id,
                        fullName: user.fullName,
                        email: user.email,
                        role: user.role,
                        company: user.company,
                        permissions: user.permissions
                    },
                    accessToken,
                    refreshToken,
                    expiresIn: '24h'
                }
            });
        } catch (error) {
            console.error('[AUTH] Registration error:', error);
            res.status(500).json({
                error: true,
                message: 'Registration failed',
                code: 'REGISTRATION_ERROR'
            });
        }
    }

    /**
     * Login user
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async loginUser(req, res) {
        try {
            const { email, password } = req.body;

            // Find user (in a real app, this would query the database)
            const user = this.findUserByEmail(email);
            if (!user) {
                console.warn(`[AUTH] Login attempt with non-existent email: ${email}`, {
                    ip: req.ip,
                    timestamp: new Date().toISOString()
                });
                return res.status(401).json({
                    error: true,
                    message: 'Invalid email or password',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Verify password
            const isValidPassword = await securityHelpers.comparePassword(password, user.password);
            if (!isValidPassword) {
                console.warn(`[AUTH] Failed login attempt for user: ${email}`, {
                    ip: req.ip,
                    timestamp: new Date().toISOString()
                });
                return res.status(401).json({
                    error: true,
                    message: 'Invalid email or password',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Generate tokens
            const accessToken = securityHelpers.generateJWT({
                id: user.id,
                email: user.email,
                role: user.role,
                company: user.company,
                permissions: user.permissions
            });

            const refreshToken = securityHelpers.generateRefreshToken({
                id: user.id,
                email: user.email,
                role: user.role,
                company: user.company,
                permissions: user.permissions
            });

            console.log(`[AUTH] User logged in successfully: ${user.email}`, {
                ip: req.ip,
                role: user.role,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        id: user.id,
                        fullName: user.fullName,
                        email: user.email,
                        role: user.role,
                        company: user.company,
                        permissions: user.permissions
                    },
                    accessToken,
                    refreshToken,
                    expiresIn: '24h'
                }
            });
        } catch (error) {
            console.error('[AUTH] Login error:', error);
            res.status(500).json({
                error: true,
                message: 'Login failed',
                code: 'LOGIN_ERROR'
            });
        }
    }

    /**
     * Refresh access token
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    error: true,
                    message: 'Refresh token required',
                    code: 'MISSING_REFRESH_TOKEN'
                });
            }

            const decoded = securityHelpers.verifyRefreshToken(refreshToken);
            if (!decoded) {
                return res.status(403).json({
                    error: true,
                    message: 'Invalid or expired refresh token',
                    code: 'INVALID_REFRESH_TOKEN'
                });
            }

            // Find user (in a real app, this would query the database)
            const user = this.findUserById(decoded.id);
            if (!user) {
                return res.status(403).json({
                    error: true,
                    message: 'User not found',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Generate new tokens
            const newAccessToken = securityHelpers.generateJWT({
                id: user.id,
                email: user.email,
                role: user.role,
                company: user.company,
                permissions: user.permissions
            });

            const newRefreshToken = securityHelpers.generateRefreshToken({
                id: user.id,
                email: user.email,
                role: user.role,
                company: user.company,
                permissions: user.permissions
            });

            console.log(`[AUTH] Token refreshed for user: ${user.email}`, {
                ip: req.ip,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Tokens refreshed successfully',
                data: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresIn: '24h'
                }
            });
        } catch (error) {
            console.error('[AUTH] Token refresh error:', error);
            res.status(500).json({
                error: true,
                message: 'Token refresh failed',
                code: 'REFRESH_ERROR'
            });
        }
    }

    /**
     * Logout user
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async logout(req, res) {
        try {
            // In a real implementation, you would add tokens to a blacklist
            // For now, we'll just return success
            console.log(`[AUTH] User logged out: ${req.user.email}`, {
                ip: req.ip,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            console.error('[AUTH] Logout error:', error);
            res.status(500).json({
                error: true,
                message: 'Logout failed',
                code: 'LOGOUT_ERROR'
            });
        }
    }

    /**
     * Change user password
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            // Find user (in a real app, this would query the database)
            const user = this.findUserById(userId);
            if (!user) {
                return res.status(404).json({
                    error: true,
                    message: 'User not found',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Verify current password
            const isValidPassword = await securityHelpers.comparePassword(currentPassword, user.password);
            if (!isValidPassword) {
                return res.status(401).json({
                    error: true,
                    message: 'Current password is incorrect',
                    code: 'INVALID_CURRENT_PASSWORD'
                });
            }

            // Hash new password
            const hashedNewPassword = await securityHelpers.hashPassword(newPassword);

            // Update password (in a real app, this would update the database)
            user.password = hashedNewPassword;
            user.updatedAt = new Date().toISOString();

            console.log(`[AUTH] Password changed for user: ${user.email}`, {
                ip: req.ip,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Password changed successfully'
            });
        } catch (error) {
            console.error('[AUTH] Password change error:', error);
            res.status(500).json({
                error: true,
                message: 'Password change failed',
                code: 'PASSWORD_CHANGE_ERROR'
            });
        }
    }

    /**
     * Get current user information
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getCurrentUser(req, res) {
        try {
            const userId = req.user.id;

            // Find user (in a real app, this would query the database)
            const user = this.findUserById(userId);
            if (!user) {
                return res.status(404).json({
                    error: true,
                    message: 'User not found',
                    code: 'USER_NOT_FOUND'
                });
            }

            res.json({
                success: true,
                data: {
                    id: user.id,
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
                    company: user.company,
                    permissions: user.permissions,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt
                }
            });
        } catch (error) {
            console.error('[AUTH] Get current user error:', error);
            res.status(500).json({
                error: true,
                message: 'Failed to get user information',
                code: 'GET_USER_ERROR'
            });
        }
    }

    /**
     * Verify token validity
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async verifyToken(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    error: true,
                    message: 'Invalid or missing token',
                    code: 'INVALID_TOKEN'
                });
            }

            res.json({
                success: true,
                message: 'Token is valid',
                data: {
                    user: {
                        id: req.user.id,
                        email: req.user.email,
                        role: req.user.role,
                        company: req.user.company,
                        permissions: req.user.permissions
                    }
                }
            });
        } catch (error) {
            console.error('[AUTH] Token verification error:', error);
            res.status(500).json({
                error: true,
                message: 'Token verification failed',
                code: 'VERIFICATION_ERROR'
            });
        }
    }

    // Helper methods (in a real app, these would interact with a database)

    /**
     * Find user by email (demo implementation)
     * @param {string} email - User email
     * @returns {Object|null} User object or null
     */
    findUserByEmail(email) {
        // Demo users - in a real app, this would query a database
        const demoUsers = [
            {
                id: 'user_1',
                fullName: 'Admin User',
                email: 'admin@example.com',
                password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQJmHh2e', // password: Admin123!
                role: 'admin',
                company: 'Fire Escape Services',
                permissions: ['read', 'write', 'delete', 'admin'],
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            },
            {
                id: 'user_2',
                fullName: 'Inspector User',
                email: 'inspector@example.com',
                password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQJmHh2e', // password: Inspector123!
                role: 'inspector',
                company: 'Boston Fire Escapes',
                permissions: ['read', 'write'],
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        ];

        return demoUsers.find(user => user.email === email.toLowerCase()) || null;
    }

    /**
     * Find user by ID (demo implementation)
     * @param {string} id - User ID
     * @returns {Object|null} User object or null
     */
    findUserById(id) {
        const demoUsers = [
            {
                id: 'user_1',
                fullName: 'Admin User',
                email: 'admin@example.com',
                password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQJmHh2e',
                role: 'admin',
                company: 'Fire Escape Services',
                permissions: ['read', 'write', 'delete', 'admin'],
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            },
            {
                id: 'user_2',
                fullName: 'Inspector User',
                email: 'inspector@example.com',
                password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQJmHh2e',
                role: 'inspector',
                company: 'Boston Fire Escapes',
                permissions: ['read', 'write'],
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        ];

        return demoUsers.find(user => user.id === id) || null;
    }

    /**
     * Get default permissions for role
     * @param {string} role - User role
     * @returns {Array} Array of permissions
     */
    getDefaultPermissions(role) {
        const permissions = {
            admin: ['read', 'write', 'delete', 'admin'],
            inspector: ['read', 'write'],
            user: ['read']
        };

        return permissions[role] || ['read'];
    }
}

module.exports = new AuthRoutes().router; 