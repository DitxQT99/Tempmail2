// State
let currentEmail = { full: '', login: '', domain: '' };
let inboxMessages = [];
let refreshInterval = null;
let isFetchingInbox = false;
let isModalOpen = false;

// DOM Elements
const emailInput = document.getElementById('email-input');
const copyBtn = document.getElementById('copy-btn');
const inboxList = document.getElementById('inbox-list');
const inboxCount = document.getElementById('inbox-count');
const toastContainer = document.getElementById('toast-container');
const modal = document.getElementById('email-modal');
const modalSubject = document.getElementById('modal-subject');
const modalFrom = document.getElementById('modal-from');
const modalDate = document.getElementById('modal-date');
const modalBody = document.getElementById('modal-body');
const closeModalBtn = document.getElementById('close-modal');

// Helper: show toast
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Helper: parse email into login and domain
function parseEmail(email) {
  if (!email || !email.includes('@')) return null;
  const [login, domain] = email.split('@');
  return { login, domain };
}

// Helper: save email to localStorage
function saveEmail(email) {
  localStorage.setItem('tempnail_email', email);
}

// Helper: load email from localStorage
function loadEmail() {
  return localStorage.getItem('tempnail_email');
}

// Helper: generate random email via backend
async function generateEmail() {
  try {
    const res = await fetch('/api/generate');
    const data = await res.json();
    if (data.status === 'success') {
      return data.data.email;
    } else {
      throw new Error(data.error?.message || 'Gagal generate email');
    }
  } catch (err) {
    showToast('Gagal generate email: ' + err.message, 'error');
    return null;
  }
}

// Helper: fetch inbox from backend
async function fetchInbox(login, domain) {
  if (isFetchingInbox) return;
  isFetchingInbox = true;

  try {
    const res = await fetch(`/api/inbox?login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}`);
    const data = await res.json();
    if (data.status === 'success') {
      inboxMessages = data.data || [];
      renderInbox(inboxMessages);
      updateBadge(inboxMessages.length);
    } else {
      throw new Error(data.error?.message || 'Gagal ambil inbox');
    }
  } catch (err) {
    showToast('Gagal refresh inbox: ' + err.message, 'error');
  } finally {
    isFetchingInbox = false;
  }
}

// Helper: fetch single message detail
async function fetchMessage(login, domain, id) {
  try {
    const res = await fetch(`/api/read?login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (data.status === 'success') {
      return data.data;
    } else {
      throw new Error(data.error?.message || 'Gagal ambil pesan');
    }
  } catch (err) {
    showToast('Gagal buka pesan: ' + err.message, 'error');
    return null;
  }
}

// Render inbox list (dengan skeleton loading jika kosong)
function renderInbox(messages) {
  if (!messages || messages.length === 0) {
    inboxList.innerHTML = `
      <div class="email-item" style="justify-content: center; text-align: center; color: rgba(255,255,255,0.4);">
        Belum ada pesan masuk
      </div>
    `;
    return;
  }

  inboxList.innerHTML = messages.map(msg => `
    <div class="email-item" data-id="${msg.id}">
      <div class="email-subject">${escapeHtml(msg.subject) || '(tanpa subjek)'}</div>
      <div class="email-from">${escapeHtml(msg.from)}</div>
      <div class="email-date">${formatDate(msg.date)}</div>
    </div>
  `).join('');

  // Tambahkan event listener ke setiap item
  document.querySelectorAll('.email-item').forEach(item => {
    item.addEventListener('click', () => openMessage(item.dataset.id));
  });
}

// Escape HTML untuk keamanan
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Format tanggal
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}

// Update badge jumlah inbox
function updateBadge(count) {
  inboxCount.textContent = count;
}

// Tampilkan skeleton loading di inbox
function showSkeletonInbox() {
  inboxList.innerHTML = `
    <div class="skeleton">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>
    <div class="skeleton">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>
  `;
}

// Copy email ke clipboard
async function copyEmail() {
  const email = emailInput.value;
  if (!email || email === 'memuat...') return;

  try {
    await navigator.clipboard.writeText(email);
    // Tampilkan efek copied
    copyBtn.classList.add('copied');
    copyBtn.querySelector('.btn-text').textContent = 'Copied ✓';
    showToast('Email disalin ke clipboard!', 'success');

    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.querySelector('.btn-text').textContent = 'Salin';
    }, 2000);
  } catch (err) {
    // Fallback: prompt
    prompt('Salin manual:', email);
    showToast('Gunakan Ctrl+C untuk menyalin', 'error');
  }
}

// Buka pesan di modal
async function openMessage(id) {
  const message = inboxMessages.find(m => m.id == id);
  if (!message) return;

  // Tampilkan modal dengan loading
  modalSubject.textContent = 'Memuat...';
  modalFrom.textContent = '...';
  modalDate.textContent = '...';
  modalBody.textContent = 'Sedang mengambil konten...';
  modal.style.display = 'flex';
  isModalOpen = true;

  const detail = await fetchMessage(currentEmail.login, currentEmail.domain, id);
  if (detail) {
    modalSubject.textContent = detail.subject || '(tanpa subjek)';
    modalFrom.textContent = detail.from || 'Unknown';
    modalDate.textContent = formatDate(detail.date) || '';
    modalBody.textContent = detail.textBody || detail.body || '(Kosong)';
  } else {
    modalSubject.textContent = 'Gagal memuat pesan';
    modalBody.textContent = 'Terjadi kesalahan saat mengambil detail.';
  }
}

// Tutup modal
function closeModal() {
  modal.style.display = 'none';
  isModalOpen = false;
}

// Inisialisasi
async function init() {
  // Cek localStorage
  let storedEmail = loadEmail();
  if (storedEmail && storedEmail.includes('@')) {
    currentEmail.full = storedEmail;
    const parsed = parseEmail(storedEmail);
    currentEmail.login = parsed.login;
    currentEmail.domain = parsed.domain;
    emailInput.value = storedEmail;
  } else {
    // Generate baru
    showSkeletonInbox();
    const newEmail = await generateEmail();
    if (newEmail) {
      currentEmail.full = newEmail;
      const parsed = parseEmail(newEmail);
      currentEmail.login = parsed.login;
      currentEmail.domain = parsed.domain;
      emailInput.value = newEmail;
      saveEmail(newEmail);
    } else {
      emailInput.value = 'Gagal memuat email';
      return;
    }
  }

  // Fetch inbox pertama kali
  showSkeletonInbox();
  await fetchInbox(currentEmail.login, currentEmail.domain);

  // Set auto refresh setiap 5 detik
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    if (!isModalOpen) { // Jangan refresh saat modal terbuka
      fetchInbox(currentEmail.login, currentEmail.domain);
    }
  }, 5000);
}

// Event listeners
copyBtn.addEventListener('click', copyEmail);

closeModalBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// Jalankan init saat halaman siap
document.addEventListener('DOMContentLoaded', init);