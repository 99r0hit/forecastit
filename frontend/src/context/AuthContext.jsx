import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedAuth = sessionStorage.getItem('evl_auth');
    if (storedAuth) {
      setUser(JSON.parse(storedAuth));
    }
    setLoading(false);
  }, []);

  const login = (username, password) => {
    // Basic auth base64 encoding
    const token = btoa(`${username}:${password}`);
    const userData = { username, token };
    sessionStorage.setItem('evl_auth', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.removeItem('evl_auth');
    setUser(null);
  };

  const fetchWithAuth = async (url, options = {}) => {
    if (!user) throw new Error("Not authenticated");
    
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Basic ${user.token}`);
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      logout();
      throw new Error("Unauthorized");
    }
    
    return response;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, fetchWithAuth, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
