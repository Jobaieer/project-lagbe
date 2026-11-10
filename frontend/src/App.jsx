import { lazy, Suspense, useEffect, useMemo, useState, memo } from "react";
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { api } from "./api";
import { useApp } from "./ctx";
const Admin = lazy(() => import("./Admin"));
function Notifications() {
  const { t } = useApp();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const load = () => api("notifications").then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);
  const unread = items.filter((item) => !item.read).length;
  const markRead = async () => {
    if (!unread) return;
    await api("notifications/read-all", "PUT");
    setItems(items.map((item) => ({ ...item, read: true })));
  };
  return (
    <div className="notification-wrap">
      <button className="notification-button" onClick={() => setOpen(!open)} aria-label={t("notifications")}>
        <span aria-hidden="true">♢</span>
        {unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}
      </button>
      {open && (
        <div className="notification-panel">
          <div className="notification-head">
            <strong>{t("notifications")}</strong>
            <button className="link" onClick={markRead}>{t("markRead")}</button>
          </div>
          {items.length ? items.map((item) => (
            <div className={"notification-item" + (item.read ? "" : " unread")} key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <small>{new Date(item.created).toLocaleString()}</small>
            </div>
          )) : <p className="notification-empty">{t("noNotifications")}</p>}
        </div>
      )}
    </div>
  );
}
const Header = () => {
  const { user, logout, lang, t, toggleLanguage } = useApp();
  const go = useNavigate();
  return (
    <header className="site-header">
      <Link className="logo" to="/">
        <span>Project Lagbe?</span>
      </Link>
      <nav>
        <Link to="/">{t("projects")}</Link>
        {user ? (
          <>
            <Link to="/orders">{t("orders")}</Link>
            <Link to="/account">{t("account")}</Link>
            <Notifications />
            {user.role === "seller" && <Link to="/seller">{t("seller")}</Link>}
            {user.role === "admin" && <Link to="/admin">{t("admin")}</Link>}
            <button
              className="link"
              onClick={() => {
                logout();
                go("/");
              }}
            >
              {t("logout")}
            </button>
          </>
        ) : (
          <Link to="/login">{t("loginRegister")}</Link>
        )}
        <Link to="/terms">{t("terms")}</Link>
        <button className="lang" onClick={toggleLanguage} aria-label="Change language">
          {lang === "bn" ? "English" : "বাংলা"}
        </button>
      </nav>
    </header>
  );
};
const Card = memo(({ p, onBuy }) => {
  const { t } = useApp();
  return (
  <article className="card project-card">
    {p.cover_url ? (
      <img className="cover" src={p.cover_url} alt={p.title} />
    ) : (
      <div className="cover placeholder" aria-hidden="true">{t("projectFallback")}</div>
    )}
    <div className="project-title">
      <h3>{p.title}</h3>
      <span className="project-badge">{p.category || t("projectFallback")}</span>
    </div>
    <div className="tag">
      {p.course} • {p.tech}
    </div>
    <p>{p.description}</p>
    {p.preview_url && (
      <a
        className="preview-link"
        href={p.preview_url}
        target="_blank"
        rel="noreferrer noopener"
        referrerPolicy="no-referrer"
      >
        {t("livePreview")} ↗
      </a>
    )}
    <div className="row card-actions">
      <button className="alt" onClick={() => onBuy(p, "code")}>
        {t("code")} ৳{p.price_code}
      </button>
      <button onClick={() => onBuy(p, "consult")}>
        {t("consult")} ৳{p.price_consult}
      </button>
    </div>
  </article>
  );
});
function Home() {
  const [P, setP] = useState(null);
  const [s, setS] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [buy, setBuy] = useState(null);
  const { user, t } = useApp();
  const go = useNavigate();
  const referralCode = new URLSearchParams(useLocation().search).get("ref") || "";
  useEffect(() => {
    api("projects")
      .then(setP)
      .catch(() => setP([]));
  }, []);
  const list = useMemo(() => {
    const k = query.trim().toLowerCase();
    return (P || [])
      .filter((p) => !category || (p.category || t("otherCategory")) === category)
      .filter((p) => !k || `${p.title} ${p.category} ${p.course} ${p.tech} ${p.description}`.toLowerCase().includes(k))
      .sort((a, b) => (a.category || "").localeCompare(b.category || ""));
  }, [P, query, category, t]);
  const onBuy = (p, option) => (user ? setBuy({ p, option }) : go("/login"));
  return (
    <div className="home">
      <section className="hero">
        <div>
          <span className="eyebrow">{t("projects")}</span>
          <h1>{t("hero")}</h1>
          <p className="sub">{t("sub")}</p>
        </div>
      </section>
      <form className="filters" onSubmit={(e) => { e.preventDefault(); setQuery(s); }}>
        <input
          className="search"
          value={s}
          onChange={(e) => setS(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("search")}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("category")}>
          <option value="">{t("allCategories")}</option>
          {[...new Set((P || []).map((p) => p.category || t("otherCategory")))].sort().map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit">{t("search")}</button>
      </form>
      {!P ? (
        <div className="loading-card"><span className="spinner" />{t("loading")}</div>
      ) : list.length ? (
        <div className="project-groups">
          {[...new Set(list.map((p) => p.category || t("otherCategory")))].map((group) => (
            <section className="project-group" key={group}>
              <h2>{group}</h2>
              <div className="grid">
                {list.filter((p) => (p.category || t("otherCategory")) === group).map((p) => (
                  <Card key={p.id} p={p} onBuy={onBuy} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>{t("notFound")}</strong>
          <span>{t("searchPlaceholder")}</span>
        </div>
      )}
      {buy && <Buy {...buy} referralCode={referralCode} onClose={() => setBuy(null)} />}
    </div>
  );
}
function Buy({ p, option, referralCode, onClose }) {
  const { cfg, notify, t } = useApp();
  const go = useNavigate();
  const [f, setF] = useState({ method: "bKash", trx_id: "", note: "" });
  const [busy, setBusy] = useState(false);
  const c = option === "consult",
    price = c ? p.price_consult : p.price_code;
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("orders", "POST", { project_id: p.id, option, referral_code: referralCode || undefined, ...f });
      notify(t("orderSent"));
      onClose();
      go("/orders");
    } catch (x) {
      notify(x.message);
      setBusy(false);
    }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="ov" onClick={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3>{p.title}</h3>
        <p>
          {c ? t("consult") : t("sourceCode")} — <b>৳{price}</b>
        </p>
        <p className="tag">{cfg.pay}</p>
        <select value={f.method} onChange={set("method")}>
          <option>bKash</option>
          <option>Nagad</option>
          <option>Rocket</option>
        </select>
        <input
          required
          autoFocus
          value={f.trx_id}
          onChange={set("trx_id")}
          placeholder={t("transaction")}
        />
        <textarea
          value={f.note}
          onChange={set("note")}
          placeholder={
            c ? t("sessionNote") : t("note")
          }
        />
        <div className="row">
          <button disabled={busy}>{busy ? t("submitting") : t("order")}</button>
          <button type="button" className="alt" onClick={onClose}>
            {t("cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
function Login() {
  const { login, notify, t } = useApp();
  const go = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "", terms_accepted: false });
  const [reg, setReg] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await api(reg ? "register" : "login", "POST", f);
      login(u);
      go(u.role === "admin" ? "/admin" : "/");
    } catch (x) {
      notify(x.message);
      setBusy(false);
    }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <h1>{reg ? t("register") : t("login")}</h1>
      <form className="card narrow" onSubmit={submit}>
        {reg && (
          <input
            required
            value={f.name}
            onChange={set("name")}
            placeholder={t("name")}
          />
        )}
        <input
          required
          type="email"
          value={f.email}
          onChange={set("email")}
          placeholder={t("email")}
          autoComplete="email"
        />
        <input
          required
          type="password"
          minLength={6}
          value={f.password}
          onChange={set("password")}
          placeholder={t("password")}
          autoComplete={reg ? "new-password" : "current-password"}
        />
        {reg && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={f.terms_accepted}
              onChange={(e) => setF({ ...f, terms_accepted: e.target.checked })}
              required
            />
            <span>{t("termsAccept")} · <Link to="/terms">{t("terms")}</Link></span>
          </label>
        )}
        <div className="row">
          <button disabled={busy}>{reg ? t("register") : t("login")}</button>
          <button type="button" className="alt" onClick={() => setReg(!reg)}>
            {reg ? t("existing") : t("newAccount")}
          </button>
        </div>
      </form>
    </>
  );
}
function Terms() {
  const { t } = useApp();
  return (
    <article className="card policy">
      <h1>{t("terms")}</h1>
      <p>{t("policyIntro")}</p>
      <h2>{t("buyerTerms")}</h2>
      <ul>
        <li>Buyer must provide accurate account and payment information and must not share purchased files beyond the permitted license.</li>
        <li>Projects are educational materials; buyers remain responsible for lawful academic use and must not submit another person’s work as their own where academic rules prohibit it.</li>
        <li>Buyers must not attempt unauthorised access, reverse engineering of protected services, payment fraud, harassment, or abuse of live consultation.</li>
      </ul>
      <h2>{t("sellerTerms")}</h2>
      <ul>
        <li>Seller must be the lawful owner or authorised licensor of every project, image, document, dataset and link submitted.</li>
        <li>Seller must provide accurate university verification information and must not upload malware, credentials, personal data, pirated material, or deceptive content.</li>
        <li>Seller accepts the published 20% platform commission and is responsible for lawful tax, licensing and delivery obligations applicable to the seller.</li>
      </ul>
      <h2>{t("prohibited")}</h2>
      <p>No fraud, impersonation, plagiarism-for-submission, copyright infringement, malware, illegal goods/services, hate or abusive content, unauthorised personal-data disclosure, or attempts to bypass platform security are allowed.</p>
      <h2>{t("refunds")}</h2>
      <p>Payments are reviewed by the platform. A buyer may report duplicate payment, non-delivery, materially misleading listing, or unauthorised transaction through the platform. Refunds or order cancellation are decided after evidence review; completed digital delivery may limit refund eligibility except where required by law.</p>
      <h2>{t("privacy")}</h2>
      <p>Project Lagbe collects account, transaction, verification and security data necessary to operate the service, prevent fraud, provide support and meet legal obligations. Data is accessed only for legitimate operational, safety or legal purposes and is not sold as a product.</p>
      <h2>{t("ip")}</h2>
      <p>Copyright and other intellectual-property rights remain with their lawful owners unless a separate licence says otherwise. Users grant the platform only the limited licence needed to host, display, review and deliver authorised listings.</p>
      <h2>{t("enforcement")}</h2>
      <p>We may warn, suspend, remove content, hold payouts, cancel transactions, preserve evidence and report suspected unlawful conduct to competent authorities. We may cooperate with valid legal requests.</p>
      <h2>{t("legal")}</h2>
      <p>These terms are intended to operate consistently with applicable laws of Bangladesh, including laws relating to contracts, consumer protection, copyright, electronic transactions, cyber security and privacy, as amended from time to time. Subject to mandatory legal rights, disputes will be handled under the competent courts of Bangladesh.</p>
      <p className="tag">Effective date: 11 November 2026 · Terms version: 2026-11-11</p>
      <p className="tag">This page is general platform policy, not a substitute for advice from a Bangladesh-qualified lawyer.</p>
    </article>
  );
}
function Account() {
  const { notify, t, user } = useApp();
  const [profile, setProfile] = useState(null);
  const [profileName, setProfileName] = useState(user?.name || "");
  const [f, setF] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [busy, setBusy] = useState(false);
  const [sellerForm, setSellerForm] = useState({ university: "", university_id: "", department: "", institution_email: "", reason: "", terms_accepted: false });
  useEffect(() => {
    api("profile").then((data) => {
      setProfile(data);
      setProfileName(data.name || "");
    }).catch((x) => notify(x.message));
  }, [notify]);
  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      const data = await api("profile", "PUT", { name: profileName });
      setProfile({ ...profile, ...data });
      notify(t("profileUpdated"));
    } catch (x) { notify(x.message); }
  };
  const set = (key) => (e) => setF({ ...f, [key]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("password", "PUT", f);
      setF({ current_password: "", new_password: "", confirm_password: "" });
      notify(t("passwordChanged"));
    } catch (x) {
      notify(x.message);
    } finally {
      setBusy(false);
    }
  };
  const applySeller = async (e) => {
    e.preventDefault();
    try {
      await api("seller/apply", "POST", sellerForm);
      setSellerForm({ university: "", university_id: "", department: "", institution_email: "", reason: "", terms_accepted: false });
      notify(t("applicationSent"));
    } catch (x) {
      notify(x.message);
    }
  };
  return (
    <>
      <h1>{t("profile")}</h1>
      <div className="card profile-card">
        <div className="profile-avatar">{(profile?.name || user?.name || "?").slice(0, 1).toUpperCase()}</div>
        <div className="profile-main">
          <form onSubmit={updateProfile} className="profile-form">
            <label>{t("name")}</label>
            <input required minLength="2" maxLength="80" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            <button className="sm">{t("saveProfile")}</button>
          </form>
          <p className="tag">{profile?.email || "—"} · {t("role")}: {profile?.role || user?.role}</p>
          <p className="tag">{t("joined")}: {profile?.created ? new Date(profile.created).toLocaleDateString() : "—"} · {t("ordersCount")}: {profile?.order_count ?? 0}</p>
          {profile?.role === "seller" && (
            <>
              <p className="tag">{t("sellerStatus")}: {profile.seller_status} · {t("sellerProjects")}: {profile.project_count ?? 0}</p>
              <p className="tag">{t("university")}: {profile.university || "—"} · {t("universityId")}: {profile.university_id || "—"}</p>
              <p className="tag">{t("department")}: {profile.department || "—"} · {t("institutionEmail")}: {profile.institution_email || "—"}</p>
              {profile.referral_code && <p className="tag">{t("referralLink")}: {window.location.origin}/?ref={profile.referral_code}</p>}
            </>
          )}
        </div>
      </div>
      <h1>{t("changePassword")}</h1>
      <form className="card narrow" onSubmit={submit}>
        <input required type="password" value={f.current_password}
          onChange={set("current_password")} placeholder={t("currentPassword")}
          autoComplete="current-password" />
        <input required minLength={6} type="password" value={f.new_password}
          onChange={set("new_password")} placeholder={t("newPassword")}
          autoComplete="new-password" />
        <input required minLength={6} type="password" value={f.confirm_password}
          onChange={set("confirm_password")} placeholder={t("confirmPassword")}
          autoComplete="new-password" />
        <button disabled={busy}>{busy ? t("submitting") : t("update")}</button>
      </form>
      {user?.role === "buyer" && (
        <>
          <h2>{t("applySeller")}</h2>
          <form className="card narrow" onSubmit={applySeller}>
            <input required value={sellerForm.university} onChange={(e) => setSellerForm({ ...sellerForm, university: e.target.value })} placeholder={t("university")} />
            <input required value={sellerForm.university_id} onChange={(e) => setSellerForm({ ...sellerForm, university_id: e.target.value })} placeholder={t("universityId")} />
            <input required value={sellerForm.department} onChange={(e) => setSellerForm({ ...sellerForm, department: e.target.value })} placeholder={t("department")} />
            <input required type="email" value={sellerForm.institution_email} onChange={(e) => setSellerForm({ ...sellerForm, institution_email: e.target.value })} placeholder={t("institutionEmail")} />
            <textarea required value={sellerForm.reason} onChange={(e) => setSellerForm({ ...sellerForm, reason: e.target.value })} placeholder={t("applicationReason")} />
            <label className="check-row">
              <input required type="checkbox" checked={sellerForm.terms_accepted} onChange={(e) => setSellerForm({ ...sellerForm, terms_accepted: e.target.checked })} />
              <span>{t("termsAccept")} · <Link to="/terms">{t("terms")}</Link></span>
            </label>
            <button>{t("apply")}</button>
          </form>
        </>
      )}
    </>
  );
}
function Seller() {
  const { notify, t } = useApp();
  const [data, setData] = useState(null);
  const [f, setF] = useState({ title: "", category: "", description: "", price_code: "", price_consult: "", preview_url: "", cover_url: "" });
  const [editingId, setEditingId] = useState(null);
  const [amount, setAmount] = useState("");
  const load = () => api("seller/dashboard").then(setData).catch(() => setData({ projects: [], orders: [] }));
  useEffect(load, []);
  const set = (key) => (e) => setF({ ...f, [key]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    try {
      await api(editingId ? "seller/projects/" + editingId : "seller/projects", editingId ? "PUT" : "POST", f);
      setF({ title: "", category: "", description: "", price_code: "", price_consult: "", preview_url: "", cover_url: "" });
      setEditingId(null);
      notify(t("updated"));
      load();
    } catch (x) { notify(x.message); }
  };
  const request = async (e) => {
    e.preventDefault();
    try { await api("seller/payout-requests", "POST", { amount }); setAmount(""); notify(t("updated")); load(); }
    catch (x) { notify(x.message); }
  };
  const editProject = (project) => {
    setEditingId(project.id);
    setF({
      title: project.title || "",
      category: project.category || "",
      description: project.description || "",
      price_code: project.price_code ?? "",
      price_consult: project.price_consult ?? "",
      preview_url: project.preview_url || "",
      cover_url: project.cover_url || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  if (!data) return <p>{t("loading")}</p>;
  const available = Number(data.wallet?.available || 0);
  const referralLink = `${window.location.origin}/?ref=${encodeURIComponent(data.referral_code || "")}`;
  return (
    <>
      <h1>{t("sellerDashboard")}</h1>
      <div className="card">
        <strong>{t("referralLink")}</strong>
        <p className="tag">{t("referralEarn")}: {data.referral_percent}%</p>
        <input readOnly value={referralLink} onFocus={(e) => e.target.select()} />
      </div>
      <div className="card">
        <strong>{t("sellerProfile")}</strong>
        <p className="tag">{t("university")}: {JSON.parse(localStorage.getItem("u") || "{}").university || "-"} · {t("universityId")}: {JSON.parse(localStorage.getItem("u") || "{}").university_id || "-"}</p>
        <p className="tag">{t("department")}: {JSON.parse(localStorage.getItem("u") || "{}").department || "-"} · {t("institutionEmail")}: {JSON.parse(localStorage.getItem("u") || "{}").institution_email || "-"}</p>
      </div>
      <h2>{t("sellerProjects")}</h2>
      <form className="card" onSubmit={save}>
        <input required value={f.title} onChange={set("title")} placeholder={t("title")} />
        <input required value={f.category} onChange={set("category")} placeholder={t("category")} />
        <textarea value={f.description} onChange={set("description")} placeholder={t("description")} />
        <input required type="number" min="0" value={f.price_code} onChange={set("price_code")} placeholder={t("codePrice")} />
        <input required type="number" min="0" value={f.price_consult} onChange={set("price_consult")} placeholder={t("consultPrice")} />
        <input type="url" value={f.preview_url} onChange={set("preview_url")} placeholder={t("previewUrl")} />
        <input type="url" value={f.cover_url} onChange={set("cover_url")} placeholder={t("cover")} />
        <div className="row">
          <button>{editingId ? t("update") : t("add")}</button>
          {editingId && <button type="button" className="alt" onClick={() => { setEditingId(null); setF({ title: "", category: "", description: "", price_code: "", price_consult: "", preview_url: "", cover_url: "" }); }}>{t("cancelEdit")}</button>}
        </div>
      </form>
      <div className="card">
        <strong>{t("availablePayout")}: ৳{available.toFixed(2)}</strong>
        <p className="tag">Total earned: ৳{Number(data.wallet?.total_earned || 0).toFixed(2)} · Reserved/withdrawn: ৳{Number(data.wallet?.reserved || 0).toFixed(2)}</p>
        {data.orders.filter((o) => o.status === "approved").map((o) => (
          <p className="tag" key={o.id}>৳{o.gross_amount.toFixed(2)} - {t("commission")}: ৳{o.commission_amount.toFixed(2)} = ৳{Number(o.payout_amount || 0).toFixed(2)}</p>
        ))}
        <form className="row" onSubmit={request}>
          <input required type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("payout")} />
          <button>{t("requestPayout")}</button>
        </form>
      </div>
      <div className="grid">{data.projects.map((p) => (
        <div className="card" key={p.id}>
          <strong>{p.title}</strong>
          <p className="tag">{p.category}</p>
          <button className="sm" onClick={() => editProject(p)}>{t("edit")}</button>
        </div>
      ))}</div>
    </>
  );
}
function Orders() {
  const [O, setO] = useState(null);
  useEffect(() => {
    api("my-orders").then(setO);
  }, []);
  const { t } = useApp();
  if (!O) return <p>{t("loading")}</p>;
  return (
    <>
      <h1>{t("myOrders")}</h1>
      {!O.length ? (
        <p>
          {t("noOrders")} <Link to="/">{t("viewProjects")}</Link>
        </p>
      ) : (
        <div className="box">
          <table>
            <thead>
              <tr>
                <th>{t("project")}</th>
                <th>{t("type")}</th>
                <th>{t("status")}</th>
                <th>{t("access")}</th>
              </tr>
            </thead>
            <tbody>
              {O.map((o) => (
                <tr key={o.id}>
                  <td>{o.title}</td>
                  <td>{o.option === "code" ? t("code") : t("consult")}</td>
                  <td>
                    <span className={"st " + o.status}>{t(o.status)}</span>
                  </td>
                  <td>
                    {o.download_url && (
                      <a href={o.download_url} target="_blank" rel="noreferrer">
                        {t("download")}
                      </a>
                    )}
                    {o.meet_link && (
                      <>
                        <br />
                        <a href={o.meet_link} target="_blank" rel="noreferrer">
                          {t("liveLink")}
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
export default function App() {
  const { user, t } = useApp();
  return (
    <>
      <Header />
      <main>
        <Suspense fallback={<p>{t("loading")}</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/terms" element={<Terms />} />
            <Route
              path="/account"
              element={user ? <Account /> : <Navigate to="/login" />}
            />
            <Route
              path="/orders"
              element={user ? <Orders /> : <Navigate to="/login" />}
            />
            <Route
              path="/seller"
              element={user?.role === "seller" ? <Seller /> : <Navigate to="/account" />}
            />
            <Route
              path="/admin"
              element={
                user?.role === "admin" ? <Admin /> : <Navigate to="/login" />
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}
