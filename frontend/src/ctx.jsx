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
const translations = {
  bn: {
    projects: "প্রজেক্ট", orders: "আমার অর্ডার", loginRegister: "Login / Register",
    logout: "Logout", admin: "Admin", hero: "CSE Lab প্রজেক্ট লাগবে?",
    sub: "রেডি সোর্স কোড নিন, চাইলে লাইভ ব্যাখ্যাসহ বুঝে নিন।", search: "সার্চ",
    searchPlaceholder: "প্রজেক্ট, কোর্স বা টেক-স্ট্যাক খুঁজুন…", allCategories: "সব ক্যাটাগরি",
    loading: "লোড হচ্ছে…", notFound: "কিছু পাওয়া যায়নি।", code: "শুধু কোড",
    consult: "কোড + লাইভ কনসাল্টেন্সি", orderSent: "অর্ডার জমা হয়েছে। Approve-এর অপেক্ষা করুন।",
    sourceCode: "শুধু সোর্স কোড", cancel: "বাতিল", order: "অর্ডার করুন", submitting: "জমা হচ্ছে…",
    transaction: "Transaction ID", note: "নোট (ঐচ্ছিক)", sessionNote: "কখন লাইভ সেশন চান? (সময় / WhatsApp নম্বর)",
    register: "Register", login: "Login", name: "নাম", email: "ইমেইল", password: "Password (৬+ অক্ষর)",
    existing: "আগে থেকেই অ্যাকাউন্ট আছে", newAccount: "নতুন অ্যাকাউন্ট", myOrders: "আমার অর্ডার",
    noOrders: "এখনো কোনো অর্ডার নেই।", viewProjects: "প্রজেক্ট দেখুন", project: "প্রজেক্ট",
    type: "ধরন", status: "স্ট্যাটাস", access: "অ্যাক্সেস", download: "ডাউনলোড",
    liveLink: "লাইভ সেশন লিংক", pending: "অপেক্ষমান", approved: "Approved", rejected: "Rejected",
    manageOrders: "অর্ডার", pendingCount: "অপেক্ষমান", newProject: "নতুন প্রজেক্ট",
    add: "যোগ করুন", update: "আপডেট", edit: "এডিট", cancelEdit: "এডিট বাতিল", projectList: "প্রজেক্ট লিস্ট", delete: "Delete", payment: "Payment",
    user: "ইউজার", action: "অ্যাকশন", title: "Title", course: "Course (e.g. Networks Lab)",
    tech: "Tech stack", description: "Description", codePrice: "Code price ৳",
    consultPrice: "Code + consultancy price ৳", category: "Category", cover: "Cover photo URL",
    downloadUrl: "Download link (private Drive/GitHub)", meet: "Meet/Zoom লিংক",
    updated: "আপডেট হয়েছে", confirmDelete: "মুছে ফেলবেন?", language: "English",
    account: "অ্যাকাউন্ট", changePassword: "পাসওয়ার্ড পরিবর্তন", currentPassword: "বর্তমান পাসওয়ার্ড",
    newPassword: "নতুন পাসওয়ার্ড", confirmPassword: "নতুন পাসওয়ার্ড আবার লিখুন",
    passwordChanged: "পাসওয়ার্ড পরিবর্তন হয়েছে",
    projectFallback: "প্রজেক্ট", optionCode: "কোড", optionConsult: "কোড + লাইভ", otherCategory: "অন্যান্য",
    notifications: "নোটিফিকেশন", noNotifications: "কোনো নোটিফিকেশন নেই", markRead: "সব পড়া হয়েছে",
    broadcast: "সব ইউজারকে বার্তা", notificationTitle: "শিরোনাম", notificationMessage: "বার্তা",
    sendNotification: "বার্তা পাঠান", sent: "বার্তা পাঠানো হয়েছে",
    livePreview: "লাইভ প্রিভিউ", previewUrl: "Deployed demo URL (source code নয়)",
    seller: "Seller", sellerDashboard: "Seller dashboard", applySeller: "Seller হতে আবেদন",
    university: "University", universityId: "University ID", department: "Department", institutionEmail: "University email", sellerProfile: "Seller profile", commission: "Commission", applicationReason: "কেন project sell করতে চান?",
    apply: "আবেদন করুন", applicationSent: "Application জমা হয়েছে", sellerProjects: "আপনার প্রজেক্ট",
    payout: "Payout", requestPayout: "Payout request", availablePayout: "Available payout",
    sellerApplications: "Seller applications", approve: "Approve", reject: "Reject",
    payoutRequests: "Payout requests", markPaid: "Mark paid",
    referralLink: "আপনার referral link", referralEarn: "Referral commission",
    overview: "ওভারভিউ", pendingOrders: "অপেক্ষমান অর্ডার", allOrders: "সব অর্ডার", refresh: "রিফ্রেশ", searchProjects: "প্রজেক্ট খুঁজুন",
    terms: "Terms & Conditions", termsAccept: "আমি Terms & Conditions এবং Privacy Policy মেনে নিচ্ছি",
    termsRequired: "অ্যাকাউন্ট খুলতে Terms & Conditions গ্রহণ করুন",
    policyIntro: "এই নীতিমালা Project Lagbe প্ল্যাটফর্মের ব্যবহার, কেনাবেচা ও নিরাপত্তা নিয়ন্ত্রণ করে।",
    buyerTerms: "Buyer-এর দায়িত্ব", sellerTerms: "Seller-এর দায়িত্ব", prohibited: "নিষিদ্ধ কার্যক্রম",
    refunds: "Payment, refund ও dispute", privacy: "Privacy ও data protection", ip: "Copyright ও intellectual property",
    enforcement: "লঙ্ঘন হলে ব্যবস্থা", legal: "প্রযোজ্য আইন ও jurisdiction",
  },
  en: {
    projects: "Projects", orders: "My orders", loginRegister: "Login / Register",
    logout: "Logout", admin: "Admin", hero: "Need a CSE Lab project?",
    sub: "Get ready source code with optional live explanation.", search: "Search",
    searchPlaceholder: "Search projects, courses or tech stacks…", allCategories: "All categories",
    loading: "Loading…", notFound: "No projects found.", code: "Code only",
    consult: "Code + live consultation", orderSent: "Order submitted. Please wait for approval.",
    sourceCode: "Source code only", cancel: "Cancel", order: "Place order", submitting: "Submitting…",
    transaction: "Transaction ID", note: "Note (optional)", sessionNote: "When would you like the live session? (time / WhatsApp)",
    register: "Register", login: "Login", name: "Name", email: "Email", password: "Password (6+ characters)",
    existing: "Already have an account", newAccount: "Create an account", myOrders: "My orders",
    noOrders: "No orders yet.", viewProjects: "Browse projects", project: "Project",
    type: "Type", status: "Status", access: "Access", download: "Download",
    liveLink: "Live session link", pending: "Pending", approved: "Approved", rejected: "Rejected",
    manageOrders: "Orders", pendingCount: "pending", newProject: "New project",
    add: "Add project", update: "Update", edit: "Edit", cancelEdit: "Cancel edit", projectList: "Project list", delete: "Delete", payment: "Payment",
    user: "User", action: "Action", title: "Title", course: "Course (e.g. Networks Lab)",
    tech: "Tech stack", description: "Description", codePrice: "Code price ৳",
    consultPrice: "Code + consultancy price ৳", category: "Category", cover: "Cover photo URL",
    downloadUrl: "Download link (private Drive/GitHub)", meet: "Meet/Zoom link",
    updated: "Updated", confirmDelete: "Delete this project?", language: "বাংলা",
    account: "Account", changePassword: "Change password", currentPassword: "Current password",
    newPassword: "New password", confirmPassword: "Confirm new password",
    passwordChanged: "Password changed successfully",
    projectFallback: "Project", optionCode: "Code", optionConsult: "Code + live", otherCategory: "Other",
    notifications: "Notifications", noNotifications: "No notifications", markRead: "Mark all as read",
    broadcast: "Message all users", notificationTitle: "Title", notificationMessage: "Message",
    sendNotification: "Send notification", sent: "Notification sent",
    livePreview: "Live preview", previewUrl: "Deployed demo URL (not source code)",
    seller: "Seller", sellerDashboard: "Seller dashboard", applySeller: "Apply to become a seller",
    university: "University", universityId: "University ID", department: "Department", institutionEmail: "Institutional email", sellerProfile: "Seller profile", commission: "Commission", applicationReason: "Why do you want to sell projects?",
    apply: "Apply", applicationSent: "Application submitted", sellerProjects: "Your projects",
    payout: "Payout", requestPayout: "Request payout", availablePayout: "Available payout",
    sellerApplications: "Seller applications", approve: "Approve", reject: "Reject",
    payoutRequests: "Payout requests", markPaid: "Mark paid",
    referralLink: "Your referral link", referralEarn: "Referral commission",
    overview: "Overview", pendingOrders: "Pending orders", allOrders: "All orders", refresh: "Refresh", searchProjects: "Search projects",
    terms: "Terms & Conditions", termsAccept: "I agree to the Terms & Conditions and Privacy Policy",
    termsRequired: "Accept the Terms & Conditions to create an account",
    policyIntro: "These policies govern use, transactions, content, and safety on Project Lagbe.",
    buyerTerms: "Buyer responsibilities", sellerTerms: "Seller responsibilities", prohibited: "Prohibited activities",
    refunds: "Payments, refunds and disputes", privacy: "Privacy and data protection", ip: "Copyright and intellectual property",
    enforcement: "Enforcement", legal: "Applicable law and jurisdiction",
  },
};
export function AppProvider({ children }) {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("u") || "null"),
  );
  const [toast, setToast] = useState("");
  const [cfg, setCfg] = useState({});
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "bn");
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
  const toggleLanguage = useCallback(() => {
    setLang((current) => {
      const next = current === "bn" ? "en" : "bn";
      localStorage.setItem("lang", next);
      return next;
    });
  }, []);
  const t = useCallback((key) => translations[lang][key] || key, [lang]);
  const v = useMemo(
    () => ({ user, login, logout, notify, cfg, lang, t, toggleLanguage }),
    [user, login, logout, notify, cfg, lang, t, toggleLanguage],
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
