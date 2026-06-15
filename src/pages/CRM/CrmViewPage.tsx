import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import {
  ArrowLeftIcon,
  BuildingOfficeIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  TagIcon,
  DocumentTextIcon,
  MapPinIcon,
  GlobeAltIcon,
  BriefcaseIcon,
  IdentificationIcon,
  ChevronRightIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
const BASE_URL = "/v1/api/crm";

// System fields to hide from display
const HIDDEN_KEYS = [
  "id",
  "tenantId",
  "createdBy",
  "updatedBy",
  "deletedBy",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "createdDate",
  "updatedDate",
  "deletedDate",
  "createdOn",
  "updatedOn",
  "deletedOn",
  "isDeleted",
  "isActive",
  "version",
  "revision",
];

// Field type mappings for better icon selection
const FIELD_ICONS: Record<string, any> = {
  name: UserIcon,
  fullName: UserIcon,
  companyName: BuildingOfficeIcon,
  email: EnvelopeIcon,
  phone: PhoneIcon,
  address: MapPinIcon,
  website: GlobeAltIcon,
  industry: BriefcaseIcon,
  status: TagIcon,
  registrationDate: CalendarIcon,
  description: DocumentTextIcon,
  notes: DocumentTextIcon,
  code: IdentificationIcon,
  type: TagIcon,
  category: TagIcon,
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  INACTIVE: "bg-red-100 text-red-800 border-red-200",
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  NEW: "bg-blue-100 text-blue-800 border-blue-200",
  CONTACTED: "bg-purple-100 text-purple-800 border-purple-200",
  QUALIFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  LOST: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function CrmViewPage() {
  const { id, requestFrom: paramRequestFrom } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const token = localStorage.getItem("accessToken");
  const requestFrom = paramRequestFrom || location.state?.from;

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "related">("details");

  useEffect(() => {
    if (!token) {
      ToasterService.error("Token Expired. Please login to view this page");
      navigate("/auth/login");
      return;
    }
    fetchData();
  }, [id, requestFrom]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const url = `${BASE_URL}/${requestFrom}/${id}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch data. Please try again.");
      setLoading(false);
    }
  };

  // Filter out hidden keys and system fields
  const filterDisplayData = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => filterDisplayData(item));
    }

    return Object.fromEntries(
      Object.entries(obj)
        .filter(([key]) => !HIDDEN_KEYS.includes(key) && !key.startsWith('_'))
        .map(([key, value]) => [key, filterDisplayData(value)])
    );
  };

  const getFieldIcon = (key: string) => {
    const IconComponent = FIELD_ICONS[key.toLowerCase()] || DocumentTextIcon;
    return IconComponent;
  };

  const renderStatusBadge = (status: string) => {
    const colorClass = STATUS_COLORS[status.toUpperCase()] || "bg-gray-100 text-gray-800 border-gray-200";
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
        {status}
      </span>
    );
  };

  const renderValue = (key: string, value: any) => {
    if (value === null || value === "") return <span className="text-gray-400 italic">Not provided</span>;

    if (typeof value === "string" && key.toLowerCase().includes("date")) {
      return (
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <span>{formatDate(value)}</span>
        </div>
      );
    }

    if (key.toLowerCase().includes("status")) {
      return renderStatusBadge(value);
    }

    if (key.toLowerCase().includes("email") && typeof value === "string") {
      return (
        <a href={`mailto:${value}`} className="text-cyan-600 hover:text-cyan-700 hover:underline flex items-center gap-1">
          <EnvelopeIcon className="h-4 w-4" />
          {value}
        </a>
      );
    }

    if (key.toLowerCase().includes("phone") && typeof value === "string") {
      return (
        <a href={`tel:${value}`} className="text-cyan-600 hover:text-cyan-700 hover:underline flex items-center gap-1">
          <PhoneIcon className="h-4 w-4" />
          {value}
        </a>
      );
    }

    if (key.toLowerCase().includes("website") && typeof value === "string") {
      return (
        <a
          href={value.startsWith('http') ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-600 hover:text-cyan-700 hover:underline flex items-center gap-1"
        >
          <GlobeAltIcon className="h-4 w-4" />
          {value.replace(/^https?:\/\//, '')}
        </a>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-400 italic">No items</span>;

      if (typeof value[0] === "object") {
        const filteredArray = filterDisplayData(value);
        return (
          <div className="space-y-3 mt-2">
            {filteredArray.map((item: any, i: number) => (
              <div
                key={i}
                className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(item).map(([subKey, subValue]) => (
                    <div key={subKey} className="flex flex-col">
                      <span className="text-xs text-gray-500 capitalize mb-1">{subKey}</span>
                      <div className="text-sm font-medium text-gray-900">
                        {renderValue(subKey, subValue)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      }
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((item, i) => (
            <span key={i} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs">
              {item}
            </span>
          ))}
        </div>
      );
    }

    if (typeof value === "object" && value !== null) {
      const filteredObject = filterDisplayData(value);
      if (Object.keys(filteredObject).length === 0) return null;

      return (
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          {Object.entries(filteredObject).map(([subKey, subValue]) => (
            <div key={subKey} className="flex flex-col">
              <span className="text-xs text-gray-500 capitalize">{subKey}</span>
              <div className="text-sm font-medium text-gray-900 ml-2">
                {renderValue(subKey, subValue)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return String(value);
  };

  const getEntityIcon = () => {
    switch (requestFrom?.toLowerCase()) {
      case 'customers':
        return BuildingOfficeIcon;
      case 'contacts':
        return UserIcon;
      case 'leads':
        return BriefcaseIcon;
      default:
        return DocumentTextIcon;
    }
  };

  const EntityIcon = getEntityIcon();

  // Get display data without hidden fields
  const displayData = filterDisplayData(data);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageMeta title={`${requestFrom} View`} description={`${requestFrom} View`} />
        <PageBreadcrumb pageTitle={requestFrom ?? "CRM"} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="animate-pulse">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-10 w-24 bg-gray-200 rounded-lg"></div>
                <div className="h-8 w-48 bg-gray-200 rounded-lg"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageMeta title={`${requestFrom} View`} description={`${requestFrom} View`} />
        <PageBreadcrumb pageTitle={requestFrom ?? "CRM"} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
            <p className="text-gray-500 mb-6">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || Object.keys(displayData).length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageMeta title={`${requestFrom} View`} description={`${requestFrom} View`} />
        <PageBreadcrumb pageTitle={requestFrom ?? "CRM"} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-500 mb-6">The requested information could not be found.</p>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Extract key fields for header
  const nameField = displayData.name || displayData.fullName || displayData.companyName || displayData.title || `${requestFrom} Details`;
  const statusField = displayData.status || displayData.state;

  // Separate address and notes from other fields
  const addressField = displayData.address;
  const notesField = displayData.notes || displayData.description;

  // Get all other fields (excluding address, notes, and any object types for main grid)
  const mainFields = Object.entries(displayData)
    .filter(([key, value]) =>
      key !== 'address' &&
      key !== 'notes' &&
      key !== 'description' &&
      !key.toLowerCase().includes('address') &&
      !key.toLowerCase().includes('note') &&
      !key.toLowerCase().includes('description') &&
      typeof value !== 'object'
    );

  return (
    <>
      <PageMeta title={`${requestFrom} View`} description={`${requestFrom} View`} />
      <PageBreadcrumb pageTitle={requestFrom ?? "CRM"} />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header with Gradient */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl shadow-lg mb-6 p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors backdrop-blur-sm"
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <EntityIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold flex items-center !text-white gap-2">
                      {typeof nameField === 'string' ? nameField : requestFrom}
                      {statusField && (
                        <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full border border-white/30 ${STATUS_COLORS[statusField.toUpperCase()]?.replace('text-', 'text-').replace('bg-', 'bg-') || 'bg-white/20 text-white'
                          }`}>
                          {statusField}
                        </span>
                      )}
                    </h1>
                    <p className="text-cyan-100 text-sm mt-1">
                      {requestFrom} • ID: {id}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const sourcePath = requestFrom === 'leads' ? '/leads' :
                      requestFrom === 'customers' ? '/customer-management' :
                        requestFrom === 'contacts' ? '/contactPerson' :
                          requestFrom === 'opportunities' ? '/opportunities' :
                            requestFrom === 'segments' ? '/customer-segment' : '/';
                    navigate(`${sourcePath}?editId=${id}`);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-cyan-700 font-semibold rounded-xl hover:bg-cyan-50 transition-all shadow-md active:scale-95"
                >
                  <PencilSquareIcon className="h-4 w-4" />
                  Edit {requestFrom?.replace('s', '')}
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-t-xl border-b border-gray-200 px-4">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("details")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "details"
                  ? "border-cyan-600 text-cyan-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab("related")}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "related"
                  ? "border-cyan-600 text-cyan-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
              >
                Related Items
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-200 p-6">
            {activeTab === "details" ? (
              <div className="space-y-6">
                {/* Key Metrics Cards - Show important fields first */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {mainFields.slice(0, 4).map(([key, value]) => {
                    const Icon = getFieldIcon(key);
                    return (
                      <div key={key} className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-xs uppercase tracking-wider">{key}</span>
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {renderValue(key, value)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Main Details Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Main Info */}
                  {mainFields.length > 4 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                        General Information
                      </h3>

                      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                        {mainFields.slice(4).map(([key, value]) => {
                          const Icon = getFieldIcon(key);
                          return (
                            <div key={key} className="flex items-start gap-3 p-2 hover:bg-white rounded-lg transition-colors">
                              <div className="p-1.5 bg-white rounded-lg shadow-sm">
                                <Icon className="h-4 w-4 text-gray-500" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-gray-500 capitalize mb-0.5">{key}</p>
                                <div className="text-sm font-medium text-gray-900">
                                  {renderValue(key, value)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Additional fields if any */}
                </div>

                {/* Address Section */}
                {addressField && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <MapPinIcon className="h-5 w-5 text-cyan-600" />
                      Address Information
                    </h3>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                      {typeof addressField === 'string' ? (
                        <p className="text-gray-900">{addressField}</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(addressField)
                            .filter(([key]) => !HIDDEN_KEYS.includes(key))
                            .map(([key, value]) => (
                              <div key={key}>
                                <p className="text-xs text-gray-500 capitalize mb-1">{key}</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {renderValue(key, value)}
                                </p>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes Section */}
                {notesField && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                      Notes
                    </h3>

                    <div className="bg-gray-50 rounded-xl p-6">
                      <p className="text-gray-700 whitespace-pre-wrap">{notesField}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Related Items Tab
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Items</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Communications */}
                  <div className="bg-gray-50 rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/communication-history?${requestFrom?.replace('s', '')}Id=${id}`)}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-100 rounded-lg">
                          <EnvelopeIcon className="h-5 w-5 text-cyan-600" />
                        </div>
                        <h4 className="font-medium text-gray-900">Communications</h4>
                      </div>
                      <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500">View all communications related to this {requestFrom}</p>
                  </div>

                  {/* Contacts (for Customers/Leads) */}
                  {(requestFrom === 'customers' || requestFrom === 'leads') && (
                    <div className="bg-gray-50 rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/contactPerson?${requestFrom?.replace('s', '')}Id=${id}`)}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <UserIcon className="h-5 w-5 text-purple-600" />
                          </div>
                          <h4 className="font-medium text-gray-900">Contacts</h4>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500">View all contacts associated with this {requestFrom}</p>
                    </div>
                  )}

                  {/* Segments (for Customers) */}
                  {requestFrom === 'customers' && (
                    <div className="bg-gray-50 rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/customer-segment?customerId=${id}`)}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <TagIcon className="h-5 w-5 text-green-600" />
                          </div>
                          <h4 className="font-medium text-gray-900">Segments</h4>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500">View customer segments and groupings</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
