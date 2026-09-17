import { useMemo, useState } from "react";
import { Activity, Building2, Check, Crown, Plus, Search, ShieldCheck, UserCog, Users } from "lucide-react";
import "./role.css";
import CreateAccess from "./CreateAccess";
import DirectoryRows from "./DirectoryRows";

type Role = "Tenant Admin" | "Manager" | "User";
type Person = { id: string; name: string; email: string; role: "Super Admin" | Role; parent: string; modules: string[]; permissions?: Record<string, string[]>; active: boolean };
const modules = ["CRM", "Sales", "Inventory", "Purchase", "Invoice", "Delivery", "HRMS", "Attendance"];
const peopleSeed: Person[] = [
  { id: "sa", name: "System Admin", email: "super@admin.com", role: "Super Admin", parent: "Organisation", modules, active: true },
  { id: "ta1", name: "Priya Menon", email: "priya@acme.com", role: "Tenant Admin", parent: "System Admin", modules: ["CRM", "Sales", "Inventory", "Purchase", "Invoice"], active: true },
  { id: "ta2", name: "Dev Shah", email: "dev@acme.com", role: "Tenant Admin", parent: "System Admin", modules: ["CRM", "HRMS", "Attendance"], active: false },
  { id: "m1", name: "Aarav Shah", email: "aarav@acme.com", role: "Manager", parent: "Priya Menon", modules: ["CRM"], active: true },
  { id: "m2", name: "Nila Joseph", email: "nila@acme.com", role: "Manager", parent: "Priya Menon", modules: ["Sales", "Inventory"], active: true },
  { id: "u1", name: "Rahul Kumar", email: "rahul@acme.com", role: "User", parent: "Aarav Shah", modules: ["CRM"], active: true },
];
const candidates = ["Ananya Iyer", "Karthik Raman", "Meera Nair", "Vikram Rao"];

/** Sample-data role hierarchy. Replace the seed data and save action with the access-control API when available. */
export default function RoleConfiguration() {
  const [tab, setTab] = useState<"dashboard" | "create" | "directory">("dashboard");
  const [people, setPeople] = useState(peopleSeed);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const counts = useMemo(() => ({ admins: people.filter((p) => p.role === "Tenant Admin").length, managers: people.filter((p) => p.role === "Manager").length, users: people.filter((p) => p.role === "User").length, online: people.filter((p) => p.active).length }), [people]);
  const shown = people.filter((p) => p.role !== "Super Admin" && (filter === "All" || p.role === filter) && `${p.name} ${p.email} ${p.modules}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="role-page role-workspace">
    <header className="role-heading"><p className="role-eyebrow"><ShieldCheck size={15} /> Access control</p></header>
    <nav className="role-tabs"><button className={tab === "dashboard" ? "is-active" : ""} onClick={() => setTab("dashboard")}>Dashboard</button><button className={tab === "create" ? "is-active" : ""} onClick={() => setTab("create")}>Create access</button><button className={tab === "directory" ? "is-active" : ""} onClick={() => setTab("directory")}>Directory</button></nav>
    {tab === "dashboard" && <><section className="role-stat-grid">{([["Tenant Admins", counts.admins, Building2, "blue"], ["Managers", counts.managers, UserCog, "amber"], ["Module Users", counts.users, Users, "emerald"], ["Online now", counts.online, Activity, "violet"]] as const).map(([label, value, Icon, tone]) => <article className="role-stat" key={label as string}><span className={`role-icon role-icon--${tone}`}><Icon size={20} /></span><div><small>{label as string}</small><strong>{value as number}</strong></div></article>)}</section><section className="role-hierarchy-card"><div className="role-section-title"><div><p className="role-eyebrow">Delegated authority</p><h2>Access hierarchy</h2></div><span className="role-status"><Check size={14} /> Controlled inheritance</span></div><div className="role-hierarchy">{([["Super Admin", Crown, "violet"], ["Tenant Admin", Building2, "blue"], ["Module Manager", UserCog, "amber"], ["Module User", Users, "emerald"]] as const).map(([label, Icon, tone], index) => <div className="role-hierarchy-step" key={label as string}><div className="role-node"><span className={`role-icon role-icon--${tone}`}><Icon size={20} /></span><span><strong>{label as string}</strong><small>{index === 0 ? "All tenants and modules" : "Only parent-approved modules"}</small></span></div>{index < 3 && <span className="role-flow-arrow">→</span>}</div>)}</div><p className="role-flow-note"><ShieldCheck size={17} /> Removing a parent’s module access also removes it from child assignments.</p></section></>}
    {tab === "create" && <CreateAccess people={people} candidates={candidates} onSave={(assignment) => setPeople((current) => [...current, { ...assignment, id: String(Date.now()), email: `${assignment.name.toLowerCase().replace(/\s+/g, ".")}@acme.com`, active: true }])} />}
    {tab === "directory" && <section><div className="role-directory-head"><div><p className="role-eyebrow">All assignments</p></div><label className="role-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people or modules" /></label><select className="role-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>{["All", "Tenant Admin", "Manager", "User"].map((item) => <option key={item}>{item}</option>)}</select></div><DirectoryRows key={`${query}-${filter}`} people={shown} /></section>}
  </main>;
}
