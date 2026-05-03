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

// --- THE SMART PARSER ENGINE ---
const parseRawText = (text) => {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const questions = [];
  let currentQ = null;
  let inMatchingKey = false;
  let currentColumn = null;
  let colACounter = 1;
  let activeTarget = 'question';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.startsWith('###')) {
      if (currentQ) questions.push(currentQ);
      questions.push({ type: 'header', text: line.replace(/^###\s*/, '') });
      currentQ = null;
      inMatchingKey = false;
      currentColumn = null;
      continue;
    }

    if (currentQ && currentQ.type === 'matching') {
      if (line.toLowerCase().startsWith('answer key:')) {
        inMatchingKey = true;
        currentColumn = null;
        continue;
      }
      
      if (line.toLowerCase().includes('column a:')) {
        currentColumn = 'A';
        continue;
      }
      if (line.toLowerCase().includes('column b:')) {
        currentColumn = 'B';
        continue;
      }
      
      if (inMatchingKey) {
        const keyMatch = line.match(/(.*?)\s*[-:]\s*([A-E])(?:\s|$|:)/i);
        if (keyMatch) {
          const leftPart = keyMatch[1].trim().toLowerCase();
          const letter = keyMatch[2].toUpperCase();
          
          let aIdx = currentQ.colA.findIndex(item => leftPart.startsWith(item.id) || item.id === leftPart);
          if (aIdx === -1) aIdx = currentQ.colA.findIndex(item => item.text.toLowerCase().includes(leftPart) || leftPart.includes(item.text.toLowerCase()));
          const bIdx = currentQ.colB.findIndex(item => item.letter === letter);
          
          if (aIdx !== -1 && bIdx !== -1) currentQ.correctMatches[aIdx] = bIdx;
          continue; 
        }
      } else {
        const aMatch = line.match(/^(\d+)[\.\)]\s*(.*)/);
        const bMatch = line.match(/^([A-E])[\)\.]\s*(.*)/i);
        
        if (aMatch && !line.toLowerCase().includes('match the items')) {
          currentQ.colA.push({ id: aMatch[1], text: aMatch[2] });
          colACounter = parseInt(aMatch[1], 10) + 1;
          continue; 
        } else if (bMatch) {
          currentQ.colB.push({ letter: bMatch[1].toUpperCase(), text: bMatch[2] });
          continue;
        } else if (currentColumn === 'A' && line.trim()) {
          currentQ.colA.push({ id: String(colACounter), text: line });
          colACounter++;
          continue;
        }
      }
    }

    const qMatch = line.match(/^(\d+)[\.\)]\s*(.*)/);
    if (qMatch) {
      if (currentQ) questions.push(currentQ);
      const questionText = qMatch[2];
      
      if (questionText.toLowerCase().includes('match the items')) {
        currentQ = { id: qMatch[1], question: questionText, type: 'matching', colA: [], colB: [], correctMatches: {}, answerText: 'Matching', options: [] };
        colACounter = 1;
      } else {
        currentQ = { id: qMatch[1], question: questionText, type: 'fib', options: [], answerText: '' };
      }
      inMatchingKey = false;
      currentColumn = null;
      activeTarget = 'question';
      continue;
    }

    if (!currentQ) continue;

    const optMatch = line.match(/^([A-E])[\)\.]\s*(.*)/i);
    if (optMatch && currentQ.type !== 'matching') {
      currentQ.type = 'mcq';
      currentQ.options.push(line);
      activeTarget = 'option';
      continue;
    }

    const ansMatch = line.match(/^(?:Answer|Ans|Correct|Result)\s*[:\-]\s*(.*)/i);
    if (ansMatch) {
      const val = ansMatch[1].trim();
      currentQ.answerText = val;
      if (currentQ.type === 'mcq') {
        const letter = val.charAt(0).toUpperCase();
        const idx = currentQ.options.findIndex(o => o.toUpperCase().startsWith(letter));
        if (idx !== -1) currentQ.correctAnswerIndex = idx;
      } else if (/^(true|false)$/i.test(val)) {
        currentQ.type = 'tf';
        currentQ.options = ["True", "False"];
        currentQ.correctAnswerIndex = val.toLowerCase() === 'true' ? 0 : 1;
      }
      activeTarget = 'answer';
      continue;
    }

    if (activeTarget === 'question') currentQ.question += ' ' + line;
    else if (activeTarget === 'option' && currentQ.options.length > 0) {
      currentQ.options[currentQ.options.length - 1] += ' ' + line;
    }
  }

  if (currentQ) questions.push(currentQ);
  return questions;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [sections, setSections] = useState({});
  const [view, setView] = useState('menu'); 
  const [activeSection, setActiveSection] = useState(null);
  const [rawInput, setRawInput] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [showConfirm, setShowConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [answers, setAnswers] = useState({}); 
  const [fibInput, setFibInput] = useState({}); 
  const [revealed, setRevealed] = useState({});
  const [matchSelectedA, setMatchSelectedA] = useState({}); 
  const [matchTemp, setMatchTemp] = useState({}); 

  const questions = activeSection ? (sections[activeSection] || []) : [];
  const unsubscribeRef = useRef(null);

  // --- 1. INIT: Handles Local VS Code vs Cloud environments ---
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

  // --- 2. DATA SYNC (Cloud Only) ---
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
      console.log("Cloud sync access restricted (using local storage instead):", err.message);
    });

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [user]);

  const handleAutoClean = () => {
    if (!rawInput) return;
    let text = rawInput;

    // --- AGGRESSIVE DE-SQUISHER FOR PDFs ---
    text = text.replace(/(Column A\s*:)/gi, "\n$1\n");
    text = text.replace(/(Column B\s*:)/gi, "\n$1\n");
    text = text.replace(/(Answer Key\s*:)/gi, "\n$1\n");

    text = text.replace(/\s+([A-E]\))\s*/g, "\n$1 ");
    text = text.replace(/^([A-E]\))\s*/gm, "$1 "); 

    text = text.replace(/\s+(\d+[\.\)])\s*([a-zA-Z])/g, "\n$1 $2");
    text = text.replace(/^(\d+[\.\)])\s*([a-zA-Z])/gm, "$1 $2"); 

    text = text.replace(/Page\s+\d+\s+of\s+\d+/gi, "");
    text = text.replace(/^\d+\s+\/\s+\d+$/gm, "");
    text = text.replace(/MEO Class III.*Question bank/gi, "");

    text = text.replace(/([^\n])\s+(Answer\s*[:\-]\s*)/gim, "$1\n$2");
    text = text.replace(/^(?:\w+\.\s+)?(?:Ans|Correct|Result)\s*[:\-]/gim, "Answer:");
    text = text.replace(/^[a-z•\-\*][\.\)]?\s*Answer\s*[:\-]/gim, "Answer:");
    text = text.replace(/^Answer:\s*(T|F)$/gim, (m, p1) => `Answer: ${p1 === 'T' ? 'True' : 'False'}`);
    
    let lines = text.split('\n').map(l => l.trim()).filter(l => l);
    let numberedOutput = [];
    let qIdx = 1;
    let inMatching = false;
    let inMatchingKey = false;
    let currentColumn = null;
    let colACounter = 1;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      if (line.startsWith('###')) {
         numberedOutput.push("\n" + line);
         qIdx = 1;
         inMatching = false;
         inMatchingKey = false;
         currentColumn = null;
         continue;
      }

      if (line.toLowerCase().includes('match the items')) {
         inMatching = true;
         inMatchingKey = false;
         currentColumn = null;
         colACounter = 1;
         line = line.replace(/^(\d+[\.\)]\s*)+/, ''); 
         numberedOutput.push(`\n${qIdx}. ${line}`);
         qIdx++;
         continue;
      }

      if (inMatching) {
         if (line.toLowerCase().startsWith('column a')) {
            currentColumn = 'A';
            numberedOutput.push(line);
            continue;
         }
         if (line.toLowerCase().startsWith('column b')) {
            currentColumn = 'B';
            numberedOutput.push(line);
            continue;
         }
         if (line.toLowerCase().includes('answer key:')) {
            inMatchingKey = true;
            currentColumn = null;
            numberedOutput.push(line);
            continue;
         }
         
         if (/^Answer\s*[:\-]/i.test(line)) {
            inMatching = false;
         } else if (inMatchingKey) {
            if (!line.match(/(.*?)\s*[-:]\s*([A-E])(?:\s|$|:)/i) && line.match(/^(\d+)[\.\)]\s*(.*)/)) {
               inMatching = false; 
            } else {
               numberedOutput.push(line);
               continue;
            }
         } else {
            if (currentColumn === 'A') {
               const aMatch = line.match(/^(\d+)[\.\)]\s*(.*)/);
               if (aMatch) {
                   numberedOutput.push(`${aMatch[1]}. ${aMatch[2]}`);
                   colACounter = parseInt(aMatch[1], 10) + 1;
               } else {
                   numberedOutput.push(`${colACounter}. ${line}`);
                   colACounter++;
               }
               continue;
            }
            numberedOutput.push(line);
            continue;
         }
      }

      const isOption = /^[A-E][\)\.]/i.test(line);
      const isAnswer = /^Answer\s*[:\-]/i.test(line);
      const isPotentialHeader = !isOption && !isAnswer && line.length > 2 && line.length < 50 && !line.includes('_') && !line.includes('.') && !line.includes('?') && !line.includes(':');

      if (isPotentialHeader) {
          numberedOutput.push("\n### " + line);
          qIdx = 1;
          continue;
      }

      if (!isOption && !isAnswer) {
        line = line.replace(/^(\d+[\.\)]\s*)+/, '');
        numberedOutput.push(`\n${qIdx}. ${line}`);
        qIdx++;
      } else {
        numberedOutput.push(line);
      }
    }
    setRawInput(numberedOutput.join('\n').trim());
  };

  const handleImport = async () => {
    const name = moduleName.trim() || `Module ${Object.keys(sections).length + 1}`;
    const parsed = parseRawText(rawInput);
    
    if (parsed.length > 0) {
      const newSections = { ...sections, [name]: parsed };
      setSections(newSections);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSections));
      
      setRawInput(''); setModuleName(''); setView('menu');

      if (!isLocalDev && user && db && appId) {
        try {
          const safeDocId = getSafeDocId(name);
          const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'modules', safeDocId);
          await setDoc(docRef, {
            displayName: name,
            content: JSON.stringify(parsed),
            updatedAt: Date.now()
          });
        } catch (err) {
          console.log("Background Cloud Save Restricted:", err.message);
        }
      }
    } else {
      alert("No questions detected. Please ensure you clicked 'Auto-Clean Format' first.");
    }
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
        {view === 'menu' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-500">
            {Object.keys(sections).map(name => (
              <div key={name} className="relative group bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-blue-500 transition-all cursor-pointer shadow-lg" onClick={() => {setActiveSection(name); setAnswers({}); setView('quiz'); window.scrollTo(0,0);}}>
                <h3 className="text-lg font-bold text-white mb-1 pr-16">{name}</h3>
                <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{sections[name].filter(q => q.type !== 'header').length} Questions</p>
                <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); setShowConfirm(name); }} className="text-slate-400 hover:text-red-500 p-2 bg-slate-950 rounded-lg border border-slate-800 hover:border-red-500/50 transition-all shadow-xl" title="Delete Module"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            <button onClick={() => {setRawInput(''); setModuleName(''); setView('import');}} className="p-10 border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 hover:text-blue-400 hover:border-blue-500/50 font-black uppercase text-xs transition-all flex flex-col items-center gap-2 group">
              <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" /> Add New Module
            </button>
          </div>
        )}

        {view === 'quiz' && (
          <div className="space-y-12 pb-40 animate-in slide-in-from-right-4 duration-300">
            <h2 className="text-3xl font-black text-white border-b border-slate-800 pb-4 tracking-tight uppercase italic">{activeSection}</h2>
            {questions.map((q, idx) => {
              if (q.type === 'header') {
                questionCounter = 0; 
                return (
                  <div key={idx} className="pt-10 pb-4 border-l-4 border-blue-600 pl-6 bg-slate-900/50 rounded-r-2xl shadow-lg border border-slate-800">
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
                          if (isCorrectOpt) style = (q.type === 'tf' && !isSelected && isAns) ? "opacity-30 border-slate-800" : "bg-green-900/30 border-green-500 text-green-400 font-bold shadow-[0_0_20px_rgba(34,197,94,0.1)]";
                          else if (isAns && isSelected) style = "bg-red-900/30 border-red-500 text-red-400 font-bold";
                          else style = "opacity-30 border-slate-800";
                        }
                        return (
                          <button key={oIdx} disabled={isAns} onClick={() => { setAnswers({...answers, [idx]: oIdx}); if(!isAns) setTimeout(() => scrollToNext(idx), 600); }} className={`w-full text-left p-5 rounded-2xl border transition-all flex justify-between items-center group ${style}`}>
                            <span>{opt}</span>
                            {(isAns || isRev) && isCorrectOpt && (q.type === 'mcq' || isSelected || isRev) && <CircleCheck className="w-5 h-5 text-green-400" />}
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
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <span className="bg-blue-500 text-[10px] font-black px-2 py-0.5 rounded shadow-lg">{q.colB[match]?.letter}</span>
                                    {!isAns && (
                                      <div 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const updated = { ...(matchTemp[idx] || {}) };
                                          delete updated[aIdx];
                                          setMatchTemp({...matchTemp, [idx]: updated});
                                          if (matchSelectedA[idx] === aIdx) {
                                              setMatchSelectedA({...matchSelectedA, [idx]: null});
                                          }
                                        }} 
                                        className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-full transition-colors"
                                        title="Remove this match"
                                      >
                                        <X className="w-3 h-3" />
                                      </div>
                                    )}
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
                                Object.keys(updated).forEach(k => { if(updated[k] === bIdx) delete updated[k]; });
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
                        <div className="flex flex-col sm:flex-row gap-2 w-full mt-4">
                          <button onClick={() => { setAnswers({...answers, [idx]: matchTemp[idx]}); setTimeout(() => scrollToNext(idx), 600); }} className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/20 flex items-center justify-center gap-2 transition-all"><ClipboardCheck className="w-4 h-4" /> Submit Match Set</button>
                          <button onClick={() => { setMatchTemp({...matchTemp, [idx]: {}}); setMatchSelectedA({...matchSelectedA, [idx]: null}); }} className="px-6 py-5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all" title="Clear all matches"><RotateCcw className="w-4 h-4" /> Clear All</button>
                        </div>
                      )}
                    </div>
                  )}

                  {q.type === 'fib' && (
                    <div className="space-y-4">
                      <form onSubmit={(e) => { e.preventDefault(); const val = (fibInput[idx] || "").trim(); if(val){ setAnswers({...answers, [idx]: val}); setTimeout(()=>scrollToNext(idx), 600); } else setRevealed({...revealed, [idx]: !isRev}); }}>
                        <input id={`fib-inp-${idx}`} type="text" disabled={isAns} value={fibInput[idx] || ""} onChange={(e)=>setFibInput({...fibInput, [idx]: e.target.value})} placeholder="Type answer and press Enter..." className={`w-full p-6 bg-slate-950 rounded-2xl border-2 outline-none transition-all text-xl font-bold ${isAns ? (checkCorrect(q, userVal) ? 'border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]') : (isRev ? 'border-blue-500 shadow-blue-500/10' : 'border-slate-800 focus:border-blue-500')}`} />
                      </form>
                    </div>
                  )}

                  {/* UNIVERSAL OFFICIAL ANSWER BLOCK */}
                  {(isAns || isRev) && (q.type === 'fib' || q.type === 'matching') && (
                    <div className="p-5 mt-6 bg-slate-800/50 rounded-2xl border border-slate-700 flex items-start gap-3 animate-in slide-in-from-top-2">
                      <Eye className="text-blue-400 w-5 h-5 shrink-0 mt-0.5" />
                      <div className="w-full">
                        <div className="flex justify-between items-center mb-4">
                           <p className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">Official Answer Key</p>
                           {q.type === 'matching' && isAns && (
                              <button onClick={() => {
                                 const newAns = {...answers}; delete newAns[idx]; setAnswers(newAns);
                                 const newTemp = {...matchTemp}; delete newTemp[idx]; setMatchTemp(newTemp);
                                 setRevealed({...revealed, [idx]: false});
                                 setMatchSelectedA({...matchSelectedA, [idx]: null});
                              }} className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase flex items-center gap-1 transition-colors"><RotateCcw className="w-3 h-3" /> Retry Match</button>
                           )}
                        </div>
                        {q.type === 'matching' ? (
                          <div className="space-y-2">
                            {q.colA.map((item, aIdx) => {
                              const correctBIdx = q.correctMatches[aIdx] ?? q.correctMatches[String(aIdx)];
                              const correctB = q.colB[correctBIdx];
                              const isUserCorrect = isAns && userVal && userVal[aIdx] === correctBIdx;
                              return (
                                <div key={aIdx} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm p-3 rounded-xl border ${isAns ? (isUserCorrect ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30') : 'bg-slate-900/50 border-slate-800'}`}>
                                  <div className="flex items-center gap-2 flex-1">
                                     {isAns && (isUserCorrect ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <X className="w-4 h-4 text-red-500 shrink-0" />)}
                                     <span className="text-white font-medium"><span className="text-slate-500 mr-2">{item.id}.</span>{item.text}</span>
                                  </div>
                                  <ArrowRightLeft className="w-4 h-4 text-blue-500 shrink-0 hidden sm:block opacity-50" />
                                  <div className="flex items-center gap-2 flex-1 pl-6 sm:pl-0">
                                     <span className="text-blue-400 font-black shrink-0">{correctB?.letter})</span>
                                     <span className="text-slate-300">{correctB?.text}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <span className="font-mono text-lg text-white break-all">{q.answerText}</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {!isAns && (
                    <div className="mt-4 flex justify-end">
                      <button onClick={() => setRevealed({...revealed, [idx]: !isRev})} className="text-[10px] font-bold text-slate-600 hover:text-blue-400 flex items-center gap-1 uppercase tracking-widest transition-colors">
                        <Eye className="w-3 h-3"/> {isRev ? 'Hide Answer' : 'Show Answer'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-center pt-20">
              <button onClick={() => setView('results')} className="px-16 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-black uppercase shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3">
                Finish Exam <Trophy className="w-6 h-6 text-yellow-400" />
              </button>
            </div>
          </div>
        )}

        {/* VIEW: RESULTS */}
        {view === 'results' && (
          <div className="bg-slate-900 p-10 md:p-20 rounded-[3rem] text-center border border-slate-800 shadow-2xl animate-in zoom-in">
            <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-6 drop-shadow-[0_0_20px_rgba(234,179,8,0.3)]" />
            <h2 className="text-4xl font-black text-white mb-8 tracking-tight italic uppercase leading-none">Module Complete</h2>
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner">
                <p className="text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Final Score</p>
                <p className="text-5xl font-black text-white">{calculateScore()} <span className="text-lg text-slate-800">/ {totalQuestions}</span></p>
              </div>
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 shadow-inner">
                <p className="text-[10px] font-black text-slate-500 mb-2 uppercase tracking-widest">Accuracy</p>
                <p className="text-5xl font-black text-blue-500">{totalQuestions > 0 ? Math.round((calculateScore()/totalQuestions)*100) : 0}%</p>
              </div>
            </div>
            <button onClick={() => setView('menu')} className="w-full py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95">Modules Home</button>
          </div>
        )}

        {/* VIEW: IMPORT */}
        {view === 'import' && (
          <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl animate-in slide-in-from-bottom duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-2xl"><Upload className="text-blue-500" /></div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase italic leading-none mb-1">Import Module</h2>
                  <p className="text-slate-500 text-[10px] font-bold tracking-tight italic flex items-center gap-1">
                    {isLocalDev ? <HardDrive className="w-3 h-3 text-blue-400" /> : <ShieldCheck className="w-3 h-3 text-green-400" />}
                    {isLocalDev ? "LOCAL STORAGE MODE" : "CLOUD SYNC ACTIVE"}
                  </p>
                </div>
              </div>
              <button onClick={handleAutoClean} className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-blue-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase transition-all shadow-lg border border-slate-700 hover:border-blue-400">
                <Wand2 className="w-4 h-4" /> Auto-Clean Format
              </button>
            </div>
            
            <div className="mb-4 bg-blue-500/5 border border-blue-500/20 p-4 rounded-2xl flex gap-3 items-start">
               <FileSearch className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
               <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong className="text-blue-400">PDF Pro-Tip:</strong> Paste your unformatted text below and hit <strong className="text-blue-300">Auto-Clean</strong>. It will automatically detect category titles, isolate inline answers, and apply sequential numbering perfectly.
               </p>
            </div>

            <input type="text" value={moduleName} onChange={(e)=>setModuleName(e.target.value)} placeholder="Enter Module Name" className="w-full p-5 bg-slate-950 rounded-2xl border border-slate-800 mb-4 font-bold outline-none focus:border-blue-500 transition-all placeholder:text-slate-800 text-white" />
            <textarea value={rawInput} onChange={(e)=>setRawInput(e.target.value)} placeholder="Paste raw text here..." className="w-full h-80 p-6 bg-slate-950 rounded-3xl border border-slate-800 font-mono text-xs mb-6 outline-none focus:border-blue-500 transition-all leading-relaxed placeholder:text-slate-800 text-slate-300" />
            
            <div className="flex flex-col md:flex-row gap-3">
              <button onClick={handleImport} className="flex-1 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase shadow-xl transition-all active:scale-[0.98]">Generate Module</button>
              <button onClick={() => setView('menu')} className="md:px-10 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase transition-all active:scale-[0.98]">Cancel</button>
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