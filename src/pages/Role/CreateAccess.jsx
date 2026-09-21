import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { navItems } from "../../layout/AppSidebar";
import "./CreateAccess.css";

/** Flatten nested sidebar groups to assignable routes, retaining their labels. */
const pagesOf = (items) => items.flatMap((item) => item.subItems ? pagesOf(item.subItems) : item.path ? [{ name: item.name, path: item.path }] : []);

/**
 * @param {{people: Array<{id:string,name:string,role:string,modules:string[],permissions?:Record<string,string[]>}>, candidates:string[], onSave:Function}} props
 * onSave receives {name, role, parent, modules, permissions}; permissions maps module names to selected route paths.
 * Assignment data is local to the existing role page until its backend integration is available.
 */
export default function CreateAccess({ people, candidates, onSave }) {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [permissions, setPermissions] = useState({});
  const [active, setActive] = useState("");
  const [saved, setSaved] = useState(false);
  const parentRole = role === "Tenant Admin" ? "Super Admin" : role === "Manager" ? "Tenant Admin" : "Manager";
  const parents = people.filter((person) => person.role === parentRole);
  const parent = parents.find((person) => person.id === parentId);
  const available = navItems.map((item) => ({
    name: item.name,
    pages: pagesOf([item]),
  })).filter((item) => item.pages.length);
  const current = available.find((item) => item.name === active);
  const selectedModules = available.filter((item) => item.pages.some((page) => permissions[item.name]?.includes(page.path)));
  const chooseRole = (value) => {
    setActive(""); setRole(value); setName(""); setParentId(""); setPermissions({}); setSaved(false); setStep(1);
  };
  const toggleModule = (item, checked) => {
    setPermissions((previous) => ({ ...previous, [item.name]: checked ? item.pages.map((page) => page.path) : [] }));
  };
  const save = () => {
    if (!parent || !name || !selectedModules.length || saved) return;
    const selected = Object.fromEntries(selectedModules.map((item) => [item.name, permissions[item.name].filter((path) => item.pages.some((page) => page.path === path))]));
    onSave({ name, role, parent: parent.name, modules: Object.keys(selected), permissions: selected });
    setSaved(true);
  };
  return <section className={`access-wizard${step === 2 ? " access-wizard--permissions" : ""}`}>
    <ol className="access-wizard__steps" aria-label="Creation progress">{["Choose role", "Select user", "Module permissions"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}>{index + 1}. {label}</li>)}</ol>
    {step === 0 && <><h2>Which role would you like to assign?</h2><div className="access-wizard__roles">{["Tenant Admin", "Manager", "User"].map((value) => <button key={value} onClick={() => chooseRole(value)}>{value}</button>)}</div></>}
    {step === 1 && <><h2>Select a user for {role}</h2><div className="access-wizard__user-fields"><label>Select user<select value={name} onChange={(event) => setName(event.target.value)}><option value="">Select a user</option>{candidates.map((value) => <option key={value}>{value}</option>)}</select></label><label>Permission granted by ({parentRole})<select value={parentId} onChange={(event) => { setParentId(event.target.value); setPermissions({}); }}><option value="">Select {parentRole}</option>{parents.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div><footer><button onClick={() => setStep(0)}>Back</button><button disabled={!name || !parent} onClick={() => { setActive(""); setStep(2); }}>Next: permissions</button></footer></>}
    {step === 2 && <><div className="access-wizard__permission-heading"><h2>Module permissions</h2><p>{name} · {role} · Assigned by {parent?.name}</p></div><div className={`access-wizard__permissions${current ? "" : " access-wizard__permissions--modules-only"}`}><div className="access-wizard__modules" aria-label="Modules">{available.map((item) => {
      const count = permissions[item.name]?.length || 0;
      return <div key={item.name} className={current?.name === item.name ? "is-selected" : ""}>
        <label className="access-wizard__module-check"><input type="checkbox" checked={count === item.pages.length} ref={(node) => { if (node) node.indeterminate = count > 0 && count < item.pages.length; }} disabled={saved} onChange={(event) => toggleModule(item, event.target.checked)} /><span>{item.name}</span></label>
        <small>{count}/{item.pages.length}</small>
        <button type="button" className="access-wizard__module-arrow" aria-label={`${current?.name === item.name ? "Hide" : "Show"} ${item.name} submodules`} aria-expanded={current?.name === item.name} aria-controls={current?.name === item.name ? "access-submodules" : undefined} onClick={() => setActive((previous) => previous === item.name ? "" : item.name)}><ChevronRight size={16} /></button>
      </div>;
    })}</div>{current && <div className="access-wizard__submodules" id="access-submodules"><h3>{current?.name || "No available modules"}</h3>{current?.pages.map((page) => <label key={page.path}><input type="checkbox" disabled={saved} checked={(permissions[current.name] || []).includes(page.path)} onChange={(event) => { const checked = event.target.checked; setPermissions((previous) => ({ ...previous, [current.name]: checked ? [...(previous[current.name] || []), page.path] : (previous[current.name] || []).filter((path) => path !== page.path) })); }} />{page.name}{!<small>Not assigned by parent</small>}</label>)}</div>}</div><footer><button disabled={saved} onClick={() => setStep(1)}>Back</button><button disabled={saved || !selectedModules.length} onClick={save}>{saved ? "Permissions created" : "Create permissions"}</button></footer>{saved && <p role="status">Assignment created. You can view it in Directory.</p>}</>}
  </section>;
}
