# 🚪 PintuSatu Backend REST API
> Production-grade Indonesian Kost (Boarding House) Management SaaS Platform

Built with **Node.js (v20+ LTS)**, **TypeScript (Strict Mode)**, **Hono Framework**, **PostgreSQL**, **Drizzle ORM**, and **Zod**.

---

## 🚀 Key Features & Domain Architecture

1. **Multi-Tenant SaaS Architecture**:
   - Role-Based Access Control (**RBAC**): `superadmin`, `owner`, `penjaga` (staff), and `tenant`.
   - Subscription tiers with strict room quota enforcement (`starter`, `pro`, `enterprise`).
   - Superadmin Owner Impersonation JWT Token generator for zero-friction troubleshooting.
   - Platform MRR (Monthly Recurring Revenue) and ARR calculation.

2. **3-Mode Electricity Billing Engine (`src/modules/electricity`)**:
   - **Mode 1 (`token`)**: Prabayar PLN token system with nominal & admin fee tracking.
   - **Mode 2 (`meter`)**: Pascabayar sub-meter kWh difference reading with photo evidence and automatic formula:
     $$\text{Total} = ((\text{Current Reading} - \text{Previous Reading}) \times \text{Tarif/kWh}) + \text{Biaya Admin/Beban}$$
   - **Mode 3 (`flat`)**: Flat monthly electricity charge included or surcharged.

3. **Billing, Invoicing & Automated Penalties (`src/modules/billing`)**:
   - Monthly recurring invoice generation (single and batch for branch).
   - Automatically rolls unbilled electricity sub-meter readings into the monthly invoice.
   - Automated Overdue Penalty Engine with customizable daily flat fees (e.g., Rp 25.000/day) or percentage rates.
   - Multi-channel payment tracking (Bank Transfer, QRIS, Cash, Virtual Account, Midtrans, Xendit).

4. **Housekeeping & Asset Service Task Management (`src/modules/tasks`)**:
   - Assign cleaning, maintenance, inspection, and AC service tasks to staff/penjaga.
   - Before and after completion photo URLs.
   - Auto-dispatches post-checkout room cleaning and inventory inspection tasks.

5. **Petty Cash (Kas Kecil) & NOI Calculation (`src/modules/finance`)**:
   - Staff petty cash reimbursement claims with physical receipt image validation and owner review/approval flow.
   - Real-time **Net Operating Income (NOI)** and **Operating Expense Ratio (OER)** calculation engine for Kost Owners.

6. **Webhooks & Payment Gateway Integration (`src/modules/webhooks`)**:
   - Midtrans notification handler with SHA-512 signature verification.
   - Xendit webhook handler for instant settlement.
   - WhatsApp message dispatcher and status callback simulation.

---

## 📂 Directory Structure

```text
pintusatu-api/
├── .env.example                # Environment template
├── drizzle.config.ts           # Drizzle Kit configuration
├── package.json
├── tsconfig.json               # TypeScript configuration (Strict mode)
├── drizzle/                    # Generated SQL migrations
│   └── 0000_ordinary_emma_frost.sql
└── src/
    ├── index.ts                # Application entrypoint & HTTP server
    ├── config/
    │   ├── db.ts               # Postgres connection pooling
    │   └── env.ts              # Zod-validated environment config
    ├── db/
    │   ├── index.ts
    │   └── schema.ts           # Complete Drizzle relational PostgreSQL schema
    ├── middlewares/
    │   ├── auth.ts             # JWT verifier, role guards, tenant scoping
    │   ├── error-handler.ts    # Global error handling & DB constraint parser
    │   └── logger.ts           # High-performance request logger
    ├── modules/
    │   ├── auth/               # Register, login, staff onboarding, profile
    │   ├── branches/           # Kost properties, staff assignments, stats
    │   ├── rooms/              # Room inventory, facilities, status management
    │   ├── tenants/            # Tenant profiles, check-in, check-out flows
    │   ├── electricity/        # 3-mode electricity billing engine
    │   ├── billing/            # Invoices, payments, automated penalties
    │   ├── tasks/              # Staff housekeeping & asset service logs
    │   ├── finance/            # Kas kecil with receipt approval & NOI
    │   ├── webhooks/           # Midtrans, Xendit, and WhatsApp callbacks
    │   └── superadmin/         # Tenant suspension, MRR, impersonation token
    └── utils/
        ├── response.ts         # Standardized JSON response envelope
        └── seed.ts             # Indonesian Kost demo dataset seeder
```

