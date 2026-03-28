import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  getCredentialsByUserId: vi.fn(),
  getCredentialById: vi.fn(),
  createCredential: vi.fn(),
  updateCredential: vi.fn(),
  deleteCredential: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getDb: vi.fn(),
}));

import {
  getCredentialsByUserId,
  getCredentialById,
  createCredential,
  updateCredential,
  deleteCredential,
} from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user-openid",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const mockCredential = {
  id: 1,
  userId: 1,
  serviceName: "GitHub",
  username: "user@example.com",
  encryptedPassword: "SuperSecret123!",
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("credentials.list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns credentials for the authenticated user", async () => {
    vi.mocked(getCredentialsByUserId).mockResolvedValue([mockCredential]);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.credentials.list({});

    expect(getCredentialsByUserId).toHaveBeenCalledWith(1, undefined);
    expect(result).toHaveLength(1);
    expect(result[0].serviceName).toBe("GitHub");
  });

  it("passes search term to the db helper", async () => {
    vi.mocked(getCredentialsByUserId).mockResolvedValue([]);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await caller.credentials.list({ search: "git" });

    expect(getCredentialsByUserId).toHaveBeenCalledWith(1, "git");
  });
});

describe("credentials.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a credential and returns success", async () => {
    vi.mocked(createCredential).mockResolvedValue({} as any);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.credentials.create({
      serviceName: "Netflix",
      username: "user@example.com",
      encryptedPassword: "MyPass@123",
    });

    expect(createCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        serviceName: "Netflix",
        username: "user@example.com",
        encryptedPassword: "MyPass@123",
      })
    );
    expect(result).toEqual({ success: true });
  });

  it("rejects empty serviceName", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.credentials.create({
        serviceName: "",
        username: "user@example.com",
        encryptedPassword: "pass",
      })
    ).rejects.toThrow();
  });
});

describe("credentials.delete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a credential owned by the user", async () => {
    vi.mocked(getCredentialById).mockResolvedValue(mockCredential);
    vi.mocked(deleteCredential).mockResolvedValue({} as any);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.credentials.delete({ id: 1 });

    expect(deleteCredential).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual({ success: true });
  });

  it("throws if credential does not belong to user", async () => {
    vi.mocked(getCredentialById).mockResolvedValue(undefined);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.credentials.delete({ id: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("credentials.update", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a credential owned by the user", async () => {
    vi.mocked(getCredentialById).mockResolvedValue(mockCredential);
    vi.mocked(updateCredential).mockResolvedValue({} as any);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.credentials.update({
      id: 1,
      serviceName: "GitHub Updated",
    });

    expect(updateCredential).toHaveBeenCalledWith(
      1,
      1,
      expect.objectContaining({ serviceName: "GitHub Updated" })
    );
    expect(result).toEqual({ success: true });
  });

  it("throws if credential not found", async () => {
    vi.mocked(getCredentialById).mockResolvedValue(undefined);
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.credentials.update({ id: 999, serviceName: "X" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
