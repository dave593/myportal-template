const https = require('https');
const http = require('http');

class ZohoWebhookService {
    constructor() {
        this.webhookUrl = null;
        this.webhookSecret = null;
        this.isConfigured = false;
    }

    /**
     * Initialize Zoho service with environment variables
     * @returns {Promise<Object>} - Initialization result
     */
    async initialize() {
        try {
            console.log('🔗 Initializing Zoho service...');
            
            const webhookUrl = process.env.ZOHO_WEBHOOK_URL;
            const webhookSecret = process.env.ZOHO_WEBHOOK_SECRET;
            
            if (webhookUrl) {
                this.configure({
                    webhookUrl: webhookUrl,
                    webhookSecret: webhookSecret || ''
                });
                return {
                    success: true,
                    message: 'Zoho service initialized successfully'
                };
            } else {
                console.log('⚠️ Zoho webhook URL not found in environment variables');
                return {
                    success: false,
                    message: 'Zoho webhook URL not configured'
                };
            }
        } catch (error) {
            console.error('❌ Error initializing Zoho service:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Configure Zoho Flow webhook
     * @param {Object} config - Webhook configuration
     * @param {string} config.webhookUrl - Zoho Flow webhook URL
     * @param {string} config.webhookSecret - Webhook secret for security
     */
    configure(config) {
        try {
            console.log('🔧 Configuring Zoho Webhook Service...');
            
            if (!config.webhookUrl) {
                throw new Error('Webhook URL is required');
            }

            // Clean webhook URL and secret from newlines and whitespace
            this.webhookUrl = config.webhookUrl.trim().replace(/\n/g, '');
            this.webhookSecret = config.webhookSecret ? config.webhookSecret.trim().replace(/\n/g, '') : '';
            
            this.isConfigured = true;
            
            console.log('✅ Zoho Webhook Service configured successfully');
            console.log(`🔗 Webhook URL: ${this.webhookUrl.substring(0, 50)}...`);
            console.log(`🔐 Webhook Secret: ${this.webhookSecret ? 'Configured' : 'Not configured'}`);
            
            return {
                success: true,
                message: 'Zoho Webhook Service configured successfully'
            };
        } catch (error) {
            console.error('❌ Error configuring Zoho Webhook Service:', error);
            this.isConfigured = false;
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Trigger Zoho Flow webhook with client data
     * @param {Object} clientData - Client information
     * @returns {Promise<Object>} - Result of webhook trigger
     */
    async triggerWebhook(clientData) {
        try {
            if (!this.isConfigured || !this.webhookUrl) {
                throw new Error('Zoho Flow webhook not configured');
            }

            console.log(`🔗 Triggering Zoho Flow webhook for: ${clientData.clientFullName}`);

            // Prepare data for Zoho Flow - map to expected Zoho fields
            const flowData = {
                // Map to Zoho CRM Contact fields
                "Email": clientData.email || '',
                "Organization": clientData.companyName || clientData.company || 'Individual',
                "Billing address - Phone": clientData.customerPhoneNumber || clientData.phone || '',
                "Billing address - Address": clientData.address || '',
                "Twitter": "",
                "Website": "",
                "Is portal enabled?": "true",
                "Last name": clientData.clientFullName ? clientData.clientFullName.split(' ').slice(-1).join(' ') : 'Client',
                "Salutation": "",
                "Remark": clientData.technicalDescription || clientData.description || 'New lead from website',
                "GST number": "",
                "Billing address - State": "",
                "VAT registration number": "",
                "Billing address - Street 2": "",
                "Shipping address - State code": "",
                "Phone": clientData.customerPhoneNumber || clientData.phone || '',
                "Shipping address - Address": clientData.address || '',
                "First name": clientData.clientFullName ? clientData.clientFullName.split(' ')[0] : 'New',
                "Facebook": "",
                "Shipping address - Attention": "",
                "GST treatment": "",
                "Is taxable?": "",
                "Customer display name": clientData.clientFullName || 'New Client',
                "Company name": clientData.companyName || clientData.company || 'Individual',
                "Billing address - Attention": "",
                "Shipping address - Street 2": "",
                "Shipping address - State": "",
                "Billing address - State code": "",
                "Shipping address - Fax": "",
                "Shipping address - City": "",
                "Shipping address - Phone": clientData.customerPhoneNumber || clientData.phone || '',
                "Payment terms": "",
                "Place of contact": "Website",
                "VAT treatment": "",
                "Shipping address - ZIP": "",
                "Billing address - ZIP": "",
                "Billing address - City": "",
                "Billing address - Fax": "",
                "Customer subtype": clientData.customerType || 'Residential',
                // Additional fields for tracking
                "Service Type": clientData.serviceType || '',
                "Price": clientData.price || '0',
                "Source": 'Web Form',
                "Registration Date": new Date().toISOString()
            };

            // Prepare headers
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'IRIAS-Ironworks-Webhook/1.0'
            };

            // Add webhook secret if provided
            if (this.webhookSecret) {
                headers['X-Webhook-Secret'] = this.webhookSecret;
            }

            console.log(`🔗 Sending data to Zoho Flow webhook: ${this.webhookUrl}`);
            console.log('Flow data:', flowData);

            // Make the webhook call using native https module
            const response = await this.makeHttpRequest(this.webhookUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(flowData),
                timeout: 10000 // 10 second timeout
            });

            if (response.success) {
                console.log(`✅ Zoho Flow webhook triggered successfully for: ${clientData.clientFullName}`);
                console.log('Response:', response.data);
                
                return {
                    success: true,
                    message: 'Zoho Flow webhook triggered successfully',
                    response: response.data,
                    statusCode: response.statusCode
                };
            } else {
                throw new Error(`Webhook failed: ${response.error}`);
            }
        } catch (error) {
            console.error('❌ Error triggering Zoho Flow webhook:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Test Zoho Flow webhook connection
     * @returns {Promise<Object>} - Result of webhook test
     */
    async testWebhook() {
        try {
            if (!this.isConfigured || !this.webhookUrl) {
                throw new Error('Zoho Flow webhook not configured');
            }

            console.log(`🔗 Testing Zoho Flow webhook: ${this.webhookUrl}`);

            // Prepare test data - use same format as real form submissions
            const testData = {
                // Map to Zoho CRM Contact fields (same format as triggerWebhook)
                "Email": 'test@example.com',
                "Organization": 'Test Organization',
                "Billing address - Phone": '555-1234',
                "Billing address - Address": '123 Test St',
                "Twitter": "",
                "Website": "",
                "Is portal enabled?": "true",
                "Last name": "Client",
                "Salutation": "",
                "Remark": "Test webhook from Irias Portal",
                "GST number": "",
                "Billing address - State": "",
                "VAT registration number": "",
                "Billing address - Street 2": "",
                "Shipping address - State code": "",
                "Phone": "555-1234",
                "Shipping address - Address": "123 Test St",
                "First name": "Test",
                "Facebook": "",
                "Shipping address - Attention": "",
                "GST treatment": "",
                "Is taxable?": "",
                "Customer display name": "Test Client",
                "Company name": "Test Organization",
                "Billing address - Attention": "",
                "Shipping address - Street 2": "",
                "Shipping address - State": "",
                "Billing address - State code": "",
                "Shipping address - Fax": "",
                "Shipping address - City": "",
                "Shipping address - Phone": "555-1234",
                "Payment terms": "",
                "Place of contact": "Website",
                "VAT treatment": "",
                "Shipping address - ZIP": "",
                "Billing address - ZIP": "",
                "Billing address - City": "",
                "Billing address - Fax": "",
                "Customer subtype": "Residential",
                // Additional fields for tracking
                "Service Type": "Test Service",
                "Price": "0",
                "Source": "Test Webhook",
                "Registration Date": new Date().toISOString(),
                // Test flag
                "test": true
            };

            // Prepare headers
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'IRIAS-Ironworks-Webhook/1.0'
            };

            // Add webhook secret if provided
            if (this.webhookSecret) {
                headers['X-Webhook-Secret'] = this.webhookSecret;
            }

            // Make the test webhook call using native https module
            const response = await this.makeHttpRequest(this.webhookUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(testData),
                timeout: 10000 // 10 second timeout
            });

            if (response.success) {
                console.log(`✅ Zoho Flow webhook test successful`);
                console.log('Response:', response.data);
                
                return {
                    success: true,
                    message: 'Zoho Flow webhook test successful',
                    response: response.data,
                    statusCode: response.statusCode,
                    testedUrl: this.webhookUrl
                };
            } else {
                throw new Error(`Webhook test failed: ${response.error}`);
            }
        } catch (error) {
            console.error('❌ Error testing Zoho Flow webhook:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verify webhook configuration
     * @returns {Promise<Object>} - Verification result
     */
    async verifyConfiguration() {
        try {
            if (!this.isConfigured || !this.webhookUrl) {
                return {
                    success: false,
                    error: 'Zoho Flow webhook not configured'
                };
            }

            // Test the webhook URL format
            try {
                new URL(this.webhookUrl);
            } catch (e) {
                return {
                    success: false,
                    error: 'Invalid webhook URL format'
                };
            }

            return {
                success: true,
                message: 'Zoho Flow webhook configuration verified successfully',
                webhookUrl: this.webhookUrl
            };
        } catch (error) {
            console.error('❌ Zoho Flow webhook configuration verification failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Make HTTP request using native Node.js modules
     * @param {string} url - URL to make request to
     * @param {Object} options - Request options
     * @returns {Promise<Object>} - Response object
     */
    makeHttpRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const urlObj = new URL(url);
                const isHttps = urlObj.protocol === 'https:';
                const client = isHttps ? https : http;
                
                const requestOptions = {
                    hostname: urlObj.hostname,
                    port: urlObj.port || (isHttps ? 443 : 80),
                    path: urlObj.pathname + urlObj.search,
                    method: options.method || 'GET',
                    headers: options.headers || {},
                    timeout: options.timeout || 10000
                };

                const req = client.request(requestOptions, (res) => {
                    let data = '';
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    res.on('end', () => {
                        let responseData;
                        try {
                            responseData = JSON.parse(data);
                        } catch (e) {
                            responseData = { raw: data };
                        }
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve({
                                success: true,
                                statusCode: res.statusCode,
                                data: responseData,
                                headers: res.headers
                            });
                        } else {
                            resolve({
                                success: false,
                                statusCode: res.statusCode,
                                error: `HTTP ${res.statusCode}: ${data}`,
                                data: responseData
                            });
                        }
                    });
                });

                req.on('error', (error) => {
                    resolve({
                        success: false,
                        error: error.message
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        error: 'Request timeout'
                    });
                });

                if (options.body) {
                    req.write(options.body);
                }
                
                req.end();
            } catch (error) {
                resolve({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    /**
     * Get webhook status
     * @returns {Object} - Webhook status
     */
    getStatus() {
        return {
            configured: this.isConfigured,
            webhookUrl: this.webhookUrl ? 'Configured' : 'Not configured',
            hasSecret: !!this.webhookSecret
        };
    }
}

module.exports = ZohoWebhookService; 