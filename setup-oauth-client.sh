#!/bin/bash

echo "🔐 Configurando OAuth 2.0 Client ID"
echo "==================================="

# Variables del proyecto
PROJECT_ID="boston-fire-escapes"

# Verificar que gcloud esté configurado
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Error: No hay una cuenta activa de gcloud. Ejecuta 'gcloud auth login' primero."
    exit 1
fi

echo "📁 Configurando OAuth 2.0 Client ID..."
echo ""
echo "Instrucciones:"
echo "1. Asegúrate de tener el archivo JSON del OAuth 2.0 Client ID"
echo "2. El archivo debe estar en el directorio actual"
echo "3. Este archivo contiene el client_id y client_secret para autenticación de usuarios"
echo ""

read -p "Nombre del archivo JSON del OAuth 2.0 Client ID (ej: oauth-client.json): " OAUTH_CLIENT_FILE

if [ ! -f "$OAUTH_CLIENT_FILE" ]; then
    echo "❌ Error: El archivo $OAUTH_CLIENT_FILE no existe"
    echo ""
    echo "📋 Pasos para obtener el archivo OAuth 2.0:"
    echo "1. Ve a https://console.cloud.google.com/apis/credentials"
    echo "2. Selecciona tu proyecto: boston-fire-escapes"
    echo "3. Crea un nuevo 'ID de cliente de OAuth 2.0'"
    echo "4. Tipo: Aplicación web"
    echo "5. URLs autorizadas:"
    echo "   - https://portal.iriasironworks.com"
    echo "   - https://fire-escape-reports-628784106563.us-central1.run.app"
    echo "6. URIs de redirección:"
    echo "   - https://portal.iriasironworks.com/auth/google/callback"
    echo "   - https://fire-escape-reports-628784106563.us-central1.run.app/auth/google/callback"
    echo "7. Descarga el archivo JSON"
    echo "8. Coloca el archivo en este directorio"
    exit 1
fi

echo ""
echo "🔄 Configurando OAuth 2.0 Client ID en Secret Manager..."

# Crear o actualizar el secret
gcloud secrets create oauth-client-id --data-file="$OAUTH_CLIENT_FILE" --replication-policy="automatic" 2>/dev/null || gcloud secrets versions add oauth-client-id --data-file="$OAUTH_CLIENT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ OAuth 2.0 Client ID configurado exitosamente"
    echo ""
    
    # Extraer información del archivo para mostrar
    echo "📋 Información del OAuth Client:"
    CLIENT_ID=$(jq -r '.web.client_id' "$OAUTH_CLIENT_FILE" 2>/dev/null || jq -r '.client_id' "$OAUTH_CLIENT_FILE" 2>/dev/null)
    CLIENT_SECRET=$(jq -r '.web.client_secret' "$OAUTH_CLIENT_FILE" 2>/dev/null || jq -r '.client_secret' "$OAUTH_CLIENT_FILE" 2>/dev/null)
    
    if [ "$CLIENT_ID" != "null" ] && [ "$CLIENT_ID" != "" ]; then
        echo "  ✅ Client ID: ${CLIENT_ID:0:20}..."
        echo "  ✅ Client Secret: ${CLIENT_SECRET:0:10}..."
    else
        echo "  ⚠️  No se pudo extraer Client ID/Secret del archivo"
    fi
    
    echo ""
    echo "🚀 Ahora necesitas actualizar el deploy para incluir estas credenciales..."
    echo ""
    
    read -p "¿Quieres actualizar el deploy ahora? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Actualizando deploy con OAuth credentials..."
        ./deploy-cloud-run-complete.sh
    else
        echo "📋 Para actualizar el deploy manualmente, ejecuta:"
        echo "./deploy-cloud-run-complete.sh"
    fi
else
    echo "❌ Error configurando OAuth 2.0 Client ID"
    exit 1
fi 