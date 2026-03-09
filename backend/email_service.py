"""
Lightweight email service using Resend API.

Setup:
  1. Sign up at https://resend.com (free = 100 emails/day)
  2. Create an API key
  3. Add RESEND_API_KEY to your Railway environment variables
  4. (Optional) Verify a custom domain, or use the free onboarding@resend.dev sender

If RESEND_API_KEY is not set, emails are silently skipped (no crashes).
"""

import os
import logging
import requests

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "Horizon18 <onboarding@resend.dev>")
SITE_URL = os.environ.get("SITE_URL", "https://horizon18.app")


def _send(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend. Returns True on success, False otherwise."""
    if not RESEND_API_KEY:
        logger.info("RESEND_API_KEY not set — skipping email to %s", to)
        return False

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": FROM_EMAIL,
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            logger.info("Email sent to %s: %s", to, subject)
            return True
        else:
            logger.warning("Resend API error %s: %s", resp.status_code, resp.text)
            return False
    except Exception as e:
        logger.warning("Email send failed: %s", e)
        return False


def send_welcome_email(to: str, display_name: str) -> bool:
    """Send a welcome email to a newly registered user."""
    name = display_name or to.split("@")[0]
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="font-size: 24px; color: #1a1a2e; margin-bottom: 8px;">Welcome to Horizon18!</h1>
      <p style="font-size: 15px; color: #444; line-height: 1.6;">
        Hey {name},
      </p>
      <p style="font-size: 15px; color: #444; line-height: 1.6;">
        Thanks for creating an account. You can now save simulations, access them
        from your dashboard, and share them with friends or family.
      </p>
      <p style="font-size: 15px; color: #444; line-height: 1.6;">
        <strong>Here's how to get started:</strong>
      </p>
      <ol style="font-size: 15px; color: #444; line-height: 1.8; padding-left: 20px;">
        <li>Take the quiz — tell us which paths you want to compare</li>
        <li>Adjust the sliders to match your situation</li>
        <li>Save the simulation to revisit later</li>
      </ol>
      <div style="text-align: center; margin: 28px 0;">
        <a href="{SITE_URL}" style="background: #6366f1; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Start Comparing Paths
        </a>
      </div>
      <p style="font-size: 13px; color: #888; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px;">
        Horizon18 — See your financial future before you choose your path.
      </p>
    </div>
    """
    return _send(to, "Welcome to Horizon18!", html)
