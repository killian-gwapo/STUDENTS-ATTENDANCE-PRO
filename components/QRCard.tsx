
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Student } from '../types';

interface QRCardProps {
  student: Student;
  onDownload: (student: Student) => void;
}

export const QRCard: React.FC<QRCardProps> = ({ student, onDownload }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center group transition-all hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900">
      <div className="mb-3 bg-white p-2 rounded-lg">
        <QRCodeSVG 
          id={`qr-${student.id}`}
          value={student.qrValue} 
          size={140}
          level="H"
          includeMargin={true}
        />
      </div>
      <div className="text-center w-full">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate">{student.name}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-500 font-mono mt-1">ID: {student.id}</p>
      </div>
      <button 
        onClick={() => onDownload(student)}
        className="mt-4 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <i className="fas fa-download mr-1"></i> Download
      </button>
    </div>
  );
};
