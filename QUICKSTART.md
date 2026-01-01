# Complii Development Quick Start

## How It Works

```
┌─────────────┐      HTTP       ┌─────────────┐      SQL       ┌──────────────┐
│   SDK       │  ──────────►   │   API       │  ──────────►   │   Supabase   │
│ @complii/sdk│   (REST)       │ apps/api    │                │   Database   │
└─────────────┘                └─────────────┘                └──────────────┘
```

- **SDK**: JavaScript client library your customers use
- **API**: Next.js server that handles requests
- **Supabase**: PostgreSQL database storing all data

---

## Step 1: Set Up Supabase

### Option A: Local (requires Docker)
```bash
pnpm supabase start
# This gives you local Supabase URL + keys
```

### Option B: Cloud (easier for testing)
1. Create project at https://supabase.com
2. Go to Project Settings → Database → Connection string
3. Run migrations:
```bash
pnpm supabase link --project-ref <your-ref>
pnpm supabase db push
```

---

## Step 2: Configure Environment

Create `apps/api/.env.local`:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

---

## Step 3: Create a Test Tenant

You need an API key to use the API. Run this in Supabase SQL Editor:

```sql
-- Generate a test tenant with API keys
INSERT INTO tenants (name, email, region, plan, status, live_api_key_hash, live_api_key_prefix, test_api_key_hash, test_api_key_prefix)
VALUES (
  'Test Company',
  'test@example.com',
  'AU',
  'starter',
  'active',
  -- These are bcrypt hashes. The actual keys are:
  -- Live: sk_live_testkey123456789
  -- Test: sk_test_testkey123456789
  '$2a$10$N9qo8uLOickgx2ZMRZoMye1234567890123456789012345678901234',
  'sk_live_testke',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye1234567890123456789012345678901234',
  'sk_test_testke'
);
```

**Or use this helper script** (create `scripts/create-tenant.ts`):
```typescript
import bcrypt from 'bcryptjs';

// Generate real keys
const liveKey = `sk_live_${crypto.randomUUID().replace(/-/g, '')}`;
const testKey = `sk_test_${crypto.randomUUID().replace(/-/g, '')}`;

console.log('Live Key:', liveKey);
console.log('Test Key:', testKey);
console.log('Live Hash:', bcrypt.hashSync(liveKey, 10));
console.log('Test Hash:', bcrypt.hashSync(testKey, 10));
console.log('Live Prefix:', liveKey.slice(0, 15));
console.log('Test Prefix:', testKey.slice(0, 15));
```

---

## Step 4: Start the API

```bash
pnpm dev
# API runs at http://localhost:3001
```

---

## Step 5: Test with cURL

### Health Check (no auth required)
```bash
curl http://localhost:3001/api/v1/health
```

### Screen a Name
```bash
curl -X POST http://localhost:3001/api/v1/sanctions/screen \
  -H "Authorization: Bearer sk_test_2e0c2c442c19f1ba7ef77685837775c1" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Smith"
  }'
```

### Create a Customer
```bash
curl -X POST http://localhost:3001/api/v1/customers \
  -H "Authorization: Bearer sk_test_2e0c2c442c19f1ba7ef77685837775c1" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "1@example.com",
    "firstName": "John1",
    "lastName": "Smith1"
  }'
```

### Create a Transaction
```bash
curl -X POST http://localhost:3001/api/v1/transactions \
  -H "Authorization: Bearer sk_test_2e0c2c442c19f1ba7ef77685837775c1" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cus_5b1e9a23-3910-46f9-ab59-c8dc9c6bd16b",
    "amount": 15000,
    "direction": "incoming",
    "type": "purchase"
  }'
```

### Risk Assessment
```bash
curl -X POST http://localhost:3001/api/v1/risk/assess \
  -H "Authorization: Bearer sk_test_2e0c2c442c19f1ba7ef77685837775c1" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cus_5b1e9a23-3910-46f9-ab59-c8dc9c6bd16b",
    "transactionAmount": 15000,
    "includeStructuringCheck": true
  }'
```

---

## Step 6: Test with SDK

Create a test file `test-sdk.ts`:

