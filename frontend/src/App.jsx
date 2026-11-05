import { lazy, Suspense, useEffect, useMemo, useState, memo } from "react";
import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "./api";
import { useApp } from "./ctx";
const Admin = lazy(() => import("./Admin"));
const Header = () => {
  const { user, logout } = useApp();
  const go = useNavigate();
  return (
    <header>
      <Link className="logo" to="/">
        প্রজেক্ট লাগবে?
      </Link>
      <nav>
        <Link to="/">প্রজেক্ট</Link>
        {user ? (
          <>
            <Link to="/orders">আমার অর্ডার</Link>
            {user.role === "admin" && <Link to="/admin">Admin</Link>}
            <button
              className="link"
              onClick={() => {
                logout();
                go("/");
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link to="/login">Login / Register</Link>
        )}
      </nav>
    </header>
  );
};
const Card = memo(({ p, onBuy }) => (
  <article className="card">
    <h3>{p.title}</h3>
    <div className="tag">
      {p.course} • {p.tech}
    </div>
    <p>{p.description}</p>
    <div className="row">
      <button className="alt" onClick={() => onBuy(p, "code")}>
        শুধু কোড ৳{p.price_code}
      </button>
      <button onClick={() => onBuy(p, "consult")}>
        কোড + লাইভ কনসাল্টেন্সি ৳{p.price_consult}
      </button>
    </div>
  </article>
));
function Home() {
  const [P, setP] = useState(null);
  const [s, setS] = useState("");
  const [buy, setBuy] = useState(null);
  const { user } = useApp();
  const go = useNavigate();
  useEffect(() => {
    api("projects")
      .then(setP)
      .catch(() => setP([]));
  }, []);
  const list = useMemo(() => {
    const k = s.trim().toLowerCase();
    return (P || []).filter(
      (p) => !k || `${p.title} ${p.course} ${p.tech}`.toLowerCase().includes(k),
    );
  }, [P, s]);
  const onBuy = (p, option) => (user ? setBuy({ p, option }) : go("/login"));
  return (
    <>
      <h1>CSE Lab প্রজেক্ট লাগবে?</h1>
      <p className="sub">রেডি সোর্স কোড নিন, চাইলে লাইভ ব্যাখ্যাসহ বুঝে নিন।</p>
      <input
        className="search"
        value={s}
        onChange={(e) => setS(e.target.value)}
        placeholder="প্রজেক্ট, কোর্স বা টেক-স্ট্যাক খুঁজুন…"
        aria-label="Search"
      />
      {!P ? (
        <p>লোড হচ্ছে…</p>
      ) : list.length ? (
        <div className="grid">
          {list.map((p) => (
            <Card key={p.id} p={p} onBuy={onBuy} />
          ))}
        </div>
      ) : (
        <p>কিছু পাওয়া যায়নি।</p>
      )}
      {buy && <Buy {...buy} onClose={() => setBuy(null)} />}
    </>
  );
}
function Buy({ p, option, onClose }) {
  const { cfg, notify } = useApp();
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
      notify("অর্ডার জমা হয়েছে। Approve-এর অপেক্ষা করুন।");
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
          {c ? "কোড + লাইভ কনসাল্টেন্সি" : "শুধু সোর্স কোড"} — <b>৳{price}</b>
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
          placeholder="Transaction ID"
        />
        <textarea
          value={f.note}
          onChange={set("note")}
          placeholder={
            c ? "কখন লাইভ সেশন চান? (সময় / WhatsApp নম্বর)" : "নোট (ঐচ্ছিক)"
          }
        />
        <div className="row">
          <button disabled={busy}>{busy ? "জমা হচ্ছে…" : "অর্ডার করুন"}</button>
          <button type="button" className="alt" onClick={onClose}>
            বাতিল
          </button>
        </div>
      </form>
    </div>
  );
}
function Login() {
  const { login, notify } = useApp();
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
      <h1>{reg ? "Register" : "Login"}</h1>
      <form className="card narrow" onSubmit={submit}>
        {reg && (
          <input
            required
            value={f.name}
            onChange={set("name")}
            placeholder="নাম"
          />
        )}
        <input
          required
          type="email"
          value={f.email}
          onChange={set("email")}
          placeholder="Email"
          autoComplete="email"
        />
        <input
          required
          type="password"
          minLength={6}
          value={f.password}
          onChange={set("password")}
          placeholder="Password (৬+ অক্ষর)"
          autoComplete={reg ? "new-password" : "current-password"}
        />
        <div className="row">
          <button disabled={busy}>{reg ? "Register" : "Login"}</button>
          <button type="button" className="alt" onClick={() => setReg(!reg)}>
            {reg ? "আগে থেকেই অ্যাকাউন্ট আছে" : "নতুন অ্যাকাউন্ট"}
          </button>
        </div>
      </form>
    </>
  );
}
const L = { pending: "অপেক্ষমান", approved: "Approved", rejected: "Rejected" };
function Orders() {
  const [O, setO] = useState(null);
  useEffect(() => {
    api("my-orders").then(setO);
  }, []);
  if (!O) return <p>লোড হচ্ছে…</p>;
  return (
    <>
      <h1>আমার অর্ডার</h1>
      {!O.length ? (
        <p>
          এখনো কোনো অর্ডার নেই। <Link to="/">প্রজেক্ট দেখুন</Link>
        </p>
      ) : (
        <div className="box">
          <table>
            <thead>
              <tr>
                <th>প্রজেক্ট</th>
                <th>ধরন</th>
                <th>স্ট্যাটাস</th>
                <th>অ্যাক্সেস</th>
              </tr>
            </thead>
            <tbody>
              {O.map((o) => (
                <tr key={o.id}>
                  <td>{o.title}</td>
                  <td>{o.option === "code" ? "কোড" : "কোড + লাইভ"}</td>
                  <td>
                    <span className={"st " + o.status}>{L[o.status]}</span>
                  </td>
                  <td>
                    {o.download_url && (
                      <a href={o.download_url} target="_blank" rel="noreferrer">
                        ডাউনলোড
                      </a>
                    )}
                    {o.meet_link && (
                      <>
                        <br />
                        <a href={o.meet_link} target="_blank" rel="noreferrer">
                          লাইভ সেশন লিংক
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
  const { user } = useApp();
  return (
    <>
      <Header />
      <main>
        <Suspense fallback={<p>লোড হচ্ছে…</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
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
