import React, { useState, useEffect } from 'react';
import { UserPlus, Key, Trash2, Phone, UserCheck, ShieldCheck, Search, Users } from 'lucide-react';
import api from '../api';

const Operators = () => {
  const [operators, setOperators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    username: '',
    password: '',
    phone: ''
  });

  // Reset Password Modal State
  const [selectedOperator, setSelectedOperator] = useState<any>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const fetchOperators = async () => {
    try {
      const response = await api.get('/operators');
      setOperators(response.data);
    } catch (err) {
      console.error('Failed to fetch operators', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperators();
  }, []);

  const handleCreateOperator = async () => {
    if (!createForm.name || !createForm.username || !createForm.password) {
      alert("Ism, login va parol kiritilishi shart!");
      return;
    }
    try {
      await api.post('/operators', createForm);
      setShowCreateModal(false);
      setCreateForm({ name: '', username: '', password: '', phone: '' });
      fetchOperators();
    } catch (err: any) {
      alert(err.response?.data?.error || "Operator qo'shishda xatolik");
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      alert("Yangi parol kamida 4 belgidan iborat bo'lishi kerak!");
      return;
    }
    try {
      await api.put(`/operators/${selectedOperator.id}/password`, { newPassword });
      setShowPasswordModal(false);
      setSelectedOperator(null);
      setNewPassword('');
      alert("Parol muvaffaqiyatli o'zgartirildi!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Parolni o'zgartirishda xatolik");
    }
  };

  const handleDeleteOperator = async (id: number, name: string) => {
    if (confirm(`Rostan ham "${name}" nomli operatorni o'chirmoqchimisiz?`)) {
      try {
        await api.delete(`/operators/${id}`);
        fetchOperators();
      } catch (err) {
        console.error('Failed to delete operator', err);
      }
    }
  };

  const filteredOperators = operators.filter((op: any) =>
    op.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (op.phone && op.phone.includes(searchTerm))
  );

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#173127]">Operatorlar boshqaruvi</h2>
          <p className="text-gray-500 text-sm mt-1">Tizimdagi barcha operatorlarni boshqarish, yangi operator qo'shish va parollarni yangilash</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#008F4C] hover:bg-[#007041] text-white px-5 py-3 rounded-xl font-bold transition shadow-sm flex items-center gap-2 text-sm"
        >
          <UserPlus size={18} />
          + Yangi Operator Qo'shish
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008F4C]"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2 text-[#173127] font-bold">
              <Users size={18} />
              <span>Jami Operatorlar: {operators.length} ta</span>
            </div>
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Ismi yoki logini bo'yicha..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008F4C]"
              />
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="py-3 px-6 font-semibold text-xs text-gray-500 uppercase">Operator</th>
                  <th className="py-3 px-6 font-semibold text-xs text-gray-500 uppercase">Login (Username)</th>
                  <th className="py-3 px-6 font-semibold text-xs text-gray-500 uppercase">Telefon</th>
                  <th className="py-3 px-6 font-semibold text-xs text-gray-500 uppercase">Biriktirilgan Lidlar</th>
                  <th className="py-3 px-6 font-semibold text-xs text-gray-500 uppercase">Bugungi Qo'ng'iroqlar</th>
                  <th className="py-3 px-6 font-semibold text-xs text-gray-500 uppercase">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filteredOperators.map((op: any) => (
                  <tr key={op.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#008F4C] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                          {op.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-[#173127] text-sm">{op.name}</p>
                          <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold">Faol</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-sm text-gray-700 font-bold">
                      @{op.username}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600 font-medium">
                      {op.phone || '—'}
                    </td>
                    <td className="py-4 px-6">
                      <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-lg text-xs border border-blue-100">
                        {op._count?.assignedLeads || 0} ta lid
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="bg-amber-50 text-amber-800 font-bold px-3 py-1 rounded-lg text-xs border border-amber-100">
                        {op.todayCallsCount || 0} ta qo'ng'iroq
                      </span>
                    </td>
                    <td className="py-4 px-6 flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedOperator(op);
                          setShowPasswordModal(true);
                        }}
                        className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 p-2 rounded-lg border border-yellow-200 transition"
                        title="Parolni yangilash"
                      >
                        <Key size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteOperator(op.id, op.name)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 p-2 rounded-lg border border-red-200 transition"
                        title="Operatorni o'chirish"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredOperators.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400 font-medium">
                      Operatorlar topilmadi...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Operator Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-xl text-[#173127]">Yangi Operator Yaratish</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">To'liq Ismi (F.I.SH)</label>
              <input
                type="text"
                value={createForm.name}
                onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="Masalan: Sardor Alimov"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#008F4C] text-sm font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Tizimga kirish logini (Username)</label>
              <input
                type="text"
                value={createForm.username}
                onChange={e => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder="sardor_operator"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#008F4C] text-sm font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Parol</label>
              <input
                type="password"
                value={createForm.password}
                onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#008F4C] text-sm font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Telefon Raqami (Ixtiyoriy)</label>
              <input
                type="text"
                value={createForm.phone}
                onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                placeholder="+998 90 123 45 67"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#008F4C] text-sm font-medium"
              />
            </div>

            <button
              onClick={handleCreateOperator}
              className="bg-[#008F4C] hover:bg-[#007041] text-white py-3.5 rounded-xl font-bold transition shadow-sm mt-2"
            >
              Operatorni Saqlash
            </button>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && selectedOperator && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-[#173127]">Parolni Yangilash</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 font-bold">✕</button>
            </div>
            <p className="text-xs text-gray-500">
              <strong>{selectedOperator.name}</strong> (@{selectedOperator.username}) uchun yangi parol o'rnating:
            </p>

            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Yangi parol..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#008F4C] text-sm font-bold"
            />

            <button
              onClick={handleResetPassword}
              className="bg-[#F4C400] hover:bg-[#e0b400] text-[#173127] py-3 rounded-xl font-bold transition shadow-sm"
            >
              Parolni Saqlash
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Operators;
