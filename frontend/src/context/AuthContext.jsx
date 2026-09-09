import { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, loginUser, registerUser } from '../api/auth.api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'dm_auth_token';
const USER_KEY = 'dm_auth_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(USER_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [isLoading, setIsLoading] = useState(true);

  // Validate or refresh current user session on mount
  useEffect(() => {
    const hydrateSession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await getCurrentUser();
        if (response?.data?.user) {
          setUser(response.data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
        }
      } catch (err) {
        // If token is invalid or expired, retain cached user or clear if needed
        console.warn('Session hydration notice:', err?.response?.data?.message || err.message);
      } finally {
        setIsLoading(false);
      }
    };

    hydrateSession();
  }, []);

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const res = await loginUser(credentials);
      const authUser = res?.data?.user;
      const authToken = res?.data?.token;

      if (authToken) {
        localStorage.setItem(TOKEN_KEY, authToken);
        setToken(authToken);
      }
      if (authUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(authUser));
        setUser(authUser);
      }
      return { success: true, user: authUser, token: authToken };
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData) => {
    setIsLoading(true);
    try {
      const res = await registerUser(userData);
      const authUser = res?.data?.user;
      const authToken = res?.data?.token;

      if (authToken) {
        localStorage.setItem(TOKEN_KEY, authToken);
        setToken(authToken);
      }
      if (authUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(authUser));
        setUser(authUser);
      }
      return { success: true, user: authUser, token: authToken };
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        isLoading,
        login,
        register,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
