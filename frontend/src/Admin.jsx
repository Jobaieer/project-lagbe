import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { useApp } from "./ctx";
function Row({ o, reload }) {
  const { notify, t } = useApp();
  const [ml, setMl] = useState(o.meet_link || "");
  const set = async (status) => {
    try {
      await api("admin/orders/" + o.id, "PUT", {
        status,
        meet_link: o.option === "consult" && status === "approved" ? ml : "",
      });
      notify(t("updated"));
      reload();
    } catch (e) {
      notify(e.message);
    }
  };
  return (
    <tr>
      <td>
        {o.uname}
        <br />
        {o.email}
      </td>
      <td>
        {o.title}
        <br />
        {o.option === "code" ? t("optionCode") : t("optionConsult")}
      </td>
      <td>
        {o.method}
        <br />
        {o.trx_id}
      </td>
      <td>{o.note}</td>
      <td>
        <span className={"st " + o.status}>{o.status}</span>
        {o.option === "consult" && (
          <input
            value={ml}
            onChange={(e) => setMl(e.target.value)}
            placeholder={t("meet")}
          />
        )}
        <div className="row">
          <button className="sm" onClick={() => set("approved")}>
            {t("approved")}
          </button>
          <button className="sm alt" onClick={() => set("rejected")}>
            {t("rejected")}
          </button>
        </div>
      </td>
    </tr>
  );
}
const E0 = {
  title: "",
  category: "",
  cover_url: "",
  course: "",
  tech: "",
  description: "",
  price_code: "",
  price_consult: "",
  download_url: "",
  preview_url: "",
};
export default function Admin() {
  const { notify, t } = useApp();
  const [O, setO] = useState([]);
  const [P, setP] = useState([]);
  const [f, setF] = useState(E0);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ title: "", body: "" });
  const [applications, setApplications] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const load = useCallback(() => {
    Promise.all([api("admin/orders"), api("admin/projects"), api("admin/seller-applications"), api("admin/payout-requests")]).then(([o, p, a, payouts]) => {
      setO(o);
      setP(p);
      setApplications(a);
      setPayouts(payouts);
    });
  }, []);
  useEffect(load, [load]);
  const save = async (e) => {
    e.preventDefault();
    try {
      await api(
        editingId ? "admin/projects/" + editingId : "admin/projects",
        editingId ? "PUT" : "POST",
        f,
      );
      setF(E0);
      setEditingId(null);
      notify(t("updated"));
      load();
    } catch (x) {
      notify(x.message);
    }
  };
  const del = async (id) => {
    if (confirm(t("confirmDelete"))) {
      try {
        await api("admin/projects/" + id, "DELETE");
        notify(t("updated"));
        load();
      } catch (x) {
        notify(x.message);
      }
    }
  };
  const edit = (project) => {
    setEditingId(project.id);
    setF({
      title: project.title || "",
      category: project.category || "",
      cover_url: project.cover_url || "",
      course: project.course || "",
      tech: project.tech || "",
      description: project.description || "",
      price_code: project.price_code ?? "",
      price_consult: project.price_consult ?? "",
      download_url: project.download_url || "",
      preview_url: project.preview_url || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setF(E0);
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sendBroadcast = async (e) => {
    e.preventDefault();
    try {
      await api("admin/notifications", "POST", message);
      setMessage({ title: "", body: "" });
      notify(t("sent"));
    } catch (x) {
      notify(x.message);
    }
  };
  const reviewSeller = async (id, status) => {
    try {
      await api("admin/seller-applications/" + id, "PUT", { status });
      notify(t("updated"));
      load();
    } catch (x) { notify(x.message); }
  };
  const reviewPayout = async (id, status) => {
    try {
      await api("admin/payout-requests/" + id, "PUT", { status });
      notify(t("updated"));
      load();
    } catch (x) { notify(x.message); }
  };
  return (
    <>
      <h1>{t("admin")}</h1>
      <h3>
        {t("manageOrders")} ({O.filter((o) => o.status === "pending").length} {t("pendingCount")})
      </h3>
      <div className="box">
        <table>
          <thead>
            <tr>
              <th>{t("user")}</th>
              <th>{t("project")}</th>
              <th>{t("payment")}</th>
              <th>{t("note")}</th>
              <th>{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {O.map((o) => (
              <Row key={o.id} o={o} reload={load} />
            ))}
          </tbody>
        </table>
      </div>
      <h3>{editingId ? t("edit") : t("newProject")}</h3>
      <form className="card" onSubmit={save}>
        <input
          required
          value={f.title}
          onChange={set("title")}
          placeholder={t("title")}
        />
        <input
          required
          value={f.category}
          onChange={set("category")}
          placeholder={t("category")}
        />
        <input
          value={f.cover_url}
          onChange={set("cover_url")}
          placeholder={t("cover")}
          type="url"
        />
        <input
          value={f.course}
          onChange={set("course")}
          placeholder={t("course")}
        />
        <input value={f.tech} onChange={set("tech")} placeholder={t("tech")} />
        <textarea
          value={f.description}
          onChange={set("description")}
          placeholder={t("description")}
        />
        <input
          required
          type="number"
          min="0"
          value={f.price_code}
          onChange={set("price_code")}
          placeholder={t("codePrice")}
        />
        <input
          required
          type="number"
          min="0"
          value={f.price_consult}
          onChange={set("price_consult")}
          placeholder={t("consultPrice")}
        />
        <input
          value={f.download_url}
          onChange={set("download_url")}
          placeholder={t("downloadUrl")}
        />
        <input
          value={f.preview_url}
          onChange={set("preview_url")}
          placeholder={t("previewUrl")}
          type="url"
        />
        <div className="row">
          <button>{editingId ? t("update") : t("add")}</button>
          {editingId && (
            <button type="button" className="alt" onClick={cancelEdit}>
              {t("cancelEdit")}
            </button>
          )}
        </div>
      </form>
      <h3>{t("projectList")}</h3>
      {P.map((p) => (
        <div className="card mb project-admin-row" key={p.id}>
          <div>
            <strong>{p.title}</strong>
            <span className="tag">{p.category} · ৳{p.price_code} / ৳{p.price_consult}</span>
          </div>
          <div className="row">
            <button className="sm" onClick={() => edit(p)}>
              {t("edit")}
            </button>
            <button className="sm alt" onClick={() => del(p.id)}>
              {t("delete")}
            </button>
          </div>
        </div>
      ))}
      <h3>{t("sellerApplications")}</h3>
      {applications.map((application) => (
        <div className="card mb" key={application.id}>
          <strong>{application.users?.name}</strong>
          <span className="tag">{application.users?.email} · {application.university}</span>
          <p>{application.reason}</p>
          <div className="row">
            <button className="sm" onClick={() => reviewSeller(application.id, "approved")}>{t("approve")}</button>
            <button className="sm alt" onClick={() => reviewSeller(application.id, "rejected")}>{t("reject")}</button>
          </div>
        </div>
      ))}
      <h3>{t("payoutRequests")}</h3>
      {payouts.map((request) => (
        <div className="card mb" key={request.id}>
          <strong>{request.users?.name}</strong>
          <span className="tag">{request.users?.email} · ৳{request.amount}</span>
          <div className="row">
            <button className="sm" onClick={() => reviewPayout(request.id, "paid")}>{t("markPaid")}</button>
            <button className="sm alt" onClick={() => reviewPayout(request.id, "rejected")}>{t("reject")}</button>
          </div>
        </div>
      ))}
      <h3>{t("broadcast")}</h3>
      <form className="card" onSubmit={sendBroadcast}>
        <input required value={message.title} onChange={(e) => setMessage({ ...message, title: e.target.value })} placeholder={t("notificationTitle")} />
        <textarea required value={message.body} onChange={(e) => setMessage({ ...message, body: e.target.value })} placeholder={t("notificationMessage")} />
        <button>{t("sendNotification")}</button>
      </form>
    </>
  );
}
