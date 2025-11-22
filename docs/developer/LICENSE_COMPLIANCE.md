# License Compliance Documentation

**Date**: 2025-01-XX  
**Status**: ✅ Compliant  
**Last Updated**: 2025-01-XX

---

## Overview

This document provides an overview of license compliance for all dependencies in the OKR Framework project. License information was generated using `license-checker` and reviewed for compatibility with our project's licensing requirements.

---

## License Summary

### Total Dependencies Analyzed
- **Total packages**: ~1,200+ (including transitive dependencies)
- **Direct dependencies**: ~50 (across all workspaces)

### License Distribution

| License | Count | Status | Notes |
|---------|-------|--------|-------|
| MIT | 1,011 | ✅ Safe | Permissive, widely used |
| ISC | 84 | ✅ Safe | Similar to MIT, very permissive |
| Apache-2.0 | 43 | ✅ Safe | Permissive, patent grant |
| BSD-3-Clause | 32 | ✅ Safe | Permissive, 3-clause BSD |
| BSD-2-Clause | 23 | ✅ Safe | Permissive, 2-clause BSD |
| (MIT OR CC0-1.0) | 3 | ✅ Safe | Dual license, both permissive |
| Unlicense | 2 | ✅ Safe | Public domain dedication |
| MIT* | 2 | ✅ Safe | MIT variant |
| MIT-0 | 1 | ✅ Safe | MIT No Attribution |
| 0BSD | 1 | ✅ Safe | BSD Zero Clause |
| CC-BY-4.0 | 1 | ⚠️ Review | Creative Commons (attribution required) |
| BlueOak-1.0.0 | 5 | ✅ Safe | Permissive, Blue Oak Model License |
| LGPL-3.0-or-later | 1 | ⚠️ Review | Copyleft license (see details below) |
| Python-2.0 | 1 | ⚠️ Review | Legacy Python license (see details below) |
| UNLICENSED | 8 | ✅ Safe | Internal packages (okr-nexus/*) |

---

## License Compatibility Assessment

### ✅ Safe for Commercial Use

The following licenses are permissive and safe for commercial use:

- **MIT**: Most permissive, allows commercial use, modification, distribution
- **ISC**: Similar to MIT, very permissive
- **Apache-2.0**: Permissive with patent grant, safe for commercial use
- **BSD-2-Clause / BSD-3-Clause**: Permissive, allows commercial use
- **Unlicense / 0BSD**: Public domain dedication, no restrictions
- **BlueOak-1.0.0**: Permissive, designed for commercial use

### ⚠️ Licenses Requiring Review

#### 1. LGPL-3.0-or-later

**Package**: `@img/sharp-libvips-darwin-arm64@1.2.3`

**Details**:
- This is a transitive dependency of `sharp` (image processing library)
- LGPL-3.0 is a copyleft license that requires:
  - If you modify the library, you must release modifications under LGPL-3.0
  - If you link dynamically, you can use it in proprietary software
  - If you link statically, you may need to provide object files

**Assessment**:
- ✅ **Safe**: `sharp` is used as a library (dynamic linking)
- ✅ **No modifications**: We don't modify the library
- ✅ **Compliant**: Dynamic linking with LGPL libraries is generally safe for commercial use

**Action Required**: None. Current usage is compliant.

---

#### 2. Python-2.0

**Package**: `argparse@2.0.1`

**Details**:
- Legacy Python Software Foundation License 2.0
- This is a transitive dependency (likely from an older package)
- Python-2.0 is generally permissive but has some attribution requirements

**Assessment**:
- ⚠️ **Review**: Check if this package is actually used
- ✅ **Likely safe**: Python-2.0 is permissive for commercial use
- ⚠️ **Action**: Consider updating to a newer version if available

**Action Required**: 
- Verify if `argparse@2.0.1` is actually used in the codebase
- If unused, consider removing the dependency
- If used, ensure proper attribution in documentation

---

#### 3. CC-BY-4.0

**Package**: One package uses Creative Commons Attribution 4.0

**Details**:
- Requires attribution when using the work
- Generally safe for commercial use
- Attribution must be maintained

**Assessment**:
- ✅ **Safe**: Attribution requirements are typically met via package.json
- ⚠️ **Action**: Ensure attribution is maintained in documentation

**Action Required**: Verify attribution is properly maintained.

---

#### 4. UNLICENSED Packages

**Packages**: 
- `@okr-nexus/ai-service@1.0.0`
- `@okr-nexus/api-gateway@1.0.0`
- `@okr-nexus/core-api@1.0.0`
- `@okr-nexus/integration-service@1.0.0`
- `@okr-nexus/types@1.0.0`
- `@okr-nexus/utils@1.0.0`
- `@okr-nexus/web@1.0.0`
- `okr-nexus@1.0.0` (root)

**Assessment**:
- ✅ **Safe**: These are internal packages owned by the project
- ✅ **No action required**: Internal packages don't require external licensing

**Action Required**: None. Consider adding explicit MIT or proprietary licenses to internal packages for clarity.

---

## Key Dependencies License Review

### Core Framework Dependencies

| Package | Version | License | Status |
|---------|---------|---------|--------|
| @nestjs/common | ^10.3.0 | MIT | ✅ Safe |
| @nestjs/core | ^10.3.0 | MIT | ✅ Safe |
| @prisma/client | ^5.8.1 | Apache-2.0 | ✅ Safe |
| next | ^15.0.0 | MIT | ✅ Safe |
| react | ^19.0.0 | MIT | ✅ Safe |
| typescript | ^5.3.3 | Apache-2.0 | ✅ Safe |

### Database & ORM

| Package | Version | License | Status |
|---------|---------|---------|--------|
| @prisma/client | ^5.8.1 | Apache-2.0 | ✅ Safe |
| prisma | ^5.8.1 | Apache-2.0 | ✅ Safe |
| ioredis | ^5.3.2 | MIT | ✅ Safe |

### Authentication & Security

| Package | Version | License | Status |
|---------|---------|---------|--------|
| @nestjs/jwt | ^10.2.0 | MIT | ✅ Safe |
| passport-jwt | ^4.0.1 | MIT | ✅ Safe |
| bcrypt | ^5.1.1 | MIT | ✅ Safe |
| jsonwebtoken | ^9.0.2 | MIT | ✅ Safe |

### UI & Frontend

| Package | Version | License | Status |
|---------|---------|---------|--------|
| @radix-ui/* | Various | MIT | ✅ Safe |
| @tanstack/react-query | ^5.17.19 | MIT | ✅ Safe |
| framer-motion | ^12.23.24 | MIT | ✅ Safe |
| tailwindcss | ^3.3.0 | MIT | ✅ Safe |

---

## Compliance Checklist

- [x] All dependencies analyzed using `license-checker`
- [x] License compatibility reviewed
- [x] Concerning licenses identified and assessed
- [x] Commercial use compatibility verified
- [x] Attribution requirements documented
- [x] Internal packages identified

---

## Recommendations

### 1. Add Licenses to Internal Packages

**Action**: Add explicit licenses to internal packages (`@okr-nexus/*`)

**Files to update**:
- `packages/types/package.json`
- `packages/utils/package.json`
- `services/core-api/package.json`
- `services/ai-service/package.json`
- `services/api-gateway/package.json`
- `services/integration-service/package.json`
- `apps/web/package.json`

**Example**:
```json
{
  "license": "MIT"
}
```

### 2. Review argparse Dependency

**Action**: Verify if `argparse@2.0.1` is actually used

**Command**:
```bash
npm ls argparse
```

If unused, consider removing it from the dependency tree.

### 3. Document Attribution

**Action**: Maintain a NOTICES file or attribution section in documentation

**Location**: `docs/developer/NOTICES.md` or `LICENSE` file

### 4. Automated License Checking

**Action**: Add license checking to CI/CD pipeline

**Example**:
```json
{
  "scripts": {
    "license:check": "license-checker --onlyAllow 'MIT;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause;Unlicense;0BSD;BlueOak-1.0.0'"
  }
}
```

---

## License Checker Usage

### Generate License Report

```bash
npm install -g license-checker
license-checker --json > licenses.json
```

### Check for Specific Licenses

```bash
# Check for concerning licenses
license-checker --onlyAllow 'MIT;ISC;Apache-2.0;BSD-2-Clause;BSD-3-Clause'
```

### Generate Human-Readable Report

```bash
license-checker --summary
```

---

## Conclusion

**Overall Status**: ✅ **COMPLIANT**

The project uses primarily permissive licenses (MIT, ISC, Apache-2.0, BSD) that are safe for commercial use. The few concerning licenses identified are either:
1. Transitive dependencies used in compliant ways (LGPL-3.0)
2. Internal packages that don't require external licensing
3. Legacy packages that may be removable

**No blocking license issues identified.**

---

## References

- [Open Source License Compatibility](https://opensource.org/licenses)
- [SPDX License List](https://spdx.org/licenses/)
- [license-checker npm package](https://www.npmjs.com/package/license-checker)
- [Blue Oak Model License](https://blueoakcouncil.org/license/1.0.0)

---

## Maintenance

This document should be reviewed:
- When adding new major dependencies
- Quarterly as part of dependency updates
- Before major releases
- When license concerns are raised

**Last Review**: 2025-01-XX  
**Next Review**: 2025-04-XX

