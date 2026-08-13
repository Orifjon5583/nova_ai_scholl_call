import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, EyeOff, Eye } from 'lucide-react';
import api from '../api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/login', { username, password });
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError('Login yoki parol xato');
    }
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Left Side - Abstract Background */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#005B35] overflow-hidden">
        {/* Simple geometric decorations mimicking the abstract feel */}
        <div className="absolute top-0 left-0 w-full h-full">
           <svg viewBox="0 0 800 800" className="w-full h-full text-[#006e40] opacity-50" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M0,0 L800,0 L800,400 L0,800 Z" />
              <path fill="#F4C400" d="M800,0 L800,200 L400,0 Z" />
              <path fill="#008F4C" d="M0,800 L800,800 L800,600 L0,400 Z" />
           </svg>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center flex flex-col items-center">
            <img src="/logo.png" alt="NOVA Logo" className="h-28 w-28 object-contain mb-4" />
            <h2 className="text-3xl font-bold text-[#173127]">NOVA CRM</h2>
            <p className="text-sm text-gray-500 mt-1">Call Center Management System</p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {error && <div className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-md border border-red-100">{error}</div>}
            
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005B35] focus:border-transparent sm:text-sm transition-all"
                  placeholder="Foydalanuvchi nomi"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="appearance-none block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#005B35] focus:border-transparent sm:text-sm transition-all"
                  placeholder="Parol"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-[#005B35] focus:ring-[#005B35] border-gray-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 font-medium cursor-pointer">
                  Meni eslab qolish
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-[#008F4C] hover:text-[#005B35] transition-colors">
                  Parolni unutdingizmi?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-[#008F4C] hover:bg-[#005B35] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#005B35] transition-all shadow-md hover:shadow-lg"
              >
                Kirish
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
