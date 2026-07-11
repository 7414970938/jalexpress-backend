# JalExpress Backend

Water tanker booking app — backend API (Node.js + Express + MongoDB).

## What's included

- **Two-sided auth** — phone OTP login for Customers and Owners (separate flows, same endpoint pattern)
- **Owner APIs** — profile, price list, dashboard, earnings, order accept/reject/status
- **Customer APIs** — profile, addresses, browse suppliers, supplier detail
- **Order APIs** — book, track, history, cancel, reorder, rate
- Free-tier friendly: MongoDB Atlas free cluster, no paid SMS required for testing (dev mode returns OTP directly)

## Folder structure

```
backend/
  models/       -> User, Owner, Order, Otp (MongoDB schemas)
  routes/       -> authRoutes, customerRoutes, ownerRoutes, orderRoutes
  middleware/   -> auth.js (JWT protect + role restriction)
  config/       -> db.js (MongoDB connection)
  server.js     -> app entry point
```

## Setup (local testing)

1. Install dependencies:
   ```
   cd backend
   npm install
   ```

2. Create your `.env` file (copy from `.env.example`):
   ```
   cp .env.example .env
   ```

3. **Get a free MongoDB database:**
   - Go to https://www.mongodb.com/cloud/atlas/register
   - Create a free account -> Create a free "M0" cluster
   - Click "Connect" -> "Drivers" -> copy the connection string
   - Replace `<username>`, `<password>` in the string and paste into `.env` as `MONGODB_URI`
   - In Atlas, go to Network Access -> Add IP -> "Allow access from anywhere" (0.0.0.0/0) for now

4. Run the server:
   ```
   npm run dev
   ```
   Server starts at `http://localhost:5000`

5. Test it's working — open browser: `http://localhost:5000` should show `{"success":true,"message":"JalExpress API is running"}`

## Testing OTP login without SMS cost

In development mode, `/api/auth/send-otp` returns the OTP directly in the response (`devOtp` field) so you can test the full flow without paying for SMS. Once you're ready to send real SMS, sign up at twilio.com (free trial credit), add your credentials to `.env`, and let me know — I'll wire up the actual SMS sending code.

## API Endpoints Summary

### Auth (public)
- `POST /api/auth/send-otp` — { phone, role: 'customer'|'owner' }
- `POST /api/auth/verify-otp` — { phone, otp, role, name } -> returns JWT token

### Customer (needs Bearer token, role=customer)
- `GET /api/customer/me`
- `PUT /api/customer/profile`
- `POST /api/customer/address`
- `GET /api/customer/suppliers?search=&serviceType=&city=`
- `GET /api/customer/suppliers/:ownerId`

### Owner (needs Bearer token, role=owner)
- `GET /api/owner/me`
- `PUT /api/owner/profile`
- `PUT /api/owner/price-list`
- `PUT /api/owner/online-status`
- `GET /api/owner/dashboard`
- `GET /api/owner/orders?status=ongoing|completed|cancelled|all`
- `PUT /api/owner/orders/:orderId/status` — { status: 'accepted'|'rejected'|'in_transit'|'delivered' }
- `GET /api/owner/earnings?period=today|yesterday|last7days|lastmonth`

### Orders (needs Bearer token, either role)
- `POST /api/orders` — customer books a tanker
- `GET /api/orders/my?status=` — customer's order list
- `GET /api/orders/:orderId` — order detail / tracking
- `PUT /api/orders/:orderId/cancel`
- `POST /api/orders/:orderId/reorder`
- `POST /api/orders/:orderId/rate` — { stars, review }

## Deploying for free (once ready)

- **Render.com** (recommended, free tier): New -> Web Service -> connect your GitHub repo -> Build command `npm install` -> Start command `npm start` -> add your `.env` variables in the dashboard.
- **Railway.app** is also free-tier friendly as an alternative.

Note: Free tier backends "sleep" after ~15 mins of inactivity; first request after sleep takes ~30 seconds to wake up. Fine for testing/early users.
