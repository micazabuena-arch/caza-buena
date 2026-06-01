# Caza Buena — Booking Management Website

A modern, mobile-responsive booking platform for **Caza Buena** resort in Alaminos, Pangasinan. Design follows the resort's Mediterranean / Santorini-inspired branding from their [Facebook page](https://www.facebook.com/profile.php?id=61557575977651).

## Features

### Guest website
- Home, About, Rooms, Amenities, Gallery, FAQ, Policies, Contact
- Online booking with room selection & availability check
- QR payment workflow (GCash, Maya, BDO, BPI) — no payment gateway
- Payment proof upload
- Booking acknowledgment emails (when SMTP configured)

### Admin dashboard (`/admin`)
- Secure login
- Dashboard stats
- Booking management (approve/reject after payment verification)
- Calendar view
- Room availability toggles
- Guest list
- Gallery CMS
- Discount codes

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS v4, React Router |
| Backend | Node.js, Express |
| Database | MySQL |
| Media | Cloudinary (optional) |
| Email | Nodemailer (SMTP) |

## Project structure

```
Caza Buena/
├── frontend/          # React public site + admin UI
├── backend/           # Express REST API
│   └── database/
│       ├── schema.sql
│       └── seed.sql
└── README.md
```

## Quick start (Windows + XAMPP)

1. Start **MySQL** in XAMPP Control Panel
2. Double-click or run: `.\start-dev.ps1` — opens API + website in two terminals
3. Open **http://localhost:5173**

> Uploads (payment proofs, gallery, QR codes) work **without Cloudinary** — files are stored locally in `backend/uploads/`.

## Setup

### 1. MySQL database

```bash
mysql -u root -p < backend/database/schema.sql
mysql -u root -p < backend/database/seed.sql
```

**Existing databases** — run resort room migrations (9 units: ROOM 101–303):

```bash
mysql -u root -p caza_buena < backend/database/migrations/add-resort-room-types.sql
mysql -u root -p caza_buena < backend/database/migrations/seed-resort-rooms.sql
mysql -u root -p caza_buena < backend/database/migrations/add-min-max-guests.sql
```

### 2. Backend

```bash
cd backend
copy .env.example .env
# Edit .env with DB credentials, JWT_SECRET, Cloudinary, SMTP

npm run dev
```

API runs at **http://localhost:5000**

Default admin (created on first API start):
- Email: `admin@cazabuena.com`
- Password: `Admin@12345` (change in production!)

### 3. Frontend

```bash
cd frontend
copy .env.example .env
npm run dev
```

Site runs at **http://localhost:5173** (API proxied via Vite)

## QR payment workflow

1. Guest submits booking → status `awaiting_payment`
2. Guest sees QR instructions on confirmation page
3. Guest uploads payment proof → status `payment_submitted`
4. Admin verifies in dashboard → Approve → `confirmed` + confirmation email

Upload QR images in the database or via admin (configure Cloudinary for image hosting).

## Environment variables

See `backend/.env.example` and `frontend/.env.example`.

**Required for full functionality:**
- MySQL connection
- `JWT_SECRET` for admin auth
- Cloudinary for image/proof uploads (production)
- SMTP for booking emails

## Production deployment

- Build frontend: `cd frontend && npm run build`
- Serve `frontend/dist` via Nginx/Apache
- Run API with PM2: `cd backend && npm start`
- Point `FRONTEND_URL` and `VITE_API_URL` to production domains

## Branding

- **Tagline:** Your home after the sea
- **Colors:** White + ocean blue (`#1E6B8C`, `#0D4F6C`)
- **Check-in:** 1:00 PM · **Check-out:** 11:00 AM
- **Location:** Sitio Inansuana, Brgy. Lucap, Alaminos, Pangasinan
