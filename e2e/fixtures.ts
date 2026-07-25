import { test as base, request, type APIRequestContext } from "@playwright/test";

interface TestFixtures {
  apiContext: APIRequestContext;
  adminToken: string;
  apiKey: string;
  tenantSlug: string;
}

const uid = () => Math.random().toString(36).slice(2, 8);

export async function signupUser(baseURL: string): Promise<{
  token: string;
  apiKey: string;
  tenantId: string;
  userId: string;
  email: string;
}> {
  const email = `test-${uid()}@example.com`;
  const res = await fetch(`${baseURL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email,
      password: "testpassword123",
      tenantName: `Test Tenant ${uid()}`,
      tenantSlug: `test-${uid()}`,
    }),
  });
  const data = (await res.json()) as {
    data: { token: string; tenant: { apiKey: string; id: string }; user: { id: string } };
  };
  return {
    token: data.data.token,
    apiKey: data.data.tenant.apiKey,
    tenantId: data.data.tenant.id,
    userId: data.data.user.id,
    email,
  };
}

export const test = base.extend<TestFixtures>({
  apiContext: async ({}, use) => {
    const ctx = await request.newContext({ baseURL: "http://localhost:8787" });
    await use(ctx);
    await ctx.dispose();
  },
  adminToken: async ({}, use) => {
    const { token } = await signupUser("http://localhost:8787");
    await use(token);
  },
  apiKey: async ({}, use) => {
    const { apiKey } = await signupUser("http://localhost:8787");
    await use(apiKey);
  },
});

export { expect } from "@playwright/test";
