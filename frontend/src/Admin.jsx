import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { useApp } from "./ctx";
function Row({ o, reload }) {
  const { notify } = useApp();
  const [ml, setMl] = useState(o.meet_link || "");
  const set = async (status) => {
    try {
      await api("admin/orders/" + o.id, "PUT", {
        status,
        meet_link: o.option === "consult" && status === "approved" ? ml : "",
      });
      notify("আপডেট হয়েছে");
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
        {o.option}
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
            placeholder="Meet/Zoom লিংক"
          />
        )}
        <div className="row">
          <button className="sm" onClick={() => set("approved")}>
            Approve
          </button>
          <button className="sm alt" onClick={() => set("rejected")}>
            Reject
          </button>
        </div>
      </td>
    </tr>
  );
}
const E0 = {
  title: "",
  course: "",
  tech: "",
  description: "",
  price_code: "",
  price_consult: "",
  download_url: "",
};
export default function Admin() {
  const { notify } = useApp();
  const [O, setO] = useState([]);
  const [P, setP] = useState([]);
  const [f, setF] = useState(E0);
  const load = useCallback(() => {
    Promise.all([api("admin/orders"), api("admin/projects")]).then(([o, p]) => {
      setO(o);
      setP(p);
    });
  }, []);
  useEffect(load, [load]);
  const add = async (e) => {
    e.preventDefault();
    try {
      await api("admin/projects", "POST", f);
      setF(E0);
      notify("প্রজেক্ট যোগ হয়েছে");
      load();
    } catch (x) {
      notify(x.message);
    }
  };
  const del = async (id) => {
    if (confirm("মুছে ফেলবেন?")) {
      await api("admin/projects/" + id, "DELETE");
      load();
    }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <h1>Admin</h1>
      <h3>
        অর্ডার ({O.filter((o) => o.status === "pending").length} অপেক্ষমান)
      </h3>
      <div className="box">
        <table>
          <thead>
            <tr>
              <th>ইউজার</th>
              <th>প্রজেক্ট</th>
              <th>Payment</th>
              <th>নোট</th>
              <th>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {O.map((o) => (
              <Row key={o.id} o={o} reload={load} />
            ))}
          </tbody>
        </table>
      </div>
      <h3>নতুন প্রজেক্ট</h3>
      <form className="card" onSubmit={add}>
        <input
          required
          value={f.title}
          onChange={set("title")}
          placeholder="Title"
        />
        <input
          value={f.course}
          onChange={set("course")}
          placeholder="Course (e.g. Networks Lab)"
        />
        <input value={f.tech} onChange={set("tech")} placeholder="Tech stack" />
        <textarea
          value={f.description}
          onChange={set("description")}
          placeholder="Description"
        />
        <input
          required
          type="number"
          min="0"
          value={f.price_code}
          onChange={set("price_code")}
          placeholder="Code price ৳"
        />
        <input
          required
          type="number"
          min="0"
          value={f.price_consult}
          onChange={set("price_consult")}
          placeholder="Code + consultancy price ৳"
        />
        <input
          value={f.download_url}
          onChange={set("download_url")}
          placeholder="Download link (private Drive/GitHub)"
        />
        <button>যোগ করুন</button>
      </form>
      <h3>প্রজেক্ট লিস্ট</h3>
      {P.map((p) => (
        <div className="card mb" key={p.id}>
          {p.title} — ৳{p.price_code} / ৳{p.price_consult}{" "}
          <button className="sm alt" onClick={() => del(p.id)}>
            Delete
          </button>
        </div>
      ))}
    </>
  );
}
