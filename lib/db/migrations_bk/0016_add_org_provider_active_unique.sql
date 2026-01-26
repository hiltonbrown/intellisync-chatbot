-- Custom SQL migration file, put your code below! --
CREATE UNIQUE INDEX integration_tenant_bindings_org_provider_active
ON integration_tenant_bindings (clerk_org_id, provider)
WHERE status = 'active';
