import React from 'react';

const Icons = {
    ChevronDown: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    ),
    Check: () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    )
};

interface CustomSelectProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string; icon?: React.ReactNode }[];
    placeholder?: string;
    disabled?: boolean;
    isOpen?: boolean;
    onToggle?: () => void;
    required?: boolean;
}

const CustomSelect: React.FC<CustomSelectProps> = ({
    label,
    value,
    onChange,
    options,
    placeholder = '-- Seleccionar --',
    disabled = false,
    isOpen = false,
    onToggle,
    required = false
}) => {
    const selectedOption = options.find(o => o.value === value);

    return (
        <div className="relative w-full">
            <label className="block text-xs font-semibold text-gray-500 mb-1">
                {label} {required && '*'}
            </label>

            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && onToggle && onToggle()}
                disabled={disabled}
                className={`
          w-full px-4 py-2 pr-10 rounded-lg border text-left flex items-center justify-between transition-all outline-none
          ${disabled
                        ? 'bg-gray-100/50 border-gray-200 text-gray-400 cursor-not-allowed opacity-70'
                        : isOpen
                            ? 'bg-white border-brand-primary ring-2 ring-brand-primary/20 text-gray-800 shadow-md'
                            : 'bg-white/60 border-white/40 hover:border-gray-300 text-gray-700 hover:bg-white/80'
                    }
        `}
            >
                <div className="flex items-center gap-2 truncate">
                    {selectedOption ? (
                        <>
                            {selectedOption.icon}
                            <span className="font-medium text-sm">{selectedOption.label}</span>
                        </>
                    ) : (
                        <span className="text-gray-400 text-sm">{placeholder}</span>
                    )}
                </div>

                <div className={`absolute right-3 transition-transform duration-200 ${isOpen ? 'rotate-180 text-brand-primary' : 'text-gray-400'}`}>
                    <Icons.ChevronDown />
                </div>
            </button>

            {/* Dropdown Options */}
            {isOpen && !disabled && (
                <>
                    <div className="fixed inset-0 z-20 cursor-default" onClick={onToggle} />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar z-30 animate-fade-in-down origin-top">
                        {options.length > 0 ? (
                            <div className="p-1.5 space-y-0.5">
                                {options.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.value);
                                            if (onToggle) onToggle();
                                        }}
                                        className={`
                      w-full px-3 py-2 text-sm rounded-lg flex items-center gap-2 transition-all text-left
                      ${value === opt.value
                                                ? 'bg-brand-primary/10 text-brand-primary font-bold shadow-sm'
                                                : 'text-gray-600 hover:bg-brand-primary/5 hover:text-gray-900'
                                            }
                    `}
                                    >
                                        {opt.icon}
                                        {opt.label}
                                        {value === opt.value && (
                                            <span className="ml-auto text-brand-primary">
                                                <Icons.Check />
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-gray-400 text-xs italic">
                                No hay opciones disponibles.
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default CustomSelect;
