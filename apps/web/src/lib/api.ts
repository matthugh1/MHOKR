import axios from 'axios'

// Direct connection to core-api (port 3001) in development
// In production/Docker, this would go through API gateway (port 3000)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// In production (when NEXT_PUBLIC_API_URL is set to API Gateway), we need to use /api prefix
// because the API Gateway routes /api/* to the core-api
// In development, we connect directly to core-api which doesn't need /api prefix
const isUsingApiGateway = !!process.env.NEXT_PUBLIC_API_URL && 
  process.env.NEXT_PUBLIC_API_URL !== 'http://localhost:3001' &&
  !process.env.NEXT_PUBLIC_API_URL.includes('localhost:3001')

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add /api prefix to all requests when using API Gateway
api.interceptors.request.use((config) => {
  // If we're using API Gateway and the URL doesn't already start with /api, add it
  // Use absolute URL to bypass Next.js rewrites when using API Gateway
  if (isUsingApiGateway && config.url && !config.url.startsWith('/api/') && !config.url.startsWith('http')) {
    config.url = `/api${config.url.startsWith('/') ? '' : '/'}${config.url}`
    // Ensure we use absolute URL to bypass Next.js server-side rewrites
    if (!config.url.startsWith('http')) {
      config.baseURL = API_URL
    }
  }
  return config
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't redirect if we're already on the login page or making a login request
      const url = error.config?.url || ''
      const isLoginRequest = url.includes('/auth/login') || url.includes('/api/auth/login')
      const isRegisterRequest = url.includes('/auth/register') || url.includes('/api/auth/register')
      const isOnLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login'
      
      // Only redirect if it's not a login/register request and we're not already on login page
      if (!isLoginRequest && !isRegisterRequest && !isOnLoginPage) {
        // Redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api

