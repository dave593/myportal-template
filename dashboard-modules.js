/**
 * Dashboard Modules - Modular JavaScript for Dashboard Functionality
 * Extracted from dashboard-clientes.html for better maintainability
 */

// Dashboard State Management
class DashboardState {
    constructor() {
        this.currentData = null;
        this.filters = {
            status: 'all',
            responsible: 'all',
            search: ''
        };
        this.isLoading = false;
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.updateLoadingUI();
    }

    updateLoadingUI() {
        const loadingElements = document.querySelectorAll('.loading-spinner');
        loadingElements.forEach(el => {
            el.style.display = this.isLoading ? 'block' : 'none';
        });
    }
}

// Notification System
class NotificationSystem {
    static show(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insert at the top of the page
        const container = document.querySelector('.container-fluid') || document.body;
        container.insertBefore(notification, container.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    static error(message) {
        this.show(message, 'error');
    }

    static success(message) {
        this.show(message, 'success');
    }

    static info(message) {
        this.show(message, 'info');
    }
}

// Google Sheets Integration
class GoogleSheetsManager {
    static extractSheetIdFromUrl(url) {
        const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
    }

    static async updateSheetSelector() {
        const sheetUrl = document.getElementById('sheetUrl');
        const sheetSelector = document.getElementById('sheetSelector');
        const loadButton = document.getElementById('loadSheetData');
        
        // Check if elements exist
        if (!sheetUrl || !sheetSelector || !loadButton) {
            console.warn('Data source selector elements not found');
            return;
        }
        
        if (!sheetUrl.value) {
            sheetSelector.innerHTML = '<option value="">Enter a Google Sheet URL first</option>';
            loadButton.disabled = true;
            return;
        }

        const sheetId = this.extractSheetIdFromUrl(sheetUrl.value);
        if (!sheetId) {
            NotificationSystem.error('Invalid Google Sheet URL. Please enter a valid URL.');
            sheetSelector.innerHTML = '<option value="">Invalid URL</option>';
            loadButton.disabled = true;
            return;
        }

        // Show loading state
        sheetSelector.innerHTML = '<option value="">Loading sheets...</option>';
        loadButton.disabled = true;

        try {
            const response = await fetch(`/api/sheets?sheetId=${sheetId}`);
            const result = await response.json();

            if (result.success && result.data && result.data.sheets && result.data.sheets.length > 0) {
                sheetSelector.innerHTML = result.data.sheets.map(sheet => 
                    `<option value="${sheet.sheetId}">${sheet.title}</option>`
                ).join('');
                loadButton.disabled = false;
                NotificationSystem.success(`Found ${result.data.sheets.length} sheet(s)`);
            } else {
                sheetSelector.innerHTML = '<option value="">No sheets found</option>';
                loadButton.disabled = true;
                NotificationSystem.error('No sheets found in this Google Sheet');
            }
        } catch (error) {
            console.error('Error loading sheets:', error);
            sheetSelector.innerHTML = '<option value="">Error loading sheets</option>';
            loadButton.disabled = true;
            NotificationSystem.error('Error loading sheets. Please check the URL and try again.');
        }
    }

    static async loadSheetData() {
        const sheetUrl = document.getElementById('sheetUrl');
        const sheetSelector = document.getElementById('sheetSelector');
        const loadButton = document.getElementById('loadSheetData');
        
        // Check if elements exist
        if (!sheetUrl || !sheetSelector || !loadButton) {
            console.warn('Data source selector elements not found');
            return;
        }
        
        if (!sheetUrl.value || !sheetSelector.value) {
            NotificationSystem.error('Please select a sheet first');
            return;
        }

        const sheetId = this.extractSheetIdFromUrl(sheetUrl.value);
        const sheetTabId = sheetSelector.value;

        // Show loading state
        const originalText = loadButton.textContent;
        loadButton.textContent = 'Loading...';
        loadButton.disabled = true;

        try {
            const response = await fetch('/api/update-source', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sheetId: sheetId,
                    sheetTabId: sheetTabId
                })
            });

            const result = await response.json();

            if (result.success) {
                NotificationSystem.success(`Successfully switched to: ${result.data.spreadsheetTitle} - ${result.data.sheetTitle}`);
                
                // Reload dashboard data
                if (window.portalIntegration) {
                    await window.portalIntegration.loadDashboardData();
                }
                
                // Update current source display
                const currentSource = document.getElementById('currentSource');
                if (currentSource) {
                    currentSource.textContent = `${result.data.spreadsheetTitle} - ${result.data.sheetTitle}`;
                }
            } else {
                NotificationSystem.error('Error switching data source: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error loading sheet data:', error);
            NotificationSystem.error('Error loading sheet data. Please try again.');
        } finally {
            // Restore button state
            loadButton.textContent = originalText;
            loadButton.disabled = false;
        }
    }
}

// Client Data Mapper - Centralized data mapping utility
class ClientDataMapper {
    static mapClientFromAPI(clientData) {
        console.log('🔍 Mapping client data:', {
            name: clientData.name,
            email: clientData.email,
            phone: clientData.phone,
            responsable: clientData.responsable,
            status: clientData.status
        });
        
        const mapped = {
            clientId: clientData.clientId || clientData.id || (clientData.rowIndex ? `ROW-${clientData.rowIndex}` : ''),
            clientFullName: clientData.name || clientData['Client Full Name'] || 'N/A',
            email: clientData.email || clientData['E-mail'] || 'N/A',
            phone: clientData.phone || clientData['Customer Phone Number'] || 'N/A',
            address: clientData.address || clientData['Address'] || 'N/A',
            serviceType: clientData.serviceType || clientData['Service Type'] || 'N/A',
            customerStatus: clientData.status || clientData.customerStatus || clientData['Customer Status'] || 'Contacted',
            responsable: clientData.responsable || clientData.responsible || clientData['Responsable'] || 'N/A',
            registrationDate: clientData.timestamp || clientData.date || clientData['Date'] || new Date().toLocaleDateString(),
            invoiceStatus: clientData.invoiceStatus || clientData['Invoice Status'] || 'Pending',
            estimateStatus: clientData.estimateStatus || clientData['Estimate Status'] || 'Pending',
            customerType: clientData.customerType || clientData['Customer Type'] || clientData.type || 'Residential',
            price: clientData.price || clientData['Price'] || '0',
            description: clientData.description || clientData['Technical Description'] || '',
            companyName: clientData.company || clientData.companyName || clientData['Company Name'] || '',
            projectAddress: clientData.projectAddress || clientData['Project Address'] || '',
            serviceRequested: clientData.serviceRequested || clientData['Service Requested'] || '',
            urgencyLevel: clientData.urgencyLevel || clientData['Urgency Level'] || 'Medium',
            preferredContact: clientData.preferredContactMethod || clientData['Preferred Contact Method'] || 'Phone',
            additionalNotes: clientData.additionalNotes || clientData['Additional Notes'] || '',
            budgetRange: clientData.budgetRange || clientData['Budget Range'] || '',
            expectedTimeline: clientData.expectedTimeline || clientData['Expected Timeline'] || '',
            specialRequirements: clientData.specialRequirements || clientData['Special Requirements'] || '',
            formEmailerStatus: clientData.formEmailerStatus || clientData['FormEmailer Status'] || 'Pending',
            channel: clientData.channel || clientData['Channel'] || 'Website',
            correo: clientData.correo || clientData['Correo'] || ''
        };
        
        console.log('✅ Mapped client:', {
            clientFullName: mapped.clientFullName,
            email: mapped.email,
            phone: mapped.phone,
            responsable: mapped.responsable,
            customerStatus: mapped.customerStatus
        });
        
        return mapped;
    }

