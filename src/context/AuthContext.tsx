import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

const GUEST_ADMIN_USER: User = {
  id: 1,
  name: 'Guest Admin',
  email: 'guest@attendly.local',
  role: 'admin',
  department: 'Management',
};

const GUEST_ADMIN_TOKEN = 'guest-admin-session';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(GUEST_ADMIN_USER);
  const [token, setToken] = useState<string | null>(GUEST_ADMIN_TOKEN);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    } else {
      setToken(GUEST_ADMIN_TOKEN);
      setUser(GUEST_ADMIN_USER);
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(GUEST_ADMIN_TOKEN);
    setUser(GUEST_ADMIN_USER);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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
