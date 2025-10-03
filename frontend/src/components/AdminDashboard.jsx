import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ChartBarIcon,
  VideoCameraIcon,
  MapIcon,
  UsersIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import { useParking } from "../contexts/ParkingContext";
import { adminService, videoService } from "../services/api";
import ParkingSlotGrid, { MiniParkingGrid } from "./ParkingSlotGrid";
import VideoUpload from "./VideoUpload";
import Analytics from "./Analytics";
import LoadingSpinner, { CardSkeleton } from "./LoadingSpinner";
import { formatTime, formatDuration } from "../utils/dateUtils";
import { toast } from "react-hot-toast";

const AdminDashboard = () => {
  const {
    parkingLots,
    statistics,
    loadParkingLots,
    updateSlotStatus,
    releaseSlot,
  } = useParking();
  const [systemAnalytics, setSystemAnalytics] = useState(null);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [processingQueue, setProcessingQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showVideoUpload, setShowVideoUpload] = useState(false);

  // Load admin dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadParkingLots(),
          loadSystemAnalytics(),
          loadRecentAnalyses(),
          loadProcessingQueue(),
        ]);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [loadParkingLots]);

  const loadSystemAnalytics = async () => {
    try {
      const response = await adminService.getSystemAnalytics(7);
      if (response.data.success) {
        setSystemAnalytics(response.data.data);
      }
    } catch (error) {
      console.error("Error loading system analytics:", error);
      toast.error(
        "System analytics unavailable (backend 500). This is usually due to missing analytics tables/data."
      );
    }
  };

  const deleteAnalysis = async (analysis) => {
    if (!analysis) return;
    if (analysis.processing_status === "processing") {
      const confirmForce = window.confirm("This analysis is processing. Force delete now? This will stop and remove it.");
      if (!confirmForce) return;
      // Fall through to deletion without cancel (backend will force-fail then delete)
    }

    // If pending, try to cancel first, then delete
    if (analysis.processing_status === "pending") {
      const confirmCancel = window.confirm("This analysis is pending. Cancel now and delete?");
      if (!confirmCancel) return;
      try {
        await videoService.cancelAnalysis(analysis.id);
      } catch (e) {
        // If cancel fails, surface message and stop
        return toast.error(e?.response?.data?.message || "Cancel failed");
      }
    }

    if (!window.confirm("Delete this analysis?")) return;
    try {
      await videoService.deleteAnalysis(analysis.id);
      toast.success("Analysis deleted");
      loadRecentAnalyses();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Delete failed");
    }
  };

  const loadRecentAnalyses = async () => {
    try {
      const response = await videoService.getRecentAnalyses(10);
      if (response.data.success) {
        setRecentAnalyses(response.data.data.analyses);
      }
    } catch (error) {
      console.error("Error loading recent analyses:", error);
    }
  };

  const loadProcessingQueue = async () => {
    try {
      const response = await videoService.getProcessingQueue();
      if (response.data.success) {
        setProcessingQueue(response.data.data);
      }
    } catch (error) {
      console.error("Error loading processing queue:", error);
    }
  };

  const handleVideoUploadSuccess = () => {
    setShowVideoUpload(false);
    loadRecentAnalyses();
    loadProcessingQueue();
    toast.success("Video uploaded successfully");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">System overview and management tools</p>
        </div>
        <button
          onClick={() => setShowVideoUpload(true)}
          className="btn btn-primary"
        >
          <VideoCameraIcon className="w-4 h-4 mr-2" />
          Upload Video
        </button>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={async () => {
              try {
                await loadSystemAnalytics();
                toast.success("Analytics refreshed");
              } catch (e) {
                toast.error("Failed to refresh analytics");
              }
            }}
            className="btn btn-outline"
          >
            Refresh Analytics
          </button>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Parking Lots</p>
              <p className="text-2xl font-bold text-gray-900">
                {systemAnalytics?.overall_statistics?.total_lots ||
                  parkingLots.length}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Slots</p>
              <p className="text-2xl font-bold text-gray-900">
                {systemAnalytics?.overall_statistics?.total_slots ||
                  statistics.totalSlots}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Occupancy Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {systemAnalytics?.overall_statistics?.overall_occupancy_rate ||
                  statistics.occupancyRate}
                %
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <VideoCameraIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Processing Queue</p>
              <p className="text-2xl font-bold text-gray-900">
                {processingQueue?.queue?.pending || 0}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parking Lots Overview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Parking Lots Overview
            </h3>
            {parkingLots.length > 0 ? (
              <div className="space-y-4">
                {parkingLots.map((lot) => (
                  <div
                    key={lot.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {lot.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {lot.statistics?.available_slots || 0} available of{" "}
                          {lot.total_slots} total
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">
                          {lot.statistics?.occupancy_rate || 0}%
                        </div>
                        <div className="text-xs text-gray-500">Occupancy</div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${lot.statistics?.occupancy_rate || 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MapIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No parking lots configured</p>
              </div>
            )}
          </div>

          {/* Recent Video Analyses */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Video Analyses
            </h3>
            {recentAnalyses.length > 0 ? (
              <div className="space-y-3">
                {recentAnalyses.map((analysis) => (
                  <div
                    key={analysis.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-3 ${
                          analysis.processing_status === "completed"
                            ? "bg-green-500"
                            : analysis.processing_status === "processing"
                            ? "bg-yellow-500"
                            : analysis.processing_status === "failed"
                            ? "bg-red-500"
                            : "bg-gray-400"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {analysis.video_filename}
                        </p>
                        <p className="text-xs text-gray-600">
                          {analysis.parking_lot_name} •{" "}
                          {formatTime(analysis.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="text-sm font-medium text-gray-900 capitalize">
                        {analysis.processing_status}
                      </div>
                      {analysis.processing_duration_seconds && (
                        <div className="text-xs text-gray-500">
                          {formatDuration(analysis.processing_duration_seconds)}
                        </div>
                      )}
                      <button
                        className="btn btn-danger btn-xs mt-1"
                        onClick={() => deleteAnalysis(analysis)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <LoadingSpinner size="small" text="Loading queue..." />
            )}
          </div>

          {/* System Health */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              System Health
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  <span className="text-sm font-medium text-green-600">
                    Online
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">AI Services</span>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  <span className="text-sm font-medium text-green-600">
                    Online
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">WebSocket</span>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  <span className="text-sm font-medium text-green-600">
                    Connected
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button className="w-full btn btn-outline text-left justify-start">
                <MapIcon className="w-4 h-4 mr-2" />
                Create Parking Lot
              </button>
              <button className="w-full btn btn-outline text-left justify-start">
                <UsersIcon className="w-4 h-4 mr-2" />
                Manage Users
              </button>
              <button className="w-full btn btn-outline text-left justify-start">
                <ChartBarIcon className="w-4 h-4 mr-2" />
                View Analytics
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Upload Modal */}
      {showVideoUpload && (
        <VideoUpload
          isOpen={showVideoUpload}
          onClose={() => setShowVideoUpload(false)}
          onSuccess={handleVideoUploadSuccess}
          parkingLots={parkingLots}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
