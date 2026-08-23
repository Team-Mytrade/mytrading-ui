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
import Customers from "./pages/CRM/Customers";
import Deals from "./pages/CRM/Deals";
import KeyContacts from "./pages/CRM/KeyContacts";
import Segments from "./pages/CRM/Segments";
import Interactions from "./pages/CRM/Interactions";
import TaskManager from "./pages/CRM/TaskManager";
import SalesOrders from "./pages/Sales/SalesOrders";
import Quotations from "./pages/Sales/Quotations";
import SalesPersons from "./pages/Sales/SalesPersons";
import ServiceSchedules from "./pages/Sales/ServiceSchedules";
import SalesTargets from "./pages/Sales/SalesTargets";
import ServiceScheduleNotify from "./pages/Sales/ServiceScheduleNotify";
import ReturnRequests from "./pages/Sales/ReturnRequests";
import Refunds from "./pages/Sales/Refunds";
import CreditLimit from "./pages/Sales/CreditLimit";
import Warehouse from "./pages/Inventory/warehouse";
import InventoryModule from "./pages/Inventory/inventory";
import StockLevel from "./pages/Inventory/stock-level";
import QualityInspection from "./pages/Inventory/quality-inspection";
import SerialNumber from "./pages/Inventory/serial-number";
import StockMovement from "./pages/Inventory/stock-movement";
import InventoryReservation from "./pages/Inventory/inventory-reservation";
import InventoryReport from "./pages/Inventory/inventory-report";
import StockAdjustment from "./pages/Inventory/stock-adjustment";
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
import ExitApprovalsPage from "./pages/Payroll/ExitApprovalsPage";
import ItDeclarationPage from "./pages/Payroll/ItDeclarationPage";
import LeaveManagementPage from "./pages/Payroll/LeaveManagementPage";
import PerformanceManagementPage from "./pages/Payroll/PerformanceManagementPage";
import StatutoryCompliancesPage from "./pages/Payroll/StatutoryCompliancesPage";
import PayrollProcessingEnginePage from "./pages/Payroll/PayrollProcessingEnginePage";
import PayrollSummaryPage from "./pages/Payroll/PayrollSummaryPage";
import DepartmentSummaryPage from "./pages/Payroll/DepartmentSummaryPage";
import SalesSummary from "./pages/Dashboard/SalesSummary";
import Tasks from "./pages/CRM/Tasks";
import DashboardOverview from "./pages/Dashboard/DashboardOverview";
import KeyMetrics from "./pages/Dashboard/KeyMetrics";
import RecentInteractions from "./pages/Dashboard/RecentInteractions";
import Leads from "./pages/CRM/Leads";
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
import SalesChannels from "./pages/Sales/SalesChannels";
import AttendanceRecordPage from "./pages/Attendance/AttendanceRecordPage";
import LeaveBalancePage from "./pages/Attendance/LeaveBalancePage";
import LeaveRequestPage from "./pages/Attendance/LeaveRequestPage";
import LeaveTypePage from "./pages/Attendance/LeaveTypePage";
import LeavePolicyPage from "./pages/Attendance/LeavePolicyPage";
import LeaveDashboardPage from "./pages/Attendance/LeaveDashboardPage";
import NotificationPage from "./pages/Attendance/NotificationPage";
import NotificationInboxPage from "./pages/Attendance/NotificationInboxPage";
import NotificationDetailPage from "./pages/Attendance/NotificationDetailPage";
import AttendancePolicyPage from "./pages/Attendance/AttendancePolicyPage";
import HolidayCalendarPage from "./pages/Attendance/HolidayCalendarPage";
import AttendancePunchPage from "./pages/Attendance/AttendancePunchPage";
import AttendanceReportsPage from "./pages/Attendance/AttendanceReportsPage";
import AttendanceRequestsPage from "./pages/Attendance/AttendanceRequestsPage";
import OnDutyApprovalPage from "./pages/Attendance/OnDutyApprovalPage";
import AttendanceRegularizationApprovalPage from "./pages/Attendance/AttendanceRegularizationApprovalPage";
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
import TimesheetManagementPage from "./pages/Attendance/TimesheetManagementPage";
import PayrollPage from "./pages/Payroll/PayrollPage";
import EmployeeDocumentsPage from "./pages/Payroll/EmployeeDocumentsPage";
import SalesDashboard from "./pages/Sales/SalesDashboard";
import CrmDashboardPage from "./pages/CRM/CrmDashboardPage";
import ProcurementDashboard from "./pages/Purchase/ProcurementDashboard";
import DeliveryDashboard from "./pages/Delivery/DeliveryDashboard";
import PayrollDashboard from "./pages/Payroll/PayrollDashboard";
import AttendanceDashboard from "./pages/Attendance/AttendanceDashboard";
import UserDashboard from "./components/UserProfile/UserDashboard";
import Mainrole from "./pages/roleconfig/Mainrole";
import Batch from "./pages/Inventory/batch";
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
import VendorsInvoice from "./pages/Invoice/Vendors";
import TaxTypesInvoice from "./pages/Invoice/TaxTypes";
import TaxDetailsInvoice from "./pages/Invoice/TaxDetails";
import PurchaseInvoices from "./pages/Invoice/PurchaseInvoices";
import PaymentTermsInvoice from "./pages/Invoice/PaymentTerms";
import JournalEntries from "./pages/Invoice/JournalEntries";
import InvoicesInvoice from "./pages/Invoice/Invoices";
import GeneralAccounts from "./pages/Invoice/GeneralAccounts";
import AccountsPayable from "./pages/Invoice/AccountsPayable";
import VendorPayments from "./pages/Invoice/VendorPayments";
import TaxRecords from "./pages/Invoice/TaxRecords";
import PaymentReceipts from "./pages/Invoice/PaymentReceipts";
import GeneralLedger from "./pages/Invoice/GeneralLedger";
import ExpenseRevenue from "./pages/Invoice/ExpenseRevenue";
import AccountsReceivable from "./pages/Invoice/AccountsReceivable";
import TaxReport from "./pages/Invoice/TaxReport";
import FinanceReport from "./pages/Invoice/FinanceReport";

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

          <Route path="/customer-management" element={<Customers />} />
          <Route path="/customer-management/:id" element={<Customers />} />
          <Route path="/opportunities" element={<Deals />} />
          <Route path="/contactPerson" element={<KeyContacts />} />
          <Route path="/customer-segment" element={<Segments />} />
          <Route path="/customer-segment/:id" element={<Segments />} />
          <Route path="/communication-history" element={<Interactions />} />
          <Route path="/task" element={<TaskManager />} />
          <Route path="/crm-view/:requestFrom/:id" element={<CrmViewPage />} />
          <Route path="/crm_dashboard" element={<CrmDashboardPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/edit/:id" element={<CustomerFormPage />} />

          <Route path="/role_config" element={<Mainrole />} />

          <Route path="/service-schedule-notify" element={<ServiceScheduleNotify />} />
          <Route path="/sales-targets" element={<SalesTargets />} />
          <Route path="/sales-persons" element={<SalesPersons />} />
          <Route path="/sales-orders" element={<SalesOrders />} />
          <Route path="/return-requests" element={<ReturnRequests />} />
          <Route path="/refunds" element={<Refunds />} />
          <Route path="/quotations" element={<Quotations />} />
          <Route path="/credit-limit" element={<CreditLimit />} />
          <Route path="/sales-channels" element={<SalesChannels />} />
          <Route path="/service-schedules" element={<ServiceSchedules />} />
          <Route path="/sales-dashboard" element={<SalesDashboard />} />
          <Route path="/quote-view/:id" element={<Quotations />} />

          <Route path="/warehouse" element={<Warehouse />} />
           <Route path="/products" element={<Products />} />
          <Route path="/inventory" element={<InventoryModule />} />
          <Route path="/stock-movement" element={<StockMovement />} />
          <Route path="/stock-level" element={<StockLevel />} />
          <Route path="/stock-adjustment" element={<StockAdjustment />} />
          <Route path="/serial-number" element={<SerialNumber />} />
          <Route path="/quality-inspection" element={<QualityInspection />} />
          <Route path="/inventory-reservation" element={<InventoryReservation />} />
          <Route path="/customer" element={<Customers />} />
          <Route path="/batch" element={<Batch />} />
          <Route path="/inventory-report" element={<InventoryReport />} />

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

          <Route path="/invoiceVendors" element={<VendorsInvoice />} />
          <Route path="/taxTypes" element={<TaxTypesInvoice />} />
          <Route path="/taxDetails" element={<TaxDetailsInvoice />} />
          <Route path="/purchaseInvoices" element={<PurchaseInvoices />} />
          <Route path="/paymentTerms" element={<PaymentTermsInvoice />} />
          <Route path="/journalEntries" element={<JournalEntries />} />
          <Route path="/invoices" element={<InvoicesInvoice />} />
          <Route path="/generalAccounts" element={<GeneralAccounts />} />
          <Route path="/accountsPayable" element={<AccountsPayable />} />
          <Route path="/vendorPayments" element={<VendorPayments />} />
          <Route path="/taxRecords" element={<TaxRecords />} />
          <Route path="/paymentReceipts" element={<PaymentReceipts />} />
          <Route path="/generalLedger" element={<GeneralLedger />} />
          <Route path="/expenseRevenue" element={<ExpenseRevenue />} />
          <Route path="/accountsReceivable" element={<AccountsReceivable />} />
          <Route path="/taxReport" element={<TaxReport />} />
          <Route path="/financeReport" element={<FinanceReport />} />

          <Route path="/deliveryOrder" element={<DeliveryOrderPage />} />
          <Route path="/transporter" element={<TransporterPage />} />
          <Route path="/vechile" element={<VehiclePage />} />
          <Route path="/shipment" element={<ShipmentPage />} />
          <Route path="/delivery-note" element={<DeliveryNote />} />
          <Route path="/customerAddress" element={<CustomerAddressPage />} />
        
         <Route path="/vehicle" element={<VehiclePage />} />
          <Route path="/route" element={<RouteSchedulePage />} />
          <Route path="/productDelivery" element={<ProductPage />} />
          <Route path="/deliveryAddress" element={<DeliveryAddressPage />} />
          <Route path="/deliveryStatus" element={<DeliveryStatusPage />} />
          <Route path="/delivery_dashboard" element={<DeliveryDashboard />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/goodsIssue" element={<GoodsIssuePage />} />


          <Route path="/employeeRecords" element={<EmployeeRecordsPage />} />
          <Route path="/addEmployee" element={<AddEmployeePage />} />
          <Route path="/employee-view/:id" element={<EmployeeViewPage />} />
          <Route path="/employee-self-dashboard" element={<EmployeeSelfDashboard />} />
          <Route path="/employeeSalary" element={<EmployeeSalaryPage />} />
          <Route path="/employeeCompensation" element={<EmployeeCompensationPage />} />
          <Route path="/employeeDepartments" element={<EmployeeDepartmentsPage />} />
          <Route path="/employeePayroll" element={<PayrollPage />} />
          <Route path="/employeePayslips" element={<PayrollPage />} />
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
          <Route path="/exitApprovals" element={<ExitApprovalsPage />} />
          <Route path="/statutoryCompliances" element={<StatutoryCompliancesPage />} />
          <Route path="/employees/:employeeId/documents" element={<EmployeeDocumentsPage />} />
          <Route path="/payroll_dashboard" element={<PayrollDashboard />} />
          <Route path="/payrollEngine" element={<PayrollProcessingEnginePage />} />
          <Route path="/payrollSummary" element={<PayrollSummaryPage />} />
          <Route path="/departmentSummary" element={<DepartmentSummaryPage />} />

          <Route path="/att_attendanceApproval" element={<AttendanceApprovalPage />} />
          <Route path="/att_attendanceRecord" element={<AttendanceRecordPage />} />
          <Route path="/att_attendanceViolation" element={<AttendanceViolationPage />} />
          <Route path="/att_shiftSchedule" element={<ShiftSchedulePage />} />
          <Route path="/att_leaveBalance" element={<LeaveBalancePage />} />
          <Route path="/att_leaveRequest" element={<LeaveRequestPage />} />
          <Route path="/att_leavePolicy" element={<LeavePolicyPage />} />
          <Route path="/att_leaveDashboard" element={<LeaveDashboardPage />} />
          <Route path="/att_overtimeEntry" element={<OverTimeEntryPage />} />
          <Route path="/att_leaveType" element={<LeaveTypePage />} />
          <Route path="/att_overtimeRule" element={<OvertimeRulePage />} />
          <Route path="/att_payrollComponent" element={<PayrollComponentPage />} />
          <Route path="/att_payrollRecord" element={<PayrollRecordPage />} />
          <Route path="/att_remoteAttendanceLog" element={<RemoteAttendanceLogPage />} />
          <Route path="/att_workFromHomeRequests" element={<WorkFromHomeRequestPage />} />
          <Route path="/att_shift" element={<ShiftPage />} />
          <Route path="/att_notifications" element={<NotificationPage />} />
          <Route path="/att_attendancePolicy" element={<AttendancePolicyPage />} />
          <Route path="/att_holidayCalendar" element={<HolidayCalendarPage />} />
          <Route path="/att_punch" element={<AttendancePunchPage />} />
          <Route path="/att_reports" element={<AttendanceReportsPage />} />
          <Route path="/att_requests" element={<AttendanceRequestsPage />} />
          <Route path="/att_onDutyApproval" element={<OnDutyApprovalPage />} />
          <Route path="/att_regularizationApproval" element={<AttendanceRegularizationApprovalPage />} />
          <Route path="/att_timesheetManagement" element={<TimesheetManagementPage />} />
          <Route path="/notifications" element={<NotificationInboxPage />} />
          <Route path="/notifications/:id" element={<NotificationDetailPage />} />
          <Route path="/attendance_dashboard" element={<AttendanceDashboard />} />
          <Route path="/att_timesheetManagement" element={<TimesheetManagementPage />} />

          <Route path="/sales-summary" element={<SalesSummary />} />
          <Route path="/activities" element={<Tasks />} />
          <Route path="/dashboard-overview" element={<DashboardOverview />} />
          <Route path="/keyMetrics" element={<KeyMetrics />} />
          <Route path="/recentInteractions" element={<RecentInteractions />} />

          <Route path="/leads" element={<Leads />} />
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
