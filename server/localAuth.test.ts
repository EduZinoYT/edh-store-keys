import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock localDb module
vi.mock("./localDb", () => ({
  createLocalUser: vi.fn(),
  verifyLocalUser: vi.fn(),
  getLocalUserById: vi.fn(),
  getLocalCredentials: vi.fn(),
  getLocalCredentialById: vi.fn(),
  createLocalCredential: vi.fn(),
  updateLocalCredential: vi.fn(),
  deleteLocalCredential: vi.fn(),
  getCredentialGroups: vi.fn(),
  getCredentialGroupById: vi.fn(),
  createCredentialGroup: vi.fn(),
  updateCredentialGroup: vi.fn(),
  deleteCredentialGroup: vi.fn(),
}));

import {
  createLocalUser,
  verifyLocalUser,
  getLocalUserById,
} from "./localDb";

const mockLocalUser = {
  id: 1,
  name: "João Silva",
  username: "joaosilva",
  passwordHash: "$2b$12$hashedpassword",
  salt: "randomsalt",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createPublicContext(): TrpcContext {
  const cookies: Record<string, string> = {};
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { "x-forwarded-proto": "https", cookie: "" },
    } as unknown as TrpcContext["req"],
    res: {
      cookie: vi.fn((name: string, value: string) => { cookies[name] = value; }),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("localAuth.register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a user and sets session cookie", async () => {
    vi.mocked(createLocalUser).mockResolvedValue(mockLocalUser);
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.localAuth.register({
      name: "João Silva",
      username: "joaosilva",
      password: "SecurePass@123",
    });

    expect(createLocalUser).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "João Silva",
        username: "joaosilva",
        password: "SecurePass@123",
      })
    );
    expect(result.success).toBe(true);
    expect(result.user.username).toBe("joaosilva");
    expect(ctx.res.cookie).toHaveBeenCalledWith(
      "edh_session",
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("throws CONFLICT when username is already taken", async () => {
    vi.mocked(createLocalUser).mockRejectedValue(new Error("USERNAME_TAKEN"));
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.register({
        name: "João",
        username: "joaosilva",
        password: "SecurePass@123",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects password shorter than 8 characters", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.register({
        name: "João",
        username: "joaosilva",
        password: "short",
      })
    ).rejects.toThrow();
  });
});

describe("localAuth.login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success and sets cookie on valid credentials", async () => {
    vi.mocked(verifyLocalUser).mockResolvedValue(mockLocalUser);
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.localAuth.login({
      username: "joaosilva",
      password: "SecurePass@123",
    });

    expect(result.success).toBe(true);
    expect(result.user.name).toBe("João Silva");
    expect(ctx.res.cookie).toHaveBeenCalledWith(
      "edh_session",
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("throws UNAUTHORIZED on invalid credentials", async () => {
    vi.mocked(verifyLocalUser).mockResolvedValue(null);
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.localAuth.login({
        username: "joaosilva",
        password: "wrongpassword",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("localAuth.logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears the session cookie", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.localAuth.logout();

    expect(result.success).toBe(true);
    expect(ctx.res.clearCookie).toHaveBeenCalledWith(
      "edh_session",
      expect.objectContaining({ httpOnly: true })
    );
  });
});
