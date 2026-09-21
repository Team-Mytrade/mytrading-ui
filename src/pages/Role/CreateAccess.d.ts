declare const CreateAccess: import("react").ComponentType<{
  people: Array<{ id: string; name: string; role: string; modules: string[]; permissions?: Record<string, string[]> }>;
  candidates: string[];
  onSave: (assignment: { name: string; role: "Tenant Admin" | "Manager" | "User"; parent: string; modules: string[]; permissions: Record<string, string[]> }) => void;
}>;
export default CreateAccess;
