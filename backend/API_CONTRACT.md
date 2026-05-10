# Bharat Modules — API Contract

This file is the source of truth for what the frontend must send to each endpoint.
Frontend developers must follow these field names exactly.

Base URL (development): `http://localhost:4000`
Base URL (production):  `https://api.bharatmodules.com`

All requests/responses are JSON.
Protected routes require: `Authorization: Bearer <token>` header.

---

## AUTH

### POST /api/auth/register
```json
Request:
{
  "full_name":     "Rahul Sharma",       // required, min 2 chars
  "email":         "rahul@example.com",  // required, valid email, unique across BOTH tables
  "password":      "Pass1234",           // required, min 8 chars, 1 letter + 1 number
  "phone":         "9876543210",         // optional
  "company_name":  "ABC Corp",           // optional
  "role":          "buyer"               // REQUIRED: "buyer" | "manufacturer"
}

Response 201:
{
  "success": true,
  "message": "Account created. Please check your email for the verification code.",
  "requiresVerification": true,
  "email": "rahul@example.com",
  "role": "buyer"
}
```
**Note:** No JWT token is returned on registration. User must verify email first.

### POST /api/auth/verify-email
```json
Request:
{
  "email": "rahul@example.com",   // required
  "otp":   "123456",              // required, 6-digit numeric string
  "role":  "buyer"                // required: "buyer" | "manufacturer"
}

Response 200:
{
  "success": true,
  "message": "Email verified successfully.",
  "token":   "<jwt_token>",
  "user": {
    "id":             "uuid",
    "email":          "rahul@example.com",
    "full_name":      "Rahul Sharma",
    "role":           "buyer",
    "email_verified": true,
    "created_at":     "2024-01-01T00:00:00Z"
  }
}
```

### POST /api/auth/resend-otp
```json
Request:
{
  "email": "rahul@example.com",  // required
  "role":  "buyer"               // required: "buyer" | "manufacturer"
}

Response 200:
{
  "success": true,
  "message": "A new verification code has been sent to your email."
}
```

### POST /api/auth/login
```json
Request:
{
  "email":    "rahul@example.com",  // required
  "password": "Pass1234",           // required
  "role":     "buyer"               // REQUIRED: "buyer" | "manufacturer"
}

Response 200 (success):
{
  "success": true,
  "token":   "<jwt_token>",
  "user":    { ...same as verify-email response }
}

Response 403 (email not verified):
{
  "success": false,
  "message": "Please verify your email before logging in. A new verification code has been sent.",
  "requiresVerification": true,
  "email": "rahul@example.com",
  "role": "buyer"
}

Response 401 (wrong role):
{
  "success": false,
  "message": "This email is registered as a manufacturer, not as a buyer. Please switch to manufacturer login.",
  "suggestedRole": "manufacturer"
}
```

### GET /api/auth/me
```
Headers: Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "user": {
    "id", "email", "full_name", "phone", "company_name", "role", "email_verified", "phone_verified", "created_at"
  }
}
```

---

## RFQ

### GET /api/rfq/track/:rfqNumber  ← PUBLIC, no login needed
```
Example: GET /api/rfq/track/RFQ-2024-00001

Response 200:
{
  "success": true,
  "rfq": {
    "rfq_number":          "RFQ-2024-00001",
    "status":              "under_review",
    "status_label":        "Under Review",
    "status_description":  "Our team is reviewing your requirements.",
    "submitted_at":        "2024-01-01T00:00:00Z",
    "last_updated":        "2024-01-02T00:00:00Z",
    "items": [
      { "product_name": "Solar Panel 400W", "quantity": 100, "unit": "units" }
    ]
  }
}
```

### POST /api/rfq  ← Buyer only
```json
Request:
{
  "items": [                          // required, array, min 1 item
    {
      "product_id":   "uuid",         // optional (if known)
      "product_name": "Solar Panel",  // required
      "sku":          "SP-400W",      // optional
      "quantity":     100,            // required, integer > 0
      "unit":         "units",        // optional, default "units"
      "notes":        "Grade A only"  // optional
    }
  ],
  "notes":            "Urgent order",         // optional
  "delivery_state":   "Maharashtra",          // optional
  "delivery_pincode": "400001",               // optional
  "required_by":      "2024-03-01"            // optional, date string
}

Response 201:
{
  "success":    true,
  "rfq_number": "RFQ-2024-00001",
  "rfq_id":     "uuid"
}
```

