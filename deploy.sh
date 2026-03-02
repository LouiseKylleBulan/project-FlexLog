#!/bin/bash
echo "🚀 Starting FlexLog Deployment..."

# Stop and remove existing containers
docker-compose down

# Build and start services in detached mode
docker-compose up --build -d

echo "✅ Deployment complete. Access FlexLog at http://localhost"