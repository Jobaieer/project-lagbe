let token = localStorage.t || "";
export const setToken = (t) => {
  token = t;
  t ? localStorage.setItem("t", t) : localStorage.removeItem("t");
};
export async function api(p, m = "GET", b) {
  const r = await fetch("/api/" + p, {
    method: m,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: "Bearer " + token }),
    },
    body: b ? JSON.stringify(b) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "কিছু একটা ভুল হয়েছে");
  return d;
}
