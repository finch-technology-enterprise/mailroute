// src/middlewares/error.middleware.ts
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { LogToNewRelic } from "../utils/helpers.util";
import { ApiResponse } from "../utils/response.util";

export const ErrorHandler = (error: any, c: Context) => {
  const status = error instanceof HTTPException ? error.status : 500;

  // Full detail is logged server-side only — never returned to the client.
  const cause = error?.cause || {};
  const internalDetail =
    cause.sqlMessage ||
    cause.code ||
    cause.message ||
    error?.message ||
    "Internal Server Error";

  LogToNewRelic(c, `[${status}] ${internalDetail}`, {
    level: "ERROR",
    "context.status": status,
  });

  // Only echo a message for explicit HTTPExceptions (intentional, safe text).
  // Everything else gets a generic message so we don't leak internals.
  const clientMessage =
    error instanceof HTTPException ? error.message : "Internal Server Error";

  return c.json(ApiResponse(false, clientMessage), status);
};
