import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user for demo
const mockUser: User = {
  user_id: '1',
  email: 'admin@qualixa.io',
  name: 'Alex Johnson',
  role: 'admin',
  team_id: '1',
  status: 'active',
  created_date: new Date().toISOString(),
  last_login: new Date().toISOString(),
  avatar: undefined,
};

const roleHierarchy: Record<UserRole, number> = {
  admin: 4,
  qa_manager: 3,
  qa_engineer: 2,
  viewer: 1,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem('qualixa_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Demo: accept any credentials
    const loggedInUser = { ...mockUser, email };
    setUser(loggedInUser);
    localStorage.setItem('qualixa_user', JSON.stringify(loggedInUser));
    setIsLoading(false);
  };

  const register = async (email: string, name: string, password: string) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newUser: User = {
      ...mockUser,
      user_id: crypto.randomUUID(),
      email,
      name,
      role: 'qa_engineer',
      status: 'pending',
      created_date: new Date().toISOString(),
    };
    setUser(newUser);
    localStorage.setItem('qualixa_user', JSON.stringify(newUser));
    setIsLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('qualixa_user');
  };

  const hasPermission = (requiredRole: UserRole | UserRole[]) => {
    if (!user) return false;
    
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const userLevel = roleHierarchy[user.role];
    
    return roles.some(role => userLevel >= roleHierarchy[role]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        hasPermission,
      }}
    >
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
