# OpenRouter Usage Accounting Analysis & Enhancement Guide

## Current Implementation Analysis

### Existing Usage Tracking Architecture

The application already implements sophisticated usage tracking and token accounting:

#### 1. Backend Usage Collection (`app/(chat)/api/chat/route.ts:191-194`)
```typescript
let finalUsage: LanguageModelUsage | undefined;

onFinish: ({ usage }) => {
  finalUsage = usage;
  dataStream.write({ type: 'data-usage', data: usage });
},
```

**Current Capabilities**:
✅ **Token Usage Tracking**: Collects input/output tokens via Vercel AI SDK
✅ **Streaming Integration**: Usage data sent via SSE in real-time
✅ **Database Persistence**: Stores `finalUsage` in chat's `lastContext` field
✅ **Frontend Display**: Real-time usage display in context component

#### 2. Database Storage (`lib/db/queries.ts` & `schema.ts`)
```typescript
// Schema
lastContext: jsonb('lastContext').$type<LanguageModelV2Usage | null>(),

// Storage function
export async function updateChatLastContextById({
  chatId,
  context, // LanguageModelV2Usage
}: {
  chatId: string;
  context: LanguageModelV2Usage;
}) {
  return await db.update(chat).set({ lastContext: context }).where(eq(chat.id, chatId));
}
```

#### 3. Frontend Usage Display (`components/elements/context.tsx`)
```typescript
export const Context = ({ maxTokens, usedTokens, usage, modelId }: ContextProps) => {
  const uNorm = normalizeUsage(usage);
  const uBreakdown = breakdownTokens(usage);

  // Displays:
  // - Token counts (input/output/reasoning/cache)
  // - Cost estimates via tokenlens
  // - Context window utilization
  // - Progress bar visualization
}
```

**Advanced UI Features**:
✅ **Visual Progress**: Context window utilization with circular progress
✅ **Cost Estimation**: Real-time cost calculation using `tokenlens` library
✅ **Token Breakdown**: Input, output, reasoning, cache reads/writes
✅ **Cache Optimization**: Displays cache hits and writes for performance monitoring

## Gap Analysis: OpenRouter Native Usage Accounting

### Current Limitations
❌ **No OpenRouter Native Usage**: Not using OpenRouter's built-in `usage.include` parameter
❌ **Missing Native Cost Data**: Relying on `tokenlens` estimates instead of OpenRouter's actual costs
❌ **No Cache Token Details**: Limited cache accounting compared to OpenRouter's native support
❌ **Delayed Performance**: Missing OpenRouter's optimized token counting

### OpenRouter's Superior Capabilities

#### 1. Native Token Counting
- **Model-Specific Tokenizers**: Uses each model's actual tokenizer
- **Accurate Counts**: No estimation errors from third-party libraries
- **Reasoning Token Support**: Native support for o1-style reasoning tokens
- **Cache Optimization**: Detailed cache read/write accounting

#### 2. Real Cost Tracking
- **Actual Billing**: Shows exact costs charged to account
- **BYOK Support**: Separate upstream costs for bring-your-own-key scenarios
- **Credit System**: Native integration with OpenRouter's credit system

#### 3. Performance Benefits
- **Faster Response**: Token counting happens server-side during generation
- **Reduced Latency**: No additional API calls for usage data
- **Optimized Caching**: Better cache utilization metrics

## Enhancement Strategy

### Phase 1: Enable OpenRouter Native Usage Accounting

#### Current Vercel AI SDK Implementation
```typescript
// app/(chat)/api/chat/route.ts:163-195
const result = streamText({
  model: myProvider.languageModel(selectedChatModel),
  system: systemPrompt({ selectedChatModel, requestHints }),
  messages: convertToModelMessages(uiMessages),
  // Missing OpenRouter usage parameter
});
```

