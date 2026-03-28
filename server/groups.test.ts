import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock localDb helpers
vi.mock("./localDb", () => ({
  getCredentialGroups: vi.fn().mockResolvedValue([
    { id: 1, localUserId: 42, name: "Contas Google", createdAt: new Date(), updatedAt: new Date() },
    { id: 2, localUserId: 42, name: "Contas Facebook", createdAt: new Date(), updatedAt: new Date() },
  ]),
  getCredentialGroupById: vi.fn().mockImplementation((id: number) =>
    id === 1
      ? Promise.resolve({ id: 1, localUserId: 42, name: "Contas Google", createdAt: new Date(), updatedAt: new Date() })
      : Promise.resolve(undefined)
  ),
  createCredentialGroup: vi.fn().mockResolvedValue({
    id: 3, localUserId: 42, name: "Novo Grupo", createdAt: new Date(), updatedAt: new Date(),
  }),
  updateCredentialGroup: vi.fn().mockResolvedValue(undefined),
  deleteCredentialGroup: vi.fn().mockResolvedValue(undefined),
  // other exports used by localAuth
  getLocalUserByEmail: vi.fn(),
  getLocalUserById: vi.fn(),
  createLocalUser: vi.fn(),
  verifyLocalUser: vi.fn(),
  getLocalCredentials: vi.fn().mockResolvedValue([]),
  getLocalCredentialById: vi.fn(),
  createLocalCredential: vi.fn(),
  updateLocalCredential: vi.fn(),
  deleteLocalCredential: vi.fn(),
}));

// Mock jose JWT verification to return userId 42
vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jose")>();
  return {
    ...actual,
    jwtVerify: vi.fn().mockResolvedValue({
      payload: { sub: "42", type: "local" },
    }),
    SignJWT: actual.SignJWT,
  };
});

function makeCtx(cookieValue?: string): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: cookieValue ? { cookie: `edh_session=${cookieValue}` } : {},
    } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("groups.list", () => {
  it("returns the list of groups for the authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx("valid-token"));
    const result = await caller.groups.list();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Contas Google");
    expect(result[1].name).toBe("Contas Facebook");
  });

  it("throws UNAUTHORIZED when no session cookie is present", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.groups.list()).rejects.toThrow("UNAUTHORIZED");
  });
});

describe("groups.create", () => {
  it("creates a new group and returns success", async () => {
    const caller = appRouter.createCaller(makeCtx("valid-token"));
    const result = await caller.groups.create({ name: "Novo Grupo" });
    expect(result.success).toBe(true);
    expect(result.group?.name).toBe("Novo Grupo");
  });

  it("throws UNAUTHORIZED when no session cookie is present", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.groups.create({ name: "Teste" })).rejects.toThrow("UNAUTHORIZED");
  });
});

describe("groups.update", () => {
  it("renames an existing group", async () => {
    const caller = appRouter.createCaller(makeCtx("valid-token"));
    const result = await caller.groups.update({ id: 1, name: "Google Accounts" });
    expect(result.success).toBe(true);
  });

  it("throws NOT_FOUND for a non-existent group", async () => {
    const caller = appRouter.createCaller(makeCtx("valid-token"));
    await expect(caller.groups.update({ id: 999, name: "Ghost" })).rejects.toThrow("NOT_FOUND");
  });
});

describe("groups.delete", () => {
  it("deletes an existing group", async () => {
    const caller = appRouter.createCaller(makeCtx("valid-token"));
    const result = await caller.groups.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("throws NOT_FOUND for a non-existent group", async () => {
    const caller = appRouter.createCaller(makeCtx("valid-token"));
    await expect(caller.groups.delete({ id: 999 })).rejects.toThrow("NOT_FOUND");
  });
});
