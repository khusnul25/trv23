// Ganti dengan URL deployment Vercel kamu (contoh: https://wa-group-api.vercel.app)
const API_BASE_URL = 'https://trv23.vercel.app/';
let appData = { events: [], rules: [], albums: [], feedbacks: [] };

// ================= 1. THEME DARK / LIGHT TOGGLE =================
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const savedTheme = localStorage.getItem('site-theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('site-theme', next);
  themeIcon.textContent = next === 'dark' ? '☀️' : '🌙';
});

// ================= 2. HAMBURGER MENU & PAGE ROUTING =================
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sideDrawer = document.getElementById('sideDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const closeDrawer = document.getElementById('closeDrawer');

function toggleDrawer(open) {
  sideDrawer.classList.toggle('open', open);
  drawerOverlay.classList.toggle('open', open);
}

hamburgerBtn.addEventListener('click', () => toggleDrawer(true));
closeDrawer.addEventListener('click', () => toggleDrawer(false));
drawerOverlay.addEventListener('click', () => toggleDrawer(false));

function navigateTo(pageId) {
  document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) targetPage.classList.add('active');

  const activeBtn = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  toggleDrawer(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

// Klik Logo Grup -> Masuk ke Halaman Admin
document.getElementById('adminTrigger').addEventListener('click', async () => {
  navigateTo('admin');
  await checkAdminSession();
});

// ================= 3. LOAD & RENDER PUBLIC DATA =================
async function loadAllData() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/data`);
    appData = await res.json();
    renderAll();
  } catch (err) {
    console.error('Gagal memuat data:', err);
  }
}

function renderAll() {
  document.getElementById('stat-events').textContent = appData.events.length;
  document.getElementById('stat-rules').textContent = appData.rules.length;
  document.getElementById('stat-albums').textContent = appData.albums.length;
  document.getElementById('stat-feedbacks').textContent = appData.feedbacks.length;

  const eventsList = document.getElementById('eventsList');
  eventsList.innerHTML = appData.events.length
    ? appData.events.map(ev => `
        <div class="doc-card">
          <span class="method-tag post">${ev.date} • ${ev.time}</span>
          <h3 style="margin: 0.7rem 0 0.4rem;">${escapeHTML(ev.title)}</h3>
          <p style="color: var(--text-secondary); font-size: 0.92rem;">${escapeHTML(ev.description)}</p>
        </div>
      `).join('')
    : '<p class="mono-label">Belum ada jadwal event terbaru.</p>';

  const rulesList = document.getElementById('rulesList');
  rulesList.innerHTML = appData.rules.length
    ? appData.rules.map(rl => `
        <div class="rule-item">
          <div class="rule-num">#${escapeHTML(rl.number)}</div>
          <div>
            <span class="method-tag">${escapeHTML(rl.severity)}</span>
            <h3 style="margin: 0.3rem 0;">${escapeHTML(rl.title)}</h3>
            <p style="color: var(--text-secondary); font-size: 0.92rem;">${escapeHTML(rl.detail)}</p>
          </div>
        </div>
      `).join('')
    : '<p class="mono-label">Belum ada peraturan yang ditambahkan.</p>';

  const albumGrid = document.getElementById('albumGrid');
  albumGrid.innerHTML = appData.albums.length
    ? appData.albums.map(al => `
        <div class="album-card">
          <img src="${escapeHTML(al.imageUrl)}" alt="${escapeHTML(al.title)}" loading="lazy" />
          <div class="album-info">
            <h4>${escapeHTML(al.title)}</h4>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">${escapeHTML(al.caption)}</p>
          </div>
        </div>
      `).join('')
    : '<p class="mono-label">Galeri album masih kosong.</p>';

  // Render Feedback Anonim
  const feedbackList = document.getElementById('feedbackList');
  feedbackList.innerHTML = appData.feedbacks.length
    ? appData.feedbacks.map(fb => `
        <div class="fb-bubble">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span class="method-tag">${escapeHTML(fb.category)}</span>
            <span class="mono-label">Anonymous Member</span>
          </div>
          <p style="font-size: 0.93rem;">${escapeHTML(fb.message)}</p>
        </div>
      `).join('')
    : '<p class="mono-label">Belum ada saran masuk. Jadilah yang pertama!</p>';

  renderAdminLists();
}

document.getElementById('feedbackForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const statusEl = document.getElementById('fbStatus');
  const category = document.getElementById('fbCategory').value;
  const message = document.getElementById('fbMessage').value;

  statusEl.textContent = 'Mengirim secara terenkripsi...';
  try {
    const res = await fetch(`${API_BASE_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, message })
    });
    if (!res.ok) throw new Error();
    document.getElementById('fbMessage').value = '';
    statusEl.textContent = '✅ Pesan anonim berhasil terkirim!';
    await loadAllData();
  } catch {
    statusEl.textContent = '❌ Gagal mengirim pesan.';
  }
});

