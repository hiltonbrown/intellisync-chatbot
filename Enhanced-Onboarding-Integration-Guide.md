# Enhanced Onboarding Integration Guide
## Clerk Custom Onboarding + OpenRouter Features

## Current State vs Enhanced Vision

### Current Simple Middleware
```typescript
// middleware.ts - Current basic implementation
export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  await auth.protect({
    unauthenticatedUrl: loginUrl.toString()
  });
});
```

### Enhanced Onboarding-Aware Middleware
```typescript
// middleware.ts - Enhanced with onboarding + subscription flow
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher(['/login', '/register', '/api/auth']);
const isOnboardingRoute = createRouteMatcher(['/onboarding']);
const isSubscriptionRoute = createRouteMatcher(['/subscription']);

export default clerkMiddleware(async (auth, req) => {
  const { isAuthenticated, sessionClaims, redirectToSignIn } = await auth();

  // Allow public routes
  if (isPublicRoute(req)) return;

  // Redirect unauthenticated users
  if (!isAuthenticated) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // Allow onboarding and subscription routes for authenticated users
  if (isOnboardingRoute(req) || isSubscriptionRoute(req)) {
    return;
  }

  // Check onboarding completion
  if (!sessionClaims?.metadata?.onboardingComplete) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  // Check subscription selection for non-free users
  if (!sessionClaims?.metadata?.subscriptionSelected) {
    return NextResponse.redirect(new URL('/subscription', req.url));
  }

  // Allow authenticated, onboarded users with subscriptions
  return;
});
```

## Enhanced Session Token Claims

### Custom JWT Session Claims
```typescript
// types/globals.d.ts - Enhanced session claims
export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      // Onboarding state
      onboardingComplete?: boolean;
      subscriptionSelected?: boolean;

      // User profile
      subscriptionTier: 'free' | 'pro' | 'enterprise';
      companyName?: string;
      useCase?: string;

      // OpenRouter integration
      openrouterKeyHash?: string;
      keyCreatedAt?: string;
      creditLimit?: number;
      currentUsage?: number;

      // Feature flags
      betaFeatures?: string[];
      apiAccess?: boolean;
    };
  }
}
```

### Clerk Dashboard Session Token Configuration
```json
{
  "metadata": "{{user.public_metadata}}",
  "subscription_tier": "{{user.public_metadata.subscriptionTier}}",
  "onboarding_complete": "{{user.public_metadata.onboardingComplete}}",
  "credit_limit": "{{user.public_metadata.creditLimit}}",
  "current_usage": "{{user.public_metadata.currentUsage}}"
}
```

## Multi-Step Enhanced Onboarding Flow

### Step 1: Welcome & Profile Setup
```typescript
// app/onboarding/page.tsx - Welcome step
'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { completeProfileSetup } from './_actions';

export default function OnboardingWelcome() {
  const { user } = useUser();
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    const result = await completeProfileSetup(formData);

    if (result.success) {
      await user?.reload();
      router.push('/onboarding/subscription');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Welcome to IntelliSync!</h1>
      <p className="text-gray-600 mb-8">
        Let's get you set up with the perfect AI assistant for your needs.
      </p>

      <form action={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Company/Organization Name
          </label>
          <input
            type="text"
            name="companyName"
            required
            className="w-full p-3 border rounded-lg"
            placeholder="Your company name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Primary Use Case
          </label>
          <select name="useCase" required className="w-full p-3 border rounded-lg">
            <option value="">Select your primary use case...</option>
            <option value="customer-support">Customer Support</option>
            <option value="content-creation">Content Creation</option>
            <option value="code-assistance">Code Assistance</option>
            <option value="research-analysis">Research & Analysis</option>
            <option value="education-training">Education & Training</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Team Size
          </label>
          <select name="teamSize" required className="w-full p-3 border rounded-lg">
            <option value="">Select team size...</option>
            <option value="individual">Just me</option>
            <option value="small">2-10 people</option>
            <option value="medium">11-50 people</option>
            <option value="large">51+ people</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
        >
          Continue to Subscription
        </button>
      </form>
    </div>
  );
}
```

