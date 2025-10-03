import React, { useEffect, useState } from 'react';
import { adminService } from '../services/api';
import { toast } from 'react-hot-toast';

const AdminSettings = () => {
  const [config, setConfig] = useState({});

  const load = async () => {
    try {
      const res = await adminService.getSystemConfiguration();
      if (res.data?.success) setConfig(res.data.data.configuration || {});
    } catch {
      toast.error('Failed to load settings');
    }
  };

  const save = async () => {
    try {
      await adminService.updateSystemConfiguration(config);
      toast.success('Settings saved');
    } catch {
      toast.error('Save failed');
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm mb-1">Mock Analysis (fallback)</label>
          <select className="form-input" value={config?.mock_analysis ? '1' : '0'} onChange={(e)=>setConfig({ ...config, mock_analysis: e.target.value==='1' })}>
            <option value="0">Disabled</option>
            <option value="1">Enabled</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Rate Limit (requests/5min)</label>
          <input className="form-input" type="number" value={config?.rate_limit || 2000} onChange={(e)=>setConfig({ ...config, rate_limit: parseInt(e.target.value)||0 })} />
        </div>
        <button className="btn btn-primary" onClick={save}>Save</button>
      </div>
    </div>
  );
};

export default AdminSettings;





