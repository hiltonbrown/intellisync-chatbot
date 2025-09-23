# Usage Accounting and Cost Tracking Implementation Plan

## Current State Analysis

The codebase already has comprehensive cost tracking infrastructure:

### Existing Infrastructure
- **OpenRouterKeyService** (`lib/services/openrouter-keys.ts`) with `recordUsage()` method
- **Database Schema** with `openrouterKeyAudit` table for detailed usage logging
- **User Schema** with `currentUsage` and `creditLimit` tracking
- **Types** with `UsageWithCost` interface for cost data structure
- **Audit Trail** capturing all usage with metadata (cost, tokens, model, chat)

### Current Usage Tracking Flow
1. AI requests made through user-specific OpenRouter keys
2. Usage data captured with cost, tokens, and model information
3. User's `currentUsage` incremented automatically
4. Detailed audit records created with full metadata
5. Clerk metadata updated with usage statistics

## Enhanced Usage Accounting Plan

### 1. Real-time Usage Monitoring
- **Cost Alerts**: Implement threshold-based notifications when users approach credit limits
- **Usage Dashboard**: Real-time usage visualization with charts and metrics
- **Rate Limiting**: Enforce per-user API call limits to prevent runaway costs
- **Budget Controls**: Allow users to set daily/monthly spending limits

### 2. Detailed Analytics and Reporting
- **Usage Breakdown**: Cost analysis by model, time period, and chat session
- **Token Efficiency**: Track prompt/completion token ratios for optimization insights
- **Model Performance**: Compare cost-effectiveness across different AI models
- **Historical Trends**: Usage patterns and cost projections over time

### 3. Advanced Cost Management
- **Tiered Pricing**: Implement usage-based pricing tiers (free, pro, enterprise)
- **Cost Optimization**: Suggest cheaper models for similar use cases
- **Bulk Credits**: Allow pre-purchase of credits with discounts
- **Usage Quotas**: Flexible quota management per user type

### 4. Administrative Features
- **Usage Analytics Dashboard**: Admin view of platform-wide usage and costs
- **User Cost Management**: Admin tools to adjust limits and monitor high-usage accounts
- **Billing Integration**: Export usage data for invoicing and payment processing
- **Cost Allocation**: Track costs by organization/team for enterprise users

### 5. Enhanced Database Schema
```sql
-- Usage Sessions Table
CREATE TABLE usage_sessions (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES "User"(id),
  chat_id UUID REFERENCES "Chat"(id),
  model_id VARCHAR(255),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  total_cost INTEGER, -- cents
  total_tokens INTEGER,
  session_type VARCHAR(32) -- 'chat', 'api', 'bulk'
);

-- Cost Budgets Table
CREATE TABLE cost_budgets (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES "User"(id),
  budget_type VARCHAR(16), -- 'daily', 'weekly', 'monthly'
  limit_amount INTEGER, -- cents
  current_spent INTEGER DEFAULT 0,
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Usage Alerts Table
CREATE TABLE usage_alerts (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES "User"(id),
  alert_type VARCHAR(32), -- 'budget_warning', 'limit_reached', 'quota_exceeded'
  threshold_percentage INTEGER, -- 80, 90, 100
  message TEXT,
  sent_at TIMESTAMP,
  acknowledged_at TIMESTAMP
);
```

### 6. API Enhancements
- **Usage API Endpoints**: RESTful APIs for querying usage data
- **Webhooks**: Real-time notifications for usage events
- **Cost Estimation**: Pre-request cost estimation for large operations
- **Usage Exports**: CSV/JSON exports for external analysis

### 7. User Experience Features
- **Usage Widgets**: Embed usage meters in chat interface
- **Cost Predictions**: Show estimated costs before expensive operations
- **Usage History**: Detailed transaction history with filtering
- **Budget Notifications**: In-app and email alerts for usage thresholds

### 8. Integration Points
- **Billing Systems**: Connect with Stripe/other payment processors
- **Analytics Platforms**: Export data to business intelligence tools
- **Monitoring**: Integration with application performance monitoring
- **Audit Compliance**: Detailed logging for financial audit requirements

## Implementation Priority

### Phase 1: Core Infrastructure (Week 1-2)
1. Enhanced database schema for sessions and budgets
2. Usage session tracking and aggregation
3. Real-time usage API endpoints
4. Basic usage dashboard for users

### Phase 2: Management Features (Week 3-4)
1. Budget controls and alerts system
2. Administrative usage dashboard
3. Cost optimization recommendations
4. Enhanced audit trail with session tracking

### Phase 3: Advanced Analytics (Week 5-6)
1. Detailed usage analytics and reporting
2. Historical trend analysis
3. Model performance comparisons
4. Usage prediction algorithms

### Phase 4: Integration & Optimization (Week 7-8)
1. Billing system integration
2. External API webhooks
3. Performance optimization
4. Comprehensive testing and monitoring

## Technical Considerations

### Performance
- **Caching**: Redis caching for frequently accessed usage data
- **Aggregation**: Pre-calculated usage summaries for faster queries
- **Indexing**: Optimized database indexes for usage queries
- **Batch Processing**: Efficient bulk operations for large usage datasets

### Security
- **Data Privacy**: Ensure usage data is properly protected
- **Access Control**: Role-based access to usage information
- **Audit Logging**: Comprehensive audit trail for all usage operations
- **Encryption**: Sensitive usage data encrypted at rest

### Scalability
- **Time-series Data**: Optimize for time-based usage queries
- **Data Retention**: Automatic archival of old usage data
- **Horizontal Scaling**: Design for multi-tenant usage tracking
- **Load Balancing**: Distribute usage tracking across services