    static mapClientsArray(clientsData) {
        if (!Array.isArray(clientsData)) {
            console.warn('ClientDataMapper: clientsData is not an array', clientsData);
            return [];
        }
        return clientsData.map(client => this.mapClientFromAPI(client));
    }

    static getStatusClass(status) {
        if (!status) return 'pending';
        
        const statusLower = status.toLowerCase();
        switch (statusLower) {
            case 'active':
            case 'inspected':
            case 'quoted':
            case 'quote accepted':
            case 'invoiced':
            case 'partially paid':
            case 'full paid':
            case 'project completed':
                return 'active';
            case 'pending':
            case 'pending inspection':
            case 'waiting client response':
            case 'pending accept quote':
            case 'estimate pending':
            case 'invoice pending':
                return 'pending';
            case 'inactive':
            case 'no contacted':
            case 'contacted':
            case 'cancelled':
            case 'on hold':
                return 'inactive';
            default:
                return 'pending';
        }
    }

    static getCompanyType(responsable) {
        if (!responsable) return 'unknown';
        
        const responsableLower = responsable.toLowerCase();
        if (responsableLower.includes('boston') || responsableLower.includes('david')) {
            return 'boston';
        } else if (responsableLower.includes('irias') || responsableLower.includes('dionel')) {
            return 'irias';
        }
        return 'unknown';
    }
}

// Client API Manager - Centralized API operations
class ClientAPIManager {
    // Get authentication token from localStorage or sessionStorage
    static getAuthToken() {
        // Try to get token from localStorage first (persistent)
        let token = localStorage.getItem('fire_escape_jwt_token') || localStorage.getItem('authToken') || localStorage.getItem('jwtToken');
        
        // If not in localStorage, try sessionStorage (session-only)
        if (!token) {
            token = sessionStorage.getItem('fire_escape_jwt_token') || sessionStorage.getItem('authToken') || sessionStorage.getItem('jwtToken');
        }
        
        // If still no token, try to get from URL parameters (for OAuth flow)
        if (!token) {
            const urlParams = new URLSearchParams(window.location.search);
            token = urlParams.get('token') || urlParams.get('access_token');
            
            // If token found in URL, save it to localStorage and clean URL
            if (token) {
                console.log('🔑 Token found in URL, saving to localStorage');
                localStorage.setItem('fire_escape_jwt_token', token);
                
                // Clean URL by removing token parameter
                const newUrl = new URL(window.location);
                newUrl.searchParams.delete('token');
                newUrl.searchParams.delete('access_token');
                newUrl.searchParams.delete('success');
                window.history.replaceState({}, document.title, newUrl.pathname);
            }
        }
        
        console.log('🔑 Auth token found:', !!token);
        return token;
    }

    static async updateClientData(clientId, updateData) {
        try {
            // Get authentication token
            const token = this.getAuthToken();
            if (!token) {
                throw new Error('Authentication required. Please login first.');
            }
            
            const response = await fetch('/api/client-update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    clientId: clientId,
                    updateData: updateData
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to update client data');
            }
            
            return result;
        } catch (error) {
            console.error('ClientAPIManager.updateClientData error:', error);
            throw error;
        }
    }

    static async updateClientStatus(clientId, status) {
        try {
            console.log('🔍 ClientAPIManager.updateClientStatus called with:', { clientId, status });
            
            // Get authentication token
            const token = this.getAuthToken();
            if (!token) {
                throw new Error('Authentication required. Please login first.');
            }
            
            console.log('🔑 Token found, making request to /api/client-status');
            
            const requestBody = {
                clientId: clientId,
                status: status
            };
            
            console.log('📤 Request body:', requestBody);
            
            const response = await fetch('/api/client-status', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            console.log('📥 Response status:', response.status);
            
            const result = await response.json();
            console.log('📥 Response result:', result);
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to update client status');
            }
            
            console.log('✅ Update successful:', result);
            return result;
        } catch (error) {
            console.error('ClientAPIManager.updateClientStatus error:', error);
            throw error;
        }
    }



