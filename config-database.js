const fs = require('fs');
const path = require('path');

class ConfigDatabase {
    constructor() {
        this.configFile = path.join(__dirname, 'persistent-config.json');
        this.config = this.loadConfig();
    }

    /**
     * Load configuration from file and environment variables
     */
    loadConfig() {
        // First, try to load from environment variables (Cloud Run)
        const envConfig = this.loadFromEnvironment();
        
        try {
            if (fs.existsSync(this.configFile)) {
                const data = fs.readFileSync(this.configFile, 'utf8');
                const fileConfig = JSON.parse(data);
                
                // Merge environment config with file config (env takes precedence)
                return this.mergeConfigs(fileConfig, envConfig);
            }
        } catch (error) {
            console.error('❌ Error loading config database:', error);
        }
        
        // Return environment config or default
        return envConfig;
    }

    /**
     * Load configuration from environment variables
     */
    loadFromEnvironment() {
        return {
            notifications: {
                email: process.env.NOTIFICATIONS_EMAIL || process.env.GMAIL_USER || '',
                password: process.env.NOTIFICATIONS_PASSWORD || process.env.GMAIL_APP_PASSWORD || '',
                emailFromName: process.env.NOTIFICATIONS_EMAIL_FROM_NAME || process.env.EMAIL_FROM_NAME || 'IRIAS Ironworks',
                service: process.env.NOTIFICATIONS_SERVICE || 'gmail'
            },
            zoho: {
                webhookUrl: process.env.ZOHO_WEBHOOK_URL || process.env.ZOHO_FLOW_WEBHOOK_URL || '',
                webhookSecret: process.env.ZOHO_WEBHOOK_SECRET || process.env.ZOHO_FLOW_WEBHOOK_SECRET || ''
            },
            system: {
                lastUpdated: new Date().toISOString(),
                version: '1.0.0'
            }
        };
    }

    /**
     * Merge configurations (env takes precedence over file)
     */
    mergeConfigs(fileConfig, envConfig) {
        return {
            notifications: {
                ...fileConfig.notifications,
                ...envConfig.notifications
            },
            zoho: {
                ...fileConfig.zoho,
                ...envConfig.zoho
            },
            system: {
                ...fileConfig.system,
                ...envConfig.system
            }
        };
    }

    /**
     * Save configuration to file
     */
    saveConfig() {
        try {
            this.config.system.lastUpdated = new Date().toISOString();
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
            console.log('✅ Configuration saved to database');
            return true;
        } catch (error) {
            console.error('❌ Error saving config database:', error);
            return false;
        }
    }

    /**
     * Get notifications configuration
     */
    getNotificationsConfig() {
        return this.config.notifications;
    }

    /**
     * Update notifications configuration
     */
    updateNotificationsConfig(notificationsConfig) {
        this.config.notifications = { ...this.config.notifications, ...notificationsConfig };
        return this.saveConfig();
    }

    /**
     * Get Zoho configuration
     */
    getZohoConfig() {
        return this.config.zoho;
    }

    /**
     * Update Zoho configuration
     */
    updateZohoConfig(zohoConfig) {
        this.config.zoho = { ...this.config.zoho, ...zohoConfig };
        return this.saveConfig();
    }

    /**
     * Get all configuration
     */
    getAllConfig() {
        return this.config;
    }

    /**
     * Update entire configuration
     */
    updateAllConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        return this.saveConfig();
    }

    /**
     * Reset configuration to defaults
     */
    resetConfig() {
        this.config = {
            notifications: {
                email: '',
                password: '',
                emailFromName: 'IRIAS Ironworks',
                service: 'gmail'
            },
            zoho: {
                webhookUrl: '',
                webhookSecret: ''
            },
            system: {
                lastUpdated: new Date().toISOString(),
                version: '1.0.0'
            }
        };
        return this.saveConfig();
    }

    /**
     * Check if notifications are configured
     */
    isNotificationsConfigured() {
        return !!(this.config.notifications.email && this.config.notifications.password);
    }

    /**
     * Check if Zoho is configured
     */
    isZohoConfigured() {
        return !!this.config.zoho.webhookUrl;
    }
}

module.exports = ConfigDatabase; 