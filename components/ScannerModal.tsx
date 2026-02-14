import React, { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (code: string) => void;
    title?: string;
}

/**
 * ScannerModal - Refactored Component
 * Implementación limpia y profesional utilizando html5-qrcode.
 */
export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onScan, title = "Escanear Código" }) => {
    // Referencia para mantener la instancia del escáner y controlar su ciclo de vida
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerId = "reader";

    useEffect(() => {
        if (!isOpen) return;

        // Limpieza preventiva del DOM para evitar errores de duplicidad
        const element = document.getElementById(scannerId);
        if (element) element.innerHTML = "";

        let isMounted = true;
        let scannerInstance: Html5Qrcode | null = null;

        const initializeScanner = async () => {
            try {
                // Instanciamos la clase con formato verbose falso para producción
                scannerInstance = new Html5Qrcode(scannerId, false);
                scannerRef.current = scannerInstance;

                // Configuración Técnica Solicitada
                const config = {
                    fps: 10, // Balance entre rendimiento y consumo de batería
                    qrbox: { width: 250, height: 150 }, // Cuadro de enfoque rectangular
                    aspectRatio: 1.0,
                    disableFlip: false, // Útil para cámaras frontales, irrelevante si forzamos environment
                };

                // Iniciar escáner forzando cámara trasera ('environment')
                await scannerInstance.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText) => {
                        if (!isMounted) return;

                        // Feedback háptico profesional
                        if (navigator.vibrate) {
                            navigator.vibrate(100);
                        }

                        // Sonido de "beep" sutil (opcional pero recomendado junto a vibración)
                        playSimpleBeep();

                        onScan(decodedText);

                        // Cierre automático tras éxito
                        onClose();
                    },
                    (errorMessage) => {
                        // Callback de error por frame (ruido). 
                        // No hacemos log para no saturar la consola, es normal mientras busca QR.
                    }
                );
            } catch (err) {
                console.error("Error crítico al iniciar la cámara:", err);
                if (isMounted) {
                    alert("No se pudo iniciar la cámara. Verifique que 'Sitio Seguro (HTTPS)' esté activo y los permisos concedidos.");
                    onClose();
                }
            }
        };

        // Pequeño delay para asegurar que el modal y el div #reader estén renderizados
        const timer = setTimeout(() => {
            initializeScanner();
        }, 300);

        // Ciclo de Vida: Cleanup (Desmontaje)
        return () => {
            isMounted = false;
            clearTimeout(timer);

            if (scannerInstance) {
                scannerInstance.stop()
                    .then(() => scannerInstance?.clear())
                    .catch(e => {
                        console.warn("Scanner stop/clear warning:", e);
                        // Forzamos limpieza UI si falla el stop lógico
                        const el = document.getElementById(scannerId);
                        if (el) el.innerHTML = "";
                    });
            }
        };
    }, [isOpen]);

    // Función auxiliar para feedback auditivo simple
    const playSimpleBeep = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(1500, ctx.currentTime);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) { }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in">
            {/* Header Flotante */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/60 to-transparent">
                <button
                    onClick={onClose}
                    className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all border border-white/10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <h2 className="text-white font-medium text-lg tracking-wide shadow-black drop-shadow-md">{title}</h2>
                <div className="w-10"></div> {/* Spacer */}
            </div>

            {/* Contenedor del Escáner */}
            <div className="w-full h-full relative bg-gray-900 flex items-center justify-center overflow-hidden">
                {/* 
                    IMPORTANTE: 
                    El div #reader debe tener dimensiones controladas.
                    html5-qrcode inyectará el video aquí.
                */}
                <div id={scannerId} className="w-full h-full"></div>

                {/* Overlay Visual Puramente Estético (No afecta al video) */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-[250px] h-[150px] border-2 border-white/50 rounded-lg relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                        {/* Esquinas Brillantes */}
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-[2px] -ml-[2px]" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-[2px] -mr-[2px]" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-[2px] -ml-[2px]" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-[2px] -mr-[2px]" />

                        {/* Línea de escaneo animada */}
                        <div className="absolute left-0 right-0 h-[2px] bg-red-500 animate-[scan_2s_linear_infinite] shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                    </div>
                    <p className="mt-6 text-white text-sm font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                        Coloque el código dentro del cuadro
                    </p>
                </div>
            </div>

            <style>{`
                /* Forza al video a comportarse como fondo cover */
                #reader video {
                    object-fit: cover !important;
                    width: 100% !important;
                    height: 100% !important;
                    border-radius: 0 !important;
                }
                @keyframes scan {
                    0% { top: 10%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 90%; opacity: 0; }
                }
            `}</style>
        </div>
    );
};
