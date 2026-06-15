import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../../context/AuthContext";
import { ToasterService } from "../../Services/ToasterService";
import {
    CameraIcon,
    PencilSquareIcon,
    XMarkIcon,
    EnvelopeIcon,
    BriefcaseIcon,
    LinkIcon,
    PencilIcon
} from "@heroicons/react/24/outline";
import Cropper from "../common/SimpleImageCropper";
import { getCroppedImg } from "../../utils/cropImage";

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
    roles?: any[];
    permissions?: any[];
}

interface SocialMediaForm {
    linkedinUrl: string;
    twitterUrl: string;
    facebookUrl: string;
}

interface CroppedArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

const getInitials = (firstName: string, lastName: string): string => {
    if (!firstName && !lastName) return "U";
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "U";
};

const getFullName = (firstName: string, lastName: string): string => {
    return `${firstName || ""} ${lastName || ""}`.trim() || "User";
};

const generateInitialsImage = (firstName: string, lastName: string, size: number = 200): string => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) return "";

    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#0EA5E9');
    gradient.addColorStop(1, '#3B82F6');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${size * 0.4}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const initials = getInitials(firstName, lastName);
    ctx.fillText(initials, size / 2, size / 2);

    return canvas.toDataURL('image/png');
};

const ImagePopup = ({ imageUrl, isOpen, onClose }: { imageUrl: string; isOpen: boolean; onClose: () => void }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="relative z-20 p-4">
                <div className="w-80 h-80 md:w-96 md:h-96 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
                    <img src={imageUrl} alt="Profile" className="object-cover w-full h-full" />
                </div>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                    <XMarkIcon className="w-6 h-6 text-white" />
                </button>
            </div>
        </div>
    );
};

