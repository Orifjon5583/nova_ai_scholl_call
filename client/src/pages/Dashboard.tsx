import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, UserPlus, PhoneCall, CheckCircle2, XCircle, AlertCircle, Clock, Timer } from 'lucide-react';
import api from '../api';

const Dashboard = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard');
        setData(res.data);
      } catch (error) {
        console.error('Failed to fetch dashboard', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-full text-[#005B35]">Yuklanmoqda...</div>;
  }

  // Format seconds to HH:mm:ss
  const formatTime = (seconds: number) => {
    if (!seconds) return '00:00:00';
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const statCards = [
    { title: 'Jami lidlar', value: data?.stats?.totalLeads || 0, subtitle: 'Barchasi', icon: <Users size={16} />, color: 'text-gray-700', bg: 'bg-white' },
    { title: 'Yangi lidlar', value: data?.stats?.newLeads || 0, subtitle: 'Bugun', icon: <UserPlus size={16} />, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { title: 'Kutayotgan lidlar', value: data?.stats?.waitingLeads || 0, subtitle: 'Hozirda', icon: <PhoneCall size={16} />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Sifatli lidlar', value: data?.stats?.qualityLeads || 0, subtitle: 'Jami', icon: <CheckCircle2 size={16} />, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Sifatsiz lidlar', value: data?.stats?.badLeads || 0, subtitle: 'Jami', icon: <XCircle size={16} />, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'Vaqti o\'tgan lidlar', value: data?.stats?.overdueLeads || 0, subtitle: 'Ehtiyot bo\'ling', icon: <AlertCircle size={16} />, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'Bugungi qo\'ng\'iroqlar', value: data?.stats?.callsToday || 0, subtitle: 'Bugun', icon: <PhoneCall size={16} />, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Jami delay', value: data?.stats?.totalDelays || 0, subtitle: 'Jami', icon: <Clock size={16} />, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Bugungi gaplashuv vaqti', value: formatTime(data?.stats?.todayCallDuration), subtitle: 'Bugun', icon: <Timer size={16} />, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  const COLORS = ['#008F4C', '#F4C400', '#3B82F6', '#EF4444', '#8B5CF6', '#10B981'];

  return (
    <div className="space-y-6">
      {/* 9 Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${stat.bg} ${stat.color}`}>
                  {stat.icon}
                </span>
                <p className="text-xs text-gray-500 font-medium truncate">{stat.title}</p>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 ml-1">{stat.value}</h3>
              <p className="text-[10px] text-gray-400 ml-1 mt-1">{stat.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Operator Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-base font-bold text-[#173127] mb-4">Operatorlar samaradorligi</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="py-2 px-3 font-semibold text-xs text-gray-600">Operator</th>
                  <th className="py-2 px-3 font-semibold text-xs text-gray-600">Status</th>
                  <th className="py-2 px-3 font-semibold text-xs text-gray-600 text-center">Lidlar</th>
                  <th className="py-2 px-3 font-semibold text-xs text-gray-600 text-center">Qo'ng'iroqlar</th>
                  <th className="py-2 px-3 font-semibold text-xs text-gray-600 text-center">Oldi</th>
                  <th className="py-2 px-3 font-semibold text-xs text-gray-600 text-center">Olmadi</th>
                  <th className="py-2 px-3 font-semibold text-xs text-gray-600 text-center">Delay</th>
                  <th className="py-2 px-3 font-semibold text-xs text-gray-600 text-center">Overdue</th>
                  <th className="py-2 px-3 font-semibold text-xs text-gray-600 text-center">Gaplashuv vaqti</th>
                  <th className="py-2 px-3 font-semibold text-xs text-gray-600 text-center">Konversiya</th>
                  <th className="py-2 px-3 font-semibold text-xs text-gray-600 text-center">Amal</th>
                </tr>
              </thead>
              <tbody>
                {data?.operators?.map((op: any) => (
                  <tr key={op.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="py-2 px-3 text-sm font-medium">{op.name}</td>
                    <td className="py-2 px-3 text-sm">
                      <span className={`text-[10px] font-bold uppercase ${op.status === 'online' ? 'text-green-500' : 'text-gray-400'}`}>
                        {op.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-center font-medium">{op.totalLeads}</td>
                    <td className="py-2 px-3 text-sm text-center font-medium">{op.totalCalls}</td>
                    <td className="py-2 px-3 text-sm text-center font-medium">{op.successCalls}</td>
                    <td className="py-2 px-3 text-sm text-center font-medium">{op.missedCalls}</td>
                    <td className="py-2 px-3 text-sm text-center font-medium">{op.delays}</td>
                    <td className="py-2 px-3 text-sm text-center font-medium text-red-500">{op.overdue}</td>
                    <td className="py-2 px-3 text-sm text-center font-medium">{formatTime(op.totalDuration)}</td>
                    <td className="py-2 px-3 text-sm text-center font-medium">{op.conversion}%</td>
                    <td className="py-2 px-3 text-sm text-center">
                      <button className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs hover:bg-green-100 transition">
                        Ko'rish
                      </button>
                    </td>
                  </tr>
                ))}
                {(!data?.operators || data.operators.length === 0) && (
                  <tr>
                    <td colSpan={11} className="py-4 text-center text-sm text-gray-500">Ma'lumot topilmadi</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lead Sources Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col">
          <h3 className="text-base font-bold text-[#173127] mb-2">Lidlar manbalari</h3>
          <div className="flex-1 w-full h-64 min-h-[250px]">
            {data?.sources && data.sources.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.sources}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.sources.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                Manbalar bo'yicha ma'lumot yo'q
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
