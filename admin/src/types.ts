export interface Vendor {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  apiEndpoint: string;
  apiToken: string;
  fromEmail: string;
  fromName: string;
  config: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  slug: string;
  subject: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string | null;
  data: T;
}

export interface Stats {
  vendorCount: number;
  templateCount: number;
}

export interface VendorFormData {
  name: string;
  enabled: boolean;
  priority: number;
  apiEndpoint: string;
  apiToken: string;
  fromEmail: string;
  fromName: string;
  config?: string;
}

export interface TemplateFormData {
  slug: string;
  subject: string;
  content: string;
}

export interface TestSendPayload {
  to: string;
  subject: string;
  content: string;
  vendor?: string;
}

// --- Auth types ---

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginData {
  user: UserInfo;
  tenant: TenantInfo;
  token: string;
}

export interface SignupData {
  user: UserInfo;
  tenant: TenantInfo & { apiKey: string };
  token: string;
}
