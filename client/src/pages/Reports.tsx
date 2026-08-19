import React, { useState, useEffect } from 'react';
import { BarChart3, Download, PieChart, Users, PhoneCall, Award, FileSpreadsheet, Send, FileText } from 'lucide-react';
import api from '../api';

const Reports = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [telegramLoading, setTelegramLoading] = useState(false);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : {};
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await api.get('/reports');
        setData(response.data);
      } catch (err) {
        console.error('Failed to fetch reports', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds) return '0 daqiqa';
    const m = Math.floor(seconds / 60);
    return `${m} daqiqa`;
  };

  const handleExportCSV = () => {
    if (!data?.leadsExport || data.leadsExport.length === 0) {
      alert("Yuklab olish uchun ma'lumot mavjud emas");
      return;
    }

    const headers = ["ID", "Ism", "Telefon", "Manba", "Viloyat/Tuman", "Status", "Sifat", "Operator", "Yaratilgan sana"];
    const rows = data.leadsExport.map((l: any) => [
      l.id,
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.phone}"`,
      `"${l.source || ''}"`,
      `"${l.region || ''}"`,
      `"${l.status || ''}"`,
      `"${l.quality || ''}"`,
      `"${l.operator || ''}"`,
      `"${new Date(l.createdAt).toLocaleDateString('uz-UZ')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nova_call_leads_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendTelegramReport = async () => {
    setTelegramLoading(true);
    try {
      const res = await api.post('/telegram/send-report');
      alert(res.data?.message || "Kunlik hisobot Telegram botga yuborildi!");
    } catch (err: any) {
      alert(err.response?.data?.error || "Hisobotni yuborishda xatolik. Telegram Bot Token va Chat ID sozlang!");
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleDownloadTextReport = () => {
    window.open('http://localhost:3000/api/telegram/download-report', '_blank');
  };

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#173127]">Hisobotlar va Tahlil</h2>
          <p className="text-gray-500 text-sm mt-1">Lidlar statistikasi, operatorlar samaradorligi va ma'lumotlarni eksport qilish</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadTextReport}
            title="Kunlik hisobot faylini yuklab olish"
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 text-xs shadow-sm border border-gray-200"
          >
            <FileText size={16} />
            <span>Hisobot Fayli (.txt)</span>
          </button>
          
          <button
            onClick={handleSendTelegramReport}
            disabled={telegramLoading}
            title="Telegram Botga hisobot yuborish"
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 text-xs shadow-sm"
          >
            <Send size={16} />
            <span>{telegramLoading ? "Yuborilmoqda..." : "Telegram Botga Yuborish"}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="bg-[#008F4C] hover:bg-[#007041] text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm flex items-center gap-2 text-xs"
          >
            <FileSpreadsheet size={16} />
            <span>Excel (CSV) Yuklab Olish</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008F4C]"></div>
        </div>
      ) : (
        <div className="space-y-8 overflow-y-auto pr-2 flex-1">
          {/* Status Breakdown Cards */}
          <div>
            <h3 className="text-lg font-bold text-[#173127] mb-4 flex items-center gap-2">
              <PieChart size={20} className="text-[#008F4C]" />
              Lidlar Statusi bo'yicha Tahlil
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {data?.statusStats?.map((s: any, idx: number) => (
                <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{s.name}</span>
                  <h4 className="text-3xl font-black text-[#173127]">{s.count} <span className="text-sm font-medium text-gray-400">ta</span></h4>
                </div>
              ))}
            </div>
          </div>

          {/* Quality Breakdown Cards */}
          <div>
            <h3 className="text-lg font-bold text-[#173127] mb-4 flex items-center gap-2">
              <Award size={20} className="text-amber-500" />
              Lidlar Sifati Bo'yicha Tahlil
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {data?.qualityStats?.map((q: any, idx: number) => (
                <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">{q.name}</span>
                    <h4 className="text-2xl font-black text-[#173127]">{q.count} ta</h4>
                  </div>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                    q.name === 'Sifatli' ? 'bg-green-100 text-green-700' :
                    q.name === 'Sifatsiz' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {q.name === 'Sifatli' ? '✓' : q.name === 'Sifatsiz' ? '✕' : '?'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operator Performance Table (Admin Only) */}
          {isAdmin && data?.operatorPerformance && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-base font-bold text-[#173127] flex items-center gap-2">
                  <Users size={18} className="text-blue-600" />
                  Operatorlar Samaradorlik Jadvali
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="py-3.5 px-6 font-semibold text-xs text-gray-500 uppercase">Operator</th>
                      <th className="py-3.5 px-6 font-semibold text-xs text-gray-500 uppercase text-center">Biriktirilgan Lidlar</th>
                      <th className="py-3.5 px-6 font-semibold text-xs text-gray-500 uppercase text-center">Jami Qo'ng'iroqlar</th>
                      <th className="py-3.5 px-6 font-semibold text-xs text-gray-500 uppercase text-center">Jami Gaplashuv Vaqti</th>
                      <th className="py-3.5 px-6 font-semibold text-xs text-gray-500 uppercase text-center">Sifatli Lidlar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.operatorPerformance.map((op: any) => (
                      <tr key={op.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                        <td className="py-4 px-6 font-bold text-[#173127] text-sm">
                          {op.name}
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-gray-700">
                          {op.totalLeads} ta
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-blue-600">
                          {op.totalCalls} ta
                        </td>
                        <td className="py-4 px-6 text-center font-bold text-gray-700">
                          {formatTime(op.totalDuration)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="bg-green-50 text-green-700 font-bold px-3 py-1 rounded-lg text-xs border border-green-100">
                            {op.qualityLeads} ta Sifatli
                          </span>
                        </td>
                      </tr>
                    ))}
                    {data.operatorPerformance.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                          Operatorlar ma'lumoti yo'q
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
