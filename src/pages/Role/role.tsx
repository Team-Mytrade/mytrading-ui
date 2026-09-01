import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Crown,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import "./role.css";

type RoleKey = "superAdmin" | "tenantAdmin" | "manager" | "user";

type Role = {
  key: RoleKey;
  title: string;
  description: string;
  icon: typeof Crown;
  color: string;
  members: number;
  access: string;
};

const roles: Role[] = [
  { key: "superAdmin", title: "Super Admin", description: "Owns the organisation and controls all tenants, modules and policies.", icon: Crown, color: "violet", members: 1, access: "All tenants & modules" },
  { key: "tenantAdmin", title: "Tenant Admin", description: "Administers one tenant, its users, modules and role assignments.", icon: Building2, color: "blue", members: 4, access: "One tenant · all enabled modules" },
  { key: "manager", title: "Module Manager", description: "Leads a single module or a selected group of modules, such as CRM.", icon: UserCog, color: "amber", members: 12, access: "One or more modules" },
  { key: "user", title: "Module User", description: "Works in the module or modules assigned by their manager or tenant admin.", icon: Users, color: "emerald", members: 86, access: "One or more modules" },
];

const modules = ["CRM", "Sales", "Inventory", "Purchase", "Attendance", "Payroll"];

const recentAssignments = [
  { initials: "AS", name: "Aarav Shah", role: "CRM Manager", modules: ["CRM"], tone: "purple" },
  { initials: "PM", name: "Priya Menon", role: "Operations Manager", modules: ["Purchase", "Inventory"], tone: "blue" },
  { initials: "RK", name: "Rahul Kumar", role: "Module User", modules: ["Sales", "CRM"], tone: "orange" },
];

const assignmentFlow: Record<RoleKey, { recipient: string; action: string; helper: string }> = {
  superAdmin: { recipient: "Tenant Admin", action: "Choose modules visible to this Tenant Admin", helper: "A Tenant Admin can only assign the modules enabled here." },
  tenantAdmin: { recipient: "Module Managers", action: "Assign available modules to one or more managers", helper: "More than one manager can manage the same module." },
  manager: { recipient: "Module Users", action: "Give assigned modules to module users", helper: "A user can receive one module or several modules from their manager." },
  user: { recipient: "Module User", action: "Review assigned modules", helper: "Users cannot grant access; they only use the modules assigned to them." },
};

