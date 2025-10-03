import React, { useEffect, useState } from 'react';
import { videoService, parkingService } from '../services/api';
import { toast } from 'react-hot-toast';

const AdminVideo = () => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLot, setSelectedLot] = useState('');
  const [lots, setLots] = useState([]);
  const [file, setFile] = useState(null);

  const loadAnalyses = async () => {
    setLoading(true);
    try {
      const res = await videoService.getRecentAnalyses(50);
      if (res.data?.success) {
        setAnalyses(res.data.data || res.data.analyses || []);
      }
    } catch (e) {
      toast.error('Failed to load video analyses');
    } finally {
      setLoading(false);
    }
  };

  const deleteAnalysis = async (id) => {
    const item = analyses.find(a => a.id === id);
    if (!item) return;

    if (item.processing_status === 'processing') {
      const confirmForce = window.confirm('This analysis is processing. Force delete now? This will stop and remove it.');
      if (!confirmForce) return;
    } else if (item.processing_status === 'pending') {
      const confirmCancel = window.confirm('This analysis is pending. Cancel and delete?');
      if (!confirmCancel) return;
      try {
        await videoService.cancelAnalysis(id);
      } catch (e) {
        return toast.error(e?.response?.data?.message || 'Cancel failed');
      }
    } else {
      if (!window.confirm('Delete this analysis?')) return;
    }
    try {
      await videoService.deleteAnalysis(id);
      toast.success('Analysis deleted');
      loadAnalyses();
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const cancelProcessing = async (id) => {
    const item = analyses.find(a => a.id === id);
    if (!item) return;
    if (item.processing_status !== 'pending') {
      return toast.error('Only pending analyses can be cancelled');
    }
    if (!window.confirm('Cancel this pending video processing?')) return;
    try {
      await videoService.cancelAnalysis(id);
      toast.success('Processing cancelled');
      await loadAnalyses();
    } catch (e) {
      toast.error('Cancel failed');
    }
  };

  const editAnalysis = (id) => {
    toast('Edit functionality not implemented yet');
    // Implement your edit logic here (e.g., open a modal)
  };

  const deleteIfPending = async (id) => {
    const item = analyses.find(a => a.id === id);
    if (!item) return;
    if (item.processing_status !== 'pending') return toast('Not pending');
    if (!window.confirm('Delete this pending analysis?')) return;
    try {
      await videoService.deleteAnalysis(id);
      toast.success('Pending analysis deleted');
      loadAnalyses();
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  useEffect(() => { loadAnalyses(); }, []);
  useEffect(() => { (async()=>{ try { const res = await parkingService.getAllParkingLots(); if (res.data?.success) setLots(res.data.data.parking_lots || res.data.data || []); } catch {} })(); }, []);

  const upload = async () => {
    if (!file || !selectedLot) return toast.error('Select lot and file');
    try {
      const form = new FormData();
      form.append('video', file);
      form.append('parking_lot_id', selectedLot);
      await videoService.uploadVideo(form);
      toast.success('Upload started');
      setFile(null);
      loadAnalyses();
    } catch { toast.error('Upload failed'); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select className="form-input" value={selectedLot} onChange={(e)=>setSelectedLot(e.target.value)}>
          <option value="">Select lot</option>
          {lots.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
        </select>
        <input className="form-input" type="file" accept="video/*" onChange={(e)=>setFile(e.target.files?.[0]||null)} />
        <button className="btn btn-primary" onClick={upload}>Upload</button>
        <button className="btn btn-outline" onClick={loadAnalyses}>Refresh</button>
      </div>
      {loading && <div>Loading...</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Lot</th>
              <th className="px-4 py-2 text-left">File</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(analyses) ? analyses : []).map(a => (
              <tr key={a.id} className="border-t">
                <td className="px-4 py-2">{a.id}</td>
                <td className="px-4 py-2">{a.parking_lot_id}</td>
                <td className="px-4 py-2">{a.video_filename}</td>
                <td className="px-4 py-2">{a.processing_status}</td>
                <td className="px-4 py-2 flex gap-2">
                  <button className="btn btn-outline" onClick={() => editAnalysis(a.id)}>Edit</button>
                  <button className="btn btn-danger" onClick={() => deleteAnalysis(a.id)}>Delete</button>
                  {a.processing_status === 'pending' && (
                    <>
                      <button className="btn btn-outline" onClick={() => cancelProcessing(a.id)}>Cancel</button>
                      <button className="btn btn-outline" onClick={() => deleteIfPending(a.id)}>Delete pending</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminVideo;