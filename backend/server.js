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
  seller_status: u.seller_status || "none",
  university: u.university || null,
  university_id: u.university_id || null,
  department: u.department || null,
  institution_email: u.institution_email || null,
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
const sellerAuth = (req, r, n) => {
  auth()(req, r, () => {
    if (!["seller", "admin"].includes(req.u.role))
      return bad(r, "Seller approval required", 403);
    n();
  });
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
  id: o.id, user_id: o.user_id, project_id: o.project_id, option: o.option,
  method: o.method, trx_id: o.trx_id, note: o.note, status: o.status,
  meet_link: o.meet_link, created: o.created,
  uname: users.get(o.user_id)?.name,
  email: users.get(o.user_id)?.email,
  title: projects.get(o.project_id)?.title,
});
const notification = (user_id, title, body) => ({ user_id, title, body });
const A = auth("admin");
const PLATFORM_COMMISSION_PERCENT = 20;
const REFERRAL_COMMISSION_PERCENT = 5;
const TERMS_VERSION = "2026-11-11";
const validInstitutionEmail = (value) => {
  const email = String(value || "").trim().toLowerCase();
  const match = email.match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/);
  if (!match) return false;
  return !["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"].includes(match[1]);
};
const sellerReferralSales = async (sellerId) => {
  const orders = unwrap(await db.from("orders")
    .select("project_id")
    .eq("referral_seller_id", sellerId)
    .eq("status", "approved"));
  if (!orders.length) return 0;
  const projectIds = [...new Set(orders.map((order) => order.project_id))];
  const platformProjects = unwrap(await db.from("projects")
    .select("id")
    .in("id", projectIds)
    .is("seller_id", null));
  const platformProjectIds = new Set(platformProjects.map((project) => project.id));
  return new Set(orders
    .filter((order) => platformProjectIds.has(order.project_id))
    .map((order) => order.project_id)).size;
};
const SELLER_GATE_MESSAGE = "Admin-এর 2টি course referral sale সম্পন্ন না হওয়া পর্যন্ত নিজের project sell করা যাবে না";

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
    const { name, email, password, terms_accepted } = req.body;
    if (
      !name ||
      !/^\S+@\S+\.\S+$/.test(email || "") ||
      (password || "").length < 6 ||
      terms_accepted !== true
    )
      return bad(r, "নাম, সঠিক ইমেইল ও ৬+ অক্ষরের পাসওয়ার্ড দিন");
    const result = await db
      .from("users")
      .insert({
        name: name.trim(),
        email: email.toLowerCase(),
        pass: bcrypt.hashSync(password, 10),
        terms_version: TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
      })
      .select("id,name,role,seller_status")
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
      .select("id,name,role,seller_status,university_id,department,institution_email,pass")
      .eq("email", (req.body.email || "").toLowerCase())
      .maybeSingle();
    const u = unwrap(result);
    u && bcrypt.compareSync(req.body.password || "", u.pass)
      ? r.json(tok(u))
      : bad(r, "ইমেইল/পাসওয়ার্ড ভুল");
  }),
);
app.post(
  "/api/seller/apply",
  auth(),
  asyncRoute(async (req, r) => {
    const university = (req.body.university || "").trim();
    const university_id = (req.body.university_id || "").trim();
    const department = (req.body.department || "").trim();
    const institution_email = (req.body.institution_email || "").trim().toLowerCase();
    const reason = (req.body.reason || "").trim();
    if (req.body.terms_accepted !== true) return bad(r, "Seller terms গ্রহণ করুন");
    if (!university || !university_id || !department || !reason || !validInstitutionEmail(institution_email))
      return bad(r, "University, ID, department এবং valid institutional email দিন");
    const user = unwrap(await db.from("users").select("role,seller_status").eq("id", req.u.id).single());
    if (user.role === "seller" || user.seller_status === "approved")
      return bad(r, "আপনি ইতিমধ্যে seller");
    if (user.seller_status === "pending") return bad(r, "আপনার application review হচ্ছে");
    unwrap(
      await db.from("seller_applications").upsert(
        { user_id: req.u.id, university, university_id, department, institution_email, reason, status: "pending" },
        { onConflict: "user_id" },
      ),
    );
    unwrap(await db.from("users").update({ seller_status: "pending" }).eq("id", req.u.id));
    unwrap(await db.from("users").update({
      terms_version: TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    }).eq("id", req.u.id));
    r.json({ ok: 1 });
  }),
);
app.get(
  "/api/seller/status",
  auth(),
  asyncRoute(async (req, r) => {
    r.json(
      unwrap(
        await db.from("users").select("role,seller_status").eq("id", req.u.id).single(),
      ),
    );
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
  "/api/profile",
  auth(),
  asyncRoute(async (req, r) => {
    const profile = unwrap(await db.from("users")
      .select("id,name,email,role,seller_status,university,university_id,department,institution_email,referral_code,created")
      .eq("id", req.u.id)
      .single());
    const orders = await db.from("orders").select("id", { count: "exact", head: true }).eq("user_id", req.u.id);
    const projects = await db.from("projects").select("id", { count: "exact", head: true }).eq("seller_id", req.u.id);
    if (orders.error) throw orders.error;
    if (projects.error) throw projects.error;
    r.json({ ...profile, order_count: orders.count || 0, project_count: projects.count || 0 });
  }),
);
app.put(
  "/api/profile",
  auth(),
  asyncRoute(async (req, r) => {
    const name = String(req.body.name || "").trim();
    if (name.length < 2 || name.length > 80) return bad(r, "Valid name দিন");
    const profile = unwrap(await db.from("users").update({ name }).eq("id", req.u.id)
      .select("id,name,email,role,seller_status,university,university_id,department,institution_email,referral_code,created")
      .single());
    r.json(profile);
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
    const projects = unwrap(await db.from("projects")
      .select("id,title,category,cover_url,preview_url,course,tech,description,price_code,price_consult,seller_id")
      .eq("active", true)
      .order("id", { ascending: false }));
    const sellerIds = [...new Set(projects.filter((p) => p.seller_id).map((p) => p.seller_id))];
    const eligible = sellerIds.length
      ? unwrap(await db.from("users").select("id").in("id", sellerIds).eq("seller_eligible", true))
      : [];
    const eligibleIds = new Set(eligible.map((u) => u.id));
    r.json(projects
      .filter((p) => !p.seller_id || eligibleIds.has(p.seller_id))
      .map(({ seller_id, ...project }) => project));
  }),
);
app.post(
  "/api/orders",
  auth(),
  asyncRoute(async (req, r) => {
    const { project_id, option, method, trx_id, note, referral_code } = req.body;
    if (
      !project_id ||
      !["code", "consult"].includes(option) ||
      !(trx_id || "").trim()
    )
      return bad(r, "Transaction ID দিন");
    const project = unwrap(
      await db
        .from("projects")
        .select("seller_id,price_code,price_consult,commission_percent")
        .eq("id", project_id)
        .eq("active", true)
        .single(),
    );
    const price = option === "consult" ? project.price_consult : project.price_code;
    let referralSeller = null;
    if (!project.seller_id && referral_code) {
      referralSeller = unwrap(await db.from("users")
        .select("id")
        .eq("referral_code", String(referral_code).trim())
        .eq("role", "seller")
        .eq("seller_status", "approved")
        .neq("id", req.u.id)
        .maybeSingle());
    }
    unwrap(
      await db.from("orders").insert({
        user_id: req.u.id,
        project_id,
        option,
        method,
        trx_id: trx_id.trim(),
        note: note || "",
        seller_id: project.seller_id,
        referral_seller_id: referralSeller?.id || null,
        referral_amount: referralSeller ? Number(price) * REFERRAL_COMMISSION_PERCENT / 100 : null,
        payout_amount: project.seller_id
          ? Number(price) * (1 - Number(project.commission_percent || PLATFORM_COMMISSION_PERCENT) / 100)
          : null,
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
app.get(
  "/api/seller/dashboard",
  sellerAuth,
  asyncRoute(async (req, r) => {
    let seller = unwrap(await db.from("users").select("referral_code").eq("id", req.u.id).single());
    if (!seller.referral_code) {
      const referral_code = `seller-${req.u.id}`;
      seller = unwrap(await db.from("users").update({ referral_code }).eq("id", req.u.id).select("referral_code").single());
    }
    const referralSales = await sellerReferralSales(req.u.id);
    if (referralSales >= 2)
      unwrap(await db.from("users").update({ seller_eligible: true }).eq("id", req.u.id));
    const projects = referralSales >= 2
      ? unwrap(await db.from("projects").select("*").eq("seller_id", req.u.id).eq("active", true).order("id", { ascending: false }))
      : [];
    const orders = unwrap(await db.from("orders").select("id,project_id,option,status,payout_amount,payout_status,created").eq("seller_id", req.u.id).order("id", { ascending: false }));
    const wallet = unwrap(await db.from("seller_wallet_transactions").select("type,amount").eq("seller_id", req.u.id));
    const payoutRequests = unwrap(await db.from("payout_requests").select("amount,status").eq("seller_id", req.u.id));
    const totalEarned = wallet.filter((t) => t.type === "sale_credit").reduce((sum, t) => sum + Number(t.amount), 0);
    const totalWithdrawn = payoutRequests.filter((p) => ["pending", "paid"].includes(p.status)).reduce((sum, p) => sum + Number(p.amount), 0);
    const projectMap = new Map(projects.map((p) => [p.id, p]));
    r.json({ referral_code: seller.referral_code, referral_percent: REFERRAL_COMMISSION_PERCENT, referral_sales: referralSales, seller_eligible: referralSales >= 2, projects, wallet: { total_earned: totalEarned, reserved: totalWithdrawn, available: Math.max(0, totalEarned - totalWithdrawn) }, orders: orders.map((o) => {
      const project = projectMap.get(o.project_id);
      const gross_amount = Number(o.option === "consult" ? project?.price_consult : project?.price_code) || 0;
      const payout_amount = Number(o.payout_amount) || 0;
      return {
        ...o,
        gross_amount,
        commission_amount: Math.max(0, gross_amount - payout_amount),
        commission_percent: Number(project?.commission_percent) || 0,
      };
    }) });
  }),
);
app.post(
  "/api/seller/projects",
  sellerAuth,
  asyncRoute(async (req, r) => {
    if (await sellerReferralSales(req.u.id) < 2) return bad(r, SELLER_GATE_MESSAGE, 403);
    const b = req.body;
    if (!b.title || !(+b.price_code >= 0) || !(+b.price_consult >= 0))
      return bad(r, "Title ও দাম দিন");
    if (!validPreviewUrl(b.preview_url)) return bad(r, "শুধু deployed demo-এর HTTPS preview URL দিন");
    r.json({
      project: unwrap(
        await db.from("projects").insert({
          seller_id: req.u.id,
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
          commission_percent: PLATFORM_COMMISSION_PERCENT,
        }).select("*").single(),
      ),
    });
  }),
);
app.put(
  "/api/seller/projects/:id",
  sellerAuth,
  asyncRoute(async (req, r) => {
    if (await sellerReferralSales(req.u.id) < 2) return bad(r, SELLER_GATE_MESSAGE, 403);
    const b = req.body;
    if (!b.title || !(+b.price_code >= 0) || !(+b.price_consult >= 0))
      return bad(r, "Title ও দাম দিন");
    if (!validPreviewUrl(b.preview_url)) return bad(r, "শুধু deployed demo-এর HTTPS preview URL দিন");
    unwrap(
      await db.from("projects").update({
        title: b.title, category: b.category || "অন্যান্য", cover_url: b.cover_url || null,
        preview_url: b.preview_url || null, course: b.course || "", tech: b.tech || "",
        description: b.description || "", price_code: +b.price_code, price_consult: +b.price_consult,
        download_url: b.download_url || null,
      }).eq("id", req.params.id).eq("seller_id", req.u.id),
    );
    r.json({ ok: 1 });
  }),
);
app.post(
  "/api/seller/payout-requests",
  sellerAuth,
  asyncRoute(async (req, r) => {
    const amount = Number(req.body.amount);
    if (!(amount > 0)) return bad(r, "Valid amount দিন");
    const credits = unwrap(await db.from("seller_wallet_transactions").select("amount").eq("seller_id", req.u.id).eq("type", "sale_credit"));
    const requests = unwrap(await db.from("payout_requests").select("amount,status").eq("seller_id", req.u.id).in("status", ["pending", "paid"]));
    const available = credits.reduce((sum, credit) => sum + Number(credit.amount || 0), 0)
      - requests.reduce((sum, request) => sum + Number(request.amount || 0), 0);
    if (amount > available) return bad(r, "Available payout-এর চেয়ে বেশি চাওয়া যাবে না");
    const payoutRequest = unwrap(await db.from("payout_requests").insert({ seller_id: req.u.id, amount }).select("id").single());
    unwrap(await db.from("seller_wallet_transactions").insert({
      seller_id: req.u.id,
      payout_request_id: payoutRequest.id,
      type: "payout_debit",
      amount,
      note: "Payout requested",
    }));
    unwrap(await db.from("orders").update({ payout_status: "requested" }).eq("seller_id", req.u.id).eq("status", "approved").eq("payout_status", "unpaid"));
    r.json({ ok: 1 });
  }),
);
app.get(
  "/api/admin/seller-applications",
  A,
  asyncRoute(async (_, r) => {
    r.json(unwrap(await db.from("seller_applications").select("*,users(name,email)").eq("status", "pending").order("id", { ascending: false })));
  }),
);
app.put(
  "/api/admin/seller-applications/:id",
  A,
  asyncRoute(async (req, r) => {
    if (!["approved", "rejected"].includes(req.body.status)) return bad(r, "Invalid status");
    const application = unwrap(await db.from("seller_applications").select("user_id,university,university_id,department,institution_email").eq("id", req.params.id).single());
    unwrap(await db.from("seller_applications").update({ status: req.body.status }).eq("id", req.params.id));
    unwrap(await db.from("users").update({
      role: req.body.status === "approved" ? "seller" : "buyer",
      seller_status: req.body.status,
      university: req.body.status === "approved" ? application.university : null,
      university_id: req.body.status === "approved" ? application.university_id : null,
      department: req.body.status === "approved" ? application.department : null,
      institution_email: req.body.status === "approved" ? application.institution_email : null,
    }).eq("id", application.user_id));
    unwrap(
      await db.from("notifications").insert(
        notification(
          application.user_id,
          req.body.status === "approved" ? "Seller application approved" : "Seller application rejected",
          req.body.status === "approved"
            ? "You can now add and sell your own projects."
            : "Your seller application was not approved.",
        ),
      ),
    );
    r.json({ ok: 1 });
  }),
);
app.get(
  "/api/admin/payout-requests",
  A,
  asyncRoute(async (_, r) => {
    r.json(unwrap(await db.from("payout_requests").select("*,users(name,email)").eq("status", "pending").order("id", { ascending: false })));
  }),
);
app.put(
  "/api/admin/payout-requests/:id",
  A,
  asyncRoute(async (req, r) => {
    if (!["paid", "rejected"].includes(req.body.status)) return bad(r, "Invalid status");
    const request = unwrap(await db.from("payout_requests").select("seller_id").eq("id", req.params.id).single());
    unwrap(await db.from("payout_requests").update({ status: req.body.status }).eq("id", req.params.id));
    if (req.body.status === "paid")
      unwrap(await db.from("orders").update({ payout_status: "paid" }).eq("seller_id", request.seller_id).eq("payout_status", "requested"));
    r.json({ ok: 1 });
  }),
);
app.get(
  "/api/admin/orders",
  A,
  asyncRoute(async (_, r) => {
    const orders = unwrap(
      await db.from("orders").select("id,user_id,project_id,option,method,trx_id,note,status,meet_link,created").order("id", { ascending: false }),
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
      await db.from("orders").select("user_id,seller_id,referral_seller_id,referral_amount,status,payout_amount").eq("id", req.params.id).single(),
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
    if (current.status !== "approved" && req.body.status === "approved" && current.seller_id && Number(current.payout_amount) > 0) {
      unwrap(await db.from("seller_wallet_transactions").upsert({
        seller_id: current.seller_id,
        order_id: Number(req.params.id),
        type: "sale_credit",
        amount: current.payout_amount,
        note: "Approved seller order",
      }, { onConflict: "order_id" }));
      unwrap(await db.from("notifications").insert(notification(
        current.seller_id,
        "Sale credited",
        `৳${Number(current.payout_amount).toFixed(2)} has been credited to your seller account.`,
      )));
    }
    if (current.status !== "approved" && req.body.status === "approved" && current.referral_seller_id && Number(current.referral_amount) > 0) {
      unwrap(await db.from("seller_wallet_transactions").upsert({
        seller_id: current.referral_seller_id,
        order_id: Number(req.params.id),
        type: "sale_credit",
        amount: current.referral_amount,
        note: "Platform course referral commission",
      }, { onConflict: "order_id" }));
      unwrap(await db.from("notifications").insert(notification(
        current.referral_seller_id,
        "Referral commission credited",
        `৳${Number(current.referral_amount).toFixed(2)} referral commission has been credited.`,
      )));
      const referralSales = await sellerReferralSales(current.referral_seller_id);
      if (referralSales >= 2)
        unwrap(await db.from("users").update({ seller_eligible: true }).eq("id", current.referral_seller_id));
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
    const users = unwrap(await db.from("users").select("id").in("role", ["buyer", "seller"]));
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
