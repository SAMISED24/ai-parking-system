import React, { useEffect, useState } from 'react';
import { adminService } from '../services/api';
import { toast } from 'react-hot-toast';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'user', is_active: true });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await adminService.getAllUsers();
      if (res.data?.success) {
        setUsers(res.data.data.users || res.data.data || []);
      }
    } catch (e) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    if (selectedUser) {
      setForm({
        username: selectedUser.username,
        email: selectedUser.email || '',
        password: '',
        role: selectedUser.role || 'user',
        is_active: !!selectedUser.is_active,
      });
    } else {
      setForm({ username: '', email: '', password: '', role: 'user', is_active: true });
    }
  }, [selectedUser]);

  const toggleActive = async (u) => {
    try {
      await adminService.updateUser(u.id, { is_active: !u.is_active });
      toast.success('Updated');
      loadUsers();
    } catch (e) {
      toast.error('Update failed');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-outline" onClick={loadUsers}>Refresh</button>
        <button className="btn" onClick={()=>setSelectedUser(null)}>New user</button>
      </div>

      {/* Create/Edit Form */}
      <div className="bg-white border rounded p-4 mb-6 max-w-2xl">
        <h3 className="font-semibold mb-3">{selectedUser ? 'Edit User' : 'Create User'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Username</label>
            <input className="form-input" value={form.username} onChange={(e)=>setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input className="form-input" value={form.email} onChange={(e)=>setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Password {selectedUser && <span className="text-gray-400">(leave blank to keep)</span>}</label>
            <input type="password" className="form-input" value={form.password} onChange={(e)=>setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">Role</label>
            <select className="form-input" value={form.role} onChange={(e)=>setForm({ ...form, role: e.target.value })}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
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
          {selectedUser ? (
            <>
              <button className="btn btn-primary" onClick={async ()=>{
                try {
                  const payload = { username: form.username, email: form.email, role: form.role, is_active: form.is_active };
                  if (form.password) payload.password = form.password;
                  await adminService.updateUser(selectedUser.id, payload);
                  toast.success('User updated');
                  await loadUsers();
                } catch { toast.error('Save failed'); }
              }}>Save</button>
              <button className="btn btn-outline" onClick={async ()=>{
                if (!window.confirm('Delete this user?')) return;
                try { await adminService.deleteUser(selectedUser.id); toast.success('User deleted'); setSelectedUser(null); loadUsers(); } catch { toast.error('Delete failed'); }
              }}>Delete</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={async ()=>{
              try { await adminService.createUser({ username: form.username, email: form.email, password: form.password, role: form.role }); toast.success('User created'); setForm({ username:'', email:'', password:'', role:'user', is_active:true }); loadUsers(); } catch { toast.error('Create failed'); }
            }}>Create</button>
          )}
        </div>
      </div>
      {loading && <div>Loading...</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Username</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Active</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t cursor-pointer" onClick={()=>setSelectedUser(u)}>
                <td className="px-4 py-2">{u.id}</td>
                <td className="px-4 py-2">{u.username}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.role}</td>
                <td className="px-4 py-2">{u.is_active ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2 flex gap-2">
                  <button className="btn btn-outline" onClick={() => toggleActive(u)}>
                    {u.is_active ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;


