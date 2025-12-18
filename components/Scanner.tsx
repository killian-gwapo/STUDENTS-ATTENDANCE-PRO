import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannerProps {
  onResult: (decodedText: string) => void;
}

export const Scanner: React.FC<ScannerProps> = ({ onResult }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastResult = useRef<string>("");

  useEffect(() => {
    const containerId = "reader";
    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => {
            // Only trigger if it's a new scan to prevent 100 alerts for one QR
            if (decodedText !== lastResult.current) {
              lastResult.current = decodedText;
              onResult(decodedText);
              
              // Reset result after 3 seconds so you can scan the same student again later
              setTimeout(() => { lastResult.current = ""; }, 3000);
            }
          },
          () => {} // Silent error callback
        );
      } catch (err) {
        console.error("Scanner failed to start:", err);
      }
    };

    startScanner();

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(e => console.error("Stop failed", e));
      }
    };
  }, [onResult]);

  return (
    <div className="w-full max-w-md mx-auto overflow-hidden rounded-2xl border-4 border-indigo-500 shadow-xl bg-black aspect-square flex items-center justify-center">
      <div id="reader" className="w-full h-full"></div>
    </div>
  );
};