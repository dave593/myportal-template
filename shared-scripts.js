/* ===== SHARED SCRIPTS FOR ALL PORTALS ===== */
/* Professional Business Portal System - Common JavaScript */

// Load JWT Authentication Handler
if (typeof window.jwtAuth === 'undefined') {
    const script = document.createElement('script');
    script.src = '/jwt-auth.js';
    script.onload = () => {
        console.log('JWT Authentication loaded');
    };
    document.head.appendChild(script);
}

// Enhanced API Client with error handling and timeout
class APIClient {
    constructor() {
        this.baseURL = window.location.origin;
        this.timeout = 10000;
        this.retryAttempts = 3;
    }

    async request(endpoint, options = {}) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            try {
                // Add JWT token to headers if available
                const headers = {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...options.headers
                };

                // Add JWT token if available
                if (window.jwtAuth && window.jwtAuth.getToken()) {
                    headers['Authorization'] = `Bearer ${window.jwtAuth.getToken()}`;
                }

                const response = await fetch(`${this.baseURL}${endpoint}`, {
                    ...options,
                    signal: controller.signal,
                    headers
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    // Handle 401 Unauthorized - redirect to login
                    if (response.status === 401 && window.jwtAuth) {
                        window.jwtAuth.logout();
                        return null;
                    }
                    
                    const errorText = await response.text().catch(() => 'Unknown error');
                    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
                }

                const data = await response.json();
                return data;
            } catch (error) {
                clearTimeout(timeoutId);
                lastError = error;
                
                if (error.name === 'AbortError') {
                    console.warn(`Request timeout (attempt ${attempt}/${this.retryAttempts})`);
                    if (attempt === this.retryAttempts) {
                        throw new Error('Request timeout - please check your connection and try again');
                    }
                    continue;
                }
                
                if (attempt === this.retryAttempts) {
                    // Enhanced error logging
                    console.error('API request failed after all retries:', {
                        endpoint,
                        error: error.message,
                        attempts: this.retryAttempts
                    });
                    throw error;
                }
                
                // Wait before retrying with exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
            }
        }
        
        throw lastError;
    }

    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// Notification System
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.container = this.createContainer();
    }

    createContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 1rem;
            right: 1rem;
            z-index: 1000;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            max-width: 400px;
        `;
        document.body.appendChild(container);
        return container;
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icon = this.getIcon(type);
        
        notification.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                <i class="fas ${icon}" style="margin-top: 0.125rem; color: ${this.getColor(type)};"></i>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${this.getTitle(type)}</div>
                    <div style="font-size: 0.875rem; line-height: 1.4;">${message}</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #6b7280; cursor: pointer; padding: 0.25rem;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        notification.style.cssText = `
            background: white;
            border-radius: 0.75rem;
            padding: 1rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border-left: 4px solid ${this.getColor(type)};
            animation: slideIn 0.3s ease-out;
            max-width: 400px;
        `;

        this.container.appendChild(notification);
        this.notifications.push(notification);

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.remove(notification);
            }, duration);
        }

        return notification;
    }

    remove(notification) {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this.notifications = this.notifications.filter(n => n !== notification);
            }, 300);
        }
    }

    getIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-triangle',
            warning: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    getColor(type) {
        const colors = {
            success: '#059669',
            error: '#dc2626',
            warning: '#d97706',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }

    getTitle(type) {
        const titles = {
            success: 'Success',
            error: 'Error',
            warning: 'Warning',
            info: 'Information'
        };
        return titles[type] || titles.info;
    }

    clear() {
        this.notifications.forEach(notification => this.remove(notification));
    }
}

// Loading Manager
class LoadingManager {
    constructor() {
        this.loadingStates = new Map();
    }

    show(elementId, text = 'Loading...') {
        const element = document.getElementById(elementId);
        if (!element) return;

        const loadingState = {
            originalContent: element.innerHTML,
            text: text
        };

        this.loadingStates.set(elementId, loadingState);
        
        element.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 1rem;">
                <div class="loading-spinner"></div>
                <span style="color: #6b7280; font-size: 0.875rem;">${text}</span>
            </div>
        `;
        
        element.classList.add('loading');
    }

    hide(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const loadingState = this.loadingStates.get(elementId);
        if (loadingState) {
            element.innerHTML = loadingState.originalContent;
            element.classList.remove('loading');
            this.loadingStates.delete(elementId);
        }
    }

    showGlobal() {
        const overlay = document.createElement('div');
        overlay.id = 'global-loading';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(4px);
        `;
        
        overlay.innerHTML = `
            <div style="text-align: center;">
                <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 1rem;"></div>
                <div style="color: #374151; font-weight: 500;">Loading...</div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    hideGlobal() {
        const overlay = document.getElementById('global-loading');
        if (overlay) {
            overlay.remove();
        }
    }
}

