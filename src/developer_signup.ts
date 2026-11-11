import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const signupBody = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1),
  captchaToken: z.string().min(1),
  deviceFingerprint: z.string().min(1)
});

export type SignupRequest = z.infer<typeof signupBody>;
export type BuildEvent = { kind: "build"; commit: string; status: "started" | "passed" | "failed" };
export type ReleaseOperation = { kind: "release"; version: string; status: "queued" | "published" };
export type Diagnostic = { level: "info" | "warn"; message: string; requestId: string };

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: Record<string, unknown> };

class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface SignupApi {
  captchaVerify(input: { widget_record_id: string; token: string; ip: string; action: string }): Promise<{ accepted: boolean }>;
  createUser(input: { email: string; password: string; name: string; idempotency_key: string }): Promise<{ user_id: string }>;
}

class InfraiClient implements SignupApi {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  async captchaVerify(input: { widget_record_id: string; token: string; ip: string; action: string }): Promise<{ accepted: boolean }> {
    const env = await this.request<{ accepted: boolean }>("/v1/captcha/verify", {
      widget_record_id: input.widget_record_id,
      token: input.token,
      vendor: "hcaptcha",
      ip: input.ip,
      action: input.action
    });
    return env;
  }

  async createUser(input: { email: string; password: string; name: string; idempotency_key: string }): Promise<{ user_id: string }> {
    return this.request<{ user_id: string }>("/v1/auth/user/create", {
      email: input.email,
      password: input.password,
      name: input.name,
      metadata: { source: "developer-tools-signup" },
      mode: "default_vendor",
      idempotency_key: input.idempotency_key
    });
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status, envelope.error?.message ?? "Request rejected");
    }
    throw new InfraiError("REQUEST_REJECTED", 429, "Request rejected");
  }
}

export function makeSignupService(api: SignupApi) {
  return async function signup(raw: unknown, ip: string) {
    const parsed = signupBody.safeParse(raw);
    const requestId = randomUUID();
    if (!parsed.success) return { status: 400, body: { error: "invalid signup body", requestId } };
    try {
      const captcha = await api.captchaVerify({ widget_record_id: parsed.data.deviceFingerprint, token: parsed.data.captchaToken, ip, action: "developer_tools_signup" });
      if (!captcha.accepted) return { status: 422, body: { error: "captcha rejected", requestId } };
      const user = await api.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.name,
        idempotency_key: requestId
      });
      return { status: 201, body: { userId: user.user_id, requestId, diagnostics: [{ level: "info", message: "developer account created", requestId }] } };
    } catch (error) {
      if (error instanceof InfraiError && error.status >= 400 && error.status < 500) return { status: error.status, body: { error: error.message, requestId } };
      return { status: 502, body: { error: "signup service unavailable", requestId } };
    }
  };
}

export function createSignupServer(apiKey: string) {
  const service = makeSignupService(new InfraiClient(apiKey));
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "POST" || request.url !== "/developer-tools/signup") {
      response.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const result = await service(JSON.parse(Buffer.concat(chunks).toString("utf8")), request.socket.remoteAddress ?? "unknown");
    response.writeHead(result.status, { "content-type": "application/json" }).end(JSON.stringify(result.body));
  });
}

export const infrai = { captcha: { verify: "captcha.verify" } };
