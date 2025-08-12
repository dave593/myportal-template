require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');
const jwt = require('jsonwebtoken');

// Importar servicios
const GoogleSheetsIntegration = require('./google-sheets-integration.js');
const EmailService = require('./email-service.js');
const ZohoWebhookService = require('./zoho-webhook-service.js');
const GoogleDriveService = require('./google-drive-service.js');
const GoogleAuthRoutes = require('./routes/google-auth.js');

const PORT = process.env.PORT || 8080;

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

// Initialize services
const googleSheets = new GoogleSheetsIntegration();
const emailService = new EmailService();
const zohoWebhookService = new ZohoWebhookService();
const googleDriveService = new GoogleDriveService();
const googleAuth = new GoogleAuthRoutes();

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
    '.woff2': 'application/font-woff2',
    '.eot': 'application/vnd.ms-fontobject',
    '.ttf': 'application/font-ttf',
    '.otf': 'application/font-otf'
};

function setCORSHeaders(req, res) {
            res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Max-Age', '86400');
        // Prevent browser caching
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
}

function sendErrorResponse(res, statusCode, message, error = null) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    const response = {
        success: false,
        error: true,
        message: message,
        timestamp: new Date().toISOString()
    };
    
    if (error && process.env.NODE_ENV === 'development') {
        response.debug = error.message;
    }
    
    res.end(JSON.stringify(response, null, 2));
}

function sendSuccessResponse(res, data, message = 'Success') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    const response = {
        success: true,
        error: false,
        message: message,
        data: data,
        timestamp: new Date().toISOString()
    };
    res.end(JSON.stringify(response, null, 2));
}

function verifyToken(req) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded;
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return null;
    }
}

// Nueva función para verificar autenticación global
function checkGlobalAuth(req, res) {
    // Rutas públicas que no requieren autenticación
    const publicRoutes = [
        '/login.html',
        '/auth/google',
        '/auth/google/callback',
        '/auth/status',
        '/api/health',
        '/api/debug',
        '/api/test',
        '/api/system-status',
        '/shared-styles.css',
        '/jwt-auth.js',
        '/favicon.ico'
    ];
    
    // Verificar si es una ruta pública
    const cleanUrl = req.url.split('?')[0].split('#')[0];
    const isPublicRoute = publicRoutes.some(route => cleanUrl === route || cleanUrl.startsWith(route));
    
    // Si es una ruta pública, permitir acceso
    if (isPublicRoute) {
        return true;
    }
    
    // Para rutas de API, verificar token JWT
    if (cleanUrl.startsWith('/api/')) {
        const user = verifyToken(req);
        if (!user) {
            sendErrorResponse(res, 401, 'Authentication required. Please login first.');
            return false;
        }
        return true;
    }
    
    // Para páginas HTML, verificar token en cookies o localStorage
    // Intentar obtener token de diferentes fuentes
    let token = null;
    
    // 1. Verificar Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    }
    
    // 2. Verificar cookie (si existe)
    if (!token && req.headers.cookie) {
        const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {});
        token = cookies.fire_escape_jwt_token || cookies.authToken || cookies.jwtToken;
    }
    
    // Si no hay token, redirigir a login
    if (!token) {
        console.log('🔒 No token found, redirecting to login');
        res.writeHead(302, { 'Location': '/login.html' });
        res.end();
        return false;
    }
    
    // Verificar token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token válido para:', decoded.email);
        return true;
    } catch (error) {
        console.log('❌ Token inválido, redirecting to login');
        res.writeHead(302, { 'Location': '/login.html' });
        res.end();
        return false;
    }
}

