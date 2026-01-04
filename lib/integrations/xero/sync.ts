import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  integrationConnections,
  xeroContacts,
  xeroInvoices,
  xeroPayments,
} from "@/lib/db/schema";
import type { SyncEntityType } from "@/lib/integrations/types";
import { getContacts, getInvoices, getPayments } from "./client";
import { XeroApiError } from "./types";

async function resolveActiveConnection(tenantId: string) {
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.provider, "xero"),
        eq(integrationConnections.externalAccountId, tenantId)
      )
    )
    .limit(1);

  if (!connection || connection.state !== "active") {
    return null;
  }

  return connection;
}

async function markSoftDeleted({
  tenantId,
  entityType,
  resourceId,
}: {
  tenantId: string;
  entityType: SyncEntityType;
  resourceId: string;
}) {
  const table =
    entityType === "invoice"
      ? xeroInvoices
      : entityType === "contact"
        ? xeroContacts
        : xeroPayments;

  await db
    .insert(table)
    .values({
      tenantId,
      xeroResourceId: resourceId,
      data: {},
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [table.tenantId, table.xeroResourceId],
      set: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

export async function syncInvoice({
  tenantId,
  resourceId,
}: {
  tenantId: string;
  resourceId: string;
}) {
  const connection = await resolveActiveConnection(tenantId);
  if (!connection) {
    return;
  }

  try {
    const data = await getInvoices({
      clerkOrgId: connection.clerkOrgId,
      tenantId,
      invoiceId: resourceId,
    });

    await db
      .insert(xeroInvoices)
      .values({
        tenantId,
        xeroResourceId: resourceId,
        data,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [xeroInvoices.tenantId, xeroInvoices.xeroResourceId],
        set: {
          data,
          deletedAt: null,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    if (error instanceof XeroApiError && error.status === 404) {
      await markSoftDeleted({ tenantId, entityType: "invoice", resourceId });
      return;
    }

    throw error;
  }
}

export async function syncContact({
  tenantId,
  resourceId,
}: {
  tenantId: string;
  resourceId: string;
}) {
  const connection = await resolveActiveConnection(tenantId);
  if (!connection) {
    return;
  }

  try {
    const data = await getContacts({
      clerkOrgId: connection.clerkOrgId,
      tenantId,
      contactId: resourceId,
    });

    await db
      .insert(xeroContacts)
      .values({
        tenantId,
        xeroResourceId: resourceId,
        data,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [xeroContacts.tenantId, xeroContacts.xeroResourceId],
        set: {
          data,
          deletedAt: null,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    if (error instanceof XeroApiError && error.status === 404) {
      await markSoftDeleted({ tenantId, entityType: "contact", resourceId });
      return;
    }

    throw error;
  }
}

export async function syncPayment({
  tenantId,
  resourceId,
}: {
  tenantId: string;
  resourceId: string;
}) {
  const connection = await resolveActiveConnection(tenantId);
  if (!connection) {
    return;
  }

  try {
    const data = await getPayments({
      clerkOrgId: connection.clerkOrgId,
      tenantId,
      paymentId: resourceId,
    });

    await db
      .insert(xeroPayments)
      .values({
        tenantId,
        xeroResourceId: resourceId,
        data,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [xeroPayments.tenantId, xeroPayments.xeroResourceId],
        set: {
          data,
          deletedAt: null,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    if (error instanceof XeroApiError && error.status === 404) {
      await markSoftDeleted({ tenantId, entityType: "payment", resourceId });
      return;
    }

    throw error;
  }
}
