import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { accountView, authBody, checkOrigin, ensureOwnerAccount, json, rateLimit, startSession } from "@/lib/auth";
import { usernameInfo, verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  try { return await login(request); }
  catch { return json({ error: "登录服务暂时不可用，请稍后重试" }, 503); }
}
async function login(request: Request) {
  const originError = checkOrigin(request);
  if (originError) return originError;
  const networkLimit = await rateLimit(request, "login-network", "network", 40, 15 * 60 * 1000);
  if (networkLimit) return networkLimit;
  let body: Record<string, unknown>;
  let key: string;
  try {
    body = await authBody(request); key = usernameInfo(body.username).usernameKey;
    if (typeof body.password !== "string" || body.password.length > 512) throw new Error();
  } catch { return json({ error: "用户名或密码不正确" }, 400); }
  const accountLimit = await rateLimit(request, "login-account", key, 10, 15 * 60 * 1000);
  if (accountLimit) return accountLimit;
  await ensureOwnerAccount();
  const account = (await getDb().select().from(accounts).where(eq(accounts.usernameKey, key)).limit(1))[0];
  const valid = await verifyPassword(body.password as string, account?.passwordHash);
  if (!account || !valid) return json({ error: "用户名或密码不正确" }, 401);
  await startSession(account);
  return json({ user: accountView(account) });
}
