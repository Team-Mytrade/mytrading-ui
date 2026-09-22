import { useEffect, useState } from "react";
import { X } from "lucide-react";
import "./RoleAssignmentModal.css";

const roles = ["Tenant Admin", "Admin", "Manager", "User"];

/**
 * Edit the presentation-level fields for one access assignment.
 * @param {{assignment:{id:string,name:string,role:string,parent:string,modules:string[]}|null,people:Array<{id:string,name:string}>,onClose:Function,onSave:Function}} props
 */
export default function RoleAssignmentModal({ assignment, people, onClose, onSave }) {
  const [draft, setDraft] = useState(null);
  useEffect(() => setDraft(assignment ? { ...assignment, modules: assignment.modules.join(", ") } : null), [assignment]);
  if (!assignment || !draft) return null;
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const save = (event) => {
    event.preventDefault();
    const modules = draft.modules.split(",").map((module) => module.trim()).filter(Boolean);
    onSave({ ...assignment, role: draft.role, parent: draft.parent, modules });
  };
  return <div className="role-assignment-modal" role="dialog" aria-modal="true" aria-labelledby="role-assignment-modal-title">
    <button className="role-assignment-modal__backdrop" aria-label="Close edit assignment" onClick={onClose} />
    <form className="role-assignment-modal__panel" onSubmit={save}>
      <header><div><p>Access assignment</p><h2 id="role-assignment-modal-title">Edit {assignment.name}</h2></div><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
      <label>Role<select value={draft.role} onChange={(event) => update("role", event.target.value)}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
      <label>Permission granted by<select value={draft.parent} onChange={(event) => update("parent", event.target.value)}>{people.filter((person) => person.id !== assignment.id).map((person) => <option key={person.id}>{person.name}</option>)}</select></label>
      <label>Modules<span>Separate modules with commas.</span><input value={draft.modules} onChange={(event) => update("modules", event.target.value)} required /></label>
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit">Save changes</button></footer>
    </form>
  </div>;
}
