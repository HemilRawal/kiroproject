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
  "full_name":  "Rahul Sharma",       // required, min 2 chars
  "email":      "rahul@example.com",  // required, valid email
  "password":   "Pass1234",           // required, min 8 chars, 1 letter + 1 number
  "phone":      "9876543210",         // optional
  "role":       "buyer"               // optional: "buyer" (default) | "manufacturer"
}

Response 201:
{
  "success": true,
  "token":   "<jwt_token>",
  "user": {
    "id":         "uuid",
    "email":      "rahul@example.com",
    "full_name":  "Rahul Sharma",
    "role":       "buyer",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### POST /api/auth/login
```json
Request:
{
  "email":    "rahul@example.com",  // required
  "password": "Pass1234"            // required
}

Response 200:
{
  "success": true,
  "token":   "<jwt_token>",
  "user":    { ...same as register }
}
```

### GET /api/auth/me
```
Headers: Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "user": {
    "id", "email", "full_name", "phone", "role", "is_verified", "created_at"
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
| 401  | Unauthorized (no token / wrong password) |
| 403  | Forbidden (wrong role) |
| 404  | Not found |
| 409  | Conflict (duplicate email, etc.) |
| 429  | Too many requests (rate limited) |
| 500  | Server error |
