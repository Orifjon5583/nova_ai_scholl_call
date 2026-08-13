import React, { useState, useEffect } from 'react';
import { PhoneCall, Clock, CheckCircle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';

const Calls = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ callLogs: any[], stats: any }>({ callLogs: [], stats: {} });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get('/calls');
        setData(response.data);
      } catch (err) {
        console.error('Failed to fetch calls data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds) return '00:00';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const filteredLogs = data.callLogs.filter((log: any) => 
    log.lead?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.lead?.phone?.includes(searchTerm)
  );

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#173127]">Qo'ng'iroqlar tarixi</h2>
          <p className="text-gray-500 text-sm mt-1">Bugungi qilingan qo'ng'iroqlar va shaxsiy statistika</p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008F4C]"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <PhoneCall size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">Bugungi Qo'ng'iroqlar</p>
                <h3 className="text-2xl font-black text-[#173127]">{data.stats?.totalCallsToday || 0} <span className="text-sm font-medium text-gray-400">ta</span></h3>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">Umumiy Gaplashilgan Vaqt</p>
                <h3 className="text-2xl font-black text-[#173127]">{formatTime(data.stats?.totalDurationToday || 0)} <span className="text-sm font-medium text-gray-400">daqiqa</span></h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-xl flex items-center justify-center">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">Ulanishlar (Oldi)</p>
                <h3 className="text-2xl font-black text-[#173127]">{data.stats?.answeredCallsToday || 0} <span className="text-sm font-medium text-gray-400">ta</span></h3>
              </div>
            </div>
          </div>

          {/* Search & List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-[#173127]">Barcha qo'ng'iroqlar</h3>
                <div className="relative w-64">
                    <input 
                        type="text" 
                        placeholder="Mijoz ismi yoki raqami..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008F4C]"
                    />
                    <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                </div>
            </div>
            
            <div className="overflow-y-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                        <tr>
                            <th className="py-3 px-6 font-semibold text-xs text-gray-500 uppercase">Mijoz (Lid)</th>
                            <th className="py-3 px-6 font-semibold text-xs text-gray-500 uppercase">Sana va Vaqt</th>
                            <th className="py-3 px-6 font-semibold text-xs text-gray-500 uppercase">Operator</th>
                            <th className="py-3 px-6 font-semibold text-xs text-gray-500 uppercase">Davomiyligi</th>
                            <th className="py-3 px-6 font-semibold text-xs text-gray-500 uppercase w-1/3">Qoldirilgan Izoh</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLogs.map((log: any) => (
                            <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                                <td className="py-4 px-6">
                                    <Link to={`/crm?leadId=${log.lead?.id}`} className="font-bold text-[#173127] hover:text-[#008F4C] transition">
                                        {log.lead?.name || 'Noma\'lum'}
                                    </Link>
                                    <p className="text-xs text-gray-500">{log.lead?.phone}</p>
                                </td>
                                <td className="py-4 px-6">
                                    <span className="text-sm font-bold text-gray-700">
                                        {new Date(log.createdAt).toLocaleDateString('uz-UZ')}
                                    </span>
                                    <p className="text-xs text-gray-500 font-medium">
                                        {new Date(log.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </td>
                                <td className="py-4 px-6">
                                    <span className="text-sm font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded-md">
                                        {log.operator?.name || 'Noma\'lum'}
                                    </span>
                                </td>
                                <td className="py-4 px-6">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 text-[#008F4C] font-bold text-sm border border-green-100">
                                        <Clock size={14} />
                                        {formatTime(log.durationSeconds)}
                                    </span>
                                </td>
                                <td className="py-4 px-6">
                                    {log.lead?.comments && log.lead.comments.length > 0 ? (
                                        <p className="text-sm text-gray-600 font-medium italic line-clamp-2" title={log.lead.comments[0].comment}>
                                            "{log.lead.comments[0].comment}"
                                        </p>
                                    ) : (
                                        <span className="text-xs text-gray-400 font-medium">— Izoh yo'q —</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredLogs.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-gray-400 font-medium">
                                    Ma'lumot topilmadi...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Calls;
