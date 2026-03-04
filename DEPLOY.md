# Horizon18 Deployment Guide

Horizon18 is a Python web app with **zero external dependencies** for the web server. It uses Python's built-in `http.server` module, making deployment straightforward.

This guide walks you through deploying to **Render** (recommended), plus alternatives.

---

## Section 1: Quick Deploy to Render

Render is the simplest choice for Horizon18: free tier available, Python-native, no Docker required, automatic HTTPS.

### Prerequisites

1. **GitHub account** (free): https://github.com/signup
2. **Render account** (free): https://render.com/
3. **Git installed** on your machine

### Step 1: Push Your Code to GitHub

If you haven't already, create a GitHub repository and push your Horizon18 code:

```bash
cd HS_Grad_Financial_Sim
git init
git add .
git commit -m "Initial commit: Horizon18"
git remote add origin https://github.com/YOUR_USERNAME/horizon18.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 2: Connect Render to Your GitHub Repo

1. Log in to [render.com](https://render.com/)
2. Click **Dashboard** → **New** → **Web Service**
3. Select **Deploy an existing repository** → **Connect account**
4. Authorize Render to access your GitHub repositories
5. Search for and select your `horizon18` repository
6. Click **Connect**

### Step 3: Configure the Web Service

Fill in the following fields:

| Field | Value |
|-------|-------|
| **Name** | `horizon18` (or any name you like) |
| **Region** | `Oregon` (or nearest to your users) |
| **Branch** | `main` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `python backend/main.py` |
| **Plan** | `Free` |

Leave other fields at defaults.

### Step 4: Environment Variables

Render automatically sets the `PORT` environment variable. The app will read it automatically.

**However**, you need to update your `backend/main.py` to use the PORT environment variable for production:

Find this line (around line 30):
```python
PORT = 8000
```

Change it to:
```python
PORT = int(os.environ.get("PORT", 8000))
```

This allows the app to use Render's PORT (usually 10000+) in production while defaulting to 8000 for local development.

### Step 5: Deploy

1. Click the **Create Web Service** button
2. Render will build and deploy automatically
3. Watch the deployment logs—it should take 1–2 minutes
4. Once live, you'll see a URL like `https://horizon18.onrender.com`
5. Click the URL to open your app in the browser

**That's it!** Your app is live.

### Redeploying

Any time you push to the `main` branch, Render will automatically rebuild and redeploy.

```bash
git add .
git commit -m "Update simulation logic"
git push origin main
```

---

## Section 2: Production Checklist

Before considering your deployment production-ready, verify:

### HTTPS (Automatic)
✅ Render automatically provisions HTTPS on all deployed services. You get a free `*.onrender.com` certificate.

### PORT Environment Variable
✅ Update `backend/main.py` line 30 as shown above.

```python
PORT = int(os.environ.get("PORT", 8000))
```

Without this, the app will try to bind to port 8000 on Render's container, which won't work.

### CORS Headers
✅ The app currently allows all origins (`Access-Control-Allow-Origin: *`). This is fine for now, but in production, you may want to restrict it:

```python
# In backend/main.py, modify _send_cors_headers():
def _send_cors_headers(self):
    allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*")
    self.send_header("Access-Control-Allow-Origin", allowed_origins)
    # ... rest of method
```

Then set an environment variable on Render:
- **Key**: `ALLOWED_ORIGINS`
- **Value**: `https://yourdom ain.com`

### Health Check Endpoint (Recommended)
✅ Add a lightweight health check endpoint so load balancers can verify the app is running.

In `backend/main.py`, add this to the `do_GET` method (around line 86):

```python
if path == "/api/health":
    self._send_json(200, {"status": "ok"})
    return
```

Then on Render's dashboard:
1. Go to your service settings
2. Under **Deployment** → **Health Check Path**, set: `/api/health`
3. Save

### Logging
✅ The app logs requests to stdout. Render captures these automatically and displays them in the **Logs** tab on the dashboard. No configuration needed.

Example request log:
```
  [02/Mar/2026 12:34:56] POST /api/simulate HTTP/1.1" 200 -
```

### Rate Limiting (Future Consideration)
Consider adding rate limiting for the `/api/simulate` endpoint if the app becomes popular:

```python
# Simple token bucket rate limiter
from time import time

request_times = {}

def check_rate_limit(client_ip, max_requests=10, window=60):
    """Allow max_requests per window (seconds)."""
    now = time()
    if client_ip not in request_times:
        request_times[client_ip] = []

    # Remove old requests outside the window
    request_times[client_ip] = [t for t in request_times[client_ip] if now - t < window]

    if len(request_times[client_ip]) >= max_requests:
        return False

    request_times[client_ip].append(now)
    return True
```

Then in `do_POST`:
```python
client_ip = self.client_address[0]
if not check_rate_limit(client_ip):
    self._send_json(429, {"error": "Too many requests. Please wait."})
    return
```

---

## Section 3: Custom Domain

### Prerequisites
- A domain name (e.g., `horizon18.com` from Namecheap, Cloudflare, etc.)
- Access to your domain's DNS settings

### Step 1: Add Domain to Render

1. On your Render service page, go to **Settings** → **Custom Domain**
2. Enter your domain (e.g., `horizon18.com`)
3. Render will display DNS instructions

### Step 2: Update DNS Records

In your domain registrar (Namecheap, Cloudflare, GoDaddy, etc.):

1. Find the DNS management section
2. Add a **CNAME record**:
   - **Name**: `horizon18` (or `www` for a subdomain)
   - **Target**: Render's provided address (e.g., `cname.onrender.com`)
   - **TTL**: 3600 (or default)

3. Wait 5–30 minutes for DNS propagation
4. Return to Render—it will auto-detect the CNAME and enable HTTPS

