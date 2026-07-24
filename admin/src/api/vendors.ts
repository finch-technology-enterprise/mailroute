import { get, post, put, del } from "./client";
import type { ApiResponse, Vendor, VendorFormData } from "../types";

export function listVendors(): Promise<ApiResponse<Vendor[]>> {
  return get("/vendors");
}

export function createVendor(
  data: VendorFormData,
): Promise<ApiResponse<Vendor>> {
  return post("/vendors", data);
}

export function updateVendor(
  id: string,
  data: Partial<VendorFormData>,
): Promise<ApiResponse<Vendor>> {
  return put(`/vendors/${id}`, data);
}

export function deleteVendor(id: string): Promise<ApiResponse<null>> {
  return del(`/vendors/${id}`);
}
