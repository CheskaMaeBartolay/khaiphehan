# Kai Phe — Coffee Shop

Production-style React + Vite + Supabase starter for a Filipino neighborhood coffee shop.

## Stack

- React 18 + Vite
- React Router
- Supabase Auth + PostgreSQL + RLS
- Lucide icons
- Vercel-ready SPA routing
- PayMongo-ready payment architecture

## 1. Install

```bash
npm install
npm run dev
```

## 2. Supabase

Create a Supabase project, then run:

`supabase/schema.sql`

in the Supabase SQL Editor.

Create Storage bucket:

- `product-images` — public bucket for product photos

The SQL includes RLS policies for customer-owned data and admin access.

### Create an admin

1. Create the admin account through Supabase Auth.
2. Copy the user's UUID.
3. In SQL Editor:

```sql
insert into public.profiles (id, full_name, email, role)
values ('USER_UUID', 'Kai Phe Admin', 'admin@example.com', 'admin')
on conflict (id) do update set role = 'admin';
```

Never expose a service-role key in the browser.

## 3. Environment

Copy `.env.example` to `.env.local` and set:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Only public Supabase values belong in Vite frontend env variables.

## 4. QR payment + receipt verification

GCash and Maya are handled as manual QR payments. The checkout shows the configured QR image, asks the customer to pay the displayed total, and requires a payment receipt upload.

Set these public frontend variables:

```env
VITE_GCASH_QR_URL=...
VITE_MAYA_QR_URL=...
```

The receipt itself is uploaded directly from the authenticated browser to the private Supabase Storage bucket `payment-receipts`. The database stores only the private `receipt_path` in `payments`. Admins receive short-lived signed URLs when viewing an order.

Recommended workflow:

1. Customer chooses GCash or Maya.
2. Customer scans the Kai Phe QR and pays the exact order total.
3. Customer uploads the receipt.
4. Kai Phe creates the order with `payment_status = pending`.
5. The receipt is stored privately in Supabase Storage.
6. Admin checks the receipt and manually verifies the payment.
7. Admin can update the order status and payment status from the dashboard.

Do not mark a payment as paid from the browser. Verification should remain an admin action.

## 5. Vercel

Import this repository/project into Vercel.

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Add the same public Vite environment variables in Vercel Project Settings.

The included `vercel.json` rewrites client routes to `index.html`.

## Customer flow

Home → Auth → Menu → Product → Cart → Checkout → Order Confirmation → Orders → Account

## Admin flow

`/admin` → admin authorization → Overview / Orders / Products / Sales

The storefront intentionally has no Admin navigation button.

## Notes

- Product images use Supabase Storage.
- Cart is persisted in the browser and synced to the authenticated user's Supabase cart.
- Order totals are calculated again at checkout from current database product prices.
- RLS is the security boundary; UI hiding is not treated as authorization.
- Payment gateway code is intentionally server-side architecture, because secret payment credentials must never ship to a browser.
