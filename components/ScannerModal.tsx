import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Flashlight } from 'lucide-react';

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
    title = "MODO ESCÁNER PRO"
}) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerId = "reader";
    const [hasFlash, setHasFlash] = useState(false);
    const [isFlashOn, setIsFlashOn] = useState(false);
    const [cameras, setCameras] = useState<{ id: string, label: string }[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);

    const stopScanner = async () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (err) {
                console.warn("Error deteniendo escáner:", err);
            }
        }
    };

    const startScanner = useCallback(async (cameraId?: string) => {
        if (!isOpen) return;
        setIsStarting(true);
        await stopScanner();

        try {
            // Asegurar DOM limpio
            const el = document.getElementById(scannerId);
            if (el) el.innerHTML = "";

            // OPTIMIZACIÓN DE ALTO RENDIMIENTO (TESLA MODE): 
            // Limitar solo a códigos de producto para ignorar basura y acelerar la lectura exponencialmente.
            const formatsToSupport = [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.QR_CODE
            ];

            const scanner = new Html5Qrcode(scannerId, { formatsToSupport, verbose: false });
            scannerRef.current = scanner;

            const config = {
                fps: 20, // Acelerado para respuesta inmediata
                qrbox: { width: 300, height: 150 }, // Rectángulo apaisado, vital para códigos de barras 1D de productos
                aspectRatio: 1.0,
                disableFlip: false,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true // ACELERACIÓN NATÍVA POR HARDWARE GPU
                },
                videoConstraints: {
                    width: { min: 640, ideal: 1280, max: 1920 },
                    height: { min: 480, ideal: 720, max: 1080 },
                    focusMode: 'continuous'
                    // Quitamos force zoom porque algunas cámaras viejas fallan si no soportan zoom API
                }
            };

            const cameraConfig = cameraId ? { deviceId: { exact: cameraId } } : { facingMode: "environment" };

            await scanner.start(
                cameraConfig,
                config,
                (decodedText) => {
                    playSuccessFeedback();
                    onScan(decodedText);
                    onClose(); // Auto close exitoso
                },
                (errorMessage) => {
                    // Logs omitidos intencionalmente para evitar overhead
                }
            );

            // Verificar si hay hardware para LINTERNA (Torch)
            const capabilities = scanner.getRunningTrackCameraCapabilities();
            if (capabilities && capabilities.torchFeature() && capabilities.torchFeature().isSupported()) {
                setHasFlash(true);
            } else {
                setHasFlash(false);
            }

        } catch (err) {
            console.error("Fallo al inicializar cámara Pro:", err);
        } finally {
            setIsStarting(false);
        }
    }, [isOpen, onScan, onClose]);

    // Inicializar cámaras
    useEffect(() => {
        if (isOpen) {
            Html5Qrcode.getCameras().then(devices => {
                if (devices && devices.length > 0) {
                    setCameras(devices);
                }
            }).catch(e => console.error("No se detectan cámaras:", e));

            // Retraso para transiciones de UI
            const timeoutId = setTimeout(() => {
                startScanner();
            }, 300);

            return () => clearTimeout(timeoutId);
        }

        return () => {
            stopScanner();
        };
    }, [isOpen, startScanner]);

    const playSuccessFeedback = () => {
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) { }
    };

    const toggleFlash = async () => {
        if (!scannerRef.current || !hasFlash) return;
        try {
            await scannerRef.current.applyVideoConstraints({
                advanced: [{ torch: !isFlashOn }]
            });
            setIsFlashOn(!isFlashOn);
        } catch (e) {
            console.warn("Fallo al cambiar flash", e);
        }
    };

    const switchCamera = () => {
        if (cameras.length < 2) return;
        let nextCamId = cameras[0].id;
        if (activeCameraId) {
            const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
            const nextIndex = (currentIndex + 1) % cameras.length;
            nextCamId = cameras[nextIndex].id;
        } else {
            // Si estabamos en environment y listamos multiples cámaras, giramos a la que no sea environment (si son 2, es obvio)
            nextCamId = cameras[0].id;
        }
        setActiveCameraId(nextCamId);
        startScanner(nextCamId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
            {/* Cabezal de Controles */}
            <div className="flex justify-between items-center p-4 z-20 bg-gradient-to-b from-black/90 to-transparent absolute top-0 left-0 right-0">
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

                {cameras.length > 1 ? (
                    <button
                        onClick={switchCamera}
                        className="p-3 bg-white/10 rounded-full text-white hover:bg-white/30 transition-all backdrop-blur-md border border-white/20 shadow-lg"
                    >
                        <Camera size={24} />
                    </button>
                ) : (
                    <div className="w-12"></div>
                )}
            </div>

            {/* Viewfinder Content */}
            <div className="flex-1 w-full relative flex items-center justify-center bg-zinc-950 overflow-hidden">
                {isStarting && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
                        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                        <p className="text-emerald-500/70 text-sm font-medium tracking-widest animate-pulse">CALIBRANDO CÁMARA...</p>
                    </div>
                )}

                <div id={scannerId} className="w-full max-w-2xl h-[80vh] flex items-center justify-center"></div>

                {/* Cybernetic Laser Overlay */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-[300px] h-[150px] sm:w-[450px] sm:h-[180px] border border-white/20 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.70)]">
                        {/* Esquinas Leds Avanzadas */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl -mt-[2px] -ml-[2px] shadow-[0_0_15px_rgba(52,211,153,0.6)]" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl -mt-[2px] -mr-[2px] shadow-[0_0_15px_rgba(52,211,153,0.6)]" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl -mb-[2px] -ml-[2px] shadow-[0_0_15px_rgba(52,211,153,0.6)]" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl -mb-[2px] -mr-[2px] shadow-[0_0_15px_rgba(52,211,153,0.6)]" />

                        {/* Scanline Dinámico */}
                        <div className="absolute left-3 right-3 h-[2px] bg-red-500 animate-[scan_1.5s_cubic-bezier(.5,0,.5,1)_infinite] shadow-[0_0_12px_rgba(239,68,68,1)] rounded-full"></div>
                    </div>

                    {/* Controles Flotantes Inferiores */}
                    <div className="absolute bottom-12 flex gap-4 pointer-events-auto">
                        {hasFlash && (
                            <button
                                onClick={toggleFlash}
                                className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold tracking-wider text-sm transition-all duration-300 ${isFlashOn
                                        ? 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.6)] scale-105'
                                        : 'bg-black/40 text-white border border-white/20 backdrop-blur-md hover:bg-white/20'
                                    }`}
                            >
                                <Flashlight size={18} className={isFlashOn ? 'fill-black' : ''} />
                                {isFlashOn ? 'APAGAR LUZ' : 'ENCENDER LUZ'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                /* Estabilizar video para pantallas ultrawide/mobile */
                #reader video {
                    object-fit: cover !important;
                    width: 100% !important;
                    height: 100% !important;
                    border-radius: 12px;
                }
                
                #reader {
                     border: none !important;
                }
                
                @keyframes scan {
                    0% { top: 5%; opacity: 0; }
                    15% { opacity: 1; }
                    85% { opacity: 1; }
                    100% { top: 95%; opacity: 0; }
                }
            `}</style>
        </div>
    );
};
