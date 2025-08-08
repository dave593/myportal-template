#!/bin/bash

# Script para configurar rápidamente el sistema para un nuevo cliente
# Uso: ./setup-new-client.sh "Nombre del Negocio" "dominio.com"

set -e

if [ $# -lt 2 ]; then
    echo "Uso: $0 \"Nombre del Negocio\" \"dominio.com\""
    echo "Ejemplo: $0 \"Mi Empresa\" \"miempresa.com\""
    exit 1
fi

BUSINESS_NAME="$1"
DOMAIN="$2"
PROJECT_NAME=$(echo "$BUSINESS_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

echo "🚀 Configurando sistema para: $BUSINESS_NAME"
echo "🌐 Dominio: $DOMAIN"
echo "📁 Nombre del proyecto: $PROJECT_NAME"

# Crear archivo de configuración específico del cliente
cat > client-config.json << EOF
{
  "business": {
    "name": "$BUSINESS_NAME",
    "domain": "$DOMAIN",
    "email": {
      "from": "info@$DOMAIN",
      "fromName": "$BUSINESS_NAME",
      "notifications": "notifications@$DOMAIN"
    },
    "logo": "logo.png",
    "primaryColor": "#059669",
    "secondaryColor": "#047857"
  },
  "google": {
    "projectId": "$PROJECT_NAME",
    "sheetsId": "TU_GOOGLE_SHEETS_ID",
    "driveFolderId": "TU_GOOGLE_DRIVE_FOLDER_ID"
  },
  "database": {
    "host": "TU_DB_HOST",
    "name": "${PROJECT_NAME}_db",
    "user": "${PROJECT_NAME}_user"
  },
  "services": {
    "email": {
      "service": "gmail",
      "user": "info@$DOMAIN"
    },
    "zoho": {
      "webhookUrl": "TU_ZOHO_WEBHOOK_URL"
    }
  },
  "features": {
    "customerOnboarding": true,
    "reports": true,
    "googleSheets": true,
    "googleDrive": true,
    "emailNotifications": true,
    "zohoIntegration": true
  }
}
EOF

# Actualizar package.json
sed -i.bak "s/\"name\": \"fire-escape-report-system\"/\"name\": \"$PROJECT_NAME-system\"/" package.json
sed -i.bak "s/\"description\": \"Fire Escape Reports System\"/\"description\": \"$BUSINESS_NAME Management System\"/" package.json

# Crear archivo .env template
cat > .env.template << EOF
# Configuración del Negocio
NODE_ENV=production
PORT=8080

# Google Services
GOOGLE_SHEETS_ID=TU_GOOGLE_SHEETS_ID
GOOGLE_DRIVE_ROOT_FOLDER_ID=TU_GOOGLE_DRIVE_FOLDER_ID
GOOGLE_SERVICE_ACCOUNT_KEY=TU_SERVICE_ACCOUNT_KEY_JSON

# Base de Datos MySQL
DB_HOST=TU_DB_HOST
DB_USER=${PROJECT_NAME}_user
DB_PASSWORD=TU_DB_PASSWORD
DB_NAME=${PROJECT_NAME}_db
DB_PORT=3306

# Email Configuration
GMAIL_USER=info@$DOMAIN
GMAIL_APP_PASSWORD=TU_GMAIL_APP_PASSWORD
EMAIL_FROM_NAME="$BUSINESS_NAME"
NOTIFICATION_EMAIL=notifications@$DOMAIN

# Zoho Integration
ZOHO_FLOW_WEBHOOK_URL=TU_ZOHO_WEBHOOK_URL
ZOHO_FLOW_WEBHOOK_SECRET=TU_ZOHO_SECRET

# Security
JWT_SECRET=TU_JWT_SECRET
JWT_REFRESH_SECRET=TU_JWT_REFRESH_SECRET
SESSION_SECRET=TU_SESSION_SECRET
ENCRYPTION_KEY=TU_ENCRYPTION_KEY
EOF

# Crear script de despliegue específico
cat > deploy-$PROJECT_NAME.sh << EOF
#!/bin/bash

# Script de despliegue para $BUSINESS_NAME
echo "🚀 Desplegando $BUSINESS_NAME a Google Cloud Run..."

# Configurar proyecto de Google Cloud
gcloud config set project $PROJECT_NAME

# Construir y desplegar
gcloud run deploy $PROJECT_NAME-system \\
  --source . \\
  --platform managed \\
  --region us-central1 \\
  --allow-unauthenticated \\
  --memory 2Gi \\
  --cpu 2 \\
  --max-instances 10 \\
  --set-env-vars NODE_ENV=production

echo "✅ $BUSINESS_NAME desplegado exitosamente!"
echo "🌐 URL: https://$PROJECT_NAME-system-$(gcloud config get-value project).us-central1.run.app"
EOF

chmod +x deploy-$PROJECT_NAME.sh

# Crear README específico del cliente
cat > README-$PROJECT_NAME.md << EOF
# $BUSINESS_NAME - Sistema de Gestión

## Configuración Inicial

1. **Configurar Google Cloud Project:**
   \`\`\`bash
   gcloud config set project $PROJECT_NAME
   \`\`\`

2. **Configurar variables de entorno:**
   - Copiar \`.env.template\` a \`.env\`
   - Completar todas las variables

3. **Configurar Google Services:**
   - Crear Google Sheets con ID: \`TU_GOOGLE_SHEETS_ID\`
   - Crear Google Drive folder con ID: \`TU_GOOGLE_DRIVE_FOLDER_ID\`
   - Configurar Service Account

4. **Configurar Base de Datos:**
   - Crear instancia MySQL en Google Cloud SQL
   - Usar credenciales del archivo \`client-config.json\`

5. **Desplegar:**
   \`\`\`bash
   ./deploy-$PROJECT_NAME.sh
   \`\`\`

## Características

- ✅ Gestión de clientes
- ✅ Notificaciones por email
- ✅ Integración con Google Sheets
- ✅ Integración con Google Drive
- ✅ Integración con Zoho
- ✅ Generación de reportes
- ✅ Sistema de autenticación

## URLs Importantes

- **Sistema:** https://$PROJECT_NAME-system-$(gcloud config get-value project).us-central1.run.app
- **Google Sheets:** https://docs.google.com/spreadsheets/d/TU_GOOGLE_SHEETS_ID
- **Google Drive:** https://drive.google.com/drive/folders/TU_GOOGLE_DRIVE_FOLDER_ID
EOF

echo "✅ Configuración completada para $BUSINESS_NAME"
echo ""
echo "📋 Archivos creados:"
echo "   - client-config.json (configuración específica)"
echo "   - .env.template (variables de entorno)"
echo "   - deploy-$PROJECT_NAME.sh (script de despliegue)"
echo "   - README-$PROJECT_NAME.md (documentación)"
echo ""
echo "🔧 Próximos pasos:"
echo "   1. Editar client-config.json con los IDs reales"
echo "   2. Copiar .env.template a .env y completar variables"
echo "   3. Configurar Google Cloud Project"
echo "   4. Ejecutar ./deploy-$PROJECT_NAME.sh"
echo ""
echo "🎯 ¡Listo para personalizar y desplegar!" 