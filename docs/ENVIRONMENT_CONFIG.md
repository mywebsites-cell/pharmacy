# Environment Configuration

## Backend Configuration

### Development (.env)

```bash
# Django
DEBUG=True
SECRET_KEY=development-insecure-key-change-in-production
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DB_ENGINE=django.db.backends.postgresql
DB_NAME=pharmacy_db
DB_USER=pharmacy_user
DB_PASSWORD=postgres
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# Email
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend

# Storage
USE_S3=False
MEDIA_ROOT=media/
MEDIA_URL=/media/

# Elasticsearch
ELASTICSEARCH_HOST=localhost:9200
```

### Production (.env.production)

```bash
# Django
DEBUG=False
SECRET_KEY=<generate-with-secrets.token_urlsafe(50)>
ALLOWED_HOSTS=pharmacy.com,www.pharmacy.com

# Database
DB_ENGINE=django.db.backends.postgresql
DB_NAME=pharmacy_prod
DB_USER=pharmacy_prod_user
DB_PASSWORD=<strong-password>
DB_HOST=rds-instance.us-east-1.rds.amazonaws.com
DB_PORT=5432

# Redis
REDIS_URL=redis://redis-cluster.xxxxx.redis.amazonaws.com:6379/0

# Celery
CELERY_BROKER_URL=amqp://guest:guest@rabbitmq.internal:5672/

# CORS
CORS_ALLOWED_ORIGINS=https://pharmacy.com

# Email
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.aws.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=<aws-ses-user>
EMAIL_HOST_PASSWORD=<aws-ses-password>

# AWS S3 Storage
USE_S3=True
AWS_STORAGE_BUCKET_NAME=pharmacy-media-prod
AWS_S3_REGION_NAME=us-east-1

# Elasticsearch
ELASTICSEARCH_HOST=elasticsearch.aws.xxxxx.com:9200
```

## Frontend Configuration

### Development (.env.local)

```bash
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_NAME=PharmacyPro Dev
```

### Production (.env.production)

```bash
VITE_API_URL=https://api.pharmacy.com/api/v1
VITE_APP_NAME=PharmacyPro
```

## Docker Compose Configuration

```yaml
# docker-compose.override.yml for local development
version: '3.9'

services:
  backend:
    environment:
      DEBUG: 'True'
      ELASTICSEARCH_HOST: 'http://elasticsearch:9200'
```

## Kubernetes Secrets

```yaml
# Create secret from file
kubectl create secret generic pharmacy-secret \
  --from-file=.env.production \
  -n pharmacy

# Create secret from literals
kubectl create secret generic pharmacy-creds \
  --from-literal=db_password=<password> \
  --from-literal=secret_key=<key> \
  -n pharmacy
```

## SSL/TLS Configuration

### Let's Encrypt with Cert-Manager

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: pharmacy-cert
  namespace: pharmacy
spec:
  secretName: pharmacy-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - pharmacy.com
  - www.pharmacy.com
```

### Self-Signed Certificate (Development)

```bash
# Generate certificate
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem -days 365

# Create secret
kubectl create secret tls pharmacy-tls \
  --cert=cert.pem --key=key.pem -n pharmacy
```
