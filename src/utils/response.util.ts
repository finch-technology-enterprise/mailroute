// src/utils/response.util.ts
export const ApiResponse = <T = null>(
  success: boolean,
  message?: string | null,
  data: T = null as unknown as T,
) => {
  return {
    success,
    message,
    data,
  };
};