#### Enhanced Implementation
```typescript
const result = streamText({
  model: myProvider.languageModel(selectedChatModel),
  system: systemPrompt({ selectedChatModel, requestHints }),
  messages: convertToModelMessages(uiMessages),
  // Enable OpenRouter native usage accounting
  providerOptions: {
    openai: {
      usage: {
        include: true, // Enable detailed usage accounting
      },
      user: `intellisync_${finalUserId}`, // User tracking (from previous analysis)
    },
  },
  // ... other options
});
```

### Phase 2: Enhanced Data Structure

#### Current Usage Type (Vercel AI SDK)
```typescript
interface LanguageModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}
```

#### OpenRouter Enhanced Usage Type
```typescript
interface OpenRouterUsage {
  completion_tokens: number;
  completion_tokens_details: {
    reasoning_tokens: number;
  };
  cost: number; // Actual cost in credits
  cost_details: {
    upstream_inference_cost: number; // BYOK scenarios
  };
  prompt_tokens: number;
  prompt_tokens_details: {
    cached_tokens: number; // Cache hits
    audio_tokens: number;   // Audio input tokens
  };
  total_tokens: number;
}
```

### Phase 3: Database Schema Enhancement

#### Current Schema
```typescript
// Simple usage storage
lastContext: jsonb('lastContext').$type<LanguageModelV2Usage | null>(),
```

#### Enhanced Schema
```typescript
// Extended usage with OpenRouter-specific fields
export interface EnhancedUsageData {
  // Standard Vercel AI SDK fields
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;

  // OpenRouter-specific enhancements
  cost?: number;
  costDetails?: {
    upstream_inference_cost?: number;
  };
  cachedTokens?: number;
  reasoningTokens?: number;
  audioTokens?: number;

  // Metadata
  modelId: string;
  timestamp: Date;
  provider: 'openrouter';
}

// Updated schema
lastContext: jsonb('lastContext').$type<EnhancedUsageData | null>(),
```

## Implementation Roadmap

### Immediate (2-4 hours)
1. **Add OpenRouter Usage Parameter**
   ```typescript
   providerOptions: {
     openai: {
       usage: { include: true },
     },
   }
   ```

2. **Test Usage Data Reception**
   - Verify enhanced usage data in streaming responses
   - Log received usage objects for analysis

3. **Update Database Storage**
   - Enhance storage to preserve OpenRouter-specific fields
   - Maintain backward compatibility

### Short-term (1-2 days)
1. **Enhanced Frontend Display**
   ```typescript
   // Update Context component to show OpenRouter data
   const actualCost = usage?.cost; // Real cost from OpenRouter
   const cachedTokens = usage?.prompt_tokens_details?.cached_tokens;
   const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens;
   ```

2. **Cost Accuracy Improvements**
   - Replace `tokenlens` estimates with actual OpenRouter costs
   - Show real vs estimated cost comparison
   - Add cost trend tracking

3. **Cache Optimization Display**
   - Show cache hit ratios
   - Display cache performance metrics
   - Add cache optimization suggestions

### Medium-term (1 week)
1. **Usage Analytics Dashboard**
   - Historical usage trends
   - Cost analysis by model/user
   - Token efficiency metrics

2. **Performance Monitoring**
   - Cache performance tracking
   - Model efficiency comparison
   - Cost optimization recommendations

3. **User-Level Usage Reports**
   - Per-user cost breakdowns
   - Usage pattern analysis
   - Rate limiting optimization

## Expected Benefits

### Accuracy Improvements
- **Native Token Counting**: Eliminates estimation errors
- **Real Cost Tracking**: Shows actual billing amounts
- **Model-Specific Metrics**: Uses each model's native tokenizer

### Performance Enhancements
- **Reduced API Calls**: No separate usage requests needed
- **Faster Token Counting**: Server-side optimization
- **Better Caching**: Improved cache utilization tracking

### User Experience
- **Real-Time Costs**: Accurate cost display during generation
- **Cache Awareness**: Users can see cache performance benefits
- **Detailed Breakdowns**: Reasoning tokens, audio tokens, etc.

### Operational Benefits
- **Accurate Billing**: Match usage display to actual billing
- **Performance Monitoring**: Better cache and model performance insights
- **Cost Optimization**: Identify expensive usage patterns

