import type { CloudflareBindings } from "./cloudflare.binding";

export interface AppEnv {
  Bindings: CloudflareBindings;
  Variables: {
    tenantId: string;
    userId: string;
    userRole: string;
  };
}
