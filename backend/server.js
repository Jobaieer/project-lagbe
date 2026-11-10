const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const express = require("express"),
  compression = require("compression"),
  rate = require("express-rate-limit"),
  bcrypt = require("bcryptjs"),
  jwt = require("jsonwebtoken"),
  { createClient } = require("@supabase/supabase-js");

const E = process.env;
const S = E.JWT_SECRET || "dev-secret";
const db =
  E.SUPABASE_URL && E.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(compression(), express.json({ limit: "50kb" }));

const bad = (r, m, c = 400) => r.status(c).json({ error: m });
const validPreviewUrl = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const blockedHosts = [
      "github.com",
      "raw.githubusercontent.com",
      "gitlab.com",
      "bitbucket.org",
    ];
    const blockedPath = /\.(zip|rar|tar|gz|js|jsx|ts|tsx|py|sql)$/i.test(
      url.pathname,
    );
    return (
      (url.protocol === "https:" ||
        (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(host))) &&
      !blockedHosts.some((blocked) => host === blocked || host.endsWith("." + blocked)) &&
      !blockedPath
    );
  } catch {
    return false;
  }
};
const tok = (u) => ({
  token: jwt.sign({ id: u.id, role: u.role, name: u.name }, S, {
    expiresIn: "7d",
  }),
  role: u.role,
  name: u.name,
});
const auth = (role) => (req, r, n) => {
  try {
    req.u = jwt.verify((req.headers.authorization || "").slice(7), S);
    if (role && req.u.role !== role) throw new Error("Forbidden");
    n();
  } catch {
    bad(r, "আগে Login করুন", 401);
  }
};
const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const lim = rate({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const unwrap = (result) => {
  if (result.error) throw result.error;
  return result.data;
};
const orderView = (o, users, projects) => ({
  ...o,
  uname: users.get(o.user_id)?.name,
  email: users.get(o.user_id)?.email,
  title: projects.get(o.project_id)?.title,
});
const notification = (user_id, title, body) => ({ user_id, title, body });

async function ensureAdmin() {
  if (!db) throw new Error("Supabase environment variables are missing");
  const email = (E.ADMIN_EMAIL || "admin@site.com").toLowerCase();
  const pass = E.ADMIN_PASS || "admin123";
  const existing = unwrap(
    await db.from("users").select("id").eq("email", email).maybeSingle(),
  );
  if (!existing) {
    unwrap(
      await db.from("users").insert({
        name: "Admin",
        email,
        pass: bcrypt.hashSync(pass, 10),
        role: "admin",
      }),
    );
  }
}

app.get("/health", (_, r) => r.send("ok"));
app.get(
  "/api/health/db",
  asyncRoute(async (_, r) => {
    if (!db)
      return r
        .status(503)
        .json({ ok: false, database: "not_configured" });
    const result = await db.from("users").select("id").limit(1);
    if (result.error) {
      console.error("Supabase health check failed:", result.error);
      return r.status(503).json({ ok: false, database: "unavailable" });
    }
    r.json({ ok: true, database: "supabase" });
  }),
);
app.get("/api/config", (_, r) =>
  r.json({ pay: E.PAY_INFO || "bKash/Nagad: 01XXXXXXXXX (Send Money)" }),
);
app.post(
  "/api/register",
  lim,
  asyncRoute(async (req, r) => {
    const { name, email, password } = req.body;
    if (
      !name ||
      !/^\S+@\S+\.\S+$/.test(email || "") ||
      (password || "").length < 6
    )
      return bad(r, "নাম, সঠিক ইমেইল ও ৬+ অক্ষরের পাসওয়ার্ড দিন");
    const result = await db
      .from("users")
      .insert({
        name: name.trim(),
        email: email.toLowerCase(),
        pass: bcrypt.hashSync(password, 10),
      })
      .select("id,name,role")
      .single();
    if (result.error?.code === "23505") return bad(r, "এই ইমেইল আগেই আছে");
    const u = unwrap(result);
    r.json(tok(u));
  }),
);
app.post(
  "/api/login",
  lim,
  asyncRoute(async (req, r) => {
    const result = await db
      .from("users")
      .select("id,name,role,pass")
      .eq("email", (req.body.email || "").toLowerCase())
      .maybeSingle();
    const u = unwrap(result);
    u && bcrypt.compareSync(req.body.password || "", u.pass)
      ? r.json(tok(u))
      : bad(r, "ইমেইল/পাসওয়ার্ড ভুল");
  }),
);
app.put(
  "/api/password",
  auth(),
  asyncRoute(async (req, r) => {
    const { current_password, new_password, confirm_password } = req.body;
    if (
      typeof current_password !== "string" ||
      typeof new_password !== "string" ||
      new_password.length < 6 ||
      new_password !== confirm_password
    )
      return bad(r, "নতুন পাসওয়ার্ড ৬+ অক্ষরের হতে হবে এবং দুবার একই দিতে হবে");
    const user = unwrap(
      await db.from("users").select("pass").eq("id", req.u.id).single(),
    );
    if (!bcrypt.compareSync(current_password, user.pass))
      return bad(r, "বর্তমান পাসওয়ার্ড সঠিক নয়", 401);
    unwrap(
      await db
        .from("users")
        .update({ pass: bcrypt.hashSync(new_password, 10) })
        .eq("id", req.u.id),
    );
    r.json({ ok: 1 });
  }),
);
app.get(
  "/api/notifications",
  auth(),
  asyncRoute(async (req, r) => {
    const rows = unwrap(
      await db
        .from("notifications")
        .select("id,title,body,read,created")
        .eq("user_id", req.u.id)
        .order("id", { ascending: false })
        .limit(30),
    );
    r.json(rows);
  }),
);
app.put(
  "/api/notifications/read-all",
  auth(),
  asyncRoute(async (req, r) => {
    unwrap(
      await db
        .from("notifications")
        .update({ read: true })
        .eq("user_id", req.u.id)
        .eq("read", false),
    );
    r.json({ ok: 1 });
  }),
);
app.get(
  "/api/projects",
  asyncRoute(async (_, r) => {
    r.set("Cache-Control", "public,max-age=30");
    r.json(
      unwrap(
        await db
          .from("projects")
          .select("id,title,category,cover_url,preview_url,course,tech,description,price_code,price_consult")
          .eq("active", true)
          .order("id", { ascending: false }),
      ),
    );
  }),
);
app.post(
  "/api/orders",
  auth(),
  asyncRoute(async (req, r) => {
    const { project_id, option, method, trx_id, note } = req.body;
    if (
      !project_id ||
      !["code", "consult"].includes(option) ||
      !(trx_id || "").trim()
    )
      return bad(r, "Transaction ID দিন");
    unwrap(
      await db.from("orders").insert({
        user_id: req.u.id,
        project_id,
        option,
        method,
        trx_id: trx_id.trim(),
        note: note || "",
      }),
    );
    const admins = unwrap(await db.from("users").select("id").eq("role", "admin"));
    if (admins.length)
      unwrap(
        await db.from("notifications").insert(
          admins.map((admin) =>
            notification(admin.id, "New order", `A new ${option} order was submitted.`),
          ),
        ),
      );
    r.json({ ok: 1 });
  }),
);
app.get(
  "/api/my-orders",
  auth(),
  asyncRoute(async (req, r) => {
    const orders = unwrap(
      await db
        .from("orders")
        .select("id,project_id,option,status,meet_link,created")
        .eq("user_id", req.u.id)
        .order("id", { ascending: false }),
    );
    const projects = unwrap(
      await db.from("projects").select("id,title,download_url"),
    );
    const byId = new Map(projects.map((p) => [p.id, p]));
    r.json(
      orders.map((o) => ({
        ...o,
        title: byId.get(o.project_id)?.title,
        download_url:
          o.status === "approved" ? byId.get(o.project_id)?.download_url : null,
      })),
    );
  }),
);
const A = auth("admin");
app.get(
  "/api/admin/orders",
  A,
  asyncRoute(async (_, r) => {
    const orders = unwrap(
      await db.from("orders").select("*").order("id", { ascending: false }),
    );
    const [users, projects] = await Promise.all([
      db.from("users").select("id,name,email"),
      db.from("projects").select("id,title"),
    ]);
    const userMap = new Map(unwrap(users).map((u) => [u.id, u]));
    const projectMap = new Map(unwrap(projects).map((p) => [p.id, p]));
    r.json(orders.map((o) => orderView(o, userMap, projectMap)));
  }),
);
app.put(
  "/api/admin/orders/:id",
  A,
  asyncRoute(async (req, r) => {
    if (!["pending", "approved", "rejected"].includes(req.body.status))
      return bad(r, "Invalid");
    const current = unwrap(
      await db.from("orders").select("user_id,status").eq("id", req.params.id).single(),
    );
    unwrap(
      await db
        .from("orders")
        .update({
          status: req.body.status,
          meet_link: req.body.meet_link || "",
        })
        .eq("id", req.params.id),
    );
    if (current.status !== req.body.status) {
      unwrap(
        await db.from("notifications").insert(
          notification(
            current.user_id,
            "Order status updated",
            `Your order is now ${req.body.status}.`,
          ),
        ),
      );
    }
    r.json({ ok: 1 });
  }),
);
app.post(
  "/api/admin/notifications",
  A,
  asyncRoute(async (req, r) => {
    const title = (req.body.title || "").trim();
    const body = (req.body.body || "").trim();
    if (!title || !body) return bad(r, "Title ও message দিন");
    const users = unwrap(await db.from("users").select("id").eq("role", "user"));
    if (users.length)
      unwrap(
        await db
          .from("notifications")
          .insert(users.map((u) => notification(u.id, title, body))),
      );
    r.json({ ok: 1, count: users.length });
  }),
);
app.get(
  "/api/admin/projects",
  A,
  asyncRoute(async (_, r) => {
    r.json(
      unwrap(
        await db
          .from("projects")
          .select("*")
          .eq("active", true)
          .order("id", { ascending: false }),
      ),
    );
  }),
);
app.post(
  "/api/admin/projects",
  A,
  asyncRoute(async (req, r) => {
    const b = req.body;
    if (!b.title || !(+b.price_code >= 0)) return bad(r, "Title ও দাম দিন");
    if (!validPreviewUrl(b.preview_url))
      return bad(r, "শুধু deployed demo-এর HTTPS preview URL দিন");
    unwrap(
      await db.from("projects").insert({
        title: b.title,
        category: b.category || "অন্যান্য",
        cover_url: b.cover_url || null,
        preview_url: b.preview_url || null,
        course: b.course,
        tech: b.tech,
        description: b.description,
        price_code: +b.price_code,
        price_consult: +b.price_consult,
        download_url: b.download_url,
      }),
    );
    r.json({ ok: 1 });
  }),
);
app.put(
  "/api/admin/projects/:id",
  A,
  asyncRoute(async (req, r) => {
    const b = req.body;
    if (!b.title || !(+b.price_code >= 0) || !(+b.price_consult >= 0))
      return bad(r, "Title ও দাম দিন");
    if (!validPreviewUrl(b.preview_url))
      return bad(r, "শুধু deployed demo-এর HTTPS preview URL দিন");
    unwrap(
      await db
        .from("projects")
        .update({
          title: b.title,
          category: b.category || "অন্যান্য",
          cover_url: b.cover_url || null,
          preview_url: b.preview_url || null,
          course: b.course || "",
          tech: b.tech || "",
          description: b.description || "",
          price_code: +b.price_code,
          price_consult: +b.price_consult,
          download_url: b.download_url || null,
        })
        .eq("id", req.params.id),
    );
    r.json({ ok: 1 });
  }),
);
app.delete(
  "/api/admin/projects/:id",
  A,
  asyncRoute(async (req, r) => {
    // Keep projects referenced by orders so purchase history remains valid.
    unwrap(
      await db
        .from("projects")
        .update({ active: false })
        .eq("id", req.params.id),
    );
    r.json({ ok: 1 });
  }),
);

const dist = path.join(__dirname, "..", "dist");
app.use(
  express.static(dist, {
    maxAge: "1y",
    immutable: true,
    index: false,
    setHeaders: (res, f) =>
      f.endsWith(".html") && res.set("Cache-Control", "no-cache"),
  }),
);
app.get("*", (_, r) => r.sendFile(path.join(dist, "index.html")));
app.use((e, _, r, __) => {
  console.error(e);
  bad(r, "Server error", 500);
});

const ready = ensureAdmin().catch((e) => {
  console.error("Supabase initialization failed:", e);
});

if (require.main === module) {
  ready
    .then(() =>
      app.listen(E.PORT || 3000, () =>
        console.log("Running on :" + (E.PORT || 3000)),
      ),
    )
    .catch((e) => {
      console.error("Supabase initialization failed:", e);
      process.exit(1);
    });
}

module.exports = { app, ready };
