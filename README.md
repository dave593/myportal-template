# My Portal - Professional Business Management System

A comprehensive, mobile-first business management portal designed for fire escape inspection companies and iron works services. Built with modern web technologies and optimized for non-technical users.

## 🚀 Features

### Core Functionality
- **Client Management Dashboard** - Complete client lifecycle management
- **Customer Onboarding** - Streamlined client registration process
- **Fire Escape Reports** - Professional PDF report generation
- **Business Portal** - Main dashboard with company overview
- **Mobile-First Design** - Optimized for all devices and screen sizes

### Technical Features
- **Shared Component System** - Consistent design across all portals
- **Real-time API Integration** - Connected frontend and backend
- **Professional UI/UX** - Intuitive interface for non-technical users
- **Responsive Design** - Works perfectly on mobile, tablet, and desktop
- **Error Handling** - Robust error management and user feedback
- **Loading States** - Professional loading indicators
- **Form Validation** - Real-time validation with helpful error messages

## 🏗️ Architecture

### Frontend Structure
```
MyPortal/
├── shared-styles.css          # Shared CSS for all portals
├── shared-scripts.js          # Shared JavaScript components
├── business-portal.html       # Main business dashboard
├── dashboard-clientes.html    # Client management dashboard
├── customer-onboarding.html   # Client registration form
├── fire_escapes_rp.html       # PDF report generator
└── server.js                  # Backend server
```

### Shared Components
- **APIClient** - Enhanced HTTP client with retry logic and timeout handling
- **NotificationManager** - Professional notification system
- **LoadingManager** - Loading state management
- **FormValidator** - Real-time form validation
- **MobileMenuManager** - Mobile navigation handling
- **Utils** - Utility functions for formatting and common operations

## 🎨 Design System

### Color Palette
- **Primary Red**: #dc2626 (Brand color)
- **Success Green**: #059669
- **Warning Orange**: #d97706
- **Info Blue**: #3b82f6
- **Neutral Grays**: Professional gray scale

### Typography
- **Font Family**: Inter (Google Fonts)
- **Responsive Sizing**: CSS custom properties for consistent scaling
- **Accessibility**: High contrast support and keyboard navigation

### Mobile-First Approach
- **Breakpoints**: 640px, 768px, 1024px
- **Touch-Friendly**: Minimum 48px touch targets
- **Responsive Grid**: Flexible layouts that adapt to screen size
- **Mobile Navigation**: Collapsible menu for mobile devices

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd MyPortal

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the development server
npm start
```

### Environment Variables

⚠️ **IMPORTANTE - SEGURIDAD**: 
- **NUNCA** subas archivos `.env` o archivos de configuración con secretos al repositorio
- **Solo** usa variables de entorno en producción (Cloud Run)
- Para desarrollo local, usa un archivo `.env` (que debe estar en `.gitignore`)

#### Variables Requeridas
```env
# Configuración del servidor
PORT=8080
NODE_ENV=development

# Google Services
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_SHEETS_ID=your_sheets_id
GOOGLE_SERVICE_ACCOUNT_KEY=your_service_account_key_json
GOOGLE_DRIVE_ROOT_FOLDER_ID=your_drive_folder_id

# Autenticación
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret

# Base de datos
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# Email
GMAIL_USER=your_gmail_user
GMAIL_APP_PASSWORD=your_gmail_app_password

# Zoho
ZOHO_FLOW_WEBHOOK_URL=your_webhook_url
ZOHO_FLOW_WEBHOOK_SECRET=your_webhook_secret

