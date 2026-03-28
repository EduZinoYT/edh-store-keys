import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createCredential,
  deleteCredential,
  getCredentialById,
  getCredentialsByUserId,
  updateCredential,
} from "./db";
import {
  createLocalUser,
  verifyLocalUser,
  getLocalUserById,
  getLocalCredentials,
  getLocalCredentialById,
  createLocalCredential,
  updateLocalCredential,
  deleteLocalCredential,
  getCredentialGroups,
  getCredentialGroupById,
  createCredentialGroup,
  updateCredentialGroup,
  deleteCredentialGroup,
} from "./localDb";

const LOCAL_SESSION_COOKIE = "edh_session";
const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "edh-store-keys-secret-fallback"
);

// ─── Local Auth Helpers ───────────────────────────────────────────────────────

async function signLocalToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId), type: "local" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET_KEY);
}

function getLocalSessionToken(req: any): string | undefined {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return undefined;
  const parsed = parseCookieHeader(cookieHeader);
  return parsed[LOCAL_SESSION_COOKIE];
}

async function verifyLocalToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    if (payload.type !== "local" || !payload.sub) return null;
    return parseInt(payload.sub, 10);
  } catch {
    return null;
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  // Legacy Manus OAuth (kept for compatibility)
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Local Auth ─────────────────────────────────────────────────────────────
  localAuth: router({
    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2).max(100),
          username: z.string().min(2).max(100).regex(/^[a-zA-Z0-9_]+$/, "Use apenas letras, números e _"),
          password: z.string().min(8).max(128),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const user = await createLocalUser(input);
          if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

          const token = await signLocalToken(user.id);
          const isSecure = ctx.req.protocol === "https" ||
            ctx.req.headers["x-forwarded-proto"] === "https";

          ctx.res.cookie(LOCAL_SESSION_COOKIE, token, {
            httpOnly: true,
            secure: isSecure,
            sameSite: isSecure ? "none" : "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });

          return { success: true, user: { id: user.id, name: user.name, username: user.username } };
        } catch (err: any) {
          if (err?.message === "USERNAME_TAKEN") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Este nome de usuário já está em uso.",
            });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err?.message ?? "Erro ao criar conta" });
        }
      }),

    login: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await verifyLocalUser(input.username, input.password);
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuário ou senha incorretos.",
          });
        }

        const token = await signLocalToken(user.id);
        const isSecure = ctx.req.protocol === "https" ||
          ctx.req.headers["x-forwarded-proto"] === "https";

        ctx.res.cookie(LOCAL_SESSION_COOKIE, token, {
          httpOnly: true,
          secure: isSecure,
          sameSite: isSecure ? "none" : "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return { success: true, user: { id: user.id, name: user.name, username: user.username } };
      }),

    me: publicProcedure.query(async ({ ctx }) => {
      const token = getLocalSessionToken(ctx.req);
      if (!token) return null;

      const userId = await verifyLocalToken(token);
      if (!userId) return null;

      const user = await getLocalUserById(userId);
      if (!user) return null;

      return { id: user.id, name: user.name, username: user.username };
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const isSecure = ctx.req.protocol === "https" ||
        ctx.req.headers["x-forwarded-proto"] === "https";
      ctx.res.clearCookie(LOCAL_SESSION_COOKIE, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        path: "/",
        maxAge: -1,
      });
      return { success: true };
    }),
  }),

  // ─── Credential Groups ───────────────────────────────────────────────────────
  groups: router({
    list: publicProcedure.query(async ({ ctx }) => {
      const token = getLocalSessionToken(ctx.req);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
      const userId = await verifyLocalToken(token);
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return getCredentialGroups(userId);
    }),

    create: publicProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        const token = getLocalSessionToken(ctx.req);
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
        const userId = await verifyLocalToken(token);
        if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

        const group = await createCredentialGroup({ localUserId: userId, name: input.name });
        return { success: true, group };
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        const token = getLocalSessionToken(ctx.req);
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
        const userId = await verifyLocalToken(token);
        if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

        const existing = await getCredentialGroupById(input.id, userId);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        await updateCredentialGroup(input.id, userId, input.name);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const token = getLocalSessionToken(ctx.req);
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
        const userId = await verifyLocalToken(token);
        if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

        const existing = await getCredentialGroupById(input.id, userId);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        await deleteCredentialGroup(input.id, userId);
        return { success: true };
      }),
  }),

  // ─── Local Credentials (AES-encrypted, stored ciphertext + IV) ──────────────
  vault: router({
    list: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        groupId: z.number().nullable().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const token = getLocalSessionToken(ctx.req);
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
        const userId = await verifyLocalToken(token);
        if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
        return getLocalCredentials(userId, input.search, input.groupId ?? undefined);
      }),

    create: publicProcedure
      .input(
        z.object({
          serviceName: z.string().min(1).max(255),
          username: z.string().min(1).max(320),
          encryptedPassword: z.string().min(1),
          iv: z.string().min(1),
          notes: z.string().optional(),
          groupId: z.number().nullable().optional(),
          subscriptionStart: z.string().nullable().optional(),
          subscriptionDays: z.number().int().min(1).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const token = getLocalSessionToken(ctx.req);
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
        const userId = await verifyLocalToken(token);
        if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

        await createLocalCredential({
          localUserId: userId,
          serviceName: input.serviceName,
          username: input.username,
          encryptedPassword: input.encryptedPassword,
          iv: input.iv,
          notes: input.notes ?? null,
          groupId: input.groupId ?? null,
          subscriptionStart: input.subscriptionStart ? new Date(input.subscriptionStart) : null,
          subscriptionDays: input.subscriptionDays ?? null,
        });
        return { success: true };
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          serviceName: z.string().min(1).max(255).optional(),
          username: z.string().min(1).max(320).optional(),
          encryptedPassword: z.string().min(1).optional(),
          iv: z.string().optional(),
          notes: z.string().optional(),
          groupId: z.number().nullable().optional(),
          subscriptionStart: z.string().nullable().optional(),
          subscriptionDays: z.number().int().min(1).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const token = getLocalSessionToken(ctx.req);
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
        const userId = await verifyLocalToken(token);
        if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

        const existing = await getLocalCredentialById(input.id, userId);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const { id, subscriptionStart, ...rest } = input;
        const updateData = {
          ...rest,
          ...(subscriptionStart !== undefined
            ? { subscriptionStart: subscriptionStart ? new Date(subscriptionStart) : null }
            : {}),
        };
        await updateLocalCredential(id, userId, updateData);
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const token = getLocalSessionToken(ctx.req);
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });
        const userId = await verifyLocalToken(token);
        if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

        const existing = await getLocalCredentialById(input.id, userId);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        await deleteLocalCredential(input.id, userId);
        return { success: true };
      }),
  }),

  // Legacy credentials (Manus OAuth users)
  credentials: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        return getCredentialsByUserId(ctx.user.id, input.search);
      }),
    create: protectedProcedure
      .input(
        z.object({
          serviceName: z.string().min(1).max(255),
          username: z.string().min(1).max(320),
          encryptedPassword: z.string().min(1),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createCredential({
          userId: ctx.user.id,
          serviceName: input.serviceName,
          username: input.username,
          encryptedPassword: input.encryptedPassword,
          notes: input.notes ?? null,
        });
        return { success: true };
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          serviceName: z.string().min(1).max(255).optional(),
          username: z.string().min(1).max(320).optional(),
          encryptedPassword: z.string().min(1).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getCredentialById(input.id, ctx.user.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        const { id, ...updateData } = input;
        await updateCredential(id, ctx.user.id, updateData);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getCredentialById(input.id, ctx.user.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
        await deleteCredential(input.id, ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
