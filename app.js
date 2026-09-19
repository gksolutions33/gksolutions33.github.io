/* =============================================================
   app.js — Customer-facing service request form
   GK Services — Fast Doorstep Appliance Repair
   ============================================================= */

'use strict';

// ─── Brand Lists ──────────────────────────────────────────────
const BRANDS = {
  'Washing Machine': ['LG', 'Samsung', 'Whirlpool', 'IFB', 'Bosch', 'Haier', 'Panasonic', 'Godrej', 'Voltas', 'Other'],
  'Refrigerator':    ['LG', 'Samsung', 'Whirlpool', 'Godrej', 'Haier', 'Bosch', 'Panasonic', 'Voltas', 'Hitachi', 'Blue Star', 'Other'],
};

// ─── State ────────────────────────────────────────────────────
let currentStep = 1;
const TOTAL_STEPS = 4;
let isSubmitting = false;
let lastSubmittedData = null;

// ─── DOM helpers ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ─── On DOM ready: apply config & bind listeners ──────────────
document.addEventListener('DOMContentLoaded', () => {
  applyConfig();

  const mobileInput = $('mobile-input');
  if (mobileInput) {
    mobileInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      const checkIcon = $('mobile-check');
      const val = e.target.value;
      if (/^[6-9]\d{9}$/.test(val)) {
        if (checkIcon) checkIcon.style.display = 'flex';
        clearErrors();
      } else {
        if (checkIcon) checkIcon.style.display = 'none';
      }
    });
  }
});

function applyConfig() {
  if (typeof CONFIG === 'undefined') return;

  const c = CONFIG;
  const companyName = c.companyName || 'GK Services';
  const phone       = c.phoneNumber  || '+91 9346598080';
  const phoneRaw    = c.phoneNumberRaw || '9346598080';
  const waNum       = c.whatsappNumber || '9346598080';
  const tel         = `tel:+${phoneRaw}`;
  const waLink      = `https://wa.me/${waNum}`;

  // Update brand name
  ['site-brand-name', 'footer-company'].forEach((id) => {
    const el = $(id);
    if (el && id === 'site-brand-name') el.textContent = companyName;
  });

  // Phone links
  [
    ['nav-phone-btn',     tel,   null],
    ['hero-phone-btn',    tel,   null],
    ['contact-phone-btn', tel,   null],
    ['footer-phone',      tel,   phone],
  ].forEach(([id, href, text]) => {
    const el = $(id);
    if (!el) return;
    el.href = href;
    if (text) el.textContent = text;
  });

  // Mobile bottom bar links
  const mobCall = document.querySelector('.mob-btn-call');
  if (mobCall) mobCall.href = tel;
  const mobWa = document.querySelector('.mob-btn-wa');
  if (mobWa) mobWa.href = waLink;

  // Display phone in hero & contact section
  const hpd = $('hero-phone-display');
  if (hpd) hpd.textContent = phone;
  const cpb = $('contact-phone-btn');
  if (cpb) cpb.textContent = `📞 Call ${phone}`;

  // WhatsApp links
  [
    ['nav-wa-btn',      waLink],
    ['hero-wa-btn',     waLink],
    ['contact-wa-btn',  waLink],
    ['footer-wa',       waLink],
  ].forEach(([id, href]) => {
    const el = $(id);
    if (el) el.href = href;
  });

  if (c.companyName) {
    document.title = `${companyName} — Washing Machine & Refrigerator Repair`;
  }
}

// ─── Quick Book from Problem Chips ────────────────────────────
function quickBookIssue(e, appliance, issueText) {
  if (e && e.stopPropagation) e.stopPropagation();

  // Set appliance
  const radio = document.querySelector(`input[name="appliance"][value="${appliance}"]`);
  if (radio) {
    radio.checked = true;
    onApplianceChange();
  }

  // Pre-fill problem description
  const probInput = $('problem-input');
  if (probInput) {
    probInput.value = issueText;
  }

  // Open modal
  openForm(appliance);
}

function handleCardClick(e, appliance) {
  // Only trigger if not clicking a chip button
  if (e.target.closest('.issue-chip')) return;
  openForm(appliance);
}

