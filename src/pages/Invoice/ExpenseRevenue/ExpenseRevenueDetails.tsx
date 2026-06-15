import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeftIcon,
    PencilSquareIcon,
    PrinterIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    CalendarIcon,
    BuildingOfficeIcon,
    CurrencyDollarIcon,
    TagIcon,
    DocumentTextIcon,
    BanknotesIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const API_URL = "/v1/api/invoice/expenses-revenue";
const ACCOUNT_API = "/v1/api/invoice/general-accounts";

export enum RevenueExpenseType {
    REVENUE = "REVENUE",
    EXPENSE = "EXPENSE"
}

export enum RevenueExpenseCategory {
    RENT = "RENT",
    FREIGHT = "FREIGHT",
    MISC = "MISC",
    SALARY = "SALARY",
    UTILITIES = "UTILITIES",
    OFFICE_SUPPLIES = "OFFICE_SUPPLIES",
    MAINTENANCE = "MAINTENANCE",
    TRAVEL = "TRAVEL",
    ENTERTAINMENT = "ENTERTAINMENT",
    ADVERTISING = "ADVERTISING",
    INSURANCE = "INSURANCE",
    TAXES = "TAXES",
    DEPRECIATION = "DEPRECIATION",
    INTEREST = "INTEREST",
    OTHER = "OTHER"
}

interface GeneralAccount {
    id: number;
    accountCode: string;
    accountName: string;
}

interface ExpenseRevenueItem {
    id?: number;
    revenueExpenseType: RevenueExpenseType;
    revenueExpenseCategory: RevenueExpenseCategory;
    description: string;
    amount: number;
    transactionDate: string;
    generalAccount?: GeneralAccount;
    paymentMethod?: string;
    referenceNumber?: string;
}

const ExpenseRevenueDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [item, setItem] = useState<ExpenseRevenueItem | null>(null);
    const [loading, setLoading] = useState(true);
    const voucherRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`${API_URL}/${id}`);
                setItem(res.data);
            } catch (err) {
                console.error("Error loading item details:", err);
                ToasterService.error("Failed to load details");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const printVoucher = () => {
        if (!voucherRef.current) return;
        const printContents = voucherRef.current.innerHTML;
        const newWindow = window.open("", "_blank");
        if (newWindow) {
            newWindow.document.write(`
        <html>
          <head>
            <title>Voucher - ${item?.referenceNumber || item?.id}</title>
            <style>
              body { font-family: 'Nunito', sans-serif; padding: 40px; color: #1f2937; }
              .header { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
              .voucher-type { display: inline-block; padding: 4px 12px; background: #f3f4f6; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-top: 10px; }
              .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
              .label { font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
              .value { font-size: 14px; font-weight: 600; }
              .amount-box { background: #111827; color: white; padding: 30px; border-radius: 16px; text-align: center; margin-bottom: 40px; }
              .amount-label { font-size: 12px; color: #9ca3af; font-weight: 700; margin-bottom: 8px; }
              .amount-value { font-size: 32px; font-weight: 800; }
              .footer { border-top: 1px solid #e5e7eb; padding-top: 20px; font-size: 12px; color: #6b7280; font-style: italic; }
            </style>
          </head>
          <body>${printContents}</body>
        </html>
      `);
            newWindow.document.close();
            newWindow.print();
        }
    };

    if (loading) return <div className="p-6 text-center">Loading...</div>;
    if (!item) return <div className="p-6 text-center text-red-500">Item not found</div>;

    return (
        <>
            <PageMeta title={`Transaction Details - ${item.referenceNumber || item.id}`} description="View expense or revenue details" />
            <PageBreadcrumb pageTitle="Transaction Details" />

            <div className="max-w-4xl mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => navigate("/expense-revenue")}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                        Back to List
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={printVoucher}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            <PrinterIcon className="h-5 w-5" />
                            Print Voucher
                        </button>
                        <button
                            onClick={() => navigate(`/expense-revenue/edit/${item.id}`)}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors shadow-sm"
                        >
                            <PencilSquareIcon className="h-5 w-5" />
                            Edit Transaction
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative">
                    <div className={`h-2 ${item.revenueExpenseType === RevenueExpenseType.REVENUE ? 'bg-green-500' : 'bg-red-500'}`} />

                    <div className="p-10">
                        <div className="flex justify-between items-start mb-10 pb-10 border-b border-gray-50">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Transaction ID</p>
                                <h4 className="text-4xl font-black text-gray-900 tracking-tighter">#{item.id}</h4>
                                <div className="mt-4 flex gap-4">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${item.revenueExpenseType === RevenueExpenseType.REVENUE ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
                                        }`}>
                                        {item.revenueExpenseType === RevenueExpenseType.REVENUE ? <ArrowTrendingUpIcon className="h-3 w-3 mr-1" /> : <ArrowTrendingDownIcon className="h-3 w-3 mr-1" />}
                                        {item.revenueExpenseType}
                                    </span>
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                                        <TagIcon className="h-3 w-3 mr-1" />
                                        {item.revenueExpenseCategory.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Date Recorded</p>
                                <p className="text-xl font-bold text-gray-900">{new Date(item.transactionDate).toLocaleDateString()}</p>
                                <p className="text-sm text-gray-500 mt-1 flex items-center justify-end gap-1">
                                    <CalendarIcon className="h-4 w-4" /> {new Date(item.transactionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-12 mb-10">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Account Details</p>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-cyan-50 rounded-2xl text-cyan-600">
                                            <BuildingOfficeIcon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">General Ledger Account</p>
                                            <p className="text-lg font-black text-gray-900">{item.generalAccount?.accountName || "N/A"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                                            <BanknotesIcon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Payment Method</p>
                                            <p className="text-lg font-black text-gray-900">{item.paymentMethod || "CASH / UNDEFINED"}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Verification</p>
                                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter mb-1">Reference Number</p>
                                    <p className="text-xl font-black text-gray-900 font-mono italic tracking-tighter">{item.referenceNumber || "NO REF PROVIDED"}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-10">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Primary Description</p>
                            <div className="p-8 bg-gray-900 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
                                <div className="relative z-10">
                                    <p className="text-gray-400 text-xs italic mb-4 leading-relaxed max-w-md">"{item.description}"</p>
                                    <div className="flex items-end gap-2">
                                        <span className="text-gray-500 font-black text-xl mb-1">$</span>
                                        <span className="text-6xl font-black font-mono italic tracking-tighter text-cyan-400">{item.amount.toFixed(2)}</span>
                                    </div>
                                </div>
                                <DocumentTextIcon className="absolute -right-10 -bottom-10 h-64 w-64 text-white/5" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hidden Voucher for Printing */}
                <div ref={voucherRef} className="hidden">
                    <div className="header">
                        <h2>Official Transaction Voucher</h2>
                        <div className="voucher-type">#{item.id} - {item.revenueExpenseType}</div>
                    </div>

                    <div className="grid">
                        <div>
                            <div className="label">Account</div>
                            <div className="value">{item.generalAccount?.accountName}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div className="label">Date</div>
                            <div className="value">{new Date(item.transactionDate).toLocaleDateString()}</div>
                        </div>
                        <div>
                            <div className="label">Category</div>
                            <div className="value">{item.revenueExpenseCategory}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div className="label">Reference</div>
                            <div className="value">{item.referenceNumber || 'N/A'}</div>
                        </div>
                    </div>

                    <div className="label">Description</div>
                    <div className="value" style={{ marginBottom: '40px', padding: '15px', background: '#f9fafb', borderRadius: '8px' }}>
                        {item.description}
                    </div>

                    <div className="amount-box">
                        <div className="amount-label">Total Amount (USD)</div>
                        <div className="amount-value">${item.amount.toFixed(2)}</div>
                    </div>

                    <div className="footer">
                        This is a computer-generated voucher. No signature is required.
                        Generated on {new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ExpenseRevenueDetails;
