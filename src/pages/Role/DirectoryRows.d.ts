declare const DirectoryRows: import("react").ComponentType<{
  people: Array<{ id: string; name: string; role: string; parent: string; modules: string[]; active: boolean }>;
}>;
export default DirectoryRows;
