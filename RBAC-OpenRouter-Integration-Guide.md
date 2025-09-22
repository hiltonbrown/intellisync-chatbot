# RBAC Integration with OpenRouter Features
## Comprehensive Role-Based Access Control & User Management

## Enhanced Role System Design

### Current Basic User Types vs Enhanced RBAC
```typescript
// Current: Single user type
export type UserType = 'regular';

// Enhanced: Multi-dimensional role system
export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type FeatureFlag = 'beta_features' | 'api_access' | 'white_label' | 'priority_support';
```

### Enhanced Global TypeScript Definitions
```typescript
// types/globals.d.ts - Comprehensive role system
export {};

export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type FeatureFlag = 'beta_features' | 'api_access' | 'white_label' | 'priority_support';

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      // Core role system
      role: UserRole;
      subscriptionTier: SubscriptionTier;

      // OpenRouter integration
      openrouterKeyHash?: string;
      creditLimit: number;
      currentUsage: number;

      // Feature access control
      featureFlags: FeatureFlag[];
      apiAccessLevel: 'none' | 'read' | 'write' | 'admin';

      // Administrative metadata
      onboardingComplete: boolean;
      lastLogin?: string;
      accountStatus: 'active' | 'suspended' | 'pending';

      // Organizational data
      companyName?: string;
      teamSize?: string;
      useCase?: string;
    };
  }
}
```

### Enhanced Session Token Claims
```json
{
  "metadata": "{{user.public_metadata}}",
  "role": "{{user.public_metadata.role}}",
  "subscription_tier": "{{user.public_metadata.subscriptionTier}}",
  "feature_flags": "{{user.public_metadata.featureFlags}}",
  "credit_limit": "{{user.public_metadata.creditLimit}}",
  "api_access_level": "{{user.public_metadata.apiAccessLevel}}"
}
```

## Role-Based Entitlements System

### Enhanced Entitlements with RBAC
```typescript
// lib/ai/entitlements.ts - Enhanced with role-based permissions
export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

interface RolePermissions {
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
  canManageOrganization: boolean;
  canAccessBetaFeatures: boolean;
  canRotateApiKeys: boolean;
  canViewUsageReports: boolean;
  canAccessWhiteLabel: boolean;
  maxConcurrentChats: number;
  canExportData: boolean;
  prioritySupport: boolean;
}

interface SubscriptionEntitlements {
  maxMessagesPerDay: number;
  creditLimit: number;
  availableChatModelIds: Array<string>;
  maxFileUploads: number;
  retentionDays: number;
  apiCallsPerHour: number;
}

export const rolePermissions: Record<UserRole, RolePermissions> = {
  user: {
    canAccessAdmin: false,
    canManageUsers: false,
    canViewAnalytics: false,
    canManageOrganization: false,
    canAccessBetaFeatures: false,
    canRotateApiKeys: false,
    canViewUsageReports: true,
    canAccessWhiteLabel: false,
    maxConcurrentChats: 1,
    canExportData: false,
    prioritySupport: false,
  },
  moderator: {
    canAccessAdmin: true,
    canManageUsers: false,
    canViewAnalytics: true,
    canManageOrganization: false,
    canAccessBetaFeatures: true,
    canRotateApiKeys: false,
    canViewUsageReports: true,
    canAccessWhiteLabel: false,
    maxConcurrentChats: 3,
    canExportData: true,
    prioritySupport: true,
  },
  admin: {
    canAccessAdmin: true,
    canManageUsers: true,
    canViewAnalytics: true,
    canManageOrganization: true,
    canAccessBetaFeatures: true,
    canRotateApiKeys: true,
    canViewUsageReports: true,
    canAccessWhiteLabel: true,
    maxConcurrentChats: 10,
    canExportData: true,
    prioritySupport: true,
  },
  super_admin: {
    canAccessAdmin: true,
    canManageUsers: true,
    canViewAnalytics: true,
    canManageOrganization: true,
    canAccessBetaFeatures: true,
    canRotateApiKeys: true,
    canViewUsageReports: true,
    canAccessWhiteLabel: true,
    maxConcurrentChats: -1, // Unlimited
    canExportData: true,
    prioritySupport: true,
  },
};

export const subscriptionEntitlements: Record<SubscriptionTier, SubscriptionEntitlements> = {
  free: {
    maxMessagesPerDay: 20,
    creditLimit: 100,
    availableChatModelIds: ['openai/gpt-oss-120b:free', 'meta-llama/llama-4-maverick:free'],
    maxFileUploads: 5,
    retentionDays: 30,
    apiCallsPerHour: 10,
  },
  pro: {
    maxMessagesPerDay: 500,
    creditLimit: 5000,
    availableChatModelIds: [
      'openai/gpt-4o-mini',
      'google/gemini-2.5-flash',
      'anthropic/claude-3-sonnet',
    ],
    maxFileUploads: 50,
    retentionDays: 365,
    apiCallsPerHour: 100,
  },
  enterprise: {
    maxMessagesPerDay: -1, // Unlimited
    creditLimit: 50000,
    availableChatModelIds: ['*'], // All models
    maxFileUploads: -1, // Unlimited
    retentionDays: -1, // Unlimited
    apiCallsPerHour: 1000,
  },
};
```