Your app is now accessible at `https://horizon18.com` and `https://www.horizon18.com` with automatic TLS certificates.

---

## Section 4: Cost Estimate

### Render Free Tier
- **Cost**: $0/month
- **Uptime**: Service spins down after 15 minutes of inactivity
- **Cold start**: ~30 seconds when first request comes in after spindown
- **Use case**: Perfect for demos, prototypes, or low-traffic personal projects

### Render Starter Plan
- **Cost**: $7/month
- **Uptime**: Always-on, no spindown
- **Cold start**: Negligible (<100ms)
- **Use case**: Production apps with consistent users

### Paid Upgrades
- **Standard Plan**: $21/month (2 CPU, 0.5 GB RAM)
- **Pro Plan**: $115/month (4 CPU, 1 GB RAM)

For Horizon18 (stateless, lightweight), the free tier is sufficient for development and testing. If you have a real user base, upgrade to Starter ($7/month) for reliability.

### Domain
- **Render-provided**: `horizon18.onrender.com` (free, included)
- **Custom domain**: ~$12/year from Namecheap or Cloudflare
- **Optional HTTPS**: Free on Render (included with custom domains)

### Example Monthly Cost (Small Production Deployment)
- Render Starter: $7
- Domain: $1/month (prorated from ~$12/year)
- **Total**: ~$8/month

---

## Section 5: Alternative Platforms

If you prefer alternatives to Render, here are other options:

### Railway
- **Cost**: $5 free tier credit/month, then $0.50/hour usage
- **Pros**: Simple UI, generous free tier, fast deployments
- **Cons**: Slightly more expensive than Render if you run all month
- **Setup**: Similar to Render, requires `Procfile` (included)
- **Website**: https://railway.app/

### Fly.io
- **Cost**: $0.15/hour (free tier with 3 shared-cpu-1x instances)
- **Pros**: Global edge deployment, very fast
- **Cons**: Requires Docker knowledge
- **Setup**: Need to create a Dockerfile
- **Website**: https://fly.io/

### Heroku (Classic)
- **Cost**: Was free, now $7+/month
- **Pros**: Long-standing, familiar to many developers
- **Cons**: Expensive compared to Render/Railway
- **Setup**: Requires `Procfile` (included)
- **Website**: https://www.heroku.com/

### Why Render Was Chosen
1. **Python-native**: No Docker required
2. **Free tier**: Full-featured, with predictable spindown behavior
3. **Simplicity**: GitHub integration is one click
4. **HTTPS included**: Automatic cert provisioning
5. **Scaling**: Easy upgrade path if traffic grows

---

## Section 6: Local Testing Before Deploy

Always test your app locally before pushing to production.

### Quick Start
```bash
cd HS_Grad_Financial_Sim
python backend/main.py
```

Then open http://localhost:8000 in your browser.

### Run Tests
```bash
python3 run_tests.py             # 96 engine tests
python3 backend/test_api.py      # 9 API tests
```

Verify all 105 tests pass before deploying.

### Test the API Directly
```bash
# Get options (dropdowns, ranges)
curl http://localhost:8000/api/options

# Run a simulation (multi-instance format)
curl -X POST http://localhost:8000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "path_instances": [
      {"instance_id": "college_0", "path_type": "college", "school_type": "public_in_state", "major": "stem"}
    ],
    "region": "midwest",
    "living_at_home": true,
    "years_at_home": 2,
    "family_savings": 0,
    "projection_years": 32
  }'
```

### Pre-Deployment Checklist
- [ ] All tests pass: `python3 run_tests.py && python3 backend/test_api.py`
- [ ] App starts locally: `python backend/main.py`
- [ ] Frontend loads at http://localhost:8000
- [ ] Can submit a simulation and get results
- [ ] `backend/main.py` line 30 updated to use `PORT` environment variable
- [ ] Code is committed and pushed to GitHub
- [ ] No secrets (API keys, passwords) in the code

### If Something Breaks After Deployment
1. Check the Render **Logs** tab for error messages
2. Check **Events** tab for build failures
3. Verify environment variables are set correctly
4. Roll back by redeploying from an earlier commit:
   ```bash
   git log --oneline  # Find the good commit
   git revert <commit-hash>
   git push origin main
   ```

---

## Troubleshooting

### "Port is already in use"
Your app is trying to bind to port 8000 but something else is using it. Kill the process or use a different port locally:

```bash
PORT=9000 python backend/main.py
```

### "Module not found"
Ensure you're running from the project root and your Python path includes the project directory. The app does this automatically, but verify:

```bash
python -c "import sys; sys.path.insert(0, '.'); from backend.api import handle_simulate; print('OK')"
```

### "CORS error" in the browser console
The frontend is on a different domain/port than the API. Check that your browser can reach the API endpoint:

```bash
curl http://localhost:8000/api/options
```

If that returns JSON, the issue is likely a browser cache problem—try clearing cookies and reloading.

### "Cold start timeout" on Render
On the free tier, your app may take 30+ seconds to respond after inactivity. This is normal. The endpoint should still work. If it times out, upgrade to Starter ($7/month) for always-on service.

### Deploy fails with "No module named..."
The `requirements.txt` file is missing or not at the root of your repository. Render needs it. Create an empty one if the web app has no dependencies:

```
# Horizon18 web app has no external dependencies
```

---

## Next Steps

1. **Local test**: `python backend/main.py` and verify everything works
2. **GitHub**: Push your code to a repository
3. **Render**: Connect Render to your GitHub repo (5 min setup)
4. **Live**: Your app is running at `https://horizon18.onrender.com` within 2 minutes

Need help?
- Render docs: https://render.com/docs
- Python http.server: https://docs.python.org/3/library/http.server.html