## Implementation Example

### Before (Current)
```typescript
// Estimated usage via tokenlens
const costText = formatUSDFixed(
  estimateCost({
    modelId,
    usage: { input: inputTokens, output: outputTokens },
  }).totalUSD,
);
```

### After (OpenRouter Native)
```typescript
// Actual cost from OpenRouter
const actualCost = usage?.cost; // Real cost in credits
const costText = actualCost ? formatCredits(actualCost) : undefined;

// Enhanced breakdown
const cacheHits = usage?.prompt_tokens_details?.cached_tokens ?? 0;
const reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens ?? 0;
const upstreamCost = usage?.cost_details?.upstream_inference_cost;
```

## Risk Assessment

### Low Risk
✅ **Backward Compatible**: Existing usage tracking continues to work
✅ **Gradual Migration**: Can implement incrementally
✅ **Fallback Support**: Current tokenlens estimates as backup

### Considerations
⚠️ **API Changes**: Verify Vercel AI SDK support for OpenRouter usage parameter
⚠️ **Data Migration**: Update existing database records gradually
⚠️ **UI Updates**: Ensure new fields display correctly

## Success Metrics

### Technical Metrics
- **Accuracy**: 100% cost accuracy vs estimates
- **Performance**: Reduced usage-related API calls
- **Cache Efficiency**: Improved cache hit rate visibility

### User Experience
- **Real-Time Feedback**: Instant accurate cost display
- **Cache Awareness**: Users understand performance benefits
- **Cost Control**: Better usage optimization decisions

The enhancement leverages OpenRouter's native capabilities while building on the existing robust usage tracking infrastructure, providing significant accuracy and performance improvements with minimal risk.

## Implementation Priority

**High Priority**: Enable OpenRouter usage parameter for accurate cost tracking
**Medium Priority**: Enhanced frontend display with native OpenRouter data
**Low Priority**: Advanced analytics and historical reporting

This enhancement provides immediate value with accurate cost tracking while building foundation for advanced usage analytics.

## Executive Summary

### Current State Assessment
- ✅ **Sophisticated UI**: Advanced token/cost display with progress visualization
- ✅ **Real-time Tracking**: Stream-based usage data via Vercel AI SDK
- ✅ **Database Persistence**: Usage data stored per chat
- ❌ **Missing OpenRouter Native Support**: Not using `usage.include` parameter

### Key Findings

#### Current Limitations
1. **Estimated Costs**: Uses `tokenlens` library for cost estimates vs actual OpenRouter billing
2. **Third-party Token Counting**: Relies on AI SDK estimates vs model-native tokenizers
3. **Limited Cache Data**: Missing detailed cache read/write accounting
4. **Performance Gap**: Additional processing for usage calculation

#### OpenRouter Native Benefits
1. **100% Accurate Costs**: Real billing amounts instead of estimates
2. **Native Token Counting**: Each model's actual tokenizer
3. **Enhanced Cache Metrics**: Detailed cache hit/miss tracking
4. **Performance Optimization**: Server-side token counting during generation

### Implementation Strategy

#### Quick Win (2-4 hours)
```typescript
// Add to streamText configuration
providerOptions: {
  openai: {
    usage: { include: true }, // Enable OpenRouter native usage
    user: `intellisync_${userId}`, // User tracking integration
  },
}
```

#### Enhanced Data Structure
```typescript
interface OpenRouterUsage {
  cost: number; // Actual cost in credits
  cached_tokens: number; // Cache performance
  reasoning_tokens: number; // O1-style reasoning
  upstream_inference_cost: number; // BYOK scenarios
}
```

### Expected Impact
- **Cost Accuracy**: Replace estimates with real billing data
- **Performance**: Eliminate separate usage API calls
- **User Experience**: Real-time accurate cost feedback
- **Cache Optimization**: Detailed cache performance insights

The analysis shows that the application already has excellent usage tracking infrastructure - it just needs OpenRouter's native capabilities enabled to achieve 100% accuracy and enhanced performance insights.