import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const conflict = (msg: string, details?: unknown) => new HttpError(409, msg, details);

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/**
 * CSRF defence for cookie-authenticated requests: a browser always sends
 * Origin on cross-site POST/PUT/PATCH/DELETE, so reject any whose origin
 * isn't this site. (SameSite=Lax cookies are the first line of defence.)
 */
function assertSameOrigin(req: Request) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    /* malformed */
  }
  if (!host || originHost !== host) throw new HttpError(403, "Cross-site request blocked.");
}

/** Wraps a route handler with uniform error -> JSON translation. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
      }
      if (e instanceof ZodError) {
        const first = e.issues[0];
        const path = first?.path.join(".");
        return NextResponse.json(
          { error: first ? `${path ? `${path}: ` : ""}${first.message}` : "Invalid input", details: e.flatten() },
          { status: 400 },
        );
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === "P2025") return NextResponse.json({ error: "Record not found" }, { status: 404 });
        if (e.code === "P2003") {
          return NextResponse.json(
            { error: "This record is referenced by another record and can't be changed." },
            { status: 409 },
          );
        }
      }
      if (e instanceof SyntaxError) return NextResponse.json({ error: "Malformed JSON body" }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text) throw badRequest("Request body is empty");
  return JSON.parse(text);
}