// ─── Open / Close form ────────────────────────────────────────
function openForm(preselectedAppliance) {
  const overlay = $('form-overlay');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  if (preselectedAppliance) {
    const radio = document.querySelector(`input[name="appliance"][value="${preselectedAppliance}"]`);
    if (radio) {
      radio.checked = true;
      populateBrands(preselectedAppliance);
    }
  }

  // Focus mobile input
  setTimeout(() => {
    const mobileInp = $('mobile-input');
    if (mobileInp && currentStep === 1) mobileInp.focus();
  }, 350);

  updateProgress();
}

function closeForm() {
  $('form-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('form-overlay')?.classList.contains('active')) closeForm();
});

// ─── Step Navigation ──────────────────────────────────────────
function showStep(n) {
  document.querySelectorAll('.form-step').forEach((s) => s.classList.remove('active'));
  const target = $(n === 'success' ? 'step-success' : `step-${n}`);
  if (target) target.classList.add('active');

  // Update Stepper dots
  document.querySelectorAll('.step-dot').forEach((dot) => {
    const stepNum = parseInt(dot.getAttribute('data-step'), 10);
    dot.classList.toggle('active', stepNum === n);
    dot.classList.toggle('completed', stepNum < n);
  });
}

function updateProgress() {
  const pct = (currentStep / TOTAL_STEPS) * 100;
  const fill = $('progress-fill');
  const counter = $('step-counter');
  if (fill) {
    fill.style.width = pct + '%';
    fill.parentElement.setAttribute('aria-valuenow', pct);
  }
  if (counter) counter.textContent = `Step ${currentStep} of ${TOTAL_STEPS}`;
}

function nextStep() {
  if (!validateStep(currentStep)) return;
  if (currentStep === TOTAL_STEPS) { submitForm(); return; }
  currentStep++;
  showStep(currentStep);
  updateProgress();
  $('form-sheet').scrollTop = 0;

  if (currentStep === 3) populateBrands();
}

function prevStep() {
  if (currentStep <= 1) return;
  currentStep--;
  showStep(currentStep);
  updateProgress();
  $('form-sheet').scrollTop = 0;
}

// ─── Validation ───────────────────────────────────────────────
function validateStep(step) {
  clearErrors();
  if (step === 1) return validateMobile();
  if (step === 2) return validateAppliance();
  if (step === 3) return validateBrand();
  return true; // step 4 is optional
}

function validateMobile() {
  const val = $('mobile-input').value.trim();
  if (!/^[6-9]\d{9}$/.test(val)) {
    showErr('mobile-wrap', 'mobile-error', true);
    $('mobile-input').focus();
    return false;
  }
  return true;
}

function validateAppliance() {
  const checked = document.querySelector('input[name="appliance"]:checked');
  if (!checked) {
    showErr(null, 'appliance-error', true);
    return false;
  }
  return true;
}

function validateBrand() {
  const sel = $('brand-select').value;
  if (!sel) {
    showErr('brand-select', 'brand-error', true);
    $('brand-select').focus();
    return false;
  }
  if (sel === 'Other') {
    const otherVal = $('brand-other-input').value.trim();
    if (!otherVal) {
      showErr('brand-other-input', 'brand-other-error', true);
      $('brand-other-input').focus();
      return false;
    }
  }
  return true;
}

function showErr(fieldId, errId, show) {
  if (fieldId) {
    const el = $(fieldId);
    if (el) el.classList.toggle('has-error', show);
  }
  const errEl = $(errId);
  if (errEl) errEl.classList.toggle('show', show);
}

function clearErrors() {
  document.querySelectorAll('.err-msg').forEach((e) => e.classList.remove('show'));
  document.querySelectorAll('.has-error').forEach((e) => e.classList.remove('has-error'));
}

// ─── Appliance Change & Brand Chips ───────────────────────────
function onApplianceChange() {
  const val = document.querySelector('input[name="appliance"]:checked')?.value;
  if (val) populateBrands(val);
  clearErrors();
}

function populateBrands(appliance) {
  const appVal = appliance || document.querySelector('input[name="appliance"]:checked')?.value;
  if (!appVal) return;
  const brands = BRANDS[appVal] || [];
  const sel = $('brand-select');
  sel.innerHTML = '<option value="">— Choose a brand —</option>';

  brands.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    sel.appendChild(opt);
  });

  // Render Visual Brand Chips
  renderBrandChips(brands);
  onBrandChange();
}

