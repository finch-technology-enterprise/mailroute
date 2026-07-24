import { authRequest } from "./client";
import type { ApiResponse, LoginData, SignupData, UserInfo, TenantInfo } from "../types";

export function login(email: string, password: string): Promise<ApiResponse<LoginData>> {
  return authRequest("POST", "/login", { email, password });
}

export function signup(data: {
  name: string;
  email: string;
  password: string;
  tenantName: string;
  tenantSlug: string;
}): Promise<ApiResponse<SignupData>> {
  return authRequest("POST", "/signup", data);
}

export function getMe(): Promise<ApiResponse<{ user: UserInfo; tenant: TenantInfo }>> {
  return authRequest("GET", "/me");
}

export function logout(): Promise<ApiResponse<null>> {
  return authRequest("POST", "/logout", {});
}
