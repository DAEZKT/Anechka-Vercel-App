
import React, { useState } from 'react';
import { UserRole } from '../types';
import { Captcha } from '../components/Captcha';
import { userService } from '../services/supabaseService';

interface LoginProps {
  onLogin: (user: any) => void;
  onNavigate: (page: string) => void;
}

export const LoginPage: React.FC<LoginProps> = ({ onLogin, onNavigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaValid, setCaptchaValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0); // Key to force re-render/reset of Captcha

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaValid) {
      setError('Código de seguridad incorrecto. Intente nuevamente.');
      setCaptchaKey(prev => prev + 1); // Regenerate Captcha on error (One attempt policy)
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await userService.authenticate(email, password);

      if (user) {
        onLogin(user);
      } else {
        setError('Credenciales inválidas o usuario inactivo.');
        setCaptchaValid(false);
        setCaptchaKey(prev => prev + 1);
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError('Error de conexión. Intente más tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen font-sans">
      {/* LEFT SIDE: Login Form */}
      <div className="w-full lg:w-[45%] bg-white flex flex-col justify-between p-8 lg:p-12 xl:p-16 relative z-10">

        {/* Header Logo Area */}
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-violet-700 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-violet-700/30">
              DZ
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-800 tracking-tighter uppercase">DAEZKT</h1>
              <p className="text-[10px] text-gray-400 tracking-[0.2em] font-medium">POS & ERP SYSTEM</p>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">Bienvenido</h2>
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Ingreso seguro a plataforma comercial.</p>
          </div>
        </div>

        {/* Form Area */}
        <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto">
          <form onSubmit={handleLogin} className="space-y-5">

            {/* Email Input */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-violet-600 focus:ring-1 focus:ring-violet-600 outline-none transition-all"
                placeholder="usuario@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:border-violet-600 focus:ring-1 focus:ring-violet-600 outline-none transition-all pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Captcha Section */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Código de Seguridad
              </label>
              <Captcha key={captchaKey} onVerify={setCaptchaValid} />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 flex items-center gap-2 font-medium">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`
                w-full py-3.5 rounded-lg text-white font-bold tracking-wide transition-all shadow-lg shadow-violet-700/20 flex justify-center items-center gap-2
                ${loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-violet-700 hover:bg-violet-800 hover:shadow-violet-700/40 transform hover:-translate-y-0.5'
                }
              `}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Autenticando...
                </>
              ) : (
                <>
                  Iniciar Sesión
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400">
          <p>© 2026 DAEZKT Systems</p>
          <button
            type="button"
            onClick={() => onNavigate('public-catalog')}
            className="text-violet-600 font-bold hover:underline"
          >
            Ver Catálogo Público
          </button>
        </div>
      </div>

      {/* RIGHT SIDE: Visual Hero */}
      <div className="hidden lg:flex w-[55%] bg-gradient-to-br from-[#4c1d95] to-[#2e1065] relative overflow-hidden items-center justify-center">
        {/* Background Elements */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#8b5cf6 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>

        {/* Glass Card */}
        <div className="relative z-10 w-[450px] bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-white/20 px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider">Versión PRO</span>
            <span className="text-[10px] text-white/60 font-medium">DAEZKT Enterprise</span>
          </div>

          <h2 className="text-4xl font-bold text-white mb-4 leading-tight tracking-tight">
            Tu Negocio,<br />Bajo Control Total.
          </h2>

          <p className="text-sm text-white/80 mb-8 leading-relaxed">
            Gestiona ventas, inventario y finanzas en una sola plataforma inteligente. Toma mejores decisiones con reportes en tiempo real y haz crecer tu empresa.
          </p>

          <div className="space-y-4">
            <FeatureRow icon="store" text="Catálogo Digital & Pedidos" />
            <FeatureRow icon="box" text="Control de Inventario Preciso" />
            <FeatureRow icon="chart" text="Inteligencia Financiera & Cierres" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for the feature list
const FeatureRow = ({ icon, text }: { icon: string; text: string }) => {
  const getIcon = () => {
    switch (icon) {
      case 'shield': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>;
      case 'chart': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>;
      case 'users': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>;
      case 'store': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>;
      case 'box': return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>;
      default: return null;
    }
  };

  return (
    <div className="flex items-center gap-3 group cursor-default">
      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white group-hover:bg-white/20 group-hover:text-emerald-300 transition-all duration-300 shadow-lg shadow-black/5">
        {getIcon()}
      </div>
      <span className="text-sm text-white font-bold group-hover:text-white/90 transition-colors">{text}</span>
    </div>
  );
};
