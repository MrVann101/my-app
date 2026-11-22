import { NextResponse } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "request_error",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "The request contains invalid fields.",
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  console.error(
    JSON.stringify({
      level: "error",
      message: "unhandled_api_error",
      error: error instanceof Error ? error.message : String(error),
    }),
  );

  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong." } },
    { status: 500 },
  );
}

export function requireAuthenticatedUser(userId: string | null | undefined): string {
  if (!userId) {
    throw new ApiError(401, "Authentication is required.", "unauthorized");
  }

  return userId;
}

export async function parseJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.", "invalid_json");
  }

  return schema.parse(body);
}

export const idSchema = z.coerce.number().int().positive();
export const isoDateSchema = z.iso.date();
export const weightGramsSchema = z.number().finite().positive().max(100_000);
