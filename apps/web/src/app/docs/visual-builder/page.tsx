import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function VisualBuilderPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-neutral-900 mb-4">Visual Builder</h1>
        <p className="text-lg text-neutral-600">
          Create and visualize OKR hierarchies using drag-and-drop nodes and connections.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Overview</h2>
        <p className="text-neutral-600">
          The Visual Builder provides an interactive, graph-based view of your OKRs. You can see relationships between objectives, key results, and initiatives, and create new OKRs directly in the visual interface.
        </p>
        <div className="my-6">
          <img 
            src="/screenshots/visual-builder.png" 
            alt="Visual builder canvas showing OKR nodes and connections"
            className="rounded-lg border border-neutral-200 shadow-sm w-full"
          />
          <p className="text-sm text-neutral-500 mt-2 text-center">
            Visual builder with OKR nodes, connections, and edit panel
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Getting Started</h2>
        <p className="text-neutral-600">
          To access the Visual Builder:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-neutral-700 ml-4">
          <li>Click "Visual Builder" in the sidebar navigation</li>
          <li>The canvas will load with your existing OKRs from the selected cycle</li>
          <li>Use the cycle selector at the top to switch between different time periods</li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Understanding Nodes</h2>
        <p className="text-neutral-600">
          The Visual Builder uses three types of nodes to represent OKRs:
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Objective Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700 mb-2">
                Objectives appear as larger nodes with:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Objective title</li>
                <li>Progress percentage</li>
                <li>Status indicator</li>
                <li>Owner information</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key Result Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700 mb-2">
                Key Results appear as medium-sized nodes showing:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Key result title</li>
                <li>Current vs. target value</li>
                <li>Progress percentage</li>
                <li>Confidence level</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Initiative Nodes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-700 mb-2">
                Initiatives appear as smaller nodes with:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700 ml-4">
                <li>Initiative title</li>
                <li>Owner</li>
                <li>Due date (if set)</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Node Connections</h2>
        <p className="text-neutral-600">
          Connections show the hierarchical relationships between OKRs:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Connection Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Objective → Key Result</h3>
              <p className="text-sm text-neutral-700">
                Key results are connected to their parent objectives. These connections show how progress on key results contributes to objective completion.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Key Result → Initiative</h3>
              <p className="text-sm text-neutral-700">
                Initiatives are connected to the key results they support. This shows the work that drives progress on key results.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Alignment Connections</h3>
              <p className="text-sm text-neutral-700">
                Optional connections can show alignment between objectives across different levels of the organization (e.g., company → department → team).
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Creating OKRs in the Builder</h2>
        <p className="text-neutral-600">
          You can create new OKRs directly from the visual builder:
        </p>

        <ol className="list-decimal list-inside space-y-3 text-neutral-700 ml-4">
          <li>
            <strong>Click the "+" button</strong> in the toolbar or right-click on the canvas
          </li>
          <li>
            <strong>Select the type:</strong> Objective, Key Result, or Initiative
          </li>
          <li>
            <strong>Fill in the details</strong> in the creation form that appears
          </li>
          <li>
            <strong>Set connections:</strong> If creating a key result or initiative, you'll specify the parent OKR
          </li>
          <li>
            <strong>Save:</strong> The new node will appear on the canvas automatically
          </li>
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Editing OKRs</h2>
        <p className="text-neutral-600">
          To edit an OKR in the visual builder:
        </p>

        <ol className="list-decimal list-inside space-y-2 text-neutral-700 ml-4">
          <li>Click on a node to select it</li>
          <li>The edit panel will open on the right side</li>
          <li>Make changes to title, values, owners, or other properties</li>
          <li>Changes are auto-saved as you type</li>
        </ol>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Tip:</strong> The visual builder auto-saves your changes. You don't need to manually save - just close the edit panel when done.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Canvas Navigation</h2>
        <p className="text-neutral-600">
          Navigate and manipulate the canvas with these controls:
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Zoom Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li>Use mouse wheel to zoom in/out</li>
                <li>Click the zoom buttons in the bottom-right corner</li>
                <li>Double-click to zoom to fit all nodes</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Panning</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li>Click and drag the background to pan</li>
                <li>Use mini-map for quick navigation</li>
                <li>Nodes will automatically layout when created</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Mini-map</h2>
        <p className="text-neutral-600">
          The mini-map in the bottom-right corner provides:
        </p>

        <Card>
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li>Overview of all nodes on the canvas</li>
              <li>Quick navigation by clicking on the mini-map</li>
              <li>Viewport indicator showing what's currently visible</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Auto-Layout</h2>
        <p className="text-neutral-600">
          The visual builder automatically arranges nodes in a hierarchical layout:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>How Auto-Layout Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li>Objectives are placed at the top level</li>
              <li>Key results are arranged below their parent objectives</li>
              <li>Initiatives are placed below their parent key results</li>
              <li>Layout updates automatically when you add or remove connections</li>
              <li>You can manually drag nodes to customize positions</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Filtering and Search</h2>
        <p className="text-neutral-600">
          Filter what appears on the canvas:
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Filter Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">By Cycle</h3>
              <p className="text-sm text-neutral-700">
                Select a cycle from the dropdown to show only OKRs from that time period.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">By Workspace/Team</h3>
              <p className="text-sm text-neutral-700">
                Filter to show only OKRs from specific workspaces or teams.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">By Status</h3>
              <p className="text-sm text-neutral-700">
                Show or hide OKRs based on their status (on track, at risk, etc.).
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">Search</h3>
              <p className="text-sm text-neutral-700">
                Use the search box to find specific OKRs. Matching nodes will be highlighted.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Export and Sharing</h2>
        <p className="text-neutral-600">
          You can export the visual view:
        </p>

        <Card>
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-sm text-neutral-700">
              <li>Export as image (PNG/JPEG) for presentations</li>
              <li>Share links to specific views</li>
              <li>Use in reports and documentation</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Best Practices</h2>
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Organizing Your View</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li>Use filters to focus on specific teams or workspaces</li>
                <li>Start with a high-level view and zoom into details</li>
                <li>Group related objectives visually by dragging nodes</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Creating Alignment</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">
                <li>Create connections to show how team OKRs align with company objectives</li>
                <li>Use the visual view to identify gaps in alignment</li>
                <li>Share the view with stakeholders to communicate strategy</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-neutral-900">Related Guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/docs/okr-management" className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-neutral-900 mb-2">OKR Management</h3>
            <p className="text-sm text-neutral-600">Learn more about creating and managing OKRs in list view</p>
          </Link>
        </div>
      </section>
    </div>
  )
}
