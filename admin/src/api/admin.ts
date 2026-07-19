import { get, post } from "./client";
import type { ApiResponse, Stats, TestSendPayload } from "../types";

export function getStats(): Promise<ApiResponse<Stats>> {
  return get("/stats");
}

export function sendTestEmail(data: TestSendPayload): Promise<ApiResponse<null>> {
  return post("/test-send", data);
}
