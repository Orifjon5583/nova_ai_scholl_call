import React, { useState, useEffect } from 'react';
import { CheckSquare, Plus, Clock, AlertTriangle, UserCheck, CheckCircle2, Circle, Calendar, MapPin, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';

const Tasks = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'deadlines' | 'custom'>('deadlines');
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [leadDeadlines, setLeadDeadlines] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);

  // Create Task Modal state (Admin)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    dueDate: ''
  });

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : {};
  const isAdmin = user?.role === 'admin';

  const fetchData = async () => {
    try {
      const response = await api.get('/tasks');
      setTasks(response.data.tasks || []);
      setLeadDeadlines(response.data.leadDeadlines || []);
      setOperators(response.data.operators || []);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTask = async () => {
    if (!createForm.title || !createForm.assignedTo) {
      alert("Iltimos, vazifa sarlavhasi va operatorni tanlang!");
      return;
    }
    try {
      await api.post('/tasks', createForm);
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', assignedTo: '', dueDate: '' });
      fetchData();
    } catch (err) {
      console.error('Failed to create task', err);
    }
  };

  const handleToggleTask = async (id: number) => {
    try {
      await api.put(`/tasks/${id}/toggle`);
      fetchData();
    } catch (err) {
      console.error('Failed to toggle task', err);
    }
  };

  const handleClearLeadDeadline = async (leadId: number) => {
    try {
      await api.put(`/leads/${leadId}`, { nextCallAt: null });
      fetchData();
    } catch (err) {
      console.error('Failed to clear lead deadline', err);
    }
  };

  const overdueCount = leadDeadlines.filter(l => new Date(l.nextCallAt).getTime() < Date.now()).length;
  const pendingCustomCount = tasks.filter(t => t.status === 'pending').length;

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#173127]">Vazifalar taxtasi</h2>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? "Operatorlarga topshiriqlar berish va bajarilishini nazorat qilish" : "Bugungi bajarilishi kerak bo'lgan vazifalar va qo'ng'iroqlar"}
          </p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-[#008F4C] hover:bg-[#007041] text-white px-5 py-3 rounded-xl font-bold transition shadow-sm flex items-center gap-2 text-sm"
          >
            <Plus size={18} />
            Yangi vazifa yuklash
          </button>
        )}
      </div>

      {/* Tabs & Stats */}
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setActiveTab('deadlines')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition shadow-sm ${
            activeTab === 'deadlines' ? 'bg-[#005B35] text-[#F4C400]' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <Clock size={18} />
          Qo'ng'iroq Deadline'lari
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ml-1 ${overdueCount > 0 ? 'bg-red-500 text-white font-extrabold animate-pulse' : 'bg-[#F4C400] text-[#173127]'}`}>
            {leadDeadlines.length}
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('custom')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition shadow-sm ${
            activeTab === 'custom' ? 'bg-[#005B35] text-[#F4C400]' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <CheckSquare size={18} />
          Admin Topshiriqlari
          <span className="bg-amber-500 text-white text-[11px] px-2 py-0.5 rounded-full font-bold ml-1">{pendingCustomCount}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008F4C]"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* TAB 1: Lead Deadlines */}
          {activeTab === 'deadlines' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {leadDeadlines.map((lead: any) => {
                const isOverdue = new Date(lead.nextCallAt).getTime() < Date.now();
                return (
                  <div 
                    key={`lead-task-${lead.id}`}
                    className={`bg-white p-5 rounded-2xl border transition shadow-sm flex flex-col justify-between ${
                      isOverdue ? 'border-red-300 ring-1 ring-red-200 bg-red-50/20' : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <Link 
                          to={`/crm?leadId=${lead.id}`}
                          className="font-bold text-lg text-[#173127] hover:text-[#008F4C] transition"
                        >
                          {lead.name}
                        </Link>
                        {(() => {
                          const dueDate = new Date(lead.nextCallAt);
                          const now = new Date();
                          const isOverdue = dueDate.getTime() < now.getTime();
                          const isToday = dueDate.toDateString() === now.toDateString();

                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          const isTomorrow = dueDate.toDateString() === tomorrow.toDateString();

                          if (isOverdue) {
                            return (
                              <span className="bg-red-100 text-red-700 text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-md flex items-center gap-1">
                                <AlertTriangle size={12} /> Muddati o'tgan
                              </span>
                            );
                          } else if (isToday) {
                            return (
                              <span className="bg-green-100 text-green-700 text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-md">
                                Bugun
                              </span>
                            );
                          } else if (isTomorrow) {
                            return (
                              <span className="bg-amber-100 text-amber-700 text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-md">
                                Ertaga
                              </span>
                            );
                          } else {
                            return (
                              <span className="bg-blue-100 text-blue-700 text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-md">
                                Rejalashtirilgan
                              </span>
                            );
                          }
                        })()}
                      </div>

                      <div className="space-y-2 mb-4">
                        <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                          📞 <span className="font-bold text-gray-700">{lead.phone}</span>
                        </p>
                        {lead.region && (
                          <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                            <MapPin size={14} className="text-gray-400" /> {lead.region}
                          </p>
                        )}
                        {isAdmin && lead.operator && (
                          <p className="text-xs text-blue-600 font-bold flex items-center gap-1.5">
                            <UserCheck size={14} /> Operator: {lead.operator.name}
                          </p>
                        )}
                      </div>

                      {lead.comments && lead.comments.length > 0 && (
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4">
                          <p className="text-xs text-gray-600 italic font-medium line-clamp-2">
                            "{lead.comments[0].comment}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
                        <Clock size={14} className="text-gray-400" />
                        📅 {new Date(lead.nextCallAt).toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleClearLeadDeadline(lead.id)}
                          title="Deadlineni olib tashlash"
                          className="bg-gray-100 hover:bg-red-100 hover:text-red-600 text-gray-500 p-1.5 rounded-lg text-xs font-bold transition"
                        >
                          ✕
                        </button>
                        <Link 
                          to={`/crm?leadId=${lead.id}`}
                          className="bg-[#008F4C] hover:bg-[#007041] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
                        >
                          Qo'ng'iroq
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}

              {leadDeadlines.length === 0 && (
                <div className="col-span-full py-16 text-center text-gray-400 font-medium bg-white rounded-2xl border border-gray-100">
                  Ajoyib! Bugun qo'ng'iroq qilinishi kerak bo'lgan kechikayotgan deadline'lar yo'q 🎉
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Custom Admin Tasks */}
          {activeTab === 'custom' && (
            <div className="space-y-4">
              {tasks.map((task: any) => {
                const isDone = task.status === 'completed';
                return (
                  <div 
                    key={`custom-task-${task.id}`}
                    className={`p-5 rounded-2xl border transition shadow-sm flex justify-between items-center ${
                      isDone ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-amber-200 hover:border-amber-400'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <button 
                        onClick={() => handleToggleTask(task.id)}
                        className="mt-1 text-gray-400 hover:text-[#008F4C] transition"
                      >
                        {isDone ? (
                          <CheckCircle2 size={24} className="text-[#008F4C]" />
                        ) : (
                          <Circle size={24} className="text-gray-300 hover:text-amber-500" />
                        )}
                      </button>

                      <div>
                        <h4 className={`font-bold text-base ${isDone ? 'line-through text-gray-500' : 'text-[#173127]'}`}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1 font-medium">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 font-medium">
                          <span>Biriktirdi: <strong className="text-gray-600">{task.creator?.name || 'Admin'}</strong></span>
                          <span>Bajaruvchi: <strong className="text-blue-600">{task.assignedUser?.name || 'Operator'}</strong></span>
                          {task.dueDate && (
                            <span className="flex items-center gap-1 text-amber-600 font-bold">
                              <Calendar size={12} /> {new Date(task.dueDate).toLocaleDateString('uz-UZ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleToggleTask(task.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                        isDone ? 'bg-gray-200 text-gray-600' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      }`}
                    >
                      {isDone ? 'Qayta ochish' : 'Bajarildi ✓'}
                    </button>
                  </div>
                );
              })}

              {tasks.length === 0 && (
                <div className="py-16 text-center text-gray-400 font-medium bg-white rounded-2xl border border-gray-100">
                  Hozircha biriktirilgan maxsus vazifalar mavjud emas.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Admin Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[150] bg-black/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-xl text-[#173127]">Yangi Vazifa Biriktirish</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Vazifa Sarlavhasi</label>
              <input 
                type="text" 
                value={createForm.title}
                onChange={e => setCreateForm({...createForm, title: e.target.value})}
                placeholder="Masalan: Bugun Xorazm lidlariga qayta aloqaga chiqilsin"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#008F4C] text-sm font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Batafsil ma'lumot (Ixtiyoriy)</label>
              <textarea 
                value={createForm.description}
                onChange={e => setCreateForm({...createForm, description: e.target.value})}
                placeholder="Vazifa bo'yicha izoh yoki ko'rsatmalar..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#008F4C] text-sm font-medium resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Biriktiriluvchi Operator</label>
              <select 
                value={createForm.assignedTo}
                onChange={e => setCreateForm({...createForm, assignedTo: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#008F4C] text-sm font-bold bg-white"
              >
                <option value="">-- Operatorni tanlang --</option>
                {operators.map((op: any) => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Bajarilish Muddat (Deadline)</label>
              <input 
                type="date" 
                value={createForm.dueDate}
                onChange={e => setCreateForm({...createForm, dueDate: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#008F4C] text-sm font-bold bg-white"
              />
            </div>

            <button 
              onClick={handleCreateTask}
              className="bg-[#008F4C] hover:bg-[#007041] text-white py-3.5 rounded-xl font-bold transition shadow-sm mt-2"
            >
              Vazifani Yuborish
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