// ================= 4. ADMIN AUTH & CRUD OPERATIONS =================
function getToken() {
  return sessionStorage.getItem('admin_jwt');
}

async function checkAdminSession() {
  const token = getToken();
  const loginBox = document.getElementById('adminLoginBox');
  const dashboard = document.getElementById('adminDashboard');

  if (!token) {
    loginBox.classList.remove('hidden');
    dashboard.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      loginBox.classList.add('hidden');
      dashboard.classList.remove('hidden');
    } else {
      sessionStorage.removeItem('admin_jwt');
      loginBox.classList.remove('hidden');
      dashboard.classList.add('hidden');
    }
  } catch {
    loginBox.classList.remove('hidden');
    dashboard.classList.add('hidden');
  }
}

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('adminPassInput').value;
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Password salah!';
      return;
    }
    sessionStorage.setItem('admin_jwt', data.token);
    document.getElementById('adminPassInput').value = '';
    await checkAdminSession();
  } catch {
    errorEl.textContent = 'Tidak dapat terhubung ke server Vercel.';
  }
});

document.getElementById('adminLogoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('admin_jwt');
  checkAdminSession();
});

async function adminRequest(endpoint, method, body = null) {
  const token = getToken();
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
  if (res.status === 401 || res.status === 403) {
    alert('Sesi admin habis, silakan login ulang.');
    sessionStorage.removeItem('admin_jwt');
    checkAdminSession();
  }
  return res;
}

document.getElementById('addEventForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await adminRequest('/api/admin/events', 'POST', {
    title: document.getElementById('evTitle').value,
    date: document.getElementById('evDate').value,
    time: document.getElementById('evTime').value,
    description: document.getElementById('evDesc').value
  });
  e.target.reset();
  await loadAllData();
});

document.getElementById('addRuleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await adminRequest('/api/admin/rules', 'POST', {
    number: document.getElementById('rlNum').value,
    severity: document.getElementById('rlSeverity').value,
    title: document.getElementById('rlTitle').value,
    detail: document.getElementById('rlDetail').value
  });
  e.target.reset();
  await loadAllData();
});

document.getElementById('addAlbumForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await adminRequest('/api/admin/albums', 'POST', {
    title: document.getElementById('alTitle').value,
    imageUrl: document.getElementById('alUrl').value,
    caption: document.getElementById('alCaption').value
  });
  e.target.reset();
  await loadAllData();
});

window.deleteItem = async function(type, id) {
  if (!confirm('Yakin ingin menghapus item ini?')) return;
  await adminRequest(`/api/admin/${type}/${id}`, 'DELETE');
  await loadAllData();
};

function renderAdminLists() {
  document.getElementById('adminEventsList').innerHTML = appData.events.map(i => `
    <div class="manage-row"><span>${escapeHTML(i.title)}</span><button class="btn-del" onclick="deleteItem('events','${i._id}')">Hapus</button></div>
  `).join('');

  document.getElementById('adminRulesList').innerHTML = appData.rules.map(i => `
    <div class="manage-row"><span>#${escapeHTML(i.number)} ${escapeHTML(i.title)}</span><button class="btn-del" onclick="deleteItem('rules','${i._id}')">Hapus</button></div>
  `).join('');

  document.getElementById('adminAlbumsList').innerHTML = appData.albums.map(i => `
    <div class="manage-row"><span>${escapeHTML(i.title)}</span><button class="btn-del" onclick="deleteItem('albums','${i._id}')">Hapus</button></div>
  `).join('');

  document.getElementById('adminFeedbacksList').innerHTML = appData.feedbacks.map(i => `
    <div class="manage-row"><span>[${escapeHTML(i.category)}] ${escapeHTML(i.message.slice(0, 35))}...</span><button class="btn-del" onclick="deleteItem('feedback','${i._id}')">Hapus</button></div>
  `).join('');
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

loadAllData();