import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Filesystem, Directory } from '@capacitor/filesystem'; // Native File Plugin
import { Student } from '../types';

interface QRCardProps {
  student: Student;
}

export const QRCard: React.FC<QRCardProps> = ({ student }) => {
  
  const handleDownload = async () => {
    try {
      // 1. Find the SVG element we generated
      const svgElement = document.getElementById(`qr-${student.id}`) as unknown as SVGSVGElement;
      if (!svgElement) return;

      // 2. Convert SVG to an Image string (Base64)
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      
      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        // This creates the raw data needed for the phone to "read" the image
        const base64Data = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");

        // 3. Save to Native Storage
        const fileName = `QR_${student.name.replace(/\s+/g, '_')}.png`;
        
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents, // Saves to the app's folder in Documents
          recursive: true
        });

        alert(`Success! QR Code for ${student.name} saved to your Documents folder.`);
      };

      img.src = "data:image/svg+xml;base64," + btoa(svgData);

    } catch (error) {
      console.error('Download failed', error);
      alert("Could not save QR code. Make sure you granted Storage permissions.");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center group transition-all">
      <div className="mb-3 bg-white p-2 rounded-lg">
        <QRCodeSVG 
          id={`qr-${student.id}`} // We use this ID to find the image in the code above
          value={student.qrValue} 
          size={140}
          level="H"
          includeMargin={true}
        />
      </div>
      <div className="text-center w-full">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate">{student.name}</h3>
        <p className="text-xs text-slate-500 font-mono mt-1">ID: {student.id}</p>
      </div>
      
      {/* Updated button to trigger our new handleDownload function */}
      <button 
        onClick={handleDownload}
        className="mt-4 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <i className="fas fa-download mr-1"></i> Save to Phone
      </button>
    </div>
  );
};