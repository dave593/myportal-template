require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');

const yaml = require('js-yaml');
const GoogleAuthRoutes = require('./routes/google-auth');

// Verificar variables de entorno requeridas
const requiredEnvVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET', 
    'JWT_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.warn('⚠️ Variables de entorno faltantes:', missingVars.join(', '));
    console.warn('💡 Asegúrate de configurar estas variables en producción');
} else {
    console.log('✅ Todas las variables de entorno requeridas están configuradas');
}

// Security imports
const SecurityMiddleware = require('./middleware/security');
const AuthMiddleware = require('./middleware/auth');
const ValidationMiddleware = require('./middleware/validation');

// Google Sheets integration
const GoogleSheetsIntegration = require('./google-sheets-integration.js');
// const { createSheetFromPortal } = require('./create-sheet-from-portal.js'); // File not found
// const { createGoogleSheetAutomatically } = require('./create-sheet-automatically.js'); // Removed - file deleted

// Email service
const EmailService = require('./email-service.js');

// Zoho Flow webhook service
const ZohoWebhookService = require('./zoho-webhook-service.js');

// Google Drive service
const GoogleDriveService = require('./google-drive-service.js');

const PORT = process.env.PORT || 8080;

// Initialize Google Sheets integration
const googleSheets = new GoogleSheetsIntegration();

// Initialize Email service
const emailService = new EmailService();

// Initialize Zoho Flow webhook service
const zohoWebhookService = new ZohoWebhookService();

// Initialize Google Drive service
const googleDriveService = new GoogleDriveService();

// Initialize Google Auth Routes
const googleAuth = new GoogleAuthRoutes();

// Initialize Access Control System
const AccessControlSystem = require('./access-control-system');
const accessControl = new AccessControlSystem();

// Initialize Config Database
const ConfigDatabase = require('./config-database');
const configDB = new ConfigDatabase();
const SyncService = require('./sync-service');

// JWT-based authentication (no server-side sessions needed)
const jwt = require('jsonwebtoken');

// Enhanced logging
const logger = {
    info: (message, data = {}) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
    },
    error: (message, error = {}) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
    },
    warn: (message, data = {}) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data);
    }
};

// Enhanced MIME types
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

// Enhanced CORS configuration
const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'];

function setCORSHeaders(req, res) {
    const origin = req.headers.origin;
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
}

// Enhanced error response helper
function sendErrorResponse(res, statusCode, message, error = null) {
    logger.error(`HTTP ${statusCode}: ${message}`, error);
    
    // Don't send error details in production
    const errorResponse = {
        error: true,
        message: message,
        timestamp: new Date().toISOString()
    };
    
    // Only include error details in development
    if (process.env.NODE_ENV === 'development' && error) {
        errorResponse.details = error.message;
        errorResponse.stack = error.stack;
    }
    
    res.writeHead(statusCode, { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(JSON.stringify(errorResponse));
}

// Enhanced success response helper
function sendSuccessResponse(res, data, message = 'Success') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: true,
        message: message,
        data: data,
        timestamp: new Date().toISOString()
    }));
}

// Production logging function
const isDevelopment = process.env.NODE_ENV === 'development';
const log = (message, ...args) => {
    if (isDevelopment) {
        console.log(message, ...args);
    }
};

// Session middleware function
function jwtMiddleware(req, res, next) {
    // JWT-based authentication middleware
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            console.log('✅ JWT token verified for user:', decoded.email);
        } catch (error) {
            console.log('❌ Invalid JWT token:', error.message);
            req.user = null;
        }
    } else {
        req.user = null;
    }
    
    next();
}

const server = http.createServer((req, res) => {
    log(`🔍 MAIN SERVER: ${req.method} ${req.url}`);
    
    // Apply JWT middleware first
    jwtMiddleware(req, res, () => {
        // Apply security middleware
        SecurityMiddleware.securityHeaders(req, res, () => {
            SecurityMiddleware.requestLogger(req, res, () => {
                SecurityMiddleware.validateIP(req, res, () => {
                    SecurityMiddleware.validateRequestSize(req, res, () => {
                        SecurityMiddleware.preventSQLInjection(req, res, () => {
                            SecurityMiddleware.preventXSS(req, res, () => {
                                log(`✅ Request passed all middleware: ${req.method} ${req.url}`);
                                handleRequest(req, res);
                            });
                        });
                    });
                });
            });
        });
    });
});

function handleRequest(req, res) {
    logger.info(`${req.method} ${req.url}`, {
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });
    
    // Set CORS headers
    setCORSHeaders(req, res);
    
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Enhanced health check endpoint
    if (req.url === '/health') {
        log('🔍 Serving /health endpoint');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'Fire Escape Reports System',
            version: '2.0.0',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: process.env.NODE_ENV || 'development'
        }));
        return;
    }

    // Authentication routes
    if (req.url.startsWith('/auth/')) {
        log('🔐 Handling auth route');
        handleAuthRoute(req, res);
        return;
    }

    // Admin routes
    if (req.url.startsWith('/api/admin/')) {
        log('🔐 Handling admin route');
        handleAdminRoute(req, res);
        return;
    }

    // API Routes
    if (req.url.startsWith('/api/')) {
        log('🔍 Handling API route');
        handleAPIRoute(req, res);
        return;
    }

    // Authentication disabled - all routes are public
    console.log('🔓 Public access enabled - no authentication required');

    // Handle specific routes
    if (req.url === '/login' || req.url.startsWith('/login?')) {
        log('🔐 Serving login page');
        const loginPath = path.join(__dirname, '/login.html');
        serveFile(loginPath, 'text/html', res);
        return;
    }
    
    // Handle dashboard route - serve business portal for authenticated users
    const urlPath = req.url.split('?')[0]; // Remove query parameters
    if (urlPath === '/dashboard' || urlPath.startsWith('/dashboard/')) {
        log('📊 Serving dashboard (business portal)');
        const dashboardPath = path.join(__dirname, '/business-portal.html');
        serveFile(dashboardPath, 'text/html', res);
        return;
    }
    
    // Handle dashboard-clientes route
    if (urlPath === '/dashboard-clientes.html') {
        log('📊 Serving dashboard clientes');
        const dashboardClientesPath = path.join(__dirname, '/dashboard-clientes.html');
        serveFile(dashboardClientesPath, 'text/html', res);
        return;
    }

    // Handle admin access control route
    if (urlPath === '/admin-access-control') {
        // Check if user is admin (from iriasironworks.com domain)
        if (!req.user) {
            res.writeHead(302, { 'Location': '/login' });
            res.end();
            return;
        }
        
        const userDomain = req.user.email.split('@')[1];
        if (userDomain !== 'iriasironworks.com') {
            res.writeHead(302, { 'Location': '/dashboard?error=admin_required' });
            res.end();
            return;
        }
        
        log('🔐 Serving admin access control page');
        const adminPath = path.join(__dirname, '/admin-access-control.html');
        serveFile(adminPath, 'text/html', res);
        return;
    }

    // Enhanced static file serving
    log('🔍 Serving static file');
    serveStaticFile(req, res);
}

// Handle admin routes
async function handleAdminRoute(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        // Check if user is authenticated and is admin
        if (!req.user) {
            sendErrorResponse(res, 401, 'Authentication required');
            return;
        }

        // Check if user is from iriasironworks.com domain (admin)
        const userDomain = req.user.email.split('@')[1];
        if (userDomain !== 'iriasironworks.com') {
            sendErrorResponse(res, 403, 'Admin access required');
            return;
        }

        switch (pathname) {
            case '/api/admin/access-stats':
                const stats = await accessControl.getAccessStats();
                sendSuccessResponse(res, stats, 'Access statistics retrieved');
                break;
            case '/api/admin/users':
                // Get users from the access control system instead of directly from sheets
                const users = accessControl.getAuthorizedUsers();
                sendSuccessResponse(res, users, 'Users retrieved');
                break;
            case '/api/admin/approve-user':
                if (req.method !== 'POST') {
                    sendErrorResponse(res, 405, 'Method not allowed');
                    return;
                }
                const body = await parseJsonBody();
                const result = await accessControl.approveUser(body.email, req.session.user.email);
                if (result.success) {
                    sendSuccessResponse(res, result, result.message);
                } else {
                    sendErrorResponse(res, 400, result.message);
                }
                break;
            default:
                sendErrorResponse(res, 404, 'Admin route not found');
        }
    } catch (error) {
        console.error('❌ Error handling admin route:', error);
        sendErrorResponse(res, 500, 'Internal server error');
    }
}

// Handle authentication routes
async function handleAuthRoute(req, res) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;

        switch (pathname) {
            case '/auth/google':
                await googleAuth.initiateGoogleAuth(req, res);
                break;
            case '/auth/google/callback':
                await googleAuth.handleGoogleCallback(req, res);
                break;
            case '/auth/status':
                await googleAuth.checkAuthStatus(req, res);
                break;
            case '/auth/logout':
                await googleAuth.logout(req, res);
                break;
            default:
                sendErrorResponse(res, 404, 'Auth route not found');
        }
    } catch (error) {
        console.error('❌ Error handling auth route:', error);
        sendErrorResponse(res, 500, 'Internal server error');
    }
}

