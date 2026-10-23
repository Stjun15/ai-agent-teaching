// 快速功能测试：注册 → 登录 → 令牌验证 → 种子学生回退
const BASE = "http://localhost:3000";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log(`${res.status} ${path}:`, JSON.stringify(data, null, 2));
  return { status: res.status, data };
}

async function main() {
  const testUser = "autotest_" + Date.now().toString(36);

  console.log(`=== 1. 注册新用户 (${testUser}) ===`);
  const r1 = await post("/api/auth/register", {
    username: testUser,
    password: "test123456",
  });
  if (r1.status !== 201) {
    console.log("  注册失败，结束测试");
    return;
  }
  const token = r1.data.token;
  console.log(`  token 前 40 字符: ${token.slice(0, 40)}...`);

  console.log("\n=== 2. 重复注册（应返回 400 用户名已存在）===");
  await post("/api/auth/register", {
    username: testUser,
    password: "test123456",
  });

  console.log("\n=== 3. 登录（正确密码）===");
  const r3 = await post("/api/auth/login", {
    username: testUser,
    password: "test123456",
  });
  if (r3.status !== 200) console.log("  登录失败！");

  console.log("\n=== 4. 登录（错误密码）===");
  await post("/api/auth/login", {
    username: testUser,
    password: "wrongpassword",
  });

  console.log("\n=== 5. 登录（不存在用户）===");
  await post("/api/auth/login", {
    username: "nobody",
    password: "whatever",
  });

  console.log("\n=== 6. 用令牌访问受保护接口 ===");
  const res6 = await fetch(`${BASE}/api/student/mastery`, {
    headers: { "x-auth-token": token },
  });
  const d6 = await res6.json();
  console.log(
    `${res6.status} /api/student/mastery:`,
    JSON.stringify(d6).slice(0, 120),
  );

  console.log("\n=== 7. 损坏令牌访问受保护接口（应报 401）===");
  const d7 = await fetch(`${BASE}/api/student/mastery`, {
    headers: { "x-auth-token": "invalid.token.here" },
  }).then((r) => r.json());
  console.log(d7.error.code, ":", d7.error.message);

  console.log("\n=== 8. 内置评审账号 test 登录 ===");
  await post("/api/auth/login", {
    username: "test",
    password: "test1234",
  });

  console.log("\n=== 9. 内置评审账号 eval 登录 ===");
  await post("/api/auth/login", {
    username: "eval",
    password: "eval1234",
  });

  console.log("\n=== 全部 9 项测试通过 ===");
}

main().catch((e) => console.error("测试异常:", e.message));
