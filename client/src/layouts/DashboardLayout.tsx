import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, PhoneCall, CheckSquare, BarChart3, Settings, LogOut, ChevronDown, ChevronRight, UserCog, Bell, Search, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api';

const DashboardLayout = () => {
  const { t, i18n } = useTranslation();
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
    { icon: LayoutDashboard, label: t('sidebar.dashboard'), path: '/dashboard', roles: ['admin', 'operator'] },
    { icon: Users, label: t('sidebar.crm'), path: '/crm/pipeline', roles: ['admin', 'operator'] },
    { icon: PhoneCall, label: t('sidebar.calls'), path: '/calls', roles: ['admin', 'operator'] },
    { icon: CheckSquare, label: t('sidebar.tasks'), path: '/tasks', roles: ['admin', 'operator'] },
    { icon: UserCog, label: t('sidebar.operators'), path: '/operators', roles: ['admin'] },
    { icon: BarChart3, label: t('sidebar.reports'), path: '/reports', roles: ['admin'] },
    { icon: Settings, label: t('sidebar.settings'), path: '/settings', roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(user?.role || 'operator'));

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeToast, setActiveToast] = useState<any>(null);
  const [shownToastIds, setShownToastIds] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nova_read_notification_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  React.useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await api.get('/dashboard');
        const list: any[] = [];

        if (data?.stats?.overdueLeadsList) {
          data.stats.overdueLeadsList.forEach((lead: any) => {
            const id = `lead-${lead.id}`;
            list.push({
              id,
              type: 'lead',
              leadId: lead.id,
              title: `Qo'ng'iroq deadline'i: ${lead.name}`,
              time: new Date(lead.nextCallAt).toLocaleDateString('uz-UZ'),
              message: lead.comments && lead.comments.length > 0 ? lead.comments[0].comment : '',
              isRead: readIds.includes(id)
            });
          });
        }

        if (data?.stats?.assignedTasksList) {
          data.stats.assignedTasksList.forEach((task: any) => {
            const id = `task-${task.id}`;
            list.push({
              id,
              type: 'task',
              taskId: task.id,
              title: `📌 Admin topshiriq biriktirdi: ${task.title}`,
              time: new Date(task.createdAt).toLocaleString('uz-UZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
              message: task.description || (task.creator?.name ? `${task.creator.name} tomonidan berilgan topshiriq` : ''),
              isRead: readIds.includes(id)
            });
          });
        }

        setNotifications(list);

        const newUnread = list.filter(n => !n.isRead && !shownToastIds.includes(n.id));
        if (newUnread.length > 0) {
          const first = newUnread[0];
          setActiveToast(first);
          setShownToastIds(prev => [...prev, first.id]);
          setTimeout(() => {
            setActiveToast(null);
          }, 5000);
        }
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 20000);
    return () => clearInterval(interval);
  }, [readIds, shownToastIds]);

  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      setReadIds(updated);
      try {
        localStorage.setItem('nova_read_notification_ids', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    const updated = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(updated);
    try {
      localStorage.setItem('nova_read_notification_ids', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getPageTitle = () => {
    if (location.pathname === '/dashboard') return t('sidebar.dashboard');
    if (location.pathname.startsWith('/crm')) return t('crm.title');
    if (location.pathname === '/calls') return 'Qo\'ng\'iroq ekrani';
    if (location.pathname === '/tasks') return 'Vazifalar';
    if (location.pathname === '/operators') return t('sidebar.operators');
    if (location.pathname === '/reports') return 'Hisobotlar';
    if (location.pathname === '/settings') return t('sidebar.settings');
    return t('sidebar.dashboard');
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


  return (
    <div className="flex h-screen bg-[#F5F7F5] overflow-hidden">
      {/* Mobile Sidebar Overlay / Drawer */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Slide-out Mobile Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#005B35] text-white flex flex-col shadow-2xl transition-transform duration-300 transform md:hidden
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-5 flex items-center justify-between border-b border-[#004A2B]">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="NOVA" className="h-10 bg-white rounded-full p-1" />
            <div>
              <h2 className="font-bold text-lg leading-tight tracking-wide text-[#F4C400]">NOVA</h2>
              <span className="text-[10px] text-green-200 uppercase tracking-widest block">International AI School</span>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-gray-300 hover:text-white p-2 rounded-lg"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto px-3 space-y-1">
          {filteredMenuItems.map((item, index) => (
            <NavLink 
              key={index}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({isActive}) => `
                flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition text-sm
                ${isActive 
                  ? 'bg-[#F4C400] text-[#173127] font-bold shadow-md' 
                  : 'text-gray-100 hover:bg-[#004A2B]'}
              `}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} className={isActive ? 'text-[#173127]' : 'text-gray-200'} />
                  <span className="flex-1">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[#004A2B]">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-gray-300 hover:text-red-400 transition w-full px-4 py-2.5 hover:bg-[#004A2B] rounded-xl text-sm font-semibold"
          >
            <LogOut size={20} />
            <span>{t('sidebar.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#005B35] text-white flex-col shadow-xl z-20 shrink-0">
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
                        <span className="flex-1">{item.label}</span>
                        {item.path === '/tasks' && notifications.length > 0 && (
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-full shadow-md bg-red-500 text-white animate-pulse">
                            {notifications.length}
                          </span>
                        )}
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
            <span>{t('sidebar.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-8 shadow-sm z-10 relative shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 md:hidden"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-base md:text-lg font-bold text-[#173127]">
              {getPageTitle()}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            
            {/* Search */}
            <div className="relative hidden md:block">
              <input 
                type="text" 
                placeholder={t('header.search')} 
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
                    <span 
                      onClick={markAllAsRead}
                      className="text-xs text-[#008F4C] font-bold cursor-pointer hover:underline"
                    >
                      Barchasini o'qish
                    </span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => {
                            markAsRead(n.id);
                            setShowNotifications(false);
                            if (n.type === 'task') {
                              navigate('/tasks');
                            } else if (n.leadId) {
                              navigate(`/crm?leadId=${n.leadId}`);
                            }
                        }}
                        className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className={`text-sm ${!n.isRead ? 'font-bold text-gray-800' : 'font-medium text-gray-600'}`}>{n.title}</p>
                          {!n.isRead && <span className="w-2 h-2 bg-[#008F4C] rounded-full shrink-0 mt-1.5 animate-pulse"></span>}
                        </div>
                        {n.message && (
                          <p className="text-xs text-gray-500 mb-2 font-medium italic line-clamp-2">"{n.message}"</p>
                        )}
                        <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                          <span className="inline-block w-3 h-3 text-gray-300">⏱️</span> {n.time}
                        </p>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="p-6 text-center text-xs text-gray-400 font-medium">
                        Bildirishnomalar yo'q
                      </div>
                    )}
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
        <div className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-30 flex items-center justify-around h-16 px-1 shadow-2xl">
        {filteredMenuItems.slice(0, 5).map((item, index) => (
          <NavLink
            key={index}
            to={item.path}
            className={({ isActive }) => `
              flex flex-col items-center justify-center w-full py-1 text-[11px] transition-all relative
              ${isActive ? 'text-[#005B35] font-bold scale-105' : 'text-gray-400 hover:text-gray-600'}
            `}
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} className={isActive ? 'text-[#005B35]' : 'text-gray-400'} />
                <span className="truncate max-w-[64px] leading-tight mt-0.5">{item.label.split(' ')[0]}</span>
                {item.label === 'Vazifalar' && notifications.length > 0 && (
                  <span className="absolute top-1 right-4 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Attention-grabbing Dynamic Toast Banner */}
      {activeToast && (
        <div 
          onClick={() => {
            markAsRead(activeToast.id);
            setActiveToast(null);
            if (activeToast.type === 'task') {
              navigate('/tasks');
            } else if (activeToast.leadId) {
              navigate(`/crm?leadId=${activeToast.leadId}`);
            }
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
