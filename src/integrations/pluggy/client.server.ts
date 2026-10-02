type PluggyAccount = {
  id: string;
  name?: string | null;
  marketingName?: string | null;
  type: string;
  subtype?: string | null;
  currencyCode?: string | null;
};

type PluggyAccountList = { results?: PluggyAccount[] };
type PluggyAuthResponse = { apiKey?: string };

const API_BASE = "https://api.pluggy.ai";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("Configure a variável " + name + " no ambiente do servidor.");
  return value;
}

async function createApiKey(): Promise<string> {
  const clientId = requiredEnv("PLUGGY_CLIENT_ID");
  const clientSecret = requiredEnv("PLUGGY_CLIENT_SECRET");
  const response = await fetch(API_BASE + "/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Não foi possível autenticar na Pluggy.");

  const payload = (await response.json()) as PluggyAuthResponse;
  if (!payload.apiKey) throw new Error("A Pluggy não retornou uma chave de API.");
  return payload.apiKey;
}

export async function listMeuPluggyAccounts() {
  const itemId = requiredEnv("PLUGGY_ITEM_ID");
  const apiKey = await createApiKey();
  const url = new URL(API_BASE + "/accounts");
  url.searchParams.set("itemId", itemId);

  const response = await fetch(url, {
    headers: { "X-API-KEY": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Não foi possível consultar a conexão do Meu Pluggy.");

  const payload = (await response.json()) as PluggyAccountList;
  return (payload.results ?? []).map((account) => ({
    name: account.marketingName || account.name || "Conta sem nome",
    type: account.type,
    subtype: account.subtype ?? null,
    currencyCode: account.currencyCode ?? null,
  }));
}
