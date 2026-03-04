# Horizon18 Deployment Guide

*From your computer to the internet in one afternoon — March 2026*

---

## Overview

This guide walks you through deploying Horizon18 as a live website. It assumes zero prior experience. The recommended approach uses **Railway** (a beginner-friendly hosting platform) and takes about **1-2 hours total**.

### What You Need

- A computer with internet access
- A credit/debit card (for domain + hosting)
- A [GitHub account](https://github.com) (free)
- The Horizon18 project folder on your computer

### Cost Summary

| Item | Cost | Frequency |
|------|------|-----------|
| Domain (horizon18.com) | $10-15 | Per year |
| Railway hosting (Hobby) | $5/month | Monthly |
| **Total year 1** | **~$75** | **Per year** |

> For friends-and-family traffic (under 100 visitors/month), Railway's $5/month Hobby plan is more than enough.

### Time Estimate

| Step | Time |
|------|------|
| 1. Buy domain | 10 min |
| 2. Set up GitHub | 15 min |
| 3. Deploy on Railway | 20 min |
| 4. Connect domain | 15 min |
| 5. Wait for DNS | 10-60 min (mostly waiting) |
| **Total** | **~1-2 hours** |

---

## Step 1: Buy Your Domain

A domain is your website's address (like horizon18.com).

1. Go to [namecheap.com](https://www.namecheap.com)
2. Type "horizon18.com" in the search bar and hit Search
3. If it shows **Available**: Add to cart and purchase ($10-13/year)
4. If it shows **Taken**: Try alternatives like horizon18.org, gethorizon18.com, or horizon18.app

### During checkout

- **WhoisGuard**: Keep it ON (free). Hides your personal info from public records.
- **Auto-Renew**: Turn ON so your domain doesn't expire unexpectedly.
- **Skip all add-ons** (SSL, email hosting, etc.) — you won't need them.

> Keep your Namecheap dashboard tab open — you'll need it in Step 4.

---

## Step 2: Upload Your Code to GitHub

GitHub is where your code lives online. Railway pulls your code from GitHub to run it.

### Create a GitHub account (if you don't have one)

1. Go to [github.com](https://github.com) and click Sign Up
2. Use your email, create a password, pick a username
3. Verify your email address

### Install GitHub Desktop

GitHub Desktop is the easiest way to upload code without using the command line.

1. Download from [desktop.github.com](https://desktop.github.com)
2. Install it and sign in with your GitHub account

### Upload your Horizon18 project

1. In GitHub Desktop, click **File → Add Local Repository**
2. Navigate to your Horizon18 project folder and select it
3. If it says "this is not a git repository," click **Create a Repository** instead:
   - **Name**: horizon18
   - **Local Path**: Your Horizon18 folder
   - Keep other defaults, click Create Repository
4. Click **Publish Repository** in the top bar
5. Uncheck "Keep this code private" if you want it public (either is fine)
6. Click **Publish Repository**

> Your code is now on GitHub! Verify by going to github.com/YOUR-USERNAME/horizon18 in your browser.

---

## Step 3: Deploy on Railway

Railway runs your Python app in the cloud and handles all the server setup for you.

### Create a Railway account

1. Go to [railway.com](https://railway.com)
2. Click "Login" and choose "Login with GitHub"
3. Authorize Railway to access your GitHub account
4. Subscribe to the **Hobby plan ($5/month)** — Railway requires this to deploy apps

### Create your project

1. From your Railway dashboard, click **New Project**
2. Select **Deploy from GitHub Repo**
3. Find and select your **horizon18** repository
4. Railway will automatically detect it's a Python app and start deploying

### Configure the start command

Click on your service, go to **Settings**, and set:

```
Start Command:  python backend/main.py
```

Then add this environment variable in the **Variables** tab:

```
PORT = 8080
```

> **Good news:** Your backend/main.py already reads PORT from environment variables and binds to 0.0.0.0, so no code changes are needed!

### Generate a public URL

1. In your Railway project, click on your service
2. Go to **Settings → Networking**
3. Click **Generate Domain**
4. Railway will give you a URL like `horizon18-production.up.railway.app`
5. Visit this URL in your browser to verify your app is running!

---

## Step 4: Connect Your Domain

Now you'll point horizon18.com to your Railway app.

### Add your domain in Railway

1. In Railway, go to your service → **Settings → Networking**
2. Under "Custom Domain," type `horizon18.com` and click Add
3. Railway will show you DNS records you need to add (usually a CNAME record)
4. Copy the CNAME target value (something like `cname.railway.app`)

### Update DNS in Namecheap

1. Go to your [Namecheap dashboard](https://www.namecheap.com/myaccount/) and click Manage next to your domain
2. Click the **Advanced DNS** tab
3. Delete any existing records (there may be default parking records)
4. Add a new record:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| CNAME | @ | cname.railway.app | Automatic |

> If Namecheap doesn't allow a CNAME on @ (root domain), add an ALIAS or URL redirect record instead, or use "www" and set up a redirect from the root. Railway's docs have specific instructions for each registrar.

### Add www subdomain (optional but recommended)

Add another CNAME record:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| CNAME | www | cname.railway.app | Automatic |

---

## Step 5: Verify Everything Works

1. Wait 10-60 minutes for DNS to propagate (this is normal)
2. Visit **horizon18.com** in your browser
3. You should see the Horizon18 landing page
4. Click through the quiz to make sure everything works
5. Try it on your phone too!

> DNS propagation can sometimes take up to 24 hours in rare cases. If it's not working after an hour, double-check your DNS records in Namecheap match exactly what Railway told you to add.

### SSL/HTTPS (automatic)

Railway automatically provides a free SSL certificate, so your site will work with https://horizon18.com. No extra configuration needed.

---

## Making Updates (The Ongoing Workflow)

This is the part you'll use regularly. Here's how updates work:

### The simple loop

```
Edit files locally → Commit in GitHub Desktop → Push → Railway auto-deploys
```

That's it. Every time you push to GitHub, Railway sees the change and redeploys your site within 1-2 minutes. Here are the detailed steps:

1. Edit your code on your computer (in the Horizon18 project folder)
2. Open GitHub Desktop — you'll see your changes listed automatically
3. Type a short description of what you changed (e.g., "Fix chart label typo")
4. Click **Commit to main**
5. Click **Push origin** in the top bar
6. Railway auto-deploys. Done.

### Working with me (Claude)

When we work together in Cowork, I edit the files directly in your project folder. After we finish a round of changes:

1. Open GitHub Desktop — all my changes will show up automatically
2. Review them if you want (you'll see exactly what changed)
3. Commit + Push → site updates in ~2 minutes

You don't need to maintain a separate database or manually upload anything. GitHub IS your central database of files, and Railway watches it for changes.

---

## Troubleshooting

### "Application error" or blank page
- Check Railway logs: click your service, then the "Logs" tab
- Make sure your start command is exactly: `python backend/main.py`
- Make sure the PORT environment variable is set to 8080

### "This site can't be reached"
- DNS hasn't propagated yet. Wait 30-60 minutes and try again.
- Double-check your CNAME records in Namecheap match Railway's instructions exactly

### Changes not showing up
- Make sure you committed AND pushed in GitHub Desktop
- Check your Railway dashboard for the latest deploy status
- Hard refresh your browser (Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac)

---

## Ongoing Costs

| Item | Cost |
|------|------|
| Railway Hobby plan | $5/month |
| Domain renewal | ~$1/month ($10-13/year) |
| **Total** | **~$6/month** |

---

## Deployment Checklist

- [ ] Buy domain (horizon18.com or alternative)
- [ ] Create GitHub account
- [ ] Install GitHub Desktop
- [ ] Upload project to GitHub
- [ ] Create Railway account + Hobby plan
- [ ] Deploy from GitHub on Railway
- [ ] Set start command and PORT variable
- [ ] Generate Railway domain and test
- [ ] Add custom domain in Railway
- [ ] Add DNS records in Namecheap
- [ ] Wait for DNS and verify site loads
- [ ] Test on mobile
- [ ] Share with friends and family!