```typescript
import { Complii } from '@complii/sdk';

const complii = new Complii({
  apiKey: 'sk_test_testkey123456789',
  baseUrl: 'http://localhost:3001/api/v1', // Local dev
});

async function main() {
  // Screen someone
  const screening = await complii.sanctions.screen({
    firstName: 'John',
    lastName: 'Smith',
  });
  console.log('Screening:', screening);

  // Create customer
  const customer = await complii.customers.create({
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Smith',
  });
  console.log('Customer:', customer);

  // Create transaction
  const transaction = await complii.transactions.create({
    customerId: customer.id,
    amount: 15000,
    direction: 'incoming',
    type: 'purchase',
  });
  console.log('Transaction:', transaction);
  console.log('Requires TTR:', transaction.requiresTtr);

  // Risk assessment
  const risk = await complii.risk.assess({
    customerId: customer.id,
    transactionAmount: 15000,
    includeStructuringCheck: true,
  });
  console.log('Risk Score:', risk.riskScore);
  console.log('Risk Level:', risk.riskLevel);
}

main().catch(console.error);
```

Run it:
```bash
npx tsx test-sdk.ts
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/health` | Health check (no auth) |
| POST | `/v1/sanctions/screen` | Screen name against sanctions lists |
| POST | `/v1/customers` | Create customer |
| GET | `/v1/customers` | List customers |
| GET | `/v1/customers/:id` | Get customer |
| PATCH | `/v1/customers/:id` | Update customer |
| DELETE | `/v1/customers/:id` | Delete customer |
| POST | `/v1/transactions` | Create transaction |
| GET | `/v1/transactions` | List transactions |
| GET | `/v1/transactions/:id` | Get transaction |
| POST | `/v1/risk/assess` | Perform risk assessment |

---

## Response Examples

### Screening (match found)
```json
{
  "id": "scr_abc123",
  "object": "screening",
  "isMatch": true,
  "status": "potential_match",
  "matchScore": 0.85,
  "matches": [
    {
      "name": "John Smith",
      "matchScore": 0.85,
      "source": "DFAT",
      "referenceNumber": "DFAT-12345"
    }
  ],
  "sources": ["DFAT", "UN"]
}
```

### Transaction (TTR required)
```json
{
  "id": "txn_def456",
  "object": "transaction",
  "amount": 15000,
  "currency": "AUD",
  "requiresTtr": true,
  "ttrReference": "TTR-20251231-def456",
  "riskScore": 25,
  "riskLevel": "low"
}
```

### Risk Assessment
```json
{
  "object": "risk_assessment",
  "riskScore": 45,
  "riskLevel": "medium",
  "factors": [
    {"factor": "medium_transaction_amount", "score": 20, "reason": "Transaction exceeds TTR threshold"},
    {"factor": "new_customer", "score": 15, "reason": "Customer account less than 7 days old"}
  ],
  "flags": {
    "structuring": false,
    "requiresKyc": true,
    "requiresTtr": true,
    "requiresEnhancedDd": false
  }
}
```

---

# KYC Verification System

Complii provides a complete KYC (Know Your Customer) verification workflow supporting:
- **Stripe Identity** - Automated ID verification with document + selfie
- **Manual Verification** - Document upload with Australian certification requirements

## How KYC Integrates with Complii

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPLII COMPLIANCE FLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
     │   Customer   │         │     KYC      │         │  Sanctions   │
     │   Created    │ ──────► │ Verification │ ──────► │  Screening   │
     └──────────────┘         └──────────────┘         └──────────────┘
            │                        │                        │
            │                        │                        ▼
            │                        │                 ┌──────────────┐
            │                        │                 │    Risk      │
            │                        │                 │   Scoring    │
            │                        │                 └──────────────┘
            │                        │                        │
            ▼                        ▼                        ▼
     ┌──────────────────────────────────────────────────────────────┐
     │                      TRANSACTION MONITORING                   │
     │  • TTR Thresholds  • Structuring Detection  • Risk Flags     │
     └──────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                          ┌──────────────────┐
                          │     WEBHOOKS     │
                          │ Real-time alerts │
                          └──────────────────┘
