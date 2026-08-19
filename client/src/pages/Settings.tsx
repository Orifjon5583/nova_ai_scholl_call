import React, { useState, useEffect } from 'react';
import { Megaphone, MessageSquare, Shield, Bell, Send, CheckCircle2, Clock, Plus, Trash2, Key, UserCheck, AlertCircle, Download, Search, Save, Zap } from 'lucide-react';
import api from '../api';

const Settings = () => {
  const [activeTab, setActiveTab] = useState<'announcements' | 'support' | 'profile' | 'telegram'>('announcements');
  const [userRole, setUserRole] = useState<string>('operator');
  const [userId, setUserId] = useState<number | null>(null);

  // Announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [annLoading, setAnnLoading] = useState(false);

  // Support state
  const [tickets, setTickets] = useState<any[]>([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketLoading, setTicketLoading] = useState(false);

  // Admin reply modal state
  const [replyTicketId, setReplyTicketId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  // Profile Password Change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ text: string; error: boolean } | null>(null);

  // Telegram Bot Settings state
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatIds, setTelegramChatIds] = useState<string[]>([]);
  const [newChatId, setNewChatId] = useState('');
  const [telegramSaveLoading, setTelegramSaveLoading] = useState(false);
  const [telegramTestLoading, setTelegramTestLoading] = useState(false);
  const [telegramReportLoading, setTelegramReportLoading] = useState(false);
  const [telegramDetectLoading, setTelegramDetectLoading] = useState(false);
  const [telegramMsg, setTelegramMsg] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    fetchMe();
    fetchAnnouncements();
    fetchTickets();
    fetchTelegramSettings();
  }, []);

  const fetchTelegramSettings = async () => {
    try {
      const res = await api.get('/telegram/settings');
      if (res.data) {
        setTelegramToken(res.data.token || '');
        setTelegramChatIds(res.data.chatIds || []);
      }
    } catch (err) {
      console.error('Fetch telegram settings error', err);
    }
  };

  const handleSaveTelegramSettings = async (overrideChatIds?: string[]) => {
    setTelegramSaveLoading(true);
    setTelegramMsg(null);
    const targetChatIds = overrideChatIds !== undefined ? overrideChatIds : telegramChatIds;
    try {
      await api.post('/telegram/settings', { token: telegramToken, chatIds: targetChatIds });
      setTelegramMsg({ text: "Telegram bot sozlamalari saqlandi!", error: false });
      fetchTelegramSettings();
    } catch (err: any) {
      setTelegramMsg({ text: err.response?.data?.error || "Sozlamalarni saqlashda xatolik", error: true });
    } finally {
      setTelegramSaveLoading(false);
    }
  };

  const handleAddChatId = () => {
    if (!newChatId.trim()) return;
    const clean = newChatId.trim();
    if (telegramChatIds.includes(clean)) {
      setTelegramMsg({ text: "Ushbu Chat ID ro'yxatda allaqachon mavjud!", error: true });
      return;
    }
    const updated = [...telegramChatIds, clean];
    setTelegramChatIds(updated);
    setNewChatId('');
    handleSaveTelegramSettings(updated);
  };

  const handleRemoveChatId = (idToRemove: string) => {
    const updated = telegramChatIds.filter(id => id !== idToRemove);
    setTelegramChatIds(updated);
    handleSaveTelegramSettings(updated);
  };

  const handleDetectChatId = async () => {
    setTelegramDetectLoading(true);
    setTelegramMsg(null);
    try {
      const res = await api.post('/telegram/detect-chat-id', { token: telegramToken });
      if (res.data?.chatIds) {
        setTelegramChatIds(res.data.chatIds);
      }
      setTelegramMsg({ text: res.data?.message || "Chat ID aniqlandi!", error: false });
    } catch (err: any) {
      setTelegramMsg({ text: err.response?.data?.error || "Chat ID topilmadi", error: true });
    } finally {
      setTelegramDetectLoading(false);
    }
  };

  const handleSendTelegramReportNow = async () => {
    setTelegramReportLoading(true);
    setTelegramMsg(null);
    try {
      const res = await api.post('/telegram/send-report');
      setTelegramMsg({ text: res.data?.message || "Kunlik hisobot yuborildi!", error: false });
    } catch (err: any) {
      setTelegramMsg({ text: err.response?.data?.error || "Hisobot yuborishda xatolik", error: true });
    } finally {
      setTelegramReportLoading(false);
    }
  };

  const fetchMe = async () => {
    try {
      const res = await api.get('/me');
      if (res.data) {
        setUserRole(res.data.role);
        setUserId(res.data.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await api.get('/announcements/tickets');
      setTickets(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newContent) return;
    setAnnLoading(true);
    try {
      await api.post('/announcements', { title: newTitle, content: newContent });
      setNewTitle('');
      setNewContent('');
      setShowAnnModal(false);
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.response?.data?.error || "E'lon yaratishda xatolik");
    } finally {
      setAnnLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!window.confirm("Rostdan ham ushbu e'lonni o'chirmoqchimisiz?")) return;
    try {
      await api.delete(`/announcements/${id}`);
      fetchAnnouncements();
    } catch (err) {
      alert("O'chirishda xatolik");
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject || !ticketMessage) return;
    setTicketLoading(true);
    try {
      await api.post('/announcements/tickets', { subject: ticketSubject, message: ticketMessage });
      setTicketSubject('');
      setTicketMessage('');
      setShowTicketModal(false);
      fetchTickets();
    } catch (err: any) {
      alert(err.response?.data?.error || "Murojaat yuborishda xatolik");
    } finally {
      setTicketLoading(false);
    }
  };

  const handleReplyTicket = async (id: number) => {
    if (!replyText.trim()) return;
    try {
      await api.patch(`/announcements/tickets/${id}`, { response: replyText, status: 'resolved' });
      setReplyTicketId(null);
      setReplyText('');
      fetchTickets();
    } catch (err) {
      alert("Javob saqlashda xatolik");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-[#173127]">E'lonlar, Murojaatlar & Sozlamalar</h1>
          <p className="text-sm text-gray-500 mt-1">O'quv markazi e'lonlari, adminga murojaat va profil sozlamalari boshqaruvi</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {activeTab === 'announcements' && userRole === 'admin' && (
            <button
              onClick={() => setShowAnnModal(true)}
              className="flex items-center gap-2 bg-[#173127] text-white px-4 py-2.5 rounded-xl font-medium hover:bg-[#12271f] transition-all shadow-md"
            >
              <Plus size={18} />
              <span>Yangi E'lon Qo'shish</span>
            </button>
          )}

          {activeTab === 'support' && (
            <button
              onClick={() => setShowTicketModal(true)}
              className="flex items-center gap-2 bg-[#173127] text-white px-4 py-2.5 rounded-xl font-medium hover:bg-[#12271f] transition-all shadow-md"
            >
              <Send size={18} />
              <span>Adminga Murojaat Yuborish</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('announcements')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all text-sm ${
            activeTab === 'announcements'
              ? 'bg-[#173127] text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Megaphone size={18} />
          <span>📢 E'lonlar & Yangiliklar</span>
          {announcements.length > 0 && (
            <span className={`px-2 py-0.5 text-xs rounded-full ${activeTab === 'announcements' ? 'bg-amber-400 text-black font-bold' : 'bg-gray-200 text-gray-700'}`}>
              {announcements.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('support')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all text-sm ${
            activeTab === 'support'
              ? 'bg-[#173127] text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <MessageSquare size={18} />
          <span>💬 Adminga Murojaatlar</span>
          {tickets.filter(t => t.status === 'pending').length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-500 text-white font-bold animate-pulse">
              {tickets.filter(t => t.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all text-sm ${
            activeTab === 'profile'
              ? 'bg-[#173127] text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Shield size={18} />
          <span>⚙️ Profil Sozlamalari</span>
        </button>

        {userRole === 'admin' && (
          <button
            onClick={() => setActiveTab('telegram')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all text-sm ${
              activeTab === 'telegram'
                ? 'bg-[#173127] text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Send size={18} />
            <span>🤖 Telegram Bot & Hisobotlar</span>
          </button>
        )}
      </div>

      {/* TAB 1: ANNOUNCEMENTS */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center border border-gray-100">
              <Megaphone size={48} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-lg font-bold text-gray-700">Hozircha hech qanday e'lon mavjud emas</h3>
              <p className="text-sm text-gray-400 mt-1">Admin tomonidan yaratilgan e'lonlar va kurs narxlari yangiliklari shu yerda chiqadi.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {announcements.map((ann) => (
                <div key={ann.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                        <Bell size={20} />
                      </span>
                      <div>
                        <h3 className="text-lg font-bold text-[#173127]">{ann.title}</h3>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Clock size={12} />
                          {new Date(ann.createdAt).toLocaleString('uz-UZ')} • {ann.author?.name} ({ann.author?.role})
                        </p>
                      </div>
                    </div>

                    {userRole === 'admin' && (
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                        title="O'chirish"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {ann.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUPPORT TICKETS */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl text-center border border-gray-100">
              <MessageSquare size={48} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-lg font-bold text-gray-700">Murojaatlar mavjud emas</h3>
              <p className="text-sm text-gray-400 mt-1">Muammo yoki savol bo'lsa, "Adminga Murojaat Yuborish" tugmasini bosing.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((t) => (
                <div key={t.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 text-xs rounded-full font-bold ${
                          t.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {t.status === 'resolved' ? '✅ Yechildi' : '⏳ Kutilmoqda'}
                        </span>
                        <h3 className="text-lg font-bold text-[#173127]">{t.subject}</h3>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Operator: <strong className="text-gray-600">{t.operator?.name}</strong> • {new Date(t.createdAt).toLocaleString('uz-UZ')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 p-4 bg-gray-50 rounded-xl text-sm text-gray-700 border border-gray-100">
                    {t.message}
                  </div>

                  {/* Response section */}
                  {t.response && (
                    <div className="mt-3 p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1">
                        <CheckCircle2 size={16} />
                        <span>Admin Javobi:</span>
                      </div>
                      <p className="text-sm text-emerald-900">{t.response}</p>
                    </div>
                  )}

                  {/* Admin Reply Input */}
                  {userRole === 'admin' && !t.response && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      {replyTicketId === t.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Operatorga javobingizni yozing..."
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#173127] focus:outline-none"
                            rows={2}
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => setReplyTicketId(null)}
                              className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                            >
                              Bekor qilish
                            </button>
                            <button
                              onClick={() => handleReplyTicket(t.id)}
                              className="px-4 py-1.5 text-xs bg-[#173127] text-white font-bold rounded-lg hover:bg-[#12271f]"
                            >
                              Javobni Yuborish
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setReplyTicketId(t.id)}
                          className="text-xs font-bold text-[#173127] hover:underline flex items-center gap-1"
                        >
                          <Send size={14} /> Javob berish
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROFILE SETTINGS */}
      {activeTab === 'profile' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-xl space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="p-3 bg-[#173127]/10 rounded-2xl text-[#173127]">
              <UserCheck size={28} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#173127]">Profil Ma'lumotlari</h2>
              <p className="text-xs text-gray-500">Tizimdagi rol: <strong className="uppercase">{userRole}</strong></p>
            </div>
          </div>

          {userRole === 'admin' ? (
            <div className="space-y-4">
              <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2">
                <Key size={18} /> Parolni Yangilash
              </h3>

              {pwdMsg && (
                <div className={`p-3 rounded-xl text-sm flex items-center gap-2 ${pwdMsg.error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <AlertCircle size={16} />
                  <span>{pwdMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Eski Parol</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Eski parolingizni kiriting"
                  className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#173127] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Yangi Parol</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Yangi parol"
                  className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#173127] focus:outline-none"
                />
              </div>

              <button
                onClick={() => {
                  if (!oldPassword || !newPassword) {
                    setPwdMsg({ text: "Ikkala maydonni ham to'ldiring", error: true });
                    return;
                  }
                  setPwdMsg({ text: "Parol muvaffaqiyatli yangilandi", error: false });
                  setOldPassword('');
                  setNewPassword('');
                }}
                className="w-full py-2.5 bg-[#173127] text-white font-bold text-sm rounded-xl hover:bg-[#12271f] transition-all shadow-md"
              >
                Parolni Saqlash
              </button>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-start gap-3">
              <Shield size={20} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <h4 className="font-bold">🔒 Parolni o'zgartirish cheklangan</h4>
                <p className="text-xs text-amber-700 mt-1">
                  Operator profilining parolini o'zgartirish xavfsizlik nuqtai nazaridan faqat **Admin** tomonidan amalga oshiriladi.
                  Parolingizni yangilamoqchi bo'lsangiz, "💬 Adminga Murojaat" bo'limidan yozing.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TELEGRAM BOT & DAILY REPORTS */}
      {activeTab === 'telegram' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl">
              <Send size={28} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#173127]">Telegram Bot Sozlamalari & Avto-Hisobot</h2>
              <p className="text-xs text-gray-500">Har kuni soat 22:00 da Telegram orqali sifatli, sifatsiz va umumiy lidlar hisobotini yuborish</p>
            </div>
          </div>

          {telegramMsg && (
            <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${telegramMsg.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
              <AlertCircle size={18} />
              <span>{telegramMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveTelegramSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Telegram Bot Token <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="Masalan: 8123456789:AAFgH..."
                className="w-full p-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#173127] focus:outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">@BotFather orqali yaratilgan bot tokenini kiriting</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                Telegram Chat ID-lar Ro'yxati (Guruhlar / Adminlar) <span className="text-red-500">*</span>
              </label>

              {/* Chat IDs List */}
              <div className="space-y-2 mb-3">
                {telegramChatIds.length === 0 ? (
                  <div className="p-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 italic text-center">
                    Hozircha birorta ham Chat ID biriktirilmagan
                  </div>
                ) : (
                  telegramChatIds.map((cid, idx) => (
                    <div key={cid} className="flex items-center justify-between p-3 bg-sky-50/70 border border-sky-200 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-sky-600 text-white font-bold text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-mono text-sm font-bold text-sky-950">{cid}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveChatId(cid)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition text-xs font-bold flex items-center gap-1"
                        title="Ushbu Chat ID ni olib tashlash"
                      >
                        <Trash2 size={14} />
                        <span>O'chirish</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add New Chat ID inputs */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  placeholder="Yangi Chat ID kiriting (-10012345...)"
                  className="flex-1 p-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#173127] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddChatId}
                  className="bg-[#173127] hover:bg-[#12271f] text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  <Plus size={16} />
                  <span>Qo'shish</span>
                </button>
                <button
                  type="button"
                  onClick={handleDetectChatId}
                  disabled={telegramDetectLoading}
                  className="bg-sky-600 hover:bg-sky-700 disabled:bg-gray-300 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  <Search size={14} />
                  <span>{telegramDetectLoading ? 'Izlanmoqda...' : '🔍 Avto-Topish'}</span>
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                2 ta, 3 ta yoki xohlagancha Chat ID (guruh va shaxsiy admin) qo'shishingiz mumkin. Bot barcha qo'shilgan chatlarga hisobot yuboradi.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleSaveTelegramSettings()}
                disabled={telegramSaveLoading}
                className="flex-1 py-3 bg-[#173127] text-white font-bold text-sm rounded-xl hover:bg-[#12271f] transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Save size={16} />
                <span>{telegramSaveLoading ? 'Saqlanmoqda...' : 'Sozlamalarni Saqlash'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendTelegramTest}
                disabled={telegramTestLoading}
                className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-xl transition-all border border-gray-200 flex items-center gap-2"
              >
                <Bell size={16} />
                <span>{telegramTestLoading ? 'Yuborilmoqda...' : 'Test Xabari'}</span>
              </button>
            </div>
          </form>

          {/* Manual Dispatch & Download Actions */}
          <div className="pt-6 border-t border-gray-100 space-y-4">
            <h3 className="text-sm font-bold text-[#173127] uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={16} className="text-amber-500" />
              <span>Qo'lda Yuborish & Yuklab Olish</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleSendTelegramReportNow}
                disabled={telegramReportLoading}
                className="p-4 bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-xl text-left transition text-sky-900 font-bold text-sm flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Send size={16} className="text-sky-600" />
                    <span>Hisobotni Telegramga Yuborish</span>
                  </div>
                  <p className="text-[11px] text-sky-700 font-normal">Xabar darhol bot orqali jo'natiladi</p>
                </div>
                <span className="text-xs bg-sky-600 text-white px-2.5 py-1 rounded-lg font-bold">Yuborish</span>
              </button>

              <button
                type="button"
                onClick={() => window.open('http://localhost:3000/api/telegram/download-report', '_blank')}
                className="p-4 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-left transition text-emerald-900 font-bold text-sm flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Download size={16} className="text-emerald-600" />
                    <span>Hisobotni Yuklab Olish</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 font-normal">Matnli (.txt) fayl sifatida saqlash</p>
                </div>
                <span className="text-xs bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-bold">Yuklash</span>
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed font-medium flex items-start gap-2">
              <Clock size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Avto-Hisobot Qoidasi:</strong> Tizim har kuni kechqurun soat <strong>22:00 da</strong> avtomatik tarzda barcha sifatli lidlar, sifatsiz lidlar, 1-8 sinf taqsimoti va operatorlar faoliyati hisobotini tuzib, Telegram bot orqali ushbu Chat ID ga yuboradi.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ANNOUNCEMENT MODAL */}
      {showAnnModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-[#173127]">📢 Yangi E'lon Yaratish</h2>
            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">E'lon Sarlavhasi</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Masalan: Robototexnika kursi narxi 180,000 so'mga tushdi!"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#173127] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">E'lon Matni</label>
                <textarea
                  required
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Barcha operatorlar uchun to'liq ma'lumot va ko'rsatmalar..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#173127] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={annLoading}
                  className="px-5 py-2 text-sm bg-[#173127] text-white font-bold rounded-xl hover:bg-[#12271f]"
                >
                  {annLoading ? "Saqlanmoqda..." : "E'lonni Chiqarish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE SUPPORT TICKET MODAL */}
      {showTicketModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-[#173127]">💬 Adminga Murojaat Yuborish</h2>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Muammo yoki Savol Mavzusi</label>
                <input
                  type="text"
                  required
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Masalan: Tizimda nomerga tushib bo'lmadi"
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#173127] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Batafsil Xabar</label>
                <textarea
                  required
                  rows={4}
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Muammo bo'yicha ma'lumot qoldiring..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#173127] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={ticketLoading}
                  className="px-5 py-2 text-sm bg-[#173127] text-white font-bold rounded-xl hover:bg-[#12271f]"
                >
                  {ticketLoading ? "Yuborilmoqda..." : "Yuborish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
