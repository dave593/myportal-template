// Portal Integration Class
class PortalIntegration {
    constructor(pageType) {
        this.pageType = pageType;
        
        // Get authentication token from localStorage or sessionStorage
        this.getAuthToken = function() {
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
        };
        
        // Define status options
        this.statusOptions = [
            'New Lead',
            'In Progress',
            'Completed',
            'Cancelled',
            'On Hold',
            'Follow Up',
            'Quote Sent',
            'Contract Signed',
            'Work Started',
            'Work Completed',
            'Invoice Sent',
            'Payment Received'
        ];
        
        this.invoiceStatusOptions = [
            'Pending',
            'Sent',
            'Paid',
            'Overdue',
            'Cancelled'
        ];
        
        this.estimateStatusOptions = [
            'Draft',
            'Sent',
            'Approved',
            'Rejected',
            'Expired'
        ];
        
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Initializing Portal Integration...');
            
            // Load initial data
            await this.loadInitialData();
            
            // Setup auto-sync
            this.setupAutoSync();
            
            console.log('✅ Portal Integration initialized for:', this.pageType);
        } catch (error) {
            console.error('❌ Failed to initialize Portal Integration:', error);
        }
    }

    async loadInitialData() {
        try {
            await this.loadDashboardData();
        } catch (error) {
            console.error('Failed to load initial data:', error);
        }
    }

    setupAutoSync() {
        // Sync every 30 seconds
        setInterval(async () => {
            await this.syncData();
        }, 30000);
    }

    async syncData() {
        try {
            await this.syncDashboardData();
        } catch (error) {
            console.error('Data sync failed:', error);
        }
    }

    async loadDashboardData() {
        try {
            // Get authentication token
            const token = this.getAuthToken();
            if (!token) {
                console.error('❌ No authentication token found');
                throw new Error('Authentication required. Please login first.');
            }
            
            const response = await fetch('/api/clients', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const clientsResponse = await response.json();
            
            if (clientsResponse.success) {
                // Handle different response structures
                let clients;
                if (clientsResponse.data && Array.isArray(clientsResponse.data)) {
                    clients = clientsResponse.data;
                } else if (clientsResponse.data && clientsResponse.data.clients) {
                    clients = clientsResponse.data.clients;
                } else if (Array.isArray(clientsResponse.data)) {
                    clients = clientsResponse.data;
                } else if (Array.isArray(clientsResponse.clients)) {
                    clients = clientsResponse.clients;
                } else {
                    console.error('Unexpected API response structure:', clientsResponse);
                    return;
                }
                
                this.updateClientsTable(clients);
                console.log('✅ Loaded', clients.length, 'clients from Google Sheets');
            } else {
                throw new Error(clientsResponse.message || 'Failed to load clients');
            }
        } catch (error) {
            console.error('Dashboard data load failed:', error);
        }
    }

    async syncDashboardData() {
        try {
            // Get authentication token
            const token = this.getAuthToken();
            if (!token) {
                console.error('❌ No authentication token found for sync');
                return;
            }
            
            const response = await fetch('/api/clients', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const clientsResponse = await response.json();
            
            if (clientsResponse.success) {
                // Handle different response structures
                let clients;
                if (clientsResponse.data && Array.isArray(clientsResponse.data)) {
                    clients = clientsResponse.data;
                } else if (clientsResponse.data && clientsResponse.data.clients) {
                    clients = clientsResponse.data.clients;
                } else if (Array.isArray(clientsResponse.data)) {
                    clients = clientsResponse.data;
                } else if (Array.isArray(clientsResponse.clients)) {
                    clients = clientsResponse.clients;
                } else {
                    console.error('Unexpected API response structure in sync:', clientsResponse);
                    return;
                }
                
                this.updateClientsTable(clients);
            }
        } catch (error) {
            console.error('Dashboard sync failed:', error);
        }
    }

    updateClientsTable(clients) {
        if (!Array.isArray(clients)) {
            console.log('Clients is not an array:', clients);
            // Handle case where clients is an object with data property
            if (clients && typeof clients === 'object' && clients.clients) {
                clients = clients.clients;
            } else if (clients && typeof clients === 'object' && clients.data && Array.isArray(clients.data)) {
                clients = clients.data;
            } else {
                console.error('Invalid clients data structure:', clients);
                return;
            }
        }

        // Instead of rendering the table directly, trigger the main dashboard to refresh
        if (window.clientManager && typeof window.clientManager.loadClients === 'function') {
            window.clientManager.loadClients();
        }
    }
}

// Initialize Portal Integration when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.portalIntegration = new PortalIntegration('dashboard');
}); 