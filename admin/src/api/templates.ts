import { get, post, put, del } from "./client";
import type { ApiResponse, Template, TemplateFormData } from "../types";

export function listTemplates(): Promise<ApiResponse<Template[]>> {
  return get("/templates");
}

export function createTemplate(data: TemplateFormData): Promise<ApiResponse<Template>> {
  return post("/templates", data);
}

export function updateTemplate(id: string, data: Partial<TemplateFormData>): Promise<ApiResponse<Template>> {
  return put(`/templates/${id}`, data);
}

export function deleteTemplate(id: string): Promise<ApiResponse<null>> {
  return del(`/templates/${id}`);
}
