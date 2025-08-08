const ClientService = require('./client-service');
const EmailService = require('./email-service');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class SyncService {
    constructor() {
        this.clientService = new ClientService();
        this.emailService = new EmailService();
        this.sheets = null;
        this.spreadsheetId = process.env.GOOGLE_SHEETS_ID || '13Fld-uJgwWuJVVxyEJoB9h7zAVbN2HlizV5udmT5XZU';
        this.range = 'Form Responses 1!A:AA';
        this.syncInterval = null;
        this.lastSyncTime = null;
        this.syncStatus = {
            isRunning: false,
            lastSync: null,
            errors: [],
            stats: {
                totalSyncs: 0,
                successfulSyncs: 0,
                failedSyncs: 0,
                totalImported: 0,
                totalUpdated: 0,
                totalErrors: 0
            }
        };
        this.initializeGoogleSheets();
        this.initializeEmailService();
    }

    async initializeGoogleSheets() {
        try {
            // Try to use service account first
            if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
                const auth = new google.auth.GoogleAuth({
                    credentials: serviceAccountKey,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets']
                });
                this.sheets = google.sheets({ version: 'v4', auth });
                console.log('✅ Google Sheets initialized with service account');
            } else {
                // Fallback to public access (read-only)
                console.log('⚠️ Using public access for Google Sheets (read-only)');
                this.sheets = null;
            }
        } catch (error) {
            console.error('❌ Error initializing Google Sheets:', error);
            this.sheets = null;
        }
    }

    async initializeEmailService() {
        try {
            // Try to configure email service with environment variables
            const emailConfig = {
                email: process.env.GMAIL_USER,
                password: process.env.GMAIL_APP_PASSWORD,
                service: 'gmail',
                emailFromName: process.env.EMAIL_FROM_NAME || 'IRIAS Ironworks'
            };

            if (emailConfig.email && emailConfig.password) {
                await this.emailService.configure(emailConfig);
                console.log('✅ Email service initialized for sync notifications');
            } else {
                console.log('⚠️ Email service not configured - sync notifications disabled');
            }
        } catch (error) {
            console.error('❌ Error initializing email service:', error);
        }
    }

    // Start automatic sync
    startAutoSync(intervalMinutes = 30) {
        if (this.syncInterval) {
            this.stopAutoSync();
        }

        console.log(`🔄 Starting automatic sync every ${intervalMinutes} minutes`);
        
        this.syncInterval = setInterval(async () => {
            await this.performAutoSync();
        }, intervalMinutes * 60 * 1000);

        // Perform initial sync
        this.performAutoSync();
    }

    // Stop automatic sync
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('⏹️ Automatic sync stopped');
        }
    }

    // Perform automatic sync with notifications
    async performAutoSync() {
        if (this.syncStatus.isRunning) {
            console.log('⚠️ Sync already running, skipping...');
            return;
        }

        this.syncStatus.isRunning = true;
        this.syncStatus.stats.totalSyncs++;

        try {
            console.log('🔄 Starting automatic sync...');
            
            const syncResult = await this.fullSync();
            
            if (syncResult.success) {
                this.syncStatus.stats.successfulSyncs++;
                this.syncStatus.lastSync = new Date().toISOString();
                
                // Send success notification
                await this.sendSyncNotification(syncResult, 'success');
                
                console.log('✅ Automatic sync completed successfully');
            } else {
                this.syncStatus.stats.failedSyncs++;
                throw new Error(syncResult.message || 'Sync failed');
            }
        } catch (error) {
            this.syncStatus.stats.failedSyncs++;
            this.syncStatus.errors.push({
                timestamp: new Date().toISOString(),
                error: error.message
            });

            // Keep only last 10 errors
            if (this.syncStatus.errors.length > 10) {
                this.syncStatus.errors = this.syncStatus.errors.slice(-10);
            }

            // Send error notification
            await this.sendSyncNotification({ error: error.message }, 'error');
            
            console.error('❌ Automatic sync failed:', error.message);
        } finally {
            this.syncStatus.isRunning = false;
        }
    }

    // Send sync notification email
    async sendSyncNotification(syncResult, type = 'success') {
        try {
            if (!this.emailService.isConfigured) {
                console.log('⚠️ Email service not configured, skipping notification');
                return;
            }

            const notificationEmails = [
                process.env.NOTIFICATION_EMAIL || 'newcustomers@iriasironworks.com'
            ].filter(email => email);

            if (notificationEmails.length === 0) {
                console.log('⚠️ No notification emails configured');
                return;
            }

            const emailContent = this.generateSyncNotificationEmail(syncResult, type);
            
            const emailConfig = {
                email: process.env.GMAIL_USER,
                password: process.env.GMAIL_APP_PASSWORD,
                service: 'gmail'
            };

            const mailOptions = {
                from: `"IRIAS Ironworks Sync" <${emailConfig.email}>`,
                to: notificationEmails.join(', '),
                subject: type === 'success' ? 
                    '✅ Sync Completed Successfully - IRIAS Ironworks' : 
                    '❌ Sync Failed - IRIAS Ironworks',
                html: emailContent.html,
                text: emailContent.text
            };

            await this.emailService.transporter.sendMail(mailOptions);
            console.log(`📧 Sync notification sent to: ${notificationEmails.join(', ')}`);
        } catch (error) {
            console.error('❌ Error sending sync notification:', error);
        }
    }

    // Generate sync notification email content
    generateSyncNotificationEmail(syncResult, type) {
        const isSuccess = type === 'success';
        const timestamp = new Date().toLocaleString();
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: ${isSuccess ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'}; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .section { margin-bottom: 20px; }
                    .section h3 { color: ${isSuccess ? '#059669' : '#dc2626'}; border-bottom: 2px solid ${isSuccess ? '#059669' : '#dc2626'}; padding-bottom: 5px; }
                    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
                    .stat-item { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
                    .stat-value { font-size: 2rem; font-weight: bold; color: ${isSuccess ? '#059669' : '#dc2626'}; }
                    .stat-label { color: #666; font-size: 0.9rem; }
                    .footer { background: #f8f9fa; padding: 15px; text-align: center; color: #666; font-size: 12px; }
                    .error-details { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${isSuccess ? '✅' : '❌'} SYNC ${isSuccess ? 'COMPLETED' : 'FAILED'}</h1>
                    <p>IRIAS IRONWORKS SERVICES LLC</p>
                </div>
                
                <div class="content">
                    <div class="section">
                        <h3>📊 SYNC STATISTICS</h3>
                        <div class="stats-grid">
                            ${isSuccess ? `
                                <div class="stat-item">
                                    <div class="stat-value">${syncResult.sheetsToDb?.imported || 0}</div>
                                    <div class="stat-label">Imported</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${syncResult.sheetsToDb?.updated || 0}</div>
                                    <div class="stat-label">Updated</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${syncResult.sheetsToDb?.errors || 0}</div>
                                    <div class="stat-label">Errors</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${syncResult.dbToSheets?.synced || 0}</div>
                                    <div class="stat-label">Synced to Sheets</div>
                                </div>
                            ` : `
                                <div class="stat-item">
                                    <div class="stat-value">❌</div>
                                    <div class="stat-label">Sync Failed</div>
                                </div>
                            `}
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>⏰ TIMESTAMP</h3>
                        <p><strong>Sync Time:</strong> ${timestamp}</p>
                        <p><strong>Duration:</strong> ${syncResult.duration || 'N/A'}</p>
                    </div>
                    
                    ${!isSuccess ? `
                        <div class="section">
                            <h3>❌ ERROR DETAILS</h3>
                            <div class="error-details">
                                <strong>Error:</strong> ${syncResult.error || 'Unknown error'}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="section">
                        <h3>📈 OVERALL STATISTICS</h3>
                        <p><strong>Total Syncs:</strong> ${this.syncStatus.stats.totalSyncs}</p>
                        <p><strong>Successful Syncs:</strong> ${this.syncStatus.stats.successfulSyncs}</p>
                        <p><strong>Failed Syncs:</strong> ${this.syncStatus.stats.failedSyncs}</p>
                        <p><strong>Success Rate:</strong> ${this.syncStatus.stats.totalSyncs > 0 ? Math.round((this.syncStatus.stats.successfulSyncs / this.syncStatus.stats.totalSyncs) * 100) : 0}%</p>
                    </div>
                </div>
                
                <div class="footer">
                    <p>This is an automated notification from IRIAS IRONWORKS SERVICES LLC.</p>
                    <p>© 2024 IRIAS Ironworks. All rights reserved.</p>
                </div>
            </body>
            </html>
        `;

        const text = `
${isSuccess ? '✅' : '❌'} SYNC ${isSuccess ? 'COMPLETED' : 'FAILED'}
IRIAS IRONWORKS SERVICES LLC

📊 SYNC STATISTICS
${isSuccess ? `
Imported: ${syncResult.sheetsToDb?.imported || 0}
Updated: ${syncResult.sheetsToDb?.updated || 0}
Errors: ${syncResult.sheetsToDb?.errors || 0}
Synced to Sheets: ${syncResult.dbToSheets?.synced || 0}
` : `
Sync Failed: ${syncResult.error || 'Unknown error'}
`}

⏰ TIMESTAMP
Sync Time: ${timestamp}
Duration: ${syncResult.duration || 'N/A'}

📈 OVERALL STATISTICS
Total Syncs: ${this.syncStatus.stats.totalSyncs}
Successful Syncs: ${this.syncStatus.stats.successfulSyncs}
Failed Syncs: ${this.syncStatus.stats.failedSyncs}
Success Rate: ${this.syncStatus.stats.totalSyncs > 0 ? Math.round((this.syncStatus.stats.successfulSyncs / this.syncStatus.stats.totalSyncs) * 100) : 0}%

This is an automated notification from IRIAS IRONWORKS SERVICES LLC.
© 2024 IRIAS Ironworks. All rights reserved.
        `;

        return { html, text };
    }

    // Get sync status for dashboard
    getSyncStatus() {
        return {
            ...this.syncStatus,
            isAutoSyncRunning: !!this.syncInterval,
            nextSyncTime: this.syncInterval ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null
        };
    }

    // Sync from Google Sheets to MySQL (one-time migration)
    async syncFromSheetsToDatabase() {
        const startTime = Date.now();
        
        try {
            console.log('🔄 Starting sync from Google Sheets to MySQL...');
            
            // Get data from Google Sheets
            const sheetsData = await this.getDataFromGoogleSheets();
            if (!sheetsData || sheetsData.length === 0) {
                console.log('ℹ️ No data found in Google Sheets');
                return { success: true, message: 'No data to sync', duration: Date.now() - startTime };
            }

            let imported = 0;
            let updated = 0;
            let errors = 0;

            for (const row of sheetsData) {
                try {
                    const clientData = this.parseSheetRow(row);
                    if (!clientData) continue;

                    // Check if client exists in database
                    const existingClient = await this.clientService.getClientById(clientData.client_id);
                    
                    if (existingClient) {
                        // Update existing client
                        await this.clientService.updateClient(clientData.client_id, clientData);
                        updated++;
                    } else {
                        // Create new client
                        await this.clientService.createClient(clientData);
                        imported++;
                        
                        // Send new lead notification
                        await this.sendNewLeadNotification(clientData);
                    }
                } catch (error) {
                    console.error(`❌ Error syncing client ${row.client_id}:`, error.message);
                    errors++;
                }
            }

            const duration = Date.now() - startTime;
            console.log(`✅ Sync completed: ${imported} imported, ${updated} updated, ${errors} errors (${duration}ms)`);
            
            return {
                success: true,
                imported,
                updated,
                errors,
                duration,
                message: `Sync completed: ${imported} imported, ${updated} updated, ${errors} errors`
            };
        } catch (error) {
            console.error('❌ Error syncing from sheets to database:', error);
            throw error;
        }
    }

    // Send new lead notification
    async sendNewLeadNotification(clientData) {
        try {
            if (!this.emailService.isConfigured) {
                console.log('⚠️ Email service not configured, skipping new lead notification');
                return;
            }

            const notificationEmails = [
                process.env.NOTIFICATION_EMAIL || 'newcustomers@iriasironworks.com'
            ].filter(email => email);

            if (notificationEmails.length === 0) {
                console.log('⚠️ No notification emails configured for new leads');
                return;
            }

            await this.emailService.sendNewLeadNotification(
                clientData,
                notificationEmails[0],
                notificationEmails.length > 1 ? notificationEmails[1] : null
            );

            console.log(`📧 New lead notification sent for: ${clientData.client_full_name}`);
        } catch (error) {
            console.error('❌ Error sending new lead notification:', error);
        }
    }

    // Sync from MySQL to Google Sheets (when new client is created)
    async syncToGoogleSheets(clientData) {
        try {
            if (!this.sheets) {
                console.log('⚠️ Google Sheets not available for writing, skipping sync');
                return { success: false, message: 'Google Sheets not available' };
            }

            console.log(`🔄 Syncing client ${clientData.client_id} to Google Sheets...`);

            // Prepare row data for Google Sheets
            const rowData = this.prepareRowForSheets(clientData);

            // Append to Google Sheets
            const response = await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: this.range,
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [rowData]
                }
            });

            console.log(`✅ Client ${clientData.client_id} synced to Google Sheets`);
            
            return {
                success: true,
                message: 'Client synced to Google Sheets',
                response: response.data
            };
        } catch (error) {
            console.error('❌ Error syncing to Google Sheets:', error);
            return { success: false, message: error.message };
        }
    }

    // Update client in Google Sheets
    async updateInGoogleSheets(clientId, updateData) {
        try {
            if (!this.sheets) {
                console.log('⚠️ Google Sheets not available for writing, skipping update');
                return { success: false, message: 'Google Sheets not available' };
            }

            console.log(`🔄 Updating client ${clientId} in Google Sheets...`);

            // Find the row in Google Sheets
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: this.range
            });

            const rows = response.data.values;
            const rowIndex = rows.findIndex(row => row[1] === clientId); // Client ID is in column B

            if (rowIndex === -1) {
                console.log(`⚠️ Client ${clientId} not found in Google Sheets`);
                return { success: false, message: 'Client not found in sheets' };
            }

            // Update the row
            const updatedRow = this.prepareRowForSheets(updateData);
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `Form Responses 1!A${rowIndex + 1}:AA${rowIndex + 1}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [updatedRow]
                }
            });

            console.log(`✅ Client ${clientId} updated in Google Sheets`);
            
            return { success: true, message: 'Client updated in Google Sheets' };
        } catch (error) {
            console.error('❌ Error updating in Google Sheets:', error);
            return { success: false, message: error.message };
        }
    }

    // Get data from Google Sheets (public access)
    async getDataFromGoogleSheets() {
        try {
            const csvUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:csv`;
            const response = await fetch(csvUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const csvText = await response.text();
            const rows = this.parseCSV(csvText);
            
            console.log(`📊 Retrieved ${rows.length} rows from Google Sheets`);
            return rows;
        } catch (error) {
            console.error('❌ Error getting data from Google Sheets:', error);
            throw error;
        }
    }

    // Parse CSV data
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            rows.push(row);
        }
        
        return rows;
    }

    // Parse sheet row to client data
    parseSheetRow(row) {
        try {
            // Map Google Sheets columns to database fields
            const clientData = {
                client_id: row['Client ID'] || this.generateClientId(),
                company_name: row['Company Name'] || 'IRIAS Ironworks',
                service_type: row['Service Type'] || row['Service Requested'] || '',
                urgency_level: row['Urgency Level'] || 'Medium',
                client_full_name: row['Client Full Name'] || row['E-mail'] || '',
                email: row['E-mail'] || '',
                phone_number: row['Customer Phone Number'] || '',
                customer_type: row['Customer Type'] || 'Residential',
                project_address: row['Project Address'] || row['Address'] || '',
                technical_description: row['Technical Description'] || '',
                budget_range: row['Budget Range'] || '',
                expected_timeline: row['Expected Timeline'] || '',
                preferred_contact_method: row['Preferred Contact Method'] || 'Phone',
                additional_notes: row['Additional Notes'] || '',
                special_requirements: row['Special Requirements'] || '',
                channel: row['Channel'] || 'Website',
                responsable: row['Responsable'] || '',
                status: row['Customer Status'] || 'New Lead',
                form_emailer_status: row['FormEmailer Status'] || 'Pending',
                invoice_status: row['Invoice Status'] || 'Pending',
                estimate_status: row['Estimate Status'] || 'Pending'
            };

            // Validate required fields
            if (!clientData.client_full_name || !clientData.email) {
                console.log(`⚠️ Skipping row with missing required fields: ${clientData.client_id}`);
                return null;
            }

            return clientData;
        } catch (error) {
            console.error('❌ Error parsing sheet row:', error);
            return null;
        }
    }

    // Prepare client data for Google Sheets
    prepareRowForSheets(clientData) {
        return [
            new Date().toISOString(), // Timestamp
            clientData.client_id,
            clientData.company_name,
            clientData.service_type,
            clientData.urgency_level,
            clientData.client_full_name,
            clientData.email,
            clientData.phone_number,
            clientData.customer_type,
            clientData.project_address,
            clientData.technical_description,
            clientData.budget_range,
            clientData.expected_timeline,
            clientData.preferred_contact_method,
            clientData.additional_notes,
            clientData.special_requirements,
            clientData.channel,
            clientData.responsable,
            clientData.status,
            clientData.form_emailer_status,
            clientData.invoice_status,
            clientData.estimate_status
        ];
    }

    // Generate client ID
    generateClientId() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substr(2, 3).toUpperCase();
        return `CLI${timestamp}${random}`;
    }

    // Full sync (MySQL ↔ Google Sheets)
    async fullSync() {
        const startTime = Date.now();
        
        try {
            console.log('🔄 Starting full sync between MySQL and Google Sheets...');
            
            // First, sync from sheets to database
            const sheetsToDb = await this.syncFromSheetsToDatabase();
            
            // Then, sync any new database records to sheets
            const dbToSheets = await this.syncNewRecordsToSheets();
            
            const duration = Date.now() - startTime;
            
            return {
                success: true,
                sheetsToDb,
                dbToSheets,
                duration,
                message: 'Full sync completed'
            };
        } catch (error) {
            console.error('❌ Error during full sync:', error);
            throw error;
        }
    }

    // Sync new database records to sheets
    async syncNewRecordsToSheets() {
        try {
            if (!this.sheets) {
                return { success: false, message: 'Google Sheets not available' };
            }

            // Get recent clients from database
            const recentClients = await this.clientService.getRecentClients(50);
            
            let synced = 0;
            let errors = 0;

            for (const client of recentClients) {
                try {
                    // Check if client exists in sheets
                    const existsInSheets = await this.clientExistsInSheets(client.client_id);
                    
                    if (!existsInSheets) {
                        await this.syncToGoogleSheets(client);
                        synced++;
                    }
                } catch (error) {
                    console.error(`❌ Error syncing client ${client.client_id}:`, error.message);
                    errors++;
                }
            }

            return {
                success: true,
                synced,
                errors,
                message: `Synced ${synced} new clients to sheets`
            };
        } catch (error) {
            console.error('❌ Error syncing new records to sheets:', error);
            return { success: false, message: error.message };
        }
    }

    // Check if client exists in Google Sheets
    async clientExistsInSheets(clientId) {
        try {
            if (!this.sheets) return false;

            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: this.range
            });

            const rows = response.data.values;
            return rows.some(row => row[1] === clientId); // Client ID is in column B
        } catch (error) {
            console.error('❌ Error checking client in sheets:', error);
            return false;
        }
    }

    // Get sync status
    async getSyncStatus() {
        try {
            const dbClients = await this.clientService.getAllClients(1, 1000);
            const sheetsData = await this.getDataFromGoogleSheets();
            
            return {
                database: {
                    total: dbClients.clients.length,
                    newLeads: dbClients.clients.filter(c => c.status === 'New Lead').length
                },
                googleSheets: {
                    total: sheetsData.length,
                    accessible: true
                },
                lastSync: new Date().toISOString(),
                autoSync: {
                    isRunning: !!this.syncInterval,
                    nextSync: this.syncInterval ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null
                }
            };
        } catch (error) {
            console.error('❌ Error getting sync status:', error);
            return {
                database: { total: 0, newLeads: 0 },
                googleSheets: { total: 0, accessible: false },
                lastSync: null,
                autoSync: {
                    isRunning: !!this.syncInterval,
                    nextSync: null
                },
                error: error.message
            };
        }
    }
}

module.exports = SyncService; 