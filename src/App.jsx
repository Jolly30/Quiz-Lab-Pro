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
  HardDrive,
  Pencil,
  Save
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
  
  // --- States for AI Processing & Feedback ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [answers, setAnswers] = useState({}); 
  const [fibInput, setFibInput] = useState({}); 
  const [revealed, setRevealed] = useState({});
  const [matchSelectedA, setMatchSelectedA] = useState({}); 
  const [matchTemp, setMatchTemp] = useState({}); 
  const [editingModule, setEditingModule] = useState(null);
  const [plainText, setPlainText] = useState(''); 

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
          if (prev < 98) return prev + 0.05;
          return prev;
        });
      }, 100);
    } else if (isSuccess) {
      setProgress(100);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing, isSuccess]);

  // --- 2. INIT: Handles Local VS Code vs Cloud environments ---
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
        } else if (docData.questionsData) {
          try { parsedQs = JSON.parse(docData.questionsData); } catch(e) {}
        } else if (docData.questions) {
          parsedQs = docData.questions;
        }
        data[docData.displayName || docSnap.id] = parsedQs;
      });
      
      if (Object.keys(data).length > 0) {
        setSections(prevSections => {
          const newSections = { ...prevSections, ...data };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSections));
          return newSections;
        });
      }
    }, (err) => {
      console.log("Cloud sync restricted:", err.message);
    });

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [user]);

  // --- 4. THE NEW GEMINI AI IMPORT ENGINE ---
  const handleAI_Import = async () => {
    if (!rawInput) return;
    setIsProcessing(true);
    setIsSuccess(false);

    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      const rawResponseText = data.candidates[0].content.parts[0].text;
      const cleanJSON = JSON.parse(rawResponseText);
      
      const name = moduleName.trim() || `Module ${Object.keys(sections).length + 1}`;
      const newSections = { ...sections, [name]: cleanJSON };
      
      setSections(newSections);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSections));
      
      if (!isLocalDev && user && db && appId) {
        try {
          const safeDocId = getSafeDocId(name);
          const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'modules', safeDocId);
          await setDoc(docRef, {
            displayName: name,
            content: JSON.stringify(cleanJSON),
            updatedAt: Date.now()
          });
        } catch (err) {
          console.log("Background Cloud Save Restricted:", err.message);
        }
      }

      setIsProcessing(false);
      setIsSuccess(true);
      
      setTimeout(() => {
        setRawInput(''); 
        setModuleName(''); 
        setIsSuccess(false);
        setView('menu');
      }, 1500);

    } catch (error) {
      console.error("AI Parsing Failed:", error);
      setIsProcessing(false);
      alert("The AI encountered an error: " + error.message);
    }
  };

  const saveNotepadChanges = async () => {
    const blocks = plainText.split('\n\n').filter(b => b.trim());
    
    const newQuestions = blocks.map(block => {
      const lines = block.split('\n').map(l => l.trim());
      const qLine = lines.find(l => l.toLowerCase().startsWith('question:')) || '';
      const aLine = lines.find(l => l.toLowerCase().startsWith('answer:')) || '';
      const oLine = lines.find(l => l.toLowerCase().startsWith('options:')) || '';
      const matchingLines = lines.filter(l => l.includes('-->'));

      const questionText = qLine.replace(/question:/i, '').trim();
      const answerText = aLine.replace(/answer:/i, '').trim();

      if (matchingLines.length > 0) {
        return {
          type: 'matching',
          question: questionText,
          colA: matchingLines.map((l, i) => ({ id: i + 1, text: l.split('-->')[0].trim() })),
          colB: matchingLines.map((l, i) => ({ letter: String.fromCharCode(65 + i), text: l.split('-->')[1].trim() })),
          correctMatches: matchingLines.reduce((acc, _, i) => ({ ...acc, [i]: i }), {})
        };
      }

      if (oLine) {
        const options = oLine.replace(/options:/i, '').split(',').map(o => o.trim());
        return {
          type: 'mcq',
          question: questionText,
          options: options,
          correctAnswerIndex: options.findIndex(opt => opt.toLowerCase() === answerText.toLowerCase())
        };
      }

      return { type: 'fib', question: questionText, answerText: answerText };
    });

    const updatedSections = { ...sections, [editingModule]: newQuestions };
    setSections(updatedSections);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSections));
    
    if (!isLocalDev && user && db && appId) {
      try {
        const safeDocId = getSafeDocId(editingModule);
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'modules', safeDocId), {
          displayName: editingModule,
          content: JSON.stringify(newQuestions),
          updatedAt: Date.now()
        });
      } catch (err) { console.log("Cloud Save Error:", err.message); }
    }
    setView('menu');
    setEditingModule(null);
  };

  const handleDeleteConfirm = async () => {
    if (!showConfirm) return;
    const name = showConfirm;
    const newSections = { ...sections };
    delete newSections[name];
    setSections(newSections);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSections));
    setShowConfirm(null);

    if (!isLocalDev && user && db && appId) {
      try {
        const safeDocId = getSafeDocId(name);
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'modules', safeDocId));
      } catch (err) {
        console.log("Cloud Delete Restricted:", err.message);
      }
    }
  };

  const checkCorrect = (q, val) => {
    if (!q || val === undefined || q.type === 'header') return false;
    if (q.type === 'mcq' || q.type === 'tf') return val === q.correctAnswerIndex;
    if (q.type === 'fib') return val?.trim() === q.answerText?.trim();
    if (q.type === 'matching') {
        if (!val || Object.keys(val).length === 0) return false;
        return q.colA.every((_, aIdx) => val[aIdx] === q.correctMatches[aIdx] || val[aIdx] === q.correctMatches[String(aIdx)]);
    }
    return false;
  };

  const scrollToNext = (idx) => {
    const nextEl = document.getElementById(`q-card-${idx + 1}`);
    if (nextEl) {
      nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = document.getElementById(`fib-inp-${idx + 1}`);
      if (input) setTimeout(() => input.focus(), 400);
    }
  };

  const calculateScore = () => {
    let count = 0;
    Object.keys(answers).forEach(idx => {
      if (checkCorrect(questions[idx], answers[idx])) count++;
    });
    return count;
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <div className="text-blue-500 font-bold uppercase tracking-widest text-[10px]">Loading Workspace...</div>
    </div>
  );

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
            <span className="text-sm font-bold tracking-tighter">{calculateScore()} / {totalQuestions}</span>
            <button onClick={() => {setAnswers({}); setFibInput({}); setRevealed({}); setMatchTemp({}); setMatchSelectedA({}); window.scrollTo(0,0);}} className="p-1 hover:text-blue-400 transition-colors"><RotateCcw className="w-4 h-4" /></button>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setView('menu')} className={`p-2 rounded-lg transition-all ${view === 'menu' ? 'bg-blue-600 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'}`}><List className="w-5 h-5" /></button>
          <button onClick={() => {setRawInput(''); setModuleName(''); setView('import');}} className={`p-2 rounded-lg transition-all ${view === 'import' ? 'bg-blue-600 shadow-lg' : 'bg-slate-800 hover:bg-slate-700'}`}><Upload className="w-5 h-5" /></button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-4 md:p-8">
        
        {/* VIEW: MENU */}
        {view === 'menu' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-500">
            {Object.keys(sections).map(name => (
              <div key={name} className="relative group bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all cursor-pointer shadow-lg" onClick={() => {setActiveSection(name); setAnswers({}); setView('quiz'); window.scrollTo(0,0);}}>
                <h3 className="text-lg font-bold text-white mb-1 pr-16">{name}</h3>
                <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{sections[name].filter(q => q.type !== 'header').length} Questions</p>
                <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={(e) => { 
                      e.stopPropagation(); 
                      setEditingModule(name); 
                      const textData = sections[name].map(q => {
                        if (q.type === 'header') return `Question: ${q.text}\nAnswer: Header`;
                        if (q.type === 'matching') {
                          const pairs = q.colA.map((item, i) => `${item.text} --> ${q.colB[q.correctMatches[i] ?? q.correctMatches[String(i)]].text}`).join('\n');
                          return `Question: ${q.question}\n${pairs}`;
                        }
                        if (q.type === 'mcq') return `Question: ${q.question}\nOptions: ${q.options.join(', ')}\nAnswer: ${q.options[q.correctAnswerIndex]}`;
                        return `Question: ${q.question}\nAnswer: ${q.answerText}`;
                      }).join('\n\n');
                      setPlainText(textData);
                      setView('edit'); 
                      window.scrollTo(0,0);
                  }} className="text-slate-400 hover:text-blue-500 p-2 bg-slate-950 rounded-lg border border-slate-800 hover:border-blue-500/50 transition-all shadow-xl" title="Edit Module">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setShowConfirm(name); }} className="text-slate-400 hover:text-red-500 p-2 bg-slate-950 rounded-lg border border-slate-800 hover:border-red-500/50 transition-all shadow-xl"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            <button onClick={() => {setRawInput(''); setModuleName(''); setView('import');}} className="p-10 border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 hover:text-blue-400 hover:border-blue-500/50 font-black uppercase text-xs transition-all flex flex-col items-center gap-2 group">
              <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" /> Add New Module
            </button>
          </div>
        )}

        {/* VIEW: QUIZ */}
        {view === 'quiz' && (
          <div className="space-y-12 pb-40 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-3xl font-black text-white border-b border-slate-800 pb-4 tracking-tight uppercase italic">{activeSection}</h2>
            {questions.map((q, idx) => {
              if (q.type === 'header') {
                questionCounter = 0; 
                return (
                  <div key={idx} className="pt-10 pb-4 border-l-4 border-l-blue-600 pl-6 bg-slate-900/50 rounded-r-2xl shadow-lg border-y border-r border-slate-800">
                    <div className="flex items-center gap-4">
                       <Layout className="text-blue-500 w-6 h-6" />
                       <h3 className="text-2xl font-black text-white tracking-tight uppercase italic">{q.text}</h3>
                    </div>
                  </div>
                );
              }
              questionCounter++;
              const isAns = answers[idx] !== undefined;
              const isRev = revealed[idx];
              const userVal = answers[idx];

              return (
                <div key={idx} id={`q-card-${idx}`} className={`p-6 md:p-10 rounded-[2.5rem] bg-slate-900 border transition-all duration-500 shadow-2xl ${isAns ? (checkCorrect(q, userVal) ? 'border-green-500/30' : 'border-red-500/30') : 'border-slate-800'}`}>
                  <div className="mb-6 flex justify-between items-center">
                    <div className="bg-slate-800 text-blue-400 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-700">
                      Question {questionCounter}
                    </div>
                    {isAns && (
                      <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${checkCorrect(q, userVal) ? 'text-green-500' : 'text-red-500'}`}>
                        {checkCorrect(q, userVal) ? <CheckCircle2 className="w-3 h-3"/> : <X className="w-3 h-3"/>}
                        {checkCorrect(q, userVal) ? 'Correct' : 'Incorrect'}
                      </span>
                    )}
                  </div>
                  <p className="text-xl md:text-2xl font-medium text-white mb-8 whitespace-pre-line leading-relaxed">{q.question}</p>

                  {(q.type === 'mcq' || q.type === 'tf') && (
                    <div className="space-y-3">
                      {q.options.map((opt, oIdx) => {
                        const isCorrectOpt = q.correctAnswerIndex === oIdx;
                        const isSelected = userVal === oIdx;
                        let style = "bg-slate-800 border-slate-700 hover:border-blue-500/50";
                        if (isAns || isRev) {
                          if (isCorrectOpt) style = "bg-green-900/30 border-green-500 text-green-400 font-bold";
                          else if (isAns && isSelected) style = "bg-red-900/30 border-red-500 text-red-400 font-bold";
                          else style = "opacity-30 border-slate-800";
                        }
                        return (
                          <button key={oIdx} disabled={isAns} onClick={() => { setAnswers({...answers, [idx]: oIdx}); if(!isAns) setTimeout(() => scrollToNext(idx), 600); }} className={`w-full text-left p-5 rounded-2xl border transition-all flex justify-between items-center group ${style}`}>
                            <span>{opt}</span>
                            {(isAns || isRev) && isCorrectOpt && <CircleCheck className="w-5 h-5 text-green-400" />}
                            {isAns && isSelected && !isCorrectOpt && <CircleX className="w-5 h-5 text-red-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'matching' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-px bg-slate-800 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-inner">
                        <div className="flex flex-col bg-slate-900">
                          {q.colA.map((item, aIdx) => {
                            const match = isAns ? userVal[aIdx] : (matchTemp[idx] || {})[aIdx];
                            return (
                              <button key={aIdx} onClick={() => !isAns && setMatchSelectedA({...matchSelectedA, [idx]: matchSelectedA[idx] === aIdx ? null : aIdx})} className={`p-4 text-left border-b border-slate-800 min-h-[80px] flex items-center justify-between transition-colors ${matchSelectedA[idx] === aIdx ? 'bg-blue-600/20' : 'hover:bg-slate-800/30'}`}>
                                <span className="text-sm font-medium">{item.id}. {item.text}</span>
                                {match !== undefined && (
                                  <div className="flex items-center gap-1">
                                    <span className="bg-blue-500 text-[10px] font-black px-2 py-0.5 rounded">{q.colB[match]?.letter}</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex flex-col bg-slate-900 border-l border-slate-800">
                          {q.colB.map((item, bIdx) => {
                            const isUsed = Object.values(matchTemp[idx] || {}).includes(bIdx);
                            return (
                              <button key={bIdx} onClick={() => {
                                if (isAns || matchSelectedA[idx] === null || matchSelectedA[idx] === undefined) return;
                                const currentA = matchSelectedA[idx];
                                const updated = { ...(matchTemp[idx] || {}) };
                                updated[currentA] = bIdx;
                                setMatchTemp({...matchTemp, [idx]: updated});
                                setMatchSelectedA({...matchSelectedA, [idx]: null});
                              }} className={`p-4 text-left border-b border-slate-800 min-h-[80px] flex items-center transition-all ${isUsed && !isAns ? 'opacity-30 grayscale' : 'hover:bg-slate-800/30'}`}>
                                <span className="text-sm font-bold text-blue-400 mr-2">{item.letter})</span>
                                <span className="text-sm font-medium">{item.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {!isAns && (
                        <button onClick={() => { setAnswers({...answers, [idx]: matchTemp[idx]}); setTimeout(() => scrollToNext(idx), 600); }} className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 transition-all shadow-xl"><ClipboardCheck className="w-4 h-4" /> Submit Match Set</button>
                      )}
                    </div>
                  )}

                  {q.type === 'fib' && (
                    <div className="space-y-4">
                      <form onSubmit={(e) => { e.preventDefault(); const val = (fibInput[idx] || "").trim(); if(val){ setAnswers({...answers, [idx]: val}); setTimeout(()=>scrollToNext(idx), 600); } }}>
                        <input id={`fib-inp-${idx}`} type="text" disabled={isAns} value={fibInput[idx] || ""} onChange={(e)=>setFibInput({...fibInput, [idx]: e.target.value})} placeholder="Type answer and press Enter..." className="w-full p-6 bg-slate-950 rounded-2xl border-2 border-slate-800 focus:border-blue-500 outline-none text-xl font-bold transition-all" />
                      </form>
                    </div>
                  )}

                  {(isAns || isRev) && (q.type === 'fib' || q.type === 'matching') && (
                    <div className="p-5 mt-6 bg-slate-800/50 rounded-2xl border border-slate-700">
                      <div className="flex items-start gap-3">
                        <Eye className="text-blue-400 w-5 h-5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Answer Key</p>
                          {q.type === 'matching' ? (
                            <div className="space-y-1">
                              {q.colA.map((item, aIdx) => (
                                <p key={aIdx} className="text-sm text-white">{item.text} → {q.colB[q.correctMatches[aIdx] ?? q.correctMatches[String(aIdx)]]?.text}</p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-lg text-white">{q.answerText}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-center pt-10">
              <button onClick={() => setView('results')} className="px-16 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-black uppercase shadow-2xl transition-all flex items-center gap-3">Finish <Trophy className="w-6 h-6 text-yellow-400" /></button>
            </div>
          </div>
        )}

        {/* VIEW: RESULTS */}
        {view === 'results' && (
          <div className="bg-slate-900 p-10 rounded-[3rem] text-center border border-slate-800 shadow-2xl">
            <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-6" />
            <h2 className="text-4xl font-black text-white mb-8 uppercase italic">Complete</h2>
            <div className="grid grid-cols-2 gap-4 mb-10 text-center">
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase">Score</p>
                <p className="text-5xl font-black text-white">{calculateScore()} / {totalQuestions}</p>
              </div>
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                <p className="text-[10px] font-black text-slate-500 uppercase">Accuracy</p>
                <p className="text-5xl font-black text-blue-500">{totalQuestions > 0 ? Math.round((calculateScore()/totalQuestions)*100) : 0}%</p>
              </div>
            </div>
            <button onClick={() => setView('menu')} className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase transition-all">Home</button>
          </div>
        )}

        {/* VIEW: IMPORT */}
        {view === 'import' && (
          <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Wand2 className="text-blue-500 w-6 h-6" />
              <h2 className="text-2xl font-black text-white uppercase italic">Import</h2>
            </div>
            <input type="text" value={moduleName} onChange={(e)=>setModuleName(e.target.value)} placeholder="Module Name..." className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 mb-4 font-bold outline-none focus:border-blue-500 transition-all text-white" />
            <textarea value={rawInput} onChange={(e)=>setRawInput(e.target.value)} placeholder="Paste text here..." className="w-full h-80 p-6 bg-slate-950 rounded-3xl border border-slate-800 font-mono text-xs mb-6 outline-none focus:border-blue-500 transition-all text-slate-300" />
            
            {isProcessing && (
              <div className="w-full mb-6">
                <div className="flex justify-between text-[10px] font-black text-blue-500 uppercase mb-2">
                  <span>AI Parsing...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleAI_Import} disabled={isProcessing || !rawInput} className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase shadow-xl disabled:opacity-50 flex items-center justify-center gap-3">
                {isProcessing ? "Processing..." : isSuccess ? "Success!" : "Generate Module"}
              </button>
              <button onClick={() => setView('menu')} className="px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase">Cancel</button>
            </div>
          </div>
        )}

        {/* VIEW: EDIT MODULE (NOTEPAD MODE) */}
        {view === 'edit' && editingModule && (
          <div className="bg-slate-900 p-6 md:p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white uppercase italic">Notepad Editor</h2>
              <div className="hidden md:block text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
                {'Format: Question: → Answer: / Options: / -->'}
              </div>
            </div>

            <textarea
              value={plainText}
              onChange={(e) => setPlainText(e.target.value)}
              className="w-full h-[500px] bg-slate-950 text-white p-8 rounded-[2rem] border border-slate-800 font-medium text-lg mb-8 outline-none focus:border-blue-500 transition-all leading-relaxed resize-none"
              placeholder="Question: What is 2+2?&#10;Answer: 4"
            />

            <div className="flex gap-3">
              <button onClick={saveNotepadChanges} className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                <Save className="w-5 h-5" /> Save All Changes
              </button>
              <button onClick={() => { setView('menu'); setEditingModule(null); }} className="md:px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase transition-all">Cancel</button>
            </div>
          </div>
        )}

        {/* DELETE CONFIRMATION OVERLAY */}
        {showConfirm && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-200">
              <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 text-white">Delete Module?</h3>
              <p className="text-slate-400 text-sm mb-8">This will permanently remove <span className="text-white font-bold">"{showConfirm}"</span> from your device.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold uppercase text-xs text-white transition-colors">Cancel</button>
                <button onClick={handleDeleteConfirm} className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold uppercase text-xs text-white transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)]">Delete</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}