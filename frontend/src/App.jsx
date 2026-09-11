import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import EVLAnalyticsView from './components/EVLAnalyticsView';
import ForecastApp from './ForecastApp';

function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    login(username, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-10 border border-gray-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mb-4 shadow-inner">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">EVL Platform</h2>
          <p className="mt-2 text-sm text-gray-500">Sign in to access enterprise supply chain analytics</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input 
              type="text" 
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input 
              type="password" 
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

function MainLayout() {
  const [activeTab, setActiveTab] = useState('evl');
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation */}
      <nav className="bg-indigo-600 shadow-lg border-b border-indigo-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex-shrink-0 flex items-center gap-2">
                 <svg className="w-8 h-8 text-indigo-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                 <span className="font-extrabold text-2xl text-white tracking-tight">EVL Platform</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
                 <button onClick={() => setActiveTab('evl')} className={`${activeTab === 'evl' ? 'bg-indigo-800 text-white shadow-inner' : 'text-indigo-100 hover:bg-indigo-500 hover:text-white'} px-4 py-2 rounded-lg text-sm font-medium transition-all`}>
                   Analytics Dashboard
                 </button>
                 <button onClick={() => setActiveTab('forecast')} className={`${activeTab === 'forecast' ? 'bg-indigo-800 text-white shadow-inner' : 'text-indigo-100 hover:bg-indigo-500 hover:text-white'} px-4 py-2 rounded-lg text-sm font-medium transition-all`}>
                   Data Pipeline
                 </button>
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center gap-4">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-bold text-white">Admin User</span>
                  <span className="text-xs text-indigo-200">Supply Chain Dept</span>
                </div>
                <div className="h-9 w-9 rounded-full bg-indigo-300 flex items-center justify-center text-indigo-800 font-bold border-2 border-indigo-200">
                  AU
                </div>
                <button onClick={logout} className="ml-2 text-indigo-100 hover:text-white bg-indigo-700 hover:bg-indigo-800 px-3 py-2 rounded-lg text-sm font-medium border border-indigo-500 shadow-sm transition-all">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Content Area */}
      <div className="flex-1">
        {activeTab === 'evl' ? <EVLAnalyticsView /> : <ForecastApp />}
      </div>
    </div>
  );
}

function ProtectedApp() {
  const { user } = useAuth();
  if (!user) {
    return <LoginScreen />;
  }
  return <MainLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <ProtectedApp />
    </AuthProvider>
  );
}