function renderBrandChips(brands) {
  const container = $('brand-chips-wrap');
  if (!container) return;
  container.innerHTML = '';

  const popular = brands.filter((b) => b !== 'Other');
  popular.forEach((brand) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'brand-chip';
    chip.textContent = brand;
    chip.onclick = () => selectBrandChip(brand);
    container.appendChild(chip);
  });

  // Add "Other" chip
  const otherChip = document.createElement('button');
  otherChip.type = 'button';
  otherChip.className = 'brand-chip brand-chip-other';
  otherChip.textContent = 'Other Brand';
  otherChip.onclick = () => selectBrandChip('Other');
  container.appendChild(otherChip);
}

function selectBrandChip(brandName) {
  const sel = $('brand-select');
  if (sel) {
    sel.value = brandName;
    onBrandChange();
  }

  // Highlight selected chip
  document.querySelectorAll('.brand-chip').forEach((c) => {
    const match = c.textContent === brandName || (brandName === 'Other' && c.classList.contains('brand-chip-other'));
    c.classList.toggle('selected', match);
  });

  clearErrors();

  // If not "Other", auto-advance smoothly for frictionless interaction!
  if (brandName !== 'Other') {
    setTimeout(() => {
      nextStep();
    }, 180);
  }
}

function onBrandChange() {
  const sel = $('brand-select').value;
  const wrap = $('brand-other-wrap');
  if (wrap) wrap.style.display = sel === 'Other' ? 'block' : 'none';
  if (sel !== 'Other' && $('brand-other-input')) $('brand-other-input').value = '';

  // Sync chip styles
  document.querySelectorAll('.brand-chip').forEach((c) => {
    const match = c.textContent === sel || (sel === 'Other' && c.classList.contains('brand-chip-other'));
    c.classList.toggle('selected', match);
  });

  clearErrors();
}

// ─── Step 5 Problem Suggestions ──────────────────────────────
function addProblemSugg(text) {
  const ta = $('problem-input');
  if (!ta) return;
  if (!ta.value.trim()) {
    ta.value = text;
  } else if (!ta.value.includes(text)) {
    ta.value += `, ${text}`;
  }
  ta.focus();
}

// ─── Build Form Data ──────────────────────────────────────────
function collectFormData() {
  const brandSel = $('brand-select').value;
  const brand = brandSel === 'Other'
    ? $('brand-other-input').value.trim()
    : brandSel;

  return {
    mobile_number:          $('mobile-input').value.trim(),
    appliance_type:         document.querySelector('input[name="appliance"]:checked')?.value || '',
    brand:                  brand,
    appliance_age:          'Not Specified',
    customer_name:          $('name-input')?.value.trim() || '',
    customer_area:          $('area-input')?.value.trim() || '',
    problem_description:    $('problem-input')?.value.trim() || '',
    preferred_contact_time: $('contact-time-select')?.value || '',
    status:                 'New',
    admin_notes:            '',
    is_spam:                false,
  };
}

// ─── Submit Form ──────────────────────────────────────────────
async function submitForm() {
  if (isSubmitting) return;
  if (!validateStep(currentStep) && currentStep !== TOTAL_STEPS) return;

  const data = collectFormData();

  // Final guard: require core fields
  if (!data.mobile_number || !data.appliance_type || !data.brand) {
    showToast('Please complete all required fields.', 'error');
    return;
  }

  isSubmitting = true;
  const btn = $('submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Submitting…';
  }

  try {
    await insertRequest(data);
    lastSubmittedData = data;
    showSuccessScreen(data);
  } catch (err) {
    console.error('Submit error:', err);
    showToast('Something went wrong. Please try again or call us.', 'error');
  } finally {
    isSubmitting = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✔ Submit Request';
    }
  }
}

// ─── Supabase INSERT ──────────────────────────────────────────
async function insertRequest(data) {
  const url  = CONFIG.supabaseUrl;
  const key  = CONFIG.supabaseAnonKey;

  const res = await fetch(`${url}/rest/v1/service_requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        key,
      'Authorization': `Bearer ${key}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    // Seamless fallback: if customer_area column doesn't exist yet in Supabase table,
    // preserve the area inside problem_description and retry without failing!
    if (data.customer_area && text.includes('customer_area')) {
      const fallbackData = { ...data };
      delete fallbackData.customer_area;
      const areaNote = `[Area: ${data.customer_area}]`;
      fallbackData.problem_description = fallbackData.problem_description
        ? `${areaNote} ${fallbackData.problem_description}`
        : areaNote;
      return insertRequest(fallbackData);
    }
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }

  return {};
}

