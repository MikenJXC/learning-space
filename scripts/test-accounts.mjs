import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// Credentials arrive over hidden stdin, never command arguments or a saved file.
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stderr.write("Ready for account QA JSON on stdin (input is hidden).\n");
const input = await new Promise((resolve) => {
  let value = "";
  process.stdin.setEncoding("utf8");
  const handler = (chunk) => {
    value += chunk;
    if (value.includes("\n") || value.includes("\r")) {
      process.stdin.off("data", handler);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(JSON.parse(value));
    }
  };
  process.stdin.on("data", handler);
});
const base = input.base;
const privateHeaders = input.serviceToken ? { "OAI-Sites-Authorization": `Bearer ${input.serviceToken}` } : {};
// Isolate QA rate-limit buckets locally. Cloudflare replaces this header in production.
if (base.startsWith("http://127.0.0.1")) privateHeaders["CF-Connecting-IP"] = `192.0.2.${randomBytes(1)[0] || 1}`;
const checks = [];
async function call(path, { method = "GET", body, cookie, origin = base } = {}) {
  const headers = { ...privateHeaders };
  if (cookie) headers.Cookie = cookie;
  if (method !== "GET") headers.Origin = origin;
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, { method, redirect: "manual", headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  return { status: response.status, data, text, headers: response.headers, cookie: response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ") };
}
function status(result, expected, label) {
  assert.equal(result.status, expected, `${label}: ${result.data?.error || result.text.slice(0, 120)}`);
  checks.push(label);
}
const anonymous = await call("/api/library"); status(anonymous, 401, "匿名不能读取课件库");
status(await call("/api/account"), 401, "匿名不能读取用户资料");
assert.equal((await call("/")).headers.get("location"), "/login"); checks.push("未登录首页跳转登录页");
status(await call("/login"), 200, "登录页正常加载");
const suffix = Date.now().toString(36) + randomBytes(3).toString("hex");
const password = randomBytes(18).toString("base64url").slice(0, input.passwordLength ?? 24);
const a = { username: `qa_a_${suffix}`, password };
const b = { username: `qa_b_${suffix}`, password: randomBytes(18).toString("base64url") };
status(await call("/api/auth/register", { method: "POST", body: a, origin: "https://untrusted.invalid" }), 403, "拒绝跨站注册");
status(await call("/api/auth/register", { method: "POST", body: { ...a, password: "short123" } }), 400, "拒绝 8 个字符的密码注册");
const registered = await call("/api/auth/register", { method: "POST", body: a }); status(registered, 201, "新用户注册成功");
assert.ok(registered.cookie); assert.match(registered.headers.get("set-cookie"), /HttpOnly/i); assert.match(registered.headers.get("set-cookie"), /SameSite=Lax/i);
if (base.startsWith("https://")) assert.match(registered.headers.get("set-cookie"), /Secure/i);
checks.push("登录 Cookie 安全属性正确");
let cookieA = registered.cookie;
const registeredB = await call("/api/auth/register", { method: "POST", body: b }); status(registeredB, 201, "第二个用户注册成功");
const cookieB = registeredB.cookie;
status(await call("/api/auth/register", { method: "POST", body: { ...a, username: a.username.toUpperCase() } }), 409, "拒绝大小写重复用户名");
const emptyA = await call("/api/library", { cookie: cookieA }); status(emptyA, 200, "注册后可以读取个人课件库"); assert.deepEqual(emptyA.data.courses, []);
assert.deepEqual((await call("/api/library", { cookie: cookieB })).data.courses, []); checks.push("新账号不能看到管理员旧课件");
const secondLogin = await call("/api/auth/login", { method: "POST", body: a }); status(secondLogin, 200, "注册账号密码可重新登录");
const staleCookie = secondLogin.cookie;

if (!input.light) {
  const created = await call("/api/courses", { method: "POST", cookie: cookieA, body: { name: "账号隔离测试" } }); status(created, 201, "用户可以建立自己的课程");
  const courseId = created.data.course.id;
  const form = new FormData(); form.set("courseId", courseId); form.set("chapterNumber", "12");
  const pdf = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";
  form.set("slides", new Blob([pdf], { type: "application/pdf" }), "qa-file.pdf");
  const uploaded = await call("/api/chapters", { method: "POST", cookie: cookieA, body: form }); status(uploaded, 201, "用户可上传第十二章课件");
  const asset = uploaded.data.saved[0].id;
  const owned = await call(`/api/files/${asset}?download=1`, { cookie: cookieA }); status(owned, 200, "本人可下载原文件"); assert.equal(owned.text, pdf);
  status(await call(`/api/files/${asset}`), 401, "匿名不能读取文件");
  status(await call(`/api/files/${asset}`, { cookie: cookieB }), 404, "其他用户不能读取文件");
  status(await call(`/api/files/${asset}?download=1`, { cookie: cookieB }), 404, "其他用户不能下载文件");
  const progress = { assetId: asset, page: 3, totalPages: 8, updatedAt: Date.now() };
  status(await call("/api/progress", { method: "POST", cookie: cookieB, body: progress }), 404, "其他用户不能修改阅读进度");
  status(await call("/api/progress", { method: "POST", cookie: cookieA, body: progress }), 200, "本人阅读进度正常保存");
  const saved = await call("/api/library", { cookie: cookieA }); assert.equal(saved.data.courses[0].chapters[0].assets[0].progress.page, 3); checks.push("阅读进度正常返回矩阵");
  status(await call(`/api/courses/${courseId}`, { method: "DELETE", cookie: cookieB }), 404, "其他用户不能删除课程");
  status(await call(`/api/courses/${courseId}`, { method: "DELETE", cookie: cookieA, origin: "https://untrusted.invalid" }), 403, "拒绝跨站删除课程");
  const foreignForm = new FormData(); foreignForm.set("courseId", courseId); foreignForm.set("chapterNumber", "1"); foreignForm.set("createEmptyChapter", "true");
  status(await call("/api/chapters", { method: "POST", cookie: cookieB, body: foreignForm }), 404, "其他用户不能上传到别人的课程");
}

const renamed = `qa_done_${suffix}`;
const newPassword = randomBytes(18).toString("base64url").slice(0, input.passwordLength ?? 24);
status(await call("/api/account", { method: "PATCH", cookie: cookieA, body: { password: "short123", currentPassword: password } }), 400, "拒绝改为 8 个字符的密码");
status(await call("/api/account", { method: "PATCH", cookie: cookieA, body: { username: renamed, currentPassword: "wrong-password" } }), 401, "修改资料必须验证当前密码");
status(await call("/api/account", { method: "PATCH", cookie: cookieA, body: { username: b.username, currentPassword: password } }), 409, "不能改为已被使用的用户名");
status(await call("/api/account", { method: "PATCH", cookie: cookieA, origin: "https://untrusted.invalid", body: { username: renamed, currentPassword: password } }), 403, "拒绝跨站修改账号");
const changed = await call("/api/account", { method: "PATCH", cookie: cookieA, body: { username: renamed, password: newPassword, currentPassword: password } }); status(changed, 200, "修改用户名和密码成功");
cookieA = changed.cookie;
status(await call("/api/account", { cookie: staleCookie }), 401, "修改后其他设备旧会话失效");
status(await call("/api/account", { cookie: registered.cookie }), 401, "原会话不可复用");
const currentAccount = await call("/api/account", { cookie: cookieA }); status(currentAccount, 200, "当前设备继续登录"); assert.equal(currentAccount.data.user.username, renamed);
status(await call("/api/auth/login", { method: "POST", body: a }), 401, "原用户名不能登录");
status(await call("/api/auth/login", { method: "POST", body: { username: renamed, password } }), 401, "旧密码不能登录");
const newLogin = await call("/api/auth/login", { method: "POST", body: { username: renamed, password: newPassword } }); status(newLogin, 200, "新用户名和新密码可登录");
status(await call("/api/auth/logout", { method: "POST", cookie: newLogin.cookie }), 200, "退出登录成功");
status(await call("/api/account", { cookie: newLogin.cookie }), 401, "退出后会话失效");
await call("/api/auth/logout", { method: "POST", cookie: cookieA });
await call("/api/auth/logout", { method: "POST", cookie: cookieB });

if (input.owner) {
  const ownerLogin = await call("/api/auth/login", { method: "POST", body: input.owner }); status(ownerLogin, 200, "管理员账号密码登录成功");
  assert.equal(ownerLogin.data.user.role, "owner");
  const ownerLibrary = await call("/api/library", { cookie: ownerLogin.cookie }); status(ownerLibrary, 200, "管理员原课件库可访问");
  if (input.expectedOwnerCourses) assert.deepEqual(ownerLibrary.data.courses.map(course => course.name).sort(), input.expectedOwnerCourses.slice().sort());
  if (ownerLibrary.data.courses.length) {
    const chapter = ownerLibrary.data.courses[0].chapters.find(chapter => chapter.assets.length);
    if (chapter) status(await call(`/api/files/${chapter.assets[0].id}`, { cookie: registeredB.cookie }), 401, "退出的新用户不能访问旧文件");
  }
  checks.push(`管理员原有 ${ownerLibrary.data.courses.length} 门课程归属保留`);
  await call("/api/auth/logout", { method: "POST", cookie: ownerLogin.cookie });
}
if (!input.light) {
  const subject = `qa_rate_${suffix}`;
  for (let i = 0; i < 10; i++) assert.equal((await call("/api/auth/login", { method: "POST", body: { username: subject, password } })).status, 401);
  status(await call("/api/auth/login", { method: "POST", body: { username: subject, password } }), 429, "登录暴力尝试限流生效");
}
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
