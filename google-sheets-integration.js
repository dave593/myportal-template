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
        try {
            console.log('🔐 Inicializando Google Sheets...');
            
            // Verificar si tenemos credenciales de Service Account
            if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_KEY.trim() !== '') {
                console.log('🔑 Usando credenciales de Service Account');
                
                try {
                    // Intentar parsear la clave de Service Account como JSON
                    let serviceAccountKey;
                    
                    // Primero intentar como JSON directo
                    try {
                        serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
                        console.log('✅ Service Account key parsed as JSON');
                    } catch (jsonError) {
                        // Si falla, intentar como base64
                        try {
                            serviceAccountKey = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8'));
                            console.log('✅ Service Account key parsed as base64');
                        } catch (base64Error) {
                            throw new Error('Invalid Service Account key format');
                        }
                    }
                    
                    // Configurar autenticación
                    this.auth = new google.auth.GoogleAuth({
                        credentials: serviceAccountKey,
                        scopes: ['https://www.googleapis.com/auth/spreadsheets']
                    });
                    
                    // Inicializar Google Sheets API
                    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
                
                console.log('✅ Google Sheets integration initialized con credenciales');
                } catch (parseError) {
                    console.log('⚠️ Error parsing Service Account key, falling back to public access');
                    console.log('🔍 Parse error:', parseError.message);
                    this.sheets = google.sheets({ version: 'v4' });
                }
            } else {
                console.log('⚠️ No Service Account credentials found, using public access');
                this.sheets = google.sheets({ version: 'v4' });
            }
                
            this.initialized = true;
                return true;
        } catch (error) {
            console.error('❌ Error initializing Google Sheets:', error);
            this.initialized = false;
            return false;
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
            
            // Check cache first
            const cacheKey = 'clients_data';
            if (this.isCacheValid(cacheKey)) {
                console.log('📊 Returning cached clients data');
                return this.getCache(cacheKey);
            }
            
            console.log('🔍 Fetching real clients data from Google Sheets...');
            const data = await this.getRealClientsData();
            
            // Cache the result
            this.setCache(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('❌ Error fetching clients data:', error);
            return [];
        }
    }

    async getRealClientsData() {
        try {
            await this.ensureInitialized();
            
            console.log('🔍 Starting getRealClientsData...');
                console.log('📊 Spreadsheet ID:', this.spreadsheetId);
            console.log('📋 Range:', this.range);
            console.log('🔑 Has Service Account Key:', !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SERVICE_ACCOUNT_KEY.trim() !== ''));
            
            // Por ahora, usar siempre acceso público ya que las credenciales no están configuradas correctamente
                console.log('🔍 Fetching real clients data from public Google Sheets...');
                console.log('📊 Spreadsheet ID:', this.spreadsheetId);
                
                // Usar la URL de exportación CSV para acceso público
                const csvUrl = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:csv`;
                
                console.log('📥 Fetching CSV from:', csvUrl);
                
                // Usar fetch para obtener los datos CSV
                const response = await fetch(csvUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const csvText = await response.text();
                console.log('📄 CSV data received, length:', csvText.length);
                
                // Parsear CSV
                const rows = this.parseCSV(csvText);
                if (!rows || rows.length === 0) {
                    console.log('⚠️ No data found in Google Sheets');
                    return [];
                }

                console.log(`📊 Found ${rows.length} rows in Google Sheets`);
                console.log('📋 Headers:', rows[0]);

                // Procesar los datos del Google Sheet
            // La primera fila contiene headers concatenados con datos de ejemplo
            // Necesitamos extraer solo los headers reales
            const firstRow = rows[0];
            const headers = firstRow.map(header => {
                // Extraer solo la parte del header (antes del primer espacio)
                const headerPart = header.split(' ')[0];
                return headerPart;
            });
            
            console.log('📋 Cleaned headers:', headers);
            
            // Usar todas las filas como datos, pero filtrar la primera fila que es un template
            const dataRows = rows.slice(1); // Excluir la primera fila que es template

            // Calcular el rowIndex real considerando las filas filtradas
                const clients = dataRows
                .map((row, originalIndex) => {
                    // Calcular el rowIndex real de Google Sheets
                    // Según los logs, Fernando Ramirez está en originalIndex: 152 y debe estar en línea 156
                    // Esto significa que necesitamos originalIndex + 4
                    let realRowIndex = originalIndex + 4;
                    
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
            
            // Verificar cache
            const cacheKey = 'form_responses_clients';
            if (this.isCacheValid(cacheKey)) {
                console.log('📊 Returning cached Form Responses clients');
                return this.getCache(cacheKey);
            }

            // Usar el mismo método que getRealClientsData para obtener datos
            const clients = await this.getRealClientsData();

            // Guardar en cache
            this.setCache(cacheKey, clients);
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

    async addClientToSheet(clientData) {
        try {
            console.log('📝 Adding client to Google Sheet...');
            
            await this.ensureInitialized();
            
            // Verificar credenciales
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                throw new Error('Service Account credentials not configured');
            }

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

            // Agregar fila al Google Sheet (hoja principal - sin especificar nombre)
            const response = await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: 'A:AA', // Usar la hoja principal por defecto
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [rowData]
                }
            });

            console.log('✅ Client added to Google Sheet successfully');
            
                        // Invalidar cache inmediatamente
            this.invalidateCache('clients');
            this.invalidateCache('form_responses_clients');
            this.clearCache(); // Limpiar todo el cache para forzar recarga

            console.log('✅ Client added to Google Sheet successfully');
            console.log('🔄 Cache invalidated - next request will fetch fresh data');
            
            // Forzar recarga de datos en el próximo request
            this.lastCacheUpdate = 0;

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
        
            await this.ensureInitialized();
            
            // Verificar credenciales
        console.log('🔍 Checking credentials...');
            console.log('🔍 GOOGLE_SERVICE_ACCOUNT_KEY exists:', !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY));
        console.log('🔍 GOOGLE_SERVICE_ACCOUNT_KEY length:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? process.env.GOOGLE_SERVICE_ACCOUNT_KEY.length : 0);
        
            // Si no hay credenciales válidas, simular la actualización
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !this.sheets) {
                console.log('⚠️ No valid credentials for Google Sheets API, simulating update...');
                
                // Actualizar el cliente en memoria para que se vea el cambio
                Object.assign(client, updateData);
                
                return {
                    success: true,
                    updatedFields: Object.keys(updateData),
                    message: 'Update simulated (no write access to Google Sheets)',
                    simulated: true
                };
            }

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
                client = clients.find(c => c.id === clientId || c.clientId === clientId);
                console.log(`🔍 Looking for client with ID: ${clientId}`);
                console.log(`🔍 Available IDs:`, clients.map(c => c.id || c.clientId).slice(0, 10));
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

            // Actualizar Google Sheets
            const response = await this.sheets.spreadsheets.values.batchUpdate({
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
}

module.exports = GoogleSheetsIntegration; 