// ─── Success Screen ───────────────────────────────────────────
function showSuccessScreen(data) {
  const summary = $('success-summary');
  if (summary) {
    summary.innerHTML = [
      { k: '📱 Mobile',    v: `+91 ${data.mobile_number}` },
      { k: '🔧 Appliance', v: data.appliance_type },
      { k: '🏷️ Brand',    v: data.brand },
      data.customer_name ? { k: '👤 Name', v: data.customer_name } : null,
      data.customer_area ? { k: '📍 Area', v: data.customer_area } : null,
      data.problem_description ? { k: '📝 Issue', v: data.problem_description } : null,
    ].filter(Boolean).map((r) =>
      `<div class="summary-row"><span class="summary-key">${r.k}</span><span class="summary-val">${r.v}</span></div>`
    ).join('');
  }

  currentStep = TOTAL_STEPS;
  showStep('success');

  // Hide progress indicators on success
  const stepper = document.querySelector('.form-stepper-wrap');
  if (stepper) stepper.style.display = 'none';

  $('form-sheet').scrollTop = 0;
}

function openSuccessWhatsApp() {
  if (!lastSubmittedData) return;
  const d = lastSubmittedData;
  const text = encodeURIComponent(
    `Hi ${CONFIG.companyName || 'GK Services'}, I just submitted a service request!\n\n` +
    `• Mobile: +91 ${d.mobile_number}\n` +
    `• Appliance: ${d.appliance_type}\n` +
    `• Brand: ${d.brand}\n` +
    (d.customer_area ? `• Area: ${d.customer_area}\n` : '') +
    (d.problem_description ? `• Issue: ${d.problem_description}\n` : '') +
    `\nPlease assign a technician at the earliest.`
  );
  window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${text}`, '_blank');
}

// ─── Reset Form ───────────────────────────────────────────────
function resetForm() {
  $('mobile-input').value = '';
  $('brand-select').innerHTML = '<option value="">— Choose a brand —</option>';
  $('brand-other-input').value = '';
  $('brand-other-wrap').style.display = 'none';
  if ($('name-input')) $('name-input').value = '';
  if ($('area-input')) $('area-input').value = '';
  if ($('problem-input')) $('problem-input').value = '';
  if ($('contact-time-select')) $('contact-time-select').value = '';
  document.querySelectorAll('input[type=radio]').forEach((r) => (r.checked = false));
  clearErrors();

  const stepper = document.querySelector('.form-stepper-wrap');
  if (stepper) stepper.style.display = '';

  currentStep = 1;
  showStep(1);
  updateProgress();
  $('form-sheet').scrollTop = 0;
}

// ─── Toast Notifications ──────────────────────────────────────
function showToast(msg, type = 'info') {
  const area = $('toast-area');
  if (!area) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  area.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ─── Customer Referral & Sharing ──────────────────────────────
function shareOnWhatsApp() {
  const brand = (typeof CONFIG !== 'undefined' && CONFIG.companyName) || 'GK Services';
  const phone = (typeof CONFIG !== 'undefined' && CONFIG.phoneNumber) || '+91 9346598080';
  const siteUrl = window.location.href.split('#')[0];
  const text = encodeURIComponent(
    `🔧 *Recommended Doorstep Appliance Repair*\n\n` +
    `If your washing machine or refrigerator has issues, check out *${brand}*!\n\n` +
    `⚡ Technician doorstep visit in 30–45 minutes\n` +
    `🛡️ 90-day warranty on 100% genuine spare parts\n` +
    `🎁 Flat ₹150 OFF for neighbors & friends\n\n` +
    `📞 Call: ${phone}\n` +
    `🌐 Book online in 1 min: ${siteUrl}`
  );
  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

function copyReferralLink() {
  const url = window.location.href.split('#')[0];
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Referral link copied! Share it with friends & neighbors.', 'success');
    }).catch(() => {
      fallbackCopy(url);
    });
  } else {
    fallbackCopy(url);
  }
}

function fallbackCopy(url) {
  try {
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast('Referral link copied to clipboard!', 'success');
  } catch (err) {
    showToast('Share URL: ' + url, 'info');
  }
}

