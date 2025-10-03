import React, { useEffect, useState } from 'react';
import { adminService } from '../services/api';
import { toast } from 'react-hot-toast';
import Analytics from './Analytics';

const AdminAnalytics = () => {
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminService.getSystemAnalytics(7);
      if (res.data?.success) setSystem(res.data.data);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-outline" onClick={load}>Refresh</button>
      </div>
      {loading && <div>Loading...</div>}
      {system && <Analytics />}
    </div>
  );
};

export default AdminAnalytics;





