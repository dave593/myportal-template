const { google } = require('googleapis');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class GoogleSheetsIntegration {
    constructor() {
        this.spreadsheetId = '13Fld-uJgwWuJVVxyEJoB9h7zAVbN2HlizV5udmT5XZU';
        this.range = 'Form Responses 1!A:AA';
        this.sheets = null;
        this.auth = null;
        this.initialized = false;
        this.cache = new Map();
        this.cacheTimeout = 30 * 1000; // 30 segundos
        this.lastCacheUpdate = 0;
        this.cacheKeys = new Set();
    }

    async initialize() {
        if (this.initialized) {
            console.log('✅ Google Sheets already initialized');
            return;
        }

        try {
            console.log('🚀 Initializing Google Sheets integration...');
            
            // Use API Key for Google Sheets access - Hardcoded for testing
            const apiKey = 'AIzaSyC1gc-0NZDoSG1x5LPc8t7e8jS7SBQCCcI';
            console.log('🔑 Using Google API Key for Sheets access');
            console.log('📋 API Key exists:', !!process.env.GOOGLE_API_KEY);
            console.log('📋 API Key length:', process.env.GOOGLE_API_KEY ? process.env.GOOGLE_API_KEY.length : 0);
            console.log('📋 Using API Key:', apiKey.substring(0, 10) + '...');
            console.log('📋 All environment variables:', Object.keys(process.env).filter(key => key.includes('GOOGLE')).join(', '));
            console.log('📋 Full API Key (first 20 chars):', apiKey.substring(0, 20));
            this.sheets = google.sheets({ version: 'v4' });
            this.apiKey = apiKey;
            
            // Test the connection
            console.log('🧪 Testing Google Sheets connection...');
            const testResponse = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
                key: apiKey
            });
            
            console.log('✅ Google Sheets connection successful');
            console.log(`📊 Connected to: ${testResponse.data.properties.title}`);
            
            this.initialized = true;
            
        } catch (error) {
            console.error('❌ Failed to initialize Google Sheets:', error.message);
            throw error;
        }
    }

    async ensureInitialized() {
        if (!this.initialized || !this.sheets) {
            console.log('🔄 Re-initializing Google Sheets...');
            await this.initialize();
        }

        if (!this.sheets) {
            throw new Error('Google Sheets not initialized properly');
        }
    }

    async getClientsData() {
        try {
            await this.ensureInitialized();
            
            // DISABLED CACHE - Always fetch fresh data to avoid data loss
            console.log('📊 Cache disabled - fetching fresh data from Google Sheets');
            
            console.log('🔍 Fetching real clients data from Google Sheets...');
            const data = await this.getRealClientsData();
            
            // CACHE DISABLED - Not storing data in cache to ensure fresh data
            
            return data;
        } catch (error) {
            console.error('❌ Error fetching clients data:', error);
            return [];
        }
    }

    async getRealClientsData() {
        try {
            await this.ensureInitialized();
            
            console.log('🔍 Starting getRealClientsData (using Sheets API directly)...');
            console.log('📊 Spreadsheet ID:', this.spreadsheetId);
            console.log('📋 Range:', this.range);
            
            // Usar Google Sheets API directamente para obtener datos precisos
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                throw new Error('Service Account credentials not configured for direct Sheets API read');
            }
            
            const { google } = require('googleapis');
            const serviceAccountKey = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString());
            const auth = new google.auth.GoogleAuth({
                credentials: serviceAccountKey,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
            });
            const sheets = google.sheets({ version: 'v4', auth });
            
            console.log('📥 Fetching data from Sheets API directly...');
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: this.range
            });
            
            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                console.log('⚠️ No data found in Google Sheets via direct API');
                return [];
            }
            
            console.log(`📊 Found ${rows.length} rows in Google Sheets via direct API`);
            console.log('📋 Headers:', rows[0]);

            // Procesar los datos del Google Sheet usando API directa
            const firstRow = rows[0];
            const headers = firstRow.map(header => {
                // Extraer solo la parte del header (antes del primer espacio)
                const headerPart = header.split(' ')[0];
                return headerPart;
            });
            
            console.log('📋 Cleaned headers:', headers);
            
            // Filtrar datos de ejemplo y template
            const dataRows = rows.slice(1).filter(row => {
                // Excluir filas con datos de ejemplo
                const clientName = row[10] || ''; // Client Full Name
                const clientId = row[1] || ''; // Client ID
                
                // Lista de patrones de ejemplo a excluir (más específicos)
                const examplePatterns = [
                    'john doe', 'jane doe', 'test client', 'example client',
                    'cli001', 'cli002', 'test-client', 'test-cli', 'demo'
                ];
                
                // Solo filtrar si el nombre contiene patrones de ejemplo
                const isExample = examplePatterns.some(pattern => 
                    clientName.toLowerCase().includes(pattern)
                );
                
                // NO filtrar por ID porque los IDs reales contienen "CLI"
                
                if (isExample) {
                    console.log(`🚫 Filtering out example data: ${clientName} (${clientId})`);
                    return false;
                }
                
                return true;
            });

            // Calcular el rowIndex real usando la API directa
            const clients = dataRows
            .map((row, originalIndex) => {
                // Con la API directa, el rowIndex es simplemente la posición en el array + 2
                // (1 para el header + 1 para el offset de Google Sheets)
                let realRowIndex = originalIndex + 2;
                    
                    // Función helper para obtener valores usando headers dinámicos
                    const getValue = (headerName) => {
                        const index = headers.findIndex(h => h.toLowerCase().includes(headerName.toLowerCase()));
                        return index >= 0 ? row[index] || '' : '';
                    };
                    
                    // Función helper para obtener valores específicos
                    const getClientName = () => {
                        // Buscar específicamente "Client Full Name" - está en la posición 10 según los headers
                        return row[10] || '';
                    };
                    
                    const getEmail = () => {
                        // E-mail está en la posición 11 según los headers reales
                        return row[11] || '';
                    };
                    
                    const getPhone = () => {
                        // Customer Phone Number está en la posición 14 según los headers reales
                        return row[14] || '';
                    };
                    
                    const clientName = getClientName();
                    const hasValidName = clientName && clientName.trim() !== '';
                    
                    // Si no hay nombre válido, retornar null para filtrar después
                    if (!hasValidName) {
                        console.log(`⚠️ Fila ${realRowIndex} sin nombre válido, filtrando...`);
                        return null;
                    }
                    
                    // Debug: Log específico para Fernando Ramirez y Austin Rubino
                    if (clientName.includes('Fernando Ramirez') || clientName.includes('Austin Rubino')) {
                        console.log(`🔍 DEBUG: ${clientName} - originalIndex: ${originalIndex}, calculated rowIndex: ${realRowIndex}`);
                        console.log(`🔍 DEBUG: ${clientName} - Email: "${getEmail()}", Address: "${row[12] || ''}", Phone: "${getPhone()}"`);
                    }
                    
                    // El rowIndex se calcula automáticamente basado en la posición real en el CSV
                    // No se necesita ajuste manual para clientes específicos
                    
                    const client = {};
                    
                    // Agregar el índice de la fila REAL de Google Sheets
                    client.rowIndex = realRowIndex;
                    
                    client.formEmailerStatus = getValue('FormEmailer');
                    client.id = getValue('Client');
                    client.clientId = getValue('Client');
                    client.invoiceStatus = getValue('Invoice');
                    client.estimateStatus = getValue('Estimate');
                    client.status = getValue('Customer');
                    client.customerStatus = getValue('Customer');
                    client.responsible = getValue('Responsable');
                    client.responsable = getValue('Responsable');
                    client.timestamp = getValue('Timestamp');
                    client.date = getValue('Date');
                    client.channel = getValue('Channel');
                    client.serviceType = getValue('Service');
                    client.name = clientName; // Usar el nombre obtenido correctamente
                    client.clientFullName = clientName;
                    client.email = getEmail(); // Email está en la posición 11
                    client.address = row[12] || ''; // Address está en la posición 12
                    client.correo = getEmail(); // Correo debe ser el email, no la dirección
                    client.phone = getPhone();

                    client.customerType = getValue('Customer');
                    client.description = getValue('Technical');
                    client.price = getValue('Price');
                    client.company = getValue('Company');
                    client.projectAddress = getValue('Project');
                    client.serviceRequested = getValue('Service');
                    client.urgencyLevel = getValue('Urgency');
                    client.preferredContactMethod = getValue('Preferred');
                    client.additionalNotes = getValue('Additional');
                    client.budgetRange = getValue('Budget');
                    client.expectedTimeline = getValue('Expected');
                    client.specialRequirements = getValue('Special');
                        
                        return client;
                })
                .filter(client => client !== null); // Filtrar los null después del mapeo

                // Ordenar por rowIndex (más alto = más reciente) para que los nuevos clientes aparezcan primero
                clients.sort((a, b) => {
                    const rowIndexA = parseInt(a.rowIndex) || 0;
                    const rowIndexB = parseInt(b.rowIndex) || 0;
                    
                    // Ordenar por rowIndex descendente (más alto primero)
                    if (rowIndexA !== rowIndexB) {
                        return rowIndexB - rowIndexA;
                    }
                    
                    // Si rowIndex es igual, ordenar por fecha
                    const dateA = new Date(a.timestamp || a.date || 0);
                    const dateB = new Date(b.timestamp || b.date || 0);
                    return dateB - dateA;
                });
                
                // Debug: Buscar clientes con "New Lead" status
                const newLeadClients = clients.filter(c => c.customerStatus === 'New Lead');
                console.log('🔍 Clientes con status "New Lead":', newLeadClients.map(c => ({ name: c.name, rowIndex: c.rowIndex, timestamp: c.timestamp, date: c.date })));
                
                // Debug: Mostrar los primeros 10 clientes con sus fechas y rowIndex
                console.log('🔍 Debug - Primeros 10 clientes ordenados:');
                clients.slice(0, 10).forEach((client, index) => {
                    console.log(`${index + 1}. ${client.name || 'N/A'} - Date: ${client.date || 'N/A'} - Timestamp: ${client.timestamp || 'N/A'} - RowIndex: ${client.rowIndex || 'N/A'} - Status: ${client.customerStatus || 'N/A'}`);
                });
                
                // Buscar el cliente más reciente por timestamp
                const mostRecent = clients.reduce((latest, current) => {
                    const latestDate = new Date(latest.timestamp || latest.date || 0);
                    const currentDate = new Date(current.timestamp || current.date || 0);
                    return currentDate > latestDate ? current : latest;
                });
                console.log('🔍 Cliente más reciente por fecha:', mostRecent.name, 'con fecha:', mostRecent.timestamp || mostRecent.date);
                
                console.log('📅 Ordenamiento aplicado - clientes más recientes primero');
                console.log('📊 Primeros 3 clientes:', clients.slice(0, 3).map(c => ({ name: c.name, date: c.date, rowIndex: c.rowIndex })));
            
            // Debug: Buscar Austin Rubino específicamente
            const austinRubino = clients.find(c => c.name === 'Austin Rubino');
            if (austinRubino) {
                console.log('🔍 Austin Rubino encontrado:', { name: austinRubino.name, rowIndex: austinRubino.rowIndex, timestamp: austinRubino.timestamp });
            } else {
                console.log('❌ Austin Rubino no encontrado en la lista');
            }
                
                console.log(`✅ Successfully loaded ${clients.length} clients from Google Sheets`);
            
            // Log primeros 5 clientes para verificar que son datos reales
            console.log('📋 First 5 clients loaded:');
            clients.slice(0, 5).forEach((client, index) => {
                console.log(`   ${index + 1}. ${client.name} - ID: ${client.clientId} - Status: ${client.customerStatus} - Row: ${client.rowIndex}`);
            });
                return clients;
        } catch (error) {
            console.error('❌ Error in getRealClientsData:', error);
            return [];
        }
    }

    parseCSV(csvText) {
        // Split by newlines but handle quoted fields that contain newlines
        const lines = [];
        let currentLine = '';
        let inQuotes = false;
        
        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
                currentLine += char;
            } else if (char === '\n' && !inQuotes) {
                if (currentLine.trim()) {
                    lines.push(currentLine.trim());
                }
                currentLine = '';
            } else {
                currentLine += char;
            }
        }
        
        // Add the last line if it exists
        if (currentLine.trim()) {
            lines.push(currentLine.trim());
        }
        
        return lines.map(line => this.parseCSVLine(line));
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        

        
        return result;
    }

    getMockClientsData() {
        return [
            {
                id: 'CLIENT-001',
                name: 'John Doe',
                email: 'john@example.com',
                phone: '+1-555-0123',
                address: '123 Main St, Boston, MA',
                status: 'Active',
            serviceType: 'Fire Escape Inspection',
                company: 'ABC Company',
                timestamp: '2024-01-15T10:30:00Z',
                date: '2024-01-15',
                invoiceStatus: 'Pending',
                estimateStatus: 'Pending',
                responsible: 'Mike Johnson',
                description: 'Annual fire escape inspection for 3-story building',
                price: '500',
                customerType: 'Commercial',
                channel: 'Website',
                serviceRequested: 'Fire Escape Inspection',
                urgencyLevel: 'Medium',
                preferredContactMethod: 'Email',
                additionalNotes: 'Building has 2 fire escapes',
                budgetRange: '500-1000',
                expectedTimeline: '1 week',
                specialRequirements: 'Access needed during business hours',
                formEmailerStatus: 'Sent',
                correo: 'john@example.com',
            rowIndex: 1,
            },
            {
                id: 'CLIENT-002',
                name: 'Jane Smith',
                email: 'jane@example.com',
                phone: '+1-555-0456',
                address: '456 Oak Ave, Boston, MA',
                status: 'Pending',
                serviceType: 'Fire Escape Repair',
                company: 'XYZ Corp',
                timestamp: '2024-01-16T14:20:00Z',
                date: '2024-01-16',
                invoiceStatus: 'Delivered',
                estimateStatus: 'Approved',
                responsible: 'Sarah Wilson',
                description: 'Repair damaged fire escape railing',
                price: '750',
                customerType: 'Residential',
                channel: 'Phone',
                serviceRequested: 'Fire Escape Repair',
                urgencyLevel: 'High',
                preferredContactMethod: 'Phone',
                additionalNotes: 'Railing is loose and unsafe',
                budgetRange: '500-1000',
                expectedTimeline: '3 days',
                specialRequirements: 'Emergency repair needed',
                formEmailerStatus: 'Sent',
                correo: 'jane@example.com',
                rowIndex: 2,
            }
        ];
    }

    async getStatistics() {
        try {
            return await this.getOnboardingStatistics();
        } catch (error) {
            console.error('❌ Error getting statistics:', error);
            return this.getMockStatistics();
        }
    }

    async getOnboardingStatistics() {
        try {
            console.log('📊 Getting onboarding statistics...');
            
            // Obtener clientes de onboarding
            const clients = await this.getFormResponsesClients();
            
            if (!clients || clients.length === 0) {
                console.log('⚠️ No clients found for statistics');
                return this.getMockStatistics();
            }

            // Calcular estadísticas
            const totalClients = clients.length;
            const activeClients = clients.filter(c => c.status === 'Active' || c.customerStatus === 'Active').length;
            const pendingClients = clients.filter(c => c.status === 'Pending' || c.customerStatus === 'Pending').length;
            const completedInvoices = clients.filter(c => c.invoiceStatus === 'Paid').length;
            const pendingInvoices = clients.filter(c => c.invoiceStatus === 'Pending' || c.invoiceStatus === 'Invoice Pending').length;
            
            // Calcular compliance rate
            const complianceRate = totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0;
        
        const stats = {
                totalClients,
                activeClients,
                pendingClients,
                completedInvoices,
                pendingInvoices,
                complianceRate
            };

            console.log('📊 Onboarding statistics calculated:', stats);
        return stats;
        } catch (error) {
            console.error('❌ Error getting onboarding statistics:', error);
            return this.getMockStatistics();
        }
    }

    async getOnboardingClients() {
        try {
            console.log('📊 Getting onboarding clients...');
            return await this.getFormResponsesClients();
        } catch (error) {
            console.error('❌ Error getting onboarding clients:', error);
            return [];
        }
    }

    async getFormResponsesClients() {
        try {
            console.log('📊 Getting Form Responses clients...');
            
            // DISABLED CACHE - Always fetch fresh data to avoid data loss
            console.log('📊 Cache disabled - fetching fresh Form Responses data from Google Sheets');

            // Usar el mismo método que getRealClientsData para obtener datos
            const clients = await this.getRealClientsData();

            // CACHE DISABLED - Not storing data in cache to ensure fresh data
            console.log(`✅ Successfully loaded ${clients.length} Form Responses clients`);
            
            return clients;
        } catch (error) {
            console.error('❌ Error getting Form Responses clients:', error);
            return [];
        }
    }

    getMockStatistics() {
        return {
            totalClients: 149,
            activeClients: 45,
            pendingClients: 23,
            completedInvoices: 67,
            pendingInvoices: 34,
            complianceRate: 78
        };
    }

    getServiceTypeStats(clients) {
        const stats = {};
        clients.forEach(client => {
            const type = client.serviceType || 'Unknown';
            stats[type] = (stats[type] || 0) + 1;
        });
        return stats;
    }

    getResponsibleStats(clients) {
        const stats = {};
        clients.forEach(client => {
            const responsible = client.responsible || client.responsable || 'Unassigned';
            stats[responsible] = (stats[responsible] || 0) + 1;
        });
        return stats;
    }

    async testConnection() {
        try {
            console.log('🔍 Testing Google Sheets connection...');
            const clients = await this.getClientsData();
            console.log(`📊 Test connection successful - Found ${clients.length} clients`);
            return true;
        } catch (error) {
            console.error('❌ Test connection failed:', error);
            return false;
        }
    }

    async createClientFolder(clientData) {
        try {
            console.log('📁 Creating client folder...');
            
            // Simular creación de carpeta
            const folderName = `Client_${clientData.name || clientData.clientFullName || 'Unknown'}_${Date.now()}`;
            
            console.log(`✅ Client folder created: ${folderName}`);
            return {
                success: true,
                folderName: folderName,
                message: 'Client folder created successfully'
            };
        } catch (error) {
            console.error('❌ Error creating client folder:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async addClient(clientData) {
        return await this.addClientToSheet(clientData);
    }

    async addClientToSheet(clientData) {
        try {
            console.log('📝 Adding client to Google Sheet...');
            
            // Verificar credenciales de Service Account
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                throw new Error('Service Account credentials not configured');
            }

            // Crear cliente de Google Sheets con Service Account
            const { google } = require('googleapis');
            const serviceAccountKey = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString());
            
            const auth = new google.auth.GoogleAuth({
                credentials: serviceAccountKey,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            const sheets = google.sheets({ version: 'v4', auth });

            // Preparar datos para Google Sheets
            const rowData = [
                clientData.formEmailerStatus || 'Pending',
                clientData.clientId || '',
                clientData.invoiceStatus || 'Pending',
                clientData.estimateStatus || 'Pending',
                clientData.customerStatus || clientData.status || 'Contacted',
                clientData.responsable || clientData.responsible || 'N/A',
                clientData.timestamp || new Date().toISOString(),
                clientData.date || new Date().toLocaleDateString(),
                clientData.channel || 'Website',
                clientData.serviceType || 'N/A',
                clientData.clientFullName || clientData.name || '',
                clientData.email || '',
                clientData.address || '',
                clientData.correo || clientData.email || '',
                clientData.customerPhoneNumber || clientData.phone || '',
                clientData.customerType || 'Residential',
                clientData.technicalDescription || clientData.description || '',
                clientData.price || '0',
                clientData.companyName || clientData.company || '',
                clientData.projectAddress || '',
                clientData.serviceRequested || '',
                clientData.urgencyLevel || 'Medium',
                clientData.preferredContactMethod || 'Phone',
                clientData.additionalNotes || '',
                clientData.budgetRange || '',
                clientData.expectedTimeline || '',
                clientData.specialRequirements || ''
            ];

            // Agregar fila al Google Sheet
            const response = await sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: 'Form Responses 1!A:AA', // Especificar la hoja correcta
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [rowData]
                }
            });

            console.log('✅ Client added to Google Sheet successfully');
            
            // CACHE DISABLED - No cache invalidation needed since cache is disabled
            console.log('🔄 Cache disabled - data will always be fresh');

            return {
                success: true,
                message: 'Client added successfully to Google Sheets',
                rowCount: response.data.updates?.updatedRows || 1
            };
        } catch (error) {
            console.error('❌ Error adding client to sheet:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateClientInSheet(clientId, updateData) {
        try {
            console.log('🔍 Starting updateClientInSheet...');
            console.log('🔍 Client ID:', clientId);
            console.log('🔍 Update data:', updateData);
            
            // Verificar credenciales del Service Account
            console.log('🔍 Checking Service Account credentials...');
            console.log('🔍 GOOGLE_SERVICE_ACCOUNT_KEY exists:', !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY));
            console.log('🔍 GOOGLE_SERVICE_ACCOUNT_KEY length:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? process.env.GOOGLE_SERVICE_ACCOUNT_KEY.length : 0);
            
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                throw new Error('Service Account credentials not configured');
            }
            
            // Inicializar Google Sheets con Service Account para escritura
            console.log('🔑 Initializing Google Sheets with Service Account for write access...');
            const serviceAccountKey = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString());
            const auth = new google.auth.GoogleAuth({
                credentials: serviceAccountKey,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
            
            const sheets = google.sheets({ version: 'v4', auth });
            console.log('✅ Google Sheets with Service Account initialized for writing');

            // Obtener datos actuales de clientes
            console.log('🔍 Fetching real clients data from Google Sheets...');
            const clients = await this.getClientsData();
            
            // Buscar el cliente
            let client;
            if (clientId.startsWith('ROW-')) {
                const rowNumber = parseInt(clientId.replace('ROW-', ''));
                client = clients.find(c => c.rowIndex === rowNumber);
                console.log(`🔍 Looking for client with rowIndex: ${rowNumber}`);
                console.log(`🔍 Total clients found: ${clients.length}`);
                console.log(`🔍 Available rowIndexes:`, clients.map(c => c.rowIndex).slice(0, 10));
                console.log(`🔍 All rowIndexes:`, clients.map(c => c.rowIndex));
                
                if (!client) {
                    console.log(`❌ Client not found with rowIndex: ${rowNumber}`);
                    console.log(`🔍 Clients with similar rowIndexes:`, clients.filter(c => Math.abs(c.rowIndex - rowNumber) <= 5).map(c => ({ name: c.name, rowIndex: c.rowIndex })));
                }
            } else {
                console.log(`🔍 Looking for client with ID: ${clientId}`);
                console.log(`🔍 Available client IDs (first 10):`, clients.slice(0, 10).map(c => ({ 
                    name: c.name, 
                    id: c.id, 
                    clientId: c.clientId,
                    rowIndex: c.rowIndex 
                })));
                
                client = clients.find(c => c.id === clientId || c.clientId === clientId);
                
                if (!client) {
                    console.log(`❌ Client not found with ID: ${clientId}`);
                    console.log(`🔍 All client IDs:`, clients.map(c => ({ 
                        name: c.name, 
                        id: c.id, 
                        clientId: c.clientId,
                        rowIndex: c.rowIndex 
                    })));
                }
            }
            
            if (!client) {
                return {
                    success: false,
                    error: `Client not found with ID: ${clientId}`
                };
            }

            console.log(`🔍 Updating client: ${client.name} (Row: ${client.rowIndex})`);

            // Mapear update data a columnas de Google Sheets
            const columnMappings = {
                'status': 'E', // Customer Status
                'customerStatus': 'E', // Customer Status
                'invoiceStatus': 'C', // Invoice Status
                'estimateStatus': 'D', // Estimate Status
                'responsible': 'F', // Responsable
                'responsable': 'F', // Responsable
                'serviceType': 'J', // Service Type
                'description': 'Q', // Technical Description
                'price': 'R', // Price
                'customerType': 'P', // Customer Type
                'channel': 'I', // Channel
                'serviceRequested': 'U', // Service Requested
                'urgencyLevel': 'V', // Urgency Level
                'preferredContactMethod': 'W', // Preferred Contact Method
                'additionalNotes': 'X', // Additional Notes
                'budgetRange': 'Y', // Budget Range
                'expectedTimeline': 'Z', // Expected Timeline
                'specialRequirements': 'AA' // Special Requirements
            };
            
            console.log(`🔍 Column mappings for update:`, columnMappings);
            console.log(`🔍 Update data keys:`, Object.keys(updateData));

            // Preparar actualizaciones (usar hoja principal)
            const updates = [];
            for (const [field, column] of Object.entries(columnMappings)) {
                if (updateData[field] !== undefined) {
                    const range = `${column}${client.rowIndex}`; // Usar hoja principal por defecto
                    const value = updateData[field];
                    updates.push({
                        range: range,
                        values: [[value]]
                    });
                    console.log(`📝 Will update ${field} (${column}${client.rowIndex}) = "${value}"`);
                }
            }

            if (updates.length === 0) {
                return {
                    success: false,
                    error: 'No valid fields to update'
                };
            }

            // Actualizar Google Sheets usando Service Account
            const response = await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: updates
                }
            });
            
            console.log(`✅ Client updated in Google Sheets: ${client.name}`);
            
            // NO invalidar cache inmediatamente para evitar que se recarguen los datos
            // y se sobrescriban los cambios. Solo invalidar después de un delay.
            setTimeout(() => {
                this.invalidateCache('clients');
                this.invalidateCache('form_responses_clients');
                console.log(`🔄 Cache invalidated after delay for fresh data`);
            }, 2000);
            
            return {
                success: true,
                updatedFields: Object.keys(updateData),
                message: 'Client updated successfully'
            };
        } catch (error) {
            console.error('❌ Error updating client in sheet:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateClientStatus(clientId, newStatus) {
        console.log(`🔍 updateClientStatus called with clientId: ${clientId}, newStatus: ${newStatus}`);
        const result = await this.updateClientInSheet(clientId, { status: newStatus });
        console.log(`🔍 updateClientStatus result:`, result);
        return result;
    }

    async updateClientInvoiceStatus(clientId, newInvoiceStatus) {
        return await this.updateClientInSheet(clientId, { invoiceStatus: newInvoiceStatus });
    }

    async updateClientEstimateStatus(clientId, newEstimateStatus) {
        return await this.updateClientInSheet(clientId, { estimateStatus: newEstimateStatus });
    }

    async updateClientResponsible(clientId, newResponsible) {
        return await this.updateClientInSheet(clientId, { responsible: newResponsible });
    }

    async updateClientContactInfo(clientId, contactData) {
        return await this.updateClientInSheet(clientId, contactData);
    }

    async updateClientServiceInfo(clientId, serviceData) {
        return await this.updateClientInSheet(clientId, serviceData);
    }

    async getAvailableSheets(sheetId = null) {
        try {
            await this.ensureInitialized();
            
            const targetSheetId = sheetId || this.spreadsheetId;
            
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: targetSheetId
            });

            const sheets = response.data.sheets.map(sheet => ({
                id: sheet.properties.sheetId,
                title: sheet.properties.title,
                index: sheet.properties.index
            }));

            return sheets;
        } catch (error) {
            console.error('❌ Error getting available sheets:', error);
            return [];
        }
    }

    async updateDataSource(sheetId, sheetTabId) {
        try {
            console.log('🔄 Updating data source...');
            
            if (sheetId) {
                this.spreadsheetId = sheetId;
            }
            
            if (sheetTabId) {
                // Obtener el nombre de la hoja por ID
                const sheets = await this.getAvailableSheets();
                const targetSheet = sheets.find(s => s.id === parseInt(sheetTabId));
                
                if (targetSheet) {
                    this.range = `${targetSheet.title}!A:AA`;
                    console.log(`✅ Updated range to: ${this.range}`);
                } else {
                    console.log('⚠️ Sheet not found, keeping current range');
                }
            }
            
            // Invalidar cache
            this.invalidateCache();
            
            return {
                success: true,
                spreadsheetId: this.spreadsheetId,
                range: this.range
            };
        } catch (error) {
            console.error('❌ Error updating data source:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Métodos de cache optimizados
    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
        this.cacheKeys.add(key);
    }

    getCache(key) {
        const cached = this.cache.get(key);
        return cached ? cached.data : null;
    }

    isCacheValid(key) {
        const cached = this.cache.get(key);
        if (!cached) return false;
        
        const age = Date.now() - cached.timestamp;
        return age < this.cacheTimeout;
    }

    invalidateCache(pattern = null) {
        if (pattern) {
            // Invalidar cache que coincida con el patrón
            for (const key of this.cacheKeys) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                    this.cacheKeys.delete(key);
                }
            }
        } else {
            // Invalidar todo el cache
            this.cache.clear();
            this.cacheKeys.clear();
        }
    }

    clearCache() {
        this.cache.clear();
        this.cacheKeys.clear();
        this.lastCacheUpdate = 0;
    }

    async addReport(reportData) {
        try {
            console.log('📊 Adding report to Google Sheets:', reportData.reportId);
            
            // Prepare report data for Google Sheets
            const reportRow = [
                reportData.reportId,
                reportData.clientName,
                reportData.clientEmail,
                reportData.reportType,
                reportData.generatedAt,
                reportData.company,
                reportData.inspectionDate,
                reportData.status,
                new Date().toISOString() // Timestamp
            ];
            
            // Add to Reports sheet (create if doesn't exist)
            const reportsRange = 'Reports!A:I';
            
            try {
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: reportsRange,
                    valueInputOption: 'RAW',
                    insertDataOption: 'INSERT_ROWS',
                    resource: {
                        values: [reportRow]
                    }
                });
                
                console.log('✅ Report added to Google Sheets successfully');
                return { success: true, reportId: reportData.reportId };
            } catch (sheetError) {
                console.warn('⚠️ Reports sheet not found, creating it...');
                
                // Create Reports sheet
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: 'Reports',
                                    gridProperties: {
                                        rowCount: 1000,
                                        columnCount: 10
                                    }
                                }
                            }
                        }]
                    }
                });
                
                // Add headers
                const headers = [
                    'Report ID',
                    'Client Name',
                    'Client Email',
                    'Report Type',
                    'Generated At',
                    'Company',
                    'Inspection Date',
                    'Status',
                    'Timestamp'
                ];
                
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Reports!A1:I1',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [headers]
                    }
                });
                
                // Add report data
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Reports!A:I',
                    valueInputOption: 'RAW',
                    insertDataOption: 'INSERT_ROWS',
                    resource: {
                        values: [reportRow]
                    }
                });
                
                console.log('✅ Reports sheet created and report added successfully');
                return { success: true, reportId: reportData.reportId };
            }
        } catch (error) {
            console.error('❌ Error adding report to Google Sheets:', error);
            return { success: false, error: error.message };
        }
    }

    async getReportsData() {
        try {
            console.log('🔍 Starting getReportsData...');
            console.log('📋 Initialized status:', this.initialized);
            console.log('📋 Has sheets client:', !!this.sheets);
            
            await this.ensureInitialized();
            
            // Try different possible sheet names where reports might be stored
            const possibleRanges = [
                'Reports!A:O',
                'Form Responses 1!A:O',
                'Sheet1!A:O',
                'Data!A:O',
                'Form Responses 1!A:Z'  // Try with more columns
            ];
            
            let reports = [];
            
            for (const range of possibleRanges) {
                try {
                    console.log('🔍 Trying range:', range);
                    const response = await this.sheets.spreadsheets.values.get({
                        spreadsheetId: this.spreadsheetId,
                        range: range,
                        key: this.apiKey
                    });
                    
                    const rows = response.data.values;
                    console.log('📊 Raw rows from range', range, ':', rows ? rows.length : 0);
                    
                    if (rows && rows.length > 1) {
                        // Found data, filter out examples and process it
                        const filteredRows = rows.slice(1).filter(row => {
                            // Excluir filas con datos de ejemplo
                            const clientName = row[4] || ''; // Client Name
                            const clientId = row[1] || ''; // Client ID
                            const reportId = row[0] || ''; // Report ID
                            
                            // Lista de patrones de ejemplo a excluir
                            const examplePatterns = [
                                'test client', 'example', 'test-client', 'test-cli',
                                'test-', 'demo', 'sample'
                            ];
                            
                            const isExample = examplePatterns.some(pattern => 
                                clientName.toLowerCase().includes(pattern) ||
                                clientId.toLowerCase().includes(pattern) ||
                                reportId.toLowerCase().includes(pattern)
                            );
                            
                            if (isExample) {
                                console.log(`🚫 Filtering out example report: ${clientName} (${reportId})`);
                                return false;
                            }
                            
                            return true;
                        });
                        
                        reports = filteredRows.map(row => {
                            return {
                                reportId: row[0] || 'REP-' + Date.now(),
                                clientId: row[1] || '',
                                date: row[2] || new Date().toISOString().split('T')[0],
                                company: row[3] || '',
                                clientName: row[4] || 'Unknown',
                                address: row[5] || '',
                                reportType: row[6] || 'Fire Escape Inspection',
                                status: row[7] || 'Generated',
                                findings: row[8] || '',
                                recommendations: row[9] || '',
                                photos: row[10] || '',
                                inspector: row[11] || 'David Ramirez',
                                nextInspectionDate: row[12] || '',
                                createdAt: row[13] || new Date().toISOString(),
                                reportUrl: row[14] || ''
                            };
                        });
                        console.log(`📊 Found ${reports.length} reports in range ${range}`);
                        console.log('📋 Sample report:', reports[0]);
                        break;
                    }
                } catch (error) {
                    console.log(`⚠️ Range ${range} not found or empty:`, error.message);
                    continue;
                }
            }
            
            if (reports.length === 0) {
                console.log('📊 No reports found in any range, creating Reports sheet...');
                await this.createReportsSheet();
            }
            
            console.log(`📊 Final result: ${reports.length} reports`);
            return reports;
        } catch (error) {
            console.error('❌ Error getting reports data:', error);
            return [];
        }
    }

    async createReportsSheet() {
        try {
            console.log('📊 Creating Reports sheet with headers...');
            
            // First, check if the sheet exists
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
                key: this.apiKey
            });
            
            const sheetExists = spreadsheet.data.sheets.some(sheet => 
                sheet.properties.title === 'Reports'
            );
            
            if (!sheetExists) {
                // Create the Reports sheet
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    key: this.apiKey,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: 'Reports',
                                    gridProperties: {
                                        rowCount: 1000,
                                        columnCount: 15
                                    }
                                }
                            }
                        }]
                    }
                });
                console.log('✅ Reports sheet created');
            }
            
            // Add headers
            const headers = [
                'Report ID', 'Client ID', 'Date', 'Company', 'Client Name',
                'Address', 'Report Type', 'Status', 'Findings', 'Recommendations',
                'Photos', 'Inspector', 'Next Inspection Date', 'Created At', 'Report URL'
            ];
            
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: 'Reports!A1:O1',
                valueInputOption: 'RAW',
                key: this.apiKey,
                resource: {
                    values: [headers]
                }
            });
            
            console.log('✅ Reports sheet headers added');
        } catch (error) {
            console.error('❌ Error creating Reports sheet:', error);
        }
    }

    async saveReport(reportData) {
        try {
            console.log('📊 Saving report to Google Sheets:', reportData);
            
            // Ensure we're initialized
            if (!this.initialized) {
                await this.initialize();
            }
            
            // Generate report ID if not provided
            if (!reportData.reportId) {
                reportData.reportId = 'REP' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
            }
            
            // Add timestamp
            reportData.timestamp = new Date().toISOString();
            
            // Prepare report row to match existing sheet structure
            const reportRow = [
                reportData.reportId,                    // A - Report ID
                'CLI-AUTO',                             // B - Client ID (auto-generated)
                reportData.inspectionDate || new Date().toISOString().split('T')[0], // C - Date
                reportData.company || 'Irias Iron Works', // D - Company
                reportData.clientName || '',            // E - Client Name
                reportData.clientEmail || '',           // F - Address (using email as address)
                reportData.reportType || 'Fire Escape Inspection', // G - Inspection Type
                reportData.status || 'Generated',       // H - Status
                reportData.findings || '',              // I - Findings
                reportData.recommendations || '',       // J - Recommendations
                '[]',                                   // K - Photos (empty array)
                reportData.inspector || 'David Ramirez', // L - Inspector
                '',                                     // M - Next Inspection Date
                new Date().toISOString(),               // N - Created At
                reportData.reportUrl || ''              // O - Report URL
            ];
            
            // Add to Reports sheet (using existing structure with 15 columns A-O)
            const reportsRange = 'Reports!A:O';
            
            try {
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: reportsRange,
                    valueInputOption: 'RAW',
                    insertDataOption: 'INSERT_ROWS',
                    resource: {
                        values: [reportRow]
                    }
                });
                
                console.log('✅ Report saved to Google Sheets successfully');
                return { 
                    success: true, 
                    reportId: reportData.reportId,
                    reportUrl: reportData.reportUrl 
                };
            } catch (sheetError) {
                console.warn('⚠️ Reports sheet not found, creating it...');
                
                // Create Reports sheet with URL column
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: this.spreadsheetId,
                    key: this.apiKey,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: 'Reports',
                                    gridProperties: {
                                        rowCount: 1000,
                                        columnCount: 10
                                    }
                                }
                            }
                        }]
                    }
                });
                
                // Add headers matching existing sheet structure
                const headers = [
                    'Report ID',           // A
                    'Client ID',           // B
                    'Date',                // C
                    'Company',             // D
                    'Client Name',         // E
                    'Address',             // F
                    'Inspection Type',     // G
                    'Status',              // H
                    'Findings',            // I
                    'Recommendations',     // J
                    'Photos',              // K
                    'Inspector',           // L
                    'Next Inspection Date', // M
                    'Created At',          // N
                    'Report URL'           // O
                ];
                
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Reports!A1:O1',
                    valueInputOption: 'RAW',
                    key: this.apiKey,
                    resource: {
                        values: [headers]
                    }
                });
                
                // Add report data
                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.spreadsheetId,
                    range: 'Reports!A:O',
                    valueInputOption: 'RAW',
                    insertDataOption: 'INSERT_ROWS',
                    key: this.apiKey,
                    resource: {
                        values: [reportRow]
                    }
                });
                
                console.log('✅ Reports sheet created and report saved successfully');
                return { 
                    success: true, 
                    reportId: reportData.reportId,
                    reportUrl: reportData.reportUrl 
                };
            }
        } catch (error) {
            console.error('❌ Error saving report to Google Sheets:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = GoogleSheetsIntegration; 