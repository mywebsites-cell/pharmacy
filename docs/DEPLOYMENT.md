# Production Deployment Guide

## Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] Database migrations tested
- [ ] Secrets configured securely
- [ ] SSL certificates valid
- [ ] Backup systems tested
- [ ] Monitoring configured
- [ ] Runbooks prepared

## Deployment Steps

### 1. Prepare Environment

```bash
# Set environment variables
export ENVIRONMENT=production
export REGION=us-east-1
export DOMAIN=pharmacy.com

# Verify configurations
./scripts/validate-config.sh
```

### 2. Database Migration

```bash
# Backup current database
pg_dump pharmacy_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
kubectl exec -it postgres-0 -n pharmacy -- \
  python manage.py migrate

# Verify data integrity
kubectl exec -it postgres-0 -n pharmacy -- \
  python manage.py check_db_integrity
```

### 3. Deployment

```bash
# Build and push images
./scripts/build-and-push.sh

# Apply Kubernetes updates
kubectl apply -f kubernetes/

# Monitor rollout
kubectl rollout status deployment/backend -n pharmacy
kubectl rollout status deployment/frontend -n pharmacy

# Verify health
curl https://pharmacy.com/api/health
```

### 4. Smoke Tests

```bash
# Run basic functionality tests
./tests/smoke-test.sh

# Verify API endpoints
./tests/api-tests.sh

# Check database sync
./tests/sync-verification.sh
```

### 5. Monitoring & Alerts

- Check application logs
- Monitor error rates
- Verify performance metrics
- Confirm database health

## Rollback Procedure

```bash
# If issues detected, rollback immediately
kubectl rollout undo deployment/backend -n pharmacy
kubectl rollout undo deployment/frontend -n pharmacy

# Verify rollback
kubectl rollout status deployment/backend -n pharmacy
```

## Security Hardening

### SSL/TLS Configuration
- Use Let's Encrypt for certificates
- Enable HSTS headers
- Configure certificate auto-renewal

### Network Security
- VPC with private subnets for databases
- Security groups restricting traffic
- WAF rules for API endpoints
- DDoS protection enabled

### Secret Management
- Use AWS Secrets Manager
- Rotate credentials regularly
- Never commit secrets to repo

### Database Security
- Enable encryption at rest
- Use SSL for connections
- Restrict database user permissions
- Enable audit logging

## Monitoring Setup

### Application Monitoring
```bash
# Deploy Prometheus
kubectl apply -f monitoring/prometheus.yaml

# Deploy Grafana
kubectl apply -f monitoring/grafana.yaml

# Setup alerts
kubectl apply -f monitoring/alerts.yaml
```

### Log Aggregation
```bash
# ELK Stack deployment
kubectl apply -f logging/elasticsearch.yaml
kubectl apply -f logging/logstash.yaml
kubectl apply -f logging/kibana.yaml
```

## Performance Tuning

### Database Optimization
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM sales WHERE created_at > NOW() - INTERVAL '30 days';

-- Update statistics
ANALYZE;

-- Vacuum for cleanup
VACUUM ANALYZE;
```

### Cache Tuning
```
Redis Memory: 2GB minimum
Eviction Policy: allkeys-lru
Persistence: AOF enabled
```

### API Rate Limiting
```
Anonymous: 100 requests/hour
Authenticated: 1000 requests/hour
Admin: 5000 requests/hour
```

## Cost Optimization

- Use reserved instances for predictable workloads
- Auto-scaling for variable demand
- CDN for static assets
- Database query optimization
- Unused resource cleanup

## Maintenance Windows

- **Frequency**: Monthly (Sunday 2-3 AM)
- **Duration**: 1 hour
- **Notification**: 48 hours advance notice
- **Rollback Plan**: Prepared and tested

## Post-Deployment Tasks

1. Update documentation
2. Notify stakeholders
3. Collect feedback
4. Monitor for issues
5. Archive deployment logs
