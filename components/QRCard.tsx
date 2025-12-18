import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Student } from '../types';

interface QRCardProps {
  student: Student;
}

export const QRCard: React.FC<QRCardProps> = ({ student }) => {
  const saveToPhone = async () => {
    try {
      const svg = document.getElementById(`qr-${student.id}`) as unknown as SVGSVGElement;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      const svgData = new XMLSerializer().serializeToString(svg);
      
      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const base64 = canvas.toDataURL("image/png").split(',')[1];

        await Filesystem.writeFile({
          path: `AttendanceQR/QR_${student.name.replace(/\s/g, '_')}.png`,
          data: base64,
          directory: Directory.Documents,
          recursive: true
        });
        alert(`Saved ${student.name}'s QR to Documents!`);
      };
      img.src = "data:image/svg+xml;base64," + btoa(svgData);
    } catch (e) {
      alert("Save failed. Check storage permissions.");
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border flex flex-col items-center group shadow-sm">
      <div className="bg-white p-2 rounded-lg mb-3">
        <QRCodeSVG id={`qr-${student.id}`} value={student.qrValue} size={140} level="H" includeMargin={true} />
      </div>
      <h3 className="font-bold text-slate-800 dark:text-slate-200">{student.name}</h3>
      <button onClick={saveToPhone} className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs">
        <i className="fas fa-download mr-1"></i> Save to Phone
      </button>
    </div>
  );
};