### GET /api/rfq/my  ← Buyer only
```
Response 200:
{
  "success": true,
  "rfqs": [ ...array of RFQ objects with items ]
}
```

---

## PRODUCTS

### GET /api/products  ← Public
```
Query params (all optional):
  ?category=solar-panels
  ?search=400W
  ?page=1
  ?limit=20

Response 200:
{
  "success": true,
  "products": [ ...array ],
  "pagination": { "page": 1, "limit": 20, "total": 150 }
}
```

### GET /api/products/categories  ← Public
```
Response 200:
{
  "success": true,
  "categories": [
    { "id": "uuid", "name": "Solar Panels", "slug": "solar-panels" }
  ]
}
```

---

## ORDERS

### GET /api/orders/my  ← Buyer only
```
Response 200:
{
  "success": true,
  "orders": [
    {
      "id":             "uuid",
      "order_number":   "ORD-2024-00001",
      "status":         "manufacturing",
      "total_amount":   250000,
      "currency":       "INR",
      "confirmed_at":   "2024-01-01T00:00:00Z",
      "tracking_number": null,
      "manufacturers":  { "company_name": "ABC Solar Pvt Ltd" }
    }
  ]
}
```

---

## MANUFACTURERS

### POST /api/manufacturers/onboard  ← Any logged-in user
```json
Request:
{
  "company_name":    "ABC Solar Pvt Ltd",  // required
  "gstin":           "27AABCU9603R1ZX",    // required
  "msme_number":     "UDYAM-MH-01-0000001", // optional
  "pan_number":      "AABCU9603R",          // optional
  "company_address": "Plot 12, MIDC",       // optional
  "city":            "Pune",                // optional
  "state":           "Maharashtra",         // optional
  "pincode":         "411019",              // optional
  "website":         "https://abcsolar.in", // optional
  "description":     "Manufacturer of..."   // optional
}

Response 201:
{
  "success": true,
  "message": "Manufacturer profile created. Pending verification.",
  "manufacturer": { ...profile object }
}
```

---

## CONTACT

### POST /api/contact  ← Public
```json
Request:
{
  "name":         "Rahul Sharma",      // required
  "email":        "rahul@example.com", // required
  "phone":        "9876543210",        // optional
  "company":      "ABC Corp",          // optional
  "subject":      "Partnership query", // optional
  "message":      "I want to...",      // required
  "enquiry_type": "buyer"              // optional: "buyer" | "manufacturer" | "general"
}

Response 201:
{
  "success": true,
  "message": "Your enquiry has been received. We will respond within 24 hours."
}
```

---

## DATABASE TABLES

| Table | Purpose |
|-------|---------|
| `user_buyers` | Buyer accounts (email, password, verification status) |
| `user_manufacturers` | Manufacturer accounts (email, password, verification status) |
| `verification_otps` | Hashed OTP codes for email verification |
| `users` | Legacy table (kept for backward compatibility) |
| `manufacturers` | Extended manufacturer profiles (GSTIN, docs, verification) |
| `products` | Product listings |
| `rfqs` / `rfq_items` / `rfq_quotes` | RFQ workflow |
| `orders` / `order_documents` | Order management |
| `wishlists` | Product wishlists |
| `contact_enquiries` | Contact form submissions |

## ERROR RESPONSES (consistent shape for all errors)
```json
{
  "success": false,
  "message": "Human-readable error description"
}

// Validation errors return an array:
{
  "success": false,
  "errors": ["Full name must be at least 2 characters.", "..."]
}
```

## HTTP STATUS CODES USED
| Code | Meaning |
|------|---------| 
| 200  | OK |
| 201  | Created |
| 400  | Bad request (validation failed) |
| 401  | Unauthorized (no token / wrong password / wrong role) |
| 403  | Forbidden (email not verified) |
| 404  | Not found |
| 409  | Conflict (duplicate email) |
| 429  | Too many requests (rate limited) |
| 500  | Server error |
