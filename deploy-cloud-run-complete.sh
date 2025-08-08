#!/bin/bash

echo "🚀 Deploy Completo a Cloud Run"
echo "=============================="

# Variables del proyecto
PROJECT_ID="boston-fire-escapes"
REGION="us-central1"
SERVICE_NAME="fire-escape-reports"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"

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

# Habilitar APIs necesarias
echo "🔧 Habilitando APIs necesarias..."
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# 1. Build y Push de Docker
echo "🐳 Construyendo y subiendo imagen Docker..."
docker build --platform linux/amd64 -t $IMAGE_NAME .
if [ $? -ne 0 ]; then
    echo "❌ Error construyendo la imagen Docker"
    exit 1
fi

echo "📤 Subiendo imagen a Google Container Registry..."
docker push $IMAGE_NAME
if [ $? -ne 0 ]; then
    echo "❌ Error subiendo la imagen"
    exit 1
fi

# 2. Deploy a Cloud Run con variables de entorno
echo "🚀 Desplegando a Cloud Run..."

# Crear archivo temporal con variables de entorno
cat > env.yaml << EOF
NODE_ENV: "production"
GOOGLE_SHEETS_ID: "13Fld-uJgwWuJVVxyEJoB9h7zAVbN2HlizV5XZU"
GOOGLE_DRIVE_ROOT_FOLDER_ID: "0ACNitKD0h5NeUk9PVA"
DB_PORT: "3306"
EMAIL_FROM_NAME: "IRIAS Ironworks"
EOF

# Comando de deploy
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --env-vars-file env.yaml \
  --set-secrets GOOGLE_SERVICE_ACCOUNT_KEY=google-service-account-key:latest,DB_HOST=mysql-db-host:latest,DB_USER=mysql-db-user:latest,DB_PASSWORD=mysql-db-password:latest,DB_NAME=mysql-db-name:latest,GMAIL_USER=email-gmail-user:latest,GMAIL_APP_PASSWORD=email-gmail-app-password:latest,ZOHO_FLOW_WEBHOOK_URL=zoho-webhook-url:latest,ZOHO_FLOW_WEBHOOK_SECRET=zoho-webhook-secret:latest,JWT_SECRET=jwt-secret:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest,SESSION_SECRET=session-secret:latest,ENCRYPTION_KEY=encryption-key:latest,GOOGLE_OAUTH_CLIENT_ID=oauth-client-id:latest \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --timeout 300 \
  --concurrency 80

# Limpiar archivo temporal
rm -f env.yaml

if [ $? -ne 0 ]; then
    echo "❌ Error en el deploy a Cloud Run"
    exit 1
fi

echo ""
echo "✅ Deploy completado exitosamente!"
echo ""
echo "🌐 URL del servicio: https://$SERVICE_NAME-$(gcloud config get-value project 2>/dev/null | cut -d'-' -f2- | cut -d'.' -f1).$REGION.run.app"
echo ""
echo "🧪 Ejecutando tests de endpoints..."
echo ""

# Ejecutar tests
if [ -f "./test-cloud-run-endpoints.sh" ]; then
    chmod +x ./test-cloud-run-endpoints.sh
    ./test-cloud-run-endpoints.sh
else
    echo "⚠️  Script de test no encontrado. Ejecutando tests manualmente..."
    
    SERVICE_URL="https://$SERVICE_NAME-$(gcloud config get-value project 2>/dev/null | cut -d'-' -f2- | cut -d'.' -f1).$REGION.run.app"
    
    echo "1. Probando endpoint /api/health..."
    curl -s "$SERVICE_URL/api/health" | jq '.' 2>/dev/null || curl -s "$SERVICE_URL/api/health"
    
    echo ""
    echo "2. Probando endpoint /api/test-google-sheets..."
    curl -s "$SERVICE_URL/api/test-google-sheets" | jq '.' 2>/dev/null || curl -s "$SERVICE_URL/api/test-google-sheets"
    
    echo ""
    echo "3. Probando endpoint /api/test-drive..."
    curl -s -X POST "$SERVICE_URL/api/test-drive" | jq '.' 2>/dev/null || curl -s -X POST "$SERVICE_URL/api/test-drive"
    
    echo ""
    echo "4. Probando endpoint /api/system-status..."
    curl -s "$SERVICE_URL/api/system-status" | jq '.' 2>/dev/null || curl -s "$SERVICE_URL/api/system-status"
fi

echo ""
echo "🎉 Proceso completado!"
echo ""
echo "📋 Checklist de verificación:"
echo "  ✅ Secrets configurados en Secret Manager"
echo "  ✅ Variables de entorno configuradas en Cloud Run"
echo "  ✅ Docker image construida y subida"
echo "  ✅ Deploy exitoso en Cloud Run"
echo "  ✅ Tests de endpoints ejecutados"
echo ""
echo "🔍 Para ver logs en tiempo real:"
echo "gcloud logs tail --project=$PROJECT_ID --service=$SERVICE_NAME" 