// Form Validation Helper
class FormValidator {
    constructor(formId) {
        this.form = document.getElementById(formId);
        this.errors = new Map();
        this.init();
    }

    init() {
        if (!this.form) return;
        
        this.form.addEventListener('submit', (e) => {
            if (!this.validate()) {
                e.preventDefault();
                this.showErrors();
            }
        });

        // Real-time validation
        this.form.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('blur', () => {
                this.validateField(field);
            });
        });
    }

    validateField(field) {
        const value = field.value.trim();
        const fieldName = field.name || field.id;
        let isValid = true;
        let errorMessage = '';

        // Required validation
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }

        // Email validation
        if (field.type === 'email' && value && !this.isValidEmail(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }

        // Phone validation
        if (field.type === 'tel' && value && !this.isValidPhone(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid phone number';
        }

        // Min length validation
        const minLength = field.getAttribute('minlength');
        if (minLength && value.length < parseInt(minLength)) {
            isValid = false;
            errorMessage = `Minimum ${minLength} characters required`;
        }

        // Max length validation
        const maxLength = field.getAttribute('maxlength');
        if (maxLength && value.length > parseInt(maxLength)) {
            isValid = false;
            errorMessage = `Maximum ${maxLength} characters allowed`;
        }

        this.setFieldError(fieldName, isValid ? '' : errorMessage);
        this.updateFieldUI(field, isValid);
        
        return isValid;
    }

    validate() {
        let isValid = true;
        this.errors.clear();

        this.form.querySelectorAll('input, select, textarea').forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    setFieldError(fieldName, errorMessage) {
        if (errorMessage) {
            this.errors.set(fieldName, errorMessage);
        } else {
            this.errors.delete(fieldName);
        }
    }

    updateFieldUI(field, isValid) {
        const fieldContainer = field.closest('.form-group') || field.parentElement;
        const existingError = fieldContainer.querySelector('.field-error');
        
        if (existingError) {
            existingError.remove();
        }

        field.style.borderColor = isValid ? '' : '#dc2626';
        
        if (!isValid) {
            const errorElement = document.createElement('div');
            errorElement.className = 'field-error';
            errorElement.style.cssText = `
                color: #dc2626;
                font-size: 0.75rem;
                margin-top: 0.25rem;
                display: flex;
                align-items: center;
                gap: 0.25rem;
            `;
            errorElement.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <span>${this.errors.get(field.name || field.id)}</span>
            `;
            fieldContainer.appendChild(errorElement);
        }
    }

    showErrors() {
        if (this.errors.size > 0) {
            const firstError = Array.from(this.errors.values())[0];
            window.notificationManager.show(firstError, 'error');
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isValidPhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    }

    clearErrors() {
        this.errors.clear();
        this.form.querySelectorAll('.field-error').forEach(error => error.remove());
        this.form.querySelectorAll('input, select, textarea').forEach(field => {
            field.style.borderColor = '';
        });
    }
}

// Mobile Menu Manager
class MobileMenuManager {
    constructor() {
        this.isOpen = false;
        this.init();
    }

    init() {
        const menuBtn = document.querySelector('.mobile-menu-btn');
        const navLinks = document.querySelector('.nav-links');
        
        if (menuBtn && navLinks) {
            menuBtn.addEventListener('click', () => this.toggle());
            
            // Close menu when clicking outside (only on mobile)
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 768 && this.isOpen) {
                    if (!menuBtn.contains(e.target) && !navLinks.contains(e.target)) {
                        this.close();
                    }
                }
            });

            // Close menu when clicking on a link (only on mobile)
            navLinks.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 768) {
                        this.close();
                    }
                });
            });

            // Handle window resize
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768) {
                    // On desktop, ensure menu is visible
                    navLinks.style.display = 'flex';
                    navLinks.style.cssText = '';
                    this.isOpen = false;
                } else if (window.innerWidth <= 768 && !this.isOpen) {
                    // On mobile, hide menu if not open
                    navLinks.style.display = 'none';
                }
            });
        }
    }

    toggle() {
        const navLinks = document.querySelector('.nav-links');
        if (!navLinks) return;

        this.isOpen = !this.isOpen;
        
        if (this.isOpen) {
            navLinks.style.display = 'flex';
            navLinks.style.cssText = `
                display: flex;
                position: fixed;
                top: 70px;
                left: 0;
                right: 0;
                background: white;
                flex-direction: column;
                padding: 1rem;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                border-top: 1px solid #e5e7eb;
                z-index: 40;
            `;
        } else {
            navLinks.style.display = 'none';
        }
    }

    close() {
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            navLinks.style.display = 'none';
            this.isOpen = false;
        }
    }
}

// Utility Functions
const Utils = {
    // Format currency
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },

    // Format date
    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
    },

    // Format phone number
    formatPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return `(${match[1]}) ${match[2]}-${match[3]}`;
        }
        return phone;
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Generate random ID
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    },

    // Download file
    downloadFile(data, filename, type = 'text/plain') {
        const blob = new Blob([data], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
};

// User Interface Management for Authentication
class UserInterface {
    constructor() {
        this.init();
    }

    init() {
        // Wait for JWT auth to be available
        if (typeof window.jwtAuth !== 'undefined') {
            this.setupUserInterface();
        } else {
            // Wait for JWT auth to load
            const checkAuth = setInterval(() => {
                if (typeof window.jwtAuth !== 'undefined') {
                    clearInterval(checkAuth);
                    this.setupUserInterface();
                }
            }, 100);
        }
    }

    setupUserInterface() {
        this.addUserInfoToHeader();
        this.addLogoutButton();
        this.setupAuthStatusCheck();
    }

    addUserInfoToHeader() {
        // Find header or create one
        let header = document.querySelector('header, .header, .top-bar, .navbar');
        if (!header) {
            header = document.createElement('header');
            header.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: white;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 1000;
                padding: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                height: 70px;
            `;
            document.body.insertBefore(header, document.body.firstChild);
            
            // Add margin to body to prevent content from being hidden under header
            document.body.style.marginTop = '70px';
        }

        // Add user info section
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.style.cssText = `
            display: flex;
            align-items: center;
            gap: 1rem;
            font-size: 0.9rem;
            color: #666;
            flex: 1;
        `;

        const user = window.jwtAuth.getUser();
        if (user) {
            userInfo.innerHTML = `
                <div class="user-details">
                    <div class="user-name" style="font-weight: 600; color: #333;">${user.name || user.email}</div>
                    <div class="user-email" style="font-size: 0.8rem;">${user.email}</div>
                </div>
            `;
        }

        header.appendChild(userInfo);
    }

    addLogoutButton() {
        // Find header or create one
        let header = document.querySelector('header, .header, .top-bar, .navbar');
        if (!header) {
            header = document.querySelector('.user-info')?.parentElement;
        }

        if (header) {
            // Check if logout button already exists
            if (!header.querySelector('.logout-btn')) {
                const logoutBtn = document.createElement('button');
                logoutBtn.className = 'logout-btn';
                logoutBtn.innerHTML = `
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Cerrar Sesión</span>
                `;
                logoutBtn.style.cssText = `
                    background: #dc2626;
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.9rem;
                    transition: background 0.2s;
                    white-space: nowrap;
                    margin-left: 1rem;
                    z-index: 1001;
                `;

                logoutBtn.addEventListener('mouseenter', () => {
                    logoutBtn.style.background = '#b91c1c';
                });

                logoutBtn.addEventListener('mouseleave', () => {
                    logoutBtn.style.background = '#dc2626';
                });

                logoutBtn.addEventListener('click', () => {
                    this.handleLogout();
                });

                header.appendChild(logoutBtn);
            }
        }
    }

    async handleLogout() {
        try {
            // Show confirmation dialog
            if (!confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                return;
            }

            // Call logout endpoint
            await window.apiClient.post('/auth/logout');
            
            // Clear local storage and redirect
            window.jwtAuth.logout();
        } catch (error) {
            console.error('Error during logout:', error);
            // Force logout anyway
            window.jwtAuth.logout();
        }
    }

    setupAuthStatusCheck() {
        // Check auth status every 5 minutes
        setInterval(async () => {
            try {
                const authStatus = await window.jwtAuth.checkAuthStatus();
                if (!authStatus.authenticated) {
                    console.log('Session expired, redirecting to login...');
                    window.jwtAuth.logout();
                }
            } catch (error) {
                console.error('Error checking auth status:', error);
            }
        }, 5 * 60 * 1000); // 5 minutes

        // Check on page visibility change
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                try {
                    const authStatus = await window.jwtAuth.checkAuthStatus();
                    if (!authStatus.authenticated) {
                        window.jwtAuth.logout();
                    }
                } catch (error) {
                    console.error('Error checking auth status:', error);
                }
            }
        });
    }
}

