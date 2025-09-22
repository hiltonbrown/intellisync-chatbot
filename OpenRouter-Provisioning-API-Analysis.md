# OpenRouter Provisioning API Analysis & Implementation Guide

## Current State Analysis

### Current API Key Management Approach

The application currently uses a **single shared API key approach**:

#### Configuration (`lib/ai/models.ts`)
```typescript
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY, // Single shared key
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://ledgerbot.co',
    'X-Title': 'IntelliSync Chatbot',
  },
});
```

#### User Management (`lib/ai/entitlements.ts`)
```typescript
export type UserType = 'regular'; // Single user type

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      'openai/gpt-oss-120b:free',
      'meta-llama/llama-4-maverick:free',
      'google/gemma-3-27b-it:free',
    ],
  },
};
```

### Current Limitations

❌ **Single Point of Failure**: One API key for all users
❌ **No Individual Usage Tracking**: Can't isolate usage per user in OpenRouter
❌ **Limited Rate Control**: Shared rate limits across all users
❌ **No User-Specific Limits**: All users share the same credit pool
❌ **Billing Transparency**: Can't attribute costs to specific users
❌ **Security Risk**: Key compromise affects all users

## OpenRouter Provisioning API Opportunities

### 1. Per-User API Key Management

#### Individual User Keys
```typescript
// Create unique API key per user
const createUserKey = async (userId: string, userType: UserType) => {
  const response = await fetch('https://openrouter.ai/api/v1/keys', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PROVISIONING_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `User ${userId}`,
      label: `intellisync-user-${userId}`,
      limit: getUserCreditLimit(userType), // Based on user tier
    }),
  });
  return response.json();
};
```

#### Benefits
✅ **Isolated Usage**: Per-user usage tracking in OpenRouter dashboard
✅ **Individual Limits**: Credit limits per user based on subscription tier
✅ **Security Isolation**: Key compromise only affects one user
✅ **Billing Attribution**: Direct cost attribution per user

### 2. Subscription Tier Management

#### Enhanced User Types
```typescript
export type UserType = 'free' | 'pro' | 'enterprise';

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  free: {
    maxMessagesPerDay: 20,
    creditLimit: 100, // $1.00 equivalent
    availableChatModelIds: ['openai/gpt-oss-120b:free'],
  },
  pro: {
    maxMessagesPerDay: 500,
    creditLimit: 5000, // $50.00 equivalent
    availableChatModelIds: ['openai/gpt-4o-mini', 'google/gemini-2.5-flash'],
  },
  enterprise: {
    maxMessagesPerDay: -1, // Unlimited
    creditLimit: 50000, // $500.00 equivalent
    availableChatModelIds: ['*'], // All models
  },
};
```

### 3. Dynamic Key Rotation

#### Security Enhancement
```typescript
// Automatic key rotation for security
const rotateUserKey = async (userId: string) => {
  const oldKey = await getUserApiKey(userId);

  // Create new key
  const newKey = await createUserKey(userId, await getUserType(userId));

  // Update user record
  await updateUserApiKey(userId, newKey.key);

  // Schedule old key deletion (grace period)
  setTimeout(() => deleteApiKey(oldKey.hash), 24 * 60 * 60 * 1000); // 24 hours

  return newKey;
};
```

## Implementation Architecture

### 1. Database Schema Enhancement

#### Current User Schema
```typescript
export const user = pgTable('User', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
});
```

#### Enhanced Schema
```typescript
export const user = pgTable('User', {
  id: varchar('id', { length: 255 }).primaryKey().notNull(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  // New fields for provisioning API
  userType: varchar('userType', { enum: ['free', 'pro', 'enterprise'] })
    .notNull()
    .default('free'),
  openrouterKeyHash: varchar('openrouterKeyHash', { length: 255 }),
  keyCreatedAt: timestamp('keyCreatedAt'),
  keyLastRotated: timestamp('keyLastRotated'),
  creditLimit: integer('creditLimit').default(100),
  currentUsage: integer('currentUsage').default(0),
});

export const apiKeyAudit = pgTable('ApiKeyAudit', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: varchar('userId', { length: 255 })
    .notNull()
    .references(() => user.id),
  keyHash: varchar('keyHash', { length: 255 }).notNull(),
  action: varchar('action', { enum: ['created', 'rotated', 'disabled', 'deleted'] })
    .notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  metadata: jsonb('metadata'), // Additional context
});
```

