import PageBreadcrumb from "../components/common/PageBreadCrumb";
import UserMetaCard from "../components/UserProfile/UserMetaCard";
import UserInfoCard from "../components/UserProfile/UserInfoCard";
import UserAddressCard from "../components/UserProfile/UserAddressCard";
import PageMeta from "../components/common/PageMeta";

export default function UserProfiles() {
  return (
    <>
      <PageMeta
        title="My Profile"
        description="MyTrade - User Profile Page"
      />
      <PageBreadcrumb pageTitle="My Profile" />
      <div className="w-full max-w-none space-y-4 py-4">
        <UserMetaCard />
        <UserInfoCard />
        <UserAddressCard />
      </div>
    </>
  );
}
