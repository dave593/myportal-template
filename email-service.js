const nodemailer = require('nodemailer');
const ConfigDatabase = require('./config-database');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        this.configDB = new ConfigDatabase();
    }

    /**
     * Configure email service with Gmail credentials
     * @param {Object} config - Email configuration
     * @param {string} config.email - Gmail address
     * @param {string} config.password - Gmail app password
     * @param {string} config.service - Email service (gmail, sendgrid, etc.)
     * @param {string} config.apiKey - API key for external services
     */
    async configure(config) {
        try {
            console.log('📧 Configuring email service...');
            
            // Use provided config, then database, then environment variables
            const email = config.email || this.configDB.getNotificationsConfig().email || process.env.GMAIL_USER;
            const password = config.password || this.configDB.getNotificationsConfig().password || process.env.GMAIL_APP_PASSWORD;
            const service = config.service || this.configDB.getNotificationsConfig().service || 'gmail';
            const emailFromName = config.emailFromName || this.configDB.getNotificationsConfig().emailFromName || 'IRIAS Ironworks';
            
            if (!email || !password) {
                throw new Error('Email and password are required for email service configuration');
            }
            
            // Save configuration to database
            this.configDB.updateNotificationsConfig({
                email: email,
                password: password,
                emailFromName: emailFromName,
                service: service
            });
            
            if (service === 'gmail') {
                // Gmail configuration
                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: email,
                        pass: password // Use App Password for Gmail
                    },
                    secure: true,
                    port: 465
                });
            } else if (service === 'sendgrid') {
                // SendGrid configuration
                this.transporter = nodemailer.createTransport({
                    host: 'smtp.sendgrid.net',
                    port: 587,
                    secure: false,
                    auth: {
                        user: 'apikey',
                        pass: config.apiKey || password
                    }
                });
            } else if (service === 'mailgun') {
                // Mailgun configuration
                this.transporter = nodemailer.createTransport({
                    host: 'smtp.mailgun.org',
                    port: 587,
                    secure: false,
                    auth: {
                        user: email,
                        pass: config.apiKey || password
                    }
                });
            } else {
                // Default to Gmail
                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: email,
                        pass: password
                    },
                    secure: true,
                    port: 465
                });
            }

            // Verify the transporter is working
            await this.transporter.verify();
            
            this.isConfigured = true;
            console.log('✅ Email service configured successfully');
            console.log(`📧 Using email: ${email}`);
            console.log(`📧 From: ${emailFromName} <${email}>`);
            
            return {
                success: true,
                message: 'Email service configured successfully'
            };
        } catch (error) {
            console.error('❌ Error configuring email service:', error);
            this.isConfigured = false;
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send new lead notification email
     * @param {Object} clientData - Client information
     * @param {string} notificationEmail - Email to send notification to
     * @param {string} ccEmail - CC email address (optional)
     * @returns {Promise<Object>} - Result of email sending
     */
    async sendNewLeadNotification(clientData, notificationEmail, ccEmail = null) {
        try {
            if (!this.isConfigured || !this.transporter) {
                throw new Error('Email service not configured');
            }

            console.log(`📧 Sending new lead notification to: ${notificationEmail}${ccEmail ? ` (CC: ${ccEmail})` : ''}`);

            const emailContent = this.generateNewLeadEmailContent(clientData);
            
            const emailConfig = this.configDB.getNotificationsConfig();
            const mailOptions = {
                from: emailConfig.email || process.env.EMAIL_FROM || 'noreply@iriasironworks.com',
                to: notificationEmail,
                cc: ccEmail,
                subject: `🔥 NEW CUSTOMER LEAD - ${clientData.clientFullName}`,
                html: emailContent.html,
                text: emailContent.text
            };

            console.log('📧 Mail options for new lead:', {
                from: mailOptions.from,
                to: mailOptions.to,
                cc: mailOptions.cc,
                subject: mailOptions.subject
            });

            const result = await this.transporter.sendMail(mailOptions);
            
            console.log(`✅ New lead notification sent successfully to: ${notificationEmail}${ccEmail ? ` and CC: ${ccEmail}` : ''}`);
            console.log('Message ID:', result.messageId);
            
            return {
                success: true,
                message: 'New lead notification sent successfully',
                messageId: result.messageId,
                sentTo: notificationEmail,
                ccTo: ccEmail
            };
        } catch (error) {
            console.error('❌ Error sending new lead notification:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send test email
     * @param {string} toEmail - Email to send test to
     * @returns {Promise<Object>} - Result of test email
     */
    async sendTestEmail(toEmail) {
        try {
            console.log(`📧 Sending test email to: ${toEmail}`);
            
            // Check if email service is configured
            if (!this.isConfigured || !this.transporter) {
                console.log('📧 Email service not configured, attempting to configure with environment variables...');
                
                // Try to configure with environment variables
                const envConfig = {
                    email: process.env.GMAIL_USER,
                    password: process.env.GMAIL_APP_PASSWORD,
                    service: 'gmail'
                };
                
                if (!envConfig.email || !envConfig.password) {
                    throw new Error('Email service not configured and environment variables not available');
                }
                
                const configResult = await this.configure(envConfig);
                if (!configResult.success) {
                    throw new Error(`Failed to configure email service: ${configResult.error}`);
                }
            }

            // Use database configuration for from address
            const emailConfig = this.configDB.getNotificationsConfig();
            const fromEmail = emailConfig.email || process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@iriasironworks.com';
            const fromName = emailConfig.emailFromName || process.env.EMAIL_FROM_NAME || 'IRIAS Ironworks';

            const mailOptions = {
                from: `"${fromName}" <${fromEmail}>`,
                to: toEmail,
                subject: '🧪 Email Service Test - IRIAS Ironworks',
                html: this.generateTestEmailContent(),
                text: 'This is a test email from IRIAS Ironworks email service.'
            };

            console.log('📧 Mail options:', {
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject
            });

            const result = await this.transporter.sendMail(mailOptions);
            
            console.log(`✅ Test email sent successfully to: ${toEmail}`);
            console.log('Message ID:', result.messageId);
            
            return {
                success: true,
                message: 'Test email sent successfully',
                messageId: result.messageId,
                sentTo: toEmail
            };
        } catch (error) {
            console.error('❌ Error sending test email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate HTML content for new lead notification
     * @param {Object} clientData - Client information
     * @returns {Object} - HTML and text content
     */
    generateNewLeadEmailContent(clientData) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .section { margin-bottom: 20px; }
                    .section h3 { color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 5px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                    .info-item { background: #f8f9fa; padding: 10px; border-radius: 5px; }
                    .label { font-weight: bold; color: #666; }
                    .value { color: #333; }
                    .footer { background: #f8f9fa; padding: 15px; text-align: center; color: #666; font-size: 12px; }
                    .highlight { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔥 NEW CUSTOMER LEAD 🔥</h1>
                    <p>IRIAS IRONWORKS SERVICES LLC</p>
                </div>
                
                <div class="content">
                    <div class="highlight">
                        <strong>Form Date:</strong> ${new Date().toLocaleString()}
                    </div>
                    
                    <div class="section">
                        <h3>👤 CUSTOMER INFORMATION</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="label">Customer Type:</div>
                                <div class="value">${clientData.customerType || 'N/A'}</div>
                            </div>
                            <div class="info-item">
                                <div class="label">Customer Status:</div>
                                <div class="value">${clientData.customerStatus || 'New Lead'}</div>
                            </div>
                            <div class="info-item">
                                <div class="label">Client Full Name:</div>
                                <div class="value">${clientData.clientFullName}</div>
                            </div>
                            <div class="info-item">
                                <div class="label">Email:</div>
                                <div class="value">${clientData.email}</div>
                            </div>
                            <div class="info-item">
                                <div class="label">Phone Number:</div>
                                <div class="value">${clientData.customerPhoneNumber || clientData.phone || 'N/A'}</div>
                            </div>
                            <div class="info-item">
                                <div class="label">Address:</div>
                                <div class="value">${clientData.address || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>🛠️ SERVICE INFORMATION</h3>
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="label">Service Type:</div>
                                <div class="value">${clientData.serviceType || 'N/A'}</div>
                            </div>
                            <div class="info-item">
                                <div class="label">Price:</div>
                                <div class="value">$${clientData.price || '0'}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="footer">
                    <p>This is an automated notification from IRIAS IRONWORKS SERVICES LLC.</p>
                    <p>A new customer lead has been registered in the system.</p>
                    <p>© 2024 IRIAS Ironworks. All rights reserved.</p>
                </div>
            </body>
            </html>
        `;

        const text = `
🔥 NEW CUSTOMER LEAD 🔥
IRIAS IRONWORKS SERVICES LLC

Form Date: ${new Date().toLocaleString()}

👤 CUSTOMER INFORMATION
Customer Type: ${clientData.customerType || 'N/A'}
Customer Status: ${clientData.customerStatus || 'New Lead'}
Client Full Name: ${clientData.clientFullName}
Email: ${clientData.email}
Phone Number: ${clientData.customerPhoneNumber || clientData.phone || 'N/A'}
Address: ${clientData.address || 'N/A'}

🛠️ SERVICE INFORMATION
Service Type: ${clientData.serviceType || 'N/A'}
Price: $${clientData.price || '0'}

This is an automated notification from IRIAS IRONWORKS SERVICES LLC.
A new customer lead has been registered in the system.

© 2024 IRIAS Ironworks. All rights reserved.
        `;

        return { html, text };
    }

    /**
     * Generate test email content
     * @returns {string} - HTML content for test email
     */
    generateTestEmailContent() {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .footer { background: #f8f9fa; padding: 15px; text-align: center; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🧪 Email Service Test</h1>
                    <p>IRIAS IRONWORKS SERVICES LLC</p>
                </div>
                
                <div class="content">
                    <h2>✅ Email Service is Working!</h2>
                    <p>This is a test email to confirm that your email service is properly configured and working.</p>
                    <p><strong>Test Date:</strong> ${new Date().toLocaleString()}</p>
                    <p>If you received this email, your email notifications for new customer leads will work correctly.</p>
                </div>
                
                <div class="footer">
                    <p>© 2024 IRIAS Ironworks. All rights reserved.</p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Initialize email service with environment variables
     * @returns {Promise<Object>} - Initialization result
     */
    async initialize() {
        try {
            console.log('📧 Initializing email service...');
            
            const email = process.env.EMAIL_GMAIL_USER;
            const password = process.env.EMAIL_GMAIL_APP_PASSWORD;
            
            if (email && password) {
                await this.configure({
                    email: email,
                    password: password,
                    service: 'gmail',
                    emailFromName: 'IRIAS Ironworks'
                });
                return {
                    success: true,
                    message: 'Email service initialized successfully'
                };
            } else {
                console.log('⚠️ Email credentials not found in environment variables');
                return {
                    success: false,
                    message: 'Email credentials not configured'
                };
            }
        } catch (error) {
            console.error('❌ Error initializing email service:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verify email configuration
     * @returns {Promise<Object>} - Verification result
     */
    async verifyConfiguration() {
        try {
            if (!this.isConfigured || !this.transporter) {
                return {
                    success: false,
                    error: 'Email service not configured'
                };
            }

            // Verify the connection
            await this.transporter.verify();
            
            return {
                success: true,
                message: 'Email service configuration verified successfully'
            };
        } catch (error) {
            console.error('❌ Email configuration verification failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = EmailService; 