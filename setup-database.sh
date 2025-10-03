#!/bin/bash

echo "🚀 Setting up AI Parking System Database..."
echo

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    echo "Please install Docker from https://www.docker.com/get-started"
    exit 1
fi

echo "✅ Docker found"
echo

# Start PostgreSQL and Redis using Docker Compose
echo "🐳 Starting PostgreSQL and Redis containers..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Check if PostgreSQL is running
docker-compose -f docker-compose.dev.yml ps postgres

echo
echo "✅ Database setup complete!"
echo
echo "📋 Database Connection Details:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: ai_parking_system"
echo "   Username: postgres"
echo "   Password: password"
echo
echo "🚀 You can now start the backend server with: npm run dev"
echo
