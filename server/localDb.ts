import { eq, and, like, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import {
  localUsers,
  localCredentials,
  credentialGroups,
  InsertLocalUser,
  InsertLocalCredential,
  InsertCredentialGroup,
} from "../drizzle/schema";

const SALT_ROUNDS = 12;

// ─── Local Users ──────────────────────────────────────────────────────────────

export async function getLocalUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(localUsers)
    .where(eq(localUsers.username, username.toLowerCase()))
    .limit(1);
  return result[0] ?? undefined;
}

export async function getLocalUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(localUsers)
    .where(eq(localUsers.id, id))
    .limit(1);
  return result[0] ?? undefined;
}

export async function createLocalUser(data: {
  name: string;
  username: string;
  password: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getLocalUserByUsername(data.username);
  if (existing) throw new Error("USERNAME_TAKEN");

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const passwordHash = await bcrypt.hash(data.password, salt);

  await db.insert(localUsers).values({
    name: data.name,
    username: data.username.toLowerCase(),
    passwordHash,
    salt,
  });

  return getLocalUserByUsername(data.username);
}

export async function verifyLocalUser(username: string, password: string) {
  const user = await getLocalUserByUsername(username);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return user;
}

// ─── Credential Groups ────────────────────────────────────────────────────────

export async function getCredentialGroups(localUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(credentialGroups)
    .where(eq(credentialGroups.localUserId, localUserId));
}

export async function createCredentialGroup(data: InsertCredentialGroup) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(credentialGroups).values(data);
  const result = await db
    .select()
    .from(credentialGroups)
    .where(
      and(
        eq(credentialGroups.localUserId, data.localUserId),
        eq(credentialGroups.name, data.name)
      )
    )
    .limit(1);
  return result[0] ?? null;
}

export async function updateCredentialGroup(
  id: number,
  localUserId: number,
  name: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(credentialGroups)
    .set({ name })
    .where(
      and(
        eq(credentialGroups.id, id),
        eq(credentialGroups.localUserId, localUserId)
      )
    );
}

export async function getCredentialGroupById(id: number, localUserId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(credentialGroups)
    .where(
      and(
        eq(credentialGroups.id, id),
        eq(credentialGroups.localUserId, localUserId)
      )
    )
    .limit(1);
  return result[0] ?? undefined;
}

export async function deleteCredentialGroup(id: number, localUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Unlink credentials from this group before deleting
  await db
    .update(localCredentials)
    .set({ groupId: null })
    .where(
      and(
        eq(localCredentials.groupId, id),
        eq(localCredentials.localUserId, localUserId)
      )
    );
  await db
    .delete(credentialGroups)
    .where(
      and(
        eq(credentialGroups.id, id),
        eq(credentialGroups.localUserId, localUserId)
      )
    );
}

// ─── Local Credentials ────────────────────────────────────────────────────────

export async function getLocalCredentials(
  localUserId: number,
  search?: string,
  groupId?: number | null
) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(localCredentials)
    .where(eq(localCredentials.localUserId, localUserId));

  let filtered = rows;

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.serviceName.toLowerCase().includes(q) ||
        r.username.toLowerCase().includes(q)
    );
  }

  if (groupId !== undefined) {
    if (groupId === null) {
      filtered = filtered.filter((r) => r.groupId === null);
    } else {
      filtered = filtered.filter((r) => r.groupId === groupId);
    }
  }

  return filtered;
}

export async function getLocalCredentialById(id: number, localUserId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(localCredentials)
    .where(
      and(
        eq(localCredentials.id, id),
        eq(localCredentials.localUserId, localUserId)
      )
    )
    .limit(1);
  return result[0] ?? undefined;
}

export async function createLocalCredential(data: InsertLocalCredential) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(localCredentials).values(data);
}

export async function updateLocalCredential(
  id: number,
  localUserId: number,
  data: Partial<Omit<InsertLocalCredential, "id" | "localUserId" | "createdAt">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(localCredentials)
    .set(data)
    .where(
      and(
        eq(localCredentials.id, id),
        eq(localCredentials.localUserId, localUserId)
      )
    );
}

export async function deleteLocalCredential(id: number, localUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(localCredentials)
    .where(
      and(
        eq(localCredentials.id, id),
        eq(localCredentials.localUserId, localUserId)
      )
    );
}