// Crop Modal Component
const CropModal = ({ 
    imageUrl, 
    isOpen, 
    onClose, 
    onCropComplete 
}: { 
    imageUrl: string; 
    isOpen: boolean; 
    onClose: () => void; 
    onCropComplete: (croppedImageBlob: Blob) => void;
}) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedArea | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropCompleteHandler = (_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleCrop = async () => {
        if (!croppedAreaPixels) return;
        
        setIsProcessing(true);
        try {
            const croppedImage = await getCroppedImg(imageUrl, croppedAreaPixels);
            const response = await fetch(croppedImage);
            const blob = await response.blob();
            onCropComplete(blob);
            onClose();
        } catch (error) {
            console.error("Crop error:", error);
            ToasterService.error("Failed to crop image");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-gray-800 dark:to-gray-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                <PencilIcon className="h-5 w-5 text-cyan-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Crop Profile Image</h3>
                                <p className="text-sm text-gray-500">Adjust the image to fit perfectly</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="relative h-96 w-full bg-black/5">
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropCompleteHandler}
                        cropShape="round"
                        showGrid={true}
                        style={{
                            containerStyle: {
                                backgroundColor: '#f3f4f6',
                            },
                        }}
                    />
                </div>

                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="mb-4">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                            Zoom: {Math.round(zoom * 100)}%
                        </label>
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.01}
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                    </div>
                    
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button onClick={handleCrop} disabled={isProcessing} className="bg-cyan-600 hover:bg-cyan-700">
                            {isProcessing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                    Processing...
                                </>
                            ) : (
                                "Apply Crop"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function UserMetaCard() {
    const { isOpen, openModal, closeModal } = useModal();
    const [profileImage, setProfileImage] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const { user } = useContext(AuthContext);
    const [isImagePopupOpen, setIsImagePopupOpen] = useState(false);
    const [, setIsDefaultImage] = useState(true);
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [tempImageUrl, setTempImageUrl] = useState<string>("");
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [socialMediaForm, setSocialMediaForm] = useState<SocialMediaForm>({
        linkedinUrl: "",
        twitterUrl: "",
        facebookUrl: ""
    });
    const [isSavingSocialMedia, setIsSavingSocialMedia] = useState(false);

    const getAuthToken = (): string | null => localStorage.getItem('accessToken');

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
                const data = await response.json();
                setUserData(data);
                
                if (data.userSocialMedia) {
                    setSocialMediaForm({
                        linkedinUrl: data.userSocialMedia.linkedinUrl || "",
                        twitterUrl: data.userSocialMedia.twitterUrl || "",
                        facebookUrl: data.userSocialMedia.facebookUrl || ""
                    });
                }
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserImage = async () => {
        const userId = user?.userId;
        if (!userId) return;

        try {
            const authToken = getAuthToken();
            const response = await fetch(`/v1/api/user/${userId}/image`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${authToken}` },
            });

            if (response.ok) {
                const imageBlob = await response.blob();
                const imageUrl = URL.createObjectURL(imageBlob);
                setProfileImage(imageUrl);
                setIsDefaultImage(false);
            } else {
                const initialsImage = generateInitialsImage(userData?.firstName || "", userData?.lastName || "");
                setProfileImage(initialsImage);
                setIsDefaultImage(true);
            }
        } catch (error) {
            console.error("Error fetching user image:", error);
            const initialsImage = generateInitialsImage(userData?.firstName || "", userData?.lastName || "");
            setProfileImage(initialsImage);
            setIsDefaultImage(true);
        }
    };

    useEffect(() => {
        fetchUserData();
    }, [user]);

    useEffect(() => {
        if (userData) {
            fetchUserImage();
        }
    }, [userData]);

    const uploadImageToAPI = async (imageBlob: Blob, fileName: string = 'profile.png') => {
        const userId = user?.userId;
        if (!userId) throw new Error("User not authenticated");

        const authToken = getAuthToken();
        if (!authToken) throw new Error("No authentication token found");

        const formData = new FormData();
        formData.append('file', imageBlob, fileName);

        const response = await fetch(`/v1/api/user/upload_user_image/${userId}`, {
            method: 'PUT',
            body: formData,
            headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (!response.ok) throw new Error(`Upload failed with status: ${response.status}`);
        return await response.json();
    };

    const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            ToasterService.error("Please select a valid image file");
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            ToasterService.error("Image size should be less than 20MB");
            return;
        }

        // Create temporary URL for cropping
        const imageUrl = URL.createObjectURL(file);
        setTempImageUrl(imageUrl);
        setPendingFile(file);
        setIsCropModalOpen(true);
        
        // Clear the input value to allow re-uploading the same file
        event.target.value = '';
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setIsUploading(true);
        try {
            // Convert blob to file
            const croppedFile = new File([croppedBlob], pendingFile?.name || 'cropped.png', { type: croppedBlob.type });
            
            // Upload cropped image
            await uploadImageToAPI(croppedBlob, croppedFile.name);
            ToasterService.success("Profile image uploaded successfully!");
            
            // Refresh the image
            setTimeout(() => {
                fetchUserImage();
                // Clean up temporary URL
                if (tempImageUrl) {
                    URL.revokeObjectURL(tempImageUrl);
                }
            }, 1000);
        } catch (error: any) {
            console.error("Image upload error:", error);
            ToasterService.error(error.message || "Failed to upload image");
        } finally {
            setIsUploading(false);
            setTempImageUrl("");
            setPendingFile(null);
        }
    };

    const handleResetToDefault = async () => {
        const userId = user?.userId;
        if (!userId) {
            ToasterService.error("User not authenticated");
            return;
        }

        try {
            setIsUploading(true);
            const initialsImage = generateInitialsImage(userData?.firstName || "", userData?.lastName || "");
            const response = await fetch(initialsImage);
            const blob = await response.blob();
            await uploadImageToAPI(blob, 'initials.png');
            setProfileImage(initialsImage);
            setIsDefaultImage(true);
            ToasterService.success("Profile image updated to initials!");
        } catch (error: any) {
            console.error("Reset photo error:", error);
            ToasterService.error(error.message || "Failed to update profile image");
        } finally {
            setIsUploading(false);
        }
    };

    const saveSocialMediaToAPI = async (socialMediaData: SocialMediaForm) => {
        const userId = user?.userId;
        if (!userId) throw new Error("User not authenticated");

        const authToken = getAuthToken();
        if (!authToken) throw new Error("No authentication token found");

        const response = await fetch(`/v1/api/user/update_user_social_media/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(socialMediaData)
        });

        if (!response.ok) throw new Error(`Update failed with status: ${response.status}`);
        return await response.json();
    };

    const handleSaveSocialMedia = async () => {
        try {
            setIsSavingSocialMedia(true);
            await saveSocialMediaToAPI(socialMediaForm);
            ToasterService.success("Social media links updated successfully!");
            closeModal();
        } catch (error: any) {
            console.error("Social media save error:", error);
            ToasterService.error(error.message || "Failed to update social media links");
        } finally {
            setIsSavingSocialMedia(false);
        }
    };

    const handleSocialMediaChange = (field: keyof SocialMediaForm, value: string) => {
        setSocialMediaForm(prev => ({ ...prev, [field]: value }));
    };

    const getMainRole = () => {
        if (userData?.superAdmin) return "Super Administrator";
        if (userData?.userType) return userData.userType.replace('_', ' ');
        if (userData?.roles?.[0]?.role?.roleName) return userData.roles[0].role.roleName;
        return "User";
    };

    if (loading) {
        return (
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-8">
                    <div className="flex flex-col items-center">
                        <div className="w-24 h-24 rounded-full bg-white/20 animate-pulse"></div>
                        <div className="mt-4 h-6 w-32 bg-white/20 rounded animate-pulse"></div>
                        <div className="mt-2 h-4 w-48 bg-white/20 rounded animate-pulse"></div>
                    </div>
                </div>
            </div>
        );
    }

    const fullName = getFullName(userData?.firstName || "", userData?.lastName || "");

    return (
        <>
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                {/* Cover Image / Header Gradient */}
                <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-8 relative">
                    <div className="flex flex-col items-center">
                        {/* Avatar */}
                        <div className="relative group">
                            <div 
                                className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white shadow-lg cursor-pointer transition-transform group-hover:scale-105"
                                onClick={() => setIsImagePopupOpen(true)}
                            >
                                <img 
                                    src={profileImage} 
                                    alt={fullName}
                                    className="object-cover w-full h-full"
                                />
                                {isUploading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                        <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>
                            
                            <label className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full shadow-md cursor-pointer hover:bg-gray-50 transition-colors">
                                <CameraIcon className="h-4 w-4 text-gray-600" />
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageSelection} disabled={isUploading} />
                            </label>
                        </div>

                        {/* User Info */}
                        <h2 className="mt-4 text-xl font-semibold text-white">{fullName}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <BriefcaseIcon className="h-4 w-4 text-white/80" />
                            <p className="text-white/90 text-sm">{getMainRole()}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <EnvelopeIcon className="h-4 w-4 text-white/80" />
                            <p className="text-white/80 text-sm">{userData?.email || "email@example.com"}</p>
                        </div>
                        
                        {/* Reset to initials button */}
                        <button
                            onClick={handleResetToDefault}
                            className="mt-3 px-3 py-1 text-xs font-medium text-white/90 bg-white/20 rounded-full hover:bg-white/30 transition-all"
                            disabled={isUploading}
                        >
                            Use Initials
                        </button>
                    </div>
                </div>

                {/* Stats Section */}
                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-wider">User ID</p>
                            <p className="text-sm font-semibold text-gray-900 mt-1 truncate">{userData?.userId?.slice(0, 12)}</p>
                        </div>
                        <div className="text-center border-x border-gray-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Tenant</p>
                            <p className="text-sm font-semibold text-gray-900 mt-1">{userData?.tenantId || "N/A"}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                            <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                {userData?.active ? "Active" : "Inactive"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Social Links Section */}
                <div className="px-6 py-4 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-700">Social Links</h3>
                        <button onClick={openModal} className="text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1">
                            <PencilSquareIcon className="h-3 w-3" />
                            Edit
                        </button>
                    </div>
                    <div className="flex gap-3">
                        {socialMediaForm.linkedinUrl && (
                            <a href={socialMediaForm.linkedinUrl} target="_blank" rel="noopener" className="p-2 bg-gray-100 rounded-full hover:bg-cyan-100 transition-colors">
                                <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                </svg>
                            </a>
                        )}
                        {socialMediaForm.twitterUrl && (
                            <a href={socialMediaForm.twitterUrl} target="_blank" rel="noopener" className="p-2 bg-gray-100 rounded-full hover:bg-cyan-100 transition-colors">
                                <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 0021.957-12.273c.002-.273.002-.545 0-.818z"/>
                                </svg>
                            </a>
                        )}
                        {socialMediaForm.facebookUrl && (
                            <a href={socialMediaForm.facebookUrl} target="_blank" rel="noopener" className="p-2 bg-gray-100 rounded-full hover:bg-cyan-100 transition-colors">
                                <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                </svg>
                            </a>
                        )}
                        {!socialMediaForm.linkedinUrl && !socialMediaForm.twitterUrl && !socialMediaForm.facebookUrl && (
                            <p className="text-xs text-gray-400">No social links added</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Image Popup */}
            <ImagePopup imageUrl={profileImage} isOpen={isImagePopupOpen} onClose={() => setIsImagePopupOpen(false)} />

            {/* Crop Modal */}
            <CropModal 
                imageUrl={tempImageUrl}
                isOpen={isCropModalOpen}
                onClose={() => {
                    setIsCropModalOpen(false);
                    if (tempImageUrl) URL.revokeObjectURL(tempImageUrl);
                    setTempImageUrl("");
                    setPendingFile(null);
                }}
                onCropComplete={handleCropComplete}
            />

            {/* Social Media Edit Modal */}
            <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[500px] m-4">
                <div className="relative w-full bg-white rounded-xl shadow-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                    <LinkIcon className="h-5 w-5 text-cyan-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Edit Social Links</h3>
                                    <p className="text-sm text-gray-500">Update your social media profiles</p>
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
                                <Label className="text-sm font-medium text-gray-700">LinkedIn URL</Label>
                                <Input 
                                    type="url" 
                                    value={socialMediaForm.linkedinUrl}
                                    onChange={(e) => handleSocialMediaChange('linkedinUrl', e.target.value)}
                                    placeholder="https://linkedin.com/in/username"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-gray-700">Twitter/X URL</Label>
                                <Input 
                                    type="url" 
                                    value={socialMediaForm.twitterUrl}
                                    onChange={(e) => handleSocialMediaChange('twitterUrl', e.target.value)}
                                    placeholder="https://twitter.com/username"
                                />
                            </div>
                            <div>
                                <Label className="text-sm font-medium text-gray-700">Facebook URL</Label>
                                <Input 
                                    type="url" 
                                    value={socialMediaForm.facebookUrl}
                                    onChange={(e) => handleSocialMediaChange('facebookUrl', e.target.value)}
                                    placeholder="https://facebook.com/username"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/50 flex justify-end gap-3">
                        <Button variant="outline" onClick={closeModal} disabled={isSavingSocialMedia}>Cancel</Button>
                        <Button onClick={handleSaveSocialMedia} disabled={isSavingSocialMedia} className="bg-cyan-600 hover:bg-cyan-700">
                            {isSavingSocialMedia ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
