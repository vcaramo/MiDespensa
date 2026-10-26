import assert from "node:assert/strict";

const base = process.env.DESPENSA_TEST_URL ?? "http://127.0.0.1:4180";
const identifier = process.env.DESPENSA_TEST_USER ?? "admin";
const password = process.env.DESPENSA_TEST_PASSWORD ?? "despensa-prueba-local-2026";

const denied = await fetch(`${base}/api/state`);
assert.equal(denied.status, 401);

const wrong = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identificador: identifier, password: "contraseña-incorrecta" }),
});
assert.equal(wrong.status, 401);

const login = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identificador: identifier, password }),
});
assert.equal(login.status, 200, `Login: ${await login.clone().text()}`);
const cookie = login.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie?.startsWith("despensa_session="), "Falta la cookie de sesión");

const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
assert.equal(me.status, 200, `Sesión: ${await me.clone().text()}`);
const account = await me.json();
assert.equal(account.identificador, identifier);
assert.equal(account.password, undefined);

const state = await fetch(`${base}/api/state`, { headers: { Cookie: cookie } });
assert.equal(state.status, 200, `Inventario: ${await state.clone().text()}`);
assert.ok(Array.isArray((await state.json()).productos));

const logout = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { Cookie: cookie } });
assert.equal(logout.status, 204);
const afterLogout = await fetch(`${base}/api/state`, { headers: { Cookie: cookie } });
assert.equal(afterLogout.status, 401);
console.log("Credenciales, sesión, inventario y cierre de sesión: correctos.");
