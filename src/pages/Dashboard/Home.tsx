import { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, Box, BriefcaseBusiness, CircleDollarSign, ClipboardCheck, FileText, Package, ShoppingCart, Truck, Users, WalletCards } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { AuthContext } from "../../context/AuthContext";
import "./Home.css";

const metrics = [
  { label: "Sales this month", value: "$128,420", delta: "+12.5%", note: "vs. previous month", icon: CircleDollarSign, tone: "indigo" },
  { label: "Open opportunities", value: "42", delta: "+8", note: "added this week", icon: BriefcaseBusiness, tone: "violet" },
  { label: "Orders to fulfil", value: "27", delta: "6 urgent", note: "across 4 warehouses", icon: Package, tone: "amber" },
  { label: "Receivables due", value: "$24,860", delta: "14 invoices", note: "require follow-up", icon: WalletCards, tone: "rose" },
];
const pipeline = [
  { label: "New leads", value: "$48.2k", count: 18, percent: 28, tone: "blue" },
  { label: "Qualified", value: "$72.9k", count: 14, percent: 44, tone: "violet" },
  { label: "Proposal", value: "$61.4k", count: 9, percent: 65, tone: "orange" },
  { label: "Negotiation", value: "$39.8k", count: 6, percent: 82, tone: "green" },
];
const salesTrend = [48, 61, 55, 75, 68, 92, 86, 104, 96, 122, 112, 132];
const actions = [
  { title: "Approve purchase requisition", meta: "PR-1048 · Orion Supplies", amount: "$8,450", route: "/purchase-requisitions", priority: "High" },
  { title: "Follow up on proposal", meta: "Apex Industries · closes today", amount: "$12,800", route: "/opportunities", priority: "Today" },
  { title: "Resolve stock exception", meta: "Wireless Headset · WH-03", amount: "18 units", route: "/stock-level", priority: "Low stock" },
];
const modules = [
  { label: "CRM", description: "Leads, deals & customers", route: "/crm_dashboard", icon: Users, tone: "blue" },
  { label: "Sales", description: "Quotes, orders & targets", route: "/sales-dashboard", icon: ShoppingCart, tone: "green" },
  { label: "Inventory", description: "Stock & warehouse control", route: "/inventory", icon: Box, tone: "orange" },
  { label: "Purchase", description: "Requisitions & suppliers", route: "/purchase_dashboard", icon: ClipboardCheck, tone: "violet" },
  { label: "Delivery", description: "Shipments & dispatch", route: "/delivery_dashboard", icon: Truck, tone: "cyan" },
  { label: "Finance", description: "Invoices & receivables", route: "/financeReport", icon: FileText, tone: "rose" },
];

