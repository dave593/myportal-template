# 🚀 Guía Completa de Deploy a Google Cloud Run

## 📋 Prerequisitos

Antes de comenzar, asegúrate de tener:

1. **Google Cloud CLI** instalado y configurado
   ```bash
   # Instalar gcloud CLI
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   gcloud init
   ```

2. **Docker** instalado y funcionando
   ```bash
   # Verificar que Docker esté corriendo
   docker --version
   ```

3. **Acceso al proyecto** `boston-fire-escapes` en Google Cloud
   ```bash
   gcloud config set project boston-fire-escapes
   ```

4. **APIs habilitadas** en Google Cloud:
   - Cloud Run API
   - Secret Manager API
   - Cloud Build API

## 🔐 Paso 1: Configurar Secrets en Google Secret Manager

### Opción A: Script Automático (Recomendado)

```bash
cd MyPortal
./setup-cloud-run-secrets.sh
```

Este script te pedirá:
- **MySQL**: host, usuario, contraseña, nombre de base de datos
- **Google Service Account**: ruta al archivo JSON de credenciales
- **Gmail**: usuario y contraseña de aplicación
- **Zoho**: URL del webhook y secreto
- **JWT**: secretos para autenticación
- **Encriptación**: clave de encriptación

### Opción B: Manual

Si prefieres configurar los secrets manualmente:

```bash
# MySQL Secrets
echo "tu-host-mysql" | gcloud secrets create mysql-db-host --data-file=-
echo "tu-usuario-mysql" | gcloud secrets create mysql-db-user --data-file=-
echo "tu-password-mysql" | gcloud secrets create mysql-db-password --data-file=-
echo "tu-database-mysql" | gcloud secrets create mysql-db-name --data-file=-

# Google Service Account
gcloud secrets create google-service-account-key --data-file=./service-account-key.json

# Email Secrets
echo "tu-email@gmail.com" | gcloud secrets create email-gmail-user --data-file=-
echo "tu-app-password" | gcloud secrets create email-gmail-app-password --data-file=-

# Zoho Secrets
echo "https://tu-webhook-zoho.com" | gcloud secrets create zoho-webhook-url --data-file=-
echo "tu-secreto-zoho" | gcloud secrets create zoho-webhook-secret --data-file=-

# JWT Secrets
echo "tu-jwt-secret" | gcloud secrets create jwt-secret --data-file=-
echo "tu-jwt-refresh-secret" | gcloud secrets create jwt-refresh-secret --data-file=-

# Session Secret
echo "tu-session-secret" | gcloud secrets create session-secret --data-file=-

# Encryption Key
echo "tu-encryption-key" | gcloud secrets create encryption-key --data-file=-
```

## 🚀 Paso 2: Deploy a Cloud Run

### Opción A: Pipeline Completo (Recomendado)

```bash
cd MyPortal
./deploy-full-pipeline.sh
```

Este script ejecuta automáticamente:
1. Configuración de secrets (si no están configurados)
2. Build de la imagen Docker
3. Push a Google Container Registry
4. Deploy a Cloud Run con todas las variables de entorno
5. Tests de endpoints

### Opción B: Deploy Manual

```bash
cd MyPortal

# 1. Build y Push de Docker
docker build --platform linux/amd64 -t gcr.io/boston-fire-escapes/fire-escape-reports:latest .
docker push gcr.io/boston-fire-escapes/fire-escape-reports:latest

# 2. Deploy a Cloud Run
gcloud run deploy fire-escape-reports \
  --image gcr.io/boston-fire-escapes/fire-escape-reports:latest \
  --platform managed \
  --region us-central1 \
  --project boston-fire-escapes \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PORT=8080,GOOGLE_SHEETS_ID=13Fld-uJgwWuJVVxyEJoB9h7zAVbN2HlizV5XZU,GOOGLE_DRIVE_ROOT_FOLDER_ID=0ACNitKD0h5NeUk9PVA,DB_PORT=3306,EMAIL_FROM_NAME="IRIAS Ironworks" \
  --set-secrets GOOGLE_SERVICE_ACCOUNT_KEY=google-service-account-key:latest,DB_HOST=mysql-db-host:latest,DB_USER=mysql-db-user:latest,DB_PASSWORD=mysql-db-password:latest,DB_NAME=mysql-db-name:latest,GMAIL_USER=email-gmail-user:latest,GMAIL_APP_PASSWORD=email-gmail-app-password:latest,ZOHO_FLOW_WEBHOOK_URL=zoho-webhook-url:latest,ZOHO_FLOW_WEBHOOK_SECRET=zoho-webhook-secret:latest,JWT_SECRET=jwt-secret:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest,SESSION_SECRET=session-secret:latest,ENCRYPTION_KEY=encryption-key:latest \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --timeout 300 \
  --concurrency 80
```

