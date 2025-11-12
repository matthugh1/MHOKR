/**
 * Skeleton components for loading states
 * 
 * W5.M3: Provides skeletons with stable heights to avoid CLS
 */

export function OkrRowSkeleton() {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3 animate-pulse">
      {/* Title */}
      <div className="h-5 bg-muted rounded w-3/4" />
      
      {/* 2 KR bars placeholder */}
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
      </div>
      
      {/* Metadata */}
      <div className="flex items-center gap-2">
        <div className="h-4 bg-muted rounded w-20" />
        <div className="h-4 bg-muted rounded w-16" />
      </div>
    </div>
  )
}

export function InlineInsightSkeleton() {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-muted/30 rounded text-xs animate-pulse">
      <div className="h-3 w-3 bg-muted rounded" />
      <div className="h-3 bg-muted rounded w-20" />
      <div className="h-3 bg-muted rounded w-16" />
      <div className="h-3 bg-muted rounded w-12" />
    </div>
  )
}

export function CycleHealthSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 rounded-md border border-border animate-pulse">
      <div className="h-4 bg-muted rounded w-20" />
      <div className="flex items-center gap-1">
        <div className="h-5 bg-muted rounded w-16" />
        <div className="h-5 bg-muted rounded w-12" />
      </div>
      <div className="flex items-center gap-1">
        <div className="h-5 bg-muted rounded w-16" />
        <div className="h-5 bg-muted rounded w-12" />
      </div>
      <div className="flex items-center gap-1">
        <div className="h-5 bg-muted rounded w-20" />
        <div className="h-5 bg-muted rounded w-12" />
      </div>
    </div>
  )
}

export function GovernanceStatusSkeleton() {
  return (
    <div className="mb-4 px-4 py-2 bg-muted/30 rounded-md border border-border flex items-center gap-3 animate-pulse">
      <div className="h-4 bg-muted rounded w-24" />
      <div className="flex items-center gap-1">
        <div className="h-5 bg-muted rounded w-16" />
        <div className="h-5 bg-muted rounded w-12" />
      </div>
      <div className="flex items-center gap-1">
        <div className="h-5 bg-muted rounded w-16" />
        <div className="h-5 bg-muted rounded w-12" />
      </div>
    </div>
  )
}

export function DrawerFormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title field */}
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-16" />
        <div className="h-10 bg-muted rounded w-full" />
      </div>
      
      {/* Description field */}
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-20" />
        <div className="h-24 bg-muted rounded w-full" />
      </div>
      
      {/* Select fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-16" />
          <div className="h-10 bg-muted rounded w-full" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-16" />
          <div className="h-10 bg-muted rounded w-full" />
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2 pt-4">
        <div className="h-10 bg-muted rounded w-24" />
        <div className="h-10 bg-muted rounded w-24" />
      </div>
    </div>
  )
}

