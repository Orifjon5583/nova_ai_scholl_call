import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';

const Settings = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <SettingsIcon size={64} className="text-gray-300 mb-4" />
      <h2 className="text-2xl font-semibold text-[#173127] mb-2">Tizim Sozlamalari</h2>
      <p>Bu sahifa tez orada ishga tushadi...</p>
    </div>
  );
};

export default Settings;