---

## ⚙️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` based on `.env.example`:
```bash
cp .env.example .env
```
Default `.env` configuration:
```env
PORT=8000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pintusatu_db
JWT_SECRET=super-secret-jwt-token-key-pintusatu-indonesia-2026
JWT_EXPIRES_IN=7d
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 3. Database Migrations
Generate and run migrations using Drizzle Kit:
```bash
# Push schema directly to database
npm run db:push

# Or generate SQL migrations
npm run db:generate

# Drizzle Studio (Database GUI)
npm run db:studio
```

### 4. Seed Realistic Indonesian Kost Dataset
```bash
npm run seed
```
**Demo Accounts created by seeder:**
- **Superadmin**: `superadmin@pintusatu.id` / `Password123!`
- **Owner 1 (Kemang & BSD)**: `budi.santoso@gmail.com` / `Password123!`
- **Owner 2 (Dago Bandung)**: `citra.dewi@gmail.com` / `Password123!`
- **Penjaga 1**: `joko.penjaga@gmail.com` / `Password123!`
- **Penjaga 2**: `asep.staff@gmail.com` / `Password123!`

### 5. Run the Server
```bash
# Development (with auto-reload)
npm run dev

# Production Build & Run
npm run build
npm run start
```

---

## 📡 Standardized API Response Envelope

Every endpoint returns a consistent JSON envelope:

### Success Response:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Error Response:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed: Please check your input parameters",
  "errors": [
    {
      "path": "roomNumber",
      "message": "Room number is required"
    }
  ]
}
```

---

## 📚 REST API Routes Reference

### 1. Authentication (`/api/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register new Kost Owner |
| POST | `/api/auth/login` | Public | Authenticate user & get JWT |
| GET | `/api/auth/me` | Bearer | Get current authenticated user profile |
| PUT | `/api/auth/profile` | Bearer | Update profile details |
| PUT | `/api/auth/password` | Bearer | Change password |
| POST | `/api/auth/staff` | Owner | Create staff/penjaga and assign branches |
| GET | `/api/auth/staff` | Owner | List staff belonging to owner |

### 2. Kost Branches (`/api/branches`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/branches` | Staff/Owner | List accessible branches |
| GET | `/api/branches/:id` | Staff/Owner | Branch details |
| GET | `/api/branches/:id/stats` | Staff/Owner | Branch occupancy rate & revenue metrics |
| POST | `/api/branches` | Owner | Create Kost branch |
| PUT | `/api/branches/:id` | Owner | Update branch |
| DELETE | `/api/branches/:id` | Owner | Delete branch |
| POST | `/api/branches/:id/staff` | Owner | Assign penjaga to branch |
| DELETE | `/api/branches/:id/staff/:staffId` | Owner | Unassign penjaga |

### 3. Rooms (`/api/rooms`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/rooms` | Staff/Owner | List rooms (filters: status, branch, type, price) |
| GET | `/api/rooms/:id` | Staff/Owner | Room details with active lease & tasks |
| POST | `/api/rooms` | Owner | Create room (with SaaS quota check) |
| PUT | `/api/rooms/:id` | Owner | Update room specs & facilities |
| PATCH | `/api/rooms/:id/status` | Staff/Owner | Quick update status (`available`, `maintenance`, etc.) |
| DELETE | `/api/rooms/:id` | Owner | Delete room |

### 4. Tenants & Leases (`/api/tenants`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/tenants` | Staff/Owner | List tenants (search by name, phone, NIK) |
| GET | `/api/tenants/:id` | Staff/Owner | Tenant detail with past leases & invoices |
| POST | `/api/tenants` | Staff/Owner | Register new tenant profile |
| PUT | `/api/tenants/:id` | Staff/Owner | Update tenant profile |
| POST | `/api/tenants/check-in` | Staff/Owner | Check in tenant, create lease & initial invoice |
| POST | `/api/tenants/check-out` | Staff/Owner | Check out tenant, trigger cleaning task & refund |

