'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withBasePath } from '@/lib/paths';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  system_role?: string;
  system_permissions?: Record<string, boolean>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  checkSession: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  checkSession: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const checkSession = async () => {
    try {
      const res = await fetch(withBasePath('/api/auth/me'));
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return data.user as User;
      } else {
        setUser(null);
        return null;
      }
    } catch (err) {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  const logout = async () => {
    await fetch(withBasePath('/api/auth/logout'), { method: 'POST' });
    setUser(null);
    router.push(withBasePath('/login'));
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
