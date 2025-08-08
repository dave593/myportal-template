const database = require('./database');
const SyncService = require('./sync-service');
const { v4: uuidv4 } = require('uuid');

class ClientService {
    constructor() {
        this.db = database;
        this.syncService = new SyncService();
    }

    // Generate unique client ID
    generateClientId() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substr(2, 3).toUpperCase();
        return `CLI${timestamp}${random}`;
    }

    // Create new client
    async createClient(clientData) {
        try {
            // Generate client ID if not provided
            if (!clientData.client_id) {
                clientData.client_id = this.generateClientId();
            }

            // Set default values
            const client = {
                client_id: clientData.client_id,
                company_name: clientData.company_name || 'IRIAS Ironworks',
                service_type: clientData.service_type,
                urgency_level: clientData.urgency_level || 'Medium',
                client_full_name: clientData.client_full_name,
                email: clientData.email,
                phone_number: clientData.phone_number,
                customer_type: clientData.customer_type || 'Residential',
                project_address: clientData.project_address,
                technical_description: clientData.technical_description,
                budget_range: clientData.budget_range,
                expected_timeline: clientData.expected_timeline,
                preferred_contact_method: clientData.preferred_contact_method || 'Phone',
                additional_notes: clientData.additional_notes,
                special_requirements: clientData.special_requirements,
                channel: clientData.channel || 'Website',
                responsable: clientData.responsable,
                status: 'New Lead'
            };

            // Insert into database
            const result = await this.db.createClient(client);
            
            // Sync to Google Sheets
            try {
                await this.syncService.syncToGoogleSheets(client);
            } catch (syncError) {
                console.warn(`⚠️ Failed to sync to Google Sheets: ${syncError.message}`);
            }
            
            console.log(`✅ Client created successfully: ${client.client_id}`);
            
            return {
                success: true,
                client_id: client.client_id,
                message: 'Client created successfully',
                data: client
            };
        } catch (error) {
            console.error('❌ Error creating client:', error);
            throw error;
        }
    }

    // Get client by ID
    async getClientById(clientId) {
        try {
            const client = await this.db.getClientById(clientId);
            if (!client) {
                throw new Error('Client not found');
            }
            return client;
        } catch (error) {
            console.error('❌ Error getting client:', error);
            throw error;
        }
    }

    // Get all clients with pagination
    async getAllClients(page = 1, limit = 20) {
        try {
            const offset = (page - 1) * limit;
            const clients = await this.db.getAllClients(limit, offset);
            
            // Get total count for pagination
            const countResult = await this.db.query('SELECT COUNT(*) as total FROM clients');
            const total = countResult[0].total;
            
            return {
                clients,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('❌ Error getting clients:', error);
            throw error;
        }
    }

    // Get clients by status
    async getClientsByStatus(status, limit = 50) {
        try {
            const clients = await this.db.getClientsByStatus(status, limit);
            return clients;
        } catch (error) {
            console.error('❌ Error getting clients by status:', error);
            throw error;
        }
    }

    // Update client status
    async updateClientStatus(clientId, newStatus, userEmail = null, ipAddress = null) {
        try {
            // Get current client data for audit
            const currentClient = await this.db.getClientById(clientId);
            if (!currentClient) {
                throw new Error('Client not found');
            }

            // Update status
            await this.db.updateClientStatus(clientId, newStatus);

            // Log audit
            await this.db.logAudit(
                'UPDATE_STATUS',
                'clients',
                currentClient.id,
                { status: currentClient.status },
                { status: newStatus },
                userEmail,
                ipAddress,
                null
            );

            console.log(`✅ Client status updated: ${clientId} -> ${newStatus}`);
            
            return {
                success: true,
                message: 'Client status updated successfully',
                client_id: clientId,
                new_status: newStatus
            };
        } catch (error) {
            console.error('❌ Error updating client status:', error);
            throw error;
        }
    }

    // Update client data
    async updateClient(clientId, updateData, userEmail = null, ipAddress = null) {
        try {
            // Get current client data for audit
            const currentClient = await this.db.getClientById(clientId);
            if (!currentClient) {
                throw new Error('Client not found');
            }

            // Update client
            await this.db.updateClient(clientId, updateData);

            // Sync to Google Sheets
            try {
                await this.syncService.updateInGoogleSheets(clientId, { ...currentClient, ...updateData });
            } catch (syncError) {
                console.warn(`⚠️ Failed to sync update to Google Sheets: ${syncError.message}`);
            }

            // Log audit
            await this.db.logAudit(
                'UPDATE_CLIENT',
                'clients',
                currentClient.id,
                currentClient,
                { ...currentClient, ...updateData },
                userEmail,
                ipAddress,
                null
            );

            console.log(`✅ Client updated: ${clientId}`);
            
            return {
                success: true,
                message: 'Client updated successfully',
                client_id: clientId
            };
        } catch (error) {
            console.error('❌ Error updating client:', error);
            throw error;
        }
    }

    // Delete client
    async deleteClient(clientId, userEmail = null, ipAddress = null) {
        try {
            // Get current client data for audit
            const currentClient = await this.db.getClientById(clientId);
            if (!currentClient) {
                throw new Error('Client not found');
            }

            // Delete client
            await this.db.deleteClient(clientId);

            // Log audit
            await this.db.logAudit(
                'DELETE_CLIENT',
                'clients',
                currentClient.id,
                currentClient,
                null,
                userEmail,
                ipAddress,
                null
            );

            console.log(`✅ Client deleted: ${clientId}`);
            
            return {
                success: true,
                message: 'Client deleted successfully',
                client_id: clientId
            };
        } catch (error) {
            console.error('❌ Error deleting client:', error);
            throw error;
        }
    }

    // Search clients
    async searchClients(searchTerm) {
        try {
            const clients = await this.db.searchClients(searchTerm);
            return clients;
        } catch (error) {
            console.error('❌ Error searching clients:', error);
            throw error;
        }
    }

    // Get recent clients
    async getRecentClients(limit = 10) {
        try {
            const clients = await this.db.getRecentClients(limit);
            return clients;
        } catch (error) {
            console.error('❌ Error getting recent clients:', error);
            throw error;
        }
    }

    // Get new leads
    async getNewLeads() {
        try {
            const clients = await this.db.getNewLeads();
            return clients;
        } catch (error) {
            console.error('❌ Error getting new leads:', error);
            throw error;
        }
    }

    // Get client statistics
    async getClientStats() {
        try {
            const stats = await this.db.getClientStats();
            return stats;
        } catch (error) {
            console.error('❌ Error getting client stats:', error);
            throw error;
        }
    }

    // Get monthly statistics
    async getMonthlyStats() {
        try {
            const stats = await this.db.getMonthlyStats();
            return stats;
        } catch (error) {
            console.error('❌ Error getting monthly stats:', error);
            throw error;
        }
    }

    // Import clients from Google Sheets (migration function)
    async importFromGoogleSheets(clientsData) {
        try {
            let imported = 0;
            let errors = 0;

            for (const clientData of clientsData) {
                try {
                    // Check if client already exists
                    const existingClient = await this.db.getClientById(clientData.client_id);
                    if (existingClient) {
                        console.log(`ℹ️ Client already exists: ${clientData.client_id}`);
                        continue;
                    }

                    // Create client
                    await this.createClient(clientData);
                    imported++;
                } catch (error) {
                    console.error(`❌ Error importing client ${clientData.client_id}:`, error.message);
                    errors++;
                }
            }

            console.log(`✅ Import completed: ${imported} imported, ${errors} errors`);
            
            return {
                success: true,
                imported,
                errors,
                message: `Import completed: ${imported} imported, ${errors} errors`
            };
        } catch (error) {
            console.error('❌ Error importing from Google Sheets:', error);
            throw error;
        }
    }

    // Export clients to JSON (for backup)
    async exportClients() {
        try {
            const clients = await this.db.getAllClients(10000, 0); // Get all clients
            return clients;
        } catch (error) {
            console.error('❌ Error exporting clients:', error);
            throw error;
        }
    }

    // Health check
    async healthCheck() {
        try {
            const health = await this.db.healthCheck();
            return health;
        } catch (error) {
            console.error('❌ Database health check failed:', error);
            return { status: 'unhealthy', message: error.message };
        }
    }
}

module.exports = ClientService; 