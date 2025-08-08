#!/bin/bash

echo "🔄 Actualizando Credenciales de Google"
echo "======================================"

# Variables del proyecto
PROJECT_ID="boston-fire-escapes"

# Verificar que gcloud esté configurado
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Error: No hay una cuenta activa de gcloud. Ejecuta 'gcloud auth login' primero."
    exit 1
fi

echo "📁 Actualizando credenciales de Google Service Account..."
echo ""
echo "Instrucciones:"
echo "1. Asegúrate de tener el archivo JSON de la nueva cuenta de servicio"
echo "2. El archivo debe estar en el directorio actual"
echo ""

read -p "Nombre del archivo JSON (ej: service-account-key.json): " SERVICE_ACCOUNT_FILE

if [ ! -f "$SERVICE_ACCOUNT_FILE" ]; then
    echo "❌ Error: El archivo $SERVICE_ACCOUNT_FILE no existe"
    echo ""
    echo "📋 Pasos para obtener el archivo:"
    echo "1. Ve a https://console.cloud.google.com/apis/credentials"
    echo "2. Selecciona tu proyecto: boston-fire-escapes"
    echo "3. Crea una nueva cuenta de servicio"
    echo "4. Descarga la clave JSON"
    echo "5. Coloca el archivo en este directorio"
    exit 1
fi

echo ""
echo "🔄 Actualizando secret en Google Secret Manager..."

# Actualizar el secret con el nuevo archivo
gcloud secrets versions add google-service-account-key --data-file="$SERVICE_ACCOUNT_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Credenciales actualizadas exitosamente"
    echo ""
    echo "🚀 Ahora vamos a hacer un nuevo deploy para aplicar los cambios..."
    echo ""
    
    read -p "¿Quieres hacer un nuevo deploy ahora? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔄 Ejecutando deploy..."
        ./deploy-cloud-run-complete.sh
    else
        echo "📋 Para hacer el deploy manualmente, ejecuta:"
        echo "./deploy-cloud-run-complete.sh"
    fi
else
    echo "❌ Error actualizando las credenciales"
    exit 1
fi 