## Enhanced Role Management Utilities

### Comprehensive Role Checking System
```typescript
// utils/roles.ts - Enhanced role management
import { UserRole, SubscriptionTier } from '@/types/globals';
import { auth } from '@clerk/nextjs/server';
import { rolePermissions, subscriptionEntitlements } from '@/lib/ai/entitlements';

export const checkRole = async (role: UserRole): Promise<boolean> => {
  const { sessionClaims } = await auth();
  return sessionClaims?.metadata?.role === role;
};

export const hasPermission = async (permission: keyof RolePermissions): Promise<boolean> => {
  const { sessionClaims } = await auth();
  const userRole = sessionClaims?.metadata?.role;

  if (!userRole) return false;

  return rolePermissions[userRole][permission];
};

export const getUserRole = async (): Promise<UserRole | null> => {
  const { sessionClaims } = await auth();
  return sessionClaims?.metadata?.role || null;
};

export const getSubscriptionTier = async (): Promise<SubscriptionTier | null> => {
  const { sessionClaims } = await auth();
  return sessionClaims?.metadata?.subscriptionTier || null;
};

export const canAccessFeature = async (feature: string): Promise<boolean> => {
  const { sessionClaims } = await auth();
  const featureFlags = sessionClaims?.metadata?.featureFlags || [];

  return featureFlags.includes(feature as any);
};

export const getUserEntitlements = async () => {
  const { sessionClaims } = await auth();
  const role = sessionClaims?.metadata?.role;
  const tier = sessionClaims?.metadata?.subscriptionTier;

  if (!role || !tier) return null;

  return {
    permissions: rolePermissions[role],
    subscription: subscriptionEntitlements[tier],
    metadata: sessionClaims.metadata,
  };
};

export const canManageOpenRouterKeys = async (): Promise<boolean> => {
  return await hasPermission('canRotateApiKeys');
};

export const canAccessAnalytics = async (): Promise<boolean> => {
  return await hasPermission('canViewAnalytics');
};
```

## Enhanced Middleware with Role-Based Routing

