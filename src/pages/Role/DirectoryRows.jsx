import ReusableTable from "../../components/common/Table";
import "./DirectoryRows.css";

/** Shared table columns for local role assignments. */
const columns = [
  { key: "name", label: "User", sortable: true },
  { key: "role", label: "Role", sortable: true },
  { key: "parent", label: "Permission granted by", sortable: true },
  {
    key: "modules", label: "Modules",
    render: (person) => <span className="directory-rows__modules" title={person.modules.join(", ")}>{person.modules.join(", ")}</span>,
  },
  {
    key: "active", label: "Status", sortable: true,
    render: (person) => <span className={`role-presence ${person.active ? "is-online" : ""}`}>{person.active ? "Online" : "Offline"}</span>,
  },
];

/**
 * Render filtered role assignments using the shared table's viewport pagination.
 * @param {{people:Array<{id:string,name:string,role:string,parent:string,modules:string[],active:boolean}>}} props
 */
export default function DirectoryRows({ people }) {
  return <div className="directory-rows"><ReusableTable
    data={people}
    columns={columns}
    searchable={false}
    pageSize={Math.max(1, people.length)}
    enableRowDetails={false}
    emptyState={<p className="role-empty">No matching assignments.</p>}
  /></div>;
}
