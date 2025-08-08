// database.js
// Optimized Database System for Fire Escape Portal
// Uses MySQL as primary database with Google Sheets as backup

const { google } = require('googleapis');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
    constructor() {
        this.sheets = null;
        this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.lastCacheUpdate = 0;
        
        // MySQL connection pool
        this.mysqlPool = null;
        this.mysqlConnected = false;
        
        // Sheet names
        this.sheets = {
            onboarding: 'Clientes e Inspecciones', // Hoja correcta según gid=174672304
            clients: 'Clientes e Inspecciones',
            reports: 'Clientes e Inspecciones'
        };
        
        this.logger = {
            info: (msg, data = {}) => console.log(`[DB] ${new Date().toISOString()} - ${msg}`, data),
            error: (msg, error = {}) => console.error(`[DB ERROR] ${new Date().toISOString()} - ${msg}`, error),
            warn: (msg, data = {}) => console.warn(`[DB WARN] ${new Date().toISOString()} - ${msg}`, data)
        };
    }

    async initialize() {
        try {
            // Initialize MySQL first
            await this.initializeMySQL();
            
            // Initialize Google Sheets as backup
            await this.initializeGoogleSheets();
            
            this.logger.info('✅ Database initialized successfully');
            return true;
        } catch (error) {
            this.logger.error('❌ Database initialization failed:', error);
            return false;
        }
    }

    async initializeMySQL() {
        try {
            // Get MySQL configuration from environment variables
            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'irias_app',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || '
                ',
                port: process.env.DB_PORT || 3306,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                acquireTimeout: 60000,
                timeout: 60000,
                reconnect: true
            };

            this.logger.info('🔗 Initializing MySQL connection...', { host: dbConfig.host, database: dbConfig.database });
            
            // Create connection pool
            this.mysqlPool = mysql.createPool(dbConfig);
            
            // Test connection
            const connection = await this.mysqlPool.getConnection();
            await connection.ping();
            connection.release();
            
            this.mysqlConnected = true;
            this.logger.info('✅ MySQL connection established successfully');
            
            // Ensure tables exist
            await this.ensureTablesExist();
            
        } catch (error) {
            this.logger.error('❌ MySQL initialization failed:', error);
            this.mysqlConnected = false;
            throw error;
        }
    }

    async initializeGoogleSheets() {
        try {
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                this.logger.warn('⚠️ Google Service Account credentials not found, Google Sheets will be read-only');
                return;
            }

            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
            const auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            const authClient = await auth.getClient();
            this.sheets = google.sheets({ version: 'v4', auth: authClient });
            
            await this.ensureSheetsExist();
            await this.ensureHeaders();
            
            this.logger.info('✅ Google Sheets initialized successfully');
        } catch (error) {
            this.logger.error('❌ Google Sheets initialization failed:', error);
            // Don't throw error, continue without Google Sheets
        }
    }

    async ensureTablesExist() {
        try {
            const createTablesSQL = `
                CREATE TABLE IF NOT EXISTS clients (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    client_id VARCHAR(20) UNIQUE NOT NULL,
                    company_name VARCHAR(100) NOT NULL,
                    service_type VARCHAR(100) NOT NULL,
                    urgency_level VARCHAR(50) DEFAULT 'Medium',
                    client_full_name VARCHAR(100) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    phone_number VARCHAR(20),
                    customer_type ENUM('Residential', 'Commercial', 'Industrial') DEFAULT 'Residential',
                    project_address TEXT NOT NULL,
                    technical_description TEXT,
                    budget_range VARCHAR(50),
                    expected_timeline VARCHAR(50),
                    preferred_contact_method ENUM('Phone', 'Email', 'Text') DEFAULT 'Phone',
                    additional_notes TEXT,
                    special_requirements TEXT,
                    status ENUM('New Lead', 'Contacted', 'Quoted', 'Pending Inspection', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'New Lead',
                    form_emailer_status ENUM('Pending', 'Sent', 'Failed') DEFAULT 'Pending',
                    invoice_status ENUM('Pending', 'Sent', 'Paid') DEFAULT 'Pending',
                    estimate_status ENUM('Pending', 'Sent', 'Accepted', 'Rejected') DEFAULT 'Pending',
                    channel ENUM('Website', 'Phone', 'Referral', 'Walk-in') DEFAULT 'Website',
                    responsable VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_client_id (client_id),
                    INDEX idx_status (status),
                    INDEX idx_company (company_name),
                    INDEX idx_created_at (created_at),
                    INDEX idx_email (email)
                );

                CREATE TABLE IF NOT EXISTS system_config (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    config_key VARCHAR(100) UNIQUE NOT NULL,
                    config_value TEXT,
                    config_type ENUM('string', 'json', 'boolean', 'number') DEFAULT 'string',
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_config_key (config_key)
                );

                CREATE TABLE IF NOT EXISTS audit_log (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    action VARCHAR(50) NOT NULL,
                    table_name VARCHAR(50) NOT NULL,
                    record_id INT,
                    old_values JSON,
                    new_values JSON,
                    user_email VARCHAR(255),
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_action (action),
                    INDEX idx_table_name (table_name),
                    INDEX idx_record_id (record_id),
                    INDEX idx_created_at (created_at)
                );
            `;

            await this.mysqlPool.execute(createTablesSQL);
            this.logger.info('✅ Database tables ensured');
        } catch (error) {
            this.logger.error('❌ Error ensuring tables exist:', error);
            throw error;
        }
    }

    async ensureSheetsExist() {
        try {
            if (!this.sheets) return;
            
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            const existingSheets = response.data.sheets.map(sheet => sheet.properties.title);
            
            for (const [key, sheetName] of Object.entries(this.sheets)) {
                if (!existingSheets.includes(sheetName)) {
                    await this.createSheet(sheetName);
                    this.logger.info(`Created sheet: ${sheetName}`);
                }
            }
        } catch (error) {
            this.logger.error('Error ensuring sheets exist:', error);
            // Don't throw error, continue without Google Sheets
        }
    }

    async createSheet(sheetName) {
        try {
            if (!this.sheets) return;
            
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: sheetName
                            }
                        }
                    }]
                }
            });
        } catch (error) {
            this.logger.error(`Error creating sheet ${sheetName}:`, error);
            // Don't throw error
        }
    }

    async ensureHeaders() {
        const headers = {
            clients: [
                'ID', 'Date', 'Company', 'Client Name', 'Email', 'Phone', 'Address', 
                'Service Type', 'Status', 'Priority', 'Notes', 'Responsible', 'Created At'
            ],
            onboarding: [
                'Timestamp', 'Company', 'Service Type', 'Priority', 'Property Type',
                'Scheduled Date', 'Service Notes', 'First Name', 'Last Name', 'Email',
                'Phone', 'Alt Phone', 'Preferred Contact', 'Address', 'City', 'State',
                'Zip Code', 'Lead Source', 'Referral Name', 'Estimated Value'
            ],
            reports: [
                'Report ID', 'Client ID', 'Date', 'Company', 'Client Name', 'Address',
                'Inspection Type', 'Status', 'Findings', 'Recommendations', 'Photos',
                'Inspector', 'Next Inspection Date', 'Created At'
            ],
            statistics: [
                'Date', 'Total Clients', 'Active Clients', 'Pending Clients',
                'Total Reports', 'This Month Reports', 'Revenue', 'Company'
            ]
        };

        for (const [key, headerRow] of Object.entries(headers)) {
            await this.setHeaders(this.sheets[key], headerRow);
        }
    }

    async setHeaders(sheetName, headers) {
        try {
            if (!this.sheets) return;
            
            const range = `${sheetName}!A1:${this.numberToColumnLetter(headers.length)}1`;
            
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'RAW',
                resource: {
                    values: [headers]
                }
            });
        } catch (error) {
            this.logger.error(`Error setting headers for ${sheetName}:`, error);
        }
    }

    // Client Management - MySQL Primary
    async addClient(clientData) {
        try {
            if (!this.mysqlConnected) {
                throw new Error('MySQL not connected');
            }

            const clientId = await this.generateId();
            const timestamp = new Date().toISOString();
            
            const sql = `
                INSERT INTO clients (
                    client_id, company_name, service_type, urgency_level,
                    client_full_name, email, phone_number, customer_type,
                    project_address, technical_description, budget_range,
                    expected_timeline, preferred_contact_method, additional_notes,
                    special_requirements, status, channel, responsable
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const values = [
                clientId,
                clientData.company || 'Unknown',
                clientData.serviceType || 'General',
                clientData.priority || 'Normal',
                clientData.clientFullName || `${clientData.firstName} ${clientData.lastName}`,
                clientData.email,
                clientData.phone || clientData.customerPhoneNumber,
                clientData.customerType || 'Residential',
                clientData.address || clientData.projectAddress,
                clientData.technicalDescription || clientData.description || '',
                clientData.budgetRange || '',
                clientData.expectedTimeline || '',
                clientData.preferredContactMethod || 'Phone',
                clientData.additionalNotes || '',
                clientData.specialRequirements || '',
                'New Lead',
                clientData.channel || 'Website',
                clientData.responsable || 'System'
            ];

            await this.mysqlPool.execute(sql, values);
            this.invalidateCache('clients');
            
            // Also add to Google Sheets as backup
            try {
                await this.addClientToSheets(clientData, clientId);
            } catch (sheetsError) {
                this.logger.warn('Failed to add client to Google Sheets:', sheetsError);
            }
            
            this.logger.info(`Client added: ${clientId}`);
            return { success: true, clientId };
        } catch (error) {
            this.logger.error('Error adding client:', error);
            throw error;
        }
    }

    async addClientToSheets(clientData, clientId) {
        try {
            if (!this.sheets) return;
            
            const row = [
                clientId,
                new Date().toLocaleDateString(),
                clientData.company || 'Unknown',
                clientData.clientFullName || `${clientData.firstName} ${clientData.lastName}`,
                clientData.email,
                clientData.phone || clientData.customerPhoneNumber,
                clientData.address || clientData.projectAddress,
                clientData.serviceType || 'General',
                'New Lead',
                clientData.priority || 'Normal',
                clientData.technicalDescription || clientData.description || '',
                clientData.responsable || 'System',
                new Date().toISOString()
            ];

            await this.appendRow(this.sheets.clients, row);
        } catch (error) {
            this.logger.error('Error adding client to sheets:', error);
            throw error;
        }
    }

    async getClients(company = 'all') {
        try {
            if (!this.mysqlConnected) {
                throw new Error('MySQL not connected');
            }

            const cacheKey = `clients_${company}`;
            if (this.isCacheValid(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            let sql = 'SELECT * FROM clients';
            let values = [];
            
            if (company !== 'all') {
                sql += ' WHERE company_name = ?';
                values.push(company);
            }
            
            sql += ' ORDER BY created_at DESC';

            const [rows] = await this.mysqlPool.execute(sql, values);
            let clients = rows.map(row => this.mapRowToClient(row));

            this.setCache(cacheKey, clients);
            return clients;
        } catch (error) {
            this.logger.error('Error getting clients:', error);
            throw error;
        }
    }

    async updateClientStatus(clientId, status) {
        try {
            if (!this.mysqlConnected) {
                throw new Error('MySQL not connected');
            }

            const sql = 'UPDATE clients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE client_id = ?';
            await this.mysqlPool.execute(sql, [status, clientId]);

            this.invalidateCache('clients');
            this.logger.info(`Client ${clientId} status updated to ${status}`);
            return { success: true };
        } catch (error) {
            this.logger.error('Error updating client status:', error);
            throw error;
        }
    }

    // Report Management
    async addReport(reportData) {
        try {
            if (!this.mysqlConnected) {
                throw new Error('MySQL not connected');
            }

            const reportId = await this.generateId();
            const timestamp = new Date().toISOString();
            
            const sql = `
                INSERT INTO audit_log (action, table_name, record_id, new_values, user_email)
                VALUES ('CREATE_REPORT', 'reports', ?, ?, ?)
            `;
            
            const values = [
                reportId,
                JSON.stringify(reportData),
                reportData.inspector || 'System'
            ];

            await this.mysqlPool.execute(sql, values);
            this.invalidateCache('reports');
            
            this.logger.info(`Report added: ${reportId}`);
            return { success: true, reportId };
        } catch (error) {
            this.logger.error('Error adding report:', error);
            throw error;
        }
    }

    async getReports(clientId = null) {
        try {
            if (!this.mysqlConnected) {
                throw new Error('MySQL not connected');
            }

            const cacheKey = `reports_${clientId || 'all'}`;
            if (this.isCacheValid(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            let sql = 'SELECT * FROM audit_log WHERE action = "CREATE_REPORT"';
            let values = [];
            
            if (clientId) {
                sql += ' AND JSON_EXTRACT(new_values, "$.clientId") = ?';
                values.push(clientId);
            }
            
            sql += ' ORDER BY created_at DESC';

            const [rows] = await this.mysqlPool.execute(sql, values);
            let reports = rows.map(row => this.mapRowToReport(row));

            this.setCache(cacheKey, reports);
            return reports;
        } catch (error) {
            this.logger.error('Error getting reports:', error);
            throw error;
        }
    }

    // Statistics
    async getStatistics(company = 'all') {
        try {
            if (!this.mysqlConnected) {
                throw new Error('MySQL not connected');
            }

            const cacheKey = `stats_${company}`;
            if (this.isCacheValid(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            let sql = `
                SELECT 
                    COUNT(*) as totalClients,
                    SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as activeClients,
                    SUM(CASE WHEN status = 'New Lead' THEN 1 ELSE 0 END) as pendingClients
                FROM clients
            `;
            let values = [];
            
            if (company !== 'all') {
                sql += ' WHERE company_name = ?';
                values.push(company);
            }

            const [rows] = await this.mysqlPool.execute(sql, values);
            const stats = rows[0];

            // Get reports count
            const [reportRows] = await this.mysqlPool.execute(
                'SELECT COUNT(*) as totalReports FROM audit_log WHERE action = "CREATE_REPORT"'
            );
            stats.totalReports = reportRows[0].totalReports;

            // Get this month reports
            const [monthlyRows] = await this.mysqlPool.execute(`
                SELECT COUNT(*) as thisMonth 
                FROM audit_log 
                WHERE action = "CREATE_REPORT" 
                AND MONTH(created_at) = MONTH(CURRENT_DATE())
                AND YEAR(created_at) = YEAR(CURRENT_DATE())
            `);
            stats.thisMonth = monthlyRows[0].thisMonth;

            this.setCache(cacheKey, stats);
            return stats;
        } catch (error) {
            this.logger.error('Error getting statistics:', error);
            throw error;
        }
    }

    // System Configuration
    async getSystemConfig(key = null) {
        try {
            if (!this.mysqlConnected) {
                throw new Error('MySQL not connected');
            }

            if (key) {
                const sql = 'SELECT config_value, config_type FROM system_config WHERE config_key = ?';
                const [rows] = await this.mysqlPool.execute(sql, [key]);
                return rows.length > 0 ? rows[0] : null;
            } else {
                const sql = 'SELECT config_key, config_value, config_type FROM system_config';
                const [rows] = await this.mysqlPool.execute(sql);
                return rows;
            }
        } catch (error) {
            this.logger.error('Error getting system config:', error);
            throw error;
        }
    }

    async setSystemConfig(key, value, type = 'string', description = '') {
        try {
            if (!this.mysqlConnected) {
                throw new Error('MySQL not connected');
            }

            const sql = `
                INSERT INTO system_config (config_key, config_value, config_type, description) 
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    config_value = VALUES(config_value),
                    config_type = VALUES(config_type),
                    description = VALUES(description),
                    updated_at = CURRENT_TIMESTAMP
            `;
            
            await this.mysqlPool.execute(sql, [key, value, type, description]);
            this.logger.info(`System config updated: ${key}`);
            return { success: true };
        } catch (error) {
            this.logger.error('Error setting system config:', error);
            throw error;
        }
    }

    // Utility Methods
    async generateId() {
        return `ID_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async getRows(sheetName) {
        try {
            if (!this.sheets) return [];
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: sheetName
            });
            return response.data.values || [];
        } catch (error) {
            this.logger.error(`Error getting rows from ${sheetName}:`, error);
            return [];
        }
    }

    async appendRow(sheetName, row) {
        try {
            if (!this.sheets) return;
            
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: `${sheetName}!A:A`,
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [row]
                }
            });
        } catch (error) {
            this.logger.error(`Error appending row to ${sheetName}:`, error);
            throw error;
        }
    }

    mapRowToClient(row) {
        return {
            id: row.client_id || '',
            date: row.created_at ? new Date(row.created_at).toLocaleDateString() : '',
            company: row.company_name || '',
            name: row.client_full_name || '',
            email: row.email || '',
            phone: row.phone_number || '',
            address: row.project_address || '',
            serviceType: row.service_type || '',
            status: row.status || '',
            priority: row.urgency_level || '',
            notes: row.additional_notes || '',
            responsible: row.responsable || '',
            createdAt: row.created_at || ''
        };
    }

    mapRowToReport(row) {
        const reportData = row.new_values ? JSON.parse(row.new_values) : {};
        return {
            id: row.record_id || '',
            clientId: reportData.clientId || '',
            date: row.created_at ? new Date(row.created_at).toLocaleDateString() : '',
            company: reportData.company || '',
            clientName: reportData.clientName || '',
            address: reportData.address || '',
            inspectionType: reportData.inspectionType || '',
            status: reportData.status || 'Pending',
            findings: reportData.findings || '',
            recommendations: reportData.recommendations || '',
            photos: reportData.photos || '',
            inspector: row.user_email || 'System',
            nextInspectionDate: reportData.nextInspectionDate || '',
            createdAt: row.created_at || ''
        };
    }

    numberToColumnLetter(column) {
        let temp, letter = '';
        while (column > 0) {
            temp = (column - 1) % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            column = (column - temp - 1) / 26;
        }
        return letter;
    }

    // Cache Management
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    isCacheValid(key) {
        const cached = this.cache.get(key);
        if (!cached) return false;
        return (Date.now() - cached.timestamp) < this.cacheTimeout;
    }

    invalidateCache(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    clearCache() {
        this.cache.clear();
    }

    // Additional methods for compatibility
    async testConnection() {
        try {
            if (this.mysqlConnected) {
                const connection = await this.mysqlPool.getConnection();
                await connection.ping();
                connection.release();
                return { success: true, message: 'MySQL connection successful' };
            } else {
                return { success: false, message: 'MySQL not connected' };
            }
        } catch (error) {
            throw new Error('Database connection failed');
        }
    }

    async getSheetInfo() {
        try {
            if (!this.sheets) {
                return { error: 'Google Sheets not available' };
            }
            
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });
            
            return {
                spreadsheetId: this.spreadsheetId,
                title: response.data.properties.title,
                sheets: response.data.sheets.map(sheet => ({
                    title: sheet.properties.title,
                    rowCount: sheet.properties.gridProperties.rowCount,
                    columnCount: sheet.properties.gridProperties.columnCount
                })),
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error('Error getting sheet info:', error);
            return { error: error.message };
        }
    }

    async addToOnboardingSheet(data) {
        // For compatibility with existing code
        return this.addClient(data);
    }

    async getAllClients() {
        // For compatibility with existing code
        return this.getClients();
    }

    async updateClientStatusCompat(clientId, newStatus) {
        // For compatibility with existing code
        return this.updateClientStatus(clientId, newStatus);
    }

    // MySQL specific methods
    async query(sql, values = []) {
        try {
            if (!this.mysqlConnected) {
                throw new Error('MySQL not connected');
            }
            const [rows] = await this.mysqlPool.execute(sql, values);
            return rows;
        } catch (error) {
            this.logger.error('Error executing query:', error);
            throw error;
        }
    }

    async getClientById(clientId) {
        try {
            const sql = 'SELECT * FROM clients WHERE client_id = ?';
            const rows = await this.query(sql, [clientId]);
            return rows.length > 0 ? this.mapRowToClient(rows[0]) : null;
        } catch (error) {
            this.logger.error('Error getting client by ID:', error);
            throw error;
        }
    }

    async createClient(clientData) {
        return this.addClient(clientData);
    }
}

module.exports = DatabaseManager; 