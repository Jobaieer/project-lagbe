import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { api, setToken } from "./api";
const Ctx = createContext();
export const useApp = () => useContext(Ctx);
export function AppProvider({ children }) {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("u") || "null"),
  );
  const [toast, setToast] = useState("");
  const [cfg, setCfg] = useState({});
  useEffect(() => {
    api("config")
      .then(setCfg)
      .catch(() => {});
  }, []);
  const notify = useCallback((m) => {
    setToast(m);
    setTimeout(() => setToast(""), 3000);
  }, []);
  const login = useCallback((u) => {
    setToken(u.token);
    const x = { name: u.name, role: u.role };
    localStorage.setItem("u", JSON.stringify(x));
    setUser(x);
  }, []);
  const logout = useCallback(() => {
    setToken("");
    localStorage.removeItem("u");
    setUser(null);
  }, []);
  const v = useMemo(
    () => ({ user, login, logout, notify, cfg }),
    [user, login, logout, notify, cfg],
  );
  return (
    <Ctx.Provider value={v}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </Ctx.Provider>
  );
}
