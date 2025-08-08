#!/bin/bash

echo "🔧 Configurando Secrets Faltantes"
echo "=================================="

# Variables del proyecto
PROJECT_ID="boston-fire-escapes"

# Verificar que gcloud esté configurado
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Error: No hay una cuenta activa de gcloud. Ejecuta 'gcloud auth login' primero."
    exit 1
fi

echo "🔧 Configurando secrets faltantes..."

# 1. Gmail App Password
echo "📧 Configurando Gmail App Password..."
echo "Para obtener una App Password de Gmail:"
echo "1. Ve a https://myaccount.google.com/security"
echo "2. Activa la verificación en 2 pasos si no está activada"
echo "3. Ve a 'Contraseñas de aplicación'"
echo "4. Genera una nueva contraseña para 'Mail'"
echo ""

read -s -p "GMAIL_APP_PASSWORD: " GMAIL_APP_PASSWORD
echo ""

if [ ! -z "$GMAIL_APP_PASSWORD" ]; then
    echo "$GMAIL_APP_PASSWORD" | gcloud secrets versions add email-gmail-app-password --data-file=-
    echo "✅ Gmail App Password configurado"
else
    echo "⚠️  Gmail App Password no configurado"
fi

# 2. Zoho Webhook Secret
echo ""
echo "🔗 Configurando Zoho Webhook Secret..."
read -s -p "ZOHO_FLOW_WEBHOOK_SECRET: " ZOHO_WEBHOOK_SECRET
echo ""

if [ ! -z "$ZOHO_WEBHOOK_SECRET" ]; then
    echo "$ZOHO_WEBHOOK_SECRET" | gcloud secrets versions add zoho-webhook-secret --data-file=-
    echo "✅ Zoho Webhook Secret configurado"
else
    echo "⚠️  Zoho Webhook Secret no configurado"
fi

# 3. Generar JWT Secrets automáticamente
echo ""
echo "🔐 Generando JWT Secrets automáticamente..."

# Generar JWT_SECRET (32 caracteres aleatorios)
JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-
echo "✅ JWT_SECRET generado y configurado"

# Generar JWT_REFRESH_SECRET (32 caracteres aleatorios)
JWT_REFRESH_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "$JWT_REFRESH_SECRET" | gcloud secrets versions add jwt-refresh-secret --data-file=-
echo "✅ JWT_REFRESH_SECRET generado y configurado"

# 4. Generar Session Secret automáticamente
echo ""
echo "🔄 Generando Session Secret automáticamente..."

# Generar SESSION_SECRET (32 caracteres aleatorios)
SESSION_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "$SESSION_SECRET" | gcloud secrets versions add session-secret --data-file=-
echo "✅ SESSION_SECRET generado y configurado"

# 5. Generar Encryption Key automáticamente
echo ""
echo "🔒 Generando Encryption Key automáticamente..."

# Generar ENCRYPTION_KEY (32 caracteres aleatorios)
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
echo "$ENCRYPTION_KEY" | gcloud secrets versions add encryption-key --data-file=-
echo "✅ ENCRYPTION_KEY generado y configurado"

echo ""
echo "🎉 Todos los secrets han sido configurados!"
echo ""
echo "📋 Resumen de secrets configurados:"
echo "  ✅ mysql-db-host"
echo "  ✅ mysql-db-user"
echo "  ✅ mysql-db-password"
echo "  ✅ mysql-db-name"
echo "  ✅ google-service-account-key"
echo "  ✅ email-gmail-user"
echo "  ✅ email-gmail-app-password"
echo "  ✅ zoho-webhook-url"
echo "  ✅ zoho-webhook-secret"
echo "  ✅ jwt-secret (generado automáticamente)"
echo "  ✅ jwt-refresh-secret (generado automáticamente)"
echo "  ✅ session-secret (generado automáticamente)"
echo "  ✅ encryption-key (generado automáticamente)"
echo ""
echo "🚀 Ahora puedes proceder con el deploy a Cloud Run" 