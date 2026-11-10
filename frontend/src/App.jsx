import { lazy, Suspense, useEffect, useMemo, useState, memo } from "react";
import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
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
      {buy && <Buy {...buy} onClose={() => setBuy(null)} />}
    </div>
  );
}
function Buy({ p, option, onClose }) {
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
      await api("orders", "POST", { project_id: p.id, option, ...f });
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
  const [f, setF] = useState({ name: "", email: "", password: "" });
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
function Account() {
  const { notify, t } = useApp();
  const [f, setF] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [busy, setBusy] = useState(false);
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
  return (
    <>
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
            <Route
              path="/account"
              element={user ? <Account /> : <Navigate to="/login" />}
            />
            <Route
              path="/orders"
              element={user ? <Orders /> : <Navigate to="/login" />}
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