### 5. Electricity Billing Engine (`/api/electricity`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/electricity/record` | Staff/Owner | Record reading (`token`, `meter`, or `flat`) |
| POST | `/api/electricity/preview` | Staff/Owner | Preview meter calculation before saving |
| GET | `/api/electricity/last/:roomId` | Staff/Owner | Fetch last recorded meter reading |
| GET | `/api/electricity/readings` | Staff/Owner | List reading history |
| GET | `/api/electricity/summary` | Staff/Owner | Monthly kWh and IDR consumption summary |

### 6. Invoices & Billing (`/api/billing`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/billing/invoices` | Staff/Owner | List invoices (status, branch, tenant filters) |
| GET | `/api/billing/invoices/:id` | Staff/Owner | Invoice breakdown & payment history |
| POST | `/api/billing/invoices/generate` | Staff/Owner | Generate invoice for single lease |
| POST | `/api/billing/invoices/batch` | Owner | Batch generate monthly invoices for branch |
| POST | `/api/billing/invoices/process-penalties` | Owner | Run automated overdue penalty calculations |
| POST | `/api/billing/payments` | Staff/Owner | Record payment (bank, QRIS, cash, gateway) |
| PUT | `/api/billing/payments/:id/verify` | Owner | Approve or reject payment proof |

### 7. Tasks & Housekeeping (`/api/tasks`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/tasks` | Staff/Owner | List housekeeping & maintenance tasks |
| GET | `/api/tasks/:id` | Staff/Owner | Task detail |
| POST | `/api/tasks` | Staff/Owner | Create task |
| PUT | `/api/tasks/:id` | Staff/Owner | Update task |
| POST | `/api/tasks/:id/complete` | Staff/Owner | Penjaga marks task completed with photo & cost |
| POST | `/api/tasks/:id/verify` | Owner | Owner marks task verified |

### 8. Finance & Kas Kecil (`/api/finance`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/finance/transactions` | Staff/Owner | List income, expense, and petty cash logs |
| POST | `/api/finance/transactions` | Owner | Record general income/expense |
| POST | `/api/finance/petty-cash` | Staff/Owner | Submit petty cash claim with receipt photo |
| PUT | `/api/finance/transactions/:id/review` | Owner | Approve or reject petty cash claim |
| GET | `/api/finance/noi` | Owner | Calculate NOI, Gross Income & OER |

### 9. Webhooks (`/api/webhooks`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/webhooks/midtrans` | Public | Midtrans payment notification callback |
| POST | `/api/webhooks/xendit` | Public | Xendit invoice paid callback |
| POST | `/api/webhooks/whatsapp` | Public | WhatsApp status callback |
| POST | `/api/webhooks/test-notification` | Bearer | Simulate WhatsApp reminder dispatch |
| GET | `/api/webhooks/logs` | Owner | View webhook activity audit logs |

### 10. Superadmin Platform Control (`/api/superadmin`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/superadmin/metrics` | Superadmin | Platform MRR, ARR, and inventory overview |
| GET | `/api/superadmin/owners` | Superadmin | List all SaaS owners and subscriptions |
| POST | `/api/superadmin/owners/:id/suspend` | Superadmin | Suspend owner access & properties |
| POST | `/api/superadmin/owners/:id/reactivate` | Superadmin | Reactivate suspended owner |
| PUT | `/api/superadmin/owners/:id/subscription` | Superadmin | Update room quota and subscription tier |
| POST | `/api/superadmin/impersonate` | Superadmin | Generate 2-hour JWT impersonation token |

---

## 🔒 Security Best Practices
- **Strict Role-Based Access Control**: Prevents horizontal and vertical privilege escalation.
- **Data Scoping**: Kost Owners and Staff can only query and mutate their own branch/tenant data.
- **Passwords**: Salted hashing with `bcryptjs` (work factor 10).
- **Zod Schema Validation**: Eliminates unexpected fields, ensures sanitization and type coercion.
- **HMAC / SHA-512 Verification**: Midtrans callbacks are verified against the configured server key.
