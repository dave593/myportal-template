const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const { config: securityConfig } = require('../config/security');

/**
 * Security Middleware
 * Provides comprehensive security features including rate limiting, CORS, and security headers
 */
class SecurityMiddleware {
    /**
     * Configure CORS middleware
     * @returns {Function} CORS middleware function
     */
    static configureCORS() {
        return cors({
            origin: (origin, callback) => {
                // Allow requests with no origin (like mobile apps or curl requests)
                if (!origin) return callback(null, true);
                
                const allowedOrigins = securityConfig.cors.origin;
                
                if (allowedOrigins.includes('*')) {
                    return callback(null, true);
                }
                
                if (allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
                
                console.warn(`[SECURITY] CORS blocked request from origin: ${origin}`);
                return callback(new Error('Not allowed by CORS'));
            },
            credentials: securityConfig.cors.credentials,
            methods: securityConfig.cors.methods,
            allowedHeaders: securityConfig.cors.allowedHeaders,
            exposedHeaders: securityConfig.cors.exposedHeaders,
            maxAge: securityConfig.cors.maxAge,
            optionsSuccessStatus: 200
        });
    }

    /**
     * Configure Helmet security headers
     * @returns {Function} Helmet middleware function
     */
    static configureHelmet() {
        return helmet({
            contentSecurityPolicy: securityConfig.helmet.contentSecurityPolicy,
            hsts: securityConfig.helmet.hsts,
            noSniff: securityConfig.helmet.noSniff,
            xssFilter: securityConfig.helmet.xssFilter,
            frameguard: securityConfig.helmet.frameguard,
            referrerPolicy: securityConfig.helmet.referrerPolicy,
            hidePoweredBy: true,
            ieNoOpen: true,
            permittedCrossDomainPolicies: {
                permittedPolicies: "none"
            }
        });
    }

    /**
     * Configure rate limiting middleware
     * @param {Object} options - Rate limiting options
     * @returns {Function} Rate limiting middleware function
     */
    static configureRateLimit(options = {}) {
        const defaultOptions = {
            windowMs: securityConfig.rateLimit.windowMs,
            max: securityConfig.rateLimit.max,
            skipSuccessfulRequests: securityConfig.rateLimit.skipSuccessfulRequests,
            message: securityConfig.rateLimit.message,
            standardHeaders: securityConfig.rateLimit.standardHeaders,
            legacyHeaders: securityConfig.rateLimit.legacyHeaders,
            handler: (req, res) => {
                console.warn(`[SECURITY] Rate limit exceeded for IP: ${req.ip}`, {
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    timestamp: new Date().toISOString()
                });
                
                res.status(429).json({
                    error: true,
                    message: 'Too many requests from this IP, please try again later.',
                    retryAfter: Math.ceil(securityConfig.rateLimit.windowMs / 1000)
                });
            }
        };

        return rateLimit({ ...defaultOptions, ...options });
    }

    /**
     * Strict rate limiting for authentication endpoints
     * @returns {Function} Rate limiting middleware function
     */
    static configureAuthRateLimit() {
        return this.configureRateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // limit each IP to 5 requests per windowMs
            skipSuccessfulRequests: false,
            message: {
                error: true,
                message: 'Too many authentication attempts, please try again later.',
                retryAfter: 900
            }
        });
    }

    /**
     * Rate limiting for file uploads
     * @returns {Function} Rate limiting middleware function
     */
    static configureUploadRateLimit() {
        return this.configureRateLimit({
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 10, // limit each IP to 10 uploads per hour
            skipSuccessfulRequests: false,
            message: {
                error: true,
                message: 'Too many file uploads, please try again later.',
                retryAfter: 3600
            }
        });
    }

    /**
     * Rate limiting for API endpoints
     * @returns {Function} Rate limiting middleware function
     */
    static configureAPIRateLimit() {
        return this.configureRateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            skipSuccessfulRequests: true,
            message: {
                error: true,
                message: 'Too many API requests, please try again later.',
                retryAfter: 900
            }
        });
    }

    /**
     * Security headers middleware
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static securityHeaders(req, res, next) {
        // Remove server information
        res.removeHeader('X-Powered-By');
        
        // Add custom security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        
        // Add request ID for tracking
        req.requestId = this.generateRequestId();
        res.setHeader('X-Request-ID', req.requestId);
        
        next();
    }

    /**
     * Request logging middleware
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static requestLogger(req, res, next) {
        const startTime = Date.now();
        
        // Log request
        console.log(`[REQUEST] ${req.method} ${req.url}`, {
            requestId: req.requestId,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString()
        });

        // Override res.end to log response
        const originalEnd = res.end;
        res.end = function(chunk, encoding) {
            const duration = Date.now() - startTime;
            
            console.log(`[RESPONSE] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`, {
                requestId: req.requestId,
                statusCode: res.statusCode,
                duration: duration,
                timestamp: new Date().toISOString()
            });

            originalEnd.call(this, chunk, encoding);
        };

        next();
    }

    /**
     * IP address validation middleware
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static validateIP(req, res, next) {
        const clientIP = req.ip || req.connection.remoteAddress;
        
        // Check for private IP addresses (for development)
        if (securityConfig.environment.isDevelopment) {
            return next();
        }

        // Block private IP addresses in production
        const privateIPRanges = [
            /^10\./,
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
            /^192\.168\./,
            /^127\./,
            /^::1$/
        ];

        const isPrivateIP = privateIPRanges.some(range => range.test(clientIP));
        
        // Allow localhost for development
        if (isPrivateIP && clientIP !== '::1' && clientIP !== '127.0.0.1') {
            console.warn(`[SECURITY] Blocked request from private IP: ${clientIP}`);
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: true,
                message: 'Access denied from private IP address',
                code: 'PRIVATE_IP_BLOCKED'
            }));
            return;
        }

        next();
    }

    /**
     * Request size validation middleware
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static validateRequestSize(req, res, next) {
        const contentLength = parseInt(req.headers['content-length'] || '0');
        const maxSize = parseInt(securityConfig.api.maxRequestSize.replace('mb', '')) * 1024 * 1024;

        if (contentLength > maxSize) {
            console.warn(`[SECURITY] Request too large: ${contentLength} bytes from IP: ${req.ip}`);
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: true,
                message: 'Request entity too large',
                code: 'REQUEST_TOO_LARGE'
            }));
            return;
        }

        next();
    }

    /**
     * File upload security middleware
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static validateFileUpload(req, res, next) {
        if (!req.files && !req.file) {
            return next();
        }

        const files = req.files || [req.file];
        
        for (const file of files) {
            // Check file type
            if (!securityConfig.fileUpload.allowedTypes.includes(file.mimetype)) {
                console.warn(`[SECURITY] Invalid file type uploaded: ${file.mimetype} from IP: ${req.ip}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: true,
                    message: 'Invalid file type',
                    code: 'INVALID_FILE_TYPE',
                    allowedTypes: securityConfig.fileUpload.allowedTypes
                }));
                return;
            }

            // Check file size
            if (file.size > securityConfig.fileUpload.maxFileSize) {
                console.warn(`[SECURITY] File too large uploaded: ${file.size} bytes from IP: ${req.ip}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: true,
                    message: 'File too large',
                    code: 'FILE_TOO_LARGE',
                    maxSize: securityConfig.fileUpload.maxFileSize
                }));
                return;
            }

            // Check file extension
            const allowedExtensions = securityConfig.fileUpload.allowedTypes.map(type => {
                const parts = type.split('/');
                return parts[1] ? `.${parts[1]}` : '';
            }).filter(ext => ext);

            const fileExtension = file.originalname ? 
                file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.')) : '';

            if (allowedExtensions.length > 0 && !allowedExtensions.includes(fileExtension)) {
                console.warn(`[SECURITY] Invalid file extension uploaded: ${fileExtension} from IP: ${req.ip}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: true,
                    message: 'Invalid file extension',
                    code: 'INVALID_FILE_EXTENSION',
                    allowedExtensions: allowedExtensions
                }));
                return;
            }
        }

        next();
    }

    /**
     * SQL injection prevention middleware
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static preventSQLInjection(req, res, next) {
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
            /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
            /(\b(OR|AND)\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i,
            /(--|\/\*|\*\/|;)/,
            /(\b(WAITFOR|DELAY)\b)/i
        ];

        const checkValue = (value) => {
            if (typeof value !== 'string') return false;
            return sqlPatterns.some(pattern => pattern.test(value));
        };

        // Check body
        if (req.body) {
            for (const [key, value] of Object.entries(req.body)) {
                if (checkValue(value)) {
                    console.warn(`[SECURITY] Potential SQL injection detected in body.${key}: ${value} from IP: ${req.ip}`);
                    return res.status(400).json({
                        error: true,
                        message: 'Invalid input detected',
                        code: 'INVALID_INPUT'
                    });
                }
            }
        }

        // Check query parameters
        if (req.query) {
            for (const [key, value] of Object.entries(req.query)) {
                if (checkValue(value)) {
                    console.warn(`[SECURITY] Potential SQL injection detected in query.${key}: ${value} from IP: ${req.ip}`);
                    return res.status(400).json({
                        error: true,
                        message: 'Invalid input detected',
                        code: 'INVALID_INPUT'
                    });
                }
            }
        }

        // Check URL parameters
        if (req.params) {
            for (const [key, value] of Object.entries(req.params)) {
                if (checkValue(value)) {
                    console.warn(`[SECURITY] Potential SQL injection detected in params.${key}: ${value} from IP: ${req.ip}`);
                    return res.status(400).json({
                        error: true,
                        message: 'Invalid input detected',
                        code: 'INVALID_INPUT'
                    });
                }
            }
        }

        next();
    }

    /**
     * XSS prevention middleware
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static preventXSS(req, res, next) {
        const xssPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
            /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
            /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
        ];

        const checkValue = (value) => {
            if (typeof value !== 'string') return false;
            return xssPatterns.some(pattern => pattern.test(value));
        };

        // Check body
        if (req.body) {
            for (const [key, value] of Object.entries(req.body)) {
                if (checkValue(value)) {
                    console.warn(`[SECURITY] Potential XSS detected in body.${key}: ${value} from IP: ${req.ip}`);
                    return res.status(400).json({
                        error: true,
                        message: 'Invalid input detected',
                        code: 'INVALID_INPUT'
                    });
                }
            }
        }

        // Check query parameters
        if (req.query) {
            for (const [key, value] of Object.entries(req.query)) {
                if (checkValue(value)) {
                    console.warn(`[SECURITY] Potential XSS detected in query.${key}: ${value} from IP: ${req.ip}`);
                    return res.status(400).json({
                        error: true,
                        message: 'Invalid input detected',
                        code: 'INVALID_INPUT'
                    });
                }
            }
        }

        next();
    }

    /**
     * Generate unique request ID
     * @returns {string} Request ID
     */
    static generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Error handling middleware
     * @param {Error} error - Error object
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static errorHandler(error, req, res, next) {
        console.error(`[ERROR] ${error.message}`, {
            requestId: req.requestId,
            ip: req.ip,
            url: req.url,
            method: req.method,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // Don't expose internal errors in production
        const isProduction = securityConfig.environment.isProduction;
        
        res.status(error.status || 500).json({
            error: true,
            message: isProduction ? 'Internal server error' : error.message,
            code: error.code || 'INTERNAL_ERROR',
            ...(isProduction ? {} : { stack: error.stack })
        });
    }
}

module.exports = SecurityMiddleware; 