```

### Integration Points

| Component | How KYC Integrates |
|-----------|-------------------|
| **Customers** | KYC updates `verification_status` field |
| **Sanctions Screening** | Auto-runs after successful verification |
| **Risk Scoring** | Unverified customers add +10 to risk score |
| **Transactions** | Can block high-value transactions for unverified customers |
| **Webhooks** | Sends `kyc.*` events for real-time monitoring |

---

## KYC API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/customers/:id/kyc` | Start KYC verification |
| GET | `/v1/customers/:id/kyc` | Get KYC status |
| POST | `/v1/customers/:id/kyc/documents` | Upload document |
| GET | `/v1/customers/:id/kyc/documents` | List documents |
| GET | `/v1/customers/:id/kyc/documents/:docId` | Get document |
| DELETE | `/v1/customers/:id/kyc/documents/:docId` | Delete document |
| GET | `/v1/identity-verifications` | List all verifications |
| GET | `/v1/identity-verifications/:id` | Get verification |
| POST | `/v1/identity-verifications/:id/review` | Admin approve/reject |

---

## Method 1: Stripe Identity (Automated)

Best for: Real-time verification with document + selfie matching.

### Step 1: Start Verification

```typescript
const verification = await complii.kyc.startVerification('cus_abc123', {
  provider: 'stripe_identity',
  returnUrl: 'https://yourapp.com/kyc-complete',
});

console.log(verification);
// {
//   id: 'ver_xyz789',
//   status: 'requires_input',
//   clientSecret: 'vs_xxx_secret_xxx',  // Use with Stripe.js
//   url: 'https://verify.stripe.com/...'  // Or redirect here
// }
```

### Step 2: Client-Side (Stripe.js)

```typescript
// In your frontend
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('pk_test_xxx');

// Option A: Modal
const { error } = await stripe.verifyIdentity(verification.clientSecret);

// Option B: Redirect
window.location.href = verification.url;
```

### Step 3: Handle Completion

Stripe sends webhook to `/v1/webhooks/stripe/identity`. Complii automatically:
1. Updates verification status to `verified` or `rejected`
2. Updates customer `verification_status`
3. Runs sanctions screening against verified name
4. Dispatches `kyc.verification_completed` webhook to your endpoint

```typescript
// Check status after redirect
const status = await complii.kyc.getStatus('cus_abc123');
console.log(status.status); // 'verified' | 'rejected' | 'requires_input'
```

### cURL Example

```bash
# Start Stripe Identity verification
curl -X POST http://localhost:3001/api/v1/customers/e57a2a72-6d78-4889-92ed-b5a0b1b9222b/kyc \
  -H "Authorization: Bearer sk_test_2e0c2c442c19f1ba7ef77685837775c1" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "stripe_identity",
    "returnUrl": "https://nonmanual-keegan-implied.ngrok-free.dev/"
  }'
```

---

## Method 2: Manual Document Verification

Best for: Offline verification, certified documents, or when Stripe Identity isn't available.

### Step 1: Start Manual Verification

```typescript
const verification = await complii.kyc.startVerification('cus_abc123', {
  provider: 'manual',
  documentTypes: ['passport', 'utility_bill'],  // Required documents
  requireCertification: true,  // Australian requirement
});

console.log(verification);
// {
//   id: 'ver_xyz789',
//   status: 'pending',
//   requiredDocuments: ['passport', 'utility_bill']
// }
```

### Step 2: Upload Documents

```typescript
// Upload certified passport
await complii.kyc.uploadDocument('cus_abc123', {
  file: passportFile,  // File or Blob
  documentType: 'passport',
  isCertified: true,
  certification: {
    certifierName: 'John Smith',
    certifierType: 'justice_of_peace',
    registrationNumber: 'JP12345',  // Required for some professions
    certificationDate: '2025-01-01',
  },
  verificationId: 'ver_xyz789',  // Link to verification
  expiryDate: '2030-06-15',
});

// Upload utility bill
await complii.kyc.uploadDocument('cus_abc123', {
  file: utilityBillFile,
  documentType: 'utility_bill',
  isCertified: true,
  certification: {
    certifierName: 'Jane Doe',
    certifierType: 'lawyer',
    registrationNumber: 'LAW789',
    certificationDate: '2025-01-01',
  },
  verificationId: 'ver_xyz789',
});
```

### Step 3: Admin Review

