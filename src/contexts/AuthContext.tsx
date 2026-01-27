import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/lib/api-client';

export type UserRole = 'admin' | 'user' | 'viewer';

export interface User {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored token and validate with backend
    const checkAuth = async () => {
      const token = apiClient.getToken();
      if (token) {
        try {
          const currentUser = await apiClient.getCurrentUser();
          setUser({
            id: currentUser.user_id.toString(),
            email: currentUser.email,
            role: currentUser.role as UserRole,
          });
        } catch (error) {
          // Token invalid or expired, clear it
          apiClient.clearToken();
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await apiClient.login(email, password);
      const authenticatedUser: User = {
        id: response.user.user_id.toString(),
        email: response.user.email,
        role: response.user.role as UserRole,
      };
      setUser(authenticatedUser);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