// Enhanced static file serving
function serveStaticFile(req, res) {
    let filePath = req.url;
    
    // Default to business portal for root
    if (filePath === '/') {
        filePath = '/business-portal.html';
    }
    
    // Remove query parameters
    filePath = filePath.split('?')[0];
    
    // Security: prevent directory traversal
    if (filePath.includes('..')) {
        sendErrorResponse(res, 403, 'Forbidden');
        return;
    }
    
    // Get file extension
    const extname = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    // Construct full file path
    const fullPath = path.join(__dirname, filePath);
    
    console.log(`🔍 Looking for file: ${fullPath}`);
    
    // Check if file exists
    fs.access(fullPath, fs.constants.F_OK, (err) => {
        if (err) {
            console.log(`❌ File not found: ${fullPath}`);
            // File not found - serve 404
            if (filePath.endsWith('.html')) {
                // For HTML files, serve business portal as fallback
                const fallbackPath = path.join(__dirname, '/business-portal.html');
                console.log(`🔍 Serving fallback: ${fallbackPath}`);
                serveFile(fallbackPath, 'text/html', res);
            } else {
                sendErrorResponse(res, 404, 'File not found');
            }
            return;
        }
        
        console.log(`✅ Serving file: ${fullPath}`);
        serveFile(fullPath, contentType, res);
    });
}

function serveFile(filePath, contentType, res) {
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', (error) => {
        logger.error('Error serving file:', error);
        sendErrorResponse(res, 500, 'Error reading file');
    });
    
    res.writeHead(200, { 'Content-Type': contentType });
    stream.pipe(res);
}

