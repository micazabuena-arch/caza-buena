import './config/network.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { corsOptions } from './config/cors.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedAdminUser, seedMenuItems } from './config/seed.js';
import { UPLOADS_DIR } from './utils/fileUpload.js';
import { isCloudinaryConfigured } from './config/cloudinary.js';
import { isSmtpConfigured } from './services/email.js';
import pool from './config/database.js';
import { ensureFrontendBuilt } from './config/ensureFrontendBuilt.js';
import { mountFrontend } from './config/serveFrontend.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes from './routes/auth.js';
import roomsRoutes from './routes/rooms.js';
import bookingsRoutes from './routes/bookings.js';
import amenitiesRoutes from './routes/amenities.js';
import galleryRoutes from './routes/gallery.js';
import paymentRoutes from './routes/paymentMethods.js';
import contactRoutes from './routes/contact.js';
import faqRoutes from './routes/faq.js';
import menuRoutes from './routes/menu.js';
import policiesRoutes from './routes/policies.js';
import settingsRoutes from './routes/settings.js';
import whatsNewRoutes from './routes/whatsNew.js';
import adminRoutes from './routes/admin.js';
import bookingAddonsRoutes from './routes/bookingAddons.js';
import quotationsRoutes from './routes/quotations.js';

dotenv.config();

try {
  ensureFrontendBuilt();
} catch (err) {
  console.error('Frontend build skipped:', err.message);
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors(corsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Locally stored uploads (payment proofs, gallery, QR codes)
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', async (_req, res) => {
  let database = 'connected';
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    database = 'error';
    console.error('Database health check failed:', e.message);
  }

  res.json({
    status: 'ok',
    name: 'Caza Buena API',
    database,
    cloudinary: isCloudinaryConfigured() ? 'connected' : 'local uploads only',
    smtp: isSmtpConfigured() ? 'configured' : 'missing',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/amenities', amenitiesRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/payment-methods', paymentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/policies', policiesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/whats-new', whatsNewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/booking-addons', bookingAddonsRoutes);
app.use('/api/quotations', quotationsRoutes);

mountFrontend(app);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
  }
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

async function start() {
  try {
    await seedAdminUser();
    await seedMenuItems();
  } catch (e) {
    console.warn('Seed skipped (database may not be ready):', e.message);
  }

  app.listen(PORT, () => {
    console.log(`Caza Buena API running on http://localhost:${PORT}`);
  });
}

start();
