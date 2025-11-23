/**
 * Visual connector component for hierarchy tree
 */

interface HierarchyConnectorProps {
  depth: number
  isLast?: boolean
  hasSibling?: boolean
}

export function HierarchyConnector({ depth, isLast, hasSibling }: HierarchyConnectorProps) {
  if (depth === 0) return null

  const leftOffset = depth * 24
  const connectorLeft = leftOffset - 8

  return (
    <div className="absolute left-0 top-0 bottom-0 pointer-events-none" style={{ left: `${connectorLeft}px` }}>
      {/* Vertical line */}
      {!isLast && (
        <div
          className="absolute w-px bg-slate-700"
          style={{
            left: '7px',
            top: 0,
            bottom: 0,
          }}
        />
      )}
      {/* Horizontal line */}
      <div
        className="absolute h-px bg-slate-700"
        style={{
          left: '7px',
          top: '50%',
          width: '8px',
        }}
      />
    </div>
  )
}


