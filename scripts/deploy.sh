#!/bin/bash

# Deploy to production

set -e

ENVIRONMENT=${1:-production}
REGION=${2:-us-east-1}

echo "🚀 Deploying Pharmacy Management System to $ENVIRONMENT"

# Build images
echo "Building Docker images..."
docker build -f docker/Dockerfile.backend -t pharmacy-backend:latest .
docker build -f docker/Dockerfile.frontend -t pharmacy-frontend:latest .

# Push to ECR or Docker Hub
echo "Pushing images..."
# Configure your registry here
docker tag pharmacy-backend:latest <your-registry>/pharmacy-backend:latest
docker tag pharmacy-frontend:latest <your-registry>/pharmacy-frontend:latest
docker push <your-registry>/pharmacy-backend:latest
docker push <your-registry>/pharmacy-frontend:latest

# Apply Kubernetes manifests
echo "Deploying to Kubernetes..."
kubectl create namespace pharmacy || true
kubectl apply -f kubernetes/configmap-secret.yaml
kubectl apply -f kubernetes/postgres-redis.yaml
kubectl apply -f kubernetes/backend.yaml
kubectl apply -f kubernetes/celery.yaml
kubectl apply -f kubernetes/frontend.yaml

# Wait for deployment
echo "Waiting for deployment..."
kubectl rollout status deployment/backend -n pharmacy

echo "✅ Deployment complete!"
echo "Access your application at: https://<your-domain>"
