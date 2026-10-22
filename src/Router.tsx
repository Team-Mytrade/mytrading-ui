import { ROUTER_BASENAME } from "./utils/appPath";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import PageLoading from "./components/common/PageLoading";
import SessionDraftRestorer from "./components/common/SessionDraftRestorer";
import SignIn from "./pages/AuthPages/SignIn";
import AuthLayout from "./pages/AuthPages/AuthPageLayout";
const SignUp = lazy(() => import("./pages/AuthPages/SignUp"));
const Forget = lazy(() => import("./pages/AuthPages/Forget"));
const ResetPasswordPage = lazy(() => import("./pages/AuthPages/ResetPasswordPage"));
const Contact = lazy(() => import("./pages/AuthPages/Contact"));
const Privacy = lazy(() => import("./pages/AuthPages/Privacy"));
const Terms = lazy(() => import("./pages/AuthPages/Terms"));
import NotFound from "./pages/OtherPage/NotFound";
const UserProfiles = lazy(() => import("./pages/UserProfiles"));
const ResetPassword = lazy(() => import("./components/UserProfile/ResetPassword"));
import AppLayout from "./layout/AppLayout";
import DriverLayout from "./layout/DriverLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
const Home = lazy(() => import("./pages/Dashboard/Home"));
import "react-toastify/dist/ReactToastify.css";
const Customers = lazy(() => import("./pages/common/Customers"));
const Deals = lazy(() => import("./pages/CRM/Deals"));
const KeyContacts = lazy(() => import("./pages/CRM/KeyContacts"));
const Segments = lazy(() => import("./pages/CRM/Segments"));
const Interactions = lazy(() => import("./pages/CRM/Interactions"));
const SalesOrders = lazy(() => import("./pages/Sales/SalesOrders"));
const Quotations = lazy(() => import("./pages/Sales/Quotations"));
const SalesPersons = lazy(() => import("./pages/Sales/SalesPersons"));
const ServiceSchedules = lazy(() => import("./pages/Sales/ServiceSchedules"));
const SalesTargets = lazy(() => import("./pages/Sales/SalesTargets"));
const ServiceScheduleNotify = lazy(() => import("./pages/Sales/ServiceScheduleNotify"));
const ReturnRequests = lazy(() => import("./pages/Sales/ReturnRequests"));
const Refunds = lazy(() => import("./pages/Sales/Refunds"));
const CreditLimit = lazy(() => import("./pages/Sales/CreditLimit"));
const Warehouse = lazy(() => import("./pages/Inventory/warehouse"));
const InventoryModule = lazy(() => import("./pages/Inventory/inventory"));
const StockLevel = lazy(() => import("./pages/Inventory/stock-level"));
const QualityInspection = lazy(() => import("./pages/Inventory/quality-inspection"));
const SerialNumber = lazy(() => import("./pages/Inventory/serial-number"));
const StockMovement = lazy(() => import("./pages/Inventory/stock-movement"));
const InventoryReservation = lazy(() => import("./pages/Inventory/inventory-reservation"));
const InventoryReport = lazy(() => import("./pages/reports/inventory-report"));
const StockAdjustment = lazy(() => import("./pages/Inventory/stock-adjustment"));
const PurchaseRequisitions = lazy(() => import("./pages/purchase-service/PurchaseRequisitions"));
const RequisitionLineItems = lazy(() => import("./pages/Purchase/RequisitionLineItems"));
const PurchaseOrders = lazy(() => import("./pages/purchase-service/PurchaseOrders"));
const Vendors = lazy(() => import("./pages/product-catalogue/Vendors"));
const Products = lazy(() => import("./pages/product-catalogue/Products"));
const ProductCategories = lazy(() => import("./pages/product-catalogue/ProductCategories"));
const TermsAndConditions = lazy(() => import("./pages/Purchase/TermsAndConditions"));
const Deliveries = lazy(() => import("./pages/Purchase/Deliveries"));
const GoodsReceiptNotes = lazy(() => import("./pages/purchase-service/GoodsReceiptNotes"));
const PurchaseReports = lazy(() => import("./pages/Purchase/PurchaseReports"));
const DeliveryOrderPage = lazy(() => import("./pages/Delivery/DeliveryOrderPage"));
const TransporterPage = lazy(() => import("./pages/Delivery/TransporterPage"));
const VehiclePage = lazy(() => import("./pages/Delivery/VehiclePage"));
const RouteSchedulePage = lazy(() => import("./pages/Delivery/RouteSchedulePage"));
const DeliveryStatusPage = lazy(() => import("./pages/Delivery/DeliveryStatusPage"));
const BenefitsAllowancesPage = lazy(() => import("./pages/Payroll/BenefitsAllowancesPage"));
const PayrollRunsPage = lazy(() => import("./pages/Payroll/PayrollRunsPage"));
const PayrollTaxDeductionsPage = lazy(() => import("./pages/Payroll/PayrollTaxDeductionsPage"));
const LeaveRequestsPage = lazy(() => import("./pages/Payroll/LeaveRequestsPage"));
const AttendanceLogsPage = lazy(() => import("./pages/Payroll/AttendanceLogsPage"));
const SalaryStructurePage = lazy(() => import("./pages/Payroll/SalaryStructurePage"));
const EmployeeRecordsPage = lazy(() => import("./pages/Payroll/EmployeeRecordsPage"));
const AddEmployeePage = lazy(() => import("./pages/Payroll/addEmployeesPage"));
const AttendanceManagementPage = lazy(() => import("./pages/Payroll/AttendanceManagementPage"));
const DocumentManagementPage = lazy(() => import("./pages/Payroll/DocumentManagementPage"));
const EmployeeSelfDashboard = lazy(() => import("./pages/Payroll/EmployeeSelfDashboard"));
const EmployeeViewPage = lazy(() => import("./pages/Payroll/EmployeeViewPage"));
const ExitManagementPage = lazy(() => import("./pages/Payroll/ExitManagementPage"));
const ExitApprovalsPage = lazy(() => import("./pages/Payroll/ExitApprovalsPage"));
const ItDeclarationPage = lazy(() => import("./pages/Payroll/ItDeclarationPage"));
const LeaveManagementPage = lazy(() => import("./pages/Payroll/LeaveManagementPage"));
const PerformanceManagementPage = lazy(() => import("./pages/Payroll/PerformanceManagementPage"));
const StatutoryCompliancesPage = lazy(() => import("./pages/Payroll/StatutoryCompliancesPage"));
const PayrollProcessingEnginePage = lazy(() => import("./pages/Payroll/PayrollProcessingEnginePage"));
const PayrollSummaryPage = lazy(() => import("./pages/Payroll/PayrollSummaryPage"));
const DepartmentSummaryPage = lazy(() => import("./pages/Payroll/DepartmentSummaryPage"));
const SalesSummary = lazy(() => import("./pages/Dashboard/SalesSummary"));
const Tasks = lazy(() => import("./pages/CRM/Tasks"));
const DashboardOverview = lazy(() => import("./pages/Dashboard/DashboardOverview"));
const KeyMetrics = lazy(() => import("./pages/Dashboard/KeyMetrics"));
const RecentInteractions = lazy(() => import("./pages/Dashboard/RecentInteractions"));
const Leads = lazy(() => import("./pages/CRM/Leads"));
const CampaignPage = lazy(() => import("./pages/Marketing/CampaignPage"));
const CampaignReports = lazy(() => import("./pages/Marketing/CampaignReports"));
const EmailMarketingPage = lazy(() => import("./pages/Marketing/EmailMarketingPage"));
const SegmentationManager = lazy(() => import("./pages/Marketing/SegmentationManager"));
const TemplatesManager = lazy(() => import("./pages/Marketing/TemplatesManager"));
const SMSCampaignPage = lazy(() => import("./pages/Marketing/SMSCampaignPage"));
const KnowledgeBase = lazy(() => import("./pages/Support/KnowledgeBase"));
const SLAManagement = lazy(() => import("./pages/Support/SLAManagement"));
const SupportReports = lazy(() => import("./pages/Support/SupportReports"));
const TicketSupport = lazy(() => import("./pages/Support/TicketSupport"));
const AutomationLogs = lazy(() => import("./pages/Workflow/AutomationLogs"));
const AutomationWorkflowRules = lazy(() => import("./pages/Workflow/AutomationWorkflowRules"));
const ScheduledActions = lazy(() => import("./pages/Workflow/ScheduledActions"));
const TriggerSettings = lazy(() => import("./pages/Workflow/TriggerSettings"));
const CustomFieldsManager = lazy(() => import("./pages/Settings/CustomFieldsManager"));
const EmailSmsSettings = lazy(() => import("./pages/Settings/EmailSmsSettings"));
const ImportExportPage = lazy(() => import("./pages/Settings/ImportExportPage"));
const IntegrationsPage = lazy(() => import("./pages/Settings/IntegrationsPage"));
const RoleConfiguration = lazy(() => import("./pages/Role/role"));
const Alert = lazy(() => import("./pages/Notification/Alerts"));
const UserPreferences = lazy(() => import("./pages/Notification/UserPreferences"));
const CrmViewPage = lazy(() => import("./pages/CRM/CrmViewPage"));
const SalesChannels = lazy(() => import("./pages/Sales/SalesChannels"));
const AttendanceRecordPage = lazy(() => import("./pages/Attendance/AttendanceRecordPage"));
const LeaveBalancePage = lazy(() => import("./pages/Attendance/LeaveBalancePage"));
const LeaveRequestPage = lazy(() => import("./pages/Attendance/LeaveRequestPage"));
const LeaveTypePage = lazy(() => import("./pages/Attendance/LeaveTypePage"));
const LeavePolicyPage = lazy(() => import("./pages/Attendance/LeavePolicyPage"));
const LeaveDashboardPage = lazy(() => import("./pages/Attendance/LeaveDashboardPage"));
const LeaveManagerDashboardPage = lazy(() => import("./pages/Attendance/LeaveManagerDashboardPage"));
const NotificationPage = lazy(() => import("./pages/Attendance/NotificationPage"));
const NotificationInboxPage = lazy(() => import("./pages/Attendance/NotificationInboxPage"));
const NotificationDetailPage = lazy(() => import("./pages/Attendance/NotificationDetailPage"));
const AttendancePolicyPage = lazy(() => import("./pages/Attendance/AttendancePolicyPage"));
const HolidayCalendarPage = lazy(() => import("./pages/Attendance/HolidayCalendarPage"));
const AttendancePunchPage = lazy(() => import("./pages/Attendance/AttendancePunchPage"));
const AttendanceReportsPage = lazy(() => import("./pages/Attendance/AttendanceReportsPage"));
const AttendanceTrackingPage = lazy(() => import("./pages/Attendance/AttendanceTrackingPage"));
const AttendanceRequestsPage = lazy(() => import("./pages/Attendance/AttendanceRequestsPage"));
const OnDutyApprovalPage = lazy(() => import("./pages/Attendance/OnDutyApprovalPage"));
const AttendanceRegularizationApprovalPage = lazy(() => import("./pages/Attendance/AttendanceRegularizationApprovalPage"));
const OvertimeRulePage = lazy(() => import("./pages/Attendance/OvertimeRulePage"));
const PayrollComponentPage = lazy(() => import("./pages/Attendance/PayrollComponentPage"));
const PayrollRecordPage = lazy(() => import("./pages/Attendance/PayrollRecordPage"));
const RemoteAttendanceLogPage = lazy(() => import("./pages/Attendance/RemoteAttendanceLogPage"));
const ShiftPage = lazy(() => import("./pages/Attendance/ShiftPage"));
const EmployeeSelfServicePage = lazy(() => import("./pages/Attendance/EmployeeSelfServicePage"));
const WorkFromHomeRequestPage = lazy(() => import("./pages/Attendance/WorkFromHomeRequestPage"));
const OverTimeEntryPage = lazy(() => import("./pages/Attendance/OverTimeEntryPage"));
const AttendanceViolationPage = lazy(() => import("./pages/Attendance/AttendanceViolationPage"));
const AttendanceApprovalPage = lazy(() => import("./pages/Attendance/AttendanceApprovalRequestPage"));
const ShiftSchedulePage = lazy(() => import("./pages/Attendance/EmployeeShiftSchedulePage"));
const UnifiedShiftManagementPage = lazy(() => import("./pages/Attendance/UnifiedShiftManagementPage"));
const TimesheetManagementPage = lazy(() => import("./pages/Attendance/TimesheetManagementPage"));
const UnifiedRequestCenterPage = lazy(() => import("./pages/Attendance/UnifiedRequestCenterPage"));
const PayrollPage = lazy(() => import("./pages/Payroll/PayrollPage"));
const EmployeeDocumentsPage = lazy(() => import("./pages/Payroll/EmployeeDocumentsPage"));
const SalesDashboard = lazy(() => import("./pages/Sales/SalesDashboard"));
const CrmDashboardPage = lazy(() => import("./pages/CRM/CrmDashboardPage"));
const ProcurementDashboard = lazy(() => import("./pages/Purchase/ProcurementDashboard"));
const DeliveryDashboard = lazy(() => import("./pages/Delivery/DeliveryDashboard"));
const PayrollDashboard = lazy(() => import("./pages/Payroll/PayrollDashboard"));
const AttendanceDashboard = lazy(() => import("./pages/Attendance/AttendanceDashboard"));
const UserDashboard = lazy(() => import("./components/UserProfile/UserDashboard"));
const Mainrole = lazy(() => import("./pages/roleconfig/Mainrole"));
const UserAccessPage = lazy(() => import("./pages/roleconfig/UserAccessPage"));
const TenantsPage = lazy(() => import("./pages/Platform/TenantsPage"));
const Batch = lazy(() => import("./pages/Inventory/batch"));
const EmployeeCompensationPage = lazy(() => import("./pages/Payroll/EmployeeCompensationPage"));
const EmployeeDepartmentsPage = lazy(() => import("./pages/Payroll/EmployeeDepartments"));
const EmployeeSalaryPage = lazy(() => import("./pages/Payroll/EmployeeSalaryPage"));
const CustomerFormPage = lazy(() => import("./pages/common/CustomerFormPage"));
const ShipmentPage = lazy(() => import("./pages/Delivery/Shipment"));
const CustomerAddressPage = lazy(() => import("./pages/Delivery/CustomerAddress"));
const DeliveryNote = lazy(() => import("./pages/Delivery/DeliveryNote"));
const GoodsIssuePage = lazy(() => import("./pages/Delivery/GoodsIssue"));
const Schedule = lazy(() => import("./pages/Delivery/Schedule"));
const LiveTracking = lazy(() => import("./pages/Delivery/LiveTracking"));
const DriverMode = lazy(() => import("./pages/Delivery/DriverMode"));
const VendorsInvoice = lazy(() => import("./pages/common/CustomerVendors"));
const TaxTypesInvoice = lazy(() => import("./pages/common/TaxTypes"));
const TaxDetailsInvoice = lazy(() => import("./pages/common/TaxDetails"));
const PurchaseInvoices = lazy(() => import("./pages/Invoice/PurchaseInvoices"));
const PaymentTermsInvoice = lazy(() => import("./pages/Invoice/PaymentTerms"));
const JournalEntries = lazy(() => import("./pages/Invoice/JournalEntries"));
const InvoicesInvoice = lazy(() => import("./pages/Invoice/Invoices"));
const GeneralAccounts = lazy(() => import("./pages/Invoice/GeneralAccounts"));
const AccountsPayable = lazy(() => import("./pages/Invoice/AccountsPayable"));
const VendorPayments = lazy(() => import("./pages/Invoice/VendorPayments"));
const TaxRecords = lazy(() => import("./pages/Invoice/TaxRecords"));
const PaymentReceipts = lazy(() => import("./pages/Invoice/PaymentReceipts"));
const GeneralLedger = lazy(() => import("./pages/Invoice/GeneralLedger"));
const ExpenseRevenue = lazy(() => import("./pages/Invoice/ExpenseRevenue"));
const AccountsReceivable = lazy(() => import("./pages/Invoice/AccountsReceivable"));
const TaxReport = lazy(() => import("./pages/reports/TaxReport"));
const FinanceReport = lazy(() => import("./pages/reports/FinanceReport"));
const Reports = lazy(() => import("./pages/CRM/Reports"));
export default function AppRouter() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <ScrollToTop />
      <SessionDraftRestorer />
      <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/auth" element={<AuthLayout children={undefined} />}>
          <Route path="signin" element={<SignIn />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="forgetpassword" element={<Forget />} />
          <Route path="contactus" element={<Contact />} />
          <Route path="privacypolicy" element={<Privacy />} />
          <Route path="termsandconditions" element={<Terms />} />
        </Route>

        {/* Driver's phone: full screen, no sidebar */}
        <Route element={<DriverLayout />}>
          <Route path="/driver" element={<DriverMode />} />
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
          <Route path="/task" element={<Navigate to="/activities" replace />} />
          <Route path="/crm-view/:requestFrom/:id" element={<CrmViewPage />} />
          <Route path="/crm_dashboard" element={<CrmDashboardPage />} />
          <Route path="/customers/new" element={<CustomerFormPage />} />
          <Route path="/customers/edit/:id" element={<CustomerFormPage />} />
          <Route path="/crm-reports" element={<Reports />} />
          
          <Route path="/role_config" element={<Mainrole />} />
          <Route path="/role_config/access" element={<UserAccessPage />} />
          <Route path="/platform/tenants" element={<TenantsPage />} />

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
           <Route path="/products" element={<Navigate to="/product-catalogue/products" replace />} />
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

          <Route path="/purchase-service/requisitions" element={<PurchaseRequisitions />} />
          <Route path="/requisition-line-items" element={<RequisitionLineItems />} />
          <Route path="/purchase-service/orders" element={<PurchaseOrders />} />
          <Route path="/purchase-service/goods-receipt-notes" element={<GoodsReceiptNotes />} />
          <Route path="/purchase-requisitions" element={<Navigate to="/purchase-service/requisitions" replace />} />
          <Route path="/purchase-orders" element={<Navigate to="/purchase-service/orders" replace />} />
          <Route path="/product-catalogue/vendors" element={<Vendors />} />
          <Route path="/product-catalogue/products" element={<Products />} />
          <Route path="/product-catalogue/categories" element={<ProductCategories />} />
          <Route path="/vendors" element={<Navigate to="/product-catalogue/vendors" replace />} />
          <Route path="/purchase-products" element={<Navigate to="/product-catalogue/products" replace />} />
          <Route path="/product-categories" element={<Navigate to="/product-catalogue/categories" replace />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/deliveries" element={<Deliveries />} />
          <Route path="/goods-receipt-notes" element={<Navigate to="/purchase-service/goods-receipt-notes" replace />} />
          <Route path="/purchase-inventory" element={<Navigate to="/inventory" replace />} />
          <Route path="/purchase-reports" element={<PurchaseReports />} />
          <Route path="/purchase_dashboard" element={<ProcurementDashboard />} />

          <Route path="/purchaseRequisition" element={<Navigate to="/purchase-service/requisitions" replace />} />
          <Route path="/purchaseOrder" element={<Navigate to="/purchase-service/orders" replace />} />
          <Route path="/supplier" element={<Navigate to="/product-catalogue/vendors" replace />} />
          <Route path="/product" element={<Navigate to="/product-catalogue/products" replace />} />
          <Route path="/term-condition" element={<TermsAndConditions />} />
          <Route path="/deliveryDate" element={<Deliveries />} />
          <Route path="/goodseceiptNote" element={<Navigate to="/purchase-service/goods-receipt-notes" replace />} />

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
          <Route path="/vechile" element={<Navigate to="/vehicle" replace />} />
          <Route path="/shipment" element={<ShipmentPage />} />
          <Route path="/delivery-note" element={<DeliveryNote />} />
          <Route path="/customerAddress" element={<CustomerAddressPage />} />
        
         <Route path="/vehicle" element={<VehiclePage />} />
          <Route path="/route" element={<RouteSchedulePage />} />
          {/* Former mock pages: routes now live under Routes and Customer Address */}
          <Route path="/productDelivery" element={<Navigate to="/route" replace />} />
          <Route path="/deliveryAddress" element={<Navigate to="/customerAddress" replace />} />
          <Route path="/deliveryStatus" element={<DeliveryStatusPage />} />
          <Route path="/delivery_dashboard" element={<DeliveryDashboard />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/goodsIssue" element={<GoodsIssuePage />} />
          <Route path="/vehicle-tracking" element={<LiveTracking />} />


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

          <Route path="/att_attendanceApproval" element={<Navigate to="/att_leaveManagerDashboard?tab=leaves" replace />} />
          <Route path="/att_attendanceRecord" element={<AttendanceRecordPage />} />
          <Route path="/att_attendanceViolation" element={<AttendanceViolationPage />} />
          <Route path="/att_shiftSchedule" element={<UnifiedShiftManagementPage defaultTab="roster" />} />
          <Route path="/att_leaveBalance" element={<LeaveBalancePage />} />
          <Route path="/att_requestCenter" element={<UnifiedRequestCenterPage />} />
          <Route path="/att_unifiedRequests" element={<Navigate to="/att_requestCenter" replace />} />
          <Route path="/att_leaveRequest" element={<LeaveRequestPage />} />
          <Route path="/att_leavePolicy" element={<LeavePolicyPage />} />
          <Route path="/att_leaveDashboard" element={<Navigate to="/att_selfService" replace />} />
          <Route path="/att_selfService" element={<EmployeeSelfServicePage />} />
          <Route path="/att_leaveManagerDashboard" element={<LeaveManagerDashboardPage />} />
          <Route path="/att_attendanceTracking" element={<AttendanceTrackingPage />} />
          <Route path="/att_overtimeEntry" element={<OverTimeEntryPage />} />
          <Route path="/att_leaveType" element={<LeaveTypePage />} />
          <Route path="/att_overtimeRule" element={<OvertimeRulePage />} />
          <Route path="/att_payrollComponent" element={<PayrollComponentPage />} />
          <Route path="/att_payrollRecord" element={<PayrollRecordPage />} />
          <Route path="/att_remoteAttendanceLog" element={<RemoteAttendanceLogPage />} />
          <Route path="/att_workFromHomeRequests" element={<WorkFromHomeRequestPage />} />
          <Route path="/att_shift" element={<Navigate to="/att_shiftSchedule" replace />} />
          <Route path="/att_notifications" element={<NotificationPage />} />
          <Route path="/att_attendancePolicy" element={<AttendancePolicyPage />} />
          <Route path="/att_holidayCalendar" element={<HolidayCalendarPage />} />
          <Route path="/att_punch" element={<AttendancePunchPage />} />
          <Route path="/att_reports" element={<AttendanceReportsPage />} />
          <Route path="/att_requests" element={<AttendanceRequestsPage />} />
          <Route path="/att_onDutyApproval" element={<Navigate to="/att_leaveManagerDashboard?tab=onDuty" replace />} />
          <Route path="/att_regularizationApproval" element={<Navigate to="/att_leaveManagerDashboard?tab=regularizations" replace />} />
          <Route path="/att_timesheetManagement" element={<TimesheetManagementPage />} />
          <Route path="/notifications" element={<NotificationInboxPage />} />
          <Route path="/notifications/:id" element={<NotificationDetailPage />} />
          <Route path="/attendance_dashboard" element={<AttendanceDashboard />} />

          <Route path="/sales-summary" element={<SalesSummary />} />
          <Route path="/activities" element={<Tasks />} />
          <Route path="/dashboard-overview" element={<DashboardOverview />} />
          <Route path="/keyMetrics" element={<KeyMetrics />} />
          <Route path="/recentInteractions" element={<RecentInteractions />} />

          <Route path="/leads" element={<Leads />} />
          {/* Old CRM demo screens (hard-coded sample data) open the live CRM pages instead */}
          <Route path="/contacts" element={<Navigate to="/contactPerson" replace />} />
          <Route path="/accounts" element={<Navigate to="/customer-management" replace />} />

          <Route path="/opportunities-deal" element={<Navigate to="/opportunities" replace />} />
          <Route path="/salesPipeline" element={<Navigate to="/opportunities" replace />} />
          <Route path="/stagesManagement" element={<Navigate to="/opportunities" replace />} />
          <Route path="/forecastPage" element={<Navigate to="/crm-reports" replace />} />
          <Route path="/wonLostAnalysis" element={<Navigate to="/crm-reports" replace />} />

          <Route path="/taskPage" element={<Navigate to="/activities" replace />} />
          <Route path="/meetingsPage" element={<Navigate to="/activities" replace />} />
          <Route path="/callsPage" element={<Navigate to="/activities" replace />} />
          <Route path="/remindersPage" element={<Navigate to="/activities" replace />} />
          <Route path="/activityCalendar" element={<Navigate to="/activities" replace />} />

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

          <Route path="/activityReports" element={<Navigate to="/crm-reports" replace />} />
          <Route path="/customReports" element={<Navigate to="/crm-reports" replace />} />
          <Route path="/customerRetention" element={<Navigate to="/crm-reports" replace />} />
          <Route path="/leadReports" element={<Navigate to="/crm-reports" replace />} />
          <Route path="/performanceReports" element={<Navigate to="/crm-reports" replace />} />
          <Route path="/salesReports" element={<Navigate to="/sales-dashboard" replace />} />

          <Route path="/customFields" element={<CustomFieldsManager />} />
          <Route path="/emailSMS" element={<EmailSmsSettings />} />
          <Route path="/importExport" element={<ImportExportPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/rolesPermissions" element={<RoleConfiguration />} />

          <Route path="/user_dashboard" element={<UserDashboard />} />

          <Route path="/preference" element={<UserPreferences />} />
          <Route path="/alert" element={<Alert />} />

          <Route path="/profile" element={<UserProfiles />} />
          <Route path="/resetpassword" element={<ResetPassword />} />
        </Route>

        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgetpassword" element={<Forget />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/contactus" element={<Contact />} />
        <Route path="/termsandconditions" element={<Terms />} />
        <Route path="/privacypolicy" element={<Privacy />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
