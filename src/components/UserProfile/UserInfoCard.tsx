import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ToasterService } from "../../Services/ToasterService";
import {
    PencilSquareIcon,
    EnvelopeIcon,
    BriefcaseIcon,
    UserCircleIcon,
    CheckCircleIcon,
    XCircleIcon,
    BuildingOfficeIcon,
    UserGroupIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";

interface UserData {
    userId: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    active: boolean;
    userType: string;
    tenantId: string;
    superAdmin: boolean;
    designation?: string;
    department?: any;
    officialEmail?: string;
}

export default function UserInfoCard() {
    const { isOpen, openModal, closeModal } = useModal();
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { user } = useContext(AuthContext);
    const [editForm, setEditForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        officialEmail: "",
        designation: ""
    });

    const getAuthToken = () => localStorage.getItem("accessToken");

    const fetchUserData = async () => {
        try {
            setLoading(true);
            const token = getAuthToken();
            const userId = user?.userId;

            if (!token || !userId) return;

            const response = await fetch(`/v1/api/user/getUserById/${userId}`, {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            });

            if (response.ok) {
                const data: UserData = await response.json();
                setUserData(data);
                setEditForm({
                    firstName: data.firstName || "",
                    lastName: data.lastName || "",
                    email: data.email || "",
                    officialEmail: data.officialEmail || "",
                    designation: data.designation || ""
                });
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUserData();
    }, [user]);

    const handleSave = async () => {
        try {
            setSaving(true);
            const token = getAuthToken();
            const userId = user?.userId;

            if (!token || !userId) {
                ToasterService.error("Authentication required");
                return;
            }

            const updateData = {
                userId: userId,
                firstName: editForm.firstName,
                lastName: editForm.lastName,
                email: editForm.email,
                officialEmail: editForm.officialEmail,
                designation: editForm.designation
            };

            const response = await fetch(`/v1/api/user/update`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
            });

            if (response.ok) {
                ToasterService.success("Profile updated successfully!");
                closeModal();
                fetchUserData();
            } else {
                throw new Error("Failed to update profile");
            }
        } catch (error: any) {
            ToasterService.error(error.message || "Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const handleInputChange = (field: string, value: string) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    if (loading) {
        return (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-2"></div>
                                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const getFullName = () => `${userData?.firstName || ""} ${userData?.lastName || ""}`.trim() || "N/A";

    return (
        <>
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-100 rounded-lg">
                                <UserCircleIcon className="h-5 w-5 text-cyan-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
                        </div>
                        <button
                            onClick={openModal}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                        >
                            <PencilSquareIcon className="h-4 w-4 text-cyan-600" />
                            Edit Info
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="group p-4 bg-gray-50/50 rounded-lg border border-gray-100 hover:border-cyan-200 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Full Name</p>
                                    <p className="text-sm font-semibold text-gray-900">{getFullName()}</p>
                                </div>
                                <UserCircleIcon className="h-5 w-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                            </div>
                        </div>

                        <div className="group p-4 bg-gray-50/50 rounded-lg border border-gray-100 hover:border-cyan-200 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Email Address</p>
                                    <p className="text-sm font-medium text-gray-900 break-all">{userData?.email || "N/A"}</p>
                                </div>
                                <EnvelopeIcon className="h-5 w-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                            </div>
                        </div>

                        <div className="group p-4 bg-gray-50/50 rounded-lg border border-gray-100 hover:border-cyan-200 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Official Email</p>
                                    <p className="text-sm font-medium text-gray-900">{userData?.officialEmail || "Not set"}</p>
                                </div>
                                <BuildingOfficeIcon className="h-5 w-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                            </div>
                        </div>

                        <div className="group p-4 bg-gray-50/50 rounded-lg border border-gray-100 hover:border-cyan-200 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">User Type</p>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        <UserGroupIcon className="h-3 w-3" />
                                        {userData?.userType?.replace('_', ' ') || "User"}
                                    </span>
                                </div>
                                <BriefcaseIcon className="h-5 w-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                            </div>
                        </div>

                        <div className="group p-4 bg-gray-50/50 rounded-lg border border-gray-100 hover:border-cyan-200 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Designation</p>
                                    <p className="text-sm font-medium text-gray-900">{userData?.designation || "Not set"}</p>
                                </div>
                                <BuildingOfficeIcon className="h-5 w-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                            </div>
                        </div>

                        <div className="group p-4 bg-gray-50/50 rounded-lg border border-gray-100 hover:border-cyan-200 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Status</p>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${userData?.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {userData?.active ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
                                        {userData?.active ? "Active" : "Inactive"}
                                    </span>
                                </div>
                                {userData?.active ? <CheckCircleIcon className="h-5 w-5 text-green-500" /> : <XCircleIcon className="h-5 w-5 text-red-500" />}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[600px] m-4">
                <div className="relative w-full bg-white rounded-xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <PencilSquareIcon className="h-5 w-5 text-cyan-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Edit Personal Information</h3>
                                    <p className="text-sm text-gray-500">Update your personal details</p>
                                </div>
                            </div>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium text-gray-700">First Name</Label>
                                    <Input type="text" value={editForm.firstName} onChange={(e) => handleInputChange("firstName", e.target.value)} />
                                </div>
                                <div>
                                    <Label className="text-sm font-medium text-gray-700">Last Name</Label>
                                    <Input type="text" value={editForm.lastName} onChange={(e) => handleInputChange("lastName", e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-gray-700">Email Address</Label>
                                <Input type="email" value={editForm.email} onChange={(e) => handleInputChange("email", e.target.value)} />
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-gray-700">Official Email</Label>
                                <Input type="email" value={editForm.officialEmail} onChange={(e) => handleInputChange("officialEmail", e.target.value)} placeholder="work@company.com" />
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-gray-700">Designation</Label>
                                <Input type="text" value={editForm.designation} onChange={(e) => handleInputChange("designation", e.target.value)} placeholder="e.g., Senior Software Engineer" />
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex justify-end gap-3">
                        <Button variant="outline" onClick={closeModal} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