export default function Home() {
  const { user } = useContext(AuthContext);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  useEffect(() => {
    const updateCurrentTime = () => setCurrentTime(new Date());
    const intervalId = window.setInterval(updateCurrentTime, 60_000);
    window.addEventListener("focus", updateCurrentTime);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", updateCurrentTime);
    };
  }, []);

  const date = useMemo(() => new Intl.DateTimeFormat("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone,
  }).format(currentTime), [currentTime, timeZone]);
  const greeting = useMemo(() => {
    const hour = Number(new Intl.DateTimeFormat("en-US", {
      hour: "numeric", hourCycle: "h23", timeZone,
    }).format(currentTime));
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, [currentTime, timeZone]);

  return <>
    <PageMeta title="Command Center | CRM" description="Business and CRM command center" />
    <main className="crm-dashboard">
      <header className="crm-dashboard__header">
        <div><p className="crm-dashboard__date" title={`Timezone: ${timeZone}`}>{date}</p><h1>{greeting}, {user?.fullName || "Admin"}</h1><p className="crm-dashboard__intro">Your business is moving. Here’s the revenue, customer, and operations picture at a glance.</p></div>
        <div className="crm-dashboard__header-actions"><Link to="/leads" className="crm-dashboard__secondary-action">View leads</Link><Link to="/opportunities" className="crm-dashboard__primary-action">Manage pipeline <ArrowRight size={16} /></Link></div>
      </header>

      <section className="crm-dashboard__metric-grid" aria-label="Business performance summary">
        {metrics.map(({ label, value, delta, note, icon: Icon, tone }) => <article className={`crm-dashboard__metric crm-dashboard__metric--${tone}`} key={label}><div className="crm-dashboard__metric-top"><span className="crm-dashboard__metric-icon"><Icon size={19} /></span><b>{delta}</b></div><strong>{value}</strong><p>{label}</p><small>{note}</small></article>)}
      </section>

      <section className="crm-dashboard__main-grid">
        <article className="crm-dashboard__card crm-dashboard__revenue-card"><div className="crm-dashboard__card-heading"><div><p className="crm-dashboard__eyebrow">Revenue performance</p><h2>$128,420 <span>+12.5%</span></h2><p>Monthly sales compared with last month</p></div><Link to="/sales-dashboard">Sales report <ArrowRight size={14} /></Link></div><div className="crm-dashboard__chart" aria-label="Monthly sales trend">{salesTrend.map((value, index) => <i key={index} style={{ height: `${value / 1.32}%` }} />)}</div><div className="crm-dashboard__chart-labels"><span>Jan</span><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span><span>Dec</span></div></article>
        <article className="crm-dashboard__card crm-dashboard__health-card"><div className="crm-dashboard__card-heading"><div><p className="crm-dashboard__eyebrow">Business health</p><h2>On track</h2></div><BarChart3 size={20} /></div><div className="crm-dashboard__health-score"><strong>82</strong><span>Health score</span></div><div className="crm-dashboard__health-list"><p><span>Sales conversion</span><b>74%</b></p><p><span>On-time delivery</span><b>96%</b></p><p><span>Invoice collection</span><b>88%</b></p></div></article>
      </section>

      <section className="crm-dashboard__section"><div className="crm-dashboard__section-heading"><div><p className="crm-dashboard__eyebrow">CRM focus</p><h2>Sales pipeline</h2></div><Link to="/opportunities">Open opportunities <ArrowRight size={15} /></Link></div><div className="crm-dashboard__pipeline">{pipeline.map((stage) => <Link to="/opportunities" className={`crm-dashboard__pipeline-stage crm-dashboard__pipeline-stage--${stage.tone}`} key={stage.label}><span>{stage.label}</span><strong>{stage.value}</strong><small>{stage.count} opportunities</small><i><b style={{ width: `${stage.percent}%` }} /></i></Link>)}</div></section>

      <section className="crm-dashboard__lower-grid"><article className="crm-dashboard__card crm-dashboard__action-card"><div className="crm-dashboard__section-heading"><div><p className="crm-dashboard__eyebrow">Priority queue</p><h2>Needs your attention</h2></div><Link to="/activities">View all</Link></div><div className="crm-dashboard__action-list">{actions.map((action) => <Link to={action.route} className="crm-dashboard__action" key={action.title}><span className={`crm-dashboard__priority crm-dashboard__priority--${action.priority.toLowerCase().replace(" ", "-")}`}>{action.priority}</span><div><strong>{action.title}</strong><p>{action.meta}</p></div><b>{action.amount}</b><ArrowRight size={16} /></Link>)}</div></article><article className="crm-dashboard__card crm-dashboard__operations-card"><div><p className="crm-dashboard__eyebrow">Operations snapshot</p><h2>Today’s fulfillment</h2></div><div className="crm-dashboard__operation-numbers"><div><strong>18</strong><span>Orders packed</span></div><div><strong>12</strong><span>Out for delivery</span></div><div><strong>4</strong><span>Awaiting pickup</span></div></div><Link to="/delivery_dashboard">Go to delivery dashboard <ArrowRight size={15} /></Link></article></section>

      <section className="crm-dashboard__section crm-dashboard__module-section"><div className="crm-dashboard__section-heading"><div><p className="crm-dashboard__eyebrow">Workspace</p><h2>Jump into a module</h2></div></div><div className="crm-dashboard__module-grid">{modules.map(({ label, description, route, icon: Icon, tone }) => <Link to={route} className={`crm-dashboard__module crm-dashboard__module--${tone}`} key={label}><span><Icon size={20} /></span><div><strong>{label}</strong><p>{description}</p></div><ArrowRight size={16} /></Link>)}</div></section>
    </main>
  </>;
}