## 🧪 Paso 3: Verificar Endpoints

### Ejecutar Tests Automáticos

```bash
cd MyPortal
./test-cloud-run-endpoints.sh
```

### Tests Manuales

```bash
# URL del servicio
SERVICE_URL="https://fire-escape-reports-628784106563.us-central1.run.app"

# Health Check
curl "$SERVICE_URL/api/health"

# Google Sheets Test
curl "$SERVICE_URL/api/test-google-sheets"

# Google Drive Test
curl -X POST "$SERVICE_URL/api/test-drive"

# System Status
curl "$SERVICE_URL/api/system-status"
```

## 📊 Variables de Entorno Configuradas

### Variables Directas
- `NODE_ENV=production`
- `PORT=8080`
- `GOOGLE_SHEETS_ID=13Fld-uJgwWuJVVxyEJoB9h7zAVbN2HlizV5XZU`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID=0ACNitKD0h5NeUk9PVA`
- `DB_PORT=3306`
- `EMAIL_FROM_NAME=IRIAS Ironworks`

### Secrets (desde Secret Manager)
- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `ZOHO_FLOW_WEBHOOK_URL`
- `ZOHO_FLOW_WEBHOOK_SECRET`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`

## 🔍 Monitoreo y Logs

### Ver Logs en Tiempo Real
```bash
gcloud logs tail --project=boston-fire-escapes --service=fire-escape-reports
```

### Ver Detalles del Servicio
```bash
gcloud run services describe fire-escape-reports --region=us-central1
```

### Ver Variables de Entorno
```bash
gcloud run services describe fire-escape-reports --region=us-central1 --format="value(spec.template.spec.containers[0].env[].name,spec.template.spec.containers[0].env[].value)"
```

## 🛠️ Troubleshooting

### Error: "No hay una cuenta activa de gcloud"
```bash
gcloud auth login
gcloud config set project boston-fire-escapes
```

### Error: "Docker build failed"
- Verificar que Docker esté corriendo
- Verificar que el Dockerfile esté en el directorio correcto
- Verificar que todas las dependencias estén en package.json

### Error: "Secret not found"
- Verificar que los secrets estén creados en Secret Manager
- Verificar que el nombre del secret coincida exactamente
- Verificar permisos del servicio en Secret Manager

### Error: "Health check failed"
- Verificar que el puerto 8080 esté expuesto en el código
- Verificar que NODE_ENV esté configurado como "production"
- Revisar logs de Cloud Run para errores específicos

### Error: "Google Sheets/Drive failed"
- Verificar que el Service Account Key esté correctamente configurado
- Verificar que el Service Account tenga permisos en Google Sheets/Drive
- Verificar que los IDs de Sheets y Drive sean correctos

## 📞 Soporte

Si encuentras problemas:

1. **Revisar logs**: `gcloud logs tail --project=boston-fire-escapes --service=fire-escape-reports`
2. **Verificar configuración**: `gcloud run services describe fire-escape-reports --region=us-central1`
3. **Ejecutar tests**: `./test-cloud-run-endpoints.sh`
4. **Revisar checklist**: `CLOUD-RUN-DEPLOYMENT-CHECKLIST.md`

## 🎉 ¡Listo!

Una vez completados todos los pasos, tu aplicación estará disponible en:
**https://fire-escape-reports-628784106563.us-central1.run.app** 