/** Role configuration dashboard showing hierarchy and module-level access. */
export default function RoleConfiguration() {
  const [selectedRole, setSelectedRole] = useState<RoleKey>("manager");
  const [moduleScopes, setModuleScopes] = useState<Record<RoleKey, string[]>>({
    superAdmin: modules,
    tenantAdmin: ["CRM", "Sales", "Inventory", "Purchase"],
    manager: ["CRM", "Sales"],
    user: ["CRM"],
  });
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const activeRole = roles.find((role) => role.key === selectedRole)!;
  const displayedAssignments = useMemo(
    () => recentAssignments.filter((person) => person.name.toLowerCase().includes(query.toLowerCase()) || person.role.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  const flow = assignmentFlow[selectedRole];
  const moduleScope = moduleScopes[selectedRole];
  const availableModules = selectedRole === "superAdmin" ? modules : moduleScopes[roles[roles.findIndex((role) => role.key === selectedRole) - 1].key];
  const toggleModule = (module: string) => {
    setSaved(false);
    setModuleScopes((current) => ({ ...current, [selectedRole]: moduleScope.includes(module) ? moduleScope.filter((item) => item !== module) : [...moduleScope, module] }));
  };

  return (
    <main className="role-page">
      <section className="role-heading">
        <div>
          <p className="role-eyebrow"><ShieldCheck size={15} /> Access control</p>
          <h1>Role configuration</h1>
          <p>Control which modules pass from Super Admin to Tenant Admin, managers and their users.</p>
        </div>
        <button className="role-primary-button" type="button"><Plus size={18} /> Add role assignment</button>
      </section>

      <section className="role-hierarchy-card" aria-labelledby="hierarchy-title">
        <div className="role-section-title">
          <div><p className="role-eyebrow">Your access model</p><h2 id="hierarchy-title">Role hierarchy</h2></div>
          <span className="role-status"><Check size={14} /> 4 roles configured</span>
        </div>
        <div className="role-hierarchy">
          {roles.map((role, index) => {
            const Icon = role.icon;
            return (
              <div className="role-hierarchy-step" key={role.key}>
                <button className={`role-node ${selectedRole === role.key ? "is-selected" : ""}`} type="button" onClick={() => { setSelectedRole(role.key); setSaved(false); }}>
                  <span className={`role-icon role-icon--${role.color}`}><Icon size={20} /></span>
                  <span><strong>{role.title}</strong><small>{role.members} assigned</small></span>
                  <ChevronRight size={17} className="role-node-arrow" />
                </button>
                {index < roles.length - 1 && <span className="role-flow-arrow"><ArrowRight size={18} /></span>}
              </div>
            );
          })}
        </div>
        <div className="role-flow-note"><ShieldCheck size={17} /><span><b>Assignment flow:</b> Super Admin enables modules for a Tenant Admin. The Tenant Admin shares those modules with one or many managers, and each manager assigns their modules to users.</span></div>
      </section>

      <section className="role-content-grid">
        <article className="role-config-card">
          <div className="role-section-title">
            <div><p className="role-eyebrow">Module assignment</p><h2>{activeRole.title} → {flow.recipient}</h2></div>
            <span className={`role-access-badge role-access-badge--${activeRole.color}`}>{activeRole.access}</span>
          </div>
          <p className="role-description">{flow.helper}</p>
          <div className="role-config-line"><span>Role level</span><b>{roles.findIndex((role) => role.key === selectedRole) + 1} of 4</b></div>
          <div className="role-config-line"><span>Assigns access to</span><b>{flow.recipient}</b></div>
          <>
            <div className="role-module-heading"><LayoutGrid size={16} /><span>{flow.action}</span><small>{selectedRole === "user" ? "Read only" : "Select one or several"}</small></div>
            <div className="role-module-list">
              {availableModules.map((module) => <label className="role-module-option" key={module}><input type="checkbox" disabled={selectedRole === "user"} checked={moduleScope.includes(module)} onChange={() => toggleModule(module)} /><span>{module}</span></label>)}
            </div>
          </>
          {selectedRole !== "user" && <button className="role-save-button" type="button" onClick={() => setSaved(true)}>{saved ? <><Check size={17} /> Assignments saved</> : `Save ${flow.recipient} access`}</button>}
        </article>

        <article className="role-access-card">
          <div className="role-section-title"><div><p className="role-eyebrow">Coverage overview</p><h2>Module ownership</h2></div><button className="role-icon-button" type="button" aria-label="More options"><MoreHorizontal size={20} /></button></div>
          <div className="role-module-table">
            {modules.map((module, index) => <div className="role-module-row" key={module}><span className={`role-module-dot dot-${index}`} /><span>{module}</span><b>{index === 0 ? "3 managers" : index === 1 ? "2 managers" : "1 manager"}</b><ChevronRight size={16} /></div>)}
          </div>
          <button className="role-text-button" type="button">Manage module access <ArrowRight size={16} /></button>
        </article>
      </section>

      <section className="role-assignments-card">
        <div className="role-section-title role-assignment-heading"><div><p className="role-eyebrow">People & responsibilities</p><h2>Recent role assignments</h2></div><label className="role-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people or roles" /></label></div>
        <div className="role-assignment-list">
          {displayedAssignments.map((person) => <div className="role-assignment" key={person.name}><span className={`role-avatar avatar-${person.tone}`}>{person.initials}</span><div><strong>{person.name}</strong><small>{person.role}</small></div><div className="role-assignment-modules">{person.modules.map((module) => <span key={module}>{module}</span>)}</div><button type="button" className="role-icon-button" aria-label={`Edit ${person.name}`}><ChevronRight size={18} /></button></div>)}
          {!displayedAssignments.length && <p className="role-empty">No role assignments match your search.</p>}
        </div>
      </section>
    </main>
  );
}