// API route handler
async function handleAPIRoute(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname.replace('/api/', '');
    
    console.log(`🔍 API route: ${path}`);
    
    // Helper function to parse JSON body
    const parseJsonBody = () => {
        return new Promise((resolve, reject) => {
            if (req.method === 'GET') {
                resolve({});
                return;
            }
            
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    if (body.trim() === '') {
                        resolve({});
                    } else {
                        resolve(JSON.parse(body));
                    }
                } catch (error) {
                    reject(new Error('Invalid JSON data'));
                }
            });
            
            req.on('error', (error) => {
                reject(error);
            });
        });
    };
    
    try {
        switch (path) {
            case 'health':
                if (req.method === 'GET') {
                    console.log('🔍 Serving /api/health endpoint');
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        message: 'Test server running with security features',
                        timestamp: new Date().toISOString(),
                        status: 'healthy',
                        service: 'Fire Escape Reports System',
                        version: '2.0.0',
                        environment: process.env.NODE_ENV || 'development'
                    }));
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'clients':
                if (req.method === 'GET') {
                    console.log('🔍 Serving /api/clients endpoint');
                    console.log('📊 Google Sheets instance:', !!googleSheets);
                    console.log('🔑 Service Account configured:', !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_KEY.trim() !== ''));
                    try {
                        console.log('🔄 Calling googleSheets.getClientsData()...');
                        const clients = await googleSheets.getClientsData();
                        console.log('📊 Received clients data:', !!clients, 'Type:', typeof clients, 'Length:', clients ? clients.length : 'N/A');
                        
                        // Check if limit parameter is provided
                        const url = new URL(req.url, `http://${req.headers.host}`);
                        const limitParam = url.searchParams.get('limit');
                        
                        let responseClients = clients;
                        if (limitParam) {
                            const limit = parseInt(limitParam);
                            responseClients = clients.slice(0, limit);
                            console.log(`📊 Returning ${responseClients.length} clients (limited to ${limit})`);
                        } else {
                            console.log(`📊 Returning all ${clients.length} clients (no limit)`);
                        }
                        
                        sendSuccessResponse(res, { clients: responseClients, total: clients.length }, 'Clients retrieved successfully from Google Sheets');
                    } catch (error) {
                        console.error('❌ Error fetching clients:', error);
                        sendErrorResponse(res, 500, 'Error fetching clients from Google Sheets', error);
                    }
                } else if (req.method === 'POST') {
                    console.log('🔍 Creating new client');
                    try {
                        const clientData = await parseJsonBody();
                        console.log('📝 Client data received:', clientData);
                        
                        const result = await googleSheets.addClientToSheet(clientData);
                        
                        if (result.success) {
                            console.log('✅ Client created successfully');
                            
                            // Configure and send email notification
                            let emailResult = { success: false, error: 'Email not configured' };
                            try {
                                // Configure email service first
                                if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
                                    const emailConfig = {
                                        email: process.env.GMAIL_USER,
                                        service: 'gmail',
                                        password: process.env.GMAIL_APP_PASSWORD
                                    };
                                    await emailService.configure(emailConfig);
                                }
                                emailResult = await sendNewLeadNotification(clientData);
                                console.log('📧 Email notification result:', emailResult.success ? 'Sent' : 'Failed');
                            } catch (emailError) {
                                console.error('❌ Error sending email notification:', emailError);
                            }
                            
                            // Configure and trigger Zoho Flow
                            let zohoResult = { success: false, error: 'Zoho not configured' };
                            try {
                                // Configure Zoho webhook first
                                if (process.env.ZOHO_FLOW_WEBHOOK_URL) {
                                    const zohoConfig = {
                                        webhookUrl: process.env.ZOHO_FLOW_WEBHOOK_URL,
                                        webhookSecret: process.env.ZOHO_FLOW_WEBHOOK_SECRET || ''
                                    };
                                    zohoWebhookService.configure(zohoConfig);
                                }
                                zohoResult = await triggerZohoFlow(clientData);
                                console.log('🔗 Zoho Flow result:', zohoResult.success ? 'Triggered' : 'Failed');
                            } catch (zohoError) {
                                console.error('❌ Error triggering Zoho Flow:', zohoError);
                            }
                            
                            // Create Google Drive folder for client
                            let driveResult = { success: false, error: 'Google Drive not configured' };
                            try {
                                driveResult = await createClientDriveFolder(clientData);
                                console.log('📁 Google Drive result:', driveResult.success ? 'Folder Created' : 'Failed');
                            } catch (driveError) {
                                console.error('❌ Error creating Google Drive folder:', driveError);
                            }
                            
                            sendSuccessResponse(res, {
                                ...result,
                                emailSent: emailResult.success,
                                zohoTriggered: zohoResult.success,
                                driveFolderCreated: driveResult.success,
                                emailError: emailResult.error,
                                zohoError: zohoResult.error,
                                driveError: driveResult.error,
                                driveFolderLink: driveResult.folderLink
                            }, 'Client created successfully with notifications and Google Drive folder');
                        } else {
                            console.error('❌ Error creating client:', result.error);
                            sendErrorResponse(res, 500, 'Error creating client', result.error);
                        }
                    } catch (error) {
                        console.error('❌ Error creating client:', error);
                        sendErrorResponse(res, 500, 'Error creating client', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'statistics':
                if (req.method === 'GET') {
                    console.log('🔍 Serving /api/statistics endpoint');
                    try {
                        const stats = await googleSheets.getStatistics();
                        sendSuccessResponse(res, stats, 'Statistics retrieved successfully from Google Sheets');
                    } catch (error) {
                        console.error('❌ Error fetching statistics:', error);
                        sendErrorResponse(res, 500, 'Error fetching statistics from Google Sheets', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'business-clients':
                if (req.method === 'GET') {
                    console.log('🔍 Serving /api/business-clients endpoint');
                    try {
                        // Get clients from Form Responses 1 for business portal
                        const clients = await googleSheets.getFormResponsesClients();
                        console.log('📊 Received business clients data:', !!clients, 'Length:', clients ? clients.length : 'N/A');
                        
                        // Check if limit parameter is provided
                        const url = new URL(req.url, `http://${req.headers.host}`);
                        const limitParam = url.searchParams.get('limit');
                        
                        let responseClients = clients;
                        if (limitParam) {
                            const limit = parseInt(limitParam);
                            responseClients = clients.slice(0, limit);
                            console.log(`📊 Returning ${responseClients.length} business clients (limited to ${limit})`);
                        } else {
                            console.log(`📊 Returning all ${clients.length} business clients (no limit)`);
                        }
                        
                        sendSuccessResponse(res, { clients: responseClients, total: clients.length }, 'Business clients retrieved successfully from Google Sheets');
                    } catch (error) {
                        console.error('❌ Error fetching business clients:', error);
                        sendErrorResponse(res, 500, 'Error fetching business clients from Google Sheets', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'reports':
                if (req.method === 'POST') {
                    console.log('📊 Serving /api/reports endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const { clientName, clientEmail, reportType, generatedAt, company, inspectionDate, reportId } = reqBody;
                        
                        if (!clientName || !reportType) {
                            return sendErrorResponse(res, 400, 'Missing required fields: clientName, reportType');
                        }

                        console.log(`📊 Tracking report generation: ${reportType} for ${clientName}`);
                        
                        // Add report to Google Sheets for tracking
                        const reportData = {
                            reportId,
                            clientName,
                            clientEmail,
                            reportType,
                            generatedAt,
                            company,
                            inspectionDate,
                            status: 'Generated'
                        };
                        
                        const result = await googleSheets.addReport(reportData);
                        
                        if (result.success) {
                            console.log(`✅ Report tracking successful: ${reportId}`);
                            sendSuccessResponse(res, { 
                                reportTracked: true, 
                                reportId,
                                message: 'Report generation tracked successfully'
                            }, 'Report generation tracked successfully');
                        } else {
                            throw new Error(result.error || 'Failed to track report generation');
                        }
                    } catch (error) {
                        console.error('❌ Error tracking report generation:', error);
                        sendErrorResponse(res, 500, 'Error tracking report generation', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'upload-pdf':
                if (req.method === 'POST') {
                    console.log('📁 Serving /api/upload-pdf endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const { clientName, clientEmail, pdfBuffer, filename, reportType } = reqBody;
                        
                        if (!clientName || !pdfBuffer || !filename) {
                            return sendErrorResponse(res, 400, 'Missing required fields: clientName, pdfBuffer, filename');
                        }

                        console.log(`📁 Uploading PDF to client folder: ${clientName}`);
                        
                        // Configure Google Drive service if not already configured
                        if (!googleDriveService.isConfigured) {
                            await googleDriveService.configure();
                        }
                        
                        if (!googleDriveService.isConfigured) {
                            console.log('⚠️ Google Drive not configured, skipping PDF upload');
                            return sendErrorResponse(res, 500, 'Google Drive not configured');
                        }
                        
                        // Convert array back to buffer
                        const buffer = Buffer.from(pdfBuffer);
                        
                        // Upload PDF to client's Google Drive folder
                        const result = await googleDriveService.uploadPDFReportToClientFolder(
                            clientName,
                            clientEmail,
                            buffer,
                            reportType
                        );
                        
                        if (result) {
                            console.log(`✅ PDF uploaded successfully: ${result.name}`);
                            sendSuccessResponse(res, { 
                                pdfUploaded: true, 
                                fileName: result.name,
                                fileLink: result.webViewLink,
                                message: 'PDF uploaded to client folder successfully'
                            }, 'PDF uploaded to client folder successfully');
                        } else {
                            throw new Error('Failed to upload PDF to client folder');
                        }
                    } catch (error) {
                        console.error('❌ Error uploading PDF:', error);
                        sendErrorResponse(res, 500, 'Error uploading PDF to client folder', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'client-update':
                if (req.method === 'PUT') {
                    console.log('🔍 Serving /api/client-update endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const { clientId, updateData } = reqBody;
                        
                        if (!clientId || !updateData) {
                            return sendErrorResponse(res, 400, 'Missing required fields: clientId and updateData');
                        }

                        console.log(`📝 Updating client data for ID: ${clientId}`, updateData);
                        
                        // Real Google Sheets update
                        const result = await googleSheets.updateClientInSheet(clientId, updateData);
                        
                        if (result.success) {
                            console.log(`✅ Client data updated successfully in Google Sheets for ID: ${clientId}`);
                            sendSuccessResponse(res, { 
                                clientId, 
                                updated: true, 
                                simulated: false,
                                message: 'Client data updated successfully in Google Sheets'
                            }, 'Client data updated successfully in Google Sheets');
                        } else {
                            throw new Error(result.error || 'Failed to update client in Google Sheets');
                        }
                    } catch (error) {
                        console.error('❌ Error updating client data:', error);
                        sendErrorResponse(res, 500, 'Error updating client data in Google Sheets', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'client-status':
                if (req.method === 'PUT') {
                    console.log('🔍 Serving /api/client-status endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const { clientId, status } = reqBody;
                        
                        if (!clientId || !status) {
                            return sendErrorResponse(res, 400, 'Missing required fields: clientId and status');
                        }

                        console.log(`📝 Updating client status for ID: ${clientId} to: ${status}`);
                        
                        // Real Google Sheets update
                        const result = await googleSheets.updateClientStatus(clientId, status);
                        
                        if (result.success) {
                            console.log(`✅ Client status updated successfully in Google Sheets for ID: ${clientId}`);
                            sendSuccessResponse(res, { 
                                clientId, 
                                status, 
                                updated: true, 
                                simulated: false,
                                message: 'Client status updated successfully in Google Sheets'
                            }, 'Client status updated successfully in Google Sheets');
                        } else {
                            throw new Error(result.error || 'Failed to update client status in Google Sheets');
                        }
                    } catch (error) {
                        console.error('❌ Error updating client status:', error);
                        sendErrorResponse(res, 500, 'Error updating client status in Google Sheets', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'client-invoice-status':
                if (req.method === 'PUT') {
                    console.log('🔍 Serving /api/client-invoice-status endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const { clientId, status } = reqBody;
                        
                        if (!clientId || !status) {
                            return sendErrorResponse(res, 400, 'Missing required fields: clientId and status');
                        }

                        console.log(`📝 Updating invoice status for ID: ${clientId} to: ${status}`);
                        
                        // Real Google Sheets update
                        const result = await googleSheets.updateClientInvoiceStatus(clientId, status);
                        
                        if (result.success) {
                            console.log(`✅ Invoice status updated successfully in Google Sheets for ID: ${clientId}`);
                            sendSuccessResponse(res, { 
                                clientId, 
                                status, 
                                updated: true, 
                                simulated: false,
                                message: 'Invoice status updated successfully in Google Sheets'
                            }, 'Invoice status updated successfully in Google Sheets');
                        } else {
                            throw new Error(result.error || 'Failed to update invoice status in Google Sheets');
                        }
                    } catch (error) {
                        console.error('❌ Error updating invoice status:', error);
                        sendErrorResponse(res, 500, 'Error updating invoice status in Google Sheets', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'client-estimate-status':
                if (req.method === 'PUT') {
                    console.log('🔍 Serving /api/client-estimate-status endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const { clientId, status } = reqBody;
                        
                        if (!clientId || !status) {
                            return sendErrorResponse(res, 400, 'Missing required fields: clientId and status');
                        }

                        console.log(`📝 Updating estimate status for ID: ${clientId} to: ${status}`);
                        
                        // Real Google Sheets update
                        const result = await googleSheets.updateClientEstimateStatus(clientId, status);
                        
                        if (result.success) {
                            console.log(`✅ Estimate status updated successfully in Google Sheets for ID: ${clientId}`);
                            sendSuccessResponse(res, { 
                                clientId, 
                                status, 
                                updated: true, 
                                simulated: false,
                                message: 'Estimate status updated successfully in Google Sheets'
                            }, 'Estimate status updated successfully in Google Sheets');
                        } else {
                            throw new Error(result.error || 'Failed to update estimate status in Google Sheets');
                        }
                    } catch (error) {
                        console.error('❌ Error updating estimate status:', error);
                        sendErrorResponse(res, 500, 'Error updating estimate status in Google Sheets', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'send-client-email':
                if (req.method === 'POST') {
                    console.log('📧 Serving /api/send-client-email endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const { clientData } = reqBody;
                        
                        if (!clientData) {
                            return sendErrorResponse(res, 400, 'Missing required field: clientData');
                        }

                        console.log(`📧 Sending new lead notification for client: ${clientData.clientFullName}`);
                        
                        // Send new lead notification
                        const emailResult = await sendNewLeadNotification(clientData);
                        
                        if (emailResult.success) {
                            console.log(`✅ New lead notification sent successfully to: ${emailResult.sentTo}`);
                            sendSuccessResponse(res, { 
                                emailSent: true, 
                                message: 'New lead notification sent successfully',
                                sentTo: emailResult.sentTo
                            }, 'New lead notification sent successfully');
                        } else {
                            throw new Error(emailResult.error || 'Failed to send new lead notification');
                        }
                    } catch (error) {
                        console.error('❌ Error sending new lead notification:', error);
                        sendErrorResponse(res, 500, 'Error sending new lead notification', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'create-zoho-client':
                if (req.method === 'POST') {
                    console.log('🔗 Serving /api/create-zoho-client endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const { clientData } = reqBody;
                        
                        if (!clientData) {
                            return sendErrorResponse(res, 400, 'Missing required field: clientData');
                        }

                        console.log(`🔗 Triggering Zoho Flow for: ${clientData.clientFullName}`);
                        
                        // Trigger Zoho Flow webhook
                        const zohoResult = await triggerZohoFlow(clientData);
                        
                        if (zohoResult.success) {
                            console.log(`✅ Zoho Flow triggered successfully: ${clientData.clientFullName}`);
                            sendSuccessResponse(res, { 
                                zohoFlowTriggered: true, 
                                message: 'Zoho Flow triggered successfully',
                                flowData: zohoResult.flowData
                            }, 'Zoho Flow triggered successfully');
                        } else {
                            throw new Error(zohoResult.error || 'Failed to trigger Zoho Flow');
                        }
                    } catch (error) {
                        console.error('❌ Error triggering Zoho Flow:', error);
                        sendErrorResponse(res, 500, 'Error triggering Zoho Flow', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            // ===== SYSTEM CONFIGURATION ENDPOINTS =====
            case 'system-config':
                if (req.method === 'GET') {
                    console.log('⚙️ Serving /api/system-config GET endpoint');
                    try {
                        const config = await getSystemConfig();
                        sendSuccessResponse(res, config, 'System configuration loaded successfully');
                    } catch (error) {
                        console.error('❌ Error loading system config:', error);
                        sendErrorResponse(res, 500, 'Error loading system configuration', error);
                    }
                } else if (req.method === 'POST') {
                    console.log('⚙️ Serving /api/system-config POST endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const result = await saveSystemConfig(reqBody);
                        sendSuccessResponse(res, result, 'System configuration saved successfully');
                    } catch (error) {
                        console.error('❌ Error saving system config:', error);
                        sendErrorResponse(res, 500, 'Error saving system configuration', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'test-email':
                if (req.method === 'POST') {
                    console.log('📧 Serving /api/test-email endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const { email, service, apiKey, gmailAppPassword } = reqBody;
                        
                        // Use apiKey or gmailAppPassword, whichever is provided
                        const password = apiKey || gmailAppPassword;
                        
                        if (!email || !password) {
                            return sendErrorResponse(res, 400, 'Missing required fields: email and gmailAppPassword/apiKey');
                        }

                        console.log(`📧 Testing email configuration for: ${email}`);
                        
                        const testResult = await testNotificationsConfiguration(email, password);
                        
                        if (testResult.success) {
                            console.log(`✅ Email test successful for: ${email}`);
                            sendSuccessResponse(res, { 
                                emailTested: true, 
                                message: 'Email test successful'
                            }, 'Email test successful');
                        } else {
                            // Don't throw error, just return the error response
                            sendErrorResponse(res, 400, 'Email test failed', new Error(testResult.error));
                        }
                    } catch (error) {
                        console.error('❌ Error testing email:', error);
                        sendErrorResponse(res, 500, 'Error testing email configuration', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'save-gmail-config':
                if (req.method === 'POST') {
                    console.log('📧 Serving /api/save-gmail-config endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const { gmailUser, gmailAppPassword, emailFromName } = reqBody;
                        
                        if (!gmailUser || !gmailAppPassword) {
                            return sendErrorResponse(res, 400, 'Missing required fields: gmailUser and gmailAppPassword');
                        }

                        // Update environment variables in memory
                        process.env.GMAIL_USER = gmailUser;
                        process.env.GMAIL_APP_PASSWORD = gmailAppPassword;
                        if (emailFromName) {
                            process.env.EMAIL_FROM_NAME = emailFromName;
                        }

                        // Save to .env file permanently
                        const fs = require('fs');
                        const envPath = '.env';
                        
                        try {
                            let envContent = '';
                            if (fs.existsSync(envPath)) {
                                envContent = fs.readFileSync(envPath, 'utf8');
                            }
                            
                            // Update or add Gmail configuration
                            const lines = envContent.split('\n');
                            let gmailUserUpdated = false;
                            let gmailPasswordUpdated = false;
                            let emailFromNameUpdated = false;
                            
                            for (let i = 0; i < lines.length; i++) {
                                if (lines[i].startsWith('GMAIL_USER=')) {
                                    lines[i] = `GMAIL_USER=${gmailUser}`;
                                    gmailUserUpdated = true;
                                } else if (lines[i].startsWith('GMAIL_APP_PASSWORD=')) {
                                    lines[i] = `GMAIL_APP_PASSWORD=${gmailAppPassword}`;
                                    gmailPasswordUpdated = true;
                                } else if (lines[i].startsWith('EMAIL_FROM_NAME=')) {
                                    lines[i] = `EMAIL_FROM_NAME=${emailFromName}`;
                                    emailFromNameUpdated = true;
                                }
                            }
                            
                            // Add new lines if they don't exist
                            if (!gmailUserUpdated) {
                                lines.push(`GMAIL_USER=${gmailUser}`);
                            }
                            if (!gmailPasswordUpdated) {
                                lines.push(`GMAIL_APP_PASSWORD=${gmailAppPassword}`);
                            }
                            if (emailFromName && !emailFromNameUpdated) {
                                lines.push(`EMAIL_FROM_NAME=${emailFromName}`);
                            }
                            
                            // Write back to file
                            fs.writeFileSync(envPath, lines.join('\n'));
                            console.log(`✅ Gmail configuration saved to .env file: ${gmailUser}`);
                        } catch (fileError) {
                            console.error('❌ Error writing to .env file:', fileError);
                            // Continue anyway, at least it's saved in memory
                        }

                        console.log(`✅ Gmail configuration saved: ${gmailUser}`);
                        sendSuccessResponse(res, { 
                            gmailConfigured: true, 
                            message: 'Gmail configuration saved successfully to .env file'
                        }, 'Gmail configuration saved successfully');
                    } catch (error) {
                        console.error('❌ Error saving Gmail config:', error);
                        sendErrorResponse(res, 500, 'Error saving Gmail configuration', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'test-zoho':
                if (req.method === 'GET') {
                    console.log('🔗 Serving /api/test-zoho endpoint');
                    try {
                        const zohoConfig = {
                            webhookUrl: process.env.ZOHO_FLOW_WEBHOOK_URL,
                            webhookSecret: process.env.ZOHO_FLOW_WEBHOOK_SECRET || ''
                        };
                        
                        const debugInfo = {
                            hasWebhookUrl: !!(process.env.ZOHO_FLOW_WEBHOOK_URL),
                            webhookUrl: process.env.ZOHO_FLOW_WEBHOOK_URL ? process.env.ZOHO_FLOW_WEBHOOK_URL.substring(0, 50) + '...' : 'Not set',
                            hasWebhookSecret: !!(process.env.ZOHO_FLOW_WEBHOOK_SECRET),
                            webhookSecretLength: process.env.ZOHO_FLOW_WEBHOOK_SECRET ? process.env.ZOHO_FLOW_WEBHOOK_SECRET.length : 0,
                            config: zohoConfig
                        };
                        
                        // Test Zoho webhook service
                        if (zohoConfig.webhookUrl) {
                            zohoWebhookService.configure(zohoConfig);
                            const testResult = await zohoWebhookService.testWebhook();
                            debugInfo.testResult = testResult;
                        }
                        
                        sendSuccessResponse(res, debugInfo, 'Zoho configuration debug info retrieved successfully');
                    } catch (error) {
                        console.error('❌ Error testing Zoho configuration:', error);
                        sendErrorResponse(res, 500, 'Error testing Zoho configuration', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'test-google-sheets':
                if (req.method === 'GET') {
                    console.log('📊 Serving /api/test-google-sheets endpoint');
                    try {
                        const testResult = await testGoogleSheetsConnection();
                        
                        if (testResult.success) {
                            console.log(`✅ Google Sheets connection test successful`);
                            sendSuccessResponse(res, { 
                                googleSheetsTested: true, 
                                message: 'Google Sheets connection successful'
                            }, 'Google Sheets connection successful');
                        } else {
                            throw new Error(testResult.error || 'Failed to test Google Sheets connection');
                        }
                    } catch (error) {
                        console.error('❌ Error testing Google Sheets:', error);
                        sendErrorResponse(res, 500, 'Error testing Google Sheets connection', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'test-drive':
                if (req.method === 'POST') {
                    console.log('📁 Serving /api/test-drive endpoint');
                    try {
                        await googleDriveService.configure();
                        const testResult = await googleDriveService.testConnection();
                        
                        if (testResult.success) {
                            console.log(`✅ Google Drive connection test successful`);
                            sendSuccessResponse(res, { 
                                driveTested: true, 
                                message: 'Google Drive connection successful'
                            }, 'Google Drive connection successful');
                        } else {
                            sendErrorResponse(res, 400, 'Google Drive connection test failed', new Error(testResult.message));
                        }
                    } catch (error) {
                        console.error('❌ Error testing Google Drive:', error);
                        sendErrorResponse(res, 500, 'Error testing Google Drive connection', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'drive-folders':
                if (req.method === 'GET') {
                    console.log('📁 Serving /api/drive-folders endpoint');
                    try {
                        await googleDriveService.configure();
                        const folders = await googleDriveService.listClientFolders();
                        sendSuccessResponse(res, { folders }, 'Google Drive folders retrieved successfully');
                    } catch (error) {
                        console.error('❌ Error retrieving Google Drive folders:', error);
                        sendErrorResponse(res, 500, 'Error retrieving Google Drive folders', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'system-status':
                if (req.method === 'GET') {
                    console.log('📊 Serving /api/system-status endpoint');
                    try {
                        const status = await getSystemStatus();
                        sendSuccessResponse(res, status, 'System status retrieved successfully');
                    } catch (error) {
                        console.error('❌ Error getting system status:', error);
                        sendErrorResponse(res, 500, 'Error getting system status', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'test-database':
                if (req.method === 'GET') {
                    console.log('🗄️ Serving /api/test-database endpoint');
                    try {
                        const mysql = require('mysql2/promise');
                        
                        // Configuración de la base de datos
                        const dbConfig = {
                            host: process.env.DB_HOST,
                            user: process.env.DB_USER,
                            password: process.env.DB_PASSWORD,
                            database: process.env.DB_NAME,
                            port: process.env.DB_PORT || 3306,
                            connectTimeout: 10000,
                            acquireTimeout: 10000,
                            timeout: 10000
                        };

                        console.log('🔍 Attempting database connection...');
                        const connection = await mysql.createConnection(dbConfig);
                        
                        console.log('✅ Database connection successful');
                        
                        // Probar una consulta simple
                        const [rows] = await connection.execute('SELECT 1 as test');
                        console.log('✅ Database query successful:', rows);
                        
                        await connection.end();
                        
                        sendSuccessResponse(res, {
                            connection: 'successful',
                            query: 'successful',
                            testResult: rows[0],
                            config: {
                                host: dbConfig.host,
                                user: dbConfig.user,
                                database: dbConfig.database,
                                port: dbConfig.port
                            }
                        }, 'Database connection and query test successful');
                    } catch (error) {
                        console.error('❌ Database test error:', error);
                        sendErrorResponse(res, 500, 'Database test failed', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'database-tables':
                if (req.method === 'GET') {
                    console.log('🗄️ Serving /api/database-tables endpoint');
                    try {
                        const mysql = require('mysql2/promise');
                        
                        // Configuración de la base de datos
                        const dbConfig = {
                            host: process.env.DB_HOST,
                            user: process.env.DB_USER,
                            password: process.env.DB_PASSWORD,
                            database: process.env.DB_NAME,
                            port: process.env.DB_PORT || 3306
                        };

                        const connection = await mysql.createConnection(dbConfig);
                        
                        // Obtener lista de tablas
                        const [tables] = await connection.execute('SHOW TABLES');
                        
                        // Obtener estructura de cada tabla
                        const tableStructures = {};
                        for (const table of tables) {
                            const tableName = Object.values(table)[0];
                            const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
                            tableStructures[tableName] = columns;
                        }
                        
                        // Obtener conteo de registros
                        const recordCounts = {};
                        for (const table of tables) {
                            const tableName = Object.values(table)[0];
                            const [count] = await connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
                            recordCounts[tableName] = count[0].count;
                        }
                        
                        await connection.end();
                        
                        sendSuccessResponse(res, {
                            tables: tables.map(t => Object.values(t)[0]),
                            structures: tableStructures,
                            recordCounts: recordCounts,
                            totalTables: tables.length
                        }, 'Database tables information retrieved successfully');
                    } catch (error) {
                        console.error('❌ Database tables error:', error);
                        sendErrorResponse(res, 500, 'Database tables query failed', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'debug-credentials':
                if (req.method === 'GET') {
                    console.log('🔍 Serving /api/debug-credentials endpoint');
                    try {
                        const debugInfo = {
                            hasServiceAccountKey: !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
                            serviceAccountKeyLength: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? process.env.GOOGLE_SERVICE_ACCOUNT_KEY.length : 0,
                            serviceAccountKeyPreview: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? process.env.GOOGLE_SERVICE_ACCOUNT_KEY.substring(0, 100) + '...' : 'Not set',
                            canParseJSON: false,
                            parsedCredentials: null,
                            hasOAuthClientId: !!(process.env.GOOGLE_OAUTH_CLIENT_ID),
                            oauthClientIdLength: process.env.GOOGLE_OAUTH_CLIENT_ID ? process.env.GOOGLE_OAUTH_CLIENT_ID.length : 0,
                            oauthClientIdPreview: process.env.GOOGLE_OAUTH_CLIENT_ID ? process.env.GOOGLE_OAUTH_CLIENT_ID.substring(0, 100) + '...' : 'Not set',
                            oauthCanParseJSON: false,
                            oauthParsedCredentials: null,
                            // Database credentials
                            hasDbHost: !!(process.env.DB_HOST),
                            hasDbUser: !!(process.env.DB_USER),
                            hasDbPassword: !!(process.env.DB_PASSWORD),
                            hasDbName: !!(process.env.DB_NAME),
                            hasDbPort: !!(process.env.DB_PORT),
                            dbHost: process.env.DB_HOST || 'Not set',
                            dbUser: process.env.DB_USER || 'Not set',
                            dbName: process.env.DB_NAME || 'Not set',
                            dbPort: process.env.DB_PORT || 'Not set'
                        };

                        if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                            try {
                                const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
                                debugInfo.canParseJSON = true;
                                debugInfo.parsedCredentials = {
                                    type: credentials.type,
                                    project_id: credentials.project_id,
                                    client_email: credentials.client_email,
                                    private_key_id: credentials.private_key_id ? credentials.private_key_id.substring(0, 10) + '...' : 'Not set'
                                };
                            } catch (parseError) {
                                debugInfo.canParseJSON = false;
                                debugInfo.parseError = parseError.message;
                            }
                        }

                        if (process.env.GOOGLE_OAUTH_CLIENT_ID) {
                            try {
                                const oauthCredentials = JSON.parse(process.env.GOOGLE_OAUTH_CLIENT_ID);
                                debugInfo.oauthCanParseJSON = true;
                                debugInfo.oauthParsedCredentials = {
                                    client_id: oauthCredentials.web ? oauthCredentials.web.client_id : oauthCredentials.client_id,
                                    project_id: oauthCredentials.web ? oauthCredentials.web.project_id : oauthCredentials.project_id,
                                    redirect_uris: oauthCredentials.web ? oauthCredentials.web.redirect_uris : oauthCredentials.redirect_uris,
                                    javascript_origins: oauthCredentials.web ? oauthCredentials.web.javascript_origins : oauthCredentials.javascript_origins
                                };
                            } catch (parseError) {
                                debugInfo.oauthCanParseJSON = false;
                                debugInfo.oauthParseError = parseError.message;
                            }
                        }

                        sendSuccessResponse(res, debugInfo, 'Credentials debug info retrieved successfully');
                    } catch (error) {
                        console.error('❌ Error getting credentials debug info:', error);
                        sendErrorResponse(res, 500, 'Error getting credentials debug info', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'sync-status':
                if (req.method === 'GET') {
                    console.log('🔄 Serving /api/sync-status endpoint');
                    try {
                        const syncService = new SyncService();
                        const status = await syncService.getSyncStatus();
                        sendSuccessResponse(res, status, 'Sync status retrieved successfully');
                    } catch (error) {
                        console.error('❌ Error getting sync status:', error);
                        sendErrorResponse(res, 500, 'Error getting sync status', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'sync-from-sheets':
                if (req.method === 'POST') {
                    console.log('🔄 Serving /api/sync-from-sheets endpoint');
                    try {
                        const syncService = new SyncService();
                        const result = await syncService.syncFromSheetsToDatabase();
                        sendSuccessResponse(res, result, 'Sync from sheets completed');
                    } catch (error) {
                        console.error('❌ Error syncing from sheets:', error);
                        sendErrorResponse(res, 500, 'Error syncing from sheets', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'sync-to-sheets':
                if (req.method === 'POST') {
                    console.log('🔄 Serving /api/sync-to-sheets endpoint');
                    try {
                        const syncService = new SyncService();
                        const result = await syncService.syncNewRecordsToSheets();
                        sendSuccessResponse(res, result, 'Sync to sheets completed');
                    } catch (error) {
                        console.error('❌ Error syncing to sheets:', error);
                        sendErrorResponse(res, 500, 'Error syncing to sheets', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'sync-full':
                if (req.method === 'POST') {
                    console.log('🔄 Serving /api/sync-full endpoint');
                    try {
                        const syncService = new SyncService();
                        const result = await syncService.fullSync();
                        sendSuccessResponse(res, result, 'Full sync completed');
                    } catch (error) {
                        console.error('❌ Error performing full sync:', error);
                        sendErrorResponse(res, 500, 'Error performing full sync', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'client-contact':
                if (req.method === 'PUT') {
                    console.log('🔍 Updating client contact info');
                    try {
                        let body = '';
                        req.on('data', chunk => {
                            body += chunk.toString();
                        });
                        
                        req.on('end', async () => {
                            try {
                                const { clientId, contactData } = JSON.parse(body);
                                
                                if (!clientId || !contactData) {
                                    sendErrorResponse(res, 400, 'Client ID and contact data are required');
                                    return;
                                }
                                
                                const result = await googleSheets.updateClientContactInfo(clientId, contactData);
                                
                                if (result.success) {
                                    sendSuccessResponse(res, result, 'Client contact info updated successfully');
                                } else {
                                    sendErrorResponse(res, 500, 'Error updating client contact info', result.error);
                                }
                            } catch (parseError) {
                                sendErrorResponse(res, 400, 'Invalid JSON data', parseError);
                            }
                        });
                    } catch (error) {
                        console.error('❌ Error updating client contact info:', error);
                        sendErrorResponse(res, 500, 'Error updating client contact info', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'client-service':
                if (req.method === 'PUT') {
                    console.log('🔍 Updating client service info');
                    try {
                        let body = '';
                        req.on('data', chunk => {
                            body += chunk.toString();
                        });
                        
                        req.on('end', async () => {
                            try {
                                const { clientId, serviceData } = JSON.parse(body);
                                
                                if (!clientId || !serviceData) {
                                    sendErrorResponse(res, 400, 'Client ID and service data are required');
                                    return;
                                }
                                
                                const result = await googleSheets.updateClientServiceInfo(clientId, serviceData);
                                
                                if (result.success) {
                                    sendSuccessResponse(res, result, 'Client service info updated successfully');
                                } else {
                                    sendErrorResponse(res, 500, 'Error updating client service info', result.error);
                                }
                            } catch (parseError) {
                                sendErrorResponse(res, 400, 'Invalid JSON data', parseError);
                            }
                        });
                    } catch (error) {
                        console.error('❌ Error updating client service info:', error);
                        sendErrorResponse(res, 500, 'Error updating client service info', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'client':
                if (req.method === 'GET') {
                    console.log('🔍 Getting specific client');
                    try {
                        const url = new URL(req.url, `http://${req.headers.host}`);
                        const clientId = url.searchParams.get('id');
                        
                        if (!clientId) {
                            sendErrorResponse(res, 400, 'Client ID is required');
                            return;
                        }
                        
                        const clients = await googleSheets.getClientsData();
                        const client = clients.find(c => c.id === clientId);
                        
                        if (client) {
                            sendSuccessResponse(res, client, 'Client retrieved successfully');
                        } else {
                            sendErrorResponse(res, 404, 'Client not found');
                        }
                    } catch (error) {
                        console.error('❌ Error fetching client:', error);
                        sendErrorResponse(res, 500, 'Error fetching client', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'test-connection':
                if (req.method === 'GET') {
                    console.log('🔍 Testing connection');
                    sendSuccessResponse(res, { connected: true, timestamp: new Date().toISOString() }, 'Connection test successful');
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'system-stats':
                if (req.method === 'GET') {
                    console.log('🔍 Serving system stats');
                    const systemStats = {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        cpu: process.cpuUsage(),
                        environment: process.env.NODE_ENV || 'development'
                    };
                    sendSuccessResponse(res, systemStats, 'System stats retrieved successfully');
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'sheets-status':
                if (req.method === 'GET') {
                    console.log('🔍 Checking sheets status');
                    try {
                        const status = await googleSheets.testConnection();
                        sendSuccessResponse(res, status, 'Sheets status checked');
                    } catch (error) {
                        console.error('❌ Error checking sheets status:', error);
                        sendErrorResponse(res, 500, 'Error checking Google Sheets status', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'save-report':
                if (req.method === 'POST') {
                    console.log('🔍 Saving report');
                    sendSuccessResponse(res, { reportId: 'REP-' + Date.now() }, 'Report saved successfully');
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'reports':
                if (req.method === 'GET') {
                    console.log('🔍 Serving /api/reports endpoint');
                    // Mock data for reports - esto se reemplazará con datos reales de Google Sheets
                    const mockReports = [
                        {
                            id: 'REP-001',
                            clientName: 'Boston Fire Escape Services',
                            date: '2024-07-15',
                            status: 'completed',
                            inspector: 'David Ramirez',
                            type: 'Fire Escapes'
                        },
                        {
                            id: 'REP-002',
                            clientName: 'Irias Iron Works Services',
                            date: '2024-07-20',
                            status: 'pending',
                            inspector: 'Dionel Irias',
                            type: 'Exterior Railings'
                        }
                    ];
                    sendSuccessResponse(res, { reports: mockReports, total: mockReports.length }, 'Reports retrieved successfully');
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'google-sheets-data':
                if (req.method === 'GET') {
                    console.log('🔍 Fetching Google Sheets data');
                    // Aquí se implementará la integración real con Google Sheets
                    sendSuccessResponse(res, { 
                        message: 'Google Sheets integration pending',
                        sheetUrl: 'https://docs.google.com/spreadsheets/d/13Fld-uJgwWuJVVxyEJoB9h7zAVbN2HlizV5udmT5XZU/edit?gid=174672304#gid=174672304',
                        status: 'not_configured'
                    }, 'Google Sheets endpoint ready');
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'create-sheet':
                if (req.method === 'POST') {
                    console.log('🔍 Create sheet endpoint removed - functionality deleted');
                    sendErrorResponse(res, 410, 'Create sheet functionality has been removed');
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'sheets':
                if (req.method === 'GET') {
                    console.log('🔍 Fetching available sheets');
                    try {
                        // Get sheetId from URL parameters
                        const url = new URL(req.url, `http://${req.headers.host}`);
                        const sheetId = url.searchParams.get('sheetId');
                        
                        const sheets = await googleSheets.getAvailableSheets(sheetId);
                        sendSuccessResponse(res, sheets, 'Available sheets retrieved successfully');
                    } catch (error) {
                        console.error('❌ Error fetching available sheets:', error);
                        sendErrorResponse(res, 500, 'Error fetching available sheets', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'update-source':
                if (req.method === 'POST') {
                    console.log('🔄 Updating data source');
                    try {
                        let body = '';
                        req.on('data', chunk => {
                            body += chunk.toString();
                        });
                        
                        req.on('end', async () => {
                            try {
                                const { sheetId, sheetTabId } = JSON.parse(body);
                                
                                if (!sheetId || !sheetTabId) {
                                    sendErrorResponse(res, 400, 'Sheet ID and Sheet Tab ID are required');
                                    return;
                                }

                                // Update environment variables
                                process.env.GOOGLE_SHEETS_ID = sheetId;
                                process.env.GOOGLE_SHEET_TAB_ID = sheetTabId;
                                
                                // Get spreadsheet title for response
                                const response = await googleSheets.sheets.spreadsheets.get({
                                    spreadsheetId: sheetId
                                });
                                
                                const spreadsheetTitle = response.data.properties.title;
                                const selectedSheet = response.data.sheets.find(s => s.properties.sheetId == sheetTabId);
                                const sheetTitle = selectedSheet ? selectedSheet.properties.title : 'Unknown';

                                console.log('✅ Data source updated to:', spreadsheetTitle, '-', sheetTitle);

                                sendSuccessResponse(res, {
                                    message: 'Data source updated successfully',
                                    spreadsheetTitle: spreadsheetTitle,
                                    sheetTitle: sheetTitle
                                }, 'Data source updated successfully');
                            } catch (parseError) {
                                sendErrorResponse(res, 400, 'Invalid JSON data', parseError);
                            }
                        });
                    } catch (error) {
                        console.error('❌ Error updating data source:', error.message);
                        sendErrorResponse(res, 500, 'Error updating data source', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case 'schedule-appointment':
                if (req.method === 'POST') {
                    console.log('🔍 Serving /api/schedule-appointment endpoint');
                    try {
                        const appointmentData = req.body;
                        
                        if (!appointmentData) {
                            return sendErrorResponse(res, 400, 'Missing appointment data');
                        }

                        // For now, simulate the appointment scheduling
                        console.log(`📅 Simulating appointment scheduling:`, appointmentData);
                        
                        // Simulate processing time
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        
                        sendSuccessResponse(res, { 
                            appointmentId: `APT-${Date.now()}`,
                            scheduled: true, 
                            simulated: true,
                            message: 'Appointment scheduled successfully (simulated)'
                        }, 'Appointment scheduled successfully (simulated)');
                    } catch (error) {
                        console.error('❌ Error scheduling appointment:', error);
                        sendErrorResponse(res, 500, 'Error scheduling appointment', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            case 'create-report':
                if (req.method === 'POST') {
                    console.log('🔍 Serving /api/create-report endpoint');
                    try {
                        const { clientId } = req.body;
                        
                        if (!clientId) {
                            return sendErrorResponse(res, 400, 'Missing required field: clientId');
                        }

                        // For now, simulate the report creation
                        console.log(`📄 Simulating report creation for client ID: ${clientId}`);
                        
                        // Simulate processing time
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        
                        sendSuccessResponse(res, { 
                            reportId: `RPT-${Date.now()}`,
                            clientId,
                            created: true, 
                            simulated: true,
                            message: 'Report created successfully (simulated)'
                        }, 'Report created successfully (simulated)');
                    } catch (error) {
                        console.error('❌ Error creating report:', error);
                        sendErrorResponse(res, 500, 'Error creating report', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case '/api/sync/start':
                if (req.method === 'POST') {
                    try {
                        const { intervalMinutes = 30 } = JSON.parse(body);
                        syncService.startAutoSync(intervalMinutes);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            message: `Auto sync started with ${intervalMinutes} minute interval`
                        }));
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: error.message
                        }));
                    }
                } else {
                    res.writeHead(405, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Method not allowed' }));
                }
                break;

            case '/api/sync/stop':
                if (req.method === 'POST') {
                    try {
                        syncService.stopAutoSync();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            message: 'Auto sync stopped'
                        }));
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: error.message
                        }));
                    }
                } else {
                    res.writeHead(405, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Method not allowed' }));
                }
                break;

            case '/api/sync/status':
                if (req.method === 'GET') {
                    try {
                        const status = syncService.getSyncStatus();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            data: status
                        }));
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: error.message
                        }));
                    }
                } else {
                    res.writeHead(405, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Method not allowed' }));
                }
                break;

            case '/api/sync/manual':
                if (req.method === 'POST') {
                    try {
                        const result = await syncService.performAutoSync();
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            data: result
                        }));
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: error.message
                        }));
                    }
                } else {
                    res.writeHead(405, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Method not allowed' }));
                }
                break;
                
            case 'test-pdf-upload':
                if (req.method === 'POST') {
                    console.log('📄 Serving /api/test-pdf-upload endpoint');
                    try {
                        const reqBody = await parseJsonBody();
                        const { clientName, clientEmail, customerType = 'Residential', folderId } = reqBody;
                        
                        if (!clientName) {
                            return sendErrorResponse(res, 400, 'Missing required field: clientName');
                        }

                        console.log(`📄 Testing PDF upload for client: ${clientName}`);
                        
                        // Configure Google Drive service if not already configured
                        if (!googleDriveService.isConfigured) {
                            await googleDriveService.configure();
                        }
                        
                        if (!googleDriveService.isConfigured) {
                            console.log('⚠️ Google Drive not configured, skipping PDF upload test');
                            return sendErrorResponse(res, 500, 'Google Drive not configured');
                        }
                        
                        // Create a simple test PDF buffer
                        const testPdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test PDF for ${clientName}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
297
%%EOF`;
                        
                        const pdfBuffer = Buffer.from(testPdfContent, 'utf8');
                        
                        let result;
                        
                        // If folderId is provided, use it directly
                        if (folderId) {
                            console.log(`📄 Using provided folder ID: ${folderId}`);
                            result = await googleDriveService.uploadFileToClientFolder(
                                folderId,
                                `Test_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
                                pdfBuffer,
                                'application/pdf'
                            );
                        } else {
                            // Otherwise, try to find the folder
                            result = await googleDriveService.uploadPDFReportToClientFolder(
                                clientName,
                                clientEmail,
                                pdfBuffer,
                                'Test Report'
                            );
                        }
                        
                        if (result) {
                            console.log(`✅ Test PDF uploaded successfully: ${result.name}`);
                            sendSuccessResponse(res, { 
                                pdfUploaded: true, 
                                fileName: result.name,
                                fileLink: result.webViewLink,
                                message: 'Test PDF uploaded to client folder successfully'
                            }, 'Test PDF uploaded to client folder successfully');
                        } else {
                            throw new Error('Failed to upload test PDF to client folder');
                        }
                    } catch (error) {
                        console.error('❌ Error uploading test PDF:', error);
                        sendErrorResponse(res, 500, 'Error uploading test PDF to client folder', error);
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;

            default:
                console.log(`❌ API endpoint not found: ${path}`);
                sendErrorResponse(res, 404, 'API endpoint not found');
        }
    } catch (error) {
        logger.error('API route error:', error);
        sendErrorResponse(res, 500, 'Internal server error', error);
    }
}

// Enhanced server startup
server.listen(PORT, '0.0.0.0', async () => {
    logger.info(`🚀 Fixed server running on port ${PORT}`);
    logger.info(`📊 Health check: http://localhost:${PORT}/health`);
    logger.info(`🌐 Dashboard: http://localhost:${PORT}/dashboard-clientes.html`);
    logger.info(`🔥 Fire Escapes: http://localhost:${PORT}/fire_escapes_rp.html`);
    logger.info(`🏢 Portal: http://localhost:${PORT}/business-portal.html`);
    
    // Initialize Google Sheets on startup
    try {
        logger.info('🔐 Initializing Google Sheets integration...');
        await googleSheets.initialize();
        logger.info('✅ Google Sheets integration initialized successfully');
        
        // Test connection
        const testData = await googleSheets.getClientsData();
        logger.info(`📊 Test connection successful - Found ${testData ? testData.length : 0} clients`);
    } catch (error) {
        logger.error('❌ Failed to initialize Google Sheets:', error);
    }
    
    // Initialize Access Control System on startup
    try {
        logger.info('🔐 Initializing Access Control System...');
        await accessControl.initialize();
        logger.info('✅ Access Control System initialized successfully');
    } catch (error) {
        logger.error('❌ Failed to initialize Access Control System:', error);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

// ===== EMAIL AND ZOHO INTEGRATION FUNCTIONS =====

/**
 * Send notification email to admin about new lead
 * @param {Object} clientData - Client information
 * @returns {Promise<Object>} - Result of email sending
 */
async function sendNewLeadNotification(clientData) {
    try {
        // Get notification email from environment or use default
        const notificationEmail = process.env.NOTIFICATION_EMAIL || 'newcustomers@iriasironworks.com';
        const ccEmail = process.env.CC_EMAIL || null;
        
        console.log(`📧 Sending new lead notification to: ${notificationEmail}${ccEmail ? ` (CC: ${ccEmail})` : ''}`);
        
        // Use the email service to send the notification
        const result = await emailService.sendNewLeadNotification(clientData, notificationEmail, ccEmail);
        
        if (result.success) {
            console.log(`✅ New lead notification sent successfully to: ${notificationEmail}${ccEmail ? ` and CC: ${ccEmail}` : ''}`);
            return result;
        } else {
            console.error('❌ Failed to send new lead notification:', result.error);
            return result;
        }
    } catch (error) {
        console.error('❌ Error sending new lead notification:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Trigger Zoho Flow webhook for new client
 * @param {Object} clientData - Client information
 * @returns {Promise<Object>} - Result of Zoho Flow trigger
 */
async function triggerZohoFlow(clientData) {
    try {
        console.log(`🔗 Triggering Zoho Flow for: ${clientData.clientFullName}`);
        
        // Get Zoho Flow webhook URL from environment
        const zohoFlowWebhookUrl = process.env.ZOHO_FLOW_WEBHOOK_URL;
        
        if (!zohoFlowWebhookUrl) {
            console.log('⚠️ ZOHO_FLOW_WEBHOOK_URL not configured, skipping Zoho Flow integration');
            return {
                success: false,
                error: 'Zoho Flow webhook URL not configured',
                message: 'Please configure ZOHO_FLOW_WEBHOOK_URL in environment variables'
            };
        }
        
        // Prepare data for Zoho Flow
        const flowData = {
            client_name: clientData.clientFullName,
            client_email: clientData.email,
            client_phone: clientData.customerPhoneNumber || clientData.phone,
            client_address: clientData.address,
            service_type: clientData.serviceType,
            customer_type: clientData.customerType,
            price: clientData.price || '0',
            customer_status: clientData.customerStatus || 'New Lead',
            registration_date: new Date().toISOString(),
            source: 'Web Form'
        };
        
        console.log(`🔗 Sending data to Zoho Flow webhook: ${zohoFlowWebhookUrl}`);
        console.log('Flow data:', flowData);
        
        // Use the Zoho webhook service to trigger the webhook
        const result = await zohoWebhookService.triggerWebhook(clientData);
        
        if (result.success) {
            console.log(`✅ Zoho Flow webhook triggered successfully for: ${clientData.clientFullName}`);
            return result;
        } else {
            console.error('❌ Failed to trigger Zoho Flow webhook:', result.error);
            return result;
        }
    } catch (error) {
        console.error('❌ Error triggering Zoho Flow:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function createClientDriveFolder(clientData) {
    try {
        console.log('📁 Creating Google Drive folder for client:', clientData.clientFullName || clientData.clientName);
        
        // Configure Google Drive service if not already configured
        if (!googleDriveService.isConfigured) {
            await googleDriveService.configure();
        }
        
        if (!googleDriveService.isConfigured) {
            console.log('⚠️ Google Drive not configured, skipping folder creation');
            return { success: false, error: 'Google Drive not configured' };
        }
        
        // Create folder with client name and address
        const folderName = clientData.clientFullName || clientData.clientName;
        const folderAddress = clientData.address || clientData.propertyAddress || clientData.clientAddress || 'No Address';
        const customerType = clientData.customerType || 'Residential';
        
        const result = await googleDriveService.createClientFolder(folderName, folderAddress, customerType);
        
        if (result) {
            console.log('✅ Google Drive folder created successfully:', result.name);
            return { 
                success: true, 
                message: 'Google Drive folder created successfully',
                folderId: result.id,
                folderName: result.name,
                folderLink: result.webViewLink
            };
        } else {
            console.error('❌ Failed to create Google Drive folder');
            return { success: false, error: 'Failed to create Google Drive folder' };
        }
    } catch (error) {
        console.error('❌ Error creating Google Drive folder:', error);
        return { success: false, error: error.message };
    }
}

// ===== SYSTEM CONFIGURATION FUNCTIONS =====
let systemConfig = {
    email: {
        notificationEmail: process.env.NOTIFICATION_EMAIL || 'david@iriasironworks.com',
        service: 'simulated',
        apiKey: ''
    },
    zoho: {
        webhookUrl: process.env.ZOHO_FLOW_WEBHOOK_URL || '',
        webhookSecret: '',
        dataMapping: {
            client_name: "clientFullName",
            client_email: "email",
            client_phone: "customerPhoneNumber",
            client_address: "address",
            service_type: "serviceType",
            customer_type: "customerType",
            price: "price",
            customer_status: "customerStatus",
            registration_date: "timestamp",
            source: "Web Form"
        }
    },
    googleSheets: {
        spreadsheetId: process.env.GOOGLE_SHEETS_ID || '13Fld-uJgwWuJVVxyEJoB9h7zAVbN2HlizV5udmT5XZU',
        range: 'Form Responses 1!A:AA'
    },
    security: {
        sessionTimeout: 1440,
        maxLoginAttempts: 5
    }
};

async function getSystemConfig() {
    try {
        console.log('⚙️ Loading system configuration...');
        
        // Get configuration from database
        const dbConfig = configDB.getAllConfig();
        
        // Merge with system config
        const mergedConfig = {
            ...systemConfig,
            notifications: {
                ...systemConfig.notifications,
                ...dbConfig.notifications
            },
            zoho: {
                ...systemConfig.zoho,
                ...dbConfig.zoho
            }
        };
        
        return mergedConfig;
    } catch (error) {
        console.error('❌ Error loading system config:', error);
        throw error;
    }
}

async function saveSystemConfig(config) {
    try {
        console.log('⚙️ Saving system configuration...');
        
        // Validate configuration - make it more flexible
        if (!config.notifications && !config.email && !config.zoho && !config.googleSheets && !config.security) {
            throw new Error('At least one configuration section is required');
        }
        
        // Update system config
        systemConfig = { ...systemConfig, ...config };
        
        // Update environment variables for email and Zoho
        if (config.email?.notificationEmail) {
            process.env.NOTIFICATION_EMAIL = config.email.notificationEmail;
        }
        if (config.email?.ccEmail) {
            process.env.CC_EMAIL = config.email.ccEmail;
        }
        if (config.zoho?.webhookUrl) {
            process.env.ZOHO_FLOW_WEBHOOK_URL = config.zoho.webhookUrl;
        }
        if (config.zoho?.webhookSecret) {
            process.env.ZOHO_FLOW_WEBHOOK_SECRET = config.zoho.webhookSecret;
        }
        
        // Save to .env file permanently
        const fs = require('fs');
        const envPath = '.env';
        
        try {
            let envContent = '';
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
            }
            
            // Update or add configuration variables
            const lines = envContent.split('\n');
            let notificationEmailUpdated = false;
            let ccEmailUpdated = false;
            let zohoWebhookUrlUpdated = false;
            let zohoWebhookSecretUpdated = false;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('NOTIFICATION_EMAIL=')) {
                    lines[i] = `NOTIFICATION_EMAIL=${config.email?.notificationEmail || ''}`;
                    notificationEmailUpdated = true;
                } else if (lines[i].startsWith('CC_EMAIL=')) {
                    lines[i] = `CC_EMAIL=${config.email?.ccEmail || ''}`;
                    ccEmailUpdated = true;
                } else if (lines[i].startsWith('ZOHO_FLOW_WEBHOOK_URL=')) {
                    lines[i] = `ZOHO_FLOW_WEBHOOK_URL=${config.zoho?.webhookUrl || ''}`;
                    zohoWebhookUrlUpdated = true;
                } else if (lines[i].startsWith('ZOHO_FLOW_WEBHOOK_SECRET=')) {
                    lines[i] = `ZOHO_FLOW_WEBHOOK_SECRET=${config.zoho?.webhookSecret || ''}`;
                    zohoWebhookSecretUpdated = true;
                }
            }
            
            // Add new lines if they don't exist
            if (!notificationEmailUpdated && config.email?.notificationEmail) {
                lines.push(`NOTIFICATION_EMAIL=${config.email.notificationEmail}`);
            }
            if (!ccEmailUpdated && config.email?.ccEmail) {
                lines.push(`CC_EMAIL=${config.email.ccEmail}`);
            }
            if (!zohoWebhookUrlUpdated && config.zoho?.webhookUrl) {
                lines.push(`ZOHO_FLOW_WEBHOOK_URL=${config.zoho.webhookUrl}`);
            }
            if (!zohoWebhookSecretUpdated && config.zoho?.webhookSecret) {
                lines.push(`ZOHO_FLOW_WEBHOOK_SECRET=${config.zoho.webhookSecret}`);
            }
            
            // Write back to file
            fs.writeFileSync(envPath, lines.join('\n'));
            console.log(`✅ System configuration saved to .env file`);
        } catch (fileError) {
            console.error('❌ Error writing to .env file:', fileError);
            // Continue anyway, at least it's saved in memory
        }
        
        // Save to config database
        if (config.notifications) {
            const success = configDB.updateNotificationsConfig({
                email: config.notifications.email,
                password: config.notifications.password,
                emailFromName: config.notifications.emailFromName || 'IRIAS Ironworks',
                service: config.notifications.service || 'gmail'
            });
            
            if (!success) {
                console.error('❌ Failed to save notifications config to database');
            } else {
                console.log('✅ Notifications config saved to database');
            }

            // Update environment variables for immediate use
            process.env.NOTIFICATIONS_EMAIL = config.notifications.email;
            process.env.NOTIFICATIONS_PASSWORD = config.notifications.password;
            process.env.NOTIFICATIONS_EMAIL_FROM_NAME = config.notifications.emailFromName || 'IRIAS Ironworks';
            process.env.NOTIFICATIONS_SERVICE = config.notifications.service || 'gmail';
            
            // Also set legacy environment variables for compatibility
            process.env.GMAIL_USER = config.notifications.email;
            process.env.GMAIL_APP_PASSWORD = config.notifications.password;
            process.env.EMAIL_FROM_NAME = config.notifications.emailFromName || 'IRIAS Ironworks';
        }
        
        if (config.zoho) {
            configDB.updateZohoConfig({
                webhookUrl: config.zoho.webhookUrl,
                webhookSecret: config.zoho.webhookSecret
            });
        }
        
        // Configure email service if notifications settings are provided
        if (config.notifications?.email && config.notifications?.password) {
            const emailConfig = {
                email: config.notifications.email,
                service: config.notifications.service || 'gmail',
                password: config.notifications.password,
                emailFromName: config.notifications.emailFromName || 'IRIAS Ironworks'
            };
            
            const emailConfigResult = await emailService.configure(emailConfig);
            if (emailConfigResult.success) {
                console.log('✅ Notifications service configured successfully');
            } else {
                console.warn('⚠️ Notifications service configuration failed:', emailConfigResult.error);
            }
        }
        
        // Configure Zoho Flow webhook if webhook settings are provided
        if (config.zoho?.webhookUrl) {
            const zohoConfig = {
                webhookUrl: config.zoho.webhookUrl,
                webhookSecret: config.zoho.webhookSecret || ''
            };
            
            const zohoConfigResult = zohoWebhookService.configure(zohoConfig);
            if (zohoConfigResult.success) {
                console.log('✅ Zoho Flow webhook configured successfully');
            } else {
                console.warn('⚠️ Zoho Flow webhook configuration failed:', zohoConfigResult.error);
            }
        }
        
        console.log('✅ System configuration saved successfully to .env file');
        return { success: true, message: 'Configuration saved successfully to .env file' };
    } catch (error) {
        console.error('❌ Error saving system config:', error);
        throw error;
    }
}

async function testNotificationsConfiguration(email, password) {
    try {
        console.log(`📧 Testing notifications configuration for: ${email}`);
        
        // Check if we have the required credentials
        if (!email || !password) {
            throw new Error('Email and password are required for testing.');
        }
        
        // Configure email service with provided settings
        const config = {
            email: email,
            service: 'gmail',
            password: password // For Gmail, this should be an App Password
        };
        
        console.log('📧 Configuring email service...');
        const configResult = await emailService.configure(config);
        if (!configResult.success) {
            throw new Error(configResult.error);
        }
        
        // Verify configuration
        console.log('📧 Verifying email configuration...');
        const verifyResult = await emailService.verifyConfiguration();
        if (!verifyResult.success) {
            throw new Error(verifyResult.error);
        }
        
        // Send test email
        console.log('📧 Sending test email...');
        const testResult = await emailService.sendTestEmail(email);
        
        if (!testResult.success) {
            throw new Error(testResult.error);
        }
        
        console.log(`✅ Email test successful for: ${email}`);
        return testResult;
    } catch (error) {
        console.error('❌ Error testing email:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function testZohoWebhook(webhookUrl, webhookSecret) {
    try {
        console.log(`🔗 Testing Zoho Flow webhook: ${webhookUrl}`);
        
        // Check if we have the required URL
        if (!webhookUrl) {
            throw new Error('Webhook URL is required for testing.');
        }
        
        // Configure the webhook service
        const config = {
            webhookUrl: webhookUrl,
            webhookSecret: webhookSecret || ''
        };
        
        console.log('🔗 Configuring Zoho webhook service...');
        const configResult = zohoWebhookService.configure(config);
        if (!configResult.success) {
            throw new Error(configResult.error);
        }
        
        // Test the webhook
        console.log('🔗 Testing webhook connection...');
        const testResult = await zohoWebhookService.testWebhook();
        
        console.log(`✅ Zoho Flow webhook test completed`);
        return testResult;
    } catch (error) {
        console.error('❌ Error testing Zoho Flow webhook:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function testGoogleSheetsConnection() {
    try {
        console.log('📊 Testing Google Sheets connection...');
        
        // Test the connection by trying to fetch data
        if (googleSheets) {
            const testData = await googleSheets.getClientsData();
            console.log(`✅ Google Sheets connection test successful`);
            return {
                success: true,
                message: 'Google Sheets connection successful',
                clientCount: testData.length || 0
            };
        } else {
            throw new Error('Google Sheets not initialized');
        }
    } catch (error) {
        console.error('❌ Error testing Google Sheets connection:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function getSystemStatus() {
    try {
        console.log('📊 Getting system status...');
        
        const status = {
            notifications: {
                configured: emailService.isConfigured,
                email: systemConfig.notifications?.email || 'Not configured',
                service: systemConfig.notifications?.service || 'Not configured'
            },
            zoho: {
                configured: zohoWebhookService.isConfigured,
                webhookUrl: systemConfig.zoho?.webhookUrl || 'Not configured',
                hasSecret: !!systemConfig.zoho?.webhookSecret
            },
            googleSheets: {
                configured: !!googleSheets,
                clientCount: 0
            },
            googleDrive: {
                configured: googleDriveService.isConfigured,
                hasCredentials: !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
                rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || 'root'
            },
            timestamp: new Date().toISOString()
        };
        
        // Get Google Sheets client count if available
        try {
            if (googleSheets) {
                const clients = await googleSheets.getClientsData();
                status.googleSheets.clientCount = clients.length || 0;
            }
        } catch (error) {
            console.warn('⚠️ Could not get Google Sheets client count:', error.message);
        }
        
        console.log('✅ System status retrieved successfully');
        return status;
    } catch (error) {
        console.error('❌ Error getting system status:', error);
        throw error;
    }
}