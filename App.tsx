
import React, { useState, useEffect, useMemo } from 'react';
import { AppView, Student, AttendanceSession, AttendanceRecord, Section } from './types';
import { parseStudentList } from './services/geminiService';
import { QRCard } from './components/QRCard';
import { Scanner } from './components/Scanner';
import JSZip from 'jszip';

type SortKey = 'name' | 'id';
type SortOrder = 'asc' | 'desc';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('sections');
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastScanned, setLastScanned] = useState<{name: string, id: string, time: string, contact?: string} | null>(null);
  const [scanStatus, setScanStatus] = useState<'success' | 'error' | 'idle'>('idle');
  
  // Sorting state
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('aqr_dark_mode');
    return saved === 'true';
  });
  
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualId, setManualId] = useState('');
  const [manualParent, setManualParent] = useState('');
  const [newSectionName, setNewSectionName] = useState('');

  // Fixed Dark Mode Logic
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('aqr_dark_mode', darkMode.toString());
  }, [darkMode]);

  // Load persistence
  useEffect(() => {
    const savedSections = localStorage.getItem('aqr_sections_list');
    const savedStudents = localStorage.getItem('aqr_students');
    const savedSessions = localStorage.getItem('aqr_attendance_history');
    
    if (savedSections) setSections(JSON.parse(savedSections));
    if (savedStudents) setStudents(JSON.parse(savedStudents));
    if (savedSessions) setSessions(JSON.parse(savedSessions));
  }, []);

  // Save persistence
  useEffect(() => {
    localStorage.setItem('aqr_sections_list', JSON.stringify(sections));
    localStorage.setItem('aqr_students', JSON.stringify(students));
    localStorage.setItem('aqr_attendance_history', JSON.stringify(sessions));
  }, [sections, students, sessions]);

  const handleCreateSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    const newSection: Section = {
      id: Date.now().toString(),
      name: newSectionName.trim()
    };
    setSections([...sections, newSection]);
    setNewSectionName('');
    if (!selectedSectionId) setSelectedSectionId(newSection.id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedSectionId) {
      alert("Please select or create a section first.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const parsed = await parseStudentList(text);
      setStudents(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const newOnes = parsed
          .filter(s => !existingIds.has(s.id))
          .map(s => ({ ...s, sectionId: selectedSectionId }));
        return [...prev, ...newOnes];
      });
      setIsLoading(false);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName || !manualId || !selectedSectionId) return;
    
    if (students.find(s => s.id === manualId)) {
      alert("Student ID already exists!");
      return;
    }

    const newStudent: Student = { 
      id: manualId, 
      name: manualName, 
      qrValue: `ATTENDANCE_ID:${manualId}`,
      sectionId: selectedSectionId,
      parentContact: manualParent || undefined
    };

    setStudents([...students, newStudent]);
    setManualName('');
    setManualId('');
    setManualParent('');
    setIsAddingManual(false);
  };

  const startScanningSession = () => {
    if (!selectedSectionId) {
      alert("Please select a section to scan attendance for.");
      return;
    }
    const newSession: AttendanceSession = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
      records: [],
      sectionId: selectedSectionId
    };
    setActiveSession(newSession);
    setView('scanner');
  };

  const handleScanResult = (decodedText: string) => {
    if (!activeSession) return;
    
    const idPrefix = 'ATTENDANCE_ID:';
    if (!decodedText.startsWith(idPrefix)) {
      if (scanStatus === 'idle') {
        setScanStatus('error');
        setTimeout(() => setScanStatus('idle'), 2000);
      }
      return;
    }

    const studentId = decodedText.replace(idPrefix, '');
    const student = students.find(s => s.id === studentId);

    if (!student || student.sectionId !== activeSession.sectionId) {
      if (scanStatus === 'idle') {
        setScanStatus('error');
        setTimeout(() => setScanStatus('idle'), 2000);
      }
      return;
    }

    if (activeSession.records.find(r => r.studentId === studentId)) {
      // Still show the student info but maybe don't add record again
      setLastScanned({ 
        name: student.name, 
        id: student.id, 
        time: new Date().toLocaleTimeString(),
        contact: student.parentContact
      });
      return;
    }

    const newRecord: AttendanceRecord = {
      studentId,
      timestamp: Date.now(),
      status: 'present'
    };

    setActiveSession(prev => prev ? ({ ...prev, records: [...prev.records, newRecord] }) : null);
    setLastScanned({ 
      name: student.name, 
      id: student.id, 
      time: new Date().toLocaleTimeString(),
      contact: student.parentContact
    });
    setScanStatus('success');
    
    try { window.navigator.vibrate?.(100); } catch (e) {}
    setTimeout(() => setScanStatus('idle'), 3000);
  };

  const notifyParent = (studentName: string, contact: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const message = encodeURIComponent(`AttendancePro: Hi! This is to inform you that ${studentName} has successfully checked in for class today at ${time}.`);
    window.open(`sms:${contact}?body=${message}`, '_blank');
  };

  const saveCurrentSession = () => {
    if (activeSession) {
      setSessions([activeSession, ...sessions]);
      setActiveSession(null);
      setView('records');
    }
  };

  const downloadQR = (student: Student) => {
    const svg = document.getElementById(`qr-${student.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR_${student.name}_${student.id}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const downloadAllQRs = async () => {
    if (!selectedSectionId) return;
    const zip = new JSZip();
    const currentSection = sections.find(s => s.id === selectedSectionId);
    const folder = zip.folder(`QR_Codes_${currentSection?.name || 'Section'}`);
    
    setIsLoading(true);
    
    const currentSectionStudentsList = students.filter(s => s.sectionId === selectedSectionId);
    
    const promises = currentSectionStudentsList.map(student => {
      return new Promise<void>((resolve) => {
        const svg = document.getElementById(`qr-${student.id}`);
        if (!svg) {
          resolve();
          return;
        }
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          if (ctx) {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          }
          canvas.toBlob((blob) => {
            if (blob) {
              folder?.file(`${student.name}_${student.id}.png`, blob);
            }
            resolve();
          }, "image/png");
        };
        img.src = "data:image/svg+xml;base64," + btoa(svgData);
      });
    });

    await Promise.all(promises);
    
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `QR_Codes_${currentSection?.name || 'Section'}.zip`;
    link.click();
    setIsLoading(false);
  };

  // Memoized sorted students
  const currentSectionStudents = useMemo(() => {
    const filtered = students.filter(s => s.sectionId === selectedSectionId);
    return [...filtered].sort((a, b) => {
      const factor = sortOrder === 'asc' ? 1 : -1;
      const valA = (a[sortKey] || '').toLowerCase();
      const valB = (b[sortKey] || '').toLowerCase();
      if (valA < valB) return -1 * factor;
      if (valA > valB) return 1 * factor;
      return 0;
    });
  }, [students, selectedSectionId, sortKey, sortOrder]);

  const selectedSection = sections.find(s => s.id === selectedSectionId);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <nav className="bg-indigo-700 dark:bg-indigo-950 text-white shadow-lg sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('sections')}>
              <div className="bg-white dark:bg-indigo-100 text-indigo-700 p-2 rounded-lg">
                <i className="fas fa-qrcode text-xl"></i>
              </div>
              <span className="font-bold text-xl tracking-tight">AttendancePro</span>
            </div>
            <div className="hidden md:flex space-x-4 items-center">
              {[
                { id: 'sections', label: 'Sections', icon: 'fa-layer-group' },
                { id: 'generator', label: 'Students', icon: 'fa-users' },
                { id: 'scanner', label: 'Scanner', icon: 'fa-camera' },
                { id: 'records', label: 'Records', icon: 'fa-history' }
              ].map((v) => (
                <button 
                  key={v.id}
                  onClick={() => setView(v.id as AppView)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${view === v.id ? 'bg-indigo-800 dark:bg-indigo-800 shadow-inner' : 'hover:bg-indigo-600 dark:hover:bg-indigo-700'}`}
                >
                  <i className={`fas ${v.icon} text-xs opacity-70`}></i>
                  {v.label}
                </button>
              ))}
              <div className="h-6 w-px bg-indigo-500/50 mx-2"></div>
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-full hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all active:scale-90"
              >
                <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'} text-lg`}></i>
              </button>
            </div>
            <div className="md:hidden flex items-center space-x-2">
              <button onClick={() => setDarkMode(!darkMode)} className="p-2">
                <i className={`fas ${darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* SECTIONS MANAGEMENT VIEW */}
        {view === 'sections' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
            <header>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Manage Sections</h1>
              <p className="text-slate-500 dark:text-slate-400">Organize your classes and student groups.</p>
            </header>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              <form onSubmit={handleCreateSection} className="flex gap-4">
                <input 
                  type="text" 
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="e.g. Grade 10 - Computer Science"
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2">
                  <i className="fas fa-plus"></i>
                  Create Section
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {sections.length === 0 ? (
                <div className="col-span-full p-12 text-center text-slate-400 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  No sections created yet. Add one above to get started.
                </div>
              ) : (
                sections.map(section => (
                  <div key={section.id} className={`p-6 rounded-2xl border transition-all cursor-pointer group relative ${selectedSectionId === section.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700'}`} onClick={() => setSelectedSectionId(section.id)}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                        <i className="fas fa-layer-group text-xl"></i>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this section and all associated students?")) {
                            setSections(sections.filter(s => s.id !== section.id));
                            setStudents(students.filter(s => s.sectionId !== section.id));
                            if (selectedSectionId === section.id) setSelectedSectionId('');
                          }
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <i className="fas fa-trash-alt text-xs"></i>
                      </button>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{section.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {students.filter(s => s.sectionId === section.id).length} Students
                    </p>
                    {selectedSectionId === section.id && (
                      <div className="absolute top-4 right-4 text-indigo-600">
                        <i className="fas fa-check-circle"></i>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            {selectedSectionId && (
              <div className="flex justify-center pt-4">
                <button 
                  onClick={() => setView('generator')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none animate-bounce"
                >
                  Manage Students for {selectedSection?.name} <i className="fas fa-arrow-right ml-2"></i>
                </button>
              </div>
            )}
          </div>
        )}

        {/* STUDENT GENERATOR VIEW */}
        {view === 'generator' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Section: {selectedSection?.name || 'All Students'}</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage students and generate QR codes.</p>
              </div>
              <div className="flex gap-2">
                <select 
                  value={selectedSectionId} 
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Section</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
              <div className="flex flex-wrap gap-3 items-center w-full">
                <label className={`px-4 py-2 rounded-lg cursor-pointer transition-all shadow-sm flex items-center ${!selectedSectionId ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                  <i className="fas fa-file-upload mr-2"></i>
                  Bulk Upload (.txt)
                  <input type="file" disabled={!selectedSectionId} className="hidden" accept=".txt" onChange={handleFileUpload} />
                </label>
                <button 
                  disabled={!selectedSectionId}
                  onClick={() => setIsAddingManual(!isAddingManual)}
                  className={`px-4 py-2 rounded-lg transition-all shadow-sm flex items-center border ${!selectedSectionId ? 'bg-slate-50 text-slate-300 border-slate-100' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:text-slate-200'}`}
                >
                  <i className={`fas ${isAddingManual ? 'fa-times' : 'fa-plus'} mr-2`}></i>
                  {isAddingManual ? 'Cancel' : 'Add Student'}
                </button>
                {currentSectionStudents.length > 0 && (
                  <button 
                    onClick={downloadAllQRs}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all shadow-sm flex items-center"
                  >
                    <i className="fas fa-file-zipper mr-2"></i>
                    Download All (ZIP)
                  </button>
                )}
                
                {/* Sorting Controls */}
                {currentSectionStudents.length > 0 && (
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg ml-auto shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Sort By</span>
                    <select 
                      value={sortKey} 
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                      className="bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
                    >
                      <option value="name">Name</option>
                      <option value="id">ID</option>
                    </select>
                    <button 
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-1"
                      title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      <i className={`fas ${sortOrder === 'asc' ? 'fa-sort-alpha-down' : 'fa-sort-alpha-up'} text-sm`}></i>
                    </button>
                  </div>
                )}
              </div>
            </header>

            {isAddingManual && (
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 shadow-md animate-fadeIn transition-colors">
                <form onSubmit={handleManualSubmit} className="flex flex-col md:flex-row gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Full Name</label>
                    <input autoFocus type="text" value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g. John Doe" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Student ID</label>
                    <input type="text" value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="e.g. 2024-001" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Parent Mobile (Optional)</label>
                    <input type="tel" value={manualParent} onChange={(e) => setManualParent(e.target.value)} placeholder="e.g. +123456789" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" disabled={!manualName || !manualId} className="w-full md:w-auto bg-indigo-600 dark:bg-indigo-500 text-white px-8 py-2 rounded-lg font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors">Save Student</button>
                  </div>
                </form>
              </div>
            )}

            {isLoading && (
              <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                <p className="text-slate-600 dark:text-slate-300">Working on it...</p>
              </div>
            )}

            {!isLoading && currentSectionStudents.length === 0 && (
              <div className="text-center p-16 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 transition-colors">
                <i className="fas fa-user-slash text-4xl text-slate-200 dark:text-slate-700 mb-4"></i>
                <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300">No students in this section</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Add or upload students to get started.</p>
              </div>
            )}

            {currentSectionStudents.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {currentSectionStudents.map(student => (
                  <div key={student.id} className="relative group animate-fadeIn">
                    <QRCard student={student} onDownload={downloadQR} />
                    <button onClick={() => setStudents(students.filter(s => s.id !== student.id))} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"><i className="fas fa-times text-[10px]"></i></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SCANNER VIEW */}
        {view === 'scanner' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
            <header className="text-center">
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Scan: {selectedSection?.name}</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Check-in students for the selected section.</p>
            </header>

            {!activeSession ? (
              <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl shadow-xl text-center border border-slate-100 dark:border-slate-800 transition-colors">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-camera text-3xl"></i>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Ready to scan?</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-sm mx-auto">This will check attendance only for students in <b>{selectedSection?.name}</b>.</p>
                <button 
                  onClick={startScanningSession}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-200 active:scale-95"
                >
                  Start Scanning Session
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative">
                  <Scanner onResult={handleScanResult} />
                  {scanStatus !== 'idle' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`p-8 rounded-full ${scanStatus === 'success' ? 'bg-green-500/90' : 'bg-red-500/90'} text-white shadow-2xl scale-125 transition-transform animate-bounce`}>
                        <i className={`fas ${scanStatus === 'success' ? 'fa-check' : 'fa-times'} text-6xl`}></i>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick Notify Prompt after Scan */}
                {lastScanned && scanStatus === 'idle' && (
                   <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 flex items-center justify-between animate-fadeIn">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                         <i className="fas fa-user-check"></i>
                       </div>
                       <div>
                         <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{lastScanned.name}</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400">Checked in at {lastScanned.time}</p>
                       </div>
                     </div>
                     {lastScanned.contact ? (
                       <button 
                         onClick={() => notifyParent(lastScanned.name, lastScanned.contact!)}
                         className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                       >
                         <i className="fas fa-paper-plane"></i> Notify Parent
                       </button>
                     ) : (
                       <span className="text-[10px] text-slate-400 dark:text-slate-600 font-medium italic">No parent contact saved</span>
                     )}
                   </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center transition-colors">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Total Scanned</p>
                    <p className="text-3xl font-black text-slate-800 dark:text-white">{activeSession.records.length}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center items-center transition-colors">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Active Section</p>
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 truncate w-full text-center">{selectedSection?.name}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={saveCurrentSession} className="flex-1 bg-green-600 dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600 text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-95">Save & Finish</button>
                  <button onClick={() => setActiveSession(null)} className="px-6 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl transition-all">Close</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* RECORDS VIEW */}
        {view === 'records' && (
          <div className="space-y-8 animate-fadeIn">
            <header>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Attendance History</h1>
              <p className="text-slate-500 dark:text-slate-400">Review sessions for all sections.</p>
            </header>

            {sessions.length === 0 ? (
              <div className="text-center p-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <i className="fas fa-history text-5xl text-slate-200 dark:text-slate-700 mb-4"></i>
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">No session history</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map(session => (
                  <div key={session.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col transition-colors">
                    <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200">{session.date}</h3>
                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-black">{sections.find(s => s.id === session.sectionId)?.name || 'Unknown Section'}</p>
                      </div>
                      <div className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-bold">{session.records.length} Present</div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 mt-auto border-t border-slate-100 dark:border-slate-800 flex gap-2">
                        <button 
                          onClick={() => {
                            const csvContent = "data:text/csv;charset=utf-8," 
                              + "ID,Name,Timestamp\n"
                              + session.records.map(r => {
                                  const s = students.find(st => st.id === r.studentId);
                                  return `"${r.studentId}","${s?.name || 'Unknown'}","${new Date(r.timestamp).toLocaleString()}"`;
                                }).join("\n");
                            const encodedUri = encodeURI(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute("download", `Attendance_${session.date.replace(/\//g, '-')}.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-300 font-bold py-2 rounded-lg text-xs transition-all shadow-sm"
                        >
                          <i className="fas fa-download mr-1"></i> Export
                        </button>
                        <button onClick={() => setSessions(sessions.filter(s => s.id !== session.id))} className="px-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg text-xs hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                          <i className="fas fa-trash-alt"></i>
                        </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* MOBILE BOTTOM NAV */}
      <footer className="md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-3 px-4 flex justify-around items-center sticky bottom-0 z-50 transition-colors">
        {[
          { icon: 'fa-layer-group', label: 'Sections', id: 'sections' },
          { icon: 'fa-qrcode', label: 'Generator', id: 'generator' },
          { icon: 'fa-camera', label: 'Scanner', id: 'scanner' },
          { icon: 'fa-history', label: 'History', id: 'records' }
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setView(tab.id as AppView)} 
            className={`flex flex-col items-center flex-1 py-1 transition-all ${view === tab.id ? 'text-indigo-600 dark:text-indigo-400 scale-110 font-bold' : 'text-slate-400 dark:text-slate-600'}`}
          >
            <i className={`fas ${tab.icon} text-lg mb-1`}></i>
            <span className="text-[10px] uppercase tracking-tighter">{tab.label}</span>
          </button>
        ))}
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .dark .scrollbar-thin::-webkit-scrollbar-thumb { background: #1e293b; }
      `}} />
    </div>
  );
};

export default App;
