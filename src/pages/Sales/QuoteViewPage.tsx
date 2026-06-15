import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  XMarkIcon,
  CalendarIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  ArrowLeftIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { BackButton } from "../../components/common/BackButton";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Status = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";

interface Product {
  id: number;
  name: string;
  price: number;
  availableStock: number;
}

interface QuotationItem {
  id?: number;
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  totalPrice: number;
}

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  billingAddress?: string;
  shippingAddress?: string;
  gst?: string;
}

interface Quotation {
  id: number;
  quoteNumber?: string;
  customer?: Customer;
  validUntil: string;
  status: Status;
  items: QuotationItem[];
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  remarks: string;
  createdAt?: string;
  referenceNumber?: string;
  quoteDate?: string;
  salesperson?: string;
  projectName?: string;
  subject?: string;
  termsConditions?: string;
}

const statusColors: Record<Status, { bg: string; text: string; icon: React.ReactElement }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-800", icon: <DocumentTextIcon className="h-3 w-3 mr-1" /> },
  SENT: { bg: "bg-blue-100", text: "text-blue-800", icon: <ClockIcon className="h-3 w-3 mr-1" /> },
  ACCEPTED: { bg: "bg-green-100", text: "text-green-800", icon: <CheckCircleIcon className="h-3 w-3 mr-1" /> },
  REJECTED: { bg: "bg-red-100", text: "text-red-800", icon: <XCircleIcon className="h-3 w-3 mr-1" /> },
};

const QuoteViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const headers = { Authorization: `Bearer ${token}` };

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchQuotationDetails();
    }
  }, [id]);

  const fetchQuotationDetails = async () => {
    try {
      const res = await fetch(`/v1/api/sales/quotations/${id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setQuotation(data);
      } else {
        setError("Failed to load quotation details");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!quotation) return;

    const exportData = [
      {
        "Quote Number": quotation.quoteNumber || "DRAFT",
        "Quote Date": quotation.quoteDate || "",
        "Valid Until": quotation.validUntil,
        "Status": quotation.status,
        "Customer Name": quotation.customer?.name || "",
        "Customer Email": quotation.customer?.email || "",
        "Customer Phone": quotation.customer?.phone || "",
        "Salesperson": quotation.salesperson || "",
        "Project Name": quotation.projectName || "",
        "Subject": quotation.subject || "",
        "Total Amount": quotation.totalAmount,
        "Discount Amount": quotation.discountAmount,
        "Tax Amount": quotation.taxAmount,
        "Grand Total": quotation.grandTotal,
        "Remarks": quotation.remarks || "",
      }
    ];

    // Add line items as separate rows
    quotation.items.forEach((item) => {
      exportData.push({
        "Quote Number": "",
        "Quote Date": "",
        "Valid Until": "",
        "Status": quotation.status,
        "Customer Name": "",
        "Customer Email": "",
        "Customer Phone": "",
        "Salesperson": "",
        "Project Name": "",
        "Subject": "",
        "Total Amount": 0,
        "Discount Amount": 0,
        "Tax Amount": 0,
        "Grand Total": 0,
        "Remarks": "",
        ...{
          "Product": item.product.name,
          "Quantity": item.quantity,
          "Unit Price": item.unitPrice,
          "Discount %": item.discount,
          "Tax %": item.tax,
          "Line Total": item.totalPrice,
        }
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quotation Details");
    XLSX.writeFile(wb, `Quotation_${quotation.quoteNumber || quotation.id}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportToPDF = () => {
    if (!quotation) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header with logo area
    doc.setFillColor(0, 102, 204);
    doc.rect(0, 0, pageWidth, 45, "F");
    
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text("QUOTATION", 14, 28);
    
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(`Quote #: ${quotation.quoteNumber || "DRAFT"}`, pageWidth - 14, 20, { align: "right" });
    doc.text(`Date: ${quotation.quoteDate || new Date().toLocaleDateString()}`, pageWidth - 14, 28, { align: "right" });
    doc.text(`Valid Until: ${new Date(quotation.validUntil).toLocaleDateString()}`, pageWidth - 14, 36, { align: "right" });
    
    let yPos = 60;
    
    // Company Info
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("MYTRADE INC.", 14, yPos);
    doc.text("123 Business Avenue", 14, yPos + 5);
    doc.text("Chennai - 600001, India", 14, yPos + 10);
    doc.text("GST: 33ABCDE1234F1Z5", 14, yPos + 15);
    
    // Status Badge
    const statusColor = quotation.status === "ACCEPTED" ? [34, 197, 94] : 
                        quotation.status === "REJECTED" ? [239, 68, 68] : 
                        quotation.status === "SENT" ? [59, 130, 246] : [107, 114, 128];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(pageWidth - 50, yPos, 45, 8, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(quotation.status, pageWidth - 27.5, yPos + 5.5, { align: "center" });
    
    yPos += 30;
    
    // Customer Info
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Bill To:", 14, yPos);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(quotation.customer?.name || "N/A", 14, yPos + 6);
    if (quotation.customer?.billingAddress) {
      const addressLines = quotation.customer.billingAddress.split('\n');
      addressLines.forEach((line, idx) => {
        doc.text(line, 14, yPos + 12 + (idx * 4));
      });
    }
    if (quotation.customer?.gst) {
      doc.text(`GST: ${quotation.customer.gst}`, 14, yPos + (quotation.customer.billingAddress ? 24 : 18));
    }
    
    // Contact Info
    let contactY = yPos;
    if (quotation.customer?.email) {
      doc.text(`Email: ${quotation.customer.email}`, pageWidth - 80, contactY);
      contactY += 5;
    }
    if (quotation.customer?.phone) {
      doc.text(`Phone: ${quotation.customer.phone}`, pageWidth - 80, contactY);
    }
    
    yPos += 50;
    
    // Quote Details
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    if (quotation.projectName) doc.text(`Project: ${quotation.projectName}`, 14, yPos);
    if (quotation.salesperson) doc.text(`Salesperson: ${quotation.salesperson}`, 14, yPos + (quotation.projectName ? 5 : 0));
    if (quotation.subject) doc.text(`Subject: ${quotation.subject}`, 14, yPos + ((quotation.projectName ? 5 : 0) + (quotation.salesperson ? 5 : 0)));
    
    yPos += (quotation.projectName || quotation.salesperson || quotation.subject) ? 20 : 10;
    
    // Line Items Table
    const tableData = quotation.items.map(item => [
      item.product.name,
      item.quantity.toString(),
      `₹${item.unitPrice.toFixed(2)}`,
      `${item.discount}%`,
      `${item.tax}%`,
      `₹${item.totalPrice.toFixed(2)}`,
    ]);
    
    autoTable(doc, {
      head: [["Product / Service", "Qty", "Unit Price", "Discount", "Tax", "Amount"]],
      body: tableData,
      startY: yPos,
      theme: "striped",
      headStyles: { 
        fillColor: [0, 102, 204], 
        textColor: 255, 
        fontSize: 9,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 25, halign: "right" },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 30, halign: "right" },
      },
    });
    
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // Totals
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`Subtotal:`, pageWidth - 50, finalY);
    doc.text(`₹${quotation.totalAmount.toFixed(2)}`, pageWidth - 14, finalY, { align: "right" });
    
    doc.text(`Discount:`, pageWidth - 50, finalY + 6);
    doc.text(`-₹${quotation.discountAmount.toFixed(2)}`, pageWidth - 14, finalY + 6, { align: "right" });
    
    doc.text(`Tax (GST):`, pageWidth - 50, finalY + 12);
    doc.text(`₹${quotation.taxAmount.toFixed(2)}`, pageWidth - 14, finalY + 12, { align: "right" });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Grand Total:`, pageWidth - 60, finalY + 22);
    doc.setTextColor(0, 102, 204);
    doc.text(`₹${quotation.grandTotal.toFixed(2)}`, pageWidth - 14, finalY + 22, { align: "right" });
    
    // Amount in words
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(`Amount in words: Rupees ${numberToWords(Math.floor(quotation.grandTotal))} only`, 14, finalY + 22);
    
    finalY += 45;
    
    // Terms & Conditions
    if (quotation.termsConditions) {
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text("Terms & Conditions:", 14, finalY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const termsLines = doc.splitTextToSize(quotation.termsConditions, pageWidth - 28);
      doc.text(termsLines, 14, finalY + 6);
      finalY += 10 + (termsLines.length * 4);
    }
    
    // Remarks
    if (quotation.remarks) {
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text("Remarks:", 14, finalY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      const remarksLines = doc.splitTextToSize(quotation.remarks, pageWidth - 28);
      doc.text(remarksLines, 14, finalY + 6);
      finalY += 10 + (remarksLines.length * 4);
    }
    
    // Bank Details
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Bank Details:", 14, finalY + 10);
    doc.text("Bank: HDFC Bank | Account: 1234567890 | IFSC: HDFC0001234", 14, finalY + 16);
    
    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("This is a computer generated document and does not require a signature.", pageWidth / 2, 275, { align: "center" });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, 282, { align: "center" });
    
    doc.save(`Quotation_${quotation.quoteNumber || quotation.id}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEdit = () => {
    navigate(`/quotations/edit/${id}`);
  };

  if (loading) {
    return (
      <>
        <PageMeta title="Loading Quotation" description="Loading quotation details" />
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
          </div>
        </div>
      </>
    );
  }

  if (error || !quotation) {
    return (
      <>
        <PageMeta title="Quotation Not Found" description="Quotation not found" />
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="flex flex-col items-center">
              <DocumentTextIcon className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Quotation Not Found</h3>
              <p className="text-sm text-gray-500 mb-6">{error || "The quotation you're looking for doesn't exist or has been removed."}</p>
              <button
                onClick={() => navigate("/quotations")}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                Back to Quotations
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta title={`Quotation ${quotation.quoteNumber || "DRAFT"}`} description="View quotation details" />
      <PageBreadcrumb pageTitle={`Quotation ${quotation.quoteNumber || "DRAFT"}`} />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header Actions */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quotation Details</h1>
              <p className="text-sm text-gray-500 mt-0.5">Quote #{quotation.quoteNumber || "DRAFT"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <PrinterIcon className="h-4 w-4" />
              Print
            </button>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={exportToPDF}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
            >
              <DocumentTextIcon className="h-4 w-4" />
              PDF
            </button>
            {quotation.status === "DRAFT" && (
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Edit Quotation
              </button>
            )}
          </div>
        </div>

        {/* Quotation Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:shadow-none">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[quotation.status].bg} ${statusColors[quotation.status].text}`}>
                    {statusColors[quotation.status].icon}{quotation.status}
                  </span>
                  {quotation.validUntil && new Date(quotation.validUntil) < new Date() && quotation.status !== "ACCEPTED" && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                      Expired
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{quotation.quoteNumber || "DRAFT"}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Created on {new Date(quotation.createdAt || "").toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Valid Until</p>
                <p className="text-lg font-semibold text-gray-900">{new Date(quotation.validUntil).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Customer & Quote Info */}
          <div className="p-6 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Customer Information</h3>
                <div className="space-y-2">
                  <p className="text-base font-medium text-gray-900">{quotation.customer?.name}</p>
                  {quotation.customer?.email && (
                    <p className="text-sm text-gray-600">Email: {quotation.customer.email}</p>
                  )}
                  {quotation.customer?.phone && (
                    <p className="text-sm text-gray-600">Phone: {quotation.customer.phone}</p>
                  )}
                  {quotation.customer?.billingAddress && (
                    <div className="text-sm text-gray-600">
                      <p className="font-medium mb-1">Billing Address:</p>
                      <p className="whitespace-pre-line">{quotation.customer.billingAddress}</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Quote Information</h3>
                <div className="space-y-2">
                  {quotation.referenceNumber && (
                    <p className="text-sm text-gray-600">Reference #: {quotation.referenceNumber}</p>
                  )}
                  <p className="text-sm text-gray-600">Quote Date: {quotation.quoteDate || new Date(quotation.createdAt || "").toLocaleDateString()}</p>
                  {quotation.salesperson && (
                    <p className="text-sm text-gray-600">Salesperson: {quotation.salesperson}</p>
                  )}
                  {quotation.projectName && (
                    <p className="text-sm text-gray-600">Project: {quotation.projectName}</p>
                  )}
                  {quotation.subject && (
                    <p className="text-sm text-gray-600">Subject: {quotation.subject}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Line Items</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product / Service</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tax</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotation.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{item.product.name}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">₹{item.unitPrice.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{item.discount}%</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{item.tax}%</td>
                      <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">₹{item.totalPrice.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Section */}
          <div className="p-6 bg-gray-50">
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">₹{quotation.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-medium text-red-600">-₹{quotation.discountAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax (GST):</span>
                  <span className="font-medium">₹{quotation.taxAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-2 border-t border-gray-200">
                  <span className="text-gray-900">Grand Total:</span>
                  <span className="text-cyan-600">₹{quotation.grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="p-6 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {quotation.remarks && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Remarks</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{quotation.remarks}</p>
                </div>
              )}
              {quotation.termsConditions && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</h3>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{quotation.termsConditions}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 text-center text-xs text-gray-400">
            <p>This is a computer generated document and does not require a signature.</p>
            <p className="mt-1">For any queries, please contact support@mytrade.com or call +91 44 1234 5678</p>
          </div>
        </div>
      </div>
    </>
  );
};

// Helper function to convert numbers to words
function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  
  function convertToWords(n: number): string {
    if (n === 0) return "";
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convertToWords(n % 100) : "");
    if (n < 100000) return convertToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convertToWords(n % 1000) : "");
    if (n < 10000000) return convertToWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + convertToWords(n % 100000) : "");
    return convertToWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + convertToWords(n % 10000000) : "");
  }
  
  return convertToWords(num);
}

export default QuoteViewPage;