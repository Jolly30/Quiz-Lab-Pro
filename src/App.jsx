import React, { useState, useEffect, useRef } from 'react';
import { 
  CircleCheck, 
  CircleX, 
  RotateCcw, 
  Upload, 
  List, 
  Trash2, 
  Trophy, 
  Target, 
  Eye, 
  BookOpen,
  Wand2,
  ArrowRightLeft, 
  Layout,
  ClipboardCheck,
  ShieldCheck,
  CheckCircle2,
  X,
  Plus,
  FileSearch,
  HardDrive
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

// --- FIREBASE INITIALIZATION ---
const isLocalDev = typeof __firebase_config === 'undefined';
let app, auth, db, appId;

if (!isLocalDev) {
  try {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    appId = typeof __app_id !== 'undefined' && __app_id ? String(__app_id) : 'default-app-id';
  } catch (e) {
    console.log("Firebase initialization skipped:", e.message);
  }
}

const STORAGE_KEY = 'meo_prep_pro_v17_stable';
const getSafeDocId = (str) => encodeURIComponent(str).replace(/[%.\/]/g, '_') || 'unnamed_module';

export default function App() {
  const [user, setUser] = useState(null);
  const [sections, setSections] = useState({});
  const [view, setView] = useState('menu'); 
  const [activeSection, setActiveSection] = useState(null);
  const [rawInput, setRawInput] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [showConfirm, setShowConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Progress States
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0); 

  const [answers, setAnswers] = useState({}); 
  const [fibInput, setFibInput] = useState({}); 
  const [revealed, setRevealed] = useState({});
  const [matchSelectedA, setMatchSelectedA] = useState({}); 
  const [matchTemp, setMatchTemp] = useState({}); 

  const questions = activeSection ? (sections[activeSection] || []) : [];
  const unsubscribeRef = useRef(null);

  // --- 1. Progress Bar Logic ---
  useEffect(() => {
    let interval;
    if (isProcessing) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 30) return prev + 1;
          if (prev < 80) return prev + 0.3;
          if (prev < 95) return prev + 0.1;
          return prev;
        });
      }, 100);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  // --- 2. INIT: Auth and Local Storage ---
  useEffect(() => {
    if (isLocalDev || !auth) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSections(JSON.parse(saved));
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.log("Auth init skipped:", err.message);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setSections(JSON.parse(saved));

    return () => unsubscribe();
  }, []);

  // --- 3. DATA SYNC (Cloud Only) ---
  useEffect(() => {
    if (isLocalDev || !user || !db || !appId) return;
    const collectionRef = collection(db, 'artifacts', appId, 'users', user.uid, 'modules');
    if (unsubscribeRef.current) unsubscribeRef.current();
    unsubscribeRef.current = onSnapshot(collectionRef, (snap) => {
      const data = {};
      snap.forEach(docSnap => {
        const docData = docSnap.data();
        let parsedQs = [];
        if (docData.content) {
          try { parsedQs = JSON.parse(docData.content); } catch(e) {}
        }
        data[docData.displayName || docSnap.id] = parsedQs;
      });
      if (Object.keys(data).length > 0) {
        setSections(prev => ({ ...prev, ...data }));
      }
    });
    return () => { if (unsubscribeRef.current) unsubscribeRef.current(); };
  }, [user]);

  // --- 4. AI IMPORT ---
  const handleAI_Import = async () => {
    if (!rawInput) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      const cleanJSON = JSON.parse(data.candidates[0].content.parts[0].text);
      const name = moduleName.trim() || `Module ${Object.keys(sections).length + 1}`;
      const updated = { ...sections, [name]: cleanJSON };
      setSections(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (!isLocalDev && user && db && appId) {
        const safeId = getSafeDocId(name);
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'modules', safeId), {
          displayName: name, content: JSON.stringify(cleanJSON), updatedAt: Date.now()
        });
      }
      setRawInput(''); setModuleName(''); setView('menu');
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const checkCorrect = (q, val) => {
    if (!q || val === undefined || q.type === 'header') return false;
    if (q.type === 'mcq' || q.type === 'tf') return val === q.correctAnswerIndex;
    if (q.type === 'fib') return val?.trim().toLowerCase() === q.answerText?.trim().toLowerCase();
    if (q.type === 'matching') {
      return q.colA.every((_, i) => val[i] === q.correctMatches[i] || val[i] === q.correctMatches[String(i)]);
    }
    return false;
  };

  const scrollToNext = (idx) => {
    const nextEl = document.getElementById(`q-card-${idx + 1}`);
    if (nextEl) nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const calculateScore = () => {
    let count = 0;
    Object.keys(answers).forEach(idx => {
      if (checkCorrect(questions[idx], answers[idx])) count++;
    });
    return count;
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black">LOADING...</div>;

  let questionCounter = 0;
  const totalQuestions = questions.filter(q => q.type !== 'header').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-xl">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('menu')}>
          <BookOpen className="text-blue-500 w-6 h-6" />
          <h1 className="text-xl font-black tracking-tighter uppercase italic">MEO Prep <span className="text-blue-500">PRO</span></h1>
        </div>
        {view === 'quiz' && (
          <div className="flex items-center gap-4 bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-700">
            <Target className="w-4 h-4 text-green-400" />
            <span className="text-sm font-bold">{calculateScore()} / {totalQuestions}</span>
            <button onClick={() => {setAnswers({}); setFibInput({}); setRevealed({});}} className="p-1 hover:text-blue-400"><RotateCcw className="w-4 h-4" /></button>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => setView('menu')} className={`p-2 rounded-lg ${view === 'menu' ? 'bg-blue-600' : 'bg-slate-800'}`}><List className="w-5 h-5" /></button>
          <button onClick={() => setView('import')} className={`p-2 rounded-lg ${view === 'import' ? 'bg-blue-600' : 'bg-slate-800'}`}><Upload className="w-5 h-5" /></button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-4 md:p-8">
        {view === 'menu' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-500">
            {Object.keys(sections).map(name => (
              <div key={name} className="relative group bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-blue-500 cursor-pointer shadow-lg" onClick={() => {setActiveSection(name); setAnswers({}); setView('quiz'); window.scrollTo(0,0);}}>
                <h3 className="text-lg font-bold text-white mb-1 pr-16">{name}</h3>
                <p className="text-xs text-slate-500 uppercase font-black">{sections[name].length} Questions</p>
                <button onClick={(e) => { e.stopPropagation(); setShowConfirm(name); }} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => setView('import')} className="p-10 border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 hover:text-blue-400 hover:border-blue-500 font-black uppercase text-xs flex flex-col items-center gap-2 group transition-all">
              <Plus className="w-6 h-6 group-hover:scale-110" /> Add New Module
            </button>
          </div>
        )}

        {view === 'quiz' && (
          <div className="space-y-12 pb-40 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-3xl font-black text-white border-b border-slate-800 pb-4 tracking-tight uppercase italic">{activeSection}</h2>
            {questions.map((q, idx) => {
              if (q.type === 'header') { questionCounter = 0; return (
                <div key={idx} className="pt-10 pb-4 border-l-4 border-l-blue-600 pl-6 bg-slate-900/50 rounded-r-2xl border-y border-r border-slate-800">
                   <h3 className="text-2xl font-black text-white uppercase italic">{q.text}</h3>
                </div>
              );}
              questionCounter++;
              const isAns = answers[idx] !== undefined;
              const isRev = revealed[idx];
              const userVal = answers[idx];

              return (
                <div key={idx} id={`q-card-${idx}`} className={`p-6 md:p-10 rounded-[2.5rem] bg-slate-900 border transition-all duration-500 shadow-2xl ${isAns ? (checkCorrect(q, userVal) ? 'border-green-500/30' : 'border-red-500/30') : 'border-slate-800'}`}>
                  <div className="mb-6 flex justify-between items-center">
                    <div className="bg-slate-800 text-blue-400 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-700">Question {questionCounter}</div>
                    {isAns && <span className={`text-[10px] font-black uppercase ${checkCorrect(q, userVal) ? 'text-green-500' : 'text-red-500'}`}>{checkCorrect(q, userVal) ? 'Correct' : 'Incorrect'}</span>}
                  </div>
                  <p className="text-xl md:text-2xl font-medium text-white mb-8 whitespace-pre-line leading-relaxed">{q.question}</p>

                  {(q.type === 'mcq' || q.type === 'tf') && (
                    <div className="space-y-3">
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = q.correctAnswerIndex === oIdx;
                        const isSelected = userVal === oIdx;
                        let style = "bg-slate-800 border-slate-700";
                        if (isAns) {
                          if (isCorrect) style = "bg-green-900/30 border-green-500 text-green-400";
                          else if (isSelected) style = "bg-red-900/30 border-red-500 text-red-400";
                          else style = "opacity-30 border-slate-800";
                        }
                        return (
                          <button key={oIdx} disabled={isAns} onClick={() => {setAnswers({...answers, [idx]: oIdx}); setTimeout(() => scrollToNext(idx), 600);}} className={`w-full text-left p-5 rounded-2xl border transition-all flex justify-between items-center ${style}`}>
                            <span>{opt}</span>
                            {isAns && isCorrect && <CheckCircle2 className="w-5 h-5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'fib' && (
                    <form onSubmit={(e) => { e.preventDefault(); const val = (fibInput[idx] || "").trim(); if(val){ setAnswers({...answers, [idx]: val}); setTimeout(()=>scrollToNext(idx), 600); } }}>
                      <input type="text" disabled={isAns} value={fibInput[idx] || ""} onChange={(e)=>setFibInput({...fibInput, [idx]: e.target.value})} placeholder="Type answer and press Enter..." className="w-full p-6 bg-slate-950 rounded-2xl border-2 border-slate-800 focus:border-blue-500 outline-none text-xl font-bold transition-all" />
                    </form>
                  )}

                  {(isAns || isRev) && (q.type === 'fib') && (
                    <div className="p-5 mt-6 bg-slate-800/50 rounded-2xl border border-slate-700 flex items-start gap-3">
                      <Eye className="text-blue-400 w-5 h-5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Answer Key</p>
                        <span className="text-lg text-white font-mono">{q.answerText}</span>
                      </div>
                    </div>
                  )}
                  {!isAns && <div className="mt-4 flex justify-end"><button onClick={() => setRevealed({...revealed, [idx]: !isRev})} className="text-[10px] font-bold text-slate-600 hover:text-blue-400 uppercase tracking-widest">{isRev ? 'Hide' : 'Show Answer'}</button></div>}
                </div>
              );
            })}
            <div className="flex justify-center pt-20">
              <button onClick={() => setView('results')} className="px-16 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-black uppercase shadow-2xl transition-all flex items-center gap-3">Finish Exam <Trophy className="w-6 h-6 text-yellow-400" /></button>
            </div>
          </div>
        )}

        {view === 'results' && (
          <div className="bg-slate-900 p-10 md:p-20 rounded-[3rem] text-center border border-slate-800 shadow-2xl animate-in zoom-in">
            <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-6" />
            <h2 className="text-4xl font-black text-white mb-8 tracking-tight uppercase italic leading-none">Module Complete</h2>
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 mb-2 uppercase">Score</p>
                <p className="text-5xl font-black text-white">{calculateScore()} / {totalQuestions}</p>
              </div>
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 mb-2 uppercase">Accuracy</p>
                <p className="text-5xl font-black text-blue-500">{totalQuestions > 0 ? Math.round((calculateScore()/totalQuestions)*100) : 0}%</p>
              </div>
            </div>
            <button onClick={() => setView('menu')} className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase tracking-widest transition-all">Modules Home</button>
          </div>
        )}

        {view === 'import' && (
          <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center gap-3 mb-8">
               <Wand2 className="text-blue-500 w-6 h-6" />
               <h2 className="text-2xl font-black text-white uppercase italic leading-none">AI Import</h2>
            </div>
            
            <input type="text" value={moduleName} onChange={(e)=>setModuleName(e.target.value)} placeholder="Enter Module Name..." className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 mb-4 font-bold outline-none focus:border-blue-500 transition-all text-white" />
            <textarea value={rawInput} onChange={(e)=>setRawInput(e.target.value)} placeholder="Paste raw text here..." className="w-full h-80 p-6 bg-slate-950 rounded-3xl border border-slate-800 font-mono text-xs mb-6 outline-none focus:border-blue-500 transition-all text-slate-300" />
            
            {/* --- VISUAL LOADING LINE (RESTORED) --- */}
            {isProcessing && (
              <div className="w-full mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">AI is Parsing...</span>
                  <span className="text-[10px] font-black text-slate-500">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300" 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-3">
              <button 
                onClick={handleAI_Import} 
                disabled={isProcessing || !rawInput}
                className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isProcessing ? "Processing PDF..." : "Generate Module with AI"}
              </button>
              <button onClick={() => setView('menu')} className="md:px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase transition-all">Cancel</button>
            </div>
          </div>
        )}

        {showConfirm && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-200">
              <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 text-white">Delete Module?</h3>
              <p className="text-slate-400 text-sm mb-8">Permanently remove <span className="text-white font-bold">{showConfirm}</span>?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold uppercase text-xs text-white transition-colors">Cancel</button>
                <button onClick={handleDeleteConfirm} className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold uppercase text-xs text-white transition-colors">Delete</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}