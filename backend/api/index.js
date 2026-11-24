const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Redis } = require('@upstash/redis');

const app = express();
app.use(cors({
  origin: 'https://therevanants.netlify.app',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(express.json({ limit: '20mb' }));

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function getCollection(key) {
  const data = await redis.get(key);
  return Array.isArray(data) ? data : [];
}

async function saveCollection(key, list) {
  await redis.set(key, list);
}

// Middleware Proteksi Admin (JWT Verification)
function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak. Token tidak ditemukan.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error();
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token tidak valid atau sudah kedaluwarsa.' });
  }
}

// ================= PUBLIC ROUTES =================

// Ambil semua data dari Vercel Storage
app.get('/api/data', async (req, res) => {
  try {
    const [events, rules, albums, feedbacks] = await Promise.all([
      getCollection('wa_events'),
      getCollection('wa_rules'),
      getCollection('wa_albums'),
      getCollection('wa_feedbacks'),
    ]);
    res.json({ events, rules, albums, feedbacks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat data dari Vercel Storage.' });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { category, message } = req.body;
    if (!message || message.trim().length < 3) {
      return res.status(400).json({ error: 'Pesan terlalu pendek.' });
    }
    const feedbacks = await getCollection('wa_feedbacks');
    const newFeedback = {
      _id: Date.now().toString(),
      category: category || 'Saran',
      message: message.trim(),
      createdAt: new Date().toISOString()
    };
    feedbacks.unshift(newFeedback);
    await saveCollection('wa_feedbacks', feedbacks);
    res.status(201).json({ success: true, data: newFeedback });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengirim pesan anonim.' });
  }
});

// ================= ADMIN AUTH & ROUTES =================

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Password Admin salah!' });
  }
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '6h' });
  res.json({ success: true, token });
});

app.get('/api/admin/verify', verifyAdmin, (req, res) => {
  res.json({ valid: true });
});

// Tambah / Hapus Event
app.post('/api/admin/events', verifyAdmin, async (req, res) => {
  const list = await getCollection('wa_events');
  const item = { _id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  list.unshift(item);
  await saveCollection('wa_events', list);
  res.json(item);
});

app.delete('/api/admin/events/:id', verifyAdmin, async (req, res) => {
  const list = await getCollection('wa_events');
  await saveCollection('wa_events', list.filter(i => i._id !== req.params.id));
  res.json({ deleted: true });
});

// Tambah / Hapus Rules
app.post('/api/admin/rules', verifyAdmin, async (req, res) => {
  const list = await getCollection('wa_rules');
  const item = { _id: Date.now().toString(), ...req.body };
  list.push(item);
  // Urutkan berdasarkan nomor aturan
  list.sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
  await saveCollection('wa_rules', list);
  res.json(item);
});

app.delete('/api/admin/rules/:id', verifyAdmin, async (req, res) => {
  const list = await getCollection('wa_rules');
  await saveCollection('wa_rules', list.filter(i => i._id !== req.params.id));
  res.json({ deleted: true });
});

// Tambah / Hapus Album
app.post('/api/admin/albums', verifyAdmin, async (req, res) => {
  const list = await getCollection('wa_albums');
  const item = { _id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
  list.unshift(item);
  await saveCollection('wa_albums', list);
  res.json(item);
});

app.delete('/api/admin/albums/:id', verifyAdmin, async (req, res) => {
  const list = await getCollection('wa_albums');
  await saveCollection('wa_albums', list.filter(i => i._id !== req.params.id));
  res.json({ deleted: true });
});

// Hapus Pesan Saran Anonim
app.delete('/api/admin/feedback/:id', verifyAdmin, async (req, res) => {
  const list = await getCollection('wa_feedbacks');
  await saveCollection('wa_feedbacks', list.filter(i => i._id !== req.params.id));
  res.json({ deleted: true });
});

module.exports = app;