```typescript
// List pending verifications
const pending = await complii.kyc.listVerifications({
  status: 'pending',
  provider: 'manual',
});

// Review and approve
await complii.kyc.reviewVerification('ver_xyz789', {
  decision: 'approve',
  notes: 'All documents verified, certification valid',
});

// Or reject
await complii.kyc.reviewVerification('ver_xyz789', {
  decision: 'reject',
  reason: 'Certification date expired (older than 3 months)',
});
```

### cURL Examples

```bash
# Start manual verification
curl -X POST http://localhost:3001/api/v1/customers/cus_abc123/kyc \
  -H "Authorization: Bearer sk_test_2e0c2c442c19f1ba7ef77685837775c1" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "manual",
    "documentTypes": ["passport", "utility_bill"],
    "requireCertification": true
  }'

# Upload document (multipart form)
curl -X POST http://localhost:3001/api/v1/customers/cus_abc123/kyc/documents \
  -H "Authorization: Bearer sk_test_xxx" \
  -F "file=@/path/to/passport.pdf" \
  -F "documentType=passport" \
  -F "isCertified=true" \
  -F 'certification={"certifierName":"John Smith","certifierType":"justice_of_peace","certificationDate":"2025-01-01"}'

# Admin review
curl -X POST http://localhost:3001/api/v1/identity-verifications/ver_xyz789/review \
  -H "Authorization: Bearer sk_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approve",
    "notes": "Documents verified"
  }'
```

---

## Australian Certification Requirements

For Australian compliance, documents must be certified by authorized persons.

### Authorized Certifiers

| Category | Types |
|----------|-------|
| Legal | Justice of the Peace, Lawyer, Solicitor, Barrister |
| Medical | Doctor, Dentist, Pharmacist, Nurse, Veterinarian |
| Financial | Chartered Accountant, Bank Officer |
| Government | Police Officer, Post Office Employee |
| Other | Teacher, Engineer, Minister of Religion |

### Certifiers Requiring Registration Number

The following professions **must** provide a registration number:
- Lawyer, Solicitor, Barrister
- Doctor, Dentist, Pharmacist, Nurse
- Accountant, Engineer
- Optometrist, Chiropractor, Physiotherapist, Veterinarian

### Certification Validation

Complii automatically validates:
- Certifier type is in authorized list
- Certification date is within last 3 months
- Registration number provided for regulated professions
- Certifier name is present

```typescript
// Invalid certification will be rejected
await complii.kyc.uploadDocument('cus_abc123', {
  file: document,
  documentType: 'passport',
  isCertified: true,
  certification: {
    certifierName: 'John',
    certifierType: 'doctor',
    // Missing registrationNumber - will fail validation
    certificationDate: '2024-06-01',  // Older than 3 months - will fail
  },
});
// Throws: "Registration number is required for Medical Practitioner;
//          Certification must be within the last 3 months"
```

---

## Document Types

| Type | Description |
|------|-------------|
| `passport` | Australian or foreign passport |
| `drivers_license` | State/territory driver's license |
| `birth_certificate` | Australian birth certificate |
| `citizenship_certificate` | Australian citizenship certificate |
| `medicare_card` | Medicare card |
| `proof_of_age` | State proof of age card |
| `utility_bill` | Recent utility bill (address proof) |
| `bank_statement` | Recent bank statement |
| `tax_return` | ATO tax assessment |
| `national_id` | Foreign national ID card |

---

## Webhook Events

Subscribe to KYC events for real-time notifications:

```typescript
// Create webhook endpoint
await complii.webhooks.create({
  url: 'https://yourapp.com/webhooks/complii',
  events: [
    'kyc.verification_started',
    'kyc.verification_completed',
    'kyc.verification_failed',
    'kyc.document_uploaded',
    'kyc.document_reviewed',
    'screening.match',  // Also fires after KYC if sanctions match
  ],
});
```

### Event Payloads

**kyc.verification_completed**
```json
{
  "id": "evt_abc123",
  "type": "kyc.verification_completed",
  "created": "2025-01-01T10:00:00Z",
  "data": {
    "object": {
      "verificationId": "ver_xyz789",
      "customerId": "cus_abc123",
      "status": "verified",
      "provider": "stripe_identity",
      "verifiedData": {
        "firstName": "John",
        "lastName": "Smith",
        "dateOfBirth": "1990-05-15"
      }
    }
  }
}
```

