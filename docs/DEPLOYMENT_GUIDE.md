# Deployment Guide

## Prerequisites

- Node.js 18+ LTS
- PostgreSQL 14+
- Docker (optional)
- PM2 (for process management)
- Nginx (for reverse proxy)

## Production Deployment

### 1. Server Setup

#### Option A: Linux (Ubuntu 20.04+)

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2
```

#### Option B: Docker

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    depends_on:
      - postgres

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### 2. Database Setup

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE mmorpg_forum;

# Create user
CREATE USER forum_user WITH PASSWORD 'strong_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE mmorpg_forum TO forum_user;

# Exit psql
\q
```

Or use Docker:

```bash
docker-compose up postgres
```

### 3. Backend Deployment

```bash
cd backend

# Copy environment file
cp .env.example .env

# Edit .env with production values
nano .env

# Install dependencies
npm install

# Run database migrations
npm run migrate

# Start with PM2
pm2 start src/server.js --name "mmorpg-forum-api" --env production

# Save PM2 configuration
pm2 save
pm2 startup

# Check status
pm2 status
```

### 4. Frontend Deployment

```bash
cd frontend

# Copy environment file
cp .env.example .env

# Edit .env with production URLs
nano .env

# Install dependencies
npm install

# Build for production
npm run build

# Build Docker image if using Docker
docker build -t mmorpg-forum-frontend .
```

### 5. Nginx Configuration

Create `/etc/nginx/sites-available/mmorpg-forum`:

```nginx
upstream backend {
    server localhost:5000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend static files
    location / {
        root /var/www/mmorpg-forum/frontend/dist;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/mmorpg-forum /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx

sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com
```

### 7. Environment Variables

**Backend (.env)**
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mmorpg_forum
DB_USER=forum_user
DB_PASSWORD=strong_password

PORT=5000
NODE_ENV=production

JWT_SECRET=your_very_long_and_secure_secret_key_here
JWT_REFRESH_SECRET=your_very_long_and_secure_refresh_secret_key_here
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

FRONTEND_URL=https://yourdomain.com
SOCKET_IO_CORS=true

# Email configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

**Frontend (.env)**
```
VITE_API_BASE_URL=https://yourdomain.com/api
VITE_SOCKET_IO_URL=https://yourdomain.com
```

### 8. Backup Strategy

```bash
# Create backup script: backup.sh
#!/bin/bash
BACKUP_DIR="/backups/mmorpg-forum"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U forum_user mmorpg_forum > $BACKUP_DIR/db_$DATE.sql

# Compress
gzip $BACKUP_DIR/db_$DATE.sql

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

# Optional: Upload to S3
# aws s3 cp $BACKUP_DIR/db_$DATE.sql.gz s3://your-bucket/backups/
```

Schedule with cron:

```bash
0 2 * * * /path/to/backup.sh
```

### 9. Monitoring and Logging

```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs mmorpg-forum-api

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Scaling Strategy

1. **Horizontal Scaling**: Run multiple backend instances behind load balancer
2. **Database Replication**: Set up PostgreSQL replication for read-heavy scenarios
3. **Caching Layer**: Add Redis for session and data caching
4. **CDN**: Serve static frontend assets through CDN
5. **Database Optimization**: Add indexes, optimize queries

## Monitoring Tools

- **PM2**: Process management and monitoring
- **New Relic** or **Datadog**: Application performance monitoring
- **Prometheus**: Metrics collection
- **ELK Stack**: Centralized logging

## Troubleshooting

### Port Already in Use
```bash
lsof -i :5000
kill -9 <PID>
```

### Database Connection Issues
```bash
psql -h localhost -U forum_user -d mmorpg_forum
```

### Check PM2 Status
```bash
pm2 status
pm2 logs
```
