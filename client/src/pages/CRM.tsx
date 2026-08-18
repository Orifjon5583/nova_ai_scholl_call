import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, Download, Filter, List, LayoutGrid, ChevronLeft, Phone, Clock, MessageSquare, Save, MoreHorizontal } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api';

interface CRMProps {
  filter?: string;
  isKanban?: boolean;
}

const schoolGrades = ['1-sinf', '2-sinf', '3-sinf', '4-sinf', '5-sinf', '6-sinf', '7-sinf', '8-sinf'];

const CRM: React.FC<CRMProps> = ({ filter, isKanban }) => {
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<'list' | 'kanban' | 'grades'>(isKanban ? 'kanban' : 'list');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dynamic Kanban Columns (Persisted in localStorage)
  const [columns, setColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nova_crm_kanban_columns');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load columns from localStorage', e);
    }
    return ['Yangi', 'Kutilmoqda', 'Qayta qo\'ng\'iroq', 'Aloqa bo\'ldi'];
  });
  const [newColumnName, setNewColumnName] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  // Sync columns with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nova_crm_kanban_columns', JSON.stringify(columns));
    } catch (e) {
      console.error('Failed to save columns to localStorage', e);
    }
  }, [columns]);

  // Detail Tabs
  const [activeTab, setActiveTab] = useState<'timeline' | 'calls' | 'comments' | 'info'>('timeline');

  // Timer state
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callTimer, setCallTimer] = useState<any>(null);

  // Sort and Filter States
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'most_delayed'
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Manual Lead Modal
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [manualLeadForm, setManualLeadForm] = useState({ name: '', phone: '', source: '', region: '' });

  // Post Call Wrap-up Modal
  const [showPostCallModal, setShowPostCallModal] = useState(false);
  const [postCallForm, setPostCallForm] = useState({ comment: '', status: '', quality: '', nextCallAt: '' });

  // Excel / CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [parsedLeads, setParsedLeads] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rows || rows.length === 0) {
          alert("Faylda lidlar topilmadi!");
          return;
        }

        const extracted: any[] = rows.map((row: any) => {
          const keys = Object.keys(row);
          const findVal = (exactKeys: string[], fallbackKeys: string[]) => {
            // 1. Try exact match first
            for (const key of keys) {
              const k = key.toLowerCase().trim();
              if (exactKeys.includes(k)) {
                return row[key];
              }
            }
            // 2. Try substring match ignoring ad_name / adset_name / campaign_name / form_name
            for (const key of keys) {
              const k = key.toLowerCase().trim();
              if (k.includes('ad_') || k.includes('adset') || k.includes('campaign') || k.includes('form')) continue;
              if (fallbackKeys.some(f => k.includes(f))) {
                return row[key];
              }
            }
            return '';
          };

          let name = findVal(['full_name', 'full name', 'ism', 'f.i.sh', 'name'], ['full_name', 'full name', 'ism', 'f.i.sh']);
          let phone = findVal(['phone_number', 'phone number', 'phone', 'telefon', 'raqam'], ['phone_number', 'phone number', 'phone', 'telefon']);
          let createdAt = findVal(['created_time', 'created time', 'created_at', 'created at', 'sana', 'vaqt'], ['created_time', 'created_at', 'created']);

          // If keys didn't match header names, fallback by column index or raw object values
          const rawVals = Object.values(row);
          if (!name && rawVals.length > 0) name = rawVals[12] || rawVals[0] || "Noma'lum";
          if (!phone && rawVals.length > 1) phone = rawVals[13] || rawVals[1] || "Noma'lum";
          if (!createdAt && rawVals.length > 2) createdAt = rawVals[1] || rawVals[2] || new Date().toISOString();

          let cleanPhone = (phone || '').toString().trim();
          if (cleanPhone.startsWith('p:')) {
            cleanPhone = cleanPhone.replace('p:', '').trim();
          }

          return {
            name: (name || '').toString().trim() || "Noma'lum",
            phone: cleanPhone || "Noma'lum",
            createdAt: (createdAt || '').toString().trim() || new Date().toISOString(),
            source: 'Meta Ads Excel'
          };
        });

        setParsedLeads(extracted);
      } catch (err) {
        console.error('Failed to parse Excel file', err);
        alert("Faylni o'qishda xatolik yuz berdi. Iltimos to'g'ri Excel (.xlsx / .csv) fayl yuklang.");
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = async () => {
    if (parsedLeads.length === 0) return;
    setImportLoading(true);
    try {
      await api.post('/leads/import', { leads: parsedLeads });
      setShowImportModal(false);
      setParsedLeads([]);
      fetchLeads();
      alert(`Muvaffaqiyatli ${parsedLeads.length} ta lid tizimga saqlandi!`);
    } catch (err) {
      console.error('Import failed', err);
      alert('Lidlarni saqlashda xatolik yuz berdi');
    } finally {
      setImportLoading(false);
    }
  };

  const xorazmRegions = ['Urganch', 'Xiva', 'Bog\'ot', 'Xonqa', 'Qo\'shko\'pir', 'Shovot', 'Gurlan', 'Yangibozor', 'Yangiariq', 'Hazorasp', 'Tuproqqal\'a', 'Boshqa'];

  // Update view state if prop changes
  useEffect(() => {
    setView(isKanban ? 'kanban' : 'list');
  }, [isKanban]);

  const fetchLeads = async () => {
    try {
      let url = '/leads?sortBy=' + sortBy;
      if (selectedRegions.length > 0) {
        url += '&regions=' + selectedRegions.join(',');
      }
      const { data } = await api.get(url);
      setLeads(data);

      // Auto-discover unique lead statuses and append to columns
      if (Array.isArray(data)) {
        const uniqueStatuses = Array.from(new Set(data.map((l: any) => l.status).filter(Boolean)));
        setColumns(prev => {
          const newCols = [...prev];
          let updated = false;
          uniqueStatuses.forEach((st: any) => {
            if (st !== 'waiting' && !newCols.includes(st)) {
              newCols.push(st);
              updated = true;
            }
          });
          return updated ? newCols : prev;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (leadId && leads.length > 0) {
        const target = leads.find(l => l.id.toString() === leadId);
        if (target && (!selectedLead || selectedLead.id !== target.id)) {
            setSelectedLead(target);
        }
    }
  }, [searchParams, leads]);

  useEffect(() => {
    fetchLeads();
  }, [sortBy, selectedRegions]);

  // Filter leads based on the current 'filter' prop
  const filteredLeads = leads.filter(lead => {
    if (!filter) return true; // Show all
    if (filter === 'Yangi') return lead.status === 'Yangi' || lead.status === 'waiting';
    if (filter === 'Kutilmoqda') return lead.status === 'Kutilmoqda';
    if (filter === 'Sifatli') return lead.quality === 'Sifatli' || lead.quality === 'quality';
    if (filter === 'Sifatsiz') return lead.quality === 'Sifatsiz';
    return lead.status === filter;
  });

  const handleManualAddLead = async () => {
      try {
          await api.post('/leads', manualLeadForm);
          setShowManualAddModal(false);
          setManualLeadForm({ name: '', phone: '', source: '', region: '' });
          fetchLeads();
      } catch (e) {
          console.error(e);
      }
  };

  const handleAddColumn = () => {
    if (newColumnName.trim() && !columns.includes(newColumnName.trim())) {
      setColumns([...columns, newColumnName.trim()]);
      setNewColumnName('');
      setIsAddingColumn(false);
    }
  };

  const handleCallToggle = async () => {
    if (isCalling) {
      clearInterval(callTimer);
      setIsCalling(false);
      
      // Initialize the post call form with current lead data
      setPostCallForm({
        comment: '',
        status: selectedLead.status,
        quality: selectedLead.quality || 'Noma\'lum',
        nextCallAt: selectedLead.nextCallAt ? new Date(new Date(selectedLead.nextCallAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
      });
      setShowPostCallModal(true);
    } else {
      setIsCalling(true);
      setCallDuration(0);
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      setCallTimer(interval);
    }
  };

  const handlePostCallSubmit = async () => {
    if (!postCallForm.comment.trim()) {
        alert("Iltimos, izoh yozing!");
        return;
    }
    
    try {
        // Single unified Call Wrap-up request
        await api.post(`/leads/${selectedLead.id}/call`, {
            durationSeconds: callDuration,
            result: 'Oldi',
            comment: postCallForm.comment,
            status: postCallForm.status,
            quality: postCallForm.quality,
            nextCallAt: postCallForm.nextCallAt || null
        });
        
        // Refresh leads and selected lead
        setCallDuration(0);
        setShowPostCallModal(false);
        fetchLeads();
        
        let url = '/leads?sortBy=' + sortBy;
        if (selectedRegions.length > 0) {
            url += '&regions=' + selectedRegions.join(',');
        }
        const updated = await api.get(url);
        setLeads(updated.data);
        const newSelected = updated.data.find((l: any) => l.id === selectedLead.id);
        if(newSelected) setSelectedLead(newSelected);
        
    } catch (e) {
        console.error(e);
    }
  };

  const handleAddDelay = async () => {
    try {
      await api.post(`/leads/${selectedLead.id}/delay`, { delayMinutes, reason: 'Operator kechiktirdi' });
      const updated = await api.get('/leads');
      setLeads(updated.data);
      const newSelected = updated.data.find((l: any) => l.id === selectedLead.id);
      if(newSelected) setSelectedLead(newSelected);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateStatus = async (status?: string, quality?: string, nextCallAt?: string, region?: string, grade?: string, targetLeadId?: number) => {
    const leadId = targetLeadId || selectedLead?.id;
    if (!leadId) return;

    try {
      const payload: any = {};
      if (status !== undefined) payload.status = status;
      if (quality !== undefined) payload.quality = quality;
      if (nextCallAt !== undefined) payload.nextCallAt = nextCallAt;
      if (region !== undefined) payload.region = region;
      if (grade !== undefined) payload.grade = grade;
      
      await api.put(`/leads/${leadId}`, payload);
      
      let url = '/leads?sortBy=' + sortBy;
      if (selectedRegions.length > 0) {
        url += '&regions=' + selectedRegions.join(',');
      }
      const updated = await api.get(url);
      setLeads(updated.data);
      if (selectedLead && selectedLead.id === leadId) {
        const newSelected = updated.data.find((l: any) => l.id === leadId);
        if (newSelected) setSelectedLead(newSelected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getTimeAgo = (dateString: string) => {
    const diffMs = new Date().getTime() - new Date(dateString).getTime();
    if (diffMs < 0) return 'Hozirgina';
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} daqiqa oldin`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} soat oldin`;
    
    return `${Math.floor(diffHours / 24)} kun oldin`;
  };

  const renderListView = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col">
      {/* Filters Toolbar */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
         <div className="flex gap-3">
             <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded text-sm font-medium text-gray-600 hover:bg-gray-50"><Filter size={16}/> Filter</button>
             <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded text-sm font-medium text-gray-600 hover:bg-gray-50"><Download size={16}/> Export</button>
         </div>
         <div className="relative">
             <input type="text" placeholder="Qidirish..." className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm w-64 focus:ring-1 focus:ring-[#008F4C]" />
             <Search size={16} className="absolute left-3 top-2 text-gray-400" />
         </div>
      </div>
      
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-3 px-4 font-semibold text-xs text-gray-500 uppercase tracking-wider w-10">
                  <input type="checkbox" className="rounded text-[#008F4C] focus:ring-[#008F4C]" />
              </th>
              <th className="py-3 px-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">ID</th>
              <th className="py-3 px-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Ism</th>
              <th className="py-3 px-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Telefon</th>
              <th className="py-3 px-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Hudud / Manba</th>
              <th className="py-3 px-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Mas'ul</th>
              <th className="py-3 px-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Status</th>
              <th className="py-3 px-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Keyingi aloqa</th>
              <th className="py-3 px-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Delay</th>
              <th className="py-3 px-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Amal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={10} className="text-center py-8 text-gray-500">Yuklanmoqda...</td></tr> : 
              filteredLeads.map((lead) => (
              <tr 
                key={lead.id} 
                className="border-b border-gray-50 hover:bg-[#F9FAFB] transition cursor-pointer"
                onClick={() => setSelectedLead(lead)}
              >
                <td className="py-3 px-4"><input type="checkbox" className="rounded border-gray-300 text-[#008F4C] focus:ring-[#008F4C]" /></td>
                <td className="py-3 px-4 text-xs font-medium text-gray-500">#{lead.id}</td>
                <td className="py-3 px-4">
                    <div className="text-sm font-bold text-[#173127] flex items-center gap-2">
                      {lead.name}
                      {lead.grade && <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">🎓 {lead.grade}</span>}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium mt-0.5">{getTimeAgo(lead.createdAt)} kelib tushdi</div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">{lead.phone}</td>
                <td className="py-3 px-4 text-xs">
                    <div className="text-gray-700 font-bold">{lead.region || 'Noma\'lum hudud'}</div>
                    <div className="text-gray-400 mt-0.5">{lead.source || '-'}</div>
                </td>
                <td className="py-3 px-4 text-sm font-medium">{lead.operator?.name || 'Biriktirilmagan'}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                      lead.status === 'Yangi' ? 'bg-blue-100 text-blue-700' :
                      lead.status === 'Kutilmoqda' ? 'bg-yellow-100 text-yellow-700' :
                      lead.status === 'Aloqa bo\'ldi' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                  }`}>
                    {lead.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs font-medium text-gray-600">
                    {lead.nextCallAt ? new Date(lead.nextCallAt).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '-'}
                </td>
                <td className="py-3 px-4 text-sm text-red-500 font-bold">{lead.delayCount > 0 ? lead.delayCount : '-'}</td>
                <td className="py-3 px-4 text-sm flex gap-2">
                    <button className="text-[#008F4C] hover:text-[#005B35]"><Phone size={16} /></button>
                    <button className="text-gray-400 hover:text-gray-600"><MessageSquare size={16} /></button>
                </td>
              </tr>
            ))}
            {filteredLeads.length === 0 && !loading && (
                <tr><td colSpan={10} className="text-center py-8 text-gray-500">Bu bo'limda lidlar yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderKanbanView = () => (
    <div className="flex gap-4 overflow-x-auto pb-4 flex-1 custom-scrollbar snap-x snap-mandatory">
      {columns.map((col) => {
        // Fallbacks for mapping existing legacy statuses to the new dynamic columns
        const mappedCol = col === 'Yangi' ? 'waiting' : col;
        
        const colLeads = filteredLeads.filter(l => l.status === col || l.status === mappedCol);
        
        const isDefaultCol = ['Yangi', 'Kutilmoqda', 'Qayta qo\'ng\'iroq', 'Aloqa bo\'ldi'].includes(col);
        return (
        <div key={col} className="w-[85vw] sm:w-80 flex-shrink-0 bg-[#F1F5F9] rounded-xl p-3 flex flex-col max-h-full snap-center shadow-sm">
          <div className="flex items-center justify-between mb-3 px-1">
            <h4 className="font-bold text-gray-700 uppercase text-xs tracking-wider flex gap-2 items-center">
                {col} <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{colLeads.length}</span>
            </h4>
            {!isDefaultCol && (
              <button 
                onClick={() => {
                  if (confirm(`"${col}" yacheykasini o'chirib tashlamoqchimisiz?`)) {
                    setColumns(columns.filter(c => c !== col));
                  }
                }}
                title="Yacheykani o'chirish"
                className="text-gray-400 hover:text-red-500 transition text-xs font-bold px-1"
              >
                ✕
              </button>
            )}
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
            {colLeads.map(lead => (
              <div 
                key={lead.id} 
                onClick={() => setSelectedLead(lead)}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-[#008F4C] transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-[#173127] text-base">{lead.name}</span>
                  {lead.delayCount > 0 && <span className="text-[10px] bg-red-50 border border-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">{lead.delayCount} marta surilgan</span>}
                </div>
                <div className="text-sm text-gray-600 mb-2 font-medium">{lead.phone}</div>
                {lead.region && <div className="inline-block bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded mb-3">{lead.region}</div>}
                {lead.grade && <div className="inline-block bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded mb-3 ml-1.5">🎓 {lead.grade}</div>}
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 flex items-center gap-1">👤 {lead.operator?.name || 'Biriktirilmagan'}</span>
                  {lead.nextCallAt && (
                      <span className="text-red-500 font-medium bg-red-50 px-2 py-1 rounded flex items-center gap-1">
                          <Clock size={12}/> {new Date(lead.nextCallAt).toLocaleDateString('uz-UZ', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </span>
                  )}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between text-[10px] text-gray-400 font-medium">
                  <span>{getTimeAgo(lead.createdAt)} keldi</span>
                </div>
              </div>
            ))}
            
            <button className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg text-sm font-medium hover:border-[#008F4C] hover:text-[#008F4C] transition flex items-center justify-center gap-1">
                <Plus size={16} /> Yana qo'shish
            </button>
          </div>
        </div>
      )})}

      {/* Add New Column */}
      <div className="w-80 flex-shrink-0">
         {isAddingColumn ? (
             <div className="bg-[#F1F5F9] rounded-xl p-3 flex flex-col gap-2 border border-gray-200 shadow-inner">
                 <input 
                    type="text" 
                    autoFocus
                    value={newColumnName}
                    onChange={e => setNewColumnName(e.target.value)}
                    placeholder="Ustun nomi..."
                    className="w-full px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-1 focus:ring-[#008F4C]"
                    onKeyPress={e => e.key === 'Enter' && handleAddColumn()}
                 />
                 <div className="flex gap-2">
                     <button onClick={handleAddColumn} className="flex-1 bg-[#008F4C] text-white py-1.5 rounded text-sm font-medium">Saqlash</button>
                     <button onClick={() => setIsAddingColumn(false)} className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded text-sm font-medium">Bekor qilish</button>
                 </div>
             </div>
         ) : (
             <button 
                onClick={() => setIsAddingColumn(true)}
                className="w-full h-12 border-2 border-dashed border-gray-300 text-gray-500 rounded-xl text-sm font-bold hover:border-[#008F4C] hover:text-[#008F4C] hover:bg-white transition flex items-center justify-center gap-2">
                <Plus size={18} /> Ustun qo'shish
            </button>
         )}
      </div>
    </div>
  );

  const renderGradesView = () => {
    const targetLeads = filteredLeads;
    const unassignedGradeLeads = targetLeads.filter(l => !l.grade);

    return (
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 custom-scrollbar snap-x snap-mandatory">
        {schoolGrades.map((grade) => {
          const gradeLeads = targetLeads.filter(l => l.grade === grade);
          return (
            <div key={grade} className="w-[85vw] sm:w-80 flex-shrink-0 bg-[#F1F5F9] rounded-xl p-3 flex flex-col max-h-full snap-center shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-3 px-1">
                <h4 className="font-bold text-[#173127] uppercase text-xs tracking-wider flex gap-2 items-center">
                  🎓 {grade} <span className="bg-[#008F4C] text-white text-xs px-2.5 py-0.5 rounded-full font-bold">{gradeLeads.length} ta o'quvchi</span>
                </h4>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {gradeLeads.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-400 font-medium italic border-2 border-dashed border-gray-200 rounded-xl bg-white/50">
                    Hozircha o'quvchilar yo'q
                  </div>
                ) : (
                  gradeLeads.map(lead => (
                    <div 
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-[#008F4C] transition"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-[#173127] text-base">{lead.name}</span>
                        <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-extrabold">{lead.status}</span>
                      </div>
                      <div className="text-sm text-gray-600 mb-2 font-medium">{lead.phone}</div>
                      {lead.region && <div className="inline-block bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded mb-3">{lead.region}</div>}

                      <div className="flex justify-between items-center text-xs pt-2 border-t border-gray-100">
                        <span className="text-gray-500 font-medium">👤 {lead.operator?.name || 'Biriktirilmagan'}</span>
                        <select
                          onClick={(e) => e.stopPropagation()}
                          value={lead.grade || ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(undefined, undefined, undefined, undefined, e.target.value, lead.id);
                          }}
                          className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded px-1.5 py-0.5 focus:outline-none"
                        >
                          {schoolGrades.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Unassigned Grade Column */}
        <div className="w-[85vw] sm:w-80 flex-shrink-0 bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex flex-col max-h-full snap-center shadow-sm">
          <div className="flex items-center justify-between mb-3 px-1">
            <h4 className="font-bold text-amber-900 uppercase text-xs tracking-wider flex gap-2 items-center">
              ⚠️ Sinfga biriktirilmagan <span className="bg-amber-500 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">{unassignedGradeLeads.length}</span>
            </h4>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
            {unassignedGradeLeads.length === 0 ? (
              <div className="p-6 text-center text-xs text-amber-600/70 font-medium italic border-2 border-dashed border-amber-200 rounded-xl bg-white/50">
                Barcha sifatli lidlar sinfga biriktirilgan ✨
              </div>
            ) : (
              unassignedGradeLeads.map(lead => (
                <div 
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-amber-200 cursor-pointer hover:shadow-md hover:border-amber-500 transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-[#173127] text-base">{lead.name}</span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-extrabold">{lead.status}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2 font-medium">{lead.phone}</div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium">Sinfni tanlang:</span>
                    <select
                      onClick={(e) => e.stopPropagation()}
                      value=""
                      onChange={(e) => {
                        e.stopPropagation();
                        handleUpdateStatus(undefined, undefined, undefined, undefined, e.target.value, lead.id);
                      }}
                      className="text-xs bg-amber-100 text-amber-900 font-bold rounded px-2 py-1 focus:outline-none"
                    >
                      <option value="" disabled>Sinfni biriktirish 🎓</option>
                      {schoolGrades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex gap-6 relative">
      {/* Main CRM Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 overflow-hidden ${selectedLead ? 'pl-[600px]' : ''}`}>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 shrink-0">
          <div className="flex gap-2">
            <button 
                onClick={() => setShowManualAddModal(true)}
                className="bg-[#008F4C] hover:bg-[#005B35] text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Plus size={18} /> Lid qo'shish
            </button>
            <button 
                onClick={() => setShowImportModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 shadow-sm"
            >
              <Download size={18} /> Excel / CSV import
            </button>
            <div className="relative">
                <button 
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <Filter size={18} /> Saralash va Filtr
                </button>
                {showFilterDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 z-30 p-4">
                        <div className="mb-4">
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Tartiblash (Saralash)</label>
                            <select 
                                value={sortBy} 
                                onChange={e => setSortBy(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#008F4C]"
                            >
                                <option value="newest">Eng yangilari oldin</option>
                                <option value="oldest">Ko'p vaqtdan beri kelgan (Eskilari)</option>
                                <option value="most_delayed">Eng ko'p surilganlar</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Hudud bo'yicha filtr</label>
                            <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                                {xorazmRegions.map(region => (
                                    <label key={region} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedRegions.includes(region)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedRegions([...selectedRegions, region]);
                                                else setSelectedRegions(selectedRegions.filter(r => r !== region));
                                            }}
                                            className="rounded border-gray-300 text-[#008F4C] focus:ring-[#008F4C]"
                                        />
                                        <span className="text-sm font-medium text-gray-700">{region}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button 
                onClick={() => setView('list')}
                className={`p-1.5 rounded-md transition flex items-center gap-2 px-3 text-xs sm:text-sm ${view === 'list' ? 'bg-white shadow-sm text-[#008F4C] font-bold' : 'text-gray-500 hover:text-gray-700 font-medium'}`}
              >
                <List size={16} /> Ro'yxat
              </button>
              <button 
                onClick={() => setView('kanban')}
                className={`p-1.5 rounded-md transition flex items-center gap-2 px-3 text-xs sm:text-sm ${view === 'kanban' ? 'bg-white shadow-sm text-[#008F4C] font-bold' : 'text-gray-500 hover:text-gray-700 font-medium'}`}
              >
                <LayoutGrid size={16} /> Kanban
              </button>
              <button 
                onClick={() => setView('grades')}
                className={`p-1.5 rounded-md transition flex items-center gap-2 px-3 text-xs sm:text-sm ${view === 'grades' ? 'bg-[#008F4C] text-white shadow-sm font-bold' : 'text-gray-500 hover:text-gray-700 font-medium'}`}
              >
                <span>🎓 Guruhlar (1-8 sinf)</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Render */}
        {view === 'list' ? renderListView() : view === 'kanban' ? renderKanbanView() : renderGradesView()}
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-[100] bg-[#173127]/60 backdrop-blur-sm flex justify-center items-start overflow-y-auto p-4 sm:p-10 custom-scrollbar">
          <div className="bg-white w-full max-w-[900px] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] relative mb-10 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            
          {/* Header */}
          <div className="px-8 py-6 flex justify-between items-start bg-white relative z-10 border-b border-gray-100">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-[#008F4C] text-white rounded-full flex items-center justify-center font-bold text-3xl shadow-lg border-4 border-green-50">
                {selectedLead.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-2xl text-[#173127] leading-tight mb-1.5">{selectedLead.name}</h3>
                <p className="text-base text-gray-500 font-medium">{selectedLead.phone}</p>
                <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">Lid manbasi: <span className="text-gray-600 font-bold">{selectedLead.source || 'Instagram'}</span></p>
              </div>
            </div>
            <button 
              onClick={() => {
                setSelectedLead(null);
                if(isCalling) { clearInterval(callTimer); setIsCalling(false); }
              }}
              className="p-2 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-full transition text-gray-500 absolute top-6 right-6"
            >
              X
            </button>
          </div>

          {/* Action Buttons */}
          <div className="px-8 py-5 flex flex-col gap-4 border-b border-gray-100 bg-gray-50">
             <div className="flex gap-3">
                 <button 
                    onClick={handleCallToggle}
                    className={`flex-1 py-3.5 rounded-xl text-base font-bold flex items-center justify-center gap-2 shadow-sm transition ${
                        isCalling ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-red-200' : 'bg-[#008F4C] hover:bg-[#007041] text-white shadow-green-200'
                    }`}>
                  <Phone size={20} /> 
                  {isCalling ? `Tugatish (${formatTime(callDuration)})` : "Qo'ng'iroq Qilish"}
                </button>
             </div>
            
             <div className="flex flex-col gap-1 mt-1">
                 <div className="flex items-center gap-3">
                     <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 focus-within:ring-2 focus-within:ring-[#F4C400] shadow-sm">
                        <Clock size={20} className="text-[#F4C400]" />
                        <input 
                            type="datetime-local" 
                            value={selectedLead.nextCallAt ? new Date(new Date(selectedLead.nextCallAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                            onChange={e => handleUpdateStatus(undefined, undefined, e.target.value)}
                            className="w-full text-[15px] font-bold text-gray-700 focus:outline-none"
                        />
                     </div>
                     <span className="text-xs uppercase text-gray-500 w-24 text-center leading-tight font-bold">Keyingi aloqa (Deadline)</span>
                 </div>
                 {selectedLead.nextCallAt && (
                    <button
                      onClick={() => handleUpdateStatus(undefined, undefined, null as any)}
                      className="text-xs text-red-600 font-bold hover:underline self-start ml-2 mt-1"
                    >
                      ✕ Deadlineni o'chirish / olib tashlash
                    </button>
                 )}
              </div>
          </div>

          {/* Details Table */}
          <div className="px-8 py-6 grid grid-cols-2 gap-y-6 gap-x-6 border-b border-gray-100 bg-white">
              <div>
                  <p className="text-gray-400 text-xs uppercase font-bold mb-2">Status (Yacheyka)</p>
                  <select 
                      value={selectedLead.status} 
                      onChange={e => handleUpdateStatus(e.target.value, undefined)}
                      className="w-full bg-yellow-50 text-yellow-700 font-bold px-4 py-2.5 rounded-xl border border-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition cursor-pointer text-[15px]"
                  >
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      {!columns.includes(selectedLead.status) && <option value={selectedLead.status}>{selectedLead.status}</option>}
                  </select>
              </div>
              <div>
                  <p className="text-gray-400 text-xs uppercase font-bold mb-2">Lid Sifati</p>
                  <select 
                      value={selectedLead.quality || 'Noma\'lum'} 
                      onChange={e => handleUpdateStatus(undefined, e.target.value)}
                      className="w-full bg-blue-50 text-blue-700 font-bold px-4 py-2.5 rounded-xl border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 transition cursor-pointer text-[15px]"
                  >
                      <option value="Noma'lum">Noma'lum</option>
                      <option value="Sifatli">Sifatli (Target)</option>
                      <option value="Sifatsiz">Sifatsiz (Otbroy)</option>
                  </select>
              </div>
              
              <div className="col-span-2 sm:col-span-1">
                  <p className="text-gray-400 text-xs uppercase font-bold mb-2">Viloyat / Tuman</p>
                  <select 
                      value={selectedLead.region || ''} 
                      onChange={e => handleUpdateStatus(undefined, undefined, undefined, e.target.value)}
                      className="w-full bg-gray-50 text-gray-800 font-bold px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 transition cursor-pointer text-[15px]"
                  >
                      <option value="">Tanlanmagan</option>
                      {xorazmRegions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
              </div>

              <div className="col-span-2 sm:col-span-1">
                  <p className="text-gray-400 text-xs uppercase font-bold mb-2">🎓 Sinf / Guruh</p>
                  <select 
                      value={selectedLead.grade || ''} 
                      onChange={e => handleUpdateStatus(undefined, undefined, undefined, undefined, e.target.value)}
                      className="w-full bg-emerald-50 text-emerald-900 font-bold px-4 py-2.5 rounded-xl border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition cursor-pointer text-[15px]"
                  >
                      <option value="">Sinfga biriktirilmagan</option>
                      {schoolGrades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Mas'ul operator</p>
                  <p className="font-bold text-[#173127] flex items-center gap-2 text-[15px]">
                      <span className="w-6 h-6 bg-[#008F4C] text-white rounded-full flex items-center justify-center text-xs">{selectedLead.operator?.name?.charAt(0) || 'U'}</span>
                      {selectedLead.operator?.name || 'Biriktirilmagan'}
                  </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Keyingi aloqa (Deadline)</p>
                  <p className="font-bold text-red-500 text-[15px]">{selectedLead.nextCallAt ? new Date(selectedLead.nextCallAt).toLocaleString('uz-UZ') : 'Belgilanmagan'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Oxirgi marta gaplashilgan</p>
                  <p className="font-bold text-gray-800 text-[15px]">{selectedLead.lastCallAt ? new Date(selectedLead.lastCallAt).toLocaleString('uz-UZ') : 'Gaplashilmagan'}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-gray-400 text-[10px] uppercase font-bold mb-1">Yaratilgan sana</p>
                  <p className="font-bold text-gray-800 text-[15px]">{new Date(selectedLead.createdAt).toLocaleDateString('uz-UZ')}</p>
              </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-8 pt-4 bg-white sticky top-0 z-20">
              <button 
                  onClick={() => setActiveTab('timeline')}
                  className={`pb-4 px-2 mr-8 text-base font-bold border-b-2 transition ${activeTab === 'timeline' ? 'border-[#008F4C] text-[#008F4C]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  Timeline
              </button>
              <button 
                  onClick={() => setActiveTab('calls')}
                  className={`pb-4 px-2 mr-8 text-base font-bold border-b-2 transition ${activeTab === 'calls' ? 'border-[#008F4C] text-[#008F4C]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  Qo'ng'iroqlar tarixi
              </button>
          </div>

          {/* Tab Content (Flows naturally, no fixed height) */}
          <div className="bg-gray-50/50 p-8">
            {activeTab === 'timeline' && (
                <div className="relative pl-10 border-l-2 border-gray-200 space-y-8">
                
                {selectedLead.callLogs?.map((log: any) => (
                    <div key={`call-${log.id}`} className="relative">
                        <div className="absolute -left-[51px] top-1 bg-white border-2 border-[#10A957] text-[#10A957] w-10 h-10 rounded-full flex items-center justify-center z-10 shadow-sm">
                            <Phone size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm font-bold text-gray-400 w-12">{new Date(log.createdAt).toLocaleTimeString('uz-UZ', {hour: '2-digit', minute: '2-digit'})}</span>
                                <span className="font-bold text-[#173127] text-base">Operator (Siz)</span>
                            </div>
                            <div className="ml-16 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm w-full">
                                <p className="text-base font-bold text-gray-800 mb-2">Qo'ng'iroq qilindi</p>
                                <p className="text-[15px] text-gray-500 font-medium">Davomiyligi: <span className="text-[#008F4C] bg-green-50 px-2 py-0.5 rounded-md font-bold">{formatTime(log.durationSeconds)}</span></p>
                            </div>
                        </div>
                    </div>
                ))}

                {selectedLead.comments?.map((comment: any) => (
                    <div key={`cmt-${comment.id}`} className="relative">
                    <div className="absolute -left-[51px] top-1 bg-white border-2 border-[#F4C400] text-[#F4C400] w-10 h-10 rounded-full flex items-center justify-center z-10 shadow-sm">
                        <MessageSquare size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-bold text-gray-400 w-12">{new Date(comment.createdAt).toLocaleTimeString('uz-UZ', {hour: '2-digit', minute: '2-digit'})}</span>
                            <span className="font-bold text-[#173127] text-base">{comment.operator?.name || 'Operator'}</span>
                        </div>
                        <div className="ml-16 bg-[#FFFDF5] p-5 rounded-2xl border border-[#F4C400]/40 shadow-sm w-full">
                            <p className="text-base text-gray-800 leading-relaxed font-medium">{comment.comment}</p>
                        </div>
                    </div>
                    </div>
                ))}
                
                {(selectedLead.callLogs?.length === 0 && selectedLead.comments?.length === 0) && (
                    <p className="text-base text-gray-400 ml-6 font-medium">Tarix bo'sh. Hali hech qanday amal bajarilmagan.</p>
                )}
                </div>
            )}
            
            {activeTab === 'calls' && (
                <div className="relative pl-10 border-l-2 border-gray-200 space-y-8">
                
                {selectedLead.callLogs?.map((log: any) => (
                    <div key={`call-only-${log.id}`} className="relative">
                        <div className="absolute -left-[51px] top-1 bg-white border-2 border-[#10A957] text-[#10A957] w-10 h-10 rounded-full flex items-center justify-center z-10 shadow-sm">
                            <Phone size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm font-bold text-gray-400 w-12">{new Date(log.createdAt).toLocaleTimeString('uz-UZ', {hour: '2-digit', minute: '2-digit'})}</span>
                                <span className="font-bold text-[#173127] text-base">Operator (Siz)</span>
                            </div>
                            <div className="ml-16 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm w-full">
                                <p className="text-base font-bold text-gray-800 mb-2">Qo'ng'iroq qilindi</p>
                                <p className="text-[15px] text-gray-500 font-medium">Davomiyligi: <span className="text-[#008F4C] bg-green-50 px-2 py-0.5 rounded-md font-bold">{formatTime(log.durationSeconds)}</span></p>
                            </div>
                        </div>
                    </div>
                ))}
                
                {(!selectedLead.callLogs || selectedLead.callLogs.length === 0) && (
                    <p className="text-base text-gray-400 ml-6 font-medium">Bu bo'lim hozircha bo'sh. Hech qanday qo'ng'iroq qilinmagan.</p>
                )}
                </div>
            )}
          </div>

          </div>
        </div>
      )}

      {/* Post-Call Wrap-up Modal */}
      {showPostCallModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col gap-5">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-xl text-[#173127]">Qo'ng'iroq Yakuni</h3>
                </div>
                
                <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Izoh (Majburiy)</label>
                    <textarea 
                        value={postCallForm.comment}
                        onChange={e => setPostCallForm({...postCallForm, comment: e.target.value})}
                        className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#008F4C] text-sm font-medium resize-none"
                        placeholder="Mijoz nima dedi? Xulosa..."
                        rows={3}
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Lid Sifati</label>
                        <select 
                            value={postCallForm.quality} 
                            onChange={e => setPostCallForm({...postCallForm, quality: e.target.value})}
                            className="w-full bg-blue-50 text-blue-700 font-bold px-3 py-2.5 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                        >
                            <option value="Noma'lum">Noma'lum</option>
                            <option value="Sifatli">Sifatli (Target)</option>
                            <option value="Sifatsiz">Sifatsiz (Otbroy)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Yangi Status</label>
                        <select 
                            value={postCallForm.status} 
                            onChange={e => setPostCallForm({...postCallForm, status: e.target.value})}
                            className="w-full bg-yellow-50 text-yellow-700 font-bold px-3 py-2.5 rounded-lg border border-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm"
                        >
                            {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            {!columns.includes(postCallForm.status) && <option value={postCallForm.status}>{postCallForm.status}</option>}
                        </select>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-gray-500 block">Keyingi aloqa (Deadline)</label>
                      {postCallForm.nextCallAt && (
                        <button 
                          onClick={() => setPostCallForm({...postCallForm, nextCallAt: ''})}
                          className="text-[11px] text-red-600 font-bold hover:underline"
                        >
                          ✕ Deadlineni o'chirish
                        </button>
                      )}
                    </div>
                    <input 
                        type="datetime-local" 
                        value={postCallForm.nextCallAt}
                        onChange={e => setPostCallForm({...postCallForm, nextCallAt: e.target.value})}
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#F4C400] font-bold text-sm"
                    />
                </div>

                <div className="flex justify-end mt-4">
                    <button 
                        onClick={handlePostCallSubmit}
                        className="bg-[#008F4C] hover:bg-[#007041] text-white px-8 py-3 rounded-xl transition shadow-sm font-bold w-full"
                    >
                        Saqlash va Yopish
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Manual Add Lead Modal */}
      {showManualAddModal && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-xl text-[#173127]">Yangi Lid Qo'shish</h3>
                    <button onClick={() => setShowManualAddModal(false)} className="text-gray-400 hover:text-gray-600">X</button>
                </div>
                
                <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Ism</label>
                    <input 
                        type="text" 
                        value={manualLeadForm.name} 
                        onChange={e => setManualLeadForm({...manualLeadForm, name: e.target.value})}
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#008F4C]"
                        placeholder="Mijoz ismi"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Telefon</label>
                    <input 
                        type="text" 
                        value={manualLeadForm.phone} 
                        onChange={e => setManualLeadForm({...manualLeadForm, phone: e.target.value})}
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#008F4C]"
                        placeholder="+998 90 123 45 67"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Viloyat / Tuman</label>
                    <select 
                        value={manualLeadForm.region} 
                        onChange={e => setManualLeadForm({...manualLeadForm, region: e.target.value})}
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#008F4C] bg-white"
                    >
                        <option value="">Tanlanmagan</option>
                        {xorazmRegions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 mb-1 block">Manba (Ixtiyoriy)</label>
                    <input 
                        type="text" 
                        value={manualLeadForm.source} 
                        onChange={e => setManualLeadForm({...manualLeadForm, source: e.target.value})}
                        className="w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#008F4C]"
                        placeholder="Masalan: Ofisga o'zi keldi"
                    />
                </div>
                
                <button 
                    onClick={handleManualAddLead}
                    disabled={!manualLeadForm.name || !manualLeadForm.phone}
                    className="w-full bg-[#008F4C] hover:bg-[#007041] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg mt-2 transition"
                >
                    Saqlash
                </button>
            </div>
        </div>
      )}

      {/* Excel / CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 flex flex-col gap-4 max-h-[85vh]">
                <div className="flex justify-between items-center border-b pb-3">
                    <div>
                      <h3 className="font-bold text-xl text-[#173127]">📥 Excel / CSV Fayldan Lid Qo'shish</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Faylingizdan <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-600 font-mono">full_name</code>, <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-600 font-mono">phone_number</code> va <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-600 font-mono">created_time</code> ustunlari avtomatik ajratib olinadi.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setShowImportModal(false);
                        setParsedLeads([]);
                      }}
                      className="text-gray-400 hover:text-gray-600 text-xl font-bold px-2"
                    >
                      ✕
                    </button>
                </div>
                
                <div className="border-2 border-dashed border-blue-200 bg-blue-50/40 rounded-xl p-6 text-center">
                    <input 
                      type="file" 
                      accept=".csv,.txt,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="excel-csv-upload-input"
                    />
                    <label 
                      htmlFor="excel-csv-upload-input"
                      className="cursor-pointer inline-flex flex-col items-center justify-center gap-2 text-blue-600 font-bold hover:text-blue-700"
                    >
                      <Download size={32} className="animate-bounce" />
                      <span>Excel (.csv / .xlsx / .txt) faylni tanlang</span>
                      <span className="text-xs font-normal text-gray-500">Komyuter fayllaridan tanlash uchun shu yerni bosing</span>
                    </label>
                </div>

                {parsedLeads.length > 0 && (
                  <div className="flex-1 overflow-hidden flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                        Topilgan lidlar: <strong className="text-blue-600">{parsedLeads.length} ta</strong>
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-xl custom-scrollbar max-h-60">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-gray-100 sticky top-0 font-bold text-gray-700">
                          <tr>
                            <th className="p-2 border-b">#</th>
                            <th className="p-2 border-b">Full Name</th>
                            <th className="p-2 border-b">Phone Number</th>
                            <th className="p-2 border-b">Created Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {parsedLeads.slice(0, 100).map((lead, idx) => (
                            <tr key={idx} className="hover:bg-blue-50/50">
                              <td className="p-2 text-gray-400 font-mono">{idx + 1}</td>
                              <td className="p-2 font-bold text-gray-800">{lead.name}</td>
                              <td className="p-2 text-gray-600 font-mono">{lead.phone}</td>
                              <td className="p-2 text-gray-500">{lead.createdAt ? new Date(lead.createdAt).toLocaleString('uz-UZ') : "Noma'lum"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2 border-t">
                  <button 
                    onClick={() => {
                      setShowImportModal(false);
                      setParsedLeads([]);
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-sm transition"
                  >
                    Bekor qilish
                  </button>
                  <button 
                    onClick={handleExecuteImport}
                    disabled={parsedLeads.length === 0 || importLoading}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg text-sm shadow-md transition flex items-center gap-2"
                  >
                    {importLoading ? 'Saqlanmoqda...' : `📥 ${parsedLeads.length} ta lidni saqlash`}
                  </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default CRM;
