import { z } from "zod";
import { callProfessional } from "./call.js";
import { ConnectorError } from "./errors.js";
import {
  confirmField,
  DELETE_WARNING,
  discountTypeField,
  idString,
  invoiceStatusField,
  isoUtc,
  organizationIdField,
} from "./fields.js";
import { definedBody, definedQuery } from "./json.js";
import { resolveOrganizationId } from "./org.js";
import { requireOp } from "./pick.js";
import type { Runtime } from "./runtime.js";

export const invoiceSettingsInput = z.object({
  action: z.enum(["get", "update"]),
  organization_id: organizationIdField,
  seller_name: z.string().max(255).nullable().optional(),
  seller_vatin: z.string().max(255).nullable().optional(),
  seller_address_line_1: z.string().max(255).nullable().optional(),
  seller_address_line_2: z.string().max(255).nullable().optional(),
  seller_address_line_3: z.string().max(255).nullable().optional(),
  seller_address_post_code: z.string().max(64).nullable().optional(),
  seller_address_city: z.string().max(255).nullable().optional(),
  seller_address_country: z.string().max(8).nullable().optional(),
  seller_phone: z.string().max(64).nullable().optional(),
  seller_email: z.string().max(255).nullable().optional(),
  footer_default: z.string().max(5000).nullable().optional(),
  notes_default: z.string().max(5000).nullable().optional(),
  tax_rate_default: z.number().int().min(0).max(10000).nullable().optional(),
  e_invoicing_enabled: z.boolean().optional(),
  confirm: confirmField,
});

export const invoiceRecipientsInput = z.object({
  action: z.enum(["list", "get", "create", "update", "delete", "duplicate"]),
  organization_id: organizationIdField,
  invoice_recipient_id: idString.optional(),
  name: z.string().trim().min(1).max(255).optional(),
  vatin: z.string().max(255).nullable().optional(),
  address_line_1: z.string().max(255).nullable().optional(),
  address_line_2: z.string().max(255).nullable().optional(),
  address_line_3: z.string().max(255).nullable().optional(),
  address_post_code: z.string().max(64).nullable().optional(),
  address_city: z.string().max(255).nullable().optional(),
  address_country: z.string().max(8).nullable().optional(),
  phone: z.string().max(64).nullable().optional(),
  email: z.string().max(255).nullable().optional(),
  is_archived: z.boolean().optional(),
  confirm: confirmField,
});

