# 🚀 Sistema de Gestión de Negocios - Plantilla Reutilizable

Este es un sistema completo de gestión empresarial que puede ser fácilmente adaptado para cualquier negocio. Incluye gestión de clientes, notificaciones por email, integración con Google Services, y más.

## 🎯 Características Principales

### ✅ **Gestión de Clientes**
- Formulario de onboarding de clientes
- Dashboard de gestión
- Seguimiento de estado de clientes
- Historial completo de interacciones

### ✅ **Integraciones**
- **Google Sheets** - Sincronización automática de datos
- **Google Drive** - Almacenamiento de documentos
- **Gmail** - Notificaciones automáticas
- **Zoho** - Integración con CRM
- **MySQL** - Base de datos principal

### ✅ **Funcionalidades Avanzadas**
- Sistema de autenticación con Google OAuth
- Generación de reportes PDF
- Notificaciones por email automáticas
- Control de acceso granular
- API REST completa

## 🚀 Configuración Rápida para Nuevo Cliente

### 1. **Ejecutar Script de Configuración**
```bash
./setup-new-client.sh "Nombre del Negocio" "dominio.com"
```

**Ejemplo:**
```bash
./setup-new-client.sh "Mi Empresa" "miempresa.com"
```

### 2. **Configurar Variables de Entorno**
```bash
cp .env.template .env
# Editar .env con las credenciales reales
```

### 3. **Configurar Google Services**
- Crear proyecto en Google Cloud Console
- Habilitar APIs: Sheets, Drive, Gmail
- Crear Service Account
- Configurar Google Sheets y Drive

### 4. **Configurar Base de Datos**
- Crear instancia MySQL en Google Cloud SQL
- Ejecutar script de creación de tablas

### 5. **Desplegar**
```bash
./deploy-[nombre-proyecto].sh
```

## 📁 Estructura del Proyecto

```
MyPortal/
├── 📄 Archivos Principales
│   ├── server.js              # Servidor principal
│   ├── database.js            # Gestión de base de datos
│   ├── email-service.js       # Servicio de email
│   └── package.json           # Dependencias
│
├── 🌐 Frontend
│   ├── customer-onboarding.html    # Formulario de clientes
│   ├── dashboard-clientes.html     # Dashboard principal
│   ├── business-portal.html        # Portal de negocios
│   └── shared-styles.css           # Estilos compartidos
│
├── 🔧 Configuración
│   ├── config-template.json        # Plantilla de configuración
│   ├── setup-new-client.sh         # Script de configuración
│   └── .env.template               # Variables de entorno
│
├── 📊 Servicios
│   ├── google-sheets-integration.js
│   ├── google-drive-service.js
│   ├── zoho-webhook-service.js
│   └── sync-service.js
│
├── 🔐 Seguridad
│   ├── middleware/
│   ├── routes/
│   └── access-control-system.js
│
└── 📚 Documentación
    ├── README-MASTER.md
    ├── DEPLOY-INSTRUCTIONS.md
    └── CLOUD-RUN-DEPLOYMENT-CHECKLIST.md
```

## 🔧 Personalización

### **Cambios Rápidos para Nuevo Cliente:**

1. **Logo y Colores**
   - Reemplazar `logo.svg` con el logo del cliente
   - Actualizar colores en `shared-styles.css`

2. **Texto y Contenido**
   - Buscar y reemplazar "IRIAS Ironworks" con el nombre del negocio
   - Actualizar textos en archivos HTML

3. **Configuración de Email**
   - Actualizar direcciones de email en `client-config.json`
   - Configurar Gmail App Password

4. **Google Services**
   - Crear nuevos Google Sheets y Drive folders
   - Actualizar IDs en configuración

## 📋 Checklist de Despliegue

### **Preparación**
- [ ] Ejecutar `setup-new-client.sh`
- [ ] Configurar Google Cloud Project
- [ ] Crear Service Account
- [ ] Configurar Google Sheets y Drive
- [ ] Crear instancia MySQL

### **Configuración**
- [ ] Completar `.env` con credenciales reales
- [ ] Actualizar `client-config.json`
- [ ] Configurar dominios autorizados
- [ ] Probar integraciones

### **Despliegue**
- [ ] Ejecutar script de despliegue
- [ ] Verificar funcionamiento
- [ ] Configurar dominio personalizado (opcional)
- [ ] Documentar URLs y credenciales

## 🛠️ Comandos Útiles

### **Desarrollo Local**
```bash
npm install
npm start
```

### **Pruebas**
```bash
# Probar endpoints
curl https://[url]/api/health

# Probar email
curl -X POST https://[url]/api/test-email
```

### **Despliegue**
```bash
# Despliegue manual
gcloud run deploy [nombre-servicio] --source . --region us-central1

# Despliegue con script
./deploy-[nombre-proyecto].sh
```

## 🔍 Troubleshooting

### **Problemas Comunes:**

1. **Email no se envía**
   - Verificar Gmail App Password
   - Revisar configuración de SMTP

2. **Google Sheets no sincroniza**
   - Verificar permisos del Service Account
   - Revisar ID del spreadsheet

3. **Base de datos no conecta**
   - Verificar credenciales MySQL
   - Revisar configuración de red

4. **Autenticación falla**
   - Verificar OAuth credentials
   - Revisar dominios autorizados

## 📞 Soporte

Para problemas o preguntas:
1. Revisar logs en Google Cloud Console
2. Verificar configuración en `client-config.json`
3. Probar endpoints individuales
4. Revisar documentación específica del cliente

## 🎯 Próximos Pasos

1. **Para nuevo cliente:**
   - Ejecutar `./setup-new-client.sh`
   - Seguir checklist de configuración
   - Personalizar según necesidades

2. **Para mantenimiento:**
   - Revisar logs regularmente
   - Actualizar dependencias
   - Monitorear uso de recursos

---

**¡Listo para ser reutilizado en cualquier negocio! 🚀** 