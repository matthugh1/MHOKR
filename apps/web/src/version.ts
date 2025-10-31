/**
 * Build version and environment information
 * 
 * This file is updated before demo or staging deployments to tag builds.
 * Backend does NOT own build identity - this is frontend-sourced on purpose
 * so we can tag demo builds without redeploying core-api.
 */

export const BUILD_VERSION = '1.0.0'
export const BUILD_ENV = process.env.NEXT_PUBLIC_ENV || 'development'
export const BUILD_GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA || 'dev'
