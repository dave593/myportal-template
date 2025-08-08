require('dotenv').config();

const securityConfig = {
    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-change-in-production',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        algorithm: 'HS256'
    },

    // Rate Limiting Configuration
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
        skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
        message: {
            error: true,
            message: 'Too many requests from this IP, please try again later.',
            retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false
    },

    // CORS Configuration
    cors: {
        origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:8080'],
        credentials: process.env.CORS_CREDENTIALS === 'true',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
        exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
        maxAge: 86400 // 24 hours
    },

    // Helmet Security Headers Configuration
    helmet: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: []
            }
        },
        hsts: {
            maxAge: parseInt(process.env.HELMET_HSTS_MAX_AGE) || 31536000,
            includeSubDomains: process.env.HELMET_HSTS_INCLUDE_SUBDOMAINS === 'true',
            preload: process.env.HELMET_HSTS_PRELOAD === 'true'
        },
        noSniff: true,
        xssFilter: true,
        frameguard: {
            action: 'deny'
        },
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin'
        }
    },

    // Session Configuration
    session: {
        secret: process.env.SESSION_SECRET || 'fallback-session-secret-change-in-production',
        cookie: {
            secure: process.env.SESSION_COOKIE_SECURE === 'true',
            httpOnly: process.env.SESSION_COOKIE_HTTPONLY !== 'false',
            sameSite: process.env.SESSION_COOKIE_SAMESITE || 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        },
        resave: false,
        saveUninitialized: false,
        name: 'sessionId'
    },

    // File Upload Security
    fileUpload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
        allowedTypes: process.env.ALLOWED_FILE_TYPES ? process.env.ALLOWED_FILE_TYPES.split(',') : [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf'
        ],
        uploadPath: process.env.UPLOAD_PATH || './uploads',
        maxFiles: 10
    },

    // Input Validation Rules
    validation: {
        email: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Please provide a valid email address'
        },
        phone: {
            pattern: /^[\+]?[1-9][\d]{0,15}$/,
            message: 'Please provide a valid phone number'
        },
        password: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            message: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
        },
        clientName: {
            minLength: 2,
            maxLength: 100,
            pattern: /^[a-zA-Z\s\-']+$/,
            message: 'Client name must be between 2 and 100 characters and contain only letters, spaces, hyphens, and apostrophes'
        }
    },

    // API Security
    api: {
        requireAuth: true,
        apiKeyHeader: 'X-API-Key',
        apiKeyRequired: false,
        maxRequestSize: '10mb',
        timeout: 30000 // 30 seconds
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || './logs/app.log',
        maxSize: '10m',
        maxFiles: 5,
        format: 'combined'
    },

    // Environment-specific settings
    environment: {
        isProduction: process.env.NODE_ENV === 'production',
        isDevelopment: process.env.NODE_ENV === 'development',
        isTest: process.env.NODE_ENV === 'test'
    }
};

// Validation helper functions
const validators = {
    isValidEmail: (email) => {
        return securityConfig.validation.email.pattern.test(email);
    },

    isValidPhone: (phone) => {
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        return securityConfig.validation.phone.pattern.test(cleanPhone);
    },

    isValidPassword: (password) => {
        const { minLength, requireUppercase, requireLowercase, requireNumbers, requireSpecialChars } = securityConfig.validation.password;
        
        if (password.length < minLength) return false;
        if (requireUppercase && !/[A-Z]/.test(password)) return false;
        if (requireLowercase && !/[a-z]/.test(password)) return false;
        if (requireNumbers && !/\d/.test(password)) return false;
        if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
        
        return true;
    },

    isValidClientName: (name) => {
        const { minLength, maxLength, pattern } = securityConfig.validation.clientName;
        return name.length >= minLength && 
               name.length <= maxLength && 
               pattern.test(name);
    },

    sanitizeInput: (input) => {
        if (typeof input !== 'string') return input;
        return input
            .trim()
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .substring(0, 1000); // Limit length
    },

    validateFileType: (mimetype) => {
        return securityConfig.fileUpload.allowedTypes.includes(mimetype);
    },

    validateFileSize: (size) => {
        return size <= securityConfig.fileUpload.maxFileSize;
    }
};

// Security middleware helpers
const securityHelpers = {
    generateSecureToken: (length = 32) => {
        const crypto = require('crypto');
        return crypto.randomBytes(length).toString('hex');
    },

    hashPassword: async (password) => {
        const bcrypt = require('bcryptjs');
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    },

    comparePassword: async (password, hash) => {
        const bcrypt = require('bcryptjs');
        return await bcrypt.compare(password, hash);
    },

    generateJWT: (payload) => {
        const jwt = require('jsonwebtoken');
        return jwt.sign(payload, securityConfig.jwt.secret, {
            expiresIn: securityConfig.jwt.expiresIn,
            algorithm: securityConfig.jwt.algorithm
        });
    },

    verifyJWT: (token) => {
        const jwt = require('jsonwebtoken');
        try {
            return jwt.verify(token, securityConfig.jwt.secret, {
                algorithms: [securityConfig.jwt.algorithm]
            });
        } catch (error) {
            return null;
        }
    },

    generateRefreshToken: (payload) => {
        const jwt = require('jsonwebtoken');
        return jwt.sign(payload, securityConfig.jwt.refreshSecret, {
            expiresIn: securityConfig.jwt.refreshExpiresIn,
            algorithm: securityConfig.jwt.algorithm
        });
    },

    verifyRefreshToken: (token) => {
        const jwt = require('jsonwebtoken');
        try {
            return jwt.verify(token, securityConfig.jwt.refreshSecret, {
                algorithms: [securityConfig.jwt.algorithm]
            });
        } catch (error) {
            return null;
        }
    }
};

module.exports = {
    config: securityConfig,
    validators,
    helpers: securityHelpers
}; 