### Step 2: Subscription Tier Selection
```typescript
// app/onboarding/subscription/page.tsx - Subscription selection
'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { selectSubscriptionTier } from '../_actions';

const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: '$0',
    credits: 100,
    features: ['Basic AI models', 'Limited usage', 'Community support'],
    models: ['openai/gpt-oss-120b:free', 'meta-llama/llama-4-maverick:free'],
  },
  pro: {
    name: 'Pro',
    price: '$29',
    credits: 5000,
    features: ['Premium AI models', 'Higher usage limits', 'Priority support'],
    models: ['openai/gpt-4o-mini', 'google/gemini-2.5-flash', 'anthropic/claude-3-sonnet'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Custom',
    credits: 50000,
    features: ['All AI models', 'Unlimited usage', 'Dedicated support', 'Custom integrations'],
    models: ['All available models', 'Early access to new models'],
  },
};

export default function SubscriptionSelection() {
  const { user } = useUser();
  const router = useRouter();

  const handleTierSelection = async (tier: string) => {
    const result = await selectSubscriptionTier(tier);

    if (result.success) {
      await user?.reload();
      router.push('/onboarding/setup');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-6">Choose Your Plan</h1>
      <p className="text-gray-600 text-center mb-12">
        Select the plan that best fits your needs. You can upgrade or downgrade at any time.
      </p>

      <div className="grid md:grid-cols-3 gap-8">
        {Object.entries(SUBSCRIPTION_TIERS).map(([key, tier]) => (
          <div
            key={key}
            className={`border rounded-lg p-6 ${
              key === 'pro' ? 'border-blue-500 shadow-lg' : 'border-gray-200'
            }`}
          >
            {key === 'pro' && (
              <div className="bg-blue-500 text-white text-sm font-medium px-3 py-1 rounded-full inline-block mb-4">
                Most Popular
              </div>
            )}

            <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
            <p className="text-3xl font-bold mb-2">{tier.price}</p>
            <p className="text-gray-600 mb-6">
              {tier.credits.toLocaleString()} credits/month
            </p>

            <ul className="space-y-2 mb-6">
              {tier.features.map((feature, index) => (
                <li key={index} className="flex items-center">
                  <CheckIcon className="w-4 h-4 text-green-500 mr-2" />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleTierSelection(key)}
              className={`w-full py-3 rounded-lg font-medium ${
                key === 'pro'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {key === 'free' ? 'Start Free' : 'Choose Plan'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Step 3: API Key Provisioning & Setup
```typescript
// app/onboarding/setup/page.tsx - Final setup step
'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { completeOnboarding } from '../_actions';

export default function OnboardingSetup() {
  const { user } = useUser();
  const router = useRouter();
  const [isProvisioning, setIsProvisioning] = useState(true);
  const [setupProgress, setSetupProgress] = useState(0);

  useEffect(() => {
    const setupUser = async () => {
      try {
        // Step 1: Create OpenRouter API key
        setSetupProgress(25);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

        // Step 2: Configure user settings
        setSetupProgress(50);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 3: Initialize user workspace
        setSetupProgress(75);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 4: Complete onboarding
        setSetupProgress(100);
        const result = await completeOnboarding();

        if (result.success) {
          await user?.reload();
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Setup failed:', error);
      } finally {
        setIsProvisioning(false);
      }
    };

    setupUser();
  }, [user, router]);

  if (isProvisioning) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <h1 className="text-3xl font-bold mb-6">Setting up your account...</h1>

        <div className="mb-8">
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-1000"
              style={{ width: `${setupProgress}%` }}
            />
          </div>
          <p className="mt-2 text-gray-600">{setupProgress}% complete</p>
        </div>

        <div className="space-y-4 text-left">
          <div className={`flex items-center ${setupProgress >= 25 ? 'text-green-600' : 'text-gray-400'}`}>
            <CheckIcon className="w-5 h-5 mr-3" />
            Creating your personal AI assistant
          </div>
          <div className={`flex items-center ${setupProgress >= 50 ? 'text-green-600' : 'text-gray-400'}`}>
            <CheckIcon className="w-5 h-5 mr-3" />
            Configuring your preferences
          </div>
          <div className={`flex items-center ${setupProgress >= 75 ? 'text-green-600' : 'text-gray-400'}`}>
            <CheckIcon className="w-5 h-5 mr-3" />
            Setting up your workspace
          </div>
          <div className={`flex items-center ${setupProgress >= 100 ? 'text-green-600' : 'text-gray-400'}`}>
            <CheckIcon className="w-5 h-5 mr-3" />
            Finalizing your account
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 text-center">
      <h1 className="text-3xl font-bold mb-6">Welcome to IntelliSync!</h1>
      <p className="text-gray-600 mb-8">
        Your account is ready. Let's start building something amazing together.
      </p>
      <button
        onClick={() => router.push('/dashboard')}
        className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700"
      >
        Get Started
      </button>
    </div>
  );
}
```

## Enhanced Onboarding Actions

### Server Actions with OpenRouter Integration
```typescript
// app/onboarding/_actions.ts - Enhanced server actions
'use server';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { OpenRouterKeyService } from '@/lib/services/openrouter-keys';
import { entitlementsByUserType } from '@/lib/ai/entitlements';

export async function completeProfileSetup(formData: FormData) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return { error: 'Not authenticated' };
  }

  try {
    const client = await clerkClient();

    await client.users.updateUser(userId, {
      publicMetadata: {
        companyName: formData.get('companyName'),
        useCase: formData.get('useCase'),
        teamSize: formData.get('teamSize'),
        profileComplete: true,
      },
    });

    return { success: true };
  } catch (error) {
    return { error: 'Failed to update profile' };
  }
}

export async function selectSubscriptionTier(tier: 'free' | 'pro' | 'enterprise') {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return { error: 'Not authenticated' };
  }

  try {
    const client = await clerkClient();
    const entitlements = entitlementsByUserType[tier];

    await client.users.updateUser(userId, {
      publicMetadata: {
        subscriptionTier: tier,
        subscriptionSelected: true,
        creditLimit: entitlements.creditLimit,
        currentUsage: 0,
        availableModels: entitlements.availableChatModelIds,
      },
    });

    return { success: true };
  } catch (error) {
    return { error: 'Failed to select subscription' };
  }
}

export async function completeOnboarding() {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return { error: 'Not authenticated' };
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userType = user.publicMetadata.subscriptionTier as 'free' | 'pro' | 'enterprise';

    // Create OpenRouter API key for user
    const keyService = new OpenRouterKeyService();
    const apiKeyData = await keyService.createUserKey(userId, userType);

    // Complete onboarding in Clerk metadata
    await client.users.updateUser(userId, {
      publicMetadata: {
        ...user.publicMetadata,
        onboardingComplete: true,
        openrouterKeyHash: apiKeyData.hash,
        keyCreatedAt: new Date().toISOString(),
        setupCompletedAt: new Date().toISOString(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Onboarding completion failed:', error);
    return { error: 'Failed to complete onboarding' };
  }
}
```

## Enhanced Layout Protection

### Onboarding Layout with Progress Tracking
```typescript
// app/onboarding/layout.tsx - Enhanced layout
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sessionClaims } = await auth();

  // Redirect if already onboarded
  if (sessionClaims?.metadata?.onboardingComplete) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto">
        {/* Progress indicator */}
        <div className="pt-8 pb-4">
          <OnboardingProgressIndicator />
        </div>

        {children}
      </div>
    </div>
  );
}

function OnboardingProgressIndicator() {
  // This would track which step the user is on
  return (
    <div className="flex items-center justify-center space-x-4">
      <div className="flex items-center">
        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">
          1
        </div>
        <span className="ml-2 text-sm">Profile</span>
      </div>
      <div className="w-8 h-px bg-gray-300" />
      <div className="flex items-center">
        <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm">
          2
        </div>
        <span className="ml-2 text-sm">Subscription</span>
      </div>
      <div className="w-8 h-px bg-gray-300" />
      <div className="flex items-center">
        <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm">
          3
        </div>
        <span className="ml-2 text-sm">Setup</span>
      </div>
    </div>
  );
}
```

## Environment Configuration

### Enhanced Environment Variables
```bash
# .env.local - Enhanced configuration

# Clerk Onboarding URLs
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/onboarding

# OpenRouter Integration
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_PROVISIONING_KEY=your_provisioning_api_key

# Feature Flags
ENABLE_BETA_FEATURES=false
ENABLE_ENTERPRISE_FEATURES=true
```

## Benefits of Enhanced Onboarding

### User Experience Benefits
- **Guided Setup**: Step-by-step onboarding process
- **Subscription Clarity**: Clear tier comparison and selection
- **Immediate Value**: API key provisioned automatically
- **Progress Tracking**: Visual feedback during setup

### Business Benefits
- **Conversion Optimization**: Structured subscription selection
- **User Data Collection**: Valuable use case and company data
- **Automated Provisioning**: Seamless OpenRouter integration
- **Tier-Based Experience**: Immediate differentiation by subscription

### Technical Benefits
- **Security**: Secure API key provisioning and storage
- **Scalability**: Automated user setup without manual intervention
- **Analytics**: Rich metadata for user behavior analysis
- **Flexibility**: Extensible onboarding flow for future features

## Implementation Timeline

### Phase 1: Basic Onboarding (3-5 days)
- Implement middleware with onboarding checks
- Create basic onboarding flow with profile setup
- Add subscription tier selection
- Integrate with existing Clerk setup

### Phase 2: OpenRouter Integration (2-3 days)
- Add OpenRouter API key provisioning
- Implement tier-based entitlements
- Create user-specific provider setup
- Add usage tracking initialization

### Phase 3: Enhanced UX (1-2 days)
- Add progress indicators and animations
- Implement error handling and retry logic
- Add success states and confirmation flows
- Create onboarding analytics

This enhanced onboarding flow creates a professional first-time user experience while automatically setting up the technical infrastructure needed for the OpenRouter integration and subscription management.

## Executive Summary

### Current State vs. Enhanced Vision

#### Current Simple Authentication
- ✅ Basic Clerk authentication protection
- ❌ No onboarding flow or user setup
- ❌ All users get identical experience
- ❌ Manual subscription/tier management needed

#### Enhanced Onboarding Experience
- ✅ **3-Step Guided Onboarding**: Profile setup → Subscription selection → Automated provisioning
- ✅ **Automatic OpenRouter Integration**: API keys provisioned during signup
- ✅ **Subscription Tier Selection**: Free/Pro/Enterprise with clear differentiation
- ✅ **Rich User Metadata**: Company info, use cases, preferences collected

### Multi-Step Onboarding Flow

#### Step 1: Profile & Use Case Collection
```typescript
// Collect: Company name, use case, team size
// Store: Rich metadata in Clerk publicMetadata
// Result: Personalized experience setup
```

#### Step 2: Subscription Tier Selection
```typescript
// Options: Free ($0, 100 credits), Pro ($29, 5K credits), Enterprise (Custom, 50K credits)
// Features: Model access, usage limits, support levels
// Result: Tier-specific entitlements activated
```

#### Step 3: Automated Provisioning
```typescript
// Actions: OpenRouter API key creation, workspace setup, preferences configuration
// Integration: Seamless connection to all OpenRouter features
// Result: Ready-to-use AI assistant with proper isolation
```

### Technical Architecture Enhancements

#### Enhanced Middleware Protection
```typescript
// Multi-level protection: Authentication → Onboarding → Subscription → Access
// Progressive access: Users guided through complete setup before app access
// Flexible routing: Different flows for different user states
```

#### Rich Session Claims
```typescript
interface EnhancedSessionClaims {
  onboardingComplete: boolean;
  subscriptionTier: 'free' | 'pro' | 'enterprise';
  openrouterKeyHash: string;
  creditLimit: number;
  // ... comprehensive user state
}
```

#### Automated OpenRouter Integration
```typescript
// Automatic: API key creation per user during onboarding
// Secure: Keys stored securely with hash references in Clerk
// Scalable: Tier-based credit limits and model access
```

### Business Impact

#### Revenue Generation
- **Subscription Conversion**: Guided tier selection during onboarding
- **Clear Value Proposition**: Immediate differentiation between Free/Pro/Enterprise
- **Usage Visibility**: Real-time credit tracking from day one

#### User Experience
- **Professional Onboarding**: Polished first impression with progress tracking
- **Immediate Value**: Working AI assistant within minutes of signup
- **Personalized Setup**: Use case-driven configuration and recommendations

#### Operational Efficiency
- **Automated Provisioning**: No manual user setup required
- **Rich Analytics**: Comprehensive user data from onboarding
- **Scalable Architecture**: Supports unlimited user growth

### Implementation Benefits

#### For Users
- **Guided Experience**: Clear steps from signup to working AI assistant
- **Subscription Clarity**: Transparent pricing and feature comparison
- **Immediate Access**: No waiting for manual account approval or setup

#### For Business
- **Conversion Optimization**: Structured subscription selection process
- **User Intelligence**: Rich data on use cases, company types, team sizes
- **Automated Operations**: Self-service user provisioning and management

#### For Developers
- **Clean Architecture**: Well-structured middleware and routing logic
- **Extensible Design**: Easy to add new onboarding steps or features
- **Integrated Systems**: Seamless Clerk + OpenRouter + subscription management

### Implementation Timeline

#### Week 1: Core Onboarding (3-5 days)
- Enhanced middleware with multi-step protection
- Profile collection and subscription selection pages
- Basic user flow from signup to dashboard access

#### Week 2: OpenRouter Integration (2-3 days)
- Automatic API key provisioning during onboarding
- Tier-based entitlements and model access control
- Usage tracking initialization and dashboard setup

#### Week 3: Polish & Analytics (1-2 days)
- Progress indicators, animations, and error handling
- Onboarding completion analytics and optimization
- A/B testing setup for conversion improvement

### Risk Assessment
- **Low Risk**: Builds on existing solid Clerk foundation
- **Additive Enhancement**: Doesn't break existing functionality
- **Gradual Rollout**: Can be implemented incrementally with feature flags
- **Fallback Support**: Existing auth continues to work for current users

This represents a **strategic transformation** from basic authentication to a **professional SaaS onboarding experience** that automatically sets up users for success while generating subscription revenue and rich user intelligence.

## Key Achievement Summary

### Complete Integration Strategy
This guide provides a **strategic blueprint** for transforming the application from basic authentication to a professional SaaS platform with:

#### 3-Step Professional Onboarding
1. **Profile & Use Case Collection**: Company info, team size, primary use case
2. **Subscription Tier Selection**: Visual comparison of Free/Pro/Enterprise plans
3. **Automated Provisioning**: OpenRouter API key creation and workspace setup

#### Technical Architecture Enhancements
- **Enhanced Middleware**: Multi-level protection with progressive access
- **Rich Session Claims**: Comprehensive user state in JWT tokens
- **Automatic Integration**: Seamless OpenRouter key provisioning during signup

#### Business Value Creation
- **Revenue Generation**: Guided subscription selection during onboarding
- **User Intelligence**: Rich metadata collection (company, use case, team size)
- **Operational Efficiency**: Completely automated user provisioning

### Implementation Benefits

#### For Users
- Professional guided experience from signup to working AI assistant
- Clear subscription options with transparent feature comparison
- Immediate access to personalized AI capabilities

#### For Business
- Structured conversion funnel for subscription revenue
- Rich analytics data from day-one user interactions
- Automated operations with no manual user setup required

#### For Developers
- Clean, extensible architecture building on existing Clerk foundation
- Seamless integration of all OpenRouter advanced features
- Low-risk implementation with incremental rollout capability

This represents the **culmination of all our OpenRouter analysis** - combining user tracking, usage accounting, provisioning API, and streaming capabilities into a cohesive, professional onboarding experience that positions the application as a **true enterprise-ready SaaS platform**.

The 3-week implementation timeline provides a realistic path to transform the current basic authentication into a sophisticated user management system that generates subscription revenue while providing an excellent user experience.