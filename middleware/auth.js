const { helpers: securityHelpers, config: securityConfig } = require('../config/security');

/**
 * JWT Authentication Middleware
 * Provides comprehensive authentication and authorization for API endpoints
 */
class AuthMiddleware {
    /**
     * Verify JWT token from Authorization header
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static authenticateToken(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

            if (!token) {
                return res.status(401).json({
                    error: true,
                    message: 'Access token required',
                    code: 'MISSING_TOKEN'
                });
            }

            const decoded = securityHelpers.verifyJWT(token);
            if (!decoded) {
                return res.status(403).json({
                    error: true,
                    message: 'Invalid or expired token',
                    code: 'INVALID_TOKEN'
                });
            }

            // Add user info to request
            req.user = {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
                company: decoded.company,
                permissions: decoded.permissions || []
            };

            // Log authentication success
            console.log(`[AUTH] User ${req.user.email} authenticated successfully`, {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date().toISOString()
            });

            next();
        } catch (error) {
            console.error('[AUTH] Authentication error:', error);
            return res.status(500).json({
                error: true,
                message: 'Authentication failed',
                code: 'AUTH_ERROR'
            });
        }
    }

    /**
     * Verify API key from headers
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static authenticateApiKey(req, res, next) {
        try {
            if (!securityConfig.api.apiKeyRequired) {
                return next();
            }

            const apiKey = req.headers[securityConfig.api.apiKeyHeader.toLowerCase()];
            
            if (!apiKey) {
                return res.status(401).json({
                    error: true,
                    message: 'API key required',
                    code: 'MISSING_API_KEY'
                });
            }

            // In a real implementation, you would validate against stored API keys
            // For now, we'll use a simple check against environment variable
            const validApiKey = process.env.API_KEY;
            if (!validApiKey || apiKey !== validApiKey) {
                return res.status(403).json({
                    error: true,
                    message: 'Invalid API key',
                    code: 'INVALID_API_KEY'
                });
            }

            next();
        } catch (error) {
            console.error('[AUTH] API key authentication error:', error);
            return res.status(500).json({
                error: true,
                message: 'API key authentication failed',
                code: 'API_KEY_ERROR'
            });
        }
    }

    /**
     * Check if user has required role
     * @param {string|Array} requiredRoles - Required role(s)
     * @returns {Function} Express middleware function
     */
    static requireRole(requiredRoles) {
        return (req, res, next) => {
            try {
                if (!req.user) {
                    return res.status(401).json({
                        error: true,
                        message: 'Authentication required',
                        code: 'AUTH_REQUIRED'
                    });
                }

                const userRole = req.user.role;
                const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

                if (!roles.includes(userRole)) {
                    console.warn(`[AUTH] Access denied: User ${req.user.email} (${userRole}) attempted to access role-restricted endpoint`, {
                        requiredRoles: roles,
                        userRole: userRole,
                        ip: req.ip,
                        timestamp: new Date().toISOString()
                    });

                    return res.status(403).json({
                        error: true,
                        message: 'Insufficient permissions',
                        code: 'INSUFFICIENT_PERMISSIONS'
                    });
                }

                next();
            } catch (error) {
                console.error('[AUTH] Role check error:', error);
                return res.status(500).json({
                    error: true,
                    message: 'Authorization check failed',
                    code: 'AUTH_CHECK_ERROR'
                });
            }
        };
    }

    /**
     * Check if user has required permission
     * @param {string|Array} requiredPermissions - Required permission(s)
     * @returns {Function} Express middleware function
     */
    static requirePermission(requiredPermissions) {
        return (req, res, next) => {
            try {
                if (!req.user) {
                    return res.status(401).json({
                        error: true,
                        message: 'Authentication required',
                        code: 'AUTH_REQUIRED'
                    });
                }

                const userPermissions = req.user.permissions || [];
                const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

                const hasPermission = permissions.some(permission => 
                    userPermissions.includes(permission)
                );

                if (!hasPermission) {
                    console.warn(`[AUTH] Access denied: User ${req.user.email} attempted to access permission-restricted endpoint`, {
                        requiredPermissions: permissions,
                        userPermissions: userPermissions,
                        ip: req.ip,
                        timestamp: new Date().toISOString()
                    });

                    return res.status(403).json({
                        error: true,
                        message: 'Insufficient permissions',
                        code: 'INSUFFICIENT_PERMISSIONS'
                    });
                }

                next();
            } catch (error) {
                console.error('[AUTH] Permission check error:', error);
                return res.status(500).json({
                    error: true,
                    message: 'Authorization check failed',
                    code: 'AUTH_CHECK_ERROR'
                });
            }
        };
    }

    /**
     * Check if user can access company-specific data
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static checkCompanyAccess(req, res, next) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    error: true,
                    message: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                });
            }

            const userCompany = req.user.company;
            const requestedCompany = req.params.company || req.query.company || req.body.company;

            // Admin users can access all companies
            if (req.user.role === 'admin') {
                return next();
            }

            // Users can only access their own company data
            if (requestedCompany && userCompany !== requestedCompany) {
                console.warn(`[AUTH] Company access denied: User ${req.user.email} (${userCompany}) attempted to access ${requestedCompany} data`, {
                    userCompany: userCompany,
                    requestedCompany: requestedCompany,
                    ip: req.ip,
                    timestamp: new Date().toISOString()
                });

                return res.status(403).json({
                    error: true,
                    message: 'Access denied to company data',
                    code: 'COMPANY_ACCESS_DENIED'
                });
            }

            next();
        } catch (error) {
            console.error('[AUTH] Company access check error:', error);
            return res.status(500).json({
                error: true,
                message: 'Company access check failed',
                code: 'COMPANY_CHECK_ERROR'
            });
        }
    }

    /**
     * Optional authentication - doesn't fail if no token provided
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static optionalAuth(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader && authHeader.split(' ')[1];

            if (token) {
                const decoded = securityHelpers.verifyJWT(token);
                if (decoded) {
                    req.user = {
                        id: decoded.id,
                        email: decoded.email,
                        role: decoded.role,
                        company: decoded.company,
                        permissions: decoded.permissions || []
                    };
                }
            }

            next();
        } catch (error) {
            // Don't fail on optional auth errors
            console.warn('[AUTH] Optional authentication error:', error);
            next();
        }
    }

    /**
     * Generate new access token using refresh token
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static refreshToken(req, res) {
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

            // Generate new access token
            const newAccessToken = securityHelpers.generateJWT({
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
                company: decoded.company,
                permissions: decoded.permissions
            });

            // Generate new refresh token
            const newRefreshToken = securityHelpers.generateRefreshToken({
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
                company: decoded.company,
                permissions: decoded.permissions
            });

            res.json({
                success: true,
                message: 'Tokens refreshed successfully',
                data: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresIn: securityConfig.jwt.expiresIn
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
     * Logout - invalidate tokens
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static logout(req, res) {
        try {
            // In a real implementation, you would add tokens to a blacklist
            // For now, we'll just return success
            console.log(`[AUTH] User ${req.user?.email || 'unknown'} logged out`, {
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
}

module.exports = AuthMiddleware; 