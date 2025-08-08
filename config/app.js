/**
 * Application Configuration
 * Centralized configuration for the Fire Escape Portal System
 */

module.exports = {
    // Server Configuration
    server: {
        port: process.env.PORT || 8080,
        host: process.env.HOST || 'localhost',
        environment: process.env.NODE_ENV || 'development',
        version: '2.0.0'
    },

    // Google Sheets Configuration
    googleSheets: {
        defaultSpreadsheetId: process.env.GOOGLE_SHEETS_ID || '13Fld-uJgwWuJVVxyEJoB9h7zAVbN2HlizV5udmT5XZU',
        defaultRange: 'Clientes e Inspecciones!A:AA', // Hoja correcta según gid=174672304
        cacheTimeout: 5 * 60 * 1000, // 5 minutes
        maxRetries: 3,
        retryDelay: 1000 // 1 second
    },

    // Security Configuration
    security: {
        cors: {
            origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            exposedHeaders: ['Content-Length', 'X-Requested-With'],
            maxAge: 86400
        },
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            skipSuccessfulRequests: false,
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false
        }
    },

    // File Upload Configuration
    upload: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
        uploadDir: './uploads',
        tempDir: './temp'
    },

    // PDF Generation Configuration
    pdf: {
        defaultQuality: 0.95,
        defaultFormat: 'A4',
        defaultOrientation: 'portrait',
        includePhotos: true,
        pageBreak: true
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.NODE_ENV === 'production' ? 'json' : 'simple',
        timestamp: true
    },

    // Cache Configuration
    cache: {
        enabled: true,
        defaultTTL: 5 * 60 * 1000, // 5 minutes
        maxSize: 100 // maximum number of cache entries
    },

    // Feature Flags
    features: {
        mockData: process.env.USE_MOCK_DATA === 'true',
        debugMode: process.env.NODE_ENV === 'development',
        analytics: process.env.ENABLE_ANALYTICS === 'true'
    }
}; 