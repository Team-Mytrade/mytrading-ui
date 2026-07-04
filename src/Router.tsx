import { BrowserRouter, Route, Routes } from "react-router-dom";
import SessionDraftRestorer from "./components/common/SessionDraftRestorer";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import Forget from "./pages/AuthPages/Forget";
import Contact from "./pages/AuthPages/Contact";
import Privacy from "./pages/AuthPages/Privacy";
import Terms from "./pages/AuthPages/Terms";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import MessageSection from "./pages/MessageSection";
import ResetPassword from "./components/UserProfile/ResetPassword";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import "react-toastify/dist/ReactToastify.css";
import CustomerManagement from "./pages/CRM/CustomerManager";
import Opportunities from "./pages/CRM/OpportunitiesPage";
import ContactPersonDetails from "./pages/CRM/ContactPersonDetails";
import CustomerSegmentDetails from "./pages/CRM/CustomerSegmentDetails";
import CommunicationHistoryPage from "./pages/CRM/CommunicationHistoryPage";
import TaskManager from "./pages/CRM/TaskManager";
import OrdersPage from "./pages/Sales/OrdersPage";
import QuotationsPage from "./pages/Sales/QuotationsPage";
import PriceListDiscountPage from "./pages/Sales/PriceListDiscountPage";
import SalespersonPage from "./pages/Sales/SalespersonPage";
import SalesTeamPage from "./pages/Sales/SalesTeamPage";
import PaymentTerms from "./pages/Sales/PaymentTerms";
import DeliverySchedulePage from "./pages/Sales/DeliverySchedulePage";
import InvoicesPage from "./pages/Sales/InvoicesPage";
import ProductManagement from "./pages/Sales/ProductManagement";
import SalesTargetPage from "./pages/Sales/SalesTargetPage";
import SalesReportPage from "./pages/Sales/SalesReportPage";
import ProductSKUManager from "./pages/Inventory/ProductSKUManager";
import WarehouseManager from "./pages/Inventory/WarehouseManager";
import StockLevelManager from "./pages/Inventory/StockLevelManager";
import QualityInspectionManager from "./pages/Inventory/QualityInspectionManager";
import TransactionsPage from "./pages/Inventory/TransactionsPage";
import ReorderLevelPage from "./pages/Inventory/ReorderLevelPage";
import StockAdjustmentPage from "./pages/Inventory/StockAdjustmentPage";
import PurchaseRequisitions from "./pages/Purchase/PurchaseRequisitions";
import RequisitionLineItems from "./pages/Purchase/RequisitionLineItems";
import PurchaseOrders from "./pages/Purchase/PurchaseOrders";
import Vendors from "./pages/Purchase/Vendors";
import Products from "./pages/Purchase/Products";
import ProductCategories from "./pages/Purchase/ProductCategories";
import TermsAndConditions from "./pages/Purchase/TermsAndConditions";
import Deliveries from "./pages/Purchase/Deliveries";
import ApprovalStatus from "./pages/Purchase/ApprovalStatus";
import GoodsReceiptNotes from "./pages/Purchase/GoodsReceiptNotes";
import Inventory from "./pages/Purchase/Inventory";
import PurchaseReports from "./pages/Purchase/PurchaseReports";
import DeliveryOrderPage from "./pages/Delivery/DeliveryOrderPage";
import TransporterPage from "./pages/Delivery/TransporterPage";
import VehiclePage from "./pages/Delivery/VehiclePage";
import RouteSchedulePage from "./pages/Delivery/RouteSchedulePage";
import ProductPage from "./pages/Delivery/ProductPage";
import DeliveryAddressPage from "./pages/Delivery/DeliveryAddressPage";
import DeliveryStatusPage from "./pages/Delivery/DeliveryStatusPage";
import InvoiceList from "./pages/Invoice/Billing/InvoiceList";
import InvoiceForm from "./pages/Invoice/Billing/InvoiceForm";
import InvoiceDetails from "./pages/Invoice/Billing/InvoiceDetails";
import PaymentReceiptList from "./pages/Invoice/Receipt/PaymentReceiptList";
import PaymentReceiptForm from "./pages/Invoice/Receipt/PaymentReceiptForm";
import PaymentReceiptDetails from "./pages/Invoice/Receipt/PaymentReceiptDetails";
import AccountsReceivableList from "./pages/Invoice/AccountReceivable/AccountsReceivableList";
import AccountsReceivableForm from "./pages/Invoice/AccountReceivable/AccountsReceivableForm";
import AccountsReceivableDetails from "./pages/Invoice/AccountReceivable/AccountsReceivableDetails";
import GeneralLedgerList from "./pages/Invoice/GeneralLedger/GeneralLedgerList";
import GeneralLedgerForm from "./pages/Invoice/GeneralLedger/GeneralLedgerForm";
import GeneralLedgerDetails from "./pages/Invoice/GeneralLedger/GeneralLedgerDetails";
import PurchaseInvoiceList from "./pages/Invoice/PurchaseInvoice/PurchaseInvoiceList";
import PurchaseInvoiceForm from "./pages/Invoice/PurchaseInvoice/PurchaseInvoiceForm";
import PurchaseInvoiceDetails from "./pages/Invoice/PurchaseInvoice/PurchaseInvoiceDetails";
import TaxRecordList from "./pages/Invoice/TaxRecord/TaxRecordList";
import TaxRecordForm from "./pages/Invoice/TaxRecord/TaxRecordForm";
import TaxRecordDetails from "./pages/Invoice/TaxRecord/TaxRecordDetails";
import ExpenseRevenueList from "./pages/Invoice/ExpenseRevenue/ExpenseRevenueList";
import ExpenseRevenueForm from "./pages/Invoice/ExpenseRevenue/ExpenseRevenueForm";
import ExpenseRevenueDetails from "./pages/Invoice/ExpenseRevenue/ExpenseRevenueDetails";
import CreditDebitNotesPage from "./pages/Invoice/CreditDebitNotesPage";
import TaxTypeList from "./pages/Invoice/TaxType/TaxTypeList";
import TaxTypeForm from "./pages/Invoice/TaxType/TaxTypeForm";
import TaxTypeDetails from "./pages/Invoice/TaxType/TaxTypeDetails";
import TaxDetailPage from "./pages/Invoice/TaxDetailPage";
import PaymentTermList from "./pages/Invoice/PaymentTerm/PaymentTermList";
import PaymentTermForm from "./pages/Invoice/PaymentTerm/PaymentTermForm";
import PaymentTermDetails from "./pages/Invoice/PaymentTerm/PaymentTermDetails";
import BenefitsAllowancesPage from "./pages/Payroll/BenefitsAllowancesPage";
import PayrollRunsPage from "./pages/Payroll/PayrollRunsPage";
import PayrollTaxDeductionsPage from "./pages/Payroll/PayrollTaxDeductionsPage";
import LeaveRequestsPage from "./pages/Payroll/LeaveRequestsPage";
import AttendanceLogsPage from "./pages/Payroll/AttendanceLogsPage";
import SalaryStructurePage from "./pages/Payroll/SalaryStructurePage";
import EmployeeRecordsPage from "./pages/Payroll/EmployeeRecordsPage";
import AddEmployeePage from "./pages/Payroll/addEmployeesPage";
import AttendanceManagementPage from "./pages/Payroll/AttendanceManagementPage";
import DocumentManagementPage from "./pages/Payroll/DocumentManagementPage";
import EmployeeSelfDashboard from "./pages/Payroll/EmployeeSelfDashboard";
import EmployeeViewPage from "./pages/Payroll/EmployeeViewPage";
import ExitManagementPage from "./pages/Payroll/ExitManagementPage";
import ItDeclarationPage from "./pages/Payroll/ItDeclarationPage";
import LeaveManagementPage from "./pages/Payroll/LeaveManagementPage";
import PerformanceManagementPage from "./pages/Payroll/PerformanceManagementPage";
import StatutoryCompliancesPage from "./pages/Payroll/StatutoryCompliancesPage";
import SalesSummary from "./pages/Dashboard/SalesSummary";
import Activities from "./pages/Dashboard/Activities";
import DashboardOverview from "./pages/Dashboard/DashboardOverview";
import KeyMetrics from "./pages/Dashboard/KeyMetrics";
import RecentInteractions from "./pages/Dashboard/RecentInteractions";
import LeadsPages from "./pages/Leads/LeadsPage";
import ContactPage from "./pages/Contacts/ContactsPage";
import AccountsPage from "./pages/Account/AccountsPage";
import OpportunitiesPage from "./pages/Deal/OpportunitiesPage";
import SalesPipeline from "./pages/Deal/SalesPipeline";
import StagesManagement from "./pages/Deal/StagesManagement";
import ForecastPage from "./pages/Deal/ForecastPage";
import WonLostAnalysis from "./pages/Deal/WonLostAnalysis";
import TaskPage from "./pages/TaskManagement/TaskPage";
import MeetingsPage from "./pages/TaskManagement/MeetingsPage";
import CallsPage from "./pages/TaskManagement/CallsPage";
import RemindersPage from "./pages/TaskManagement/RemindersPage";
import ActivityCalendar from "./pages/TaskManagement/ActivityCalendar";
import CampaignPage from "./pages/Marketing/CampaignPage";
import CampaignReports from "./pages/Marketing/CampaignReports";
import EmailMarketingPage from "./pages/Marketing/EmailMarketingPage";
import SegmentationManager from "./pages/Marketing/SegmentationManager";
import TemplatesManager from "./pages/Marketing/TemplatesManager";
import SMSCampaignPage from "./pages/Marketing/SMSCampaignPage";
import KnowledgeBase from "./pages/Support/KnowledgeBase";
import SLAManagement from "./pages/Support/SLAManagement";
import SupportReports from "./pages/Support/SupportReports";
import TicketSupport from "./pages/Support/TicketSupport";
import ActivityReports from "./pages/Reports/ActivityReports";
import CustomReports from "./pages/Reports/CustomReports";
import CustomerRetentionReport from "./pages/Reports/CustomerRetentionReport";
import LeadReports from "./pages/Reports/LeadReports";
import PerformanceReports from "./pages/Reports/PerformanceReports";
import SalesReports from "./pages/Reports/SalesReports";
import AutomationLogs from "./pages/Workflow/AutomationLogs";
import AutomationWorkflowRules from "./pages/Workflow/AutomationWorkflowRules";
import ScheduledActions from "./pages/Workflow/ScheduledActions";
import TriggerSettings from "./pages/Workflow/TriggerSettings";
import CustomFieldsManager from "./pages/Settings/CustomFieldsManager";
import EmailSmsSettings from "./pages/Settings/EmailSmsSettings";
import ImportExportPage from "./pages/Settings/ImportExportPage";
import IntegrationsPage from "./pages/Settings/IntegrationsPage";
import RolesPermissionsPage from "./pages/Settings/RolesPermissionsPage";
import Alert from "./pages/Notification/Alerts";
import UserPreferences from "./pages/Notification/UserPreferences";
import AuthLayout from "./pages/AuthPages/AuthPageLayout";
import CrmViewPage from "./pages/CRM/CrmViewPage";
import SalesCategoryPage from "./pages/Sales/SalesCategoryPage";
import SalesChannels from "./pages/Sales/SalesChannels";
import SalesOrderItemsPage from "./pages/Sales/SalesOrderPage";
import SalesCustomer from "./pages/Sales/SalesCustomers";
import SalesContactPersonDetails from "./pages/Sales/SalesContactPersonDetails";
import AttendanceRecordPage from "./pages/Attendance/AttendanceRecordPage";
import LeaveBalancePage from "./pages/Attendance/LeaveBalancePage";
import LeaveRequestPage from "./pages/Attendance/LeaveRequestPage";
import LeaveTypePage from "./pages/Attendance/LeaveTypePage";
import NotificationPage from "./pages/Attendance/NotificationPage";
import NotificationInboxPage from "./pages/Attendance/NotificationInboxPage";
import NotificationDetailPage from "./pages/Attendance/NotificationDetailPage";
import OvertimeRulePage from "./pages/Attendance/OvertimeRulePage";
import PayrollComponentPage from "./pages/Attendance/PayrollComponentPage";
import PayrollRecordPage from "./pages/Attendance/PayrollRecordPage";
import RemoteAttendanceLogPage from "./pages/Attendance/RemoteAttendanceLogPage";
import ShiftPage from "./pages/Attendance/ShiftPage";
import WorkFromHomeRequestPage from "./pages/Attendance/WorkFromHomeRequestPage";
import OverTimeEntryPage from "./pages/Attendance/OverTimeEntryPage";
import AttendanceViolationPage from "./pages/Attendance/AttendanceViolationPage";
import AttendanceApprovalPage from "./pages/Attendance/AttendanceApprovalRequestPage";
import ShiftSchedulePage from "./pages/Attendance/EmployeeShiftSchedulePage";
import PayrollPage from "./pages/Payroll/PayrollPage";
import EmployeeDocumentsPage from "./pages/Payroll/EmployeeDocumentsPage";
import SalesDashboardPage from "./pages/Sales/SalesDashboardPage";
import CrmDashboardPage from "./pages/CRM/CrmDashboardPage";
import InventoryDashboard from "./pages/Inventory/InventoryDashboard";
import ProcurementDashboard from "./pages/Purchase/ProcurementDashboard";
import DeliveryDashboard from "./pages/Delivery/DeliveryDashboard";
import FinanceDashboard from "./pages/Invoice/FinanceDashboard";
import PayrollDashboard from "./pages/Payroll/PayrollDashboard";
import AttendanceDashboard from "./pages/Attendance/AttendanceDashboard";
import UserDashboard from "./components/UserProfile/UserDashboard";
import AccountsPayableForm from "./pages/Invoice/AccountPayable/AccountPayableForm";
import AccountsPayableDetails from "./pages/Invoice/AccountPayable/AccountPayableDetails";
import AccountsPayableList from "./pages/Invoice/AccountPayable/AccountPayableList";
import Mainrole from "./pages/roleconfig/Mainrole";
import BatchManager from "./pages/Inventory/BatchManager";
import EmployeeCompensationPage from "./pages/Payroll/EmployeeCompensationPage";
import EmployeeDepartmentsPage from "./pages/Payroll/EmployeeDepartments";
import EmployeeSalaryPage from "./pages/Payroll/EmployeeSalaryPage";
import CustomerFormPage from "./pages/CRM/CustomerFormPage";
import ShipmentPage from "./pages/Delivery/Shipment";
import DeliveryDispatch from "./pages/Delivery/DeliveryNote";
// import DeliveryOrderPage from "./pages/Delivery/DeliveryOrderPage";
import CustomerAddressPage from "./pages/Delivery/CustomerAddress";
import DeliveryNote from "./pages/Delivery/DeliveryNote";
import GoodsIssuePage from "./pages/Delivery/GoodsIssue";
import Schedule from "./pages/Delivery/Schedule";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <SessionDraftRestorer />
      <Routes>
        <Route path="/auth" element={<AuthLayout children={undefined} />}>
          <Route path="signin" element={<SignIn />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="forgetpassword" element={<Forget />} />
          <Route path="contactus" element={<Contact />} />
          <Route path="privacypolicy" element={<Privacy />} />
          <Route path="termsandconditions" element={<Terms />} />
        </Route>

        <Route element={<AppLayout />}>
          <Route index element={<Home />} />

          <Route path="/customer-management" element={<CustomerManagement />} />
          <Route path="/customer-management/:id" element={<CustomerManagement />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/contactPerson" element={<ContactPersonDetails />} />
          <Route path="/customer-segment" element={<CustomerSegmentDetails />} />
          <Route path="/customer-segment/:id" element={<CustomerSegmentDetails />} />
          <Route path="/communication-history" element={<CommunicationHistoryPage />} />
          <Route path="/task" element={<TaskManager />} />
          <Route path="/crm-view/:requestFrom/:id" element={<CrmViewPage />} />
          <Route path="/crm_dashboard" element={<CrmDashboardPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/edit/:id" element={<CustomerFormPage />} />

          <Route path="/role_config" element={<Mainrole />} />

          <Route path="/ordersPage" element={<OrdersPage />} />
          <Route path="/quotationsPage" element={<QuotationsPage />} />
          <Route path="/quote-view/:id" element={<QuotationsPage />} />
          <Route path="/priceList" element={<PriceListDiscountPage />} />
          <Route path="/sales-person" element={<SalespersonPage />} />
          <Route path="/sales-team" element={<SalesTeamPage />} />
          <Route path="/payment-term" element={<PaymentTerms />} />
          <Route path="/delivery-schedule" element={<DeliverySchedulePage />} />
          <Route path="/invoicesPage" element={<InvoicesPage />} />
          <Route path="/products" element={<ProductManagement />} />
          <Route path="/salesTargetPage" element={<SalesTargetPage />} />
          <Route path="/salesReportPage" element={<SalesReportPage />} />
          <Route path="/sales-categories" element={<SalesCategoryPage />} />
          <Route path="/sales-channels" element={<SalesChannels />} />
          <Route path="/sales-order-items" element={<SalesOrderItemsPage />} />
          <Route path="/sales-customer" element={<SalesCustomer />} />
          <Route path="/sales-contact-persons" element={<SalesContactPersonDetails />} />
          <Route path="/sales_dashboard" element={<SalesDashboardPage />} />
          <Route path="/slaes_dashborad" element={<SalesDashboardPage />} />

          <Route path="/product-sku" element={<ProductSKUManager />} />
          <Route path="/warehouse" element={<WarehouseManager />} />
          <Route path="/stock-level" element={<StockLevelManager />} />
          <Route path="/qualityInspection" element={<QualityInspectionManager />} />
          <Route path="/batchSerial" element={<BatchManager />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/reorderLevel" element={<ReorderLevelPage />} />
          <Route path="/stockAdjustment" element={<StockAdjustmentPage />} />
          <Route path="/inventory_dashboard" element={<InventoryDashboard />} />

          <Route path="/purchase-requisitions" element={<PurchaseRequisitions />} />
          <Route path="/requisition-line-items" element={<RequisitionLineItems />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/purchase-products" element={<Products />} />
          <Route path="/product-categories" element={<ProductCategories />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/approvalStatus" element={<ApprovalStatus />} />
          <Route path="/approval-status" element={<ApprovalStatus />} />
          <Route path="/goods-receipt-notes" element={<GoodsReceiptNotes />} />
          <Route path="/purchase-inventory" element={<Inventory />} />
          <Route path="/purchase-reports" element={<PurchaseReports />} />
          <Route path="/purchase_dashboard" element={<ProcurementDashboard />} />

          <Route path="/purchaseRequisition" element={<PurchaseRequisitions />} />
          <Route path="/purchaseOrder" element={<PurchaseOrders />} />
          <Route path="/supplier" element={<Vendors />} />
          <Route path="/product" element={<Products />} />
          <Route path="/term-condition" element={<TermsAndConditions />} />
          <Route path="/deliveryDate" element={<Deliveries />} />
          <Route path="/goodseceiptNote" element={<GoodsReceiptNotes />} />

          <Route path="/deliveryOrder" element={<DeliveryOrderPage />} />
          <Route path="/transporter" element={<TransporterPage />} />
          <Route path="/vechile" element={<VehiclePage />} />
          <Route path="/shipment" element={<ShipmentPage />} />
          <Route path="/delivery-note" element={<DeliveryNote />} />
          <Route path="/customerAddress" element={<CustomerAddressPage />} />
        
          {/* <Route path="/vehicle" element={<VehiclePage />} /> */}
          <Route path="/route" element={<RouteSchedulePage />} />
          <Route path="/productDelivery" element={<ProductPage />} />
          <Route path="/deliveryAddress" element={<DeliveryAddressPage />} />
          <Route path="/deliveryStatus" element={<DeliveryStatusPage />} />
          <Route path="/delivery_dashboard" element={<DeliveryDashboard />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/goodsIssue" element={<GoodsIssuePage />} />

          <Route path="/invoice-billing" element={<InvoiceList />} />
          <Route path="/invoice-billing/add" element={<InvoiceForm />} />
          <Route path="/invoice-billing/edit/:id" element={<InvoiceForm />} />
          <Route path="/invoice-billing/view/:id" element={<InvoiceDetails />} />
          <Route path="/payment-receipt" element={<PaymentReceiptList />} />
          <Route path="/payment-receipt/add" element={<PaymentReceiptForm />} />
          <Route path="/payment-receipt/edit/:id" element={<PaymentReceiptForm />} />
          <Route path="/payment-receipt/view/:id" element={<PaymentReceiptDetails />} />
          <Route path="/account-receivable" element={<AccountsReceivableList />} />
          <Route path="/account-receivable/add" element={<AccountsReceivableForm />} />
          <Route path="/account-receivable/edit/:id" element={<AccountsReceivableForm />} />
          <Route path="/account-receivable/view/:id" element={<AccountsReceivableDetails />} />
          <Route path="/accounts-payable" element={<AccountsPayableList />} />
          <Route path="/accounts-payable/add" element={<AccountsPayableForm />} />
          <Route path="/accounts-payable/edit/:id" element={<AccountsPayableForm />} />
          <Route path="/accounts-payable/view/:id" element={<AccountsPayableDetails />} />
          <Route path="/generalLedger" element={<GeneralLedgerList />} />
          <Route path="/generalLedger/add" element={<GeneralLedgerForm />} />
          <Route path="/generalLedger/edit/:id" element={<GeneralLedgerForm />} />
          <Route path="/generalLedger/view/:id" element={<GeneralLedgerDetails />} />
          <Route path="/taxTypes" element={<TaxTypeList />} />
          <Route path="/taxTypes/add" element={<TaxTypeForm />} />
          <Route path="/taxTypes/edit/:id" element={<TaxTypeForm />} />
          <Route path="/taxTypes/view/:id" element={<TaxTypeDetails />} />
          <Route path="/taxDetails" element={<TaxDetailPage />} />
          <Route path="/taxRecords" element={<TaxRecordList />} />
          <Route path="/taxRecords/add" element={<TaxRecordForm />} />
          <Route path="/taxRecords/edit/:id" element={<TaxRecordForm />} />
          <Route path="/taxRecords/view/:id" element={<TaxRecordDetails />} />
          <Route path="/expense-revenue" element={<ExpenseRevenueList />} />
          <Route path="/expense-revenue/add" element={<ExpenseRevenueForm />} />
          <Route path="/expense-revenue/edit/:id" element={<ExpenseRevenueForm />} />
          <Route path="/expense-revenue/view/:id" element={<ExpenseRevenueDetails />} />
          <Route path="/credit-debit-notes" element={<CreditDebitNotesPage />} />
          <Route path="/payment-terms" element={<PaymentTermList />} />
          <Route path="/payment-terms/add" element={<PaymentTermForm />} />
          <Route path="/payment-terms/edit/:id" element={<PaymentTermForm />} />
          <Route path="/payment-terms/view/:id" element={<PaymentTermDetails />} />
          <Route path="/payment-invoice" element={<PurchaseInvoiceList />} />
          <Route path="/payment-invoice/add" element={<PurchaseInvoiceForm />} />
          <Route path="/payment-invoice/edit/:id" element={<PurchaseInvoiceForm />} />
          <Route path="/payment-invoice/view/:id" element={<PurchaseInvoiceDetails />} />
          <Route path="/invoice_dashboard" element={<FinanceDashboard />} />

          <Route path="/employeeRecords" element={<EmployeeRecordsPage />} />
          <Route path="/addEmployee" element={<AddEmployeePage />} />
          <Route path="/employee-view/:id" element={<EmployeeViewPage />} />
          <Route path="/employee-self-dashboard" element={<EmployeeSelfDashboard />} />
          <Route path="/employeeSalary" element={<EmployeeSalaryPage />} />
          <Route path="/employeeCompensation" element={<EmployeeCompensationPage />} />
          <Route path="/employeeDepartments" element={<EmployeeDepartmentsPage />} />
          <Route path="/employeePayroll" element={<PayrollPage />} />
          <Route path="/salaryStructure" element={<SalaryStructurePage />} />
          <Route path="/attendance-management" element={<AttendanceManagementPage />} />
          <Route path="/attendanceLogs" element={<AttendanceLogsPage />} />
          <Route path="/leave-management" element={<LeaveManagementPage />} />
          <Route path="/leaveRequests" element={<LeaveRequestsPage />} />
          <Route path="/it-declaration" element={<ItDeclarationPage />} />
          <Route path="/taxDeductions" element={<PayrollTaxDeductionsPage />} />
          <Route path="/payrollRuns" element={<PayrollRunsPage />} />
          <Route path="/benefits" element={<BenefitsAllowancesPage />} />
          <Route path="/document-management" element={<DocumentManagementPage />} />
          <Route path="/employeeDocuments" element={<EmployeeDocumentsPage />} />
          <Route path="/employee-documents" element={<EmployeeDocumentsPage />} />
          <Route path="/performance-management" element={<PerformanceManagementPage />} />
          <Route path="/exit-management" element={<ExitManagementPage />} />
          <Route path="/statutoryCompliances" element={<StatutoryCompliancesPage />} />
          <Route path="/employees/:employeeId/documents" element={<EmployeeDocumentsPage />} />
          <Route path="/payroll_dashboard" element={<PayrollDashboard />} />

          <Route path="/att_attendanceApproval" element={<AttendanceApprovalPage />} />
          <Route path="/att_attendanceRecord" element={<AttendanceRecordPage />} />
          <Route path="/att_attendanceViolation" element={<AttendanceViolationPage />} />
          <Route path="/att_shiftSchedule" element={<ShiftSchedulePage />} />
          <Route path="/att_leaveBalance" element={<LeaveBalancePage />} />
          <Route path="/att_leaveRequest" element={<LeaveRequestPage />} />
          <Route path="/att_overtimeEntry" element={<OverTimeEntryPage />} />
          <Route path="/att_leaveType" element={<LeaveTypePage />} />
          <Route path="/att_overtimeRule" element={<OvertimeRulePage />} />
          <Route path="/att_payrollComponent" element={<PayrollComponentPage />} />
          <Route path="/att_payrollRecord" element={<PayrollRecordPage />} />
          <Route path="/att_remoteAttendanceLog" element={<RemoteAttendanceLogPage />} />
          <Route path="/att_workFromHomeRequests" element={<WorkFromHomeRequestPage />} />
          <Route path="/att_shift" element={<ShiftPage />} />
          <Route path="/att_notifications" element={<NotificationPage />} />
          <Route path="/notifications" element={<NotificationInboxPage />} />
          <Route path="/notifications/:id" element={<NotificationDetailPage />} />
          <Route path="/attendance_dashboard" element={<AttendanceDashboard />} />

          <Route path="/sales-summary" element={<SalesSummary />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/dashboard-overview" element={<DashboardOverview />} />
          <Route path="/keyMetrics" element={<KeyMetrics />} />
          <Route path="/recentInteractions" element={<RecentInteractions />} />

          <Route path="/leads" element={<LeadsPages />} />
          <Route path="/contacts" element={<ContactPage />} />
          <Route path="/accounts" element={<AccountsPage />} />

          <Route path="/opportunities-deal" element={<OpportunitiesPage />} />
          <Route path="/salesPipeline" element={<SalesPipeline />} />
          <Route path="/stagesManagement" element={<StagesManagement />} />
          <Route path="/forecastPage" element={<ForecastPage />} />
          <Route path="/wonLostAnalysis" element={<WonLostAnalysis />} />

          <Route path="/taskPage" element={<TaskPage />} />
          <Route path="/meetingsPage" element={<MeetingsPage />} />
          <Route path="/callsPage" element={<CallsPage />} />
          <Route path="/remindersPage" element={<RemindersPage />} />
          <Route path="/activityCalendar" element={<ActivityCalendar />} />

          <Route path="/campaigns" element={<CampaignPage />} />
          <Route path="/emailMarketing" element={<EmailMarketingPage />} />
          <Route path="/sms" element={<SMSCampaignPage />} />
          <Route path="/templates" element={<TemplatesManager />} />
          <Route path="/segmentation" element={<SegmentationManager />} />
          <Route path="/campaignReports" element={<CampaignReports />} />

          <Route path="/tickets" element={<TicketSupport />} />
          <Route path="/knowledgeBase" element={<KnowledgeBase />} />
          <Route path="/sLAManagement" element={<SLAManagement />} />
          <Route path="/SupportReports" element={<SupportReports />} />

          <Route path="/workflowRules" element={<AutomationWorkflowRules />} />
          <Route path="/triggerSettings" element={<TriggerSettings />} />
          <Route path="/automationLogs" element={<AutomationLogs />} />
          <Route path="/scheduledActions" element={<ScheduledActions />} />

          <Route path="/activityReports" element={<ActivityReports />} />
          <Route path="/customReports" element={<CustomReports />} />
          <Route path="/customerRetention" element={<CustomerRetentionReport />} />
          <Route path="/leadReports" element={<LeadReports />} />
          <Route path="/performanceReports" element={<PerformanceReports />} />
          <Route path="/salesReports" element={<SalesReports />} />

          <Route path="/customFields" element={<CustomFieldsManager />} />
          <Route path="/emailSMS" element={<EmailSmsSettings />} />
          <Route path="/importExport" element={<ImportExportPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/rolesPermissions" element={<RolesPermissionsPage />} />

          <Route path="/user_dashboard" element={<UserDashboard />} />

          <Route path="/preference" element={<UserPreferences />} />
          <Route path="/alert" element={<Alert />} />

          <Route path="/profile" element={<UserProfiles />} />
          <Route path="/message-section" element={<MessageSection />} />
          <Route path="/resetpassword" element={<ResetPassword />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/blank" element={<Blank />} />

          <Route path="/form-elements" element={<FormElements />} />
          <Route path="/basic-tables" element={<BasicTables />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/avatars" element={<Avatars />} />
          <Route path="/badge" element={<Badges />} />
          <Route path="/buttons" element={<Buttons />} />
          <Route path="/images" element={<Images />} />
          <Route path="/videos" element={<Videos />} />

          <Route path="/line-chart" element={<LineChart />} />
          <Route path="/bar-chart" element={<BarChart />} />
        </Route>

        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgetpassword" element={<Forget />} />
        <Route path="/contactus" element={<Contact />} />
        <Route path="/termsandconditions" element={<Terms />} />
        <Route path="/privacypolicy" element={<Privacy />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
