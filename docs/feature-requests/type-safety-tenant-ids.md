# Feature Request: Type Safety for Tenant IDs

**Status**: 📋 Backlog  
**Priority**: P2 (Nice to Have)  
**Category**: Developer Experience / Type Safety  
**Estimated Effort**: Medium (2-3 days)

---

## User Story

**As a** backend developer,  
**I want** tenant IDs to be branded types that prevent mixing with other string IDs at compile time,  
**So that** I can catch tenant ID misuse early in development and reduce the risk of passing wrong IDs to methods.

---

## Background

Currently, `organizationId` is a plain `string` type, which means TypeScript cannot prevent accidentally passing a `userId` or `workspaceId` where a tenant ID is expected. This can lead to subtle bugs that are hard to catch until runtime.

**Example of current issue**:
```typescript
// ❌ TypeScript allows this (both are strings)
const userId = 'user-123';
await service.findAll(userId); // Should be organizationId!

// ❌ No compile-time error
await service.findById('objective-123', 'workspace-456'); // Should be organizationId!
```

---

## Acceptance Criteria

### 1. Branded Type Definition
- [ ] Create `TenantId` branded type: `type TenantId = string & { readonly __brand: 'TenantId' }`
- [ ] Create helper functions to convert between `string` and `TenantId`
- [ ] Create validation function to ensure string is a valid tenant ID format

### 2. Service Method Signatures
- [ ] Update all service methods to use `TenantId` instead of `string` for `organizationId` parameters
- [ ] Update `OkrTenantGuard` methods to accept `TenantId`
- [ ] Ensure backward compatibility during migration (use union types if needed)

### 3. Controller Layer
- [ ] Update controllers to convert `req.user.organizationId` (string) to `TenantId`
- [ ] Add validation in JWT strategy to ensure `organizationId` is valid format

### 4. Prisma Integration
- [ ] Ensure Prisma queries work with branded types (may need type casting)
- [ ] Update middleware to handle `TenantId` type

### 5. Testing
- [ ] Verify TypeScript compilation errors for incorrect ID types
- [ ] Ensure runtime behavior is unchanged
- [ ] Add tests for type conversion functions

---

## Implementation Approach

### Phase 1: Type Definition
```typescript
// common/types/tenant-id.ts
export type TenantId = string & { readonly __brand: 'TenantId' };

export function toTenantId(id: string | null | undefined): TenantId | null | undefined {
  if (id === null || id === undefined) return id;
  // Optional: validate format
  return id as TenantId;
}

export function assertTenantId(id: string): TenantId {
  if (!id || id === '') {
    throw new Error('Invalid tenant ID');
  }
  return id as TenantId;
}
```

### Phase 2: Update Service Methods
```typescript
// Before
async findAll(userOrganizationId: string | null | undefined) { ... }

// After
async findAll(userOrganizationId: TenantId | null | undefined) { ... }
```

### Phase 3: Update Controllers
```typescript
@Get()
async getAll(@Req() req: any) {
  const tenantId = toTenantId(req.user.organizationId);
  return this.service.findAll(tenantId);
}
```

---

## Benefits

1. **Compile-time Safety**: TypeScript will catch ID mixing errors during development
2. **Better IDE Support**: Autocomplete and type hints will be more accurate
3. **Self-documenting Code**: Method signatures clearly indicate what type of ID is expected
4. **Reduced Bugs**: Prevents entire class of bugs related to ID confusion

---

## Risks & Considerations

1. **Migration Effort**: Requires updating all service methods and controllers
2. **Prisma Compatibility**: May need type assertions when working with Prisma
3. **Backward Compatibility**: Need to ensure existing code continues to work during migration
4. **Learning Curve**: Team needs to understand branded types

---

## Related Documentation

- `docs/developer/TENANT_ISOLATION_GUIDELINES.md` - Current tenant isolation patterns
- `docs/audit/TENANT_ISOLATION_RECOMMENDATIONS.md` - Phase 4, item #12

---

## Notes

- This is a **non-breaking enhancement** if implemented carefully with backward compatibility
- Consider implementing similar branded types for `UserId`, `WorkspaceId`, `TeamId` for consistency
- TypeScript branded types are a compile-time feature and have zero runtime overhead

---

## Future Enhancements

- Apply branded types to other ID types (`UserId`, `WorkspaceId`, `TeamId`)
- Create a type-safe query builder that enforces tenant filtering
- Add runtime validation for tenant ID format (e.g., UUID format)