function serveStaticFile(req, res) {
    const url = req.url;
    let filePath = '';
    
    // Handle root path
    if (url === '/' || url === '/index.html') {
        filePath = path.join(__dirname, 'business-portal.html');
    } else {
        // Remove query parameters and hash
        const cleanUrl = url.split('?')[0].split('#')[0];
        
        // Handle common routes without .html extension
        if (cleanUrl === '/login') {
            filePath = path.join(__dirname, 'login.html');
        } else if (cleanUrl === '/dashboard') {
            filePath = path.join(__dirname, 'dashboard-clientes.html');
        } else if (cleanUrl === '/onboarding') {
            filePath = path.join(__dirname, 'customer-onboarding.html');
        } else if (cleanUrl === '/admin') {
            filePath = path.join(__dirname, 'admin-access-control.html');
        } else if (cleanUrl === '/config') {
            filePath = path.join(__dirname, 'system-config.html');
        } else {
            filePath = path.join(__dirname, cleanUrl);
        }
    }
    
    // Security check - prevent directory traversal
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(__dirname))) {
        sendErrorResponse(res, 403, 'Access denied');
        return;
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        // Try to serve index.html for directory requests
        if (url.endsWith('/')) {
            const indexPath = path.join(filePath, 'index.html');
            if (fs.existsSync(indexPath)) {
                filePath = indexPath;
            } else {
                sendErrorResponse(res, 404, 'File not found');
                return;
            }
        } else {
            sendErrorResponse(res, 404, 'File not found');
            return;
        }
    }
    
    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Read and serve file
    fs.readFile(filePath, (err, data) => {
        if (err) {
            logger.error('Error reading file:', err);
            sendErrorResponse(res, 500, 'Internal server error');
            return;
        }
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

async function handleAPIRoute(req, res) {
    const url = req.url;
    const path = url.split('?')[0];
    
    logger.info('🔍 handleAPIRoute called with path: ' + path);
    logger.info('🔍 Full URL: ' + url);
    
    try {
        switch (path) {
            case '/api/health':
                sendSuccessResponse(res, {
                    message: "Test server running with security features",
                    timestamp: new Date().toISOString(),
                    status: "healthy",
                    service: "Fire Escape Reports System",
                    version: "2.0.0",
                    environment: process.env.NODE_ENV || "production"
                }, "Health check successful");
                break;
                
            case '/api/system-status':
                // Verify authentication
                const statusUser = verifyToken(req);
                if (!statusUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                const status = await getSystemStatus();
                sendSuccessResponse(res, status, "System status retrieved successfully");
                break;
                
            case '/api/test-google-sheets':
                // Verify authentication
                const sheetsTestUser = verifyToken(req);
                if (!sheetsTestUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                const sheetsTest = await testGoogleSheetsConnection();
                sendSuccessResponse(res, sheetsTest, "Google Sheets test completed");
                break;
                
            case '/api/test-drive':
                // Verify authentication
                const driveTestUser = verifyToken(req);
                if (!driveTestUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                const driveTest = await testGoogleDriveConnection();
                sendSuccessResponse(res, driveTest, "Google Drive test completed");
                break;
                
            case '/api/test-email':
                // Verify authentication
                const emailTestUser = verifyToken(req);
                if (!emailTestUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                const emailTest = await testEmailConfiguration();
                sendSuccessResponse(res, emailTest, "Email test completed");
                break;
                
            case '/api/test-zoho':
                // Verify authentication
                const zohoTestUser = verifyToken(req);
                if (!zohoTestUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                const zohoTest = await testZohoWebhook();
                sendSuccessResponse(res, zohoTest, "Zoho test completed");
                break;
                
            case '/api/clients':
                // Verify authentication for all client operations
                const clientUser = verifyToken(req);
                if (!clientUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                if (req.method === 'GET') {
                    logger.info('🔄 Fetching fresh clients data...');
                    const clients = await getClientsData();
                    // Send clients directly as data
                    sendSuccessResponse(res, clients, "Clients data retrieved successfully");
                } else if (req.method === 'POST') {
                    try {
                        logger.info('🔍 Creating new client...');
                        
                        // Parse request body
                        let body = '';
                        req.on('data', chunk => {
                            body += chunk.toString();
                        });
                        
                        req.on('end', async () => {
                            try {
                                const clientData = JSON.parse(body);
                                logger.info('📋 Client data received:', JSON.stringify(clientData));
                                
                                // Initialize Google Sheets if needed
                                if (!googleSheets.initialized) {
                                    await googleSheets.initialize();
                                }
                                
                                // Add client to Google Sheets
                                const addedClient = await googleSheets.addClient(clientData);
                                logger.info('✅ Client added to Google Sheets:', addedClient);
                                
                                // Send email notification
                                let emailResult = null;
                                let emailError = null;
                                try {
                                    if (emailService.isConfigured) {
                                        emailResult = await emailService.sendNewLeadNotification(clientData, 'newcustomers@iriasironworks.com');
                                        logger.info('✅ Email notification sent');
                                    } else {
                                        logger.warn('⚠️ Email service not configured');
                                    }
                                } catch (emailErr) {
                                    emailError = emailErr.message;
                                    logger.error('❌ Email notification failed:', emailErr.message);
                                }
                                
                                // Trigger Zoho webhook
                                let zohoResult = null;
                                let zohoError = null;
                                try {
                                    if (zohoWebhookService.isConfigured) {
                                        zohoResult = await zohoWebhookService.triggerNewClientWebhook(clientData);
                                        logger.info('✅ Zoho webhook triggered');
                                    } else {
                                        logger.warn('⚠️ Zoho webhook not configured');
                                    }
                                } catch (zohoErr) {
                                    zohoError = zohoErr.message;
                                    logger.error('❌ Zoho webhook failed:', zohoErr.message);
                                }
                                
                                sendSuccessResponse(res, {
                                    success: true,
                                    client: addedClient,
                                    emailSent: !!emailResult,
                                    emailError: emailError,
                                    zohoTriggered: !!zohoResult,
                                    zohoError: zohoError
                                }, "Client registered successfully");
                                
                            } catch (error) {
                                logger.error('❌ Error creating client:', error);
                                sendErrorResponse(res, 500, 'Error creating client: ' + error.message);
                            }
                        });
                        
                        return null; // Response will be sent in the callback
                    } catch (error) {
                        logger.error('❌ Error in client creation:', error);
                        sendErrorResponse(res, 500, 'Internal server error');
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case '/api/client-status':
                // Verify authentication
                const clientStatusUser = verifyToken(req);
                if (!clientStatusUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                if (req.method === 'PUT') {
                    try {
                        logger.info('🔍 Updating client status...');
                        logger.info('🔍 Request headers:', req.headers);
                        logger.info('🔍 Request method:', req.method);
                        logger.info('🔍 Request URL:', req.url);
                        
                        // Parse request body
                        let body = '';
                        req.on('data', chunk => {
                            body += chunk.toString();
                        });
                        
                        req.on('end', async () => {
                            try {
                                const { clientId, status } = JSON.parse(body);
                                logger.info('📋 Client status update received:', { clientId, status });
                                
                                // Initialize Google Sheets if needed
                                if (!googleSheets.initialized) {
                                    await googleSheets.initialize();
                                }
                                
                                // Update client status in Google Sheets
                                const updateResult = await googleSheets.updateClientInSheet(clientId, { status });
                                logger.info('✅ Client status updated:', updateResult);
                                
                                sendSuccessResponse(res, {
                                    success: true,
                                    clientId: clientId,
                                    newStatus: status,
                                    updateResult: updateResult
                                }, "Client status updated successfully");
                                
                            } catch (error) {
                                logger.error('❌ Error updating client status:', error);
                                sendErrorResponse(res, 500, 'Error updating client status: ' + error.message);
                            }
                        });
                        
                        return null; // Response will be sent in the callback
                    } catch (error) {
                        logger.error('❌ Error in client status update:', error);
                        sendErrorResponse(res, 500, 'Internal server error');
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case '/api/client-update':
                // Verify authentication
                const clientUpdateUser = verifyToken(req);
                if (!clientUpdateUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                if (req.method === 'PUT') {
                    try {
                        logger.info('🔍 Updating client data...');
                        
                        // Parse request body
                        let body = '';
                        req.on('data', chunk => {
                            body += chunk.toString();
                        });
                        
                        req.on('end', async () => {
                            try {
                                const { clientId, updateData } = JSON.parse(body);
                                logger.info('📋 Client update received:', { clientId, updateData });
                                
                                // Initialize Google Sheets if needed
                                if (!googleSheets.initialized) {
                                    await googleSheets.initialize();
                                }
                                
                                // Update client data in Google Sheets
                                const updateResult = await googleSheets.updateClientInSheet(clientId, updateData);
                                logger.info('✅ Client data updated:', updateResult);
                                
                                sendSuccessResponse(res, {
                                    success: true,
                                    clientId: clientId,
                                    updateData: updateData,
                                    updateResult: updateResult
                                }, "Client data updated successfully");
                                
                            } catch (error) {
                                logger.error('❌ Error updating client data:', error);
                                sendErrorResponse(res, 500, 'Error updating client data: ' + error.message);
                            }
                        });
                        
                        return null; // Response will be sent in the callback
                    } catch (error) {
                        logger.error('❌ Error in client data update:', error);
                        sendErrorResponse(res, 500, 'Internal server error');
                    }
                } else {
                    sendErrorResponse(res, 405, 'Method not allowed');
                }
                break;
                
            case '/api/business-clients':
                // Verify authentication
                const businessUser = verifyToken(req);
                if (!businessUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                const businessClients = await getBusinessClientsData();
                sendSuccessResponse(res, businessClients, "Business clients data retrieved successfully");
                break;
                
            case '/api/statistics':
                // Verify authentication
                const statsUser = verifyToken(req);
                if (!statsUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                const statistics = await getStatisticsData();
                sendSuccessResponse(res, statistics, "Statistics data retrieved successfully");
                break;
                
            case '/api/reports':
                // Verify authentication
                const reportsUser = verifyToken(req);
                if (!reportsUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                try {
                    logger.info('🔍 /api/reports endpoint called');
                    logger.info('📋 Request method: ' + req.method);
                    logger.info('📋 Request headers: ' + JSON.stringify(req.headers));
                    
                    // Initialize Google Sheets if needed
                    logger.info('📋 Google Sheets initialized: ' + googleSheets.initialized);
                    if (!googleSheets.initialized) {
                        logger.info('📋 Initializing Google Sheets...');
                        await googleSheets.initialize();
                        logger.info('📋 Google Sheets initialized successfully');
                    }
                    
                    // Get reports directly from Google Sheets
                    logger.info('📋 Calling getReportsData...');
                    const reports = await googleSheets.getReportsData();
                    logger.info('📊 Raw reports from Google Sheets: ' + JSON.stringify(reports));
                    logger.info('📊 Reports type: ' + typeof reports);
                    logger.info('📊 Reports length: ' + (reports ? reports.length : 'null'));
                    
                    // If no reports found, try alternative approach
                    let finalReports = reports;
                    if (!reports || reports.length === 0) {
                        logger.info('📊 No reports found, trying alternative approach...');
                        try {
                            const response = await googleSheets.sheets.spreadsheets.values.get({
                                spreadsheetId: googleSheets.spreadsheetId,
                                range: 'Form Responses 1!A:O',
                                key: googleSheets.apiKey
                            });
                            
                            const rows = response.data.values;
                            if (rows && rows.length > 1) {
                                finalReports = rows.slice(1).map(row => ({
                                    reportId: row[0] || 'REP-' + Date.now(),
                                    clientName: row[4] || 'Unknown',
                                    clientEmail: row[5] || '',
                                    reportType: row[6] || 'Fire Escape Inspection',
                                    generatedAt: row[13] || new Date().toISOString(),
                                    status: row[7] || 'Generated',
                                    reportUrl: row[14] || '',
                                    company: row[3] || '',
                                    inspectionDate: row[2] || new Date().toISOString().split('T')[0],
                                    inspector: row[11] || 'David Ramirez'
                                }));
                                logger.info('📊 Found ' + finalReports.length + ' reports from alternative approach');
                            }
                        } catch (altError) {
                            logger.error('❌ Alternative approach failed: ' + altError.message);
                        }
                    }
                    
                    // Transform data to match expected format for frontend
                    logger.info('📋 Transforming reports data...');
                    const transformedReports = finalReports.map(report => ({
                        reportId: report.reportId,
                        clientName: report.clientName,
                        clientEmail: report.clientEmail || report.address || '',
                        reportType: report.reportType,
                        generatedAt: report.generatedAt || report.createdAt || report.date,
                        status: report.status,
                        reportUrl: report.reportUrl || '',
                        company: report.company,
                        inspectionDate: report.inspectionDate || report.date,
                        inspector: report.inspector
                    }));
                    
                    logger.info('📊 Final result: ' + transformedReports.length + ' reports');
                    logger.info('📊 Final reports structure: ' + JSON.stringify(transformedReports));
                    
                    const responseData = { 
                        reports: transformedReports,
                        totalCount: transformedReports.length,
                        lastUpdated: new Date().toISOString()
                    };
                    
                    logger.info('📊 Sending response: ' + JSON.stringify(responseData));
                    
                    sendSuccessResponse(res, responseData, "Reports data retrieved successfully");
                } catch (error) {
                    logger.error('❌ Error getting reports: ' + error.message);
                    logger.error('❌ Error stack: ' + error.stack);
                    sendSuccessResponse(res, { 
                        reports: [],
                        totalCount: 0,
                        lastUpdated: new Date().toISOString()
                    }, "Reports data retrieved successfully");
                }
                break;
                
            case '/api/debug':
                // Verify authentication
                const debugUser = verifyToken(req);
                if (!debugUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                try {
                    logger.info('🔍 Debug endpoint called');
                    
                    // Test direct call to Google Sheets
                    if (!googleSheets.initialized) {
                        await googleSheets.initialize();
                    }
                    
                    const reports = await googleSheets.getReportsData();
                    logger.info('📊 Direct Google Sheets call result: ' + JSON.stringify(reports));
                    
                    sendSuccessResponse(res, { 
                        message: 'Debug endpoint working',
                        timestamp: new Date().toISOString(),
                        server: 'server-simple.js',
                        googleSheetsInitialized: googleSheets.initialized,
                        reportsFromSheets: reports,
                        reportsCount: reports ? reports.length : 0,
                        spreadsheetId: googleSheets.spreadsheetId
                    }, "Debug endpoint working");
                } catch (error) {
                    logger.error('❌ Debug error: ' + error.message);
                    sendErrorResponse(res, 500, 'Debug error: ' + error.message);
                }
                break;
                
            case '/api/test':
                // Verify authentication
                const testUser = verifyToken(req);
                if (!testUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                try {
                    logger.info('🧪 Test endpoint called');
                    
                    sendSuccessResponse(res, { 
                        message: 'Test endpoint working',
                        timestamp: new Date().toISOString(),
                        server: 'server-simple.js',
                        googleSheetsInitialized: googleSheets.initialized
                    }, "Test endpoint working");
                } catch (error) {
                    logger.error('❌ Test error: ' + error.message);
                    sendErrorResponse(res, 500, 'Test error: ' + error.message);
                }
                break;
                
            case '/api/test-credentials':
                // Verify authentication
                const credUser = verifyToken(req);
                if (!credUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                // Test endpoint to check credentials
                try {
                    console.log('🧪 Testing credentials...');
                    console.log('📋 GOOGLE_API_KEY exists:', !!process.env.GOOGLE_API_KEY);
                    console.log('📋 GOOGLE_API_KEY length:', process.env.GOOGLE_API_KEY ? process.env.GOOGLE_API_KEY.length : 0);
                    console.log('📋 GOOGLE_API_KEY value:', process.env.GOOGLE_API_KEY ? process.env.GOOGLE_API_KEY.substring(0, 10) + '...' : 'NOT_FOUND');
                    
                    if (process.env.GOOGLE_API_KEY) {
                        // Test Google Sheets connection with API Key
                        const { google } = require('googleapis');
                        const sheets = google.sheets({ version: 'v4' });
                        
                        const testResponse = await sheets.spreadsheets.get({
                            spreadsheetId: '13Fld-uJgwWuJVVxyEJoB9h7zAVbN2HlizV5udmT5XZU',
                            key: process.env.GOOGLE_API_KEY
                        });
                        
                        sendSuccessResponse(res, {
                            apiKeyLoaded: true,
                            apiKeyLength: process.env.GOOGLE_API_KEY.length,
                            sheetsConnection: 'successful',
                            spreadsheetTitle: testResponse.data.properties.title
                        });
                    } else {
                        sendErrorResponse(res, 500, 'API Key not found');
                    }
                } catch (error) {
                    console.error('❌ Error testing API Key:', error.message);
                    sendErrorResponse(res, 500, 'Error testing API Key: ' + error.message);
                }
                break;
                
            case '/api/reports/debug':
                // Verify authentication
                const reportsDebugUser = verifyToken(req);
                if (!reportsDebugUser) {
                    sendErrorResponse(res, 401, 'Authentication required. Please login first.');
                    return null;
                }
                
                try {
                    console.log('🔍 Debug endpoint called');
                    console.log('📋 googleSheets.initialized:', googleSheets.initialized);
                    
                    if (!googleSheets.initialized) {
                        console.log('🔄 Initializing Google Sheets...');
                        await googleSheets.initialize();
                        console.log('✅ Google Sheets initialized');
                    }
                    
                    console.log('📊 Calling googleSheets.getReportsData()...');
                    const reports = await googleSheets.getReportsData();
                    console.log('📊 Raw reports:', reports);
                    console.log('📊 Reports length:', reports ? reports.length : 'null/undefined');
                    
                    sendSuccessResponse(res, {
                        initialized: googleSheets.initialized,
                        reports: reports,
                        reportsLength: reports ? reports.length : 0,
                        sampleReport: reports && reports.length > 0 ? reports[0] : null
                    }, "Debug information retrieved");
                } catch (error) {
                    console.error('❌ Debug error:', error);
                    sendErrorResponse(res, 500, 'Debug error: ' + error.message);
                }
                break;
                
            case '/api/reports/save':
                const savedReport = await saveReportData(req, res);
                if (savedReport) {
                    sendSuccessResponse(res, savedReport, "Report saved successfully");
                }
                return; // Already sent response
                
            default:
                sendErrorResponse(res, 404, 'API endpoint not found');
        }
    } catch (error) {
        logger.error('API route error:', error);
        sendErrorResponse(res, 500, 'Internal server error');
    }
}

async function handleAuthRoute(req, res) {
    const url = req.url;
    const path = url.split('?')[0];
    
    try {
        switch (path) {
            case '/auth/google':
                await googleAuth.initiateGoogleAuth(req, res);
                break;
                
            case '/auth/google/callback':
                await googleAuth.handleGoogleCallback(req, res);
                break;
                
            case '/auth/status':
                // Verify token for auth status check
                const user = verifyToken(req);
                if (user) {
                    req.user = user;
                }
                await googleAuth.checkAuthStatus(req, res);
                break;
                
            case '/auth/logout':
                // Verify token for logout
                const logoutUser = verifyToken(req);
                if (logoutUser) {
                    req.user = logoutUser;
                }
                await googleAuth.logout(req, res);
                break;
                
            default:
                sendErrorResponse(res, 404, 'Auth endpoint not found');
        }
    } catch (error) {
        logger.error('Auth route error:', error);
        sendErrorResponse(res, 500, 'Internal server error');
    }
}

async function getSystemStatus() {
    try {
        const status = {
            notifications: {
                configured: emailService.isConfigured,
                email: emailService.isConfigured ? "Configured" : "Not configured",
                service: emailService.isConfigured ? "Gmail" : "Not configured"
            },
            zoho: {
                configured: zohoWebhookService.isConfigured,
                webhookUrl: zohoWebhookService.isConfigured ? "Configured" : "Not configured",
                hasSecret: zohoWebhookService.isConfigured
            },
            googleSheets: {
                configured: googleSheets.initialized,
                clientCount: 0
            },
            googleDrive: {
                configured: googleDriveService.isConfigured,
                hasCredentials: googleDriveService.isConfigured,
                rootFolderId: googleDriveService.isConfigured ? "Configured" : "Not configured"
            },
            timestamp: new Date().toISOString()
        };
        
        // Get Google Sheets client count if available
        try {
            if (googleSheets.initialized) {
                const clients = await googleSheets.getClientsData();
                status.googleSheets.clientCount = clients.length || 0;
            }
        } catch (error) {
            logger.warn('Could not get Google Sheets client count:', error.message);
        }
        
        return status;
    } catch (error) {
        logger.error('Error getting system status:', error);
        throw error;
    }
}

async function testGoogleSheetsConnection() {
    try {
        if (googleSheets.initialized) {
            const testData = await googleSheets.getClientsData();
            return {
                success: true,
                message: 'Google Sheets connection successful',
                clientCount: testData.length || 0
            };
        } else {
            return {
                success: false,
                message: 'Google Sheets not initialized'
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

async function testGoogleDriveConnection() {
    try {
        if (googleDriveService.isConfigured) {
            return {
                success: true,
                message: 'Google Drive connection successful'
            };
        } else {
            return {
                success: false,
                message: 'Google Drive not configured'
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

async function testEmailConfiguration() {
    try {
        if (emailService.isConfigured) {
            return {
                success: true,
                message: 'Email service configured'
            };
        } else {
            return {
                success: false,
                message: 'Email service not configured'
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

async function testZohoWebhook() {
    try {
        if (zohoWebhookService.isConfigured) {
            return {
                success: true,
                message: 'Zoho webhook configured'
            };
        } else {
            return {
                success: false,
                message: 'Zoho webhook not configured'
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

async function getClientsData() {
    try {
        if (!googleSheets.initialized) {
            await googleSheets.initialize();
        }
        
        const clients = await googleSheets.getClientsData();
        return {
            clients: clients || [],
            totalCount: clients ? clients.length : 0,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error getting clients data:', error);
        return {
            clients: [],
            totalCount: 0,
            error: error.message,
            lastUpdated: new Date().toISOString()
        };
    }
}

async function getBusinessClientsData() {
    try {
        if (!googleSheets.initialized) {
            await googleSheets.initialize();
        }
        
        const clients = await googleSheets.getClientsData();
        const businessClients = clients ? clients.filter(client => 
            client.status === 'Active' || client.status === 'Pending' || client.status === 'New Lead'
        ) : [];
        
        return {
            businessClients: businessClients,
            totalCount: businessClients.length,
            activeCount: businessClients.filter(c => c.status === 'Active').length,
            pendingCount: businessClients.filter(c => c.status === 'Pending').length,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error getting business clients data:', error);
        return {
            businessClients: [],
            totalCount: 0,
            activeCount: 0,
            pendingCount: 0,
            error: error.message,
            lastUpdated: new Date().toISOString()
        };
    }
}

async function getStatisticsData() {
    try {
        if (!googleSheets.initialized) {
            await googleSheets.initialize();
        }
        
        const clients = await googleSheets.getClientsData();
        const totalClients = clients ? clients.length : 0;
        
        // Calculate statistics
        const stats = {
            totalClients: totalClients,
            activeClients: clients ? clients.filter(c => c.status === 'Active').length : 0,
            pendingClients: clients ? clients.filter(c => c.status === 'Pending').length : 0,
            newLeads: clients ? clients.filter(c => c.status === 'New Lead').length : 0,
            completedProjects: clients ? clients.filter(c => c.status === 'Completed').length : 0,
            revenue: clients ? clients.reduce((sum, client) => {
                const amount = parseFloat(client.amount || 0);
                return sum + (isNaN(amount) ? 0 : amount);
            }, 0) : 0,
            averageProjectValue: 0,
            monthlyGrowth: 0,
            lastUpdated: new Date().toISOString()
        };
        
        // Calculate average project value
        if (stats.totalClients > 0) {
            stats.averageProjectValue = stats.revenue / stats.totalClients;
        }
        
        return stats;
    } catch (error) {
        logger.error('Error getting statistics data:', error);
        return {
            totalClients: 0,
            activeClients: 0,
            pendingClients: 0,
            newLeads: 0,
            completedProjects: 0,
            revenue: 0,
            averageProjectValue: 0,
            monthlyGrowth: 0,
            error: error.message,
            lastUpdated: new Date().toISOString()
        };
    }
}

async function getReportsData() {
    try {
        logger.info('🔍 getReportsData called in server-simple.js');
        
        if (!googleSheets.initialized) {
            await googleSheets.initialize();
        }
        
        // Get reports from Google Sheets
        const reports = await googleSheets.getReportsData();
        logger.info('📊 Raw reports from Google Sheets: ' + JSON.stringify(reports));
        
        // Ensure we return the correct format
        const result = {
            reports: reports || [],
            totalCount: reports ? reports.length : 0,
            lastUpdated: new Date().toISOString()
        };
        
        logger.info('📊 Final result: ' + JSON.stringify(result));
        return result;
    } catch (error) {
        logger.error('❌ Error getting reports data: ' + error.message);
        return {
            reports: [],
            totalCount: 0,
            error: error.message,
            lastUpdated: new Date().toISOString()
        };
    }
}

async function saveReportData(req, res) {
    try {
        // Verify authentication
        const user = verifyToken(req);
        if (!user) {
            sendErrorResponse(res, 401, 'Login Required.');
            return null;
        }
        
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const reportData = JSON.parse(body);
                
                if (!googleSheets.initialized) {
                    await googleSheets.initialize();
                }
                
                // Save report to Google Sheets
                const savedReport = await googleSheets.saveReport(reportData);
                
                sendSuccessResponse(res, savedReport, "Report saved successfully");
            } catch (error) {
                logger.error('Error saving report:', error);
                sendErrorResponse(res, 500, 'Error saving report: ' + error.message);
            }
        });
        
        return null; // Response will be sent in the callback
    } catch (error) {
        logger.error('Error in saveReportData:', error);
        sendErrorResponse(res, 500, 'Internal server error');
        return null;
    }
}

function handleRequest(req, res) {
    logger.info('🔍 handleRequest called with URL: ' + req.url + ' Method: ' + req.method);
    
    setCORSHeaders(req, res);
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const url = req.url;
    
    // Check global authentication
    if (!checkGlobalAuth(req, res)) {
        return; // Redirected, no need to proceed with specific route handling
    }

    // Handle API routes
    if (url.startsWith('/api/')) {
        logger.info('🔍 Routing to handleAPIRoute');
        handleAPIRoute(req, res);
        return;
    }
    
    // Handle Auth routes
    if (url.startsWith('/auth/')) {
        handleAuthRoute(req, res);
        return;
    }
    
    // Handle static files
    serveStaticFile(req, res);
}

// Create HTTP server
const server = http.createServer(handleRequest);

// Start server
server.listen(PORT, '0.0.0.0', async () => {
    logger.info(`🚀 Enhanced server running on port ${PORT}`);
    logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
    logger.info(`🌐 Dashboard: http://localhost:${PORT}/dashboard-clientes.html`);
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
    
    // Initialize Email service
    try {
        logger.info('📧 Initializing Email service...');
        await emailService.initialize();
        logger.info('✅ Email service initialized successfully');
    } catch (error) {
        logger.error('❌ Failed to initialize Email service:', error);
    }
    
    // Initialize Zoho service
    try {
        logger.info('🔗 Initializing Zoho service...');
        await zohoWebhookService.initialize();
        logger.info('✅ Zoho service initialized successfully');
    } catch (error) {
        logger.error('❌ Failed to initialize Zoho service:', error);
    }
    
    // Initialize Google Drive service
    try {
        logger.info('📁 Initializing Google Drive service...');
        await googleDriveService.initialize();
        logger.info('✅ Google Drive service initialized successfully');
    } catch (error) {
        logger.error('❌ Failed to initialize Google Drive service:', error);
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

