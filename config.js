// ============================================================
// CONFIGURATION — AppliFix Repairs
// ============================================================
// HOW TO SET UP SUPABASE (one-time, ~5 minutes):
//
//  1. Go to https://supabase.com → Create a free account
//  2. Click "New Project" → give it a name → wait ~2 min
//  3. Go to: Project Settings → API
//  4. Copy "Project URL"    → paste into supabaseUrl below
//  5. Copy "anon public"    → paste into supabaseAnonKey below
//  6. Copy "service_role"   → paste into supabaseServiceKey below
//  7. Go to SQL Editor → paste the contents of setup.sql → Run
//  8. Done! Your database is ready.
// ============================================================

const CONFIG = {

  // ── Supabase ──────────────────────────────────────────────
  // Replace with YOUR project values from supabase.com → Settings → API

  supabaseUrl: 'https://edrjrqprwhoefpsftdik.supabase.co',

  // Anon/Public key — safe to use in customer-facing pages (INSERT only)
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcmpycXByd2hvZWZwc2Z0ZGlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTg1OTIsImV4cCI6MjEwNDg3NDU5Mn0.9sMMhPrAC-NvljalH8YCsaCNB2Bi9P3EGBViglpuTOM',

  // Service Role key — used ONLY in the admin panel
  // ⚠️  Never share this key. Keep config.js private.
  supabaseServiceKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkcmpycXByd2hvZWZwc2Z0ZGlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTI5ODU5MiwiZXhwIjoyMTA0ODc0NTkyfQ.KLiERlkxDfhCWMhmM-AnHy0f878xw2J0B-jVssvYcXY',

  // ── Admin ─────────────────────────────────────────────────
  // Password to log into the admin panel (admin.html)
  // Change this to something strong!
  adminPassword: 'Vivek2026+-*/',

  // ── Company Details ───────────────────────────────────────
  companyName: 'GK Services',
  tagline: 'Fast. Reliable. Affordable.',
  phoneNumber: '+91 9346598080',        // displayed on website
  whatsappNumber: '9346598080',           // digits only, no + or spaces
  phoneNumberRaw: '9346598080',           // for tel: links

  // ── Notifications ─────────────────────────────────────────
  // Set to true once you have a webhook URL ready
  notificationEnabled: false,

  // When notificationEnabled is true, POST the request data to this URL.
  // You can use: Make.com, Zapier, Twilio, WhatsApp Business API, EmailJS, etc.
  // notificationWebhookUrl: 'https://hook.make.com/YOUR_WEBHOOK_ID',

};
