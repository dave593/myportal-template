#!/bin/bash

echo "🔐 Configurando Secrets en Google Secret Manager"
echo "================================================"

# Variables del proyecto
PROJECT_ID="boston-fire-escapes"
REGION="us-central1"

# Verificar que gcloud esté configurado
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Error: No hay una cuenta activa de gcloud. Ejecuta 'gcloud auth login' primero."
    exit 1
fi

# Verificar que el proyecto esté configurado
if ! gcloud config get-value project 2>/dev/null | grep -q "$PROJECT_ID"; then
    echo "🔧 Configurando proyecto: $PROJECT_ID"
    gcloud config set project $PROJECT_ID
fi

echo "📋 Configurando secrets..."

# 1. MySQL Secrets
echo "🗄️  Configurando mysql-secrets..."
echo "Ingresa los valores para MySQL (presiona Enter para usar valores por defecto):"

read -p "DB_HOST (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "DB_USER (default: root): " DB_USER
DB_USER=${DB_USER:-root}

read -s -p "DB_PASSWORD: " DB_PASSWORD
echo ""

read -p "DB_NAME (default: fire_escapes): " DB_NAME
DB_NAME=${DB_NAME:-fire_escapes}

# Crear secrets de MySQL
echo "$DB_HOST" | gcloud secrets create mysql-db-host --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$DB_HOST" | gcloud secrets versions add mysql-db-host --data-file=-
echo "$DB_USER" | gcloud secrets create mysql-db-user --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$DB_USER" | gcloud secrets versions add mysql-db-user --data-file=-
echo "$DB_PASSWORD" | gcloud secrets create mysql-db-password --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$DB_PASSWORD" | gcloud secrets versions add mysql-db-password --data-file=-
echo "$DB_NAME" | gcloud secrets create mysql-db-name --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$DB_NAME" | gcloud secrets versions add mysql-db-name --data-file=-

# 2. Google Service Account Key
echo "🔑 Configurando google-secrets..."
read -p "Ruta al archivo de Service Account Key (default: ./service-account-key.json): " SERVICE_ACCOUNT_FILE
SERVICE_ACCOUNT_FILE=${SERVICE_ACCOUNT_FILE:-./service-account-key.json}

if [ -f "$SERVICE_ACCOUNT_FILE" ]; then
    gcloud secrets create google-service-account-key --data-file="$SERVICE_ACCOUNT_FILE" --replication-policy="automatic" 2>/dev/null || gcloud secrets versions add google-service-account-key --data-file="$SERVICE_ACCOUNT_FILE"
    echo "✅ Service Account Key configurado"
else
    echo "⚠️  Archivo de Service Account Key no encontrado. Deberás configurarlo manualmente."
fi

# 3. Email Secrets
echo "📧 Configurando email-secrets..."
read -p "GMAIL_USER: " GMAIL_USER
read -s -p "GMAIL_APP_PASSWORD: " GMAIL_APP_PASSWORD
echo ""

echo "$GMAIL_USER" | gcloud secrets create email-gmail-user --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$GMAIL_USER" | gcloud secrets versions add email-gmail-user --data-file=-
echo "$GMAIL_APP_PASSWORD" | gcloud secrets create email-gmail-app-password --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$GMAIL_APP_PASSWORD" | gcloud secrets versions add email-gmail-app-password --data-file=-

# 4. Zoho Secrets
echo "🔗 Configurando zoho-secrets..."
read -p "ZOHO_FLOW_WEBHOOK_URL: " ZOHO_WEBHOOK_URL
read -s -p "ZOHO_FLOW_WEBHOOK_SECRET: " ZOHO_WEBHOOK_SECRET
echo ""

echo "$ZOHO_WEBHOOK_URL" | gcloud secrets create zoho-webhook-url --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$ZOHO_WEBHOOK_URL" | gcloud secrets versions add zoho-webhook-url --data-file=-
echo "$ZOHO_WEBHOOK_SECRET" | gcloud secrets create zoho-webhook-secret --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$ZOHO_WEBHOOK_SECRET" | gcloud secrets versions add zoho-webhook-secret --data-file=-

# 5. JWT Secrets
echo "🔐 Configurando jwt-secrets..."
read -s -p "JWT_SECRET: " JWT_SECRET
echo ""
read -s -p "JWT_REFRESH_SECRET: " JWT_REFRESH_SECRET
echo ""

echo "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-
echo "$JWT_REFRESH_SECRET" | gcloud secrets create jwt-refresh-secret --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$JWT_REFRESH_SECRET" | gcloud secrets versions add jwt-refresh-secret --data-file=-

# 6. Session Secret
echo "🔄 Configurando session-secrets..."
read -s -p "SESSION_SECRET: " SESSION_SECRET
echo ""

echo "$SESSION_SECRET" | gcloud secrets create session-secret --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$SESSION_SECRET" | gcloud secrets versions add session-secret --data-file=-

# 7. Encryption Key
echo "🔒 Configurando encryption-secrets..."
read -s -p "ENCRYPTION_KEY: " ENCRYPTION_KEY
echo ""

echo "$ENCRYPTION_KEY" | gcloud secrets create encryption-key --data-file=- --replication-policy="automatic" 2>/dev/null || echo "$ENCRYPTION_KEY" | gcloud secrets versions add encryption-key --data-file=-

echo ""
echo "✅ Todos los secrets han sido configurados en Google Secret Manager"
echo ""
echo "📋 Resumen de secrets creados:"
echo "  - mysql-db-host"
echo "  - mysql-db-user"
echo "  - mysql-db-password"
echo "  - mysql-db-name"
echo "  - google-service-account-key"
echo "  - email-gmail-user"
echo "  - email-gmail-app-password"
echo "  - zoho-webhook-url"
echo "  - zoho-webhook-secret"
echo "  - jwt-secret"
echo "  - jwt-refresh-secret"
echo "  - session-secret"
echo "  - encryption-key"
echo ""
echo "🚀 Ahora puedes proceder con el deploy a Cloud Run" 