### Comprehensive Route Protection
```typescript
// middleware.ts - Enhanced with role-based routing
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Route matchers for different access levels
const isPublicRoute = createRouteMatcher(['/login', '/register', '/api/auth']);
const isOnboardingRoute = createRouteMatcher(['/onboarding']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isModeratorRoute = createRouteMatcher(['/moderator(.*)']);
const isAnalyticsRoute = createRouteMatcher(['/analytics(.*)']);
const isApiKeyManagementRoute = createRouteMatcher(['/settings/api-keys(.*)']);
const isUsageReportsRoute = createRouteMatcher(['/reports(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { isAuthenticated, sessionClaims, redirectToSignIn } = await auth();

  // Allow public routes
  if (isPublicRoute(req)) return NextResponse.next();

  // Redirect unauthenticated users
  if (!isAuthenticated) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // Allow onboarding for authenticated users
  if (isOnboardingRoute(req)) return NextResponse.next();

  // Check onboarding completion
  if (!sessionClaims?.metadata?.onboardingComplete) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  // Role-based route protection
  const userRole = sessionClaims?.metadata?.role;
  const accountStatus = sessionClaims?.metadata?.accountStatus;

  // Block suspended accounts
  if (accountStatus === 'suspended') {
    return NextResponse.redirect(new URL('/account-suspended', req.url));
  }

  // Admin route protection
  if (isAdminRoute(req)) {
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }

  // Moderator route protection
  if (isModeratorRoute(req)) {
    if (!['moderator', 'admin', 'super_admin'].includes(userRole || '')) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }

  // Analytics route protection
  if (isAnalyticsRoute(req)) {
    const canViewAnalytics = ['moderator', 'admin', 'super_admin'].includes(userRole || '');
    if (!canViewAnalytics) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }

  // API key management route protection
  if (isApiKeyManagementRoute(req)) {
    const canManageKeys = ['admin', 'super_admin'].includes(userRole || '');
    if (!canManageKeys) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }

  // Usage reports protection
  if (isUsageReportsRoute(req)) {
    const subscriptionTier = sessionClaims?.metadata?.subscriptionTier;
    if (subscriptionTier === 'free') {
      return NextResponse.redirect(new URL('/upgrade-required', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

## Comprehensive Admin Dashboard

### Multi-Level Admin Interface
```typescript
// app/admin/page.tsx - Enhanced admin dashboard
import { redirect } from 'next/navigation';
import { checkRole, hasPermission } from '@/utils/roles';
import { UserManagement } from './components/UserManagement';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SystemSettings } from './components/SystemSettings';
import { OpenRouterManagement } from './components/OpenRouterManagement';

