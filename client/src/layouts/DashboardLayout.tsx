import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PhoneCall, CheckSquare, BarChart3, Settings, LogOut, ChevronDown, ChevronRight, UserCog, Bell, Search, Menu } from 'lucide-react';
import api from '../api';

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [crmOpen, setCrmOpen] = useState(location.pathname.startsWith('/crm'));
  
  let user: any = {};
  try {
    const userStr = localStorage.getItem('user');
    if (userStr && userStr !== 'undefined') {
      user = JSON.parse(userStr);
    }
  } catch (e) {
    console.error('Failed to parse user', e);
  }

  const handleLogout = async () => {
    try {
      await api.post('/logout');
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      console.error('Logout failed', error);
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['admin', 'operator'] },
    { 
      icon: Users, 
      label: 'CRM', 
      path: '/crm', 
      roles: ['admin', 'operator'],
      subItems: [
        { label: 'Barcha lidlar', path: '/crm' },
        { label: 'Yangi lidlar', path: '/crm/new' },
        { label: 'Kutayotgan lidlar', path: '/crm/waiting' },
        { label: 'Sifatli lidlar', path: '/crm/quality' },
        { label: 'Sifatsiz lidlar', path: '/crm/bad' },
        { label: 'Pipeline (Kanban)', path: '/crm/pipeline' },
      ]
    },
    { icon: PhoneCall, label: 'Qo\'ng\'iroqlar', path: '/calls', roles: ['admin', 'operator'] },
    { icon: CheckSquare, label: 'Vazifalar', path: '/tasks', roles: ['admin', 'operator'] },
    { icon: UserCog, label: 'Operatorlar', path: '/operators', roles: ['admin'] },
    { icon: BarChart3, label: 'Hisobotlar', path: '/reports', roles: ['admin'] },
    { icon: Settings, label: 'Sozlamalar', path: '/settings', roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(user?.role || 'operator'));

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeToast, setActiveToast] = useState<any>(null);

  React.useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await api.get('/dashboard');
        if (data?.stats?.overdueLeadsList) {
          const list = data.stats.overdueLeadsList.map((lead: any) => ({
            id: lead.id,
            leadId: lead.id,
            title: `Qo'ng'iroq vaqti o'tdi: ${lead.name}`,
            time: new Date(lead.nextCallAt).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
            message: lead.comments && lead.comments.length > 0 ? lead.comments[0].comment : '',
            isRead: false
          }));
          setNotifications(list);
          
          // Trigger attention-grabbing popup toast if there are notifications
          if (list.length > 0) {
            const first = list[0];
            setActiveToast(first);
            setTimeout(() => {
              setActiveToast(null);
            }, 4500);
          }
        }
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };
    fetchNotifications();
    // Optionally refresh every 45 seconds for quicker toast alerts
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getPageTitle = () => {
    if (location.pathname === '/dashboard') return 'Dashboard';
    if (location.pathname.startsWith('/crm')) return 'CRM / Barcha lidlar';
    if (location.pathname === '/calls') return 'Qo\'ng\'iroq ekrani';
    if (location.pathname === '/tasks') return 'Vazifalar';
    if (location.pathname === '/operators') return 'Operatorlar';
    if (location.pathname === '/reports') return 'Hisobotlar';
    if (location.pathname === '/settings') return 'Sozlamalar';
    return 'Dashboard';
  };

  return (
    <div className="flex h-screen bg-[#F5F7F5]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#005B35] text-white flex flex-col shadow-xl z-20">
        <div className="p-6 flex items-center gap-3">
          <img src="/logo.png" alt="NOVA" className="h-10 bg-white rounded-full p-1" />
          <div>
            <h2 className="font-bold text-lg leading-tight tracking-wide text-[#F4C400]">NOVA</h2>
            <span className="text-[10px] text-green-200 uppercase tracking-widest block">International AI School</span>
          </div>
        </div>
        
        <nav className="flex-1 py-2 overflow-y-auto custom-scrollbar">
          <ul className="space-y-1 px-3">
            {filteredMenuItems.map((item, index) => {
              const isCrm = item.label === 'CRM';
              const isCrmActive = location.pathname.startsWith('/crm');
              
              if (isCrm) {
                return (
                  <li key={index} className="flex flex-col">
                    <button 
                      onClick={() => setCrmOpen(!crmOpen)}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg transition w-full ${
                        isCrmActive && !crmOpen ? 'bg-[#F4C400] text-[#173127] font-semibold' : 'text-gray-100 hover:bg-[#004A2B]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={20} className={isCrmActive && !crmOpen ? 'text-[#173127]' : 'text-gray-200'} />
                        <span>{item.label}</span>
                      </div>
                      {crmOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    
                    {crmOpen && item.subItems && (
                      <ul className="mt-1 ml-4 border-l-2 border-[#007041] pl-2 space-y-1">
                        {item.subItems.map((sub, sIdx) => (
                          <li key={sIdx}>
                            <NavLink 
                              to={sub.path}
                              end={sub.path === '/crm'}
                              className={({isActive}) => `
                                block px-4 py-2 rounded-lg text-sm transition
                                ${isActive ? 'bg-[#007041] text-[#F4C400] font-medium' : 'text-gray-300 hover:text-white hover:bg-[#004A2B]'}
                              `}
                            >
                              {sub.label}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              }

              return (
                <li key={index}>
                  <NavLink 
                    to={item.path}
                    className={({isActive}) => `
                      flex items-center gap-3 px-4 py-3 rounded-lg transition
                      ${isActive 
                        ? 'bg-[#F4C400] text-[#173127] font-semibold shadow-md' 
                        : 'text-gray-100 hover:bg-[#004A2B]'}
                    `}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon size={20} className={isActive ? 'text-[#173127]' : 'text-gray-200'} />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-[#004A2B]">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-gray-300 hover:text-red-400 transition w-full px-4 py-2 hover:bg-[#004A2B] rounded-lg"
          >
            <LogOut size={20} />
            <span>Chiqish</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 shadow-sm z-10 relative">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-[#173127] flex items-center gap-3">
              <Menu size={20} className="text-gray-400 cursor-pointer hover:text-gray-600" /> {getPageTitle()}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            {/* Search */}
            <div className="relative hidden md:block">
              <input 
                type="text" 
                placeholder="Qidirish..." 
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#005B35]"
              />
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            </div>

            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-gray-400 hover:text-gray-600 relative p-1 transition"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-[#173127]">Bildirishnomalar</h3>
                    <span className="text-xs text-[#008F4C] font-medium cursor-pointer hover:underline">Barchasini o'qish</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                            setShowNotifications(false);
                            navigate(`/crm?leadId=${n.leadId}`);
                        }}
                        className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer ${!n.isRead ? 'bg-blue-50/30' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className={`text-sm ${!n.isRead ? 'font-bold text-gray-800' : 'font-medium text-gray-600'}`}>{n.title}</p>
                          {!n.isRead && <span className="w-2 h-2 bg-[#008F4C] rounded-full shrink-0 mt-1.5"></span>}
                        </div>
                        {n.message && (
                          <p className="text-xs text-gray-500 mb-2 font-medium italic line-clamp-2">"{n.message}"</p>
                        )}
                        <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                          <span className="inline-block w-3 h-3 text-gray-300">⏱️</span> {n.time}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 text-center border-t border-gray-100 bg-gray-50">
                    <button className="text-sm font-bold text-[#008F4C] hover:text-[#005B35]">Barcha bildirishnomalar</button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
              <div className="w-10 h-10 rounded-full bg-[#008F4C] text-white flex items-center justify-center font-bold shadow-md">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-bold text-gray-800 leading-tight">{user?.name || 'Foydalanuvchi'}</p>
                <p className="text-xs text-gray-500">{user?.role === 'admin' ? 'Super Administrator' : 'Operator'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>

      {/* Attention-grabbing Dynamic Toast Banner */}
      {activeToast && (
        <div 
          onClick={() => {
            setActiveToast(null);
            navigate(`/crm?leadId=${activeToast.leadId}`);
          }}
          className="fixed top-6 right-6 z-[200] max-w-sm bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-white p-4 rounded-2xl shadow-2xl border-2 border-yellow-200 cursor-pointer animate-bounce transition transform hover:scale-105 flex items-start gap-3"
          style={{ animation: 'bounce 0.8s infinite alternate' }}
        >
          <div className="text-3xl shrink-0 animate-pulse">🚨</div>
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className="font-extrabold text-sm text-white drop-shadow">{activeToast.title}</h4>
              <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded-full font-bold">{activeToast.time}</span>
            </div>
            {activeToast.message && (
              <p className="text-xs text-white/90 font-semibold italic bg-black/20 p-2 rounded-lg line-clamp-2">
                "{activeToast.message}"
              </p>
            )}
            <p className="text-[10px] text-yellow-100 font-bold mt-1 uppercase tracking-wider text-right">Ochish uchun bosing ➔</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
