import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function OKRManagementPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">OKR Management</h1>
        <p className="text-lg text-neutral-600">
          Learn how to create, edit, and manage objectives, key results, and initiatives in OKR Nexus.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Overview</h2>
        <p className="text-neutral-600">
          The OKRs page is where you manage all your objectives, key results, and initiatives. This is the central hub for OKR operations in your organization.
        </p>
        <div className="my-6">
          <img 
            src="/screenshots/okrs-page.png" 
            alt="OKRs page showing list of objectives and key results"
            className="rounded-lg border border-neutral-200 shadow-sm w-full"
          />
          <p className="text-sm text-neutral-500 mt-2 text-center">
            OKRs page with filtering, search, and expandable objective rows
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900" id="creating-objectives">Creating Objectives</h2>
        <p className="text-neutral-600">
          Objectives are high-level goals that define what you want to achieve. To create an objective:
        </p>
        
        <ol className="list-decimal list-inside space-y-3 text-neutral-700 ml-4">
          <li>
            <strong>Navigate to OKRs page:</strong> Click "OKRs" in the sidebar navigation
          </li>
          <li>
            <strong>Open the creation drawer:</strong> Click the "Add" button in the toolbar, then select "Objective"
          </li>
          <li>
            <strong>Fill in objective details:</strong>
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li><strong>Title:</strong> A clear, inspiring description of what you want to achieve</li>
              <li><strong>Description:</strong> (Optional) Additional context about the objective</li>
              <li><strong>Owner:</strong> The person responsible for this objective</li>
              <li><strong>Cycle:</strong> The time period this objective applies to</li>
              <li><strong>Pillar:</strong> (Optional) Link to a strategic pillar</li>
              <li><strong>Team/Workspace:</strong> The organizational context</li>
              <li><strong>Visibility:</strong> Who can see this objective</li>
            </ul>
          </li>
          <li>
            <strong>Save:</strong> Click "Create Objective" to save
          </li>
        </ol>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Best Practices</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
              <li>Keep objectives qualitative and inspiring - they should motivate action</li>
              <li>Limit objectives to 3-5 per cycle per team for focus</li>
              <li>Ensure objectives align with your organization's strategic pillars</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Creating Key Results</h2>
        <p className="text-neutral-600">
          Key Results are measurable outcomes that indicate progress toward an objective. To create a key result:
        </p>

        <ol className="list-decimal list-inside space-y-3 text-neutral-700 ml-4">
          <li>
            <strong>Select an objective:</strong> Find the objective you want to add a key result to
          </li>
          <li>
            <strong>Open creation modal:</strong> Click "Add Key Result" within the objective row
          </li>
          <li>
            <strong>Fill in key result details:</strong>
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li><strong>Title:</strong> What will be measured</li>
              <li><strong>Target Value:</strong> The numeric target to achieve</li>
              <li><strong>Current Value:</strong> Starting point (can be updated via check-ins)</li>
              <li><strong>Unit:</strong> The unit of measurement (e.g., %, count, $)</li>
              <li><strong>Owner:</strong> Person responsible for tracking this key result</li>
              <li><strong>Check-in Cadence:</strong> How often updates are expected (Weekly, Biweekly, Monthly)</li>
            </ul>
          </li>
          <li>
            <strong>Save:</strong> Click "Create Key Result" to save
          </li>
        </ol>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Key Result Best Practices</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
              <li>Each objective should have 2-4 key results</li>
              <li>Key results should be specific and measurable</li>
              <li>Use clear units and ensure targets are achievable</li>
              <li>Set appropriate check-in cadences based on update frequency</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Creating Initiatives</h2>
        <p className="text-neutral-600">
          Initiatives are specific projects or activities that drive progress on key results:
        </p>

        <ol className="list-decimal list-inside space-y-3 text-neutral-700 ml-4">
          <li>
            <strong>Select a key result:</strong> Find the key result you want to add an initiative to
          </li>
          <li>
            <strong>Open creation modal:</strong> Click "Add Initiative" 
          </li>
          <li>
            <strong>Fill in initiative details:</strong>
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
              <li><strong>Title:</strong> Name of the project or activity</li>
              <li><strong>Description:</strong> (Optional) Details about what needs to be done</li>
              <li><strong>Owner:</strong> Person responsible for this initiative</li>
              <li><strong>Due Date:</strong> (Optional) When this initiative should be completed</li>
            </ul>
          </li>
          <li>
            <strong>Save:</strong> Click "Create Initiative" to save
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Editing OKRs</h2>
        <p className="text-neutral-600">
          You can edit objectives, key results, and initiatives:
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Inline Editing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700 mb-2">
                Many fields support inline editing - click directly on the field to edit:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Objective titles</li>
                <li>Key result titles and values</li>
                <li>Status indicators</li>
                <li>Owner assignments</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Modal Editing</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700 mb-2">
                For comprehensive edits, open the edit modal:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Edit descriptions</li>
                <li>Change cycles or pillars</li>
                <li>Update visibility settings</li>
                <li>Modify multiple fields at once</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-amber-900">Publish Lock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-800">
              Once an objective is published, it may be locked for editing to maintain consistency. Administrators can override this lock if needed. Locked objectives will show a warning when you try to edit them.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Filtering and Search</h2>
        <p className="text-neutral-600">
          The OKRs page includes powerful filtering and search capabilities:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Filter Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">By Cycle</h3>
              <p className="text-sm text-neutral-700">
                Use the cycle selector to filter OKRs by time period. Shows only active cycles by default.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">By Workspace</h3>
              <p className="text-sm text-neutral-700">
                Filter to see OKRs from specific workspaces within your organization.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">By Team</h3>
              <p className="text-sm text-neutral-700">
                Narrow down to OKRs owned by specific teams.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">By Owner</h3>
              <p className="text-sm text-neutral-700">
                Filter to see OKRs owned by specific individuals.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">By Status</h3>
              <p className="text-sm text-neutral-700">
                Filter by status: On Track, At Risk, Off Track, or Completed.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Search</h3>
              <p className="text-sm text-neutral-700">
                Use the search box to find OKRs by title, description, or owner name.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Viewing OKRs</h2>
        <p className="text-neutral-600">
          OKRs are displayed in a list view with expandable rows:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>List View Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Expandable Rows</h3>
              <p className="text-sm text-neutral-700">
                Click on an objective row to expand and see its key results and initiatives. Expand multiple objectives to compare them side-by-side.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Progress Indicators</h3>
              <p className="text-sm text-neutral-700">
                Visual progress bars show completion percentage. Status badges indicate if objectives are on track, at risk, or off track.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Quick Actions</h3>
              <p className="text-sm text-neutral-700">
                Hover over rows to see quick action buttons for creating key results, initiatives, and check-ins.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Activity Drawer</h3>
              <p className="text-sm text-neutral-700">
                Click the activity icon to see the full history of changes, check-ins, and updates for any OKR.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Deleting OKRs</h2>
        <p className="text-neutral-600">
          To delete an objective, key result, or initiative:
        </p>

        <ol className="list-decimal list-inside space-y-2 text-neutral-700 ml-4">
          <li>Open the item's menu (three dots or action menu)</li>
          <li>Select "Delete"</li>
          <li>Confirm the deletion in the dialog</li>
        </ol>

        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-900">Warning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-800">
              Deleting an objective will also delete all associated key results and initiatives. This action cannot be undone. Make sure you really want to delete before confirming.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Cycle Health Strip</h2>
        <p className="text-neutral-600">
          At the top of the OKRs page, you'll see a cycle health strip that provides quick insights:
        </p>

        <Card>
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li>Active cycle name and status</li>
              <li>Number of objectives in the cycle</li>
              <li>Overall cycle health indicators</li>
              <li>Quick links to cycle management (for admins)</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Attention Drawer</h2>
        <p className="text-neutral-600">
          The attention drawer highlights OKRs that need your focus:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>What's in the Attention Drawer?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li>Objectives at risk</li>
              <li>Key results with overdue check-ins</li>
              <li>Items you own that need updates</li>
              <li>High-priority OKRs requiring immediate attention</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Permissions and Visibility</h2>
        <p className="text-neutral-600">
          OKR visibility is controlled by permissions and settings:
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Visibility Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li><strong>Public:</strong> Visible to all organization members</li>
                <li><strong>Workspace:</strong> Visible to workspace members</li>
                <li><strong>Team:</strong> Visible to team members only</li>
                <li><strong>Private:</strong> Visible only to owner and specific whitelist</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Editing Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li>Only owners and admins can edit OKRs</li>
                <li>Published OKRs may be locked for editing</li>
                <li>Cycle locks prevent editing archived cycles</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Related Guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/docs/check-ins" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">Check-ins</h3>
            <p className="text-sm text-neutral-600">Learn how to update key result progress with check-ins</p>
          </Link>
          <Link href="/docs/visual-builder" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">Visual Builder</h3>
            <p className="text-sm text-neutral-600">Visualize OKR hierarchies and relationships</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
