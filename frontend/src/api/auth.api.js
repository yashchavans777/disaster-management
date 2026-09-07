import apiClient from './apiClient';

/**
 * Log in an existing user
 * @param {{ email: string, password: string }} credentials
 */
export const loginUser = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials);
  return response.data;
};

/**
 * Register a new user
 * @param {{ name: string, email: string, password: string, role?: string, phone?: string }} userData
 */
export const registerUser = async (userData) => {
  const response = await apiClient.post('/auth/register', userData);
  return response.data;
};

/**
 * Get current authenticated user profile
 */
export const getCurrentUser = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

/**
 * Get auth service status
 */
export const getAuthStatus = async () => {
  const response = await apiClient.get('/auth/status');
  return response.data;
};
