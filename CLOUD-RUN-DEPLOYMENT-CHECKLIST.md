# Cloud Run Deployment Checklist

## ✅ Variables de Entorno Requeridas

### Google Services
- [ ] `GOOGLE_SHEETS_ID` = "13Fld-uJgwWuJVVxyEJoB9h7zAVbN2HlizV5XZU"
- [ ] `GOOGLE_DRIVE_ROOT_FOLDER_ID` = "0ACNitKD0h5NeUk9PVA"
- [ ] `GOOGLE_SERVICE_ACCOUNT_KEY` (via Secret Manager)

### MySQL Database
- [ ] `DB_HOST` (via Secret Manager)
- [ ] `DB_USER` (via Secret Manager)
- [ ] `DB_PASSWORD` (via Secret Manager)
- [ ] `DB_NAME` (via Secret Manager)
- [ ] `DB_PORT` = "3306"

### Email Configuration
- [ ] `GMAIL_USER` (via Secret Manager)
- [ ] `GMAIL_APP_PASSWORD` (via Secret Manager)
- [ ] `EMAIL_FROM_NAME` = "IRIAS Ironworks"

### Zoho Integration
- [ ] `ZOHO_FLOW_WEBHOOK_URL` (via Secret Manager)
- [ ] `ZOHO_FLOW_WEBHOOK_SECRET` (via Secret Manager)

### Security
- [ ] `JWT_SECRET` (via Secret Manager)
- [ ] `JWT_REFRESH_SECRET` (via Secret Manager)
- [ ] `SESSION_SECRET` (via Secret Manager)
- [ ] `ENCRYPTION_KEY` (via Secret Manager)

### Environment
- [ ] `NODE_ENV` = "production"
- [ ] `PORT` = "8080"

## 🔧 Secrets en Google Secret Manager

### mysql-secrets
- `db-host`
- `db-user`
- `db-password`
- `db-name`

### google-secrets
- `service-account-key`

### email-secrets
- `gmail-user`
- `gmail-app-password`

### zoho-secrets
- `webhook-url`
- `webhook-secret`

### jwt-secrets
- `jwt-secret`
- `jwt-refresh-secret`

### session-secrets
- `session-secret`

### encryption-secrets
- `encryption-key`

## 🧪 Endpoints de Prueba

### Health Check
```bash
curl https://fire-escape-reports-628784106563.us-central1.run.app/api/health
```

### Google Sheets Test
```bash
curl https://fire-escape-reports-628784106563.us-central1.run.app/api/test-google-sheets
```

### Google Drive Test
```bash
curl -X POST https://fire-escape-reports-628784106563.us-central1.run.app/api/test-drive
```

### System Status
```bash
curl https://fire-escape-reports-628784106563.us-central1.run.app/api/system-status
```

## 🚀 Comandos de Despliegue

### 1. Build y Push de Docker
```bash
docker build --platform linux/amd64 -t gcr.io/boston-fire-escapes/fire-escape-reports:latest .
docker push gcr.io/boston-fire-escapes/fire-escape-reports:latest
```

### 2. Deploy a Cloud Run
```bash
gcloud run deploy fire-escape-reports \
  --image gcr.io/boston-fire-escapes/fire-escape-reports:latest \
  --platform managed \
  --region us-central1 \
  --project boston-fire-escapes \
  --allow-unauthenticated
```

### 3. Verificar Despliegue
```bash
./test-cloud-run-endpoints.sh
```

## 📋 Checklist de Verificación

- [ ] Todos los secrets están configurados en Secret Manager
- [ ] Variables de entorno están configuradas en Cloud Run
- [ ] Docker image se construye correctamente
- [ ] Despliegue exitoso en Cloud Run
- [ ] Endpoint /api/health responde correctamente
- [ ] Google Sheets integration funciona
- [ ] Google Drive integration funciona
- [ ] MySQL connection funciona (si aplica)
- [ ] Email service funciona
- [ ] Zoho integration funciona
- [ ] JWT authentication funciona
- [ ] Frontend se carga correctamente

## 🔍 Troubleshooting

### Si /api/health falla:
- Verificar que el puerto 8080 esté expuesto
- Verificar que NODE_ENV esté configurado
- Revisar logs de Cloud Run

### Si Google Sheets falla:
- Verificar GOOGLE_SERVICE_ACCOUNT_KEY en Secret Manager
- Verificar GOOGLE_SHEETS_ID
- Verificar permisos del Service Account

### Si Google Drive falla:
- Verificar GOOGLE_SERVICE_ACCOUNT_KEY en Secret Manager
- Verificar GOOGLE_DRIVE_ROOT_FOLDER_ID
- Verificar permisos del Service Account

### Si MySQL falla:
- Verificar credenciales en mysql-secrets
- Verificar que la IP de Cloud Run tenga acceso a la base de datos
- Verificar que la base de datos esté activa 