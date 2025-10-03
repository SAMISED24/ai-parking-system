import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import AdminDashboard from '../components/AdminDashboard';
import AdminLots from '../components/AdminLots';
import AdminVideo from '../components/AdminVideo';
import AdminUsers from '../components/AdminUsers';
import AdminAnalytics from '../components/AdminAnalytics';
import AdminSettings from '../components/AdminSettings';
import { useAuth } from '../contexts/AuthContext';
import { parkingService } from '../services/api';

const AdminPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lots, setLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: 'chart-bar' },
    { name: 'Parking Lots', href: '/admin/lots', icon: 'map' },
    { name: 'Video Analysis', href: '/admin/video', icon: 'video-camera' },
    { name: 'Analytics', href: '/admin/analytics', icon: 'chart-pie' },
    { name: 'Users', href: '/admin/users', icon: 'users' },
    { name: 'Settings', href: '/admin/settings', icon: 'cog' },
  ];

  useEffect(() => {
    const loadLots = async () => {
      try {
        setLoadingLots(true);
        const res = await parkingService.getAllParkingLots();
        if (res.data?.success) {
          setLots(res.data.data.parking_lots || res.data.data || []);
        }
      } catch (_) {
        setLots([]);
      } finally {
        setLoadingLots(false);
      }
    };
    loadLots();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow pt-5 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 2L2 7L12 12L22 7L12 2Z" />
              </svg>
            </div>
            <h1 className="ml-3 text-xl font-semibold text-gray-900">
              Admin Panel
            </h1>
          </div>
          
          <div className="mt-8 flex-grow flex flex-col">
            <nav className="flex-1 px-4 space-y-1">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  <span className="mr-3 h-6 w-6" />
                  {item.name}
                </a>
              ))}
            </nav>
            
            <div className="flex-shrink-0 p-4 border-t border-gray-200">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                  <button
                    onClick={logout}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h2 className="text-lg font-semibold text-gray-900">
                AI Parking System Administration
              </h2>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Welcome, {user?.username}
                </span>
                <button
                  onClick={logout}
                  className="inline-flex items-center px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/lots" element={<AdminLots />} />
              <Route path="/video" element={<AdminVideo />} />
              <Route path="/analytics" element={<AdminAnalytics />} />
              <Route path="/users" element={<AdminUsers />} />
              <Route path="/settings" element={<AdminSettings />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
