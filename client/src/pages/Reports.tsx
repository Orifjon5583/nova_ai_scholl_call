import React from 'react';
import { BarChart3 } from 'lucide-react';

const Reports = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <BarChart3 size={64} className="text-gray-300 mb-4" />
      <h2 className="text-2xl font-semibold text-[#173127] mb-2">Umumiy Hisobotlar</h2>
      <p>Bu sahifa tez orada ishga tushadi...</p>
    </div>
  );
};

export default Reports;
