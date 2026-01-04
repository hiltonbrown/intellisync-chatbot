import { auth } from "@clerk/nextjs/server";
import { getContacts, getInvoices, getPayments } from "@/lib/integrations/xero/client";

const REQUIRED_ROLES = new Set(["owner", "admin"]);

export async function GET(request: Request) {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!orgId || !orgRole) {
    return new Response("Organization context required", { status: 400 });
  }

  if (!REQUIRED_ROLES.has(orgRole)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const entity = searchParams.get("entity");
  const resourceId = searchParams.get("resourceId") ?? undefined;

  if (!tenantId || !entity) {
    return new Response("Missing tenantId or entity", { status: 400 });
  }

  switch (entity) {
    case "invoice": {
      const data = await getInvoices({
        clerkOrgId: orgId,
        tenantId,
        invoiceId: resourceId,
      });
      return Response.json(data);
    }
    case "contact": {
      const data = await getContacts({
        clerkOrgId: orgId,
        tenantId,
        contactId: resourceId,
      });
      return Response.json(data);
    }
    case "payment": {
      const data = await getPayments({
        clerkOrgId: orgId,
        tenantId,
        paymentId: resourceId,
      });
      return Response.json(data);
    }
    default:
      return new Response("Unsupported entity", { status: 400 });
  }
}
