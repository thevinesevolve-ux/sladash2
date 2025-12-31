# BoxFort SLA Dashboard - Railway Deployment Guide

## Deploy via Railway (Recommended)

### Option A: Deploy from GitHub (Best for updates)

1. **Push to GitHub first**:
   ```bash
   unzip sla-dashboard.zip
   cd sla-dashboard
   git init
   git add .
   git commit -m "Initial commit"
   ```
   
   Then create repo on GitHub and push, or use GitHub CLI:
   ```bash
   gh repo create boxfort-sla-dashboard --private --push
   ```

2. **Go to**: https://railway.app

3. **Log in** → **New Project** → **Deploy from GitHub repo**

4. **Select** your `boxfort-sla-dashboard` repo

5. **Railway auto-detects** the config and deploys!

6. **Get your URL**: Click on the deployment → Settings → Generate Domain

---

### Option B: Deploy via Railway CLI

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login**:
   ```bash
   railway login
   ```

3. **Unzip and navigate**:
   ```bash
   unzip sla-dashboard.zip
   cd sla-dashboard
   ```

4. **Initialize and deploy**:
   ```bash
   railway init
   railway up
   ```

5. **Generate public URL**:
   ```bash
   railway domain
   ```

---

## After Deployment

Your dashboard will be live at something like:
`https://boxfort-sla-dashboard.up.railway.app`

The dashboard:
- Fetches live data from your Google Sheets
- Auto-refreshes every 5 minutes
- Works on mobile and desktop

---

## Test It

1. Add a test row to your "Daily Orders" sheet:
   | Date | Order ID | ShipHero ID | Shop Name | Ready At | Shipped At | SLA Met |
   |------|----------|-------------|-----------|----------|------------|---------|
   | 2024-12-30 | TEST-001 | xyz123 | tiny-rituals.myshopify.com | 09:00 | 14:30 | YES |

2. Wait 1-2 minutes (Google Sheets publish cache)
3. Refresh your dashboard

---

## Custom Domain (Optional)

In Railway dashboard:
1. Click your project → Settings → Domains
2. Add custom domain (e.g., `sla.boxfortcommerce.com`)
3. Add CNAME record pointing to your Railway URL

---

## Costs

Railway free tier includes:
- $5 free credit/month
- This dashboard uses minimal resources (~$1-2/month)
- Plenty for a simple dashboard like this