**kyc.verification_failed**
```json
{
  "id": "evt_def456",
  "type": "kyc.verification_failed",
  "created": "2025-01-01T10:00:00Z",
  "data": {
    "object": {
      "verificationId": "ver_xyz789",
      "customerId": "cus_abc123",
      "status": "rejected",
      "provider": "manual",
      "reason": "Document certification invalid"
    }
  }
}
```

---

## Post-Verification Flow

When KYC verification succeeds, Complii automatically:

### 1. Updates Customer Record
```typescript
// Before KYC
customer.verificationStatus // 'unverified'

// After KYC
customer.verificationStatus // 'verified'
```

### 2. Runs Sanctions Screening
```typescript
// Automatic screening against DFAT, UN, etc.
// If match found:
customer.isSanctioned // true
// Webhook dispatched: 'screening.match'
```

### 3. Adjusts Risk Score
```typescript
// Risk scoring considers verification status
// Unverified: +10 points
// Verified: 0 points

// Before KYC
risk.factors // [..., {factor: 'unverified_customer', score: 10}]

// After KYC
risk.factors // (unverified_customer factor removed)
```

### 4. Dispatches Webhooks
```typescript
// Events sent to your webhook endpoints:
// - kyc.verification_completed
// - screening.match (if sanctions hit)
```

---

## Complete Integration Example

```typescript
import { Complii } from '@complii/sdk';

const complii = new Complii({
  apiKey: 'sk_test_xxx',
  baseUrl: 'http://localhost:3001/api/v1',
});

async function onboardCustomer(email: string, name: { first: string; last: string }) {
  // 1. Create customer
  const customer = await complii.customers.create({
    email,
    firstName: name.first,
    lastName: name.last,
  });
  console.log('Customer created:', customer.id);
  console.log('Verification status:', customer.verificationStatus); // 'unverified'

  // 2. Check initial risk (unverified penalty applies)
  const initialRisk = await complii.risk.assess({
    customerId: customer.id,
    transactionAmount: 5000,
  });
  console.log('Initial risk score:', initialRisk.riskScore); // Includes +10 for unverified

  // 3. Start KYC verification
  const verification = await complii.kyc.startVerification(customer.id, {
    provider: 'stripe_identity',
    returnUrl: 'https://yourapp.com/onboarding/complete',
  });
  console.log('Verification started:', verification.id);
  console.log('Redirect user to:', verification.url);

  return { customer, verification };
}

async function handleKycComplete(customerId: string) {
  // 4. Check updated status
  const status = await complii.kyc.getStatus(customerId);

  if (status.status === 'verified') {
    console.log('Customer verified!');
    console.log('Verified name:', status.verifiedData?.firstName, status.verifiedData?.lastName);

    // 5. Get updated customer (sanctions screening already ran)
    const customer = await complii.customers.retrieve(customerId);
    console.log('Sanctions status:', customer.isSanctioned ? 'MATCH FOUND' : 'Clear');

    // 6. Check updated risk score
    const risk = await complii.risk.assess({
      customerId: customerId,
      transactionAmount: 5000,
    });
    console.log('Updated risk score:', risk.riskScore); // Lower without unverified penalty

    // 7. Now safe to process transactions
    const transaction = await complii.transactions.create({
      customerId: customerId,
      amount: 5000,
      direction: 'incoming',
      type: 'deposit',
    });
    console.log('Transaction processed:', transaction.id);
  } else {
    console.log('Verification failed:', status.rejectionReason);
  }
}

// Usage
const { customer, verification } = await onboardCustomer('john@example.com', {
  first: 'John',
  last: 'Smith',
});

// After user completes verification (via webhook or polling)
await handleKycComplete(customer.id);
```

---

## Environment Variables for KYC

Add these to `apps/api/.env.local`:

```env
# Stripe Identity (required for stripe_identity provider)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_xxx

# Existing Supabase config
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

### Stripe Webhook Setup

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourapi.com/api/v1/webhooks/stripe/identity`
3. Select events:
   - `identity.verification_session.verified`
   - `identity.verification_session.requires_input`
   - `identity.verification_session.canceled`
4. Copy signing secret to `STRIPE_IDENTITY_WEBHOOK_SECRET`
