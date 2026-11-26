const TOKEN_KEY = "papelaria_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function api(path, { method = "GET", body } = {}) {
  const isForm = body instanceof FormData;
  const headers = isForm ? {} : { "Content-Type": "application/json" };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    let msg = data?.detail ?? "Erro inesperado";
    if (Array.isArray(msg)) msg = msg.map((e) => e.msg.replace(/^Value error, /, "")).join("; ");
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}
