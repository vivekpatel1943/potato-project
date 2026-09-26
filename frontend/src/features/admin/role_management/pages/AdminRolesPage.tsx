import AssignAdminCard from "../components/AssignAdminCard";

export default function AdminRolesPage() {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Role Management</h1>
        <p className="mt-1 text-text-secondary">
          Promote or demote users to admin roles.
        </p>
      </div>

      <AssignAdminCard />
    </div>
  );
}
