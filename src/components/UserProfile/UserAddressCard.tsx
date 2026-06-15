import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ToasterService } from "../../Services/ToasterService";
import {
    MapPinIcon,
    BuildingOfficeIcon,
    IdentificationIcon,
    GlobeAltIcon,
    PencilSquareIcon,
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

export default function UserAddressCard() {
    const { isOpen, openModal, closeModal } = useModal();
    const { user } = useContext(AuthContext);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [formData, setFormData] = useState({
        tenantId: "",
    });

    const getAuthToken = () => localStorage.getItem('accessToken');

    const fetchUserData = async () => {
        const userId = user?.userId;
        
        if (!userId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const authToken = getAuthToken();
            if (!authToken) throw new Error("No authentication token");

            const response = await fetch(`/v1/api/user/getUserById/${userId}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            });

            if (response.ok) {
                const data = await response.json();
                setUserData(data);
                setFormData({
                    tenantId: data.tenantId || "",
                });
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUserData();
    }, [user]);

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        const userId = user?.userId;
        
        if (!userId) {
            ToasterService.error("User not authenticated");
            return;
        }

        setIsSaving(true);
        try {
            const authToken = getAuthToken();
            if (!authToken) throw new Error("No authentication token found");

            const updatePayload = {
                userId: userId,
                tenantId: formData.tenantId,
            };

            const response = await fetch('/v1/api/user/update', {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });

            if (response.ok) {
                ToasterService.success("Tenant information updated successfully!");
                closeModal();
                fetchUserData();
            } else {
                throw new Error("Failed to update");
            }
        } catch (error: any) {
            ToasterService.error(error.message || "Failed to update");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[...Array(3)].map((_, i) => (
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

    return (
        <>
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-100 rounded-lg">
                                <MapPinIcon className="h-5 w-5 text-cyan-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Organization Information</h3>
                        </div>
                        <button
                            onClick={openModal}
                            disabled={isLoading}
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
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">User ID</p>
                                    <p className="text-sm font-semibold text-gray-900">{userData?.userId || "N/A"}</p>
                                </div>
                                <IdentificationIcon className="h-5 w-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                            </div>
                        </div>

                        <div className="group p-4 bg-gray-50/50 rounded-lg border border-gray-100 hover:border-cyan-200 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Tenant ID</p>
                                    <p className="text-sm font-semibold text-gray-900">{userData?.tenantId || "N/A"}</p>
                                </div>
                                <BuildingOfficeIcon className="h-5 w-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                            </div>
                        </div>

                        <div className="group p-4 bg-gray-50/50 rounded-lg border border-gray-100 hover:border-cyan-200 hover:shadow-sm transition-all">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Username</p>
                                    <p className="text-sm font-semibold text-gray-900">{userData?.username || "N/A"}</p>
                                </div>
                                <GlobeAltIcon className="h-5 w-5 text-gray-400 group-hover:text-cyan-500 transition-colors" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[500px] m-4">
                <div className="relative w-full bg-white rounded-xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <BuildingOfficeIcon className="h-5 w-5 text-cyan-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Edit Organization Info</h3>
                                    <p className="text-sm text-gray-500">Update your tenant information</p>
                                </div>
                            </div>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-medium text-gray-700">Tenant ID</Label>
                                <Input 
                                    type="text" 
                                    value={formData.tenantId}
                                    onChange={(e) => handleInputChange('tenantId', e.target.value)}
                                    placeholder="Enter tenant ID"
                                    disabled={isSaving}
                                />
                                <p className="mt-1 text-xs text-gray-500">This identifies your organization in the system</p>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex justify-end gap-3">
                        <Button variant="outline" onClick={closeModal} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-cyan-600 hover:bg-cyan-700">
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
