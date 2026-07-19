# Bhavani Pickles - Project Documentation

An e-commerce platform for selling traditional Telugu pickles, snacks, and sweets online. Built with Angular (frontend) and NestJS (backend).

**Live**: [bhavanipickles.com](https://www.bhavanipickles.com)
**Staging**: [bhavani-pickles-testing.onrender.com](https://bhavani-pickles-testing.onrender.com)

---

## Table of Contents

- [Architecture](#architecture)
- [Repositories](#repositories)
- [Tech Stack](#tech-stack)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Backend API Modules](#backend-api-modules)
- [Frontend Features](#frontend-features)
- [Third-Party Integrations](#third-party-integrations)
- [Deployment](#deployment)
- [Git Workflow](#git-workflow)
- [Database Migrations](#database-migrations)
- [SSR (Server-Side Rendering)](#ssr-server-side-rendering)
- [Work Completed](#work-completed)
- [Pending / Future Work](#pending--future-work)

---

## Architecture

```
┌──────────────────┐       ┌──────────────────┐       ┌────────────┐
│   Angular 21     │──────>│   NestJS 11      │──────>│  MongoDB   │
│   (SSR + SPA)    │  API  │   REST API       │       │  (Mongoose)│
│   Tailwind CSS   │       │   /api/*         │       └────────────┘
└──────────────────┘       └──────────────────┘
        │                          │
        │                    ┌─────┴──────┐
        │                    │            │
   Cloudinary          Razorpay     Shiprocket
   (Images)           (Payments)   (Shipping)
                           │
                        Resend
                       (Emails)
```

## Repositories

| Repo | URL | Branch Strategy |
|------|-----|----------------|
| Frontend | [Bhavani508/bhavani-pickles-v3-frontend](https://github.com/Bhavani508/bhavani-pickles-v3-frontend) | `dev` -> `staging` -> `main` |
| Backend | [Bhavani508/bhavani-pickles-v3-backend](https://github.com/Bhavani508/bhavani-pickles-v3-backend) | `dev` -> `staging` -> `main` |

## Tech Stack

### Frontend
- **Framework**: Angular 21.2.x (standalone components)
- **Styling**: Tailwind CSS + custom SCSS
- **SSR**: `@angular/ssr` with Express server
- **Charts**: Chart.js (admin dashboard)
- **Path Aliases**: `@app/*` -> `src/app/*`, `@env/*` -> `src/environments/*`

### Backend
- **Framework**: NestJS 11
- **Database**: MongoDB with Mongoose 9
- **Auth**: JWT (access + refresh tokens) with bcryptjs
- **Logging**: nestjs-pino (pino-pretty in dev, JSON in prod)
- **Rate Limiting**: @nestjs/throttler (100/min global, stricter on auth endpoints)
- **Validation**: class-validator + class-transformer
- **API Docs**: Swagger (`/api/docs`)
- **Security**: Helmet, CORS

### Infrastructure
- **Hosting**: Render (Docker containers)
- **Database**: MongoDB Atlas
- **File Storage**: Cloudinary
- **Domain**: bhavanipickles.com

---

## Local Setup

### Prerequisites
- Node.js v20+ (v24 works, v24.15+ needed for Angular CLI updates)
- MongoDB running locally on port 27017
- Git

### Backend

```bash
cd bhavani-pickles-v3-backend
cp .env.example .env          # Edit with your values
npm install
npm run start:dev             # Runs on http://localhost:3000
```

API base URL: `http://localhost:3000/api`
Swagger docs: `http://localhost:3000/api/docs`

### Frontend

```bash
cd bhavani-pickles-v3-frontend
npm install
npm start                     # Runs on http://localhost:4200
```

For SSR mode:
```bash
npm run build
npm run serve:ssr             # Runs SSR server
```

---

## Environment Variables

### Backend (`.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | `development`, `staging`, or `production` | Yes (default: development) |
| `PORT` | Server port | Yes (default: 3000) |
| `MONGO_URL` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret for access tokens | Yes |
| `JWT_EXPIRES_IN` | Access token TTL (e.g., `15m`) | Yes |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | Yes |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (e.g., `7d`) | Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Yes |
| `RAZORPAY_KEY_ID` | Razorpay key ID | Yes |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | Yes |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret | No |
| `RESEND_API_KEY` | Resend API key for emails | No |
| `FROM_EMAIL` | Sender email (e.g., `no-reply@bhavanipickles.com`) | No |
| `ENABLE_EMAILS` | Set to `true` to enable email sending | No |
| `SHIPROCKET_EMAIL` | Shiprocket API user email | No |
| `SHIPROCKET_PASSWORD` | Shiprocket API user password (use `""` if special chars) | No |
| `SHIPROCKET_WEBHOOK_TOKEN` | Optional token for webhook auth | No |
| `SHIPROCKET_PICKUP_LOCATION` | Pickup address name in Shiprocket (default: `Primary`) | No |
| `FRONTEND_URL` | Frontend URL for CORS and email links | Yes |

### Frontend (Environment Files)

Located in `src/environments/`:

| File | `apiUrl` | `razorpayKeyId` |
|------|----------|-----------------|
| `environment.ts` (dev) | `http://localhost:3000/api` | Test key |
| `environment.staging.ts` | `https://bhavani-pickles-api-testing.onrender.com/api` | Test key |
| `environment.prod.ts` | `https://api.bhavanipickles.com/api` | Live key |

---

## Backend API Modules

### Auth (`/api/auth`)
- `POST /register` — User registration
- `POST /login` — Login (returns access + refresh tokens)
- `POST /refresh` — Refresh access token
- `POST /forgot-password` — Send password reset email
- `POST /reset-password` — Reset password with token
- Rate limits: login 10/min, register 5/min, forgot-password 3/min

### Users (`/api/users`)
- `GET /me` — Get current user profile
- `PATCH /me` — Update profile
- `GET /` — List all users (admin)
- `PATCH /:id/role` — Update user role (admin)

### Products (`/api/products`)
- `GET /` — List products (search, filter by category/tags, sort, paginate)
- `GET /tags` — Get distinct product tags
- `GET /best-sellers` — Get best seller products
- `GET /:slug` — Get product by slug
- `POST /` — Create product (admin)
- `PATCH /:id` — Update product (admin)
- `DELETE /:id` — Delete product (admin)
- `PATCH /:id/best-seller` — Toggle best seller flag (admin)

### Categories (`/api/categories`)
- Full CRUD for product categories (admin)
- `GET /` — Public list

### Cart (`/api/cart`)
- `GET /` — Get user's cart
- `POST /add` — Add item to cart
- `PATCH /update` — Update item quantity
- `DELETE /remove` — Remove item
- `DELETE /clear` — Clear cart

### Orders (`/api/orders`)
- `POST /initiate` — Create order + Razorpay order (supports guest checkout)
- `POST /:id/verify-payment` — Verify Razorpay payment signature
- `GET /my` — User's orders
- `GET /:id` — Order details
- `PATCH /:id/status` — Update order status (admin)
- `PATCH /:id/cancel` — Cancel order (user or admin)
- `GET /dashboard-stats` — Revenue, order counts, daily stats (admin)
- `GET /:id/invoice` — Download invoice PDF
- `POST /:id/ship` — Ship order via Shiprocket (admin)
- `GET /:id/tracking` — Get live tracking from Shiprocket
- `GET /:id/label` — Get shipping label URL (admin)

### Webhooks
- `POST /api/webhook/razorpay` — Razorpay payment webhook
- `POST /webhook/shiprocket` — Shiprocket status update webhook

### Upload (`/api/upload`)
- `POST /image` — Upload image to Cloudinary

### Wishlist
- Managed via user document (array of product IDs)

---

## Frontend Features

### Public Pages
- **Home** — Hero banner, featured products, best sellers
- **Products** — Product listing with search, category filter, tag filter, sorting
- **Product Detail** — Image gallery, variant picker, add to cart, wishlist
- **Best Sellers** — Dedicated best sellers page
- **About, Contact, Privacy, Terms, Shipping** — Static/info pages
- **Order Status** — Track order by ID (guest-friendly)

### Auth
- Login, Register, Forgot Password, Reset Password
- JWT-based with automatic token refresh
- Guest checkout support (no account required)

### Customer Features
- **Cart** — Add/update/remove items, quantity control, variant selection
- **Wishlist** — Save products for later
- **Checkout** — Shipping address form, COD or online payment (Razorpay)
- **Orders** — Order history, order detail with tracking timeline
- **Profile** — View/edit profile, manage addresses
- **Invoice Download** — PDF invoice for each order

### Admin Panel (`/admin`)
- **Dashboard** — Revenue chart (Chart.js), order stats, status breakdown
- **Products** — CRUD with image upload, variants (weight/price/stock), bulk actions (in stock/out of stock/best seller/delete), dropdown action menu
- **Categories** — CRUD
- **Orders** — List with status filter, order detail with status stepper, cancel with reason, ship via Shiprocket
- **Users** — List, role management

### Core Services
| Service | Purpose |
|---------|---------|
| `AuthService` | JWT auth, login/register/logout, token refresh |
| `CartService` | Cart CRUD, localStorage sync |
| `WishlistService` | Wishlist CRUD, localStorage sync |
| `OrdersService` | Order operations, shipping, invoice download |
| `ProductsService` | Product CRUD, search, filters |
| `CategoriesService` | Category CRUD |
| `RazorpayService` | Payment modal integration |
| `SeoService` | Dynamic meta tags, OG tags, JSON-LD |
| `ToastService` | Toast notifications |
| `ConfirmService` | Confirmation dialog |
| `LoaderService` | Global loading indicator |
| `UploadService` | Image upload to Cloudinary |

---

## Third-Party Integrations

### Razorpay (Payments)
- **Flow**: Create order -> Open Razorpay modal -> Verify payment signature on backend
- **Modes**: Online (Razorpay) and Cash on Delivery (COD)
- **Webhook**: `POST /api/webhook/razorpay` for async payment verification
- **Status**: Working with test keys. Replace with live keys for production.
- **Dashboard**: [dashboard.razorpay.com](https://dashboard.razorpay.com)

### Shiprocket (Shipping / Courier)
- **API User**: Created separately from dashboard login (Settings -> API -> Create API User)
- **API User Email**: `api@bhavanipickles.com`
- **Auth**: Email/password -> Bearer token (valid 10 days, auto-refreshed)
- **Flow**: Admin clicks "Ship via Shiprocket" -> Creates order -> Assigns courier -> Gets AWB -> Schedules pickup
- **Test Mode**: In non-production environments (`NODE_ENV != production`), orders are created on Shiprocket and immediately cancelled to prevent real pickups
- **Webhook**: Configure at Shiprocket Settings -> Webhooks with URL `https://api.bhavanipickles.com/webhook/shiprocket`
- **No Sandbox**: Shiprocket has no test/sandbox mode. Test safely by creating and cancelling orders before pickup.
- **Dashboard**: [app.shiprocket.in](https://app.shiprocket.in)
- **API Docs**: [apidocs.shiprocket.in](https://apidocs.shiprocket.in)

### Resend (Transactional Email)
- **Sender**: `no-reply@bhavanipickles.com`
- **Templates**: Order confirmation, status updates, password reset
- **Toggle**: Set `ENABLE_EMAILS=true` in `.env` to enable
- **Dashboard**: [resend.com](https://resend.com)

### Cloudinary (Image Storage)
- **Usage**: Product images uploaded via admin panel
- **Folder Structure**: `bhavani-pickles/{NODE_ENV}/{folder}`
- **Dashboard**: [cloudinary.com](https://cloudinary.com)

---

## Deployment

### Render Setup

Both frontend and backend are deployed as Docker containers on Render.

| Service | Type | Branch | URL |
|---------|------|--------|-----|
| Backend (staging) | Web Service | `staging` | `bhavani-pickles-api-testing.onrender.com` |
| Backend (prod) | Web Service | `main` | `api.bhavanipickles.com` |
| Frontend (staging) | Web Service | `staging` | `bhavani-pickles-testing.onrender.com` |
| Frontend (prod) | Web Service | `main` | `bhavanipickles.com` |

### Docker

**Backend** (`Dockerfile`):
- Multi-stage build: `npm ci` + `nest build` -> production image with `node dist/main`
- Exposes port 3000

**Frontend** (`Dockerfile` / `Dockerfile.staging`):
- Multi-stage build: `npm ci` + `ng build` -> production image with `node dist/frontend/server/server.mjs` (SSR)
- Exposes port 8080
- Staging uses `Dockerfile.staging` with `ng build --configuration staging`

### Render Environment Variables

Must be set in Render dashboard for each service. Key differences from local:
- `NODE_ENV` = `staging` or `production`
- `MONGO_URL` = MongoDB Atlas connection string (not localhost)
- `FRONTEND_URL` = Deployed frontend URL
- Shiprocket password: Do NOT wrap in quotes (Render handles raw values)

---

## Git Workflow

```
dev  ──>  staging  ──>  main
(work)    (testing)     (production)
```

1. All development happens on `dev` branch
2. Create PR from `dev` -> `staging` for testing
3. After testing, merge `staging` -> `main` for production
4. Before starting new work, always pull staging into dev: `git fetch origin staging && git merge origin/staging`
5. **Do NOT push directly to staging or main** — pushing triggers rebuilds on Render
6. After PRs are merged, sync dev with staging: `git fetch origin staging && git merge origin/staging && git push origin dev`

---

## Database Migrations

Using `migrate-mongo`:

```bash
# Create a new migration
npm run migrate:create -- <migration-name>

# Run pending migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Check migration status
npm run migrate:status
```

Config: `migrate-mongo-config.js` (reads `MONGO_URL` from `.env`)
Migrations directory: `migrations/`

---

## SSR (Server-Side Rendering)

Angular SSR is configured for SEO on public pages while keeping auth-protected pages client-only.

### Route Rendering Modes

| Pages | Mode | Reason |
|-------|------|--------|
| Home, Products, Product Detail, About, Contact, etc. | `RenderMode.Server` | SEO, faster initial load |
| Admin, Auth, Cart, Checkout, Orders, Profile, Wishlist | `RenderMode.Client` | No SEO needed, uses localStorage |

### SSR Safety Patterns

- All `localStorage` / `window` / `document` access is guarded with `isPlatformBrowser()`
- `window.history.back()` replaced with Angular `Location.back()` across all components
- `RazorpayService` returns error on server
- HTTP uses `withFetch()` for SSR compatibility
- Client hydration enabled with `provideClientHydration(withEventReplay())`

### Key SSR Files
- `src/main.server.ts` — Server bootstrap
- `src/app/app.config.server.ts` — Server providers
- `src/app/app.routes.server.ts` — Route render mode config
- `src/server.ts` — Express server with `AngularNodeAppEngine`

---

## Work Completed

### Core E-commerce
- [x] Product catalog with categories, search, sorting, pagination
- [x] Product variants (weight/price/stock per variant)
- [x] Shopping cart (logged-in users synced to DB, guests use localStorage)
- [x] Wishlist
- [x] Checkout with shipping address
- [x] Razorpay payment integration (online + COD)
- [x] Order management with status progression (pending -> confirmed -> processing -> shipped -> delivered)
- [x] Order cancellation with reason
- [x] Invoice PDF generation and download
- [x] Guest checkout (no account required)

### Admin Panel
- [x] Dashboard with revenue charts and order stats
- [x] Product CRUD with image upload and variant management
- [x] Bulk product actions (in stock/out of stock, best seller, delete)
- [x] Dropdown action menu (consolidated from inline buttons)
- [x] Category management
- [x] Order management with status updates
- [x] User management and role assignment

### Auth & Security
- [x] JWT authentication with refresh token rotation
- [x] Role-based access control (user/admin)
- [x] Forgot/reset password via email
- [x] Rate limiting on auth endpoints
- [x] Helmet security headers
- [x] CORS configuration

### SEO & Performance
- [x] Angular SSR for public pages
- [x] SeoService for dynamic meta/OG/JSON-LD tags
- [x] robots.txt and sitemap.xml
- [x] `isPlatformBrowser` guards for SSR compatibility

### Shipping (Shiprocket)
- [x] ShiprocketService with token caching
- [x] Order creation, courier assignment, pickup scheduling
- [x] Tracking and label generation endpoints
- [x] Webhook controller for status updates
- [x] Test mode (auto-cancel in non-production)
- [x] Admin UI: "Ship via Shiprocket" button
- [x] Shipping details card (courier, AWB, tracking link) on order detail

### Infrastructure
- [x] Docker containerization (multi-stage builds)
- [x] Render deployment (staging + production)
- [x] Pino structured logging
- [x] Database migration framework (migrate-mongo)
- [x] Transactional emails via Resend
- [x] Environment validation with Joi

### Other Features
- [x] Best sellers page with admin toggle
- [x] Product tags filter
- [x] Environment API URL mismatch warnings
- [x] Stock management drawer in admin

---

## Pending / Future Work

- [ ] **Razorpay live keys** — Replace test keys with live keys and verify webhooks
- [ ] **Shiprocket webhook setup** — Configure webhook URL in Shiprocket dashboard for production
- [ ] **Shiprocket production test** — Verify real shipment creation flow in production
- [ ] **Email templates** — Improve HTML email templates
- [ ] **Product reviews/ratings** — Customer reviews on products
- [ ] **Coupon/discount system** — Promo codes and discounts
- [ ] **Search improvements** — Full-text search, filters by price range
- [ ] **Analytics** — Google Analytics / custom analytics
- [ ] **PWA** — Progressive Web App support
- [ ] **Automated tests** — Unit and e2e tests for critical flows
- [ ] **CI/CD pipeline** — Automated testing before deploy
- [ ] **Image optimization** — Responsive images, lazy loading improvements
- [ ] **Multi-language support** — Telugu / Hindi translations
