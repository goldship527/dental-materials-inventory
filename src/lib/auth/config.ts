import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";
import {
  getClientIpFromHeaders,
  isLoginLocked,
  normalizeLoginEmail,
  recordLoginFailure,
  resetLoginFailures,
} from "@/lib/auth/login-attempts";
import { normalizeUserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

async function getRequestIpAddress() {
  try {
    return getClientIpFromHeaders(await headers());
  } catch {
    return "unknown";
  }
}

export async function authorizeCredentials(
  rawCredentials: unknown,
  options?: {
    ipAddress?: string;
  },
) {
  const parsed = credentialsSchema.safeParse(rawCredentials);

  if (!parsed.success) {
    return null;
  }

  const email = normalizeLoginEmail(parsed.data.email);
  const ipAddress = options?.ipAddress ?? "unknown";

  if (
    await isLoginLocked({
      email,
      ipAddress,
    })
  ) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      role: true,
      isActive: true,
      organizationId: true,
    },
  });

  if (!user || !user.isActive) {
    await recordLoginFailure({
      email,
      ipAddress,
    });
    return null;
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);

  if (!passwordMatches) {
    await recordLoginFailure({
      email,
      ipAddress,
    });
    return null;
  }

  await resetLoginFailures({
    email,
    ipAddress,
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: normalizeUserRole(user.role),
    organizationId: user.organizationId,
  };
}

export const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(rawCredentials) {
        return authorizeCredentials(rawCredentials, {
          ipAddress: await getRequestIpAddress(),
        });
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
        session.user.organizationId = token.organizationId;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
