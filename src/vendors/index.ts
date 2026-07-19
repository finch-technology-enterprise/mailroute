import { EmailVendorAdapter } from "./types";
import { senderAdapter } from "./sender.adapter";
import { brevoAdapter } from "./brevo.adapter";

export type { EmailVendorAdapter, SendArgs } from "./types";

/**
 * Vendor registry keyed by adapter `name`. The `name` matches the `name`
 * column of an email_vendors D1 row. Add a vendor: create an adapter file,
 * then add one entry here.
 */
export const ADAPTERS: Record<string, EmailVendorAdapter> = {
  [senderAdapter.name]: senderAdapter,
  [brevoAdapter.name]: brevoAdapter,
};