    static async scheduleAppointment(appointmentData) {
        try {
            console.log('Scheduling appointment:', appointmentData);
            
            // Create Google Calendar event URL with all client details
            const eventTitle = encodeURIComponent(`Appointment: ${appointmentData.clientName} - ${appointmentData.serviceType}`);
            
            const eventDescription = encodeURIComponent(`
Client: ${appointmentData.clientName}
Phone: ${appointmentData.phone}
Email: ${appointmentData.email}
Address: ${appointmentData.address}
Service: ${appointmentData.serviceType}
Price: $${appointmentData.price || 'TBD'}
Notes: ${appointmentData.notes || 'No additional notes'}

Project Details:
${appointmentData.description || 'No description provided'}

---
Created from IRIAS Ironworks Portal
            `.trim());
            
            const eventLocation = encodeURIComponent(appointmentData.address);
            
            // Set default time (next business day at 9 AM)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            
            const endTime = new Date(tomorrow);
            endTime.setHours(10, 0, 0, 0);
            
            const startDate = tomorrow.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const endDate = endTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            
            // Create Google Calendar URL
            const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&details=${eventDescription}&location=${eventLocation}&dates=${startDate}/${endDate}&sf=true&output=xml`;
            
            // Open Google Calendar in new tab
            window.open(calendarUrl, '_blank');
            
            return {
                success: true,
                message: 'Google Calendar opened with appointment details',
                calendarUrl: calendarUrl
            };
        } catch (error) {
            console.error('ClientAPIManager.scheduleAppointment error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    static async createReport(clientId) {
        try {
            // Get authentication token
            const token = this.getAuthToken();
            if (!token) {
                throw new Error('Authentication required. Please login first.');
            }
            
            const response = await fetch('/api/create-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    clientId: clientId
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to create report');
            }
            
            return result;
        } catch (error) {
            console.error('ClientAPIManager.createReport error:', error);
            throw error;
        }
    }
}

// Optimized Client Manager
class ClientManager {
    constructor() {
        this.clients = [];
        this.filteredClients = [];
        this.currentFilters = {
            search: '',
            company: 'all',
            status: 'all'
        };
        
        // Pagination
        this.currentPage = 1;
        this.itemsPerPage = window.innerWidth <= 768 ? 5 : 15;
        this.totalPages = 1;
        
        this.init();
    }

    async init() {
        // Prevent duplicate initialization
        if (this.initialized) {
            console.log('⚠️ ClientManager already initialized, skipping...');
            return Promise.resolve();
        }
        
        console.log('🚀 ClientManager.init() called');
        
        try {
            console.log('✅ DOM is ready, loading clients...');
            await this.loadClients();
            console.log('✅ Clients loaded, setting up event listeners...');
            this.setupEventListeners();
            console.log('✅ Event listeners set up, updating stats...');
            
            // Update stats immediately since DOM should be ready
            this.updateStats();
            
            // Set up periodic refresh with longer intervals to avoid conflicts
            this.setupPeriodicRefresh();
            
            this.initialized = true;
            console.log('✅ ClientManager.init() completed');
            return Promise.resolve();
        } catch (error) {
            console.error('❌ Error in ClientManager.init():', error);
            return Promise.reject(error);
        }
    }

    setupPeriodicRefresh() {
        // TEMPORARILY DISABLED: Refresh data every 5 minutes instead of more frequently to avoid conflicts
        // This was causing conflicts with status updates
        console.log('⚠️ Periodic refresh temporarily disabled to prevent conflicts with status updates');
        /*
        setInterval(async () => {
            // Only refresh if no updates are in progress
            if (!this.isUpdating) {
                console.log('🔄 Periodic refresh triggered');
                await this.loadClients();
            }
        }, 5 * 60 * 1000); // 5 minutes
        */
    }

    // Manual refresh function to be called from the refresh button
    async manualRefresh() {
        if (this.isUpdating) {
            console.log('⚠️ Cannot refresh while update is in progress');
            this.showNotification('⚠️ Please wait for the current update to complete', 'warning', 3000);
            return;
        }
        
        console.log('🔄 Manual refresh triggered');
        this.showNotification('🔄 Refreshing data from Google Sheets...', 'info', 2000);
        await this.loadClients();
        this.showNotification('✅ Data refreshed successfully', 'success', 2000);
    }

    // Get authentication token from localStorage or sessionStorage
    getAuthToken() {
        // Use global authentication if available
        if (window.globalAuth && window.globalAuth.getAuthToken) {
            return window.globalAuth.getAuthToken();
        }
        
        // Fallback to local method
        let token = localStorage.getItem('fire_escape_jwt_token') || localStorage.getItem('authToken') || localStorage.getItem('jwtToken');
        
        if (!token) {
            token = sessionStorage.getItem('fire_escape_jwt_token') || sessionStorage.getItem('authToken') || sessionStorage.getItem('jwtToken');
        }
        
        if (!token) {
            const urlParams = new URLSearchParams(window.location.search);
            token = urlParams.get('token') || urlParams.get('access_token');
            
            if (token) {
                console.log('🔑 Token found in URL, saving to localStorage');
                localStorage.setItem('fire_escape_jwt_token', token);
                
                const newUrl = new URL(window.location);
                newUrl.searchParams.delete('token');
                newUrl.searchParams.delete('access_token');
                newUrl.searchParams.delete('success');
                window.history.replaceState({}, document.title, newUrl.pathname);
            }
        }
        
        console.log('🔑 Auth token found:', !!token);
        return token;
    }

    async loadClients() {
        console.log('🔄 ClientManager.loadClients() started');
        try {
            this.showLoadingState();
            
            // Get authentication token
            const token = this.getAuthToken();
            if (!token) {
                console.error('❌ No authentication token found');
                this.showNotification('Authentication required. Please login first.', 'error');
                
                // Redirect to login page after 3 seconds
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 3000);
                return;
            }
            
            // Add cache busting parameter
            const timestamp = new Date().getTime();
            const response = await fetch(`/api/clients?_t=${timestamp}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            const responseData = await response.json();
            
            console.log('📊 API Response:', responseData);
            console.log('📊 ResponseData type:', typeof responseData);
            console.log('📊 ResponseData.data type:', typeof responseData.data);
            console.log('📊 ResponseData.data:', responseData.data);
            
            if (responseData.success && responseData.data) {
                const clientsData = responseData.data.clients || responseData.data;
                
                console.log('📋 ClientsData type:', typeof clientsData);
                console.log('📋 ClientsData is array:', Array.isArray(clientsData));
                console.log('📋 ClientsData:', clientsData);
                
                if (Array.isArray(clientsData)) {
                    console.log('📋 Raw clients data (first 2):', clientsData.slice(0, 2));
                } else {
                    console.log('❌ ClientsData is not an array!');
                    console.log('📋 ClientsData keys:', Object.keys(clientsData || {}));
                }
                
                // Use centralized data mapping
                this.clients = ClientDataMapper.mapClientsArray(clientsData);
                
                console.log('🎯 Mapped clients (first 2):', this.clients.slice(0, 2));
                
                this.filteredClients = [...this.clients];
                this.updatePagination();
                this.renderClientsTable();
                // Stats will be updated in init() method
                
                console.log(`✅ Loaded ${this.clients.length} clients successfully`);
            } else {
                console.warn('No data in response, using demo data');
                this.showDemoData();
            }
        } catch (error) {
            console.error('Error loading clients:', error);
            this.showNotification(`Unable to load clients: ${error.message}`, 'error');
            this.showDemoData();
        } finally {
            this.hideLoadingState();
        }
    }

    showLoadingState() {
        const cards = ['totalClientsCard', 'activeClientsCard', 'pendingClientsCard', 'thisMonthCard'];
        cards.forEach(id => {
            if (window.loadingManager) {
                window.loadingManager.show(id, 'Loading...');
            }
        });
        this.showSyncStatus();
        if (window.notificationManager) {
            window.notificationManager.show('🔄 Loading clients from Google Sheets...', 'info', 2000);
        }
    }

    hideLoadingState() {
        const cards = ['totalClientsCard', 'activeClientsCard', 'pendingClientsCard', 'thisMonthCard'];
        cards.forEach(id => {
            if (window.loadingManager) {
                window.loadingManager.hide(id);
            }
        });
        this.hideSyncStatus();
    }

