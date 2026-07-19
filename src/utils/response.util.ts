// src/utils/response.util.ts
export const ApiResponse = (
  success: boolean,
  message?: string | null,
  data: any = null,
) => {
  return {
    success,
    message,
    data,
  };
};
