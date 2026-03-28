import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock localDb
vi.mock("./localDb", () => ({
  getLocalCredentials: vi.fn().mockResolvedValue([
    {
      id: 1, localUserId: 42, serviceName: "Netflix", username: "user@email.com",
      encryptedPassword: "enc", iv: "iv123", notes: null, groupId: null,
      subscriptionStart: new Date("2026-03-01"), subscriptionDays: 30,
      createdAt: new Date(), updatedAt: new Date(),
    },
  ]),
  getLocalCredentialById: vi.fn().mockImplementation((id: number) =>
    id === 1
      ? Promise.resolve({ id: 1, localUserId: 42, serviceName: "Netflix", username: "user@email.com", encryptedPassword: "enc", iv: "iv123", notes: null, groupId: null, subscriptionStart: new Date("2026-03-01"), subscriptionDays: 30, createdAt: new Date(), updatedAt: new Date() })
      : Promise.resolve(undefined)
  ),
  createLocalCredential: vi.fn().mockResolvedValue(undefined),
  updateLocalCredential: vi.fn().mockResolvedValue(undefined),
  deleteLocalCredential: vi.fn().mockResolvedValue(undefined),
  getLocalUserByEmail: vi.fn(),
  getLocalUserById: vi.fn(),
  createLocalUser: vi.fn(),
  verifyLocalUser: vi.fn(),
  getCredentialGroups: vi.fn().mockResolvedValue([]),
  getCredentialGroupById: vi.fn().mockResolvedValue(undefined),
  createCredentialGroup: vi.fn(),
  updateCredentialGroup: vi.fn(),
  deleteCredentialGroup: vi.fn(),
}));

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    jwtVerify: vi.fn().mockResolvedValue({ payload: { sub: "42", type: "local" } }),
    SignJWT: actual.SignJWT,
  };
});

function makeCtx(cookie = "valid-token"): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: cookie ? { cookie: `edh_session=${cookie}` } : {} } as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("vault.create with subscription fields", () => {
  it("creates a credential with subscriptionStart and subscriptionDays", async () => {
    const { createLocalCredential } = await import("./localDb");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.vault.create({
      serviceName: "Netflix",
      username: "user@email.com",
      encryptedPassword: "enc",
      iv: "iv123",
      subscriptionStart: "2026-03-01",
      subscriptionDays: 30,
    });
    expect(result.success).toBe(true);
    expect(createLocalCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceName: "Netflix",
        subscriptionDays: 30,
        subscriptionStart: expect.any(Date),
      })
    );
  });

  it("creates a credential without subscription fields", async () => {
    const { createLocalCredential } = await import("./localDb");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.vault.create({
      serviceName: "GitHub",
      username: "dev@email.com",
      encryptedPassword: "enc2",
      iv: "iv456",
    });
    expect(result.success).toBe(true);
    expect(createLocalCredential).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: "GitHub", subscriptionStart: null, subscriptionDays: null })
    );
  });
});

describe("vault.update with subscription fields", () => {
  it("updates subscriptionDays on an existing credential", async () => {
    const { updateLocalCredential } = await import("./localDb");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.vault.update({
      id: 1,
      subscriptionDays: 60,
    });
    expect(result.success).toBe(true);
    expect(updateLocalCredential).toHaveBeenCalledWith(
      1, 42,
      expect.objectContaining({ subscriptionDays: 60 })
    );
  });

  it("clears subscriptionStart when set to null", async () => {
    const { updateLocalCredential } = await import("./localDb");
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.vault.update({ id: 1, subscriptionStart: null });
    expect(result.success).toBe(true);
    expect(updateLocalCredential).toHaveBeenCalledWith(
      1, 42,
      expect.objectContaining({ subscriptionStart: null })
    );
  });
});

describe("vault.list returns subscription fields", () => {
  it("returns credentials with subscriptionStart and subscriptionDays", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.vault.list({});
    expect(result[0].subscriptionDays).toBe(30);
    expect(result[0].subscriptionStart).toBeInstanceOf(Date);
  });
});