// Initialize global instances when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize global managers
    window.notificationManager = new NotificationManager();
    window.loadingManager = new LoadingManager();
    window.mobileMenuManager = new MobileMenuManager();
    window.apiClient = new APIClient();
    window.utils = Utils;
    
    // Initialize user interface for authentication
    window.userInterface = new UserInterface();

    // Add CSS animations for notifications
    if (!document.getElementById('shared-animations')) {
        const style = document.createElement('style');
        style.id = 'shared-animations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // Handle offline/online status
    window.addEventListener('online', () => {
        window.notificationManager.show('Connection restored', 'success');
    });

    window.addEventListener('offline', () => {
        window.notificationManager.show('No internet connection', 'warning');
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Page is hidden
        } else {
            // Page is visible again
        }
    });
});

// Global utility functions for HTML compatibility
window.toggleMobileMenu = function() {
    const navLinks = document.querySelector('.nav-links');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    
    if (navLinks) {
        navLinks.classList.toggle('active');
    }
    
    if (mobileMenuBtn) {
        mobileMenuBtn.classList.toggle('active');
    }
};

window.showComingSoon = function() {
    if (window.notificationManager) {
        window.notificationManager.show('🚧 This feature is coming soon!', 'info');
    } else {
        alert('🚧 This feature is coming soon!');
    }
};

window.refreshDataWithFeedback = function() {
    const button = document.getElementById('refreshBtn');
    if (button) {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        button.disabled = true;
        
        setTimeout(() => {
            if (window.portalIntegration) {
                window.portalIntegration.loadDashboardData();
            }
            button.innerHTML = originalText;
            button.disabled = false;
        }, 1000);
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        APIClient,
        NotificationManager,
        LoadingManager,
        FormValidator,
        MobileMenuManager,
        Utils
    };
} 