### 2. API Key Service Layer

#### Core Service Implementation
```typescript
// lib/services/openrouter-keys.ts
export class OpenRouterKeyService {
  private provisioningKey: string;

  constructor() {
    this.provisioningKey = process.env.OPENROUTER_PROVISIONING_KEY!;
  }

  async createUserKey(userId: string, userType: UserType): Promise<UserApiKey> {
    const entitlements = entitlementsByUserType[userType];

    const response = await fetch('https://openrouter.ai/api/v1/keys', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.provisioningKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `IntelliSync User ${userId}`,
        label: `intellisync-${userType}-${userId}`,
        limit: entitlements.creditLimit,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create API key: ${response.statusText}`);
    }

    const keyData = await response.json();

    // Store in database
    await this.storeUserKey(userId, keyData);

    return keyData;
  }

  async getUserKey(userId: string): Promise<string | null> {
    const userRecord = await getUserById(userId);
    if (!userRecord[0]?.openrouterKeyHash) {
      return null;
    }

    // Retrieve actual key (stored securely)
    return await this.decryptStoredKey(userRecord[0].openrouterKeyHash);
  }

  async rotateUserKey(userId: string): Promise<UserApiKey> {
    const currentUser = await getUserById(userId);
    if (!currentUser[0]) {
      throw new Error('User not found');
    }

    // Create new key
    const newKey = await this.createUserKey(userId, currentUser[0].userType);

    // Disable old key (with grace period)
    if (currentUser[0].openrouterKeyHash) {
      await this.scheduleKeyDisabling(currentUser[0].openrouterKeyHash);
    }

    // Audit log
    await this.logKeyAction(userId, newKey.hash, 'rotated');

    return newKey;
  }

  async updateKeyLimits(userId: string, newLimit: number): Promise<void> {
    const user = await getUserById(userId);
    if (!user[0]?.openrouterKeyHash) {
      throw new Error('User API key not found');
    }

    await fetch(`https://openrouter.ai/api/v1/keys/${user[0].openrouterKeyHash}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.provisioningKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: newLimit,
      }),
    });

    // Update local record
    await updateUserCreditLimit(userId, newLimit);
  }

  async getKeyUsage(userId: string): Promise<KeyUsageStats> {
    const user = await getUserById(userId);
    if (!user[0]?.openrouterKeyHash) {
      throw new Error('User API key not found');
    }

    const response = await fetch(
      `https://openrouter.ai/api/v1/keys/${user[0].openrouterKeyHash}`,
      {
        headers: {
          Authorization: `Bearer ${this.provisioningKey}`,
        },
      }
    );

    return response.json();
  }
}
```

### 3. Dynamic Provider Creation

#### Per-User OpenRouter Instance
```typescript
// lib/ai/providers.ts (enhanced)
export function createUserProvider(apiKey: string) {
  return createOpenRouter({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://ledgerbot.co',
      'X-Title': 'IntelliSync Chatbot',
    },
  });
}

