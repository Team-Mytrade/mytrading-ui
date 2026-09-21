import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { navItems } from "../../layout/AppSidebar";
import type { DashboardEntry } from "./dashboardRegistry";

type LeafPage = { name: string; path: string };

const flattenPages = (items: typeof navItems): LeafPage[] =>
  items.flatMap((item) => {
    if (!item.subItems) return item.path ? [{ name: item.name, path: item.path }] : [];
    return item.subItems.flatMap((sub) => {
      if (sub.subItems) return sub.subItems.map((leaf) => ({ name: leaf.name, path: leaf.path }));
      return sub.path ? [{ name: sub.name, path: sub.path }] : [];
    });
  });

const moduleLabel = (key: string) => navItems.find((item) => item.name === key)?.name ?? key;

export default function ModuleSnapshot({ module }: { module: DashboardEntry }) {
  const pages = flattenPages(navItems.filter((item) => item.name === module.key));
  const Icon = module.icon;
  return (
    <section className="cc-snap">
      <header className="cc-snap__head">
        <span className={`cc-snap__icon cc-snap__icon--${module.tone}`}><Icon size={18} /></span>
        <div><p>Module overview</p><h2>{moduleLabel(module.key)}</h2><small>{module.description}</small></div>
        <span className="cc-snap__badge">{pages.length} sections</span>
      </header>
      <div className="cc-snap__grid">
        {pages.map((page, index) => (
          <Link key={page.path} to={page.path} className={`cc-snap__card cc-snap__card--t${index % 6}`}>
            <span className="cc-snap__card-name">{page.name}</span>
            <span className="cc-snap__card-open">Open</span>
            <ArrowUpRight size={14} className="cc-snap__card-arrow" />
          </Link>
        ))}
      </div>
    </section>
  );
}