# Deploying to Render.com Free Tier

This guide walks you through deploying the XAU Copy Trade Dashboard to [Render.com](https://render.com) using their free tier.

## Render Free Tier Limits

| Resource | Limit |
|----------|-------|
| **RAM** | 512 MB |
| **CPU** | 0.25 vCPU |
| **Instance Hours** | 750 hours/month |
| **Bandwidth** | 100 GB/month |
| **Disk Storage** | Ephemeral (resets on deploy) |
| **Sleep Mode** | After 15 min inactivity |

> **Note:** The free tier is suitable for development, testing, and low-traffic applications. For production use with critical trading, consider upgrading to a paid plan.

## Prerequisites

1. A [Render.com](https://render.com) account (free)
2. Your code pushed to GitHub or GitLab
3. Telegram API credentials from [my.telegram.org](https://my.telegram.org/apps)
4. (Optional) Price API key from [Twelve Data](https://twelvedata.com/)

## Step-by-Step Deployment

### Option 1: One-Click Deploy (Recommended)

1. **Push your code to GitHub/GitLab**

   Ensure your repository contains the `render.yaml` file.

2. **Connect to Render**

   Visit [dashboard.render.com](https://dashboard.render.com) and click **New +** → **Blueprint**.

3. **Connect Your Repository**

   - Select your Git provider (GitHub/GitLab)
   - Choose your repository
   - Render will auto-detect the `render.yaml` configuration

4. **Configure Environment Variables**

   Render will prompt you to set the required environment variables marked as `sync: false`:

   | Variable | Description | Example |
   |----------|-------------|---------|
   | `TELEGRAM_API_ID` | Telegram API ID | `12345678` |
   | `TELEGRAM_API_HASH` | Telegram API Hash | `abc123def456...` |
   | `TELEGRAM_PHONE` | Your Telegram phone | `+1234567890` |
   | `TELEGRAM_CHANNEL_ID` | Channel to monitor | `-1001234567890` |
   | `PRICE_API_KEY` | Optional price API key | `your_api_key` |

5. **Deploy**

   Click **Apply** and wait for the deployment to complete (~3-5 minutes).

6. **Access Your Dashboard**

   Once deployed, visit your Render URL (e.g., `https://xau-copy-trade.onrender.com`).

### Option 2: Manual Deployment

1. **Log in to Render Dashboard**

   Go to [dashboard.render.com](https://dashboard.render.com).

2. **Create New Web Service**

   Click **New +** → **Web Service**.

3. **Connect Repository**

   - Choose your Git provider
   - Select your repository
   - Choose the main/master branch

4. **Configure Settings**

   | Setting | Value |
   |---------|-------|
   | **Name** | `xau-copy-trade` |
   | **Region** | Oregon (closest to Telegram servers) |
   | **Branch** | `main` |
   | **Root Directory** | (leave blank) |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `node dist/server/index.js` |

5. **Choose Instance Size**

   Select **Free** tier.

6. **Add Environment Variables**

   Click **Advanced** → **Add Environment Variable** and add:

   ```
   NODE_ENV=production
   PORT=3000
   NODE_OPTIONS=--max-old-space-size=400
   SESSION_FILE_PATH=/tmp/session.json
   DATABASE_PATH=/tmp/trades.db
   LOG_FILE_PATH=/tmp/app.log
   TELEGRAM_API_ID=your_api_id
   TELEGRAM_API_HASH=your_api_hash
   TELEGRAM_PHONE=+1234567890
   TELEGRAM_CHANNEL_ID=-1001234567890
   DEFAULT_LOT_SIZE=0.1
   DEFAULT_SYMBOL=XAUUSD
   LOG_LEVEL=info
   TRADING_ENABLED=true
   SL_TP_TIMEOUT_MINUTES=5
   ```

   (Add `PRICE_API_KEY` if you have one)

7. **Configure Health Check**

   - **Health Check Path:** `/health`
   - **Deploy on Push:** Enabled (optional)

8. **Create Web Service**

   Click **Create Web Service** and wait for deployment.

## Post-Deployment Configuration

### 1. Verify Deployment

Visit your Render URL and check:
- Dashboard loads correctly
- No console errors
- Health endpoint responds: `https://your-app.onrender.com/health`

### 2. Authenticate Telegram

1. Navigate to the **Logs** tab in Render dashboard
2. Look for authentication prompts
3. Follow the Telegram authentication flow via the API

### 3. Monitor Memory Usage

The health endpoint includes memory information:

```bash
curl https://your-app.onrender.com/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-31T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "heapUsed": "128 MB",
    "heapTotal": "256 MB",
    "rss": "320 MB"
  }
}
```

If memory approaches 500MB, consider:
- Reducing log levels
- Optimizing database queries
- Upgrading to a paid plan

### 4. Keep Service Awake (Optional)

Render free tier services sleep after 15 minutes of inactivity. To prevent this:

**Option A: Use an external uptime monitor**

Services like [UptimeRobot](https://uptimerobot.com/) or [Cron-Job.org](https://cron-job.org/) can ping your health endpoint every 5-10 minutes.

**Option B: Use Render's Cron Jobs (paid feature)**

Upgrade to Render's paid tier for native cron job support.

**Example UptimeRobot Setup:**

1. Create account at [UptimeRobot](https://uptimerobot.com/)
2. Add new monitor → HTTP(s)
3. URL: `https://your-app.onrender.com/health`
4. Interval: 5 minutes
5. Monitor name: `XAU Copy Trade Keep-Alive`

## Troubleshooting

### Build Fails with "npm ERR! code ENOMEM"

**Error:** Out of memory during build

**Solution:** The build process may exceed 512MB. The current configuration uses `--ignore-scripts` to skip native module rebuilds. If build still fails:

1. Check Render dashboard logs for specific error
2. Ensure `src/client/node_modules` is in `.gitignore`
3. Try clearing Render's build cache: Settings → **Clear Build Cache**

### Build Fails with "better-sqlite3" Errors

**Error:** `Module did not self-register` or `node-gyp` errors

**Solution:** This is expected on Render. The `postinstall` script handles this gracefully. If you see errors:

1. Check that build command includes `--ignore-scripts`
2. The app will still work - better-sqlite3 compiles during build automatically

### Service Crashes on Startup

**Check logs for:**
- Missing environment variables
- Database initialization errors
- Telegram authentication failures

**Solution:**
1. Go to **Logs** tab in Render dashboard
2. Filter for `error` or `fatal`
3. Add missing environment variables
4. Redeploy

### Health Check Fails

**Error:** Health check returned non-200 status

**Solution:**
1. Verify `/health` endpoint is accessible locally: `curl http://localhost:3000/health`
2. Check memory usage in health response - if >450MB, reduce `NODE_OPTIONS`
3. Ensure all services initialize correctly

### High Memory Usage

**Symptoms:** Service restarts frequently, OOM errors

**Solutions:**
1. Reduce `NODE_OPTIONS` memory limit: `--max-old-space-size=350`
2. Lower log level: `LOG_LEVEL=warn`
3. Reduce polling frequency (requires code change)
4. Upgrade to paid plan ($7/month for 512MB persistent)

### Telegram Disconnection

**Symptoms:** Not receiving signals from Telegram

**Solutions:**
1. Check session file exists: Render logs show session path
2. Verify Telegram credentials are correct
3. Check Render logs for reconnection attempts
4. Session file persists across restarts in `/tmp`

### Database Errors

**Note:** The `/tmp` directory is ephemeral. Data resets on each deployment.

**For persistent data:** Consider upgrading to use Render PostgreSQL (free tier available for 30 days) or an external database service.

### Build Succeeds but Service Won't Start

**Check:**
1. Start command is `node dist/server/index.js`
2. Build output shows `dist/server/index.js` was created
3. PORT environment variable is set to `3000`

**Solution:** Redeploy after clearing build cache

## Cost Optimization

### Staying Within Free Tier

- **750 hours/month:** One free service running 24/7 uses ~744 hours (31 days)
- **Bandwidth:** 100 GB/month is generous for this app (~3 GB/day)
- **Avoid multiple free services:** They share the 750-hour pool

### When to Upgrade

Consider upgrading to **Starter** plan ($7/month) if you need:
- Persistent disk storage
- No sleep mode
- More RAM (512MB → 2GB)
- Better CPU performance
- Native cron jobs

## Security Best Practices

1. **Never commit `.env`** - Use Render's environment variables
2. **Use strong Telegram credentials** - Rotate API keys periodically
3. **Enable private networking** - For paid plans with databases
4. **Monitor logs regularly** - Check for suspicious activity
5. **Set up alerts** - Render can notify you of crashes/errors

## Support

- **Render Docs:** [https://render.com/docs](https://render.com/docs)
- **Render Community:** [https://community.render.com](https://community.render.com)
- **This Project Issues:** [GitHub Issues](https://github.com/your-repo/xau-copy-trade/issues)

## Quick Reference

### Useful Commands

```bash
# Test health endpoint locally
curl http://localhost:3000/health

# Test health endpoint on Render
curl https://your-app.onrender.com/health

# View memory usage
curl -s https://your-app.onrender.com/health | jq .memory

# Check service status
curl -s https://your-app.onrender.com/api/status
```

### Environment Variables Summary

```bash
# Required
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_PHONE=
TELEGRAM_CHANNEL_ID=

# Render-specific
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=400
SESSION_FILE_PATH=/tmp/session.json
DATABASE_PATH=/tmp/trades.db
LOG_FILE_PATH=/tmp/app.log

# Optional
PRICE_API_KEY=
LOG_LEVEL=info
TRADING_ENABLED=true
```

---

**Last Updated:** March 2026  
**Render Free Tier Status:** Active (750 hours/month, 512MB RAM)
