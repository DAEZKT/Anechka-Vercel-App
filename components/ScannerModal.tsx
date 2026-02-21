import React, { useState, useCallback, useEffect } from 'react';
import { Scanner, IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { X, Camera } from 'lucide-react';

interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (code: string) => void;
    title?: string;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
    isOpen,
    onClose,
    onScan,
    title = "ESCÁNER MÓVIL"
}) => {
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

    const handleScan = useCallback((detectedCodes: IDetectedBarcode[]) => {
        if (detectedCodes && detectedCodes.length > 0) {
            // Confirmación visual / háptica
            if (navigator.vibrate) navigator.vibrate([50, 50, 50]);

            // Pasar el primer código leído
            onScan(detectedCodes[0].rawValue);
            onClose();
        }
    }, [onScan, onClose]);

    const handleError = useCallback((err: unknown) => {
        console.warn('Scanner Error:', err);
    }, []);

    const toggleCamera = () => {
        setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
            {/* Cabecera */}
            <div className="flex justify-between items-center p-4 z-20 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0">
                <button
                    onClick={onClose}
                    className="p-3 bg-white/10 rounded-full text-white hover:bg-white/30 transition-all backdrop-blur-md border border-white/20 shadow-lg"
                >
                    <X size={24} />
                </button>
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse"></span>
                    <h2 className="text-white font-bold tracking-[0.2em] text-xs sm:text-sm uppercase drop-shadow-md">
                        {title}
                    </h2>
                </div>

                <button
                    onClick={toggleCamera}
                    className="p-3 bg-white/10 rounded-full text-white hover:bg-white/30 transition-all backdrop-blur-md border border-white/20 shadow-lg"
                >
                    <Camera size={24} />
                </button>
            </div>

            {/* Contenedor del Escáner */}
            <div className="flex-1 w-full bg-black relative flex flex-col justify-center">
                <Scanner
                    onScan={handleScan}
                    onError={handleError}
                    // Quitar restricción de formats para que pueda procesar cualquier código de barras nativo o vía polyfill
                    scanDelay={250} // 4 chequeos por segundo, óptimo y rápido
                    constraints={{
                        facingMode: facingMode,
                        // @ts-ignore - propiedades avanzadas no siempre tipadas en TS standard
                        advanced: [{ focusMode: 'continuous' }]
                    }}
                    components={{
                        // Mostrar botones nativos de zoom y linterna si el dispositivo los soporta
                        zoom: true,
                        torch: true,
                        finder: true
                    }}
                    styles={{
                        container: {
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        },
                        video: {
                            objectFit: 'cover',
                            width: '100%',
                            height: '100%'
                        }
                    }}
                />
            </div>
        </div>
    );
};
