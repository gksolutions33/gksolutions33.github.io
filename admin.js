/* =============================================================
   admin.js — Admin Panel Logic
   AppliFix Repairs
   ============================================================= */

'use strict';

// ─── Constants ────────────────────────────────────────────────
const PAGE_SIZE = 25;

// ─── State ────────────────────────────────────────────────────
let allRequests     = [];   // all fetched records
let filteredRecords = [];   // after search/filter
let currentPage     = 1;
let currentEditId   = null; // request being edited in modal

// ─── DOM helper ───────────────────────────────────────────────
const $ = (id) => document.getElementById(id);



// ─── On page load ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyConfig();
  if (isLoggedIn()) {
    showPanel();
  }
  const pwInput = $('admin-password-input');
  if (pwInput) pwInput.focus();
});

// ─── Apply config to DOM ──────────────────────────────────────
function applyConfig() {
  if (typeof CONFIG === 'undefined') return;
  const name = CONFIG.companyName || 'AppliFix Repairs';
  [$('login-company-name'), $('admin-brand-label')].forEach((el) => {
    if (el) el.textContent = name;
  });
  document.title = `Admin — ${name}`;
}

// ─── Auth ─────────────────────────────────────────────────────
function isLoggedIn() {
  return sessionStorage.getItem('adminAuth') === '1';
}

function doLogin() {
  const pw    = $('admin-password-input').value;
  const errEl = $('login-err');
  const btn   = $('login-btn');

  if (pw === CONFIG.adminPassword) {
    sessionStorage.setItem('adminAuth', '1');
    errEl.classList.remove('show');
    showPanel();
  } else {
    errEl.textContent = 'Incorrect password. Please try again.';
    errEl.classList.add('show');
    $('admin-password-input').value = '';
    $('admin-password-input').focus();
  }
}

function doLogout() {
  sessionStorage.removeItem('adminAuth');
  location.reload();
}

function showPanel() {
  $('admin-login-page').style.display = 'none';
  $('admin-panel-page').classList.add('visible');
  loadRequests();
}

// ─── Load / Fetch ─────────────────────────────────────────────
async function loadRequests() {
  showTableLoading();
  try {
    allRequests = await fetchAllRequests();
    buildBrandFilter(allRequests);
    applyFilters();
    computeStats(allRequests);
    computeBreakdowns(allRequests);
  } catch (err) {
    console.error('Load error:', err);
    $('req-tbody').innerHTML = `<tr><td colspan="7" class="table-info"><span class="icon">⚠️</span><p>Failed to load requests. Check your Supabase config and connection.</p></td></tr>`;
    showToast('Failed to load data. Check console for details.', 'error');
  }
}

