import React, { useState, useEffect, useCallback } from 'react';

interface CaptchaProps {
  onVerify: (isValid: boolean) => void;
}

export const Captcha: React.FC<CaptchaProps> = ({ onVerify }) => {
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');

  const generateCode = useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, O, 0 to avoid confusion
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
    setInput('');
    onVerify(false);
  }, [onVerify]);

  useEffect(() => {
    generateCode();
  }, [generateCode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setInput(val);
    if (val === code) {
      onVerify(true);
    } else {
      onVerify(false);
    }
  };

  return (
    <div className="select-none">
      <div className="flex items-stretch gap-2 mb-3">
        {/* Captcha Display Box with Visual Noise */}
        <div className="relative flex-1 overflow-hidden rounded-lg border border-violet-200 bg-violet-50 p-3 select-none">
          
          {/* Noise Layer 1: Dots */}
          <div 
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ 
              backgroundImage: 'radial-gradient(#8b5cf6 1.5px, transparent 1.5px)', 
              backgroundSize: '12px 12px' 
            }} 
          />
          
          {/* Noise Layer 2: Diagonal Lines */}
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ 
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, #8b5cf6 5px, #8b5cf6 6px)' 
            }} 
          />

          {/* Random Characters */}
          <div className="relative z-10 flex justify-center items-center gap-3 h-full">
            {code.split('').map((char, i) => (
              <span 
                key={i} 
                className="font-mono text-2xl font-black text-violet-700"
                style={{ 
                  display: 'inline-block', 
                  transform: `rotate(${Math.random() * 40 - 20}deg) translateY(${Math.random() * 6 - 3}px)`,
                  textShadow: '2px 2px 0px rgba(255,255,255,0.8)'
                }}
              >
                {char}
              </span>
            ))}
          </div>
          
          {/* Interference Line */}
          <div 
             className="absolute top-1/2 left-0 w-full h-0.5 bg-violet-300/50 transform -rotate-3 pointer-events-none"
          />
        </div>

        <button 
          type="button" 
          onClick={generateCode}
          className="px-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-violet-600 transition-colors shadow-sm flex items-center justify-center"
          title="Regenerar Captcha"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <input
        type="text"
        value={input}
        onChange={handleChange}
        placeholder="INGRESE EL CÓDIGO"
        className={`
          w-full px-4 py-3 border rounded-lg 
          bg-gray-50 text-gray-900 placeholder-gray-400 font-bold tracking-widest uppercase text-center
          focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:bg-white transition-all
          ${input.length > 0 && input !== code 
            ? 'border-red-300 focus:border-red-300 text-red-600' 
            : 'border-gray-200 focus:border-violet-500'
          }
        `}
      />
    </div>
  );
};