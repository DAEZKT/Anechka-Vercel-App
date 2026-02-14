
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (code: string) => void;
    title?: string;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onScan, title = "Escanear Código" }) => {
    const [isTorchOn, setIsTorchOn] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [hasTorch, setHasTorch] = useState(false);
    const [loading, setLoading] = useState(true);

    // Audio context for beep
    const playBeep = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'square'; // 'square' sounds more like a scanner beep
            osc.frequency.setValueAtTime(1500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);

            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) {
            console.error("Audio error", e);
        }
    };

    const toggleTorch = async () => {
        if (!scannerRef.current) return;

        try {
            // Check if applyVideoConstraints is supported (v2.2.0+)
            const html5QrCode = scannerRef.current;

            // We need to fetch the current track to check capability first, but 
            // html5-qrcode wraps it securely.
            // We can try to just apply it.

            const newTorchState = !isTorchOn;

            await html5QrCode.applyVideoConstraints({
                advanced: [{ torch: newTorchState } as any] // Cast to any because TS might not know torch
            });

            setIsTorchOn(newTorchState);
        } catch (err) {
            console.error("Error toggling torch", err);
            alert("No se pudo controlar el Flash. Puede que su dispositivo no sea compatible.");
        }
    };

    useEffect(() => {
        if (!isOpen) {
            if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current?.clear();
                }).catch(console.error);
            }
            return;
        }

        const startScanner = async () => {
            // Prevent multiple start attempts
            if (scannerRef.current?.isScanning) return;

            setLoading(true);
            // Wait for DOM to be ready
            await new Promise(r => setTimeout(r, 200));

            const scannerId = "html5qr-reader-fullscreen";
            const element = document.getElementById(scannerId);

            if (!element) {
                console.error("Scanner element not found");
                return;
            }

            // Cleanup previous instance if exists but not scanning
            if (scannerRef.current) {
                try {
                    await scannerRef.current.clear();
                } catch (e) {
                    // Ignore clear errors
                }
            }

            const html5QrCode = new Html5Qrcode(scannerId, false);
            scannerRef.current = html5QrCode;

            // Common success handler
            const onSuccess = (decodedText: string) => {
                playBeep();
                onScan(decodedText);
                onClose();
            };

            const qrConfig = {
                fps: 20,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                disableFlip: false
            };

            // Strategy: Try configs sequentially
            try {
                // 1. High Res
                await html5QrCode.start(
                    { facingMode: "environment", width: { min: 640, ideal: 1280, max: 1920 }, height: { min: 480, ideal: 720, max: 1080 } },
                    qrConfig, onSuccess, () => { }
                );
            } catch (err1) {
                console.warn("High-res failed, retrying standard...", err1);

                try {
                    // 2. Standard Environment
                    await html5QrCode.start(
                        { facingMode: "environment" },
                        qrConfig, onSuccess, () => { }
                    );
                } catch (err2) {
                    console.warn("Standard env failed, retrying generic...", err2);

                    try {
                        // 3. Fallback User/Any
                        await html5QrCode.start(
                            { facingMode: "user" },
                            qrConfig, onSuccess, () => { }
                        );
                    } catch (err3: any) {
                        console.error("All camera attempts failed", err3);

                        // Construct a helpful error message
                        let errorMsg = err3?.message || "Error desconocido";

                        if (errorMsg.includes("Permission")) {
                            errorMsg = "Permiso de cámara denegado. Revise la configuración de su navegador.";
                        } else if (errorMsg.includes("NotFound")) {
                            errorMsg = "No se encontró ninguna cámara en el dispositivo.";
                        } else if (errorMsg.includes("InsecureContext")) {
                            errorMsg = "El escáner requiere conexión segura (HTTPS).";
                        }

                        // Don't alert "already under transition" if it's just a retry fail
                        if (!errorMsg.includes("transition")) {
                            alert(`No se pudo iniciar la cámara.\n\n${errorMsg}`);
                        }
                        onClose();
                        return;
                    }
                }
            }

            setLoading(false);
            setHasTorch(true);
        };

        startScanner();

        return () => {
            if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(console.error);
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in">
            {/* Header / Controls */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
                <button
                    onClick={onClose}
                    className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all border border-white/10"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>

                <h2 className="text-white font-bold text-lg tracking-wide drop-shadow-md shadow-black">{title}</h2>

                <button
                    onClick={toggleTorch}
                    className={`p-3 rounded-full text-white transition-all border ${isTorchOn ? 'bg-yellow-500/80 border-yellow-400 text-white' : 'bg-white/10 backdrop-blur-md hover:bg-white/20 border-white/10'}`}
                >
                    {isTorchOn ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                    )}
                </button>
            </div>

            {/* Scanner Area */}
            <div className="w-full h-full relative bg-black flex items-center justify-center overflow-hidden">
                {/* The Container for html5-qrcode */}
                <div id="html5qr-reader-fullscreen" className="w-full h-full absolute inset-0"></div>

                {/* Visual Overlay (Frame) */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">

                    {/* Darker opacity mask outside the box */}
                    <div className="absolute inset-0 bg-black/30"></div>

                    {/* The Box */}
                    <div className="w-72 h-72 relative z-20">
                        {/* Clear center */}
                        <div className="absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] rounded-3xl"></div>

                        {/* Border Corners */}
                        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-3xl shadow-sm"></div>
                        <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-3xl shadow-sm"></div>
                        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-3xl shadow-sm"></div>
                        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-3xl shadow-sm"></div>

                        {/* Scanning Line Animation */}
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-scan-y opacity-90"></div>
                    </div>

                    <div className="mt-8 px-6 py-2 bg-black/60 backdrop-blur text-white font-medium rounded-full text-sm z-20">
                        Apunte la cámara hacia el código de barras
                    </div>
                </div>

                {loading && (
                    <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
                        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            <style>
                {`
                #html5qr-reader-fullscreen {
                    width: 100% !important;
                    height: 100% !important;
                    overflow: hidden !important;
                }
                #html5qr-reader-fullscreen video {
                    object-fit: cover !important;
                    width: 100% !important;
                    height: 100% !important;
                    border-radius: 0 !important;
                }
                @keyframes scan-y {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan-y {
                    animation: scan-y 2s linear infinite;
                }
                `}
            </style>
        </div>
    );
};
