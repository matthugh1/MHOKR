import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">Settings & Administration</h1>
        <p className="text-lg text-neutral-600">
          Configure your organization, workspaces, teams, and user permissions.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Overview</h2>
        <p className="text-neutral-600">
          Settings are organized into several sections accessible from the sidebar under "Settings":
        </p>
        <div className="grid gap-4 md:grid-cols-2 my-6">
          <div>
            <img 
              src="/screenshots/settings-organization.png" 
              alt="Organization settings page"
              className="rounded-lg border border-neutral-200 shadow-sm w-full"
            />
            <p className="text-sm text-neutral-500 mt-2 text-center">
              Organization settings
            </p>
          </div>
          <div>
            <img 
              src="/screenshots/settings-people.png" 
              alt="People management page"
              className="rounded-lg border border-neutral-200 shadow-sm w-full"
            />
            <p className="text-sm text-neutral-500 mt-2 text-center">
              People/user management
            </p>
          </div>
        </div>
        <ul className="list-disc list-inside space-y-2 text-neutral-700 ml-4">
          <li><strong>Organization:</strong> Company-wide settings and structure</li>
          <li><strong>Workspaces:</strong> Department or division-level organization</li>
          <li><strong>Teams:</strong> Team management and membership</li>
          <li><strong>People:</strong> User management, permissions, and roles</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Organization Settings</h2>
        <p className="text-neutral-600">
          Organization settings control your company-wide configuration:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Organization Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Organization Information</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>View organization name and details</li>
                <li>Edit organization name and slug</li>
                <li>See member count and workspace count</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Members</h3>
              <p className="text-sm text-neutral-700">
                View all members of your organization. See their roles, workspaces, and team assignments.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Workspaces</h3>
              <p className="text-sm text-neutral-700">
                See all workspaces within your organization and manage their settings.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Private Whitelist</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-700 mb-2">
              For organizations using private OKRs, you can configure a whitelist of users who can view private objectives:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
              <li>Add users to the executive whitelist</li>
              <li>Remove users from the whitelist</li>
              <li>Whitelist applies to all private OKRs in the organization</li>
            </ul>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Hierarchy:</strong> Organization → Workspaces → Teams → People. Understanding this structure helps you organize OKRs effectively.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Workspace Settings</h2>
        <p className="text-neutral-600">
          Workspaces represent departments, divisions, or other organizational units:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Workspace Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Creating Workspaces</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Navigate to Workspace Settings</li>
                <li>Click "Create Workspace"</li>
                <li>Enter workspace name and optional description</li>
                <li>Assign workspace owner</li>
                <li>Save</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Editing Workspaces</h3>
              <p className="text-sm text-neutral-700">
                Edit workspace details, change owners, and manage workspace membership. Only workspace owners and organization admins can edit.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Workspace Members</h3>
              <p className="text-sm text-neutral-700">
                View and manage who belongs to each workspace. Add or remove members as organizational structure changes.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Team Settings</h2>
        <p className="text-neutral-600">
          Teams are smaller groups within workspaces that own OKRs together:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Team Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Creating Teams</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Navigate to Team Settings</li>
                <li>Click "Create Team"</li>
                <li>Enter team name</li>
                <li>Select parent workspace</li>
                <li>Assign team lead</li>
                <li>Save</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Team Members</h3>
              <p className="text-sm text-neutral-700">
                Add or remove team members. Team members can own OKRs for that team and see team-specific OKRs.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Team OKRs</h3>
              <p className="text-sm text-neutral-700">
                Teams can own objectives together. When creating an OKR, you can assign it to a team in addition to an individual owner.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">People Settings</h2>
        <p className="text-neutral-600">
          The People page manages all users in your organization:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Creating Users</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Click "Create User" button</li>
                <li>Fill in user details:
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>Name and email</li>
                    <li>Password (user can change later)</li>
                    <li>Organization role (ORG_ADMIN, MEMBER, VIEWER)</li>
                    <li>Workspace assignments and roles</li>
                    <li>Team assignments</li>
                  </ul>
                </li>
                <li>Save</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Viewing Users</h3>
              <p className="text-sm text-neutral-700">
                The people table shows all users with their roles, workspaces, teams, and permissions. Use filters to find specific users.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Editing Users</h3>
              <p className="text-sm text-neutral-700">
                Click on a user to open the edit drawer. Update roles, workspace/team assignments, and view effective permissions.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Roles and Permissions</h2>
        <p className="text-neutral-600">
          OKR Nexus uses a role-based access control (RBAC) system:
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Organization Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
                <li><strong>ORG_ADMIN:</strong> Full access to organization settings, all workspaces, and user management</li>
                <li><strong>MEMBER:</strong> Can create and edit OKRs, view organization-wide OKRs based on visibility</li>
                <li><strong>VIEWER:</strong> Read-only access, can view OKRs but cannot create or edit</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workspace Roles</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
                <li><strong>WORKSPACE_OWNER:</strong> Full control over workspace settings and membership</li>
                <li><strong>MEMBER:</strong> Can create and edit OKRs in the workspace</li>
                <li><strong>VIEWER:</strong> Read-only access to workspace OKRs</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Effective Permissions</h2>
        <p className="text-neutral-600">
          The People page includes an RBAC Inspector to view effective permissions:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>RBAC Inspector</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li>View all permissions a user effectively has across organization and workspaces</li>
              <li>See how roles combine to determine final permissions</li>
              <li>Debug permission issues by seeing the full permission tree</li>
              <li>Toggle inspector on/off for any user in the edit drawer</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">User Impersonation</h2>
        <p className="text-neutral-600">
          Superusers can impersonate other users for support and debugging:
        </p>

        <Card>
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li>Available only to superusers (system administrators)</li>
              <li>Allows seeing the application from another user's perspective</li>
              <li>Useful for troubleshooting permission or visibility issues</li>
              <li>Clear impersonation indicator shows when you're viewing as another user</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Filtering and Search</h2>
        <p className="text-neutral-600">
          The People page includes powerful filtering:
        </p>

        <Card>
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li><strong>View Mode:</strong> Filter by workspace or organization level</li>
              <li><strong>Search:</strong> Find users by name or email</li>
              <li><strong>Edit Rights Only:</strong> Show only users who can edit OKRs</li>
              <li>Filters help you manage large user lists effectively</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Best Practices</h2>
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Organizational Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li>Map workspaces to your actual organizational structure (departments, divisions)</li>
                <li>Create teams for groups that own OKRs together</li>
                <li>Keep structure simple - avoid too many nested levels</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Role Management</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li>Give ORG_ADMIN role sparingly - only to trusted administrators</li>
                <li>Most users should be MEMBER role for their workspace</li>
                <li>Use VIEWER role for external stakeholders or read-only access needs</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Onboarding</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li>Create user accounts before they need to access OKRs</li>
                <li>Assign to appropriate workspaces and teams immediately</li>
                <li>Set correct roles from the start to avoid permission issues</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Related Guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/docs/getting-started" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">Getting Started</h3>
            <p className="text-sm text-neutral-600">Learn the basics before configuring your organization</p>
          </Link>
          <Link href="/docs/okr-management" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">OKR Management</h3>
            <p className="text-sm text-neutral-600">Understand how settings affect OKR creation and visibility</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
