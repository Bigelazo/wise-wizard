import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));

describe("GET /api/health", () => {
  it("returns 503 when Postgres is unreachable", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@127.0.0.1:1/none");
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(503);
  });
});