// Enhanced chat API with per-user keys
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  // Get or create user-specific API key
  const keyService = new OpenRouterKeyService();
  let userApiKey = await keyService.getUserKey(userId);

  if (!userApiKey) {
    const userType = await getUserType(userId);
    const keyData = await keyService.createUserKey(userId, userType);
    userApiKey = keyData.key;
  }

  // Create user-specific provider
  const userProvider = createUserProvider(userApiKey);

  const stream = createUIMessageStream({
    execute: ({ writer: dataStream }) => {
      const result = streamText({
        model: userProvider.languageModel(selectedChatModel), // User-specific provider
        // ... rest of configuration
        providerOptions: {
          openai: {
            user: `intellisync_${userId}`,
            usage: { include: true },
          },
        },
      });
    },
  });
}
```

## Use Cases & Implementation Roadmap

### Phase 1: Basic Per-User Keys (2-3 days)

#### Immediate Benefits
- **Individual Usage Tracking**: Each user gets isolated OpenRouter analytics
- **Basic Rate Limiting**: Per-user credit limits
- **Security Improvement**: Key isolation

#### Implementation Steps
1. **Database Schema Update**: Add key storage fields
2. **Key Service Creation**: Basic create/retrieve functionality
3. **Chat API Enhancement**: Dynamic provider creation
4. **Environment Setup**: Add provisioning API key

### Phase 2: Subscription Tiers (1 week)

#### Enhanced User Management
- **Multi-tier Support**: Free, Pro, Enterprise users
- **Dynamic Limits**: Credit limits based on subscription
- **Model Access Control**: Tier-based model availability

#### Implementation Steps
1. **User Type System**: Enhanced entitlements
2. **Billing Integration**: Connect to payment system
3. **Admin Dashboard**: Key management interface
4. **Usage Monitoring**: Real-time usage tracking

### Phase 3: Advanced Features (2 weeks)

#### Enterprise Features
- **Key Rotation**: Automatic security rotation
- **Usage Analytics**: Detailed per-user reports
- **Cost Attribution**: Billing transparency
- **Compliance**: Audit logs and key management

#### Implementation Steps
1. **Rotation System**: Automated key rotation
2. **Analytics Dashboard**: Usage insights
3. **Billing Reports**: Cost attribution
4. **Admin Tools**: Key management interface

## Cost Considerations

### Per-User Key Overhead
- **Provisioning API**: No additional cost for key management
- **Usage Tracking**: Improved granularity for cost attribution
- **Storage**: Minimal database overhead for key storage

### ROI Analysis
✅ **Better Cost Control**: Prevent usage spikes from affecting all users
✅ **Billing Accuracy**: Direct cost attribution per user
✅ **Scalability**: Support for different user tiers
✅ **Security**: Isolated key management reduces risk

## Security Considerations

### Key Storage Security
```typescript
// Secure key storage approach
class SecureKeyStorage {
  // Encrypt keys at rest
  async storeKey(userId: string, apiKey: string): Promise<string> {
    const encrypted = await encrypt(apiKey, process.env.KEY_ENCRYPTION_SECRET!);
    const hash = createHash('sha256').update(apiKey).digest('hex').substring(0, 16);

    await db.update(user)
      .set({
        openrouterKeyHash: hash,
        encryptedApiKey: encrypted,
      })
      .where(eq(user.id, userId));

    return hash;
  }

  // Retrieve and decrypt keys
  async retrieveKey(userId: string): Promise<string | null> {
    const userRecord = await getUserById(userId);
    if (!userRecord[0]?.encryptedApiKey) {
      return null;
    }

    return await decrypt(userRecord[0].encryptedApiKey, process.env.KEY_ENCRYPTION_SECRET!);
  }
}
```

### Access Control
- **Provisioning Key Protection**: Separate from user API keys
- **Role-Based Access**: Admin-only key management
- **Audit Logging**: All key operations logged
- **Grace Periods**: Safe key rotation with overlap

## Monitoring & Analytics

### Usage Dashboard Components
```typescript
// Real-time usage monitoring
interface UserUsageStats {
  userId: string;
  currentUsage: number;
  creditLimit: number;
  usagePercent: number;
  lastActivity: Date;
  keyStatus: 'active' | 'disabled' | 'expired';
  monthlyTrend: UsageDataPoint[];
}

