import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// OWASP's scrypt alternative: 32 MiB, N=2^15, r=8, p=3.
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, Buffer.from(salt, "hex"), 32, options, (error, key) => error ? reject(error) : resolve(key));
  });
}
export function usernameInfo(value: unknown) {
  if (typeof value !== "string") throw new Error("请输入用户名");
  const username = value.trim().normalize("NFC");
  if (!/^[\p{L}\p{N}_-]{3,32}$/u.test(username)) throw new Error("用户名为 3–32 个字母、汉字、数字、下划线或短横线");
  return { username, usernameKey: username.toLowerCase() };
}
export function validatePassword(value: unknown): asserts value is string {
  if (typeof value !== "string" || [...value].length < 9 || [...value].length > 128) throw new Error("密码需要 9–128 个字符，建议使用长口令；不要使用其他网站的密码");
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$32768$8$3$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
const dummyHash = `scrypt$32768$8$3$${"00".repeat(16)}$${"00".repeat(32)}`;
export async function verifyPassword(password: string, encoded = dummyHash) {
  const [algorithm, n, r, p, salt, hash] = encoded.split("$");
  if (algorithm !== "scrypt" || n !== "32768" || r !== "8" || p !== "3" || !/^[a-f0-9]{32}$/.test(salt || "") || !/^[a-f0-9]{64}$/.test(hash || "")) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
