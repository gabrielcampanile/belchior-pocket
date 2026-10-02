import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { listMeuPluggyAccounts } from "@/integrations/pluggy/client.server";

export const checkMeuPluggyConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const allowedUserId = process.env.PLUGGY_ALLOWED_USER_ID?.trim();
    if (!allowedUserId) {
      throw new Error("Configure PLUGGY_ALLOWED_USER_ID no ambiente do servidor.");
    }
    if (context.userId !== allowedUserId) {
      throw new Error("Esta conexão pessoal não está habilitada para este usuário.");
    }

    return { accounts: await listMeuPluggyAccounts() };
  });