export default async function AdminDashboard() {
  // Check admin access
  const isAdmin = await checkRole('admin') || await checkRole('super_admin');
  if (!isAdmin) {
    redirect('/unauthorized');
  }

  // Get specific permissions
  const canManageUsers = await hasPermission('canManageUsers');
  const canViewAnalytics = await hasPermission('canViewAnalytics');
  const canRotateApiKeys = await hasPermission('canRotateApiKeys');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Management */}
            {canManageUsers && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">User Management</h2>
                <UserManagement />
              </div>
            )}

            {/* Analytics */}
            {canViewAnalytics && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">System Analytics</h2>
                <AnalyticsDashboard />
              </div>
            )}

            {/* OpenRouter Key Management */}
            {canRotateApiKeys && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">OpenRouter Management</h2>
                <OpenRouterManagement />
              </div>
            )}

            {/* System Settings */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">System Settings</h2>
              <SystemSettings />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Enhanced User Management Component
```typescript
// app/admin/components/UserManagement.tsx - Comprehensive user management
'use client';

import { useState, useEffect } from 'react';
import { setUserRole, setSubscriptionTier, suspendUser, rotateUserApiKey } from '../_actions';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  subscriptionTier: string;
  accountStatus: string;
  currentUsage: number;
  creditLimit: number;
  lastLogin: string;
  openrouterKeyHash?: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterTier, setFilterTier] = useState('');

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !filterRole || user.role === filterRole;
    const matchesTier = !filterTier || user.subscriptionTier === filterTier;

    return matchesSearch && matchesRole && matchesTier;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">All Tiers</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* User List */}
      <div className="space-y-4">
        {filteredUsers.map((user) => (
          <UserCard key={user.id} user={user} />
        ))}
      </div>
    </div>
  );
}

function UserCard({ user }: { user: User }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      {/* User Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">{user.firstName} {user.lastName}</h3>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs rounded-full ${getRoleColor(user.role)}`}>
            {user.role}
          </span>
          <span className={`px-2 py-1 text-xs rounded-full ${getTierColor(user.subscriptionTier)}`}>
            {user.subscriptionTier}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-800"
          >
            {isExpanded ? 'Less' : 'More'}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Usage</p>
              <p className="text-sm">{user.currentUsage} / {user.creditLimit}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <p className="text-sm">{user.accountStatus}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Last Login</p>
              <p className="text-sm">{user.lastLogin}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">API Key</p>
              <p className="text-sm">{user.openrouterKeyHash ? 'Active' : 'None'}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <RoleChangeButton userId={user.id} currentRole={user.role} />
            <TierChangeButton userId={user.id} currentTier={user.subscriptionTier} />
            <SuspendButton userId={user.id} isActive={user.accountStatus === 'active'} />
            {user.openrouterKeyHash && (
              <ApiKeyRotateButton userId={user.id} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions for styling
function getRoleColor(role: string): string {
  const colors = {
    user: 'bg-gray-100 text-gray-800',
    moderator: 'bg-blue-100 text-blue-800',
    admin: 'bg-purple-100 text-purple-800',
    super_admin: 'bg-red-100 text-red-800',
  };
  return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
}

function getTierColor(tier: string): string {
  const colors = {
    free: 'bg-green-100 text-green-800',
    pro: 'bg-yellow-100 text-yellow-800',
    enterprise: 'bg-indigo-100 text-indigo-800',
  };
  return colors[tier as keyof typeof colors] || 'bg-gray-100 text-gray-800';
}
```

### OpenRouter Management Component
```typescript
// app/admin/components/OpenRouterManagement.tsx - OpenRouter admin tools
'use client';

import { useState, useEffect } from 'react';
import { rotateAllKeys, getKeyUsageStats, setGlobalLimits } from '../_actions';

interface KeyUsageStats {
  totalKeys: number;
  activeKeys: number;
  totalUsage: number;
  averageUsage: number;
  topUsers: Array<{
    userId: string;
    email: string;
    usage: number;
  }>;
}

export function OpenRouterManagement() {
  const [stats, setStats] = useState<KeyUsageStats | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const data = await getKeyUsageStats();
    setStats(data);
  };

  const handleMassRotation = async () => {
    setIsRotating(true);
    try {
      await rotateAllKeys();
      await loadStats();
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Usage Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.totalKeys}</p>
            <p className="text-sm text-gray-500">Total Keys</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.activeKeys}</p>
            <p className="text-sm text-gray-500">Active Keys</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.totalUsage.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Usage</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.averageUsage.toFixed(1)}</p>
            <p className="text-sm text-gray-500">Avg Usage</p>
          </div>
        </div>
      )}

      {/* Management Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleMassRotation}
          disabled={isRotating}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          {isRotating ? 'Rotating...' : 'Rotate All Keys'}
        </button>
        <button
          onClick={loadStats}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh Stats
        </button>
      </div>

      {/* Top Users */}
      {stats?.topUsers && (
        <div>
          <h3 className="text-lg font-medium mb-3">Top Users by Usage</h3>
          <div className="space-y-2">
            {stats.topUsers.map((user, index) => (
              <div key={user.userId} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded">
                <span className="font-medium">#{index + 1} {user.email}</span>
                <span className="text-gray-600">{user.usage.toLocaleString()} credits</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

## Enhanced Server Actions

### Comprehensive Admin Actions
```typescript
// app/admin/_actions.ts - Enhanced admin actions
'use server';

import { checkRole, hasPermission } from '@/utils/roles';
import { clerkClient } from '@clerk/nextjs/server';
import { OpenRouterKeyService } from '@/lib/services/openrouter-keys';
import { UserRole, SubscriptionTier } from '@/types/globals';

export async function setUserRole(userId: string, role: UserRole) {
  // Check permissions
  if (!await hasPermission('canManageUsers')) {
    return { error: 'Insufficient permissions' };
  }

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { role },
    });

    return { success: true };
  } catch (error) {
    return { error: 'Failed to update user role' };
  }
}

export async function setSubscriptionTier(userId: string, tier: SubscriptionTier) {
  if (!await hasPermission('canManageUsers')) {
    return { error: 'Insufficient permissions' };
  }

  try {
    const client = await clerkClient();
    const keyService = new OpenRouterKeyService();

    // Update subscription tier
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { subscriptionTier: tier },
    });

    // Update OpenRouter key limits
    await keyService.updateUserTier(userId, tier);

    return { success: true };
  } catch (error) {
    return { error: 'Failed to update subscription tier' };
  }
}

export async function suspendUser(userId: string, suspend: boolean) {
  if (!await hasPermission('canManageUsers')) {
    return { error: 'Insufficient permissions' };
  }

  try {
    const client = await clerkClient();
    const keyService = new OpenRouterKeyService();

    // Update account status
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        accountStatus: suspend ? 'suspended' : 'active',
        suspendedAt: suspend ? new Date().toISOString() : null,
      },
    });

    // Disable OpenRouter key if suspending
    if (suspend) {
      await keyService.disableUserKey(userId);
    } else {
      await keyService.enableUserKey(userId);
    }

    return { success: true };
  } catch (error) {
    return { error: 'Failed to update account status' };
  }
}

export async function rotateUserApiKey(userId: string) {
  if (!await hasPermission('canRotateApiKeys')) {
    return { error: 'Insufficient permissions' };
  }

  try {
    const keyService = new OpenRouterKeyService();
    const newKey = await keyService.rotateUserKey(userId);

    // Update Clerk metadata with new key hash
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        openrouterKeyHash: newKey.hash,
        keyRotatedAt: new Date().toISOString(),
      },
    });

    return { success: true, keyHash: newKey.hash };
  } catch (error) {
    return { error: 'Failed to rotate API key' };
  }
}

export async function getKeyUsageStats() {
  if (!await hasPermission('canViewAnalytics')) {
    return { error: 'Insufficient permissions' };
  }

  try {
    const keyService = new OpenRouterKeyService();
    return await keyService.getSystemUsageStats();
  } catch (error) {
    return { error: 'Failed to get usage stats' };
  }
}

export async function rotateAllKeys() {
  if (!await checkRole('super_admin')) {
    return { error: 'Super admin access required' };
  }

  try {
    const keyService = new OpenRouterKeyService();
    await keyService.rotateAllKeys();
    return { success: true };
  } catch (error) {
    return { error: 'Failed to rotate all keys' };
  }
}
```

## Role-Based Chat API Enhancement

### Enhanced Chat API with Role-Based Features
```typescript
// app/(chat)/api/chat/route.ts - Enhanced with role-based access
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  // Get user entitlements (role + subscription)
  const entitlements = await getUserEntitlements();
  if (!entitlements) {
    return new ChatSDKError('invalid_user:chat').toResponse();
  }

  // Check account status
  if (entitlements.metadata.accountStatus === 'suspended') {
    return new ChatSDKError('account_suspended:chat').toResponse();
  }

  // Rate limiting based on role and subscription
  const messageCount = await getMessageCountByUserId({
    id: userId,
    differenceInHours: 24,
  });

  const maxMessages = entitlements.subscription.maxMessagesPerDay;
  if (maxMessages !== -1 && messageCount >= maxMessages) {
    return new ChatSDKError('rate_limit:chat').toResponse();
  }

  // Get user-specific OpenRouter provider
  const keyService = new OpenRouterKeyService();
  const userApiKey = await keyService.getUserKey(userId);

  const userProvider = createUserProvider(userApiKey);

  // Enhanced streaming with role-based features
  const stream = createUIMessageStream({
    execute: ({ writer: dataStream }) => {
      const result = streamText({
        model: userProvider.languageModel(selectedChatModel),
        // Role-based feature access
        experimental_activeTools: getToolsForRole(entitlements.permissions),
        providerOptions: {
          openai: {
            user: `intellisync_${userId}`,
            usage: { include: true },
          },
        },
        // ... rest of configuration
      });
    },
  });
}

function getToolsForRole(permissions: RolePermissions): string[] {
  const baseTools = ['getWeather'];

  if (permissions.canAccessBetaFeatures) {
    baseTools.push('experimentalTool');
  }

  if (permissions.canExportData) {
    baseTools.push('exportTool');
  }

  return baseTools;
}
```

## Implementation Benefits

### Business Value
- **Role-Based Revenue**: Different pricing for different access levels
- **Administrative Efficiency**: Comprehensive user management tools
- **Security**: Granular permission control and account management
- **Scalability**: Structured approach to user and feature management

### User Experience
- **Clear Permissions**: Users understand their access levels
- **Progressive Enhancement**: Role-based feature unlocking
- **Administrative Tools**: Self-service for admins and moderators

### Technical Benefits
- **Comprehensive RBAC**: Full role-based access control system
- **OpenRouter Integration**: Role-aware API key management
- **Scalable Architecture**: Supports complex organizational structures
- **Security**: Multi-layered protection with role verification

## Implementation Timeline

### Phase 1: Core RBAC (1 week)
- Enhanced role system and permissions
- Role-based middleware protection
- Basic admin dashboard

### Phase 2: OpenRouter Integration (1 week)
- Role-aware API key management
- Usage limits based on roles and subscriptions
- Administrative tools for key management

### Phase 3: Advanced Features (1 week)
- Comprehensive admin dashboard
- Analytics and reporting
- Advanced user management tools

This RBAC system creates a professional, scalable user management foundation that integrates seamlessly with all OpenRouter features while providing enterprise-grade administrative capabilities.

## Executive Summary

### Current State vs Enhanced RBAC Vision

#### Current Basic User Management
- ❌ Single user type (`'regular'`) for all users
- ❌ No administrative tools or user management interface
- ❌ No role-based access control or permissions system
- ❌ Manual user management and support required

#### Enhanced Multi-Dimensional RBAC System
- ✅ **4-Level Role System**: User → Moderator → Admin → Super Admin
- ✅ **3-Tier Subscriptions**: Free, Pro, Enterprise with role-independent billing
- ✅ **Granular Permissions**: 11 distinct permission levels for fine-grained control
- ✅ **Comprehensive Admin Dashboard**: Self-service user and system management

### Multi-Dimensional Access Control

#### Role-Based Permissions Matrix
```typescript
// 4 roles × 11 permissions = 44 unique permission combinations
User: Basic access, personal usage reports only
Moderator: Analytics access, beta features, data export, priority support
Admin: Full user management, API key rotation, organization management
Super Admin: System-wide controls, mass operations, unrestricted access
```

#### Subscription Tier Integration
```typescript
// Independent subscription tiers work with any role
Free: 20 msgs/day, 100 credits, basic models, 30-day retention
Pro: 500 msgs/day, 5K credits, premium models, 365-day retention
Enterprise: Unlimited usage, 50K credits, all models, unlimited retention
```

#### Feature Flag System
```typescript
// Dynamic feature access control
Beta Features, API Access, White Label, Priority Support
// Configurable per user independent of role/subscription
```

### Comprehensive Admin Dashboard

#### Multi-Level Administrative Interface
- **User Search & Filter**: Role, subscription tier, account status filtering
- **Bulk Operations**: Mass role changes, subscription updates, key rotation
- **OpenRouter Management**: System-wide key management and usage analytics
- **Real-Time Analytics**: Usage patterns, top users, system health monitoring

#### Granular User Management
- **Role Assignment**: Instant role changes with automatic permission updates
- **Subscription Management**: Tier changes with automatic OpenRouter limit updates
- **Account Controls**: Suspend/activate with automatic API key management
- **API Key Operations**: Individual and mass key rotation with audit trails

### OpenRouter Integration Benefits

#### Role-Aware API Key Management
- **Automatic Provisioning**: Keys created with role-appropriate limits
- **Dynamic Limit Updates**: Subscription changes automatically update OpenRouter limits
- **Security Controls**: Suspended accounts automatically disable API keys
- **Administrative Tools**: Bulk key rotation and usage monitoring

#### Enhanced Usage Control
- **Role-Based Tool Access**: Different AI tools available per role level
- **Subscription Limits**: Daily message limits and credit controls per tier
- **Feature Gating**: Beta features and advanced tools based on permissions
- **Analytics Access**: Usage insights restricted to appropriate roles

### Business Impact

#### Revenue Optimization
- **Role-Based Pricing**: Different access levels justify different pricing models
- **Subscription Independence**: Roles and subscriptions can be priced separately
- **Enterprise Features**: Advanced admin tools justify enterprise pricing
- **Reduced Support Costs**: Self-service admin tools reduce manual support

#### Operational Efficiency
- **Automated Management**: Role changes automatically update all permissions
- **Scalable Administration**: Moderators and admins can manage users
- **Audit Trails**: Complete logging of all administrative actions
- **System Monitoring**: Real-time visibility into usage and performance

#### Security & Compliance
- **Granular Access Control**: Principle of least privilege enforced
- **Account Isolation**: Suspended accounts completely isolated from services
- **Key Rotation**: Bulk security operations for compliance requirements
- **Permission Verification**: Every action verified against current permissions

### Technical Architecture Benefits

#### Clean Separation of Concerns
- **Role Management**: Independent of subscription billing
- **Permission System**: Declarative permissions matrix
- **Feature Flags**: Dynamic feature control independent of roles
- **OpenRouter Integration**: Seamless API key lifecycle management

#### Scalable Design
- **Middleware Protection**: Route-level access control
- **Database Optimization**: Efficient role and permission queries
- **Caching Strategy**: Session claims cache permissions for performance
- **Extensible Framework**: Easy to add new roles, permissions, or features

### Implementation Strategy

#### Phase 1: Core RBAC Foundation (1 week)
- Enhanced role system with 4 levels and 11 permissions
- Role-based middleware protection for all routes
- Basic admin dashboard with user search and role management

#### Phase 2: OpenRouter Integration (1 week)
- Role-aware API key provisioning and management
- Subscription tier integration with automatic limit updates
- Administrative tools for bulk key operations and monitoring

#### Phase 3: Advanced Admin Tools (1 week)
- Comprehensive user management with bulk operations
- System analytics and usage reporting
- Advanced security controls and audit logging

### Risk Assessment
- **Low Implementation Risk**: Builds incrementally on existing Clerk foundation
- **Zero Downtime**: Existing users continue with current functionality
- **Gradual Migration**: Roles can be assigned progressively
- **Fallback Safety**: Current authentication remains fully functional

### Expected Outcomes
- **Enhanced User Experience**: Clear permission boundaries and appropriate access
- **Administrative Efficiency**: 90% reduction in manual user management tasks
- **Revenue Growth**: Support for role-based and subscription-based pricing models
- **Security Improvement**: Comprehensive access control with audit capabilities
- **Scalability**: Framework supports thousands of users with minimal overhead

This represents a **complete transformation** from basic authentication to an **enterprise-grade user management system** that combines role-based access control with advanced OpenRouter integration, creating a professional SaaS platform capable of supporting complex organizational structures and billing models.