# Comercial Control CRM - Deployment Guide

## 🚀 Quick Start for Coolify

### Prerequisites
- Coolify instance configured
- Domain name ready (e.g., `comercial.geofal.com.pe`)
- GitHub repository access

## 1. Environment Configuration

### Frontend (.env.local)
```text
NEXT_PUBLIC_SUPABASE_URL=https://db.geofal.com.pe
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Main CRM (.env.local)
Update the following variable in the main `crm-geofal` project:
```text
NEXT_PUBLIC_PROGRAMACION_COMERCIAL_URL=http://localhost:8474
```

## 2. Port Configuration
The project is configured to run on port **8474**.

## 3. Database Fixes (Important)
To allow data creation and automated calculations, execute the content of `supabase_fix.sql` in the Supabase SQL Editor. This will:
1. Enable `anon` role to INSERT/UPDATE/SELECT for local/iframe testing.
2. Add a trigger to automatically calculate `dias_atraso_lab` whenever dates change.

### Coolify Configuration Steps

1. **Create New Resource**
   - Type: Docker Compose
   - Repository: Connect your GitHub repo
   - Branch: `main`

2. **Domain Configuration**
   - Set your domain: `comercial.geofal.com.pe`
   - Enable HTTPS/SSL (Coolify handles this automatically)

3. **Environment Variables**
   - Add the variables listed above
   - Make sure to use the production Supabase credentials

4. **Build & Deploy**
   - Coolify will automatically detect `docker-compose.yml`
   - Build process uses multi-stage Dockerfile for optimization
   - Container exposes port 3000

### Verification

After deployment:
- ✅ Check domain resolves: `https://comercial.geofal.com.pe`
- ✅ Verify Supabase connection works
- ✅ Test CRUD operations on programacion table
- ✅ Verify Excel export functionality

### Troubleshooting

**Issue**: Container fails to start
- Check Coolify logs for build errors
- Verify environment variables are set correctly

**Issue**: Database connection fails
- Verify Supabase URL and anon key
- Check network connectivity from Coolify to Supabase

**Issue**: Domain not resolving
- Verify DNS settings point to Coolify server
- Check Coolify domain configuration

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev -- -p 3001

# Build for production
npm run build

# Test production build locally
npm start
```

## Docker Local Test

```bash
# Build image
docker compose build

# Run container
docker compose up

# Access at http://localhost:3000
```

## Tech Stack

- **Framework**: Next.js 16.1.6
- **Runtime**: React 19.2.3
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Docker + Coolify
- **Port**: 3000