// Admin dashboard for key management
interface KeyManagementDashboard {
  totalUsers: number;
  activeKeys: number;
  totalUsage: number;
  costByTier: Record<UserType, number>;
  usageAlerts: UsageAlert[];
  keyRotationSchedule: KeyRotationEvent[];
}
```

## Implementation Priority

### High Priority (Immediate Value)
1. **Per-User API Keys**: Individual usage tracking and limits
2. **Basic Tier System**: Free vs Pro user differentiation
3. **Security Enhancement**: Key isolation and rotation

### Medium Priority (Growth Features)
1. **Advanced Analytics**: Detailed usage reporting
2. **Automated Billing**: Cost attribution and invoicing
3. **Enterprise Features**: Advanced key management

### Low Priority (Advanced Features)
1. **Custom Limits**: Per-user custom credit limits
2. **API Access**: Developer API for key management
3. **Advanced Security**: Hardware security module integration

The OpenRouter Provisioning API provides a powerful foundation for scaling the application with proper user isolation, security, and cost control while maintaining the existing user experience.

## Executive Summary

### Current Limitations
- ❌ **Single Shared API Key**: All users share one OpenRouter API key
- ❌ **No Individual Usage Tracking**: Cannot isolate costs or usage per user
- ❌ **Limited Rate Control**: Shared rate limits across all users
- ❌ **Security Risk**: Key compromise affects entire application
- ❌ **No Subscription Tiers**: All users have identical limitations

### OpenRouter Provisioning API Benefits
- ✅ **Per-User API Keys**: Individual usage tracking and billing
- ✅ **Subscription Tier Support**: Free, Pro, Enterprise user levels
- ✅ **Security Isolation**: Key compromise limited to single user
- ✅ **Dynamic Credit Limits**: User-specific spending controls
- ✅ **Automatic Key Rotation**: Enhanced security through key rotation
- ✅ **Detailed Analytics**: Per-user usage insights in OpenRouter dashboard

### Implementation Strategy

#### Phase 1: Basic Per-User Keys (2-3 days)
```typescript
// Create unique API key per user
const userKey = await keyService.createUserKey(userId, userType);
const userProvider = createUserProvider(userKey.key);

// Use in streamText calls
const result = streamText({
  model: userProvider.languageModel(selectedChatModel),
  providerOptions: {
    openai: {
      user: `intellisync_${userId}`,
      usage: { include: true },
    },
  },
});
```

#### Enhanced User Management
```typescript
export type UserType = 'free' | 'pro' | 'enterprise';

export const entitlementsByUserType = {
  free: { creditLimit: 100, maxMessagesPerDay: 20 },
  pro: { creditLimit: 5000, maxMessagesPerDay: 500 },
  enterprise: { creditLimit: 50000, maxMessagesPerDay: -1 },
};
```

### Expected Outcomes
- **Individual Usage Tracking**: Each user visible in OpenRouter analytics
- **Cost Attribution**: Direct billing per user/tier
- **Scalable Security**: Isolated API key management
- **Subscription Revenue**: Support for paid tiers with different limits
- **Enhanced Monitoring**: Real-time per-user usage insights

### Risk Assessment
- **Low Risk**: Provisioning API is additive, doesn't break existing functionality
- **Gradual Migration**: Can implement incrementally user by user
- **Fallback Support**: Shared key remains as backup option

This enhancement transforms the application from a shared-resource model to a true multi-tenant SaaS platform with proper user isolation and subscription tier support.

## Key Findings Summary

### Current State
- **Single shared API key** for all users
- **No individual usage tracking** or cost attribution
- **Basic user management** with only one user type (`regular`)
- **Shared rate limits** and security risks

### Transformation Opportunity
The Provisioning API enables a complete architecture transformation:

#### Phase 1: Individual User Keys (2-3 days)
- Create unique API keys per user
- Isolated usage tracking in OpenRouter
- Per-user credit limits and security

#### Phase 2: Subscription Tiers (1 week)
- Free, Pro, Enterprise user levels
- Dynamic credit limits based on subscription
- Model access control per tier

#### Phase 3: Enterprise Features (2 weeks)
- Automatic key rotation for security
- Advanced analytics and billing attribution
- Audit logs and compliance features

### Business Impact
- **Revenue Model**: Support for paid subscription tiers
- **Cost Control**: Prevent usage spikes from affecting all users
- **Security**: Isolated key management reduces blast radius
- **Scalability**: True multi-tenant architecture
- **Analytics**: Per-user insights for optimization

This represents a **high-value architectural enhancement** that transforms the application from a shared-resource model to a professional SaaS platform with proper user isolation, subscription tiers, and enterprise-grade security.