    showSyncStatus() {
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
            syncStatus.style.display = 'block';
        }
    }

    hideSyncStatus() {
        const syncStatus = document.getElementById('syncStatus');
        if (syncStatus) {
            syncStatus.style.display = 'none';
        }
    }

    showDemoData() {
        this.clients = [
            {
                clientId: 'DEMO-001',
                clientFullName: 'John Smith',
                email: 'john@example.com',
                phone: '555-0123',
                address: '123 Main St, Boston, MA',
                serviceType: 'Fire Escape Inspection',
                customerStatus: 'Active',
                responsable: 'Boston Fire Escapes',
                registrationDate: new Date().toISOString()
            },
            {
                clientId: 'DEMO-002',
                clientFullName: 'Sarah Johnson',
                email: 'sarah@example.com',
                phone: '555-0456',
                address: '456 Oak Ave, Boston, MA',
                serviceType: 'Iron Works',
                customerStatus: 'Pending',
                responsable: 'Irias Iron Works',
                registrationDate: new Date().toISOString()
            }
        ];
        this.filteredClients = [...this.clients];
        this.renderClientsTable();
        this.updateStats(); // <-- Asegura que las estadísticas se actualicen
    }

    setupEventListeners() {
        // Search functionality with debounce
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            const debouncedSearch = window.utils.debounce((value) => {
                this.currentFilters.search = value;
                this.filterClients();
            }, 300);
            
            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });
        }

        // Company filter
        const companyFilter = document.getElementById('companyFilter');
        if (companyFilter) {
            companyFilter.addEventListener('change', (e) => {
                this.currentFilters.company = e.target.value;
                this.filterClients();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.currentFilters.status = e.target.value;
                this.filterClients();
            });
        }
    }

    filterClients() {
        this.filteredClients = this.clients.filter(client => {
            // Search filter
            if (this.currentFilters.search) {
                const searchTerm = this.currentFilters.search.toLowerCase();
                const searchableText = `${client.clientFullName} ${client.email} ${client.address} ${client.serviceType} ${client.responsable}`.toLowerCase();
                if (!searchableText.includes(searchTerm)) {
                    return false;
                }
            }

            // Company filter
            if (this.currentFilters.company !== 'all') {
                const companyType = ClientDataMapper.getCompanyType(client.responsable);
                if (this.currentFilters.company !== companyType) {
                    return false;
                }
            }

            // Status filter
            if (this.currentFilters.status !== 'all') {
                if (client.customerStatus !== this.currentFilters.status) {
                    return false;
                }
            }

            return true;
        });

        // Reset pagination when filtering
        this.currentPage = 1;
        this.updatePagination();
        this.renderClientsTable();
    }

    updatePagination() {
        this.totalPages = Math.ceil(this.filteredClients.length / this.itemsPerPage);
        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
        }
    }

    getCurrentPageClients() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return this.filteredClients.slice(startIndex, endIndex);
    }

    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.renderClientsTable();
            this.renderPagination();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    renderClientsTable() {
        const tbody = document.getElementById('clientsTableBody');
        if (!tbody) {
            console.error('clientsTableBody not found');
            return;
        }

        if (this.filteredClients.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="empty-state">
                            <i class="fas fa-search"></i>
                            <h3>No clients found</h3>
                            <p>Try adjusting your search terms or filters to find what you're looking for.</p>
                            <div style="margin-top: var(--spacing-4);">
                                <a href="/customer-onboarding.html" class="hero-btn" style="display: inline-flex; align-items: center; gap: var(--spacing-2);">
                                    <i class="fas fa-plus"></i>
                                    Add New Client
                                </a>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // Update pagination before rendering
        this.updatePagination();
        
        // Get clients for current page
        const currentPageClients = this.getCurrentPageClients();
        
        tbody.innerHTML = currentPageClients.map(client => `
            <tr>
                <td data-label="Client Information">
                    <div class="client-info">
                        <div class="client-name">${client.clientFullName || 'N/A'}</div>
                        <div class="client-details">
                            <div class="client-email">
                                <i class="fas fa-envelope"></i>
                                <a href="mailto:${client.email}" title="Send email to ${client.clientFullName}">${client.email || 'No email'}</a>
                            </div>
                            <div class="client-address">
                                <i class="fas fa-map-marker-alt"></i>
                                <span title="Client address">${client.address || 'No address'}</span>
                            </div>
                        </div>
                        <div class="client-service">
                            <i class="fas fa-tools"></i>
                            <span>${client.serviceType || 'No service type'}</span>
                        </div>
                    </div>
                </td>
                <td data-label="Contact">
                    <div class="contact-info">
                        <div class="phone-number">
                            <i class="fas fa-phone"></i>
                            <a href="tel:${client.phone}" title="Call ${client.clientFullName}">${this.formatPhone(client.phone) || 'No phone'}</a>
                        </div>
                        <div class="company-info">
                            <i class="fas fa-building"></i>
                            <span>${client.responsable || client.companyName || 'No company'}</span>
                        </div>
                    </div>
                </td>
                <td data-label="Status">
                    <div class="status-container">
                        <span class="status-badge status-${ClientDataMapper.getStatusClass(client.customerStatus)}" title="Current customer status">
                            <i class="fas fa-circle"></i>
                            ${client.customerStatus || 'Unknown'}
                        </span>
                    </div>
                </td>
                <td data-label="Actions">
                    <div class="action-buttons">
                        <button class="action-btn update" onclick="window.clientManager && window.clientManager.updateClientData('${client.clientId}')" 
                                title="Edit client information - Update contact details, service info, and other data">
                            <i class="fas fa-edit"></i>
                            <span class="btn-label">Edit</span>
                        </button>
                        <button class="action-btn status" onclick="window.clientManager && window.clientManager.updateClientStatus('${client.clientId}')" 
                                title="Change customer status - Update progress (New Lead, Contacted, Quoted, etc.)">
                            <i class="fas fa-toggle-on"></i>
                            <span class="btn-label">Status</span>
                        </button>
                        <button class="action-btn call" onclick="window.clientManager && window.clientManager.callClient('${client.clientId}')" 
                                title="Call client - Use device phone service">
                            <i class="fas fa-phone"></i>
                            <span class="btn-label">Call</span>
                        </button>
                        <button class="action-btn calendar" onclick="window.clientManager && window.clientManager.scheduleAppointment('${client.clientId}')" 
                                title="Schedule appointment - Set up meeting or service date">
                            <i class="fas fa-calendar-plus"></i>
                            <span class="btn-label">Schedule</span>
                        </button>
                        <button class="action-btn report" onclick="window.clientManager && window.clientManager.createReport('${client.clientId}')" 
                                title="Create inspection report - Generate detailed service report">
                            <i class="fas fa-file-alt"></i>
                            <span class="btn-label">Report</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Render pagination controls
        this.renderPagination();
    }

    renderPagination() {
        const paginationContainer = document.getElementById('paginationContainer');
        if (!paginationContainer) return;

        if (this.totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        let paginationHTML = `
            <div class="pagination-info">
                <span>Showing ${(this.currentPage - 1) * this.itemsPerPage + 1} to ${Math.min(this.currentPage * this.itemsPerPage, this.filteredClients.length)} of ${this.filteredClients.length} clients</span>
            </div>
            <div class="pagination-controls">
                <button class="pagination-btn" onclick="clientManager.prevPage()" ${this.currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
        `;

        // Add page numbers
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="clientManager.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        paginationHTML += `
                <button class="pagination-btn" onclick="clientManager.nextPage()" ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;

        paginationContainer.innerHTML = paginationHTML;
    }

    updateStats() {
        // Stats section removed - no longer needed
        console.log('📊 Stats section removed from dashboard');
    }

    formatPhone(phone) {
        if (!phone) return 'N/A';
        // Basic phone formatting
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
        }
        return phone;
    }

    showNotification(message, type = 'info', duration = 3000) {
        if (window.notificationManager) {
            window.notificationManager.show(message, type, duration);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // Client update methods using the new API manager
    async updateClientData(clientId) {
        const client = this.clients.find(c => c.clientId === clientId);
        if (!client) {
            this.showNotification('❌ Client not found', 'error');
            return;
        }

        // Create edit modal with all client data
        const modalContent = `
            <div class="edit-client-form">
                <div class="form-section">
                    <h3><i class="fas fa-user"></i> Client Information</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-clientName">Full Name *</label>
                            <input type="text" id="edit-clientName" value="${client.clientFullName || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="edit-email">Email *</label>
                            <input type="email" id="edit-email" value="${client.email || ''}" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-phone">Phone Number</label>
                            <input type="tel" id="edit-phone" value="${client.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label for="edit-address">Address</label>
                            <input type="text" id="edit-address" value="${client.address || ''}">
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3><i class="fas fa-briefcase"></i> Service Information</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-serviceType">Service Type</label>
                            <select id="edit-serviceType">
                                <option value="Fire Escape Inspection" ${client.serviceType === 'Fire Escape Inspection' ? 'selected' : ''}>Fire Escape Inspection</option>
                                <option value="Fire Escape Repair" ${client.serviceType === 'Fire Escape Repair' ? 'selected' : ''}>Fire Escape Repair</option>
                                <option value="Fire Escape Installation" ${client.serviceType === 'Fire Escape Installation' ? 'selected' : ''}>Fire Escape Installation</option>
                                <option value="Emergency Repair" ${client.serviceType === 'Emergency Repair' ? 'selected' : ''}>Emergency Repair</option>
                                <option value="Maintenance" ${client.serviceType === 'Maintenance' ? 'selected' : ''}>Maintenance</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit-responsible">Responsible Person</label>
                            <input type="text" id="edit-responsible" value="${client.responsable || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-price">Price ($)</label>
                            <input type="number" id="edit-price" value="${client.price || ''}" min="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label for="edit-customerStatus">Customer Status</label>
                            <select id="edit-customerStatus">
                                <option value="New Lead" ${client.customerStatus === 'New Lead' ? 'selected' : ''}>New Lead</option>
                                <option value="Contacted" ${client.customerStatus === 'Contacted' ? 'selected' : ''}>Contacted</option>
                                <option value="Pending Inspection" ${client.customerStatus === 'Pending Inspection' ? 'selected' : ''}>Pending Inspection</option>
                                <option value="Waiting Client Response" ${client.customerStatus === 'Waiting Client Response' ? 'selected' : ''}>Waiting Client Response</option>
                                <option value="Inspected" ${client.customerStatus === 'Inspected' ? 'selected' : ''}>Inspected</option>
                                <option value="Quoted" ${client.customerStatus === 'Quoted' ? 'selected' : ''}>Quoted</option>
                                <option value="Pending Accept Quote" ${client.customerStatus === 'Pending Accept Quote' ? 'selected' : ''}>Pending Accept Quote</option>
                                <option value="Quote Accepted" ${client.customerStatus === 'Quote Accepted' ? 'selected' : ''}>Quote Accepted</option>
                                <option value="Invoiced" ${client.customerStatus === 'Invoiced' ? 'selected' : ''}>Invoiced</option>
                                <option value="Partially Paid" ${client.customerStatus === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
                                <option value="Full Paid" ${client.customerStatus === 'Full Paid' ? 'selected' : ''}>Full Paid</option>
                                <option value="Project Completed" ${client.customerStatus === 'Project Completed' ? 'selected' : ''}>Project Completed</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3><i class="fas fa-file-alt"></i> Additional Information</h3>
                    <div class="form-group">
                        <label for="edit-description">Technical Description</label>
                        <textarea id="edit-description" rows="3" placeholder="Describe the technical requirements or issues...">${client.description || ''}</textarea>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-urgencyLevel">Urgency Level</label>
                            <select id="edit-urgencyLevel">
                                <option value="Low" ${client.urgencyLevel === 'Low' ? 'selected' : ''}>Low</option>
                                <option value="Medium" ${client.urgencyLevel === 'Medium' ? 'selected' : ''}>Medium</option>
                                <option value="High" ${client.urgencyLevel === 'High' ? 'selected' : ''}>High</option>
                                <option value="Emergency" ${client.urgencyLevel === 'Emergency' ? 'selected' : ''}>Emergency</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit-preferredContactMethod">Preferred Contact Method</label>
                            <select id="edit-preferredContactMethod">
                                <option value="Phone" ${client.preferredContactMethod === 'Phone' ? 'selected' : ''}>Phone</option>
                                <option value="Email" ${client.preferredContactMethod === 'Email' ? 'selected' : ''}>Email</option>
                                <option value="Text" ${client.preferredContactMethod === 'Text' ? 'selected' : ''}>Text</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const modal = this.createModal(
            `Edit Client: ${client.clientFullName}`,
            modalContent,
            'Save Changes',
            'Cancel'
        );

        // Handle form submission
        const confirmBtn = modal.querySelector('.modal-confirm');
        confirmBtn.onclick = async () => {
            try {
                if (window.loadingManager) window.loadingManager.showGlobal();
                this.showNotification('🔄 Updating client data...', 'info', 2000);

                // Collect form data
                const updateData = {
                    clientFullName: document.getElementById('edit-clientName').value.trim(),
                    email: document.getElementById('edit-email').value.trim(),
                    phone: document.getElementById('edit-phone').value.trim(),
                    address: document.getElementById('edit-address').value.trim(),
                    serviceType: document.getElementById('edit-serviceType').value,
                    responsable: document.getElementById('edit-responsible').value.trim(),
                    customerStatus: document.getElementById('edit-customerStatus').value,
                    price: document.getElementById('edit-price').value,
                    description: document.getElementById('edit-description').value.trim(),
                    urgencyLevel: document.getElementById('edit-urgencyLevel').value,
                    preferredContactMethod: document.getElementById('edit-preferredContactMethod').value
                };

                // Validate required fields
                if (!updateData.clientFullName || !updateData.email) {
                    this.showNotification('❌ Name and email are required fields', 'error');
                    return;
                }

                const result = await ClientAPIManager.updateClientData(clientId, updateData);
                
                // Update local client data
                Object.assign(client, updateData);
                client.lastUpdated = new Date().toISOString();
                
                // Update filtered clients if needed
                const filteredClient = this.filteredClients.find(c => c.clientId === clientId);
                if (filteredClient) {
                    Object.assign(filteredClient, updateData);
                }
                
                this.renderClientsTable();
                this.closeModal(modal);
                
                if (result.simulated) {
                    this.showNotification(`⚠️ Client data update simulated for "${client.clientFullName}" (configure credentials for real updates)`, 'warning', 6000);
                } else {
                    this.showNotification(`✅ Client data updated successfully for "${client.clientFullName}"`, 'success', 4000);
                }
            } catch (error) {
                console.error('Error updating client data:', error);
                this.showNotification(`❌ Error updating client data: ${error.message}`, 'error', 5000);
            } finally {
                if (window.loadingManager) window.loadingManager.hideGlobal();
            }
        };
    }

    async updateClientStatus(clientId) {
        const client = this.clients.find(c => c.clientId === clientId);
        if (!client) {
            this.showNotification('❌ Client not found', 'error');
            return;
        }

        const statusOptions = [
            'No Contacted',
            'Contacted',
            'Pending Inspection',
            'Waiting Client Response',
            'Inspected',
            'Quoted',
            'Pending Accept Quote',
            'Quote Accepted',
            'Invoiced',
            'Partially Paid',
            'Full Paid',
            'Project Completed'
        ];

        const currentStatus = client.customerStatus || 'Contacted';
        
        // Create custom modal for status update
        const modal = this.createModal(
            `Update Status for ${client.clientFullName}`,
            `
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--dark-gray);">
                    Current Status: <span style="color: var(--primary-red);">${currentStatus}</span>
                </label>
                <select id="statusSelect" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--font-size-base);">
                    ${statusOptions.map(option => 
                        `<option value="${option}" ${option === currentStatus ? 'selected' : ''}>${option}</option>`
                    ).join('')}
                </select>
            </div>
            `,
            'Update Status',
            'Cancel'
        );

        // Handle form submission
        const form = modal.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newStatus = document.getElementById('statusSelect').value;
            
            if (newStatus && newStatus.trim() !== '') {
                try {
                    // Set updating flag to prevent conflicts
                    this.isUpdating = true;
                    
                    if (window.loadingManager) window.loadingManager.showGlobal();
                    this.showNotification('🔄 Updating client status in Google Sheets...', 'info', 2000);
                    
                    console.log('🔍 About to update client:', {
                        clientId: clientId,
                        clientName: client.clientFullName,
                        currentStatus: client.customerStatus,
                        newStatus: newStatus.trim(),
                        clientData: client
                    });
                    
                    const result = await ClientAPIManager.updateClientStatus(clientId, newStatus.trim());
                    
                    // Update status locally without reloading all data
                    client.customerStatus = newStatus.trim();
                    client.lastUpdated = new Date().toISOString();
                    
                    // Update the client in the filtered list as well
                    const filteredClient = this.filteredClients.find(c => c.clientId === clientId);
                    if (filteredClient) {
                        filteredClient.customerStatus = newStatus.trim();
                        filteredClient.lastUpdated = new Date().toISOString();
                    }
                    
                    // Update stats without full reload
                    this.updateStats();
                    
                    // Re-render only the table, not full page reload
                    this.renderClientsTable();
                    
                    console.log(`✅ Status updated locally for ${client.clientFullName}: ${newStatus}`);
                    
                    if (result.simulated) {
                        this.showNotification(`⚠️ Status update simulated to "${newStatus}" for "${client.clientFullName}" (configure credentials for real updates)`, 'warning', 6000);
                    } else {
                        this.showNotification(`✅ Status updated to "${newStatus}" in Google Sheets for "${client.clientFullName}" - Changes saved!`, 'success', 5000);
                        
                        // Add visual confirmation on the table row
                        const row = document.querySelector(`[data-client-id="${clientId}"]`);
                        if (row) {
                            row.style.backgroundColor = '#d4edda';
                            row.style.borderLeft = '4px solid #28a745';
                            setTimeout(() => {
                                row.style.backgroundColor = '';
                                row.style.borderLeft = '';
                            }, 3000);
                        }
                    }
                } catch (error) {
                    console.error('Error updating status:', error);
                    this.showNotification(`❌ Error updating status: ${error.message}`, 'error', 5000);
                } finally {
                    // Clear updating flag
                    this.isUpdating = false;
                    if (window.loadingManager) window.loadingManager.hideGlobal();
                }
            }
            
            this.closeModal(modal);
        });

        // Handle cancel
        const cancelBtn = modal.querySelector('.modal-cancel');
        cancelBtn.addEventListener('click', () => {
            this.closeModal(modal);
        });
    }



    async scheduleAppointment(clientId) {
        const client = this.clients.find(c => c.clientId === clientId);
        if (!client) {
            this.showNotification('❌ Client not found', 'error');
            return;
        }

        // Create custom modal for appointment scheduling
        const modal = this.createModal(
            `Schedule Appointment for ${client.clientFullName}`,
            `
            <div style="display: grid; gap: 1rem;">
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--dark-gray);">
                        Appointment Date <span style="color: var(--danger);">*</span>
                    </label>
                    <input type="date" id="appointmentDate" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--font-size-base);" value="${new Date().toISOString().split('T')[0]}">
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--dark-gray);">
                        Appointment Time <span style="color: var(--danger);">*</span>
                    </label>
                    <input type="time" id="appointmentTime" required style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--font-size-base);" value="10:00">
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--dark-gray);">
                        Appointment Type
                    </label>
                    <input type="text" id="appointmentType" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--font-size-base);" value="${client.serviceType || 'Fire Escape Inspection'}">
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--dark-gray);">
                        Notes (Optional)
                    </label>
                    <textarea id="appointmentNotes" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); font-size: var(--font-size-base); resize: vertical;" placeholder="Additional notes for the appointment..."></textarea>
                </div>
                
                <div style="background: var(--info-light); padding: 1rem; border-radius: var(--radius-md); border-left: 4px solid var(--info);">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--info);">Client Information</h4>
                    <p style="margin: 0; font-size: 0.875rem; color: var(--medium-gray);">
                        <strong>Name:</strong> ${client.clientFullName}<br>
                        <strong>Phone:</strong> ${client.phone}<br>
                        <strong>Email:</strong> ${client.email}<br>
                        <strong>Address:</strong> ${client.address}
                    </p>
                </div>
            </div>
            `,
            'Schedule Appointment',
            'Cancel'
        );

        // Handle form submission
        const form = modal.querySelector('form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const appointmentDate = document.getElementById('appointmentDate').value;
            const appointmentTime = document.getElementById('appointmentTime').value;
            const appointmentType = document.getElementById('appointmentType').value;
            const notes = document.getElementById('appointmentNotes').value;

            if (appointmentDate && appointmentTime) {
                try {
                    if (window.loadingManager) window.loadingManager.showGlobal();
                    this.showNotification('🔄 Scheduling appointment with Google Calendar...', 'info', 3000);
                    
                    // Prepare Google Calendar event data
                    const eventData = {
                        clientId: clientId, // Pass clientId to the API call
                        clientName: client.clientFullName,
                        email: client.email,
                        phone: client.phone,
                        address: client.address,
                        serviceType: appointmentType,
                        price: client.price || 'TBD', // Use client price or default
                        description: notes,
                        notes: notes,
                        appointmentDate: appointmentDate,
                        appointmentTime: appointmentTime
                    };

                    const result = await ClientAPIManager.scheduleAppointment(eventData);
                    
                    if (result.success) {
                        this.showNotification(`✅ Appointment scheduled for "${client.clientFullName}" on ${appointmentDate} at ${appointmentTime}`, 'success', 6000);
                    } else {
                        this.showNotification(`❌ Error scheduling appointment: ${result.error}`, 'error', 5000);
                    }
                } catch (error) {
                    console.error('Error scheduling appointment:', error);
                    this.showNotification(`❌ Error scheduling appointment: ${error.message}`, 'error', 5000);
                } finally {
                    if (window.loadingManager) window.loadingManager.hideGlobal();
                }
            }
            
            this.closeModal(modal);
        });

        // Handle cancel
        const cancelBtn = modal.querySelector('.modal-cancel');
        cancelBtn.addEventListener('click', () => {
            this.closeModal(modal);
        });
    }

    async callClient(clientId) {
        const client = this.clients.find(c => c.clientId === clientId);
        if (!client) {
            this.showNotification('❌ Client not found', 'error');
            return;
        }

        // Check if client has a phone number
        if (!client.phone || client.phone === 'N/A' || client.phone.trim() === '') {
            this.showNotification('❌ No phone number available for this client', 'error');
            return;
        }

        // Format phone number for calling
        const phoneNumber = this.formatPhoneForCall(client.phone);
        
        // Show confirmation modal
        const modal = this.createModal(
            `Call Client: ${client.clientFullName}`,
            `
            <div style="display: grid; gap: 1rem;">
                <div style="background: var(--info-light); padding: 1rem; border-radius: var(--radius-md); border-left: 4px solid var(--info);">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--info);">Client Information</h4>
                    <p style="margin: 0; font-size: 0.875rem; color: var(--medium-gray);">
                        <strong>Name:</strong> ${client.clientFullName}<br>
                        <strong>Phone:</strong> ${client.phone}<br>
                        <strong>Email:</strong> ${client.email}<br>
                        <strong>Service:</strong> ${client.serviceType || 'N/A'}<br>
                        <strong>Status:</strong> ${client.customerStatus}
                    </p>
                </div>
                
                <div style="background: var(--warning-light); padding: 1rem; border-radius: var(--radius-md); border-left: 4px solid var(--warning);">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--warning);">Call Information</h4>
                    <p style="margin: 0; font-size: 0.875rem; color: var(--medium-gray);">
                        <strong>Number to call:</strong> ${phoneNumber}<br>
                        <strong>Service:</strong> ${client.serviceType || 'General inquiry'}<br>
                        <strong>Notes:</strong> ${client.technicalDescription || 'No additional notes'}
                    </p>
                </div>
                
                <div style="text-align: center; padding: 1rem; background: var(--success-light); border-radius: var(--radius-md);">
                    <i class="fas fa-phone" style="font-size: 2rem; color: var(--success); margin-bottom: 0.5rem;"></i>
                    <p style="margin: 0; font-weight: 600; color: var(--success);">
                        Click "Call Now" to initiate the call using your device's phone service
                    </p>
                </div>
            </div>
            `,
            'Call Now',
            'Cancel'
        );

        // Handle call button click
        const confirmBtn = modal.querySelector('.modal-confirm');
        confirmBtn.addEventListener('click', () => {
            try {
                // Use tel: protocol to initiate call
                const callUrl = `tel:${phoneNumber}`;
                window.open(callUrl, '_self');
                
                this.showNotification(`📞 Initiating call to ${client.clientFullName}`, 'success');
                
                // Log the call attempt
                console.log(`📞 Call initiated to ${client.clientFullName} at ${phoneNumber}`);
                
            } catch (error) {
                console.error('Error initiating call:', error);
                this.showNotification('❌ Error initiating call. Please try manually dialing the number.', 'error');
            }
            
            this.closeModal(modal);
        });
    }

    formatPhoneForCall(phone) {
        if (!phone) return '';
        
        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');
        
        // Handle different phone number formats
        if (cleaned.length === 10) {
            // US format: (123) 456-7890
            return cleaned;
        } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
            // US format with country code: 1-123-456-7890
            return cleaned;
        } else {
            // Return as is for international numbers
            return cleaned;
        }
    }

    async createReport(clientId) {
        const client = this.clients.find(c => c.clientId === clientId);
        if (!client) {
            this.showNotification('❌ Client not found', 'error');
            return;
        }

        try {
            if (window.loadingManager) window.loadingManager.showGlobal();
            this.showNotification('🔄 Preparing report with client data...', 'info', 2000);
            
            // Prepare client data for the report
            const reportData = {
                clientId: client.clientId,
                clientName: client.clientFullName,
                email: client.email,
                phone: client.phone,
                address: client.address,
                serviceType: client.serviceType,
                responsable: client.responsable,
                customerStatus: client.customerStatus,
                invoiceStatus: client.invoiceStatus,
                estimateStatus: client.estimateStatus,
                customerType: client.customerType,
                price: client.price,
                description: client.description,
                registrationDate: client.registrationDate
            };

            // Store client data in localStorage for the report page
            localStorage.setItem('reportClientData', JSON.stringify(reportData));
            
            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Redirect to the report page
            window.location.href = '/fire_escapes_rp.html?clientId=' + clientId;
            
        } catch (error) {
            console.error('Error creating report:', error);
            this.showNotification(`❌ Error creating report: ${error.message}`, 'error', 5000);
        } finally {
            if (window.loadingManager) window.loadingManager.hideGlobal();
        }
    }

    // Modal utility functions
    createModal(title, content, confirmText = 'Confirm', cancelText = 'Cancel') {
        // Remove any existing modals
        const existingModal = document.querySelector('.custom-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 1rem;
        `;

        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                border-radius: var(--radius-lg);
                padding: 2rem;
                max-width: 500px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: var(--shadow-2xl);
                animation: modalSlideIn 0.3s ease-out;
            ">
                <div class="modal-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid var(--border-color);
                ">
                    <h3 style="margin: 0; color: var(--dark-gray); font-size: 1.25rem; font-weight: 600;">${title}</h3>
                    <button class="modal-close" style="
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        cursor: pointer;
                        color: var(--light-gray);
                        padding: 0.25rem;
                        border-radius: var(--radius-sm);
                        transition: all 0.2s ease;
                    ">&times;</button>
                </div>
                
                <form class="modal-form">
                    <div class="modal-body" style="margin-bottom: 1.5rem;">
                        ${content}
                    </div>
                    
                    <div class="modal-footer" style="
                        display: flex;
                        gap: 1rem;
                        justify-content: flex-end;
                        padding-top: 1rem;
                        border-top: 1px solid var(--border-color);
                    ">
                        <button type="button" class="modal-cancel" style="
                            padding: 0.75rem 1.5rem;
                            border: 1px solid var(--border-color);
                            background: white;
                            color: var(--dark-gray);
                            border-radius: var(--radius-md);
                            cursor: pointer;
                            font-weight: 500;
                            transition: all 0.2s ease;
                        ">${cancelText}</button>
                        <button type="submit" class="modal-confirm" style="
                            padding: 0.75rem 1.5rem;
                            border: none;
                            background: var(--primary-red);
                            color: white;
                            border-radius: var(--radius-md);
                            cursor: pointer;
                            font-weight: 500;
                            transition: all 0.2s ease;
                        ">${confirmText}</button>
                    </div>
                </form>
            </div>
        `;

        // Add event listeners
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => this.closeModal(modal));

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modal);
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
            }
        });

        document.body.appendChild(modal);
        return modal;
    }

    closeModal(modal) {
        if (modal && modal.parentNode) {
            modal.style.animation = 'modalSlideOut 0.3s ease-in';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }
}

// Initialize Dashboard
class DashboardInitializer {
    static init() {
        // Initialize state
        window.dashboardState = new DashboardState();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize portal integration if available
        if (window.portalIntegration) {
            window.portalIntegration.loadDashboardData();
        }
    }

    static setupEventListeners() {
        // Close modal when clicking outside
        document.addEventListener('click', function(event) {
            const modal = document.getElementById('templateModal');
            if (modal && event.target === modal) {
                // TemplateGenerator.closeTemplateModal(); // Removed
            }
        });

        // Mobile menu toggle
        const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');
        
        if (mobileMenuBtn && navLinks) {
            mobileMenuBtn.addEventListener('click', () => {
                navLinks.classList.toggle('active');
            });
        }

        // Search functionality with debounce
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            const debouncedSearch = window.utils.debounce((value) => {
                // Implement search functionality
                console.log('Searching for:', value);
            }, 300);
            
            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });
        }
    }
}

// Export for global access
window.DashboardState = DashboardState;
window.NotificationSystem = NotificationSystem;
window.GoogleSheetsManager = GoogleSheetsManager;
// window.TemplateGenerator = TemplateGenerator; // Removed
// window.Utils = Utils; // Eliminado
window.DashboardInitializer = DashboardInitializer;
window.ClientAPIManager = ClientAPIManager; // Add ClientAPIManager to global scope
window.ClientManager = ClientManager; // Add ClientManager to global scope

// Global function aliases for HTML compatibility
// window.showTemplateGenerator = () => TemplateGenerator.showTemplateGenerator(); // Removed
// window.closeTemplateModal = () => TemplateGenerator.closeTemplateModal(); // Removed
// window.createGoogleSheetAutomatically = () => TemplateGenerator.createGoogleSheetAutomatically(); // Removed
window.updateSheetSelector = () => GoogleSheetsManager.updateSheetSelector();
window.loadSheetData = () => GoogleSheetsManager.loadSheetData();
window.showNotification = (message, type) => NotificationSystem.show(message, type);
window.refreshDataWithFeedback = () => {
    if (window.clientManager) {
        window.clientManager.loadClients();
    }
};
window.toggleMobileMenu = () => {
    const navLinks = document.querySelector('.nav-links');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    
    navLinks.classList.toggle('active');
    
    // Change icon
    const icon = menuBtn.querySelector('i');
    if (navLinks.classList.contains('active')) {
        icon.className = 'fas fa-times';
    } else {
        icon.className = 'fas fa-bars';
    }
};

// Single initialization point - wait for everything to be ready
window.addEventListener('load', () => {
    console.log('🚀 Window fully loaded, initializing dashboard...');
    console.log('🔍 Current window location:', window.location.href);
    console.log('🔍 Document title:', document.title);
    
    // Initialize dashboard components
    DashboardInitializer.init();
    
    // Create and initialize client manager
    console.log('🔄 Creating ClientManager instance...');
    window.clientManager = new ClientManager();
    console.log('🔄 Initializing ClientManager...');
    window.clientManager.init().then(() => {
        console.log('✅ ClientManager initialized successfully');
        // AUTO-REFRESH DISABLED: Prevents data reversion after updates
        // Users can manually refresh when needed using the refresh button
        console.log('🚫 Auto-refresh disabled to prevent data reversion issues');
        
        // OLD CODE - KEPT FOR REFERENCE
        // setInterval(async () => {
        //     if (window.clientManager) {
        //         await window.clientManager.loadClients();
        //     }
        // }, 30000);
    }).catch(error => {
        console.error('❌ Error initializing ClientManager:', error);
    });
    
    console.log('✅ Dashboard initialization completed');
}); 