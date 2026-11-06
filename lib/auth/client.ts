"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

/**
 * Cliente de Better Auth para componentes de cliente. Sin `baseURL`: las
 * llamadas son al mismo origen (`/api/auth/*`, montado por
 * app/api/auth/[...all]/route.ts), no hace falta apuntar a otro host.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
