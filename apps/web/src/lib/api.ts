import axios from 'axios'

// Direct connection to core-api (port 3001) in development
// In production/Docker, this would go through API gateway (port 3000)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
      const isLoginRequest = error.config?.url?.includes('/auth/login')
      const isRegisterRequest = error.config?.url?.includes('/auth/register')
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

