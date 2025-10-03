import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import UserDashboard from '../components/UserDashboard';
import { useAuth } from '../contexts/AuthContext';
import { useParking } from '../contexts/ParkingContext';
import LoadingSpinner from '../components/LoadingSpinner';

const UserPage = () => {
  const { user, logout } = useAuth();
  const { parkingLots, loading, loadParkingLots } = useParking();
  const [selectedLotId, setSelectedLotId] = useState(null);

  useEffect(() => {
    loadParkingLots();
  }, [loadParkingLots]);

  useEffect(() => {
    // Auto-select first parking lot if none selected
    if (parkingLots.length > 0 && !selectedLotId) {
      setSelectedLotId(parkingLots[0].id);
    }
  }, [parkingLots, selectedLotId]);

  if (loading && parkingLots.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" text="Loading parking system..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M12 2L2 7L12 12L22 7L12 2Z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-semibold text-gray-900">
                  AI Parking System
                </h1>
                <p className="text-sm text-gray-500">
                  Welcome, {user?.username}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Parking Lot Selector */}
              {parkingLots.length > 1 && (
                <select
                  value={selectedLotId || ''}
                  onChange={(e) => setSelectedLotId(parseInt(e.target.value))}
                  className="form-input text-sm"
                >
                  <option value="">Select Parking Lot</option>
                  {parkingLots.map(lot => (
                    <option key={lot.id} value={lot.id}>
                      {lot.name}
                    </option>
                  ))}
                </select>
              )}

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={logout}
                  className="btn btn-outline btn-sm"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route 
            path="/" 
            element={
              <UserDashboard 
                selectedLotId={selectedLotId}
                parkingLots={parkingLots}
                onLotChange={setSelectedLotId}
              />
            } 
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default UserPage;
