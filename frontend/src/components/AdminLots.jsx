import React, { useEffect, useState } from 'react';
import { parkingService } from '../services/api';
import { toast } from 'react-hot-toast';

const AdminLots = () => {
  const [lots, setLots] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [form, setForm] = useState({ name: '', total_slots: 0, video_url: '', is_active: true });

  const loadLots = async () => {
    try {
      const res = await parkingService.getAllParkingLots();
      if (res.data?.success) {
        setLots(res.data.data.parking_lots || res.data.data || []);
      }
    } catch (e) {
      toast.error('Failed to load parking lots');
    }
  };

  const loadLotStatus = async (lotId) => {
    if (!lotId) return;
    setLoading(true);
    try {
      const res = await parkingService.getParkingStatus(lotId);
      if (res.data?.success) {
        setSlots(res.data.data.slots || []);
      }
    } catch (e) {
      toast.error('Failed to load lot status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLots();
  }, []);

  useEffect(() => {
    if (selectedLot) {
      loadLotStatus(selectedLot.id);
      setForm({
        name: selectedLot.name,
        total_slots: selectedLot.total_slots,
        video_url: selectedLot.video_url || '',
        is_active: !!selectedLot.is_active,
      });
    } else {
      setForm({ name: '', total_slots: 0, video_url: '', is_active: true });
    }
  }, [selectedLot]);

  const freeAllOccupied = async () => {
    if (!selectedLot) return;
    const occupied = slots.filter(s => s.is_occupied);
    if (occupied.length === 0) return toast('No occupied slots');
    if (!window.confirm(`Free all ${occupied.length} occupied slots?`)) return;
    setActionLoading(true);
    try {
      for (const s of occupied) {
        await parkingService.releaseSlot(s.id);
      }
      toast.success('Freed occupied slots');
      await loadLotStatus(selectedLot.id);
    } catch (e) {
      toast.error('Failed to free some slots');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <select
          className="form-input"
          value={selectedLot?.id || ''}
          onChange={(e) => {
            const lot = lots.find(l => String(l.id) === e.target.value);
            setSelectedLot(lot || null);
          }}
        >
          <option value="">Select parking lot</option>
          {lots.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <button className="btn btn-outline" disabled={!selectedLot || actionLoading} onClick={() => selectedLot && loadLotStatus(selectedLot.id)}>{actionLoading? '...' : 'Refresh'}</button>
        <button className="btn btn-primary" disabled={!selectedLot || actionLoading} onClick={freeAllOccupied}>{actionLoading? 'Processing...' : 'Free all occupied'}</button>
        <button className="btn" disabled={actionLoading} onClick={() => setSelectedLot(null)}>New lot</button>
      </div>

      {/* Create/Edit Form */}
      <div className="bg-white border rounded p-4 mb-6 max-w-2xl">
        <h3 className="font-semibold mb-3">{selectedLot ? 'Edit Parking Lot' : 'Create Parking Lot'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Name</label>
            <input className="form-input" value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Total slots</label>
            <input className="form-input" type="number" value={form.total_slots} onChange={(e)=>setForm({ ...form, total_slots: parseInt(e.target.value)||0 })} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Video URL (optional)</label>
            <input className="form-input" value={form.video_url} onChange={(e)=>setForm({ ...form, video_url: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Active</label>
            <select className="form-input" value={form.is_active ? '1':'0'} onChange={(e)=>setForm({ ...form, is_active: e.target.value==='1' })}>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          {selectedLot ? (
            <>
              <button
                className="btn btn-primary"
                onClick={async ()=>{
                  if (!form.name || !form.total_slots || form.total_slots <= 0) { toast.error('Name and total slots required'); return; }
                  setActionLoading(true);
                  try {
                    await import('../services/api').then(({ adminService }) => adminService.updateParkingLot(selectedLot.id, form));
                    toast.success('Lot updated');
                    await loadLots();
                  } catch { toast.error('Update failed'); }
                  finally { setActionLoading(false); }
                }}
                disabled={actionLoading}
              >{actionLoading? 'Saving...' : 'Save'}</button>
              <button
                className="btn btn-outline"
                onClick={async ()=>{
                  if (!window.confirm('Delete this parking lot?')) return;
                  setActionLoading(true);
                  try {
                    await import('../services/api').then(({ adminService }) => adminService.deleteParkingLot(selectedLot.id));
                    toast.success('Lot deleted');
                    setSelectedLot(null);
                    await loadLots();
                  } catch { toast.error('Delete failed'); }
                  finally { setActionLoading(false); }
                }}
                disabled={actionLoading}
              >{actionLoading? 'Deleting...' : 'Delete'}</button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              onClick={async ()=>{
                if (!form.name || !form.total_slots || form.total_slots <= 0) { toast.error('Name and total slots required'); return; }
                setActionLoading(true);
                try {
                  await import('../services/api').then(({ adminService }) => adminService.createParkingLot(form));
                  toast.success('Lot created');
                  setForm({ name: '', total_slots: 0, video_url: '', is_active: true });
                  await loadLots();
                } catch { toast.error('Create failed'); }
                finally { setActionLoading(false); }
              }}
              disabled={actionLoading}
            >{actionLoading? 'Creating...' : 'Create'}</button>
          )}
        </div>
      </div>

      {loading && <div>Loading...</div>}

      {selectedLot && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Slot</th>
                <th className="px-4 py-2 text-left">Occupied</th>
                <th className="px-4 py-2 text-left">Predicted Vacant (s)</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slots.length === 0 && (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={4}>No slots to display</td></tr>
              )}
              {slots.map(s => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2">{s.slot_number}</td>
                  <td className="px-4 py-2">{s.is_occupied ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2">{s.predicted_vacancy_seconds}</td>
                  <td className="px-4 py-2">
                    {s.is_occupied ? (
                      <button className="btn btn-outline"
                        disabled={actionLoading}
                        onClick={async ()=>{ if (!window.confirm(`Free slot ${s.slot_number}?`)) return; setActionLoading(true); try { await parkingService.releaseSlot(s.id); toast.success(`Freed slot ${s.slot_number}`); await loadLotStatus(selectedLot.id); } catch { toast.error('Failed'); } finally { setActionLoading(false); } }}>
                        Free slot
                      </button>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminLots;


