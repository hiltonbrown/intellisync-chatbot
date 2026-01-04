import "server-only";

import { xeroConfig } from "./config";
import { getValidXeroAccessToken } from "./token-service";
import { XeroApiError } from "./types";

async function xeroRequest<T>({
  clerkOrgId,
  tenantId,
  path,
}: {
  clerkOrgId: string;
  tenantId: string;
  path: string;
}): Promise<T> {
  const token = await getValidXeroAccessToken(clerkOrgId, tenantId);
  const response = await fetch(`${xeroConfig.apiBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "xero-tenant-id": tenantId,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new XeroApiError(
      `Xero API request failed: ${path}`,
      response.status
    );
  }

  return response.json() as Promise<T>;
}

export function getInvoices({
  clerkOrgId,
  tenantId,
  invoiceId,
}: {
  clerkOrgId: string;
  tenantId: string;
  invoiceId?: string;
}) {
  const path = invoiceId
    ? `/Invoices/${invoiceId}`
    : "/Invoices";
  return xeroRequest<unknown>({ clerkOrgId, tenantId, path });
}

export function getContacts({
  clerkOrgId,
  tenantId,
  contactId,
}: {
  clerkOrgId: string;
  tenantId: string;
  contactId?: string;
}) {
  const path = contactId
    ? `/Contacts/${contactId}`
    : "/Contacts";
  return xeroRequest<unknown>({ clerkOrgId, tenantId, path });
}

export function getPayments({
  clerkOrgId,
  tenantId,
  paymentId,
}: {
  clerkOrgId: string;
  tenantId: string;
  paymentId?: string;
}) {
  const path = paymentId
    ? `/Payments/${paymentId}`
    : "/Payments";
  return xeroRequest<unknown>({ clerkOrgId, tenantId, path });
}
