# Deployment Guide

## Quick Setup

### 1. Railway Backend Setup

**Environment Variables to set in Railway:**

```
NODE_ENV=production
PORT=3000
MONGODB_URI=<your-mongodb-uri>
JWT_ACCESS_SECRET=<your-jwt-access-secret>
JWT_REFRESH_SECRET=<your-jwt-refresh-secret>
ADMIN_INVITE_CODE=ADMIN2026
CORS_ORIGIN=https://your-vercel-domain.vercel.app
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
SMTP_FROM=<smtp-from-email>
```

**Get Your Railway URL:**
- Go to your Railway dashboard
- Find your backend service
- Copy the deployment URL (e.g., `https://teammanagement-backend-production.railway.app`)

### 2. Vercel Frontend Setup

**Step 1:** In Vercel project settings, add environment variable:
```
NEXT_PUBLIC_API_URL=https://YOUR_RAILWAY_URL/api/v1
```

**Step 2:** Replace `YOUR_RAILWAY_URL` with your actual Railway backend URL

**Example:**
```
NEXT_PUBLIC_API_URL=https://teammanagement-backend-production.railway.app/api/v1
```

### 3. Configure CORS in Railway

Update your backend `.env` in Railway:
```
CORS_ORIGIN=https://your-vercel-domain.vercel.app,https://your-custom-domain.com
```

### 4. Test the Connection

1. Deploy frontend to Vercel
2. Open your Vercel URL in browser
3. Try logging in - check browser console for any errors
4. If you see "Backend unavailable", check:
   - Railway backend is running
   - CORS_ORIGIN is set correctly in Railway
   - API_URL is correct in Vercel environment variables

## Troubleshooting

**Backend unavailable error:**
- Check Railway dashboard - is the service running?
- Verify CORS_ORIGIN in Railway backend matches your Vercel domain
- Check browser Network tab for CORS errors

**MongoDB connection error:**
- Verify MONGODB_URI is correct in Railway
- Check if MongoDB instance is accessible from Railway

**Authentication issues:**
- Ensure JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are set in Railway
- They should be the same values used during development