export const invoicesInput = z.object({
  action: z.enum([
    "list",
    "get",
    "create",
    "update",
    "delete",
    "copy",
    "download",
    "download_e_invoice",
  ]),
  organization_id: organizationIdField,
  invoice_id: idString.optional(),
  page: z.number().int().min(1).optional(),
  status: invoiceStatusField.optional(),
  seller_name: z.string().trim().min(1).max(255).optional(),
  invoice_recipient_id: idString.optional(),
  date: isoUtc.optional(),
  reference: z.string().trim().min(1).max(255).optional(),
  currency: z.string().trim().min(3).max(8).optional(),
  due_at: isoUtc.nullable().optional(),
  paid_date: isoUtc.nullable().optional(),
  billing_period_start: isoUtc.nullable().optional(),
  billing_period_end: isoUtc.nullable().optional(),
  tax_rate: z.number().int().min(0).max(2147483647).optional(),
  discount_amount: z.number().int().min(0).optional(),
  discount_type: discountTypeField.optional(),
  footer: z.string().max(5000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  payment_terms: z.string().max(5000).nullable().optional(),
  is_eu_reverse_charge: z.boolean().optional(),
  copy_reference: z.string().trim().min(1).max(255).optional(),
  confirm: confirmField,
});

async function orgId(runtime: Runtime, organizationId: string | undefined): Promise<string> {
  return resolveOrganizationId(runtime, organizationId);
}

function recipientBody(
  args: z.output<typeof invoiceRecipientsInput>,
): Record<string, unknown> | undefined {
  return definedBody({
    name: args.name,
    vatin: args.vatin,
    address_line_1: args.address_line_1,
    address_line_2: args.address_line_2,
    address_line_3: args.address_line_3,
    address_post_code: args.address_post_code,
    address_city: args.address_city,
    address_country: args.address_country,
    phone: args.phone,
    email: args.email,
    is_archived: args.is_archived,
  });
}

export async function invoiceSettings(
  runtime: Runtime,
  args: z.output<typeof invoiceSettingsInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  if (args.action === "get") {
    return callProfessional(runtime, requireOp("solidtime_invoice_settings", "get"), {
      params: { organization },
    });
  }
  return callProfessional(runtime, requireOp("solidtime_invoice_settings", "update"), {
    params: { organization },
    body: definedBody({
      seller_name: args.seller_name,
      seller_vatin: args.seller_vatin,
      seller_address_line_1: args.seller_address_line_1,
      seller_address_line_2: args.seller_address_line_2,
      seller_address_line_3: args.seller_address_line_3,
      seller_address_post_code: args.seller_address_post_code,
      seller_address_city: args.seller_address_city,
      seller_address_country: args.seller_address_country,
      seller_phone: args.seller_phone,
      seller_email: args.seller_email,
      footer_default: args.footer_default,
      notes_default: args.notes_default,
      tax_rate_default: args.tax_rate_default,
      e_invoicing_enabled: args.e_invoicing_enabled,
    }),
    confirm: args.confirm,
    summary: "Update invoice settings.",
  });
}

export async function invoiceRecipients(
  runtime: Runtime,
  args: z.output<typeof invoiceRecipientsInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  if (args.action === "list") {
    return callProfessional(runtime, requireOp("solidtime_invoice_recipients", "list"), {
      params: { organization },
    });
  }
  if (args.action === "create") {
    if (args.name === undefined) throw new ConnectorError("input", "name is required.");
    return callProfessional(runtime, requireOp("solidtime_invoice_recipients", "create"), {
      params: { organization },
      body: recipientBody(args) ?? { name: args.name },
      confirm: args.confirm,
      summary: `Create invoice recipient ${args.name}.`,
    });
  }
  if (args.invoice_recipient_id === undefined) {
    throw new ConnectorError("input", "invoice_recipient_id is required.");
  }
  if (args.action === "get") {
    return callProfessional(runtime, requireOp("solidtime_invoice_recipients", "get"), {
      params: { organization, invoiceRecipient: args.invoice_recipient_id },
    });
  }
  if (args.action === "update") {
    return callProfessional(runtime, requireOp("solidtime_invoice_recipients", "update"), {
      params: { organization, invoiceRecipient: args.invoice_recipient_id },
      body: recipientBody(args) ?? {},
      confirm: args.confirm,
      summary: "Update an invoice recipient.",
    });
  }
  if (args.action === "duplicate") {
    return callProfessional(runtime, requireOp("solidtime_invoice_recipients", "duplicate"), {
      params: { organization, invoiceRecipient: args.invoice_recipient_id },
      confirm: args.confirm,
      summary: "Duplicate an invoice recipient.",
    });
  }
  return callProfessional(runtime, requireOp("solidtime_invoice_recipients", "delete"), {
    params: { organization, invoiceRecipient: args.invoice_recipient_id },
    confirm: args.confirm,
    summary: "Delete an invoice recipient.",
    warnings: [DELETE_WARNING],
  });
}

export async function invoices(
  runtime: Runtime,
  args: z.output<typeof invoicesInput>,
): Promise<Record<string, unknown>> {
  const organization = await orgId(runtime, args.organization_id);
  if (args.action === "list") {
    return callProfessional(runtime, requireOp("solidtime_invoices", "list"), {
      params: { organization },
      query: definedQuery({ page: args.page, status: args.status }),
    });
  }
  if (args.action === "create") {
    if (
      args.seller_name === undefined ||
      args.invoice_recipient_id === undefined ||
      args.date === undefined ||
      args.reference === undefined ||
      args.currency === undefined
    ) {
      throw new ConnectorError(
        "input",
        "seller_name, invoice_recipient_id, date, reference, and currency are required.",
      );
    }
    return callProfessional(runtime, requireOp("solidtime_invoices", "create"), {
      params: { organization },
      body: definedBody({
        seller_name: args.seller_name,
        invoice_recipient_id: args.invoice_recipient_id,
        date: args.date,
        reference: args.reference,
        currency: args.currency,
        due_at: args.due_at,
        paid_date: args.paid_date,
        billing_period_start: args.billing_period_start,
        billing_period_end: args.billing_period_end,
        tax_rate: args.tax_rate,
        discount_amount: args.discount_amount,
        discount_type: args.discount_type,
        footer: args.footer,
        notes: args.notes,
        payment_terms: args.payment_terms,
        is_eu_reverse_charge: args.is_eu_reverse_charge,
      }),
      confirm: args.confirm,
      summary: `Create invoice ${args.reference}.`,
    });
  }
  if (args.invoice_id === undefined) throw new ConnectorError("input", "invoice_id is required.");
  if (args.action === "get") {
    return callProfessional(runtime, requireOp("solidtime_invoices", "get"), {
      params: { organization, invoice: args.invoice_id },
    });
  }
  if (args.action === "update") {
    return callProfessional(runtime, requireOp("solidtime_invoices", "update"), {
      params: { organization, invoice: args.invoice_id },
      body: definedBody({
        status: args.status,
        due_at: args.due_at,
        paid_date: args.paid_date,
        notes: args.notes,
        footer: args.footer,
        payment_terms: args.payment_terms,
      }),
      confirm: args.confirm,
      summary: "Update an invoice.",
    });
  }
  if (args.action === "copy") {
    if (args.copy_reference === undefined) {
      throw new ConnectorError("input", "copy_reference is required.");
    }
    return callProfessional(runtime, requireOp("solidtime_invoices", "copy"), {
      params: { organization, invoice: args.invoice_id },
      body: { reference: args.copy_reference },
      confirm: args.confirm,
      summary: "Copy an invoice.",
    });
  }
  if (args.action === "download" || args.action === "download_e_invoice") {
    return callProfessional(runtime, requireOp("solidtime_invoices", args.action), {
      params: { organization, invoice: args.invoice_id },
      confirm: args.confirm,
      summary: args.action === "download" ? "Download an invoice PDF." : "Download an e-invoice.",
    });
  }
  return callProfessional(runtime, requireOp("solidtime_invoices", "delete"), {
    params: { organization, invoice: args.invoice_id },
    confirm: args.confirm,
    summary: "Delete an invoice.",
    warnings: [DELETE_WARNING],
  });
}
