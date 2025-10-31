/**
 * Build version and environment information
 * 
 * This file is updated before demo or staging deployments to tag builds.
 * Backend does NOT own build identity - this is frontend-sourced on purpose
 * so we can tag demo builds without redeploying core-api.
 */

export const APP_VERSION = 'v1.0.0-refactor-baseline'
export const DEPLOY_ENV = process.env.NEXT_PUBLIC_ENV || 'local-dev'
export const GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA || '0944d06'