async function fetchAllRequests() {
  const url = `${CONFIG.supabaseUrl}/rest/v1/service_requests?select=*&order=created_at.desc&limit=1000`;
  const res = await fetch(url, {
    headers: {
      'apikey':        CONFIG.supabaseServiceKey,
      'Authorization': `Bearer ${CONFIG.supabaseServiceKey}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

// ─── Stats ────────────────────────────────────────────────────
function computeStats(rows) {
  const total = rows.length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = rows.filter((r) => r.created_at.slice(0, 10) === today).length;
  const wmCount    = rows.filter((r) => r.appliance_type === 'Washing Machine').length;
  const frCount    = rows.filter((r) => r.appliance_type === 'Refrigerator').length;

  setText('stat-total',      total);
  setText('stat-today',      todayCount);
  setText('stat-wm',         wmCount);
  setText('stat-fridge',     frCount);

  // Today's date label
  const d = new Date();
  setText('stat-today-date', d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }));
}

function computeBreakdowns(rows) {
  // Brand breakdown
  const brandMap = {};
  rows.forEach((r) => { if (r.brand) brandMap[r.brand] = (brandMap[r.brand] || 0) + 1; });
  const topBrands = Object.entries(brandMap).sort((a,b) => b[1]-a[1]).slice(0,6);
  const maxB = topBrands[0]?.[1] || 1;
  $('brand-breakdown').innerHTML = topBrands.length
    ? topBrands.map(([name, cnt]) => `
        <div class="breakdown-item">
          <span class="breakdown-name" title="${esc(name)}">${esc(name)}</span>
          <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${(cnt/maxB)*100}%"></div></div>
          <span class="breakdown-count">${cnt}</span>
        </div>`).join('')
    : '<p style="font-size:0.75rem;color:var(--slate-500)">No data</p>';

  // Age breakdown
  const AGE_ORDER = ['Less than 1 year','1–2 years','2–3 years','3–5 years','5–7 years','More than 7 years',"Don't Know"];
  const ageMap = {};
  rows.forEach((r) => { if (r.appliance_age) ageMap[r.appliance_age] = (ageMap[r.appliance_age] || 0) + 1; });
  const ageEntries = AGE_ORDER.filter((k) => ageMap[k]).map((k) => [k, ageMap[k]]);
  const maxA = ageEntries[0] ? Math.max(...ageEntries.map(([,v]) => v)) : 1;
  $('age-breakdown').innerHTML = ageEntries.length
    ? ageEntries.map(([name, cnt]) => `
        <div class="breakdown-item">
          <span class="breakdown-name" title="${esc(name)}">${esc(name)}</span>
          <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${(cnt/maxA)*100}%"></div></div>
          <span class="breakdown-count">${cnt}</span>
        </div>`).join('')
    : '<p style="font-size:0.75rem;color:var(--slate-500)">No data</p>';
}

// ─── Brand filter dropdown ────────────────────────────────────
function buildBrandFilter(rows) {
  const brands = [...new Set(rows.map((r) => r.brand).filter(Boolean))].sort();
  const sel = $('filter-brand');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Brands</option>' +
    brands.map((b) => `<option value="${esc(b)}"${b===cur?' selected':''}>${esc(b)}</option>`).join('');
}

// ─── Filters ──────────────────────────────────────────────────
function extractAreaFromProblem(desc) {
  if (!desc) return '';
  const m = desc.match(/\[Area:\s*([^\]]+)\]/i);
  return m ? m[1].trim() : '';
}

function applyFilters() {
  const search    = $('search-input').value.trim().toLowerCase();
  const appliance = $('filter-appliance').value;
  const status    = $('filter-status').value;
  const brand     = $('filter-brand').value;
  const age       = $('filter-age').value;
  const date      = $('filter-date').value; // YYYY-MM-DD

  filteredRecords = allRequests.filter((r) => {
    const area = (r.customer_area || extractAreaFromProblem(r.problem_description)).toLowerCase();
    if (search && 
        !r.mobile_number.includes(search) && 
        !(r.customer_name||'').toLowerCase().includes(search) &&
        !area.includes(search)) return false;
    if (appliance && r.appliance_type !== appliance) return false;
    if (status    && r.status !== status)            return false;
    if (brand     && r.brand !== brand)              return false;
    if (age       && r.appliance_age !== age)         return false;
    if (date      && r.created_at.slice(0,10) !== date) return false;
    return true;
  });

  currentPage = 1;
  renderTable();
}

function clearFilters() {
  $('search-input').value     = '';
  $('filter-appliance').value = '';
  $('filter-status').value    = '';
  $('filter-brand').value     = '';
  $('filter-age').value       = '';
  $('filter-date').value      = '';
  applyFilters();
}

// ─── Table Rendering ──────────────────────────────────────────
function renderTable() {
  const total     = filteredRecords.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  currentPage     = Math.min(currentPage, pageCount);
  const start     = (currentPage - 1) * PAGE_SIZE;
  const pageRows  = filteredRecords.slice(start, start + PAGE_SIZE);

  // Count label
  setText('table-count-label', `Requests (${total})`);

  const tbody = $('req-tbody');

  if (total === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-info"><span class="icon">📭</span><p>No requests match the current filters.</p></td></tr>`;
    $('pagination').innerHTML = '';
    return;
  }

  tbody.innerHTML = pageRows.map((r) => buildRow(r)).join('');
  renderPagination(total, pageCount);
}

function buildRow(r) {
  const date      = formatDateTime(r.created_at);
  const appBadge  = r.appliance_type === 'Washing Machine'
    ? `<span class="badge b-wm">🫧 WM</span>`
    : `<span class="badge b-fridge">🧊 Fridge</span>`;
  const statusBadge = buildStatusBadge(r.status);
  const spamClass   = r.is_spam ? 'is-spam' : '';
  const spamTitle   = r.is_spam ? 'Marked as Spam — click to unmark' : 'Mark as Spam';
  const spamIcon    = r.is_spam ? '🚫' : '⚐';
  const spamCls     = r.is_spam ? 'act-btn spam-on' : 'act-btn';

  const areaText = r.customer_area || extractAreaFromProblem(r.problem_description);
  const areaBadge = areaText
    ? `<span class="table-area-tag">📍 ${esc(areaText)}</span>`
    : `<span style="color:var(--slate-500);font-size:0.75rem">—</span>`;

  return `
    <tr class="${spamClass}" data-id="${r.id}">
      <td style="white-space:nowrap;color:var(--slate-400);font-size:0.75rem">${date}</td>
      <td style="font-weight:600">
        <a href="tel:+91${r.mobile_number}" style="color:var(--sky-400)" aria-label="Call ${r.mobile_number}">
          +91 ${r.mobile_number}
        </a>
        ${r.customer_name ? `<div style="font-size:0.75rem;color:var(--slate-300);margin-top:2px">${esc(r.customer_name)}</div>` : ''}
      </td>
      <td>${areaBadge}</td>
      <td>${appBadge}</td>
      <td>${esc(r.brand)}</td>
      <td style="font-size:0.8rem;color:var(--slate-300)">${esc(r.appliance_age)}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="act-btns">
          <button class="act-btn" onclick="openDetail(${r.id})" title="View & Edit" aria-label="View details for request ${r.id}">👁</button>
          <button class="${spamCls}" onclick="toggleSpam(${r.id})" title="${spamTitle}" aria-label="${spamTitle} for request ${r.id}">${spamIcon}</button>
          <button class="act-btn del" onclick="confirmDelete(${r.id})" title="Delete" aria-label="Delete request ${r.id}">🗑</button>
        </div>
      </td>
    </tr>`;
}

function buildStatusBadge(status) {
  const map = {
    'New':              'b-new',
    'Contacted':        'b-contacted',
    'Service Scheduled':'b-scheduled',
    'Completed':        'b-completed',
    'Cancelled':        'b-cancelled',
  };
  return `<span class="badge ${map[status] || 'b-new'}">${esc(status)}</span>`;
}

function showTableLoading() {
  $('req-tbody').innerHTML = `<tr><td colspan="8" class="table-info"><div class="spinner" aria-hidden="true"></div><p>Loading requests…</p></td></tr>`;
}

// ─── Pagination ───────────────────────────────────────────────
function renderPagination(total, pageCount) {
  const pag = $('pagination');
  if (pageCount <= 1) { pag.innerHTML = ''; return; }

  const start = (currentPage-1)*PAGE_SIZE+1;
  const end   = Math.min(currentPage*PAGE_SIZE, total);

  let btns = `<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''} aria-label="Previous page">‹</button>`;
  for (let p=1; p<=pageCount; p++) {
    if (p===1 || p===pageCount || Math.abs(p-currentPage)<=1) {
      btns += `<button class="page-btn${p===currentPage?' active':''}" onclick="goPage(${p})" aria-label="Page ${p}" aria-current="${p===currentPage?'page':'false'}">${p}</button>`;
    } else if (Math.abs(p-currentPage)===2) {
      btns += `<span class="page-btn" style="cursor:default;pointer-events:none">…</span>`;
    }
  }
  btns += `<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage===pageCount?'disabled':''} aria-label="Next page">›</button>`;

  pag.innerHTML = `<span class="page-info">Showing ${start}–${end} of ${total}</span><div class="page-btns">${btns}</div>`;
}

function goPage(p) {
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  if (p < 1 || p > pageCount) return;
  currentPage = p;
  renderTable();
  document.querySelector('.table-wrap')?.scrollIntoView({ behavior:'smooth', block:'start' });
}

// ─── Request Detail Modal ─────────────────────────────────────
function openDetail(id) {
  const r = allRequests.find((x) => x.id === id);
  if (!r) return;
  currentEditId = id;

  const areaText = r.customer_area || extractAreaFromProblem(r.problem_description);
  const mapsLink = areaText ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(areaText)}` : '';

  const body = $('detail-modal-body');
  body.innerHTML = `
    <!-- Core info -->
    <div class="detail-row"><span class="dk">📱 Mobile</span><span class="dv"><a href="tel:+91${r.mobile_number}" style="color:var(--sky-400)">+91 ${esc(r.mobile_number)}</a></span></div>
    <div class="detail-row"><span class="dk">🔧 Appliance</span><span class="dv">${esc(r.appliance_type)}</span></div>
    <div class="detail-row"><span class="dk">🏷️ Brand</span><span class="dv">${esc(r.brand)}</span></div>
    <div class="detail-row"><span class="dk">📅 Age</span><span class="dv">${esc(r.appliance_age)}</span></div>
    ${r.customer_name ? `<div class="detail-row"><span class="dk">👤 Name</span><span class="dv">${esc(r.customer_name)}</span></div>` : ''}
    <div class="detail-row">
      <span class="dk">📍 Area / Locality</span>
      <span class="dv">
        ${areaText ? `<strong>${esc(areaText)}</strong> <a href="${mapsLink}" target="_blank" rel="noopener" style="color:var(--cyan-400);font-size:0.75rem;margin-left:6px" title="Search on Google Maps">🗺️ Map</a>` : '<span style="color:var(--slate-500)">Not provided</span>'}
      </span>
    </div>
    ${r.problem_description ? `<div class="detail-row"><span class="dk">🔍 Problem</span><span class="dv" style="text-align:left">${esc(r.problem_description)}</span></div>` : ''}
    ${r.preferred_contact_time ? `<div class="detail-row"><span class="dk">⏰ Contact Time</span><span class="dv">${esc(r.preferred_contact_time)}</span></div>` : ''}
    <div class="detail-row"><span class="dk">🕐 Submitted</span><span class="dv">${formatDateTime(r.created_at)}</span></div>
    <div class="detail-row"><span class="dk">🔄 Updated</span><span class="dv">${formatDateTime(r.updated_at)}</span></div>

    <!-- Status -->
    <div class="modal-section-title">Update Status</div>
    <select id="modal-status-sel" class="status-sel" style="width:100%" aria-label="Change status">
      ${['New','Contacted','Service Scheduled','Completed','Cancelled'].map((s) =>
        `<option value="${s}"${r.status===s?' selected':''}>${s}</option>`
      ).join('')}
    </select>

    <!-- Notes -->
    <div class="modal-section-title">Admin Notes</div>
    <textarea id="modal-notes-ta" class="notes-ta" placeholder="Add internal notes…" aria-label="Admin notes">${esc(r.admin_notes || '')}</textarea>

    <!-- Quick actions -->
    <div class="modal-section-title">Quick Actions</div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
      <a href="tel:+91${r.mobile_number}" class="btn btn-sm btn-phone" aria-label="Call customer">📞 Call</a>
      <a href="https://wa.me/91${r.mobile_number}" target="_blank" rel="noopener" class="btn btn-sm btn-whatsapp" aria-label="WhatsApp customer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
        WhatsApp
      </a>
    </div>
  `;

  openModal('detail-modal');
}

async function saveDetail() {
  if (!currentEditId) return;
  const newStatus = $('modal-status-sel')?.value;
  const newNotes  = $('modal-notes-ta')?.value.trim() || '';

  const btn = $('save-detail-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    await patchRequest(currentEditId, { status: newStatus, admin_notes: newNotes });

    // Update local state
    const idx = allRequests.findIndex((r) => r.id === currentEditId);
    if (idx !== -1) {
      allRequests[idx].status      = newStatus;
      allRequests[idx].admin_notes = newNotes;
    }

    closeModal('detail-modal');
    applyFilters();
    computeStats(allRequests);
    showToast('Changes saved successfully.', 'success');
  } catch (err) {
    console.error('Save error:', err);
    showToast('Failed to save. Check console.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
  }
}

// ─── Toggle Spam ──────────────────────────────────────────────
async function toggleSpam(id) {
  const r = allRequests.find((x) => x.id === id);
  if (!r) return;
  const newSpam = !r.is_spam;

  try {
    await patchRequest(id, { is_spam: newSpam });
    r.is_spam = newSpam;
    applyFilters();
    showToast(newSpam ? 'Marked as spam.' : 'Spam mark removed.', 'info');
  } catch (err) {
    console.error('Spam toggle error:', err);
    showToast('Action failed. Check console.', 'error');
  }
}

// ─── Delete ───────────────────────────────────────────────────
function confirmDelete(id) {
  const r = allRequests.find((x) => x.id === id);
  if (!r) return;
  $('confirm-msg').textContent = `Delete the request from +91 ${r.mobile_number} (${r.appliance_type} — ${r.brand})? This cannot be undone.`;
  $('confirm-ok-btn').onclick = () => doDelete(id);
  openModal('confirm-modal');
}

async function doDelete(id) {
  const btn = $('confirm-ok-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }

  try {
    await deleteRequest(id);
    allRequests = allRequests.filter((r) => r.id !== id);
    closeModal('confirm-modal');
    applyFilters();
    computeStats(allRequests);
    computeBreakdowns(allRequests);
    buildBrandFilter(allRequests);
    showToast('Request deleted.', 'success');
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Delete failed. Check console.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Delete'; }
  }
}

// ─── Supabase API Calls ───────────────────────────────────────

async function patchRequest(id, updates) {
  const url = `${CONFIG.supabaseUrl}/rest/v1/service_requests?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        CONFIG.supabaseServiceKey,
      'Authorization': `Bearer ${CONFIG.supabaseServiceKey}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}`);
}

async function deleteRequest(id) {
  const url = `${CONFIG.supabaseUrl}/rest/v1/service_requests?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey':        CONFIG.supabaseServiceKey,
      'Authorization': `Bearer ${CONFIG.supabaseServiceKey}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase DELETE ${res.status}`);
}

// ─── Modal helpers ────────────────────────────────────────────
function openModal(id) {
  $(id).classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  $(id).classList.remove('active');
  document.body.style.overflow = '';
}

// Close modals on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-ov')) closeModal(e.target.id);
});

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-ov.active').forEach((m) => closeModal(m.id));
  }
});

// ─── Utilities ────────────────────────────────────────────────
function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit', hour12:true,
  });
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

// ─── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const area = $('toast-area');
  if (!area) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  area.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