# Seguridad
CORS_ORIGINS=*
ENCRYPTION_KEY=your_32_character_encryption_key
```

#### Configuración de Desarrollo Local
```bash
# Crear archivo .env para desarrollo local
cp .env.example .env
# Editar .env con tus valores de desarrollo
```

#### Configuración de Producción (Cloud Run)
En producción, todas las variables se configuran a través de Google Secret Manager y variables de entorno de Cloud Run.

## 📱 Mobile Experience

### Optimizations
- **Touch Gestures**: Swipe-friendly interfaces
- **Large Buttons**: Minimum 48px touch targets
- **Readable Text**: Optimized font sizes for mobile
- **Fast Loading**: Optimized assets and lazy loading
- **Offline Support**: Basic offline functionality

### User Experience
- **Intuitive Navigation**: Clear, simple navigation structure
- **Visual Feedback**: Immediate response to user actions
- **Error Prevention**: Smart form validation and helpful messages
- **Progressive Enhancement**: Works on all devices, enhanced on modern browsers

## 🔌 API Integration

### Endpoints
- `GET /api/clients` - Retrieve all clients
- `POST /api/clients` - Create new client
- `PUT /api/client-status` - Update client status
- `GET /api/statistics` - Get business statistics
- `POST /api/save-report` - Save inspection report

### Data Flow
1. **Frontend** makes API requests using shared APIClient
2. **Backend** processes requests and interacts with Google Sheets
3. **Response** is formatted and returned to frontend
4. **UI** updates with new data and shows appropriate feedback

## 🎯 User Experience Goals

### For Non-Technical Users
- **Simple Interface**: Clean, uncluttered design
- **Clear Actions**: Obvious next steps and call-to-action buttons
- **Helpful Feedback**: Success/error messages in plain English
- **Consistent Design**: Same look and feel across all pages
- **Mobile Friendly**: Works great on phones and tablets

### Professional Features
- **Data Validation**: Prevents errors before they happen
- **Auto-save**: Saves work automatically
- **Search & Filter**: Easy to find specific information
- **Export Options**: Generate professional PDF reports
- **Backup & Sync**: Data automatically backed up to cloud

## 🚀 Deployment

### Cloud Run Deployment
```bash
# Build and deploy to Google Cloud Run
./deploy-cloud-run.sh
```

### Environment Setup
1. Configure Google Cloud project
2. Set up Google Sheets integration
3. Configure environment variables
4. Deploy using provided script

## 📊 Performance

### Optimizations
- **Minified Assets**: CSS and JS are optimized for production
- **Image Optimization**: Compressed images for faster loading
- **Caching**: Browser caching for static assets
- **Lazy Loading**: Load content as needed
- **CDN Ready**: Can be served from CDN for global performance

### Metrics
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

## 🔒 Security

### ⚠️ **ADVERTENCIAS DE SEGURIDAD CRÍTICAS**

#### **NUNCA hagas esto:**
- ❌ Subir archivos `.env` al repositorio
- ❌ Subir archivos de claves privadas (JSON de Google Service Account)
- ❌ Subir archivos de configuración con secretos (YAML/JSON con passwords)
- ❌ Hardcodear secretos en el código
- ❌ Usar secretos de desarrollo en producción

#### **SIEMPRE haz esto:**
- ✅ Usar variables de entorno en producción
- ✅ Usar Google Secret Manager para secretos en Cloud Run
- ✅ Mantener archivos `.env` en `.gitignore`
- ✅ Rotar secretos regularmente
- ✅ Usar diferentes secretos para desarrollo y producción

### Features de Seguridad
- **Input Validation**: All user inputs are validated
- **XSS Protection**: Content Security Policy headers
- **CSRF Protection**: Cross-site request forgery prevention
- **Secure Headers**: Security headers configured
- **HTTPS Only**: All communications encrypted
- **Rate Limiting**: Protection against brute force attacks
- **JWT Authentication**: Secure token-based authentication
- **Data Encryption**: Sensitive data encrypted at rest
- **Audit Logging**: All security events logged

## 🧪 Testing

### Manual Testing Checklist
- [ ] Mobile responsiveness on various devices
- [ ] Form validation and error handling
- [ ] API integration and error states
- [ ] PDF generation functionality
- [ ] Navigation and routing
- [ ] Loading states and user feedback

## 📈 Future Enhancements

### Planned Features
- **Real-time Notifications**: Push notifications for updates
- **Advanced Analytics**: Business intelligence dashboard
- **Multi-language Support**: Internationalization
- **Advanced Search**: Full-text search capabilities
- **API Documentation**: Swagger/OpenAPI documentation
- **Automated Testing**: Unit and integration tests

## 🤝 Contributing

### Development Guidelines
1. Follow the established design system
2. Use shared components when possible
3. Test on mobile devices
4. Ensure accessibility compliance
5. Document new features

### Code Standards
- **CSS**: Use CSS custom properties for consistency
- **JavaScript**: Use ES6+ features and async/await
- **HTML**: Semantic HTML with proper accessibility
- **Performance**: Optimize for mobile and slow connections

## 📞 Support

For technical support or questions about the system:
- **Email**: support@myportal.com
- **Documentation**: See inline code comments
- **Issues**: Use GitHub issues for bug reports

---

**Built with ❤️ for professional business management** 