
import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannerProps {
  onResult: (decodedText: string) => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onResult }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "reader";

  useEffect(() => {
    const startScanner = async () => {
      try {
        if (scannerRef.current) {
          await scannerRef.current.stop();
        }

        scannerRef.current = new Html5Qrcode(containerId);
        
        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await scannerRef.current.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            onResult(decodedText);
          },
          () => {} // error callback
        );
      } catch (err) {
        console.error("Scanner startup error:", err);
      }
    };

    const timer = setTimeout(startScanner, 100);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop()
          .catch(err => console.error("Failed to stop scanner", err));
      }
    };
  }, [onResult]);

  return (
    <div className="w-full max-w-md mx-auto overflow-hidden rounded-2xl border-4 border-indigo-500 dark:border-indigo-600 shadow-xl bg-black aspect-square flex items-center justify-center">
      <div id={containerId} className="w-full h-full"></div>
    </div>
  );
};
