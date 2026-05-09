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
  Key,
  Settings,
  Sun,
  Moon,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  Cloud
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
// Updated imports for Google Auth
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import LiteYouTubeEmbed from 'react-lite-youtube-embed';
import 'react-lite-youtube-embed/dist/LiteYouTubeEmbed.css';

const t = {
  en: {
    appTitle: "QUIZ LAB PRO",
    modulesHome: "Modules Home",
    addNewModule: "Add New Module",
    addNewFolder: "Add New Folder",
    questions: "Questions",
    generateBtn: "Generate Module",
    cancelBtn: "Cancel",
    correct: "Correct",
    incorrect: "Incorrect",
    showAnswer: "Show Answer",
    hideAnswer: "Hide Answer",
    textImport: "Text Import",
    poweredBy: "POWERED BY Yadanar",
    aiParserActive: "How to use :",
    aiParserDesc: "Paste your raw, unformatted PDF or Word document text below. The AI will automatically structure the questions, detect answer keys, and build your interactive module, gonna take 1 to 2 minutes.",
    moduleNamePlaceholder: "Enter Module Name (e.g. Chapter 1)",
    folderPlaceholder: "Type or select a folder...",
    pasteRawTextPlaceholder: "Paste raw text here...",
    processingComplete: "Processing Complete!",
    aiAnalysisInProgress: "AI Analysis in Progress...",
    errorGeneric: "System error. Please wait a minute and try again.",
    settings: "Settings",
    privateLimitsActive: "Private Limits Active",
    privateKeyActiveDesc: "You are currently using your own Gemini API key. The community daily limits have been successfully bypassed.",
    privateApiKey: "Private API Key",
    removeKey: "Remove Key",
    pasteKey: "Paste custom Gemini key...",
    keyPrivacyDesc: "Bypass community limits. Saved locally on your device. Never shared.",
    chunkingData: "Initializing parsing sequence...",
    parsedSuccessfully: "Questions successfully parsed!",
    deleteModule: "Delete Module?",
    deleteWarning: "This will permanently remove this module from your device.",
    deleteBtn: "Delete",
    questionLabel: "Question",
    finishExam: "Finish Exam",
    moduleComplete: "Module Complete",
    finalScore: "Final Score",
    accuracy: "Accuracy",
    submitMatch: "Submit Match Set",
    clearAll: "Clear All",
    typeAnswer: "Type answer and press Enter...",
    officialAnswer: "Official Answer",
    retry: "Retry",
    loading: "Loading Workspace...",
    videoGuideTitle: "Video Guide: How to get your Key",
    freeTierBusy: "Free Server is Busy/Limited",
    freeTierBusyDesc: "The community server is currently at its speed limit. To continue parsing immediately without waiting, please add your own private API key.",
    selectFolderTitle: "Select or Create Folder",
    selectExistingFolder: "Select existing folder...",
    orCreateNew: "OR CREATE NEW",
    continueBtn: "Continue",
    folderLabel: "Adding to Folder:",
    changeFolder: "Change",
    deleteFolderTitle: "Delete Folder?",
    deleteFolderWarning: "This will permanently delete this folder and ALL modules inside it. Are you sure?",
    folderHint: "Tip: You can create new folders during the import process!",
    renameExists: "A module with this name already exists.",
    clickToStart: "Click to start importing modules",
    cloudSyncTitle: "Cloud Sync",
    accountLinked: "Account Linked",
    logoutBtn: "Logout",
    signInGoogle: "Sign in with Google to Sync Devices",
  },
  mm: {
    appTitle: "QUIZ LAB PRO",
    modulesHome: "ပင်မစာမျက်နှာ",
    addNewModule: "မော်ဂျူးအသစ်ထည့်ပါ",
    addNewFolder: "ဖိုင်တွဲအသစ်ထည့်ပါ",
    questions: "မေးခွန်းများ",
    generateBtn: "မော်ဂျူး ဖန်တီးပါ",
    cancelBtn: "ပယ်ဖျက်မည်",
    correct: "မှန်ပါတယ်",
    incorrect: "မှားပါတယ်",
    showAnswer: "အဖြေကြည့်မည်",
    hideAnswer: "အဖြေဖျောက်မည်",
    textImport: "စာသား ထည့်သွင်းရန်",
    poweredBy: "Yadanar မှ ပံ့ပိုးသည်",
    aiParserActive: "အသုံးပြုနည်း :",
    aiParserDesc: "PDF သို့မဟုတ် Word မှ စာသားများကို အောက်တွင် ကူးထည့်ပါ။ AI မှ မေးခွန်းများ၊ အဖြေများကို အလိုအလျောက် ခွဲခြားပေးပါမည်။ ၁ မိနစ်မှ ၂ မိနစ်ခန့် ကြာနိုင်ပါသည်။",
    moduleNamePlaceholder: "မော်ဂျူးအမည် ထည့်ပါ (ဥပမာ - Chapter 1)",
    folderPlaceholder: "ဖိုင်တွဲ ရွေးပါ သို့မဟုတ် အမည်ရိုက်ထည့်ပါ...",
    pasteRawTextPlaceholder: "စာသားများကို ဤနေရာတွင် ကူးထည့်ပါ...",
    processingComplete: "လုပ်ဆောင်မှု ပြီးစီးပါပြီ!",
    aiAnalysisInProgress: "AI မှ ခွဲခြမ်းစိတ်ဖြာနေပါသည်...",
    errorGeneric: "စနစ် အလုပ်လုပ်ရာတွင် အခက်အခဲရှိနေပါသည်။ ခေတ္တစောင့်၍ ပြန်လည်ကြိုးစားပါ။",
    settings: "ဆက်တင်များ",
    privateLimitsActive: "ကိုယ်ပိုင် API ဖြင့် အသုံးပြုနေပါသည်",
    privateKeyActiveDesc: "သင့်ကိုယ်ပိုင် Gemini API key ကို အသုံးပြုနေပါသည်။ နေ့စဉ် အခမဲ့အသုံးပြုခွင့် ကန့်သတ်ချက်များကို ကျော်ဖြတ်ပြီးပါပြီ။",
    privateApiKey: "ကိုယ်ပိုင် API Key",
    removeKey: "Key ကို ဖယ်ရှားမည်",
    pasteKey: "Gemini API key ကို ဤနေရာတွင် ကူးထည့်ပါ...",
    keyPrivacyDesc: "ကန့်သတ်ချက်များကို ကျော်ဖြတ်ပါ။ သင့်စက်တွင်သာ သိမ်းဆည်းထားပြီး မည်သူနှင့်မျှ မျှဝေမည်မဟုတ်ပါ။",
    chunkingData: "အချက်အလက်များကို ပြင်ဆင်နေပါသည်...",
    parsedSuccessfully: "မေးခွန်းများကို အောင်မြင်စွာ ဖန်တီးပြီးပါပြီ!",
    deleteModule: "မော်ဂျူးကို ဖျက်မည်လား?",
    deleteWarning: "ဤမော်ဂျူးကို သင့်စက်မှ အပြီးတိုင် ဖျက်ပစ်ပါမည်။",
    deleteBtn: "ဖျက်မည်",
    questionLabel: "မေးခွန်း",
    finishExam: "စာမေးပွဲ အဆုံးသတ်မည်",
    moduleComplete: "မော်ဂျူး ပြီးဆုံးပါပြီ",
    finalScore: "နောက်ဆုံး ရမှတ်",
    accuracy: "မှန်ကန်မှု ရာခိုင်နှုန်း",
    submitMatch: "ယှဉ်တွဲမှုကို အတည်ပြုမည်",
    clearAll: "အားလုံးကို ဖျက်မည်",
    typeAnswer: "အဖြေကိုရိုက်ထည့်ပြီး Enter ခေါက်ပါ...",
    officialAnswer: "တရားဝင် အဖြေ",
    retry: "ပြန်လည် ကြိုးစားမည်",
    loading: "လုပ်ငန်းခွင်ကို ပြင်ဆင်နေပါသည်...",
    videoGuideTitle: "လမ်းညွှန်ဗီဒီယို - Key ရယူနည်း",
    freeTierBusy: "အခမဲ့ဆာဗာ အလုပ်များနေပါသည်",
    freeTierBusyDesc: "အများသုံးဆာဗာမှာ အသုံးပြုမှုများနေသဖြင့် ခေတ္တစောင့်ဆိုင်းရပါမည်။ တိုက်ရိုက်ဆက်လက်အသုံးပြုလိုပါက သင်၏ ကိုယ်ပိုင် API Key ကို ထည့်သွင်းပါ။",
    selectFolderTitle: "ဖိုင်တွဲ ရွေးပါ သို့မဟုတ် အသစ်ဖန်တီးပါ",
    selectExistingFolder: "ရှိပြီးသား ဖိုင်တွဲကို ရွေးပါ...",
    orCreateNew: "သို့မဟုတ် အသစ်ဖန်တီးပါ",
    continueBtn: "ဆက်လုပ်မည်",
    folderLabel: "ထည့်သွင်းမည့် ဖိုင်တွဲ:",
    changeFolder: "ပြောင်းမည်",
    deleteFolderTitle: "ဖိုင်တွဲကို ဖျက်မည်လား?",
    deleteFolderWarning: "ဤဖိုင်တွဲနှင့် ၎င်းအတွင်းရှိ မော်ဂျူးအားလုံးကို အပြီးတိုင် ဖျက်ပစ်ပါမည်။ သေချာပါသလား?",
    folderHint: "အကြံပြုချက် - မော်ဂျူးထည့်သွင်းစဉ် ဖိုင်တွဲအသစ်များကို ဖန်တီးနိုင်ပါသည်!",
    renameExists: "ဤအမည်ဖြင့် မော်ဂျူး ရှိပြီးသားဖြစ်ပါသည်။",
    clickToStart: "မော်ဂျူးများ ထည့်သွင်းရန် ဤနေရာကို နှိပ်ပါ",
    cloudSyncTitle: "အကောင့်ချိတ်ဆက်ခြင်း (Cloud Sync)",
    accountLinked: "အကောင့်ချိတ်ဆက်ထားပါသည်",
    logoutBtn: "အကောင့်ထွက်မည်",
    signInGoogle: "စက်များအကြား ချိတ်ဆက်ရန် Google ဖြင့် ဝင်ပါ",
  }
};


// --- CRASH-PROOF FIREBASE SETUP ---
// --- CRASH-PROOF FIREBASE SETUP ---
const defaultGeminiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

let isLocalDev = true;
let app = null;
let auth = null;
let db = null;
let appId = 'default-app-id';

try {
  // Spelling fixed!
  const firebaseConfig = {
    apiKey: "AIzaSyCLurB3lXjxtxNZl1cBhagJdBnT6y7rM1E",
    authDomain: "quiz-lab-pro.firebaseapp.com",
    projectId: "quiz-lab-pro",
    storageBucket: "quiz-lab-pro.firebasestorage.app",
    messagingSenderId: "693025508468",
    appId: "1:693025508468:web:878a9e0fa697eb13825521",
    measurementId: "G-TVNG9GQFR4"
  };

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = firebaseConfig.projectId;
  isLocalDev = false;
  console.log("Firebase Connected Successfully!");
  
} catch (error) {
  console.error("Firebase crashed during setup:", error);
}
// ----------------------------------
// ----------------------------------
const STORAGE_KEY = 'meo_prep_pro_v17_stable';
const FOLDER_STORAGE_KEY = 'meo_prep_pro_folders_v1';
const getSafeDocId = (str) => encodeURIComponent(str).replace(/[%.\/]/g, '_') || 'unnamed_module';

export default function App() {
  const [user, setUser] = useState(null);
  const [sections, setSections] = useState({});
  const [moduleFolders, setModuleFolders] = useState({}); 
  const [expandedFolders, setExpandedFolders] = useState({}); 
  
  const [view, setView] = useState('menu'); 
  const [activeSection, setActiveSection] = useState(null);
  const [rawInput, setRawInput] = useState('');
  const [moduleName, setModuleName] = useState('');
  
  // Custom Combobox Workflow States
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [tempFolderInput, setTempFolderInput] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFolderForImport, setSelectedFolderForImport] = useState(''); 
  const [showFolderDeleteConfirm, setShowFolderDeleteConfirm] = useState(null);
  const dropdownRef = useRef(null);

  // Edit States
  const [editingFolder, setEditingFolder] = useState(null);
  const [editFolderInput, setEditFolderInput] = useState('');
  const [editingModule, setEditingModule] = useState(null);
  const [editModuleInput, setEditModuleInput] = useState('');

  const [showConfirm, setShowConfirm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState('en');
  
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme_pref');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  
  const [answers, setAnswers] = useState({}); 
  const [fibInput, setFibInput] = useState({}); 
  const [revealed, setRevealed] = useState({});
  const [matchSelectedA, setMatchSelectedA] = useState({}); 
  const [matchTemp, setMatchTemp] = useState({}); 

  const [userCustomKey, setUserCustomKey] = useState('');
  const [showSettings, setShowSettings] = useState(false); 

  const questions = activeSection ? (sections[activeSection] || []) : [];
  const unsubscribeRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Close combobox when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme_pref', JSON.stringify(isDark));
  }, [isDark]);

  useEffect(() => {
    let interval;
    if (isProcessing && progress < 98) {
      interval = setInterval(() => {
        setProgress(p => p + 0.1);
      }, 50);
    } else if (isSuccess) {
      setProgress(100);
    } else if (!isProcessing) {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing, isSuccess, progress]);

  // Auth Initialization (Updated for Google Sign In)
  useEffect(() => {
    const savedKey = localStorage.getItem('user_gemini_key');
    if (savedKey) setUserCustomKey(savedKey);

    if (isLocalDev || !auth) {
      const savedSec = localStorage.getItem(STORAGE_KEY);
      if (savedSec) setSections(JSON.parse(savedSec));
      
      const savedFol = localStorage.getItem(FOLDER_STORAGE_KEY);
      if (savedFol) setModuleFolders(JSON.parse(savedFol));
      
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    // Load from local storage immediately to prevent flashing while waiting for cloud
    const savedSec = localStorage.getItem(STORAGE_KEY);
    if (savedSec) setSections(JSON.parse(savedSec));
    
    const savedFol = localStorage.getItem(FOLDER_STORAGE_KEY);
    if (savedFol) setModuleFolders(JSON.parse(savedFol));

    return () => unsubscribe();
  }, []);

  // Sync to Cloud automatically if logged in
  useEffect(() => {
    if (isLocalDev || !user || !db || !appId) return;

    const collectionRef = collection(db, 'artifacts', appId, 'users', user.uid, 'modules');
    if (unsubscribeRef.current) unsubscribeRef.current();
    
    unsubscribeRef.current = onSnapshot(collectionRef, (snap) => {
      const newData = {};
      const newFolders = {};
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
        
        const mName = docData.displayName || docSnap.id;
        newData[mName] = parsedQs;
        newFolders[mName] = docData.folderName || 'Saved Modules';
      });
      
      if (Object.keys(newData).length > 0) {
        setSections(prevSections => {
          const newSecs = { ...prevSections, ...newData };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newSecs));
          return newSecs;
        });
        setModuleFolders(prev => {
          const updatedF = { ...prev, ...newFolders };
          localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(updatedF));
          return updatedF;
        });
      }
    });

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [user]);

 
  const handleGoogleLogin = async () => {
    if (!auth) {
      alert("Firebase is not connected! Check your .env config.");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      alert("Google Login Error: " + error.message);
      console.error(error);
    }
  };
  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setSections({}); 
      setModuleFolders({}); 
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(FOLDER_STORAGE_KEY);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const saveCustomKey = (key) => {
    setUserCustomKey(key);
    localStorage.setItem('user_gemini_key', key);
  };

  const removeCustomKey = () => {
    setUserCustomKey('');
    localStorage.removeItem('user_gemini_key');
  };

  const toggleFolder = (folderName) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderName]: prev[folderName] === false ? true : false
    }));
  };

  const startFolderSelection = () => {
    setTempFolderInput('');
    setIsDropdownOpen(false);
    setShowFolderModal(true);
  };

  // --- RENAME HANDLERS ---
  const handleRenameFolder = async (oldName, newName) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || trimmedNew === oldName) {
      setEditingFolder(null);
      return;
    }
    const updatedFolders = { ...moduleFolders };
    let modulesToUpdate = [];

    Object.keys(updatedFolders).forEach(modName => {
      if (updatedFolders[modName] === oldName || (oldName === "Saved Modules" && !updatedFolders[modName])) {
        updatedFolders[modName] = trimmedNew;
        modulesToUpdate.push(modName);
      }
    });

    setModuleFolders(updatedFolders);
    localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(updatedFolders));
    
    setExpandedFolders(prev => {
      const state = prev[oldName];
      const newExpanded = { ...prev, [trimmedNew]: state };
      delete newExpanded[oldName];
      return newExpanded;
    });
    
    setEditingFolder(null);

    if (!isLocalDev && user && db && appId) {
       try {
          await Promise.all(modulesToUpdate.map(mod => {
             const safeDocId = getSafeDocId(mod);
             return setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'modules', safeDocId), { folderName: trimmedNew }, { merge: true });
          }));
       } catch(err){}
    }
  };

  const handleRenameModule = async (oldName, newName) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || trimmedNew === oldName) {
      setEditingModule(null);
      return;
    }
    if (sections[trimmedNew]) {
      alert(t[lang].renameExists);
      return;
    }

    const newSections = { ...sections, [trimmedNew]: sections[oldName] };
    delete newSections[oldName];
    setSections(newSections);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSections));

    const newFolders = { ...moduleFolders, [trimmedNew]: moduleFolders[oldName] || "Saved Modules" };
    delete newFolders[oldName];
    setModuleFolders(newFolders);
    localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(newFolders));

    setEditingModule(null);

    if (!isLocalDev && user && db && appId) {
      try {
        const oldSafeId = getSafeDocId(oldName);
        const newSafeId = getSafeDocId(trimmedNew);
        const contentToSave = sections[oldName];
        const folderToSave = moduleFolders[oldName] || "Saved Modules";

        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'modules', newSafeId), {
          displayName: trimmedNew,
          content: JSON.stringify(contentToSave),
          folderName: folderToSave,
          updatedAt: Date.now()
        });
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'modules', oldSafeId));
      } catch(e){}
    }
  };

  const handleAI_Import = async () => {
    if (!rawInput) return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsProcessing(true);
    setIsSuccess(false);
    setStatusMsg(t[lang].chunkingData);
    setProgress(5);

    try {
      const lines = rawInput.split(/\n+/);
      const MAX_CHARS = 20000; 
      const chunks = [];
      let currentChunk = "";

      for (const line of lines) {
        if (currentChunk.length + line.length > MAX_CHARS) {
          if (currentChunk.trim()) chunks.push(currentChunk.trim());
          currentChunk = line + "\n";
        } else {
          currentChunk += line + "\n";
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk.trim());

      let allQuestionsAccumulator = [];
      const name = moduleName.trim() || `Module ${Object.keys(sections).length + 1}`;
      const folderToSave = selectedFolderForImport.trim();

      for (let i = 0; i < chunks.length; i++) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError'); 

        let attempt = 0;
        let maxAttempts = 3; 
        let chunkData = null;

        while (attempt < maxAttempts) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

          setStatusMsg(lang === 'en' 
            ? `Parsing batch ${i + 1} of ${chunks.length}... ${attempt > 0 ? `(Retry ${attempt})` : ''}` 
            : `အစု ${i + 1} / ${chunks.length} ကို လုပ်ဆောင်နေပါသည်... ${attempt > 0 ? `(အကြိမ် ${attempt})` : ''}`
          );
          console.log(`--- EXACT TEXT SENT TO AI (Batch ${i+1}) ---`, JSON.stringify(chunks[i]));
          const response = await fetch('/api/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawInput: chunks[i], userCustomKey }),
            signal: signal
          });

          if (response.ok) {
            chunkData = await response.json();
            break; 
          }

          let errorMessage = "Server error.";
          try {
            const errorData = await response.json();
            errorMessage = (errorData.error || "").toLowerCase();
          } catch (err) {}

          if (errorMessage.includes('demand') || errorMessage.includes('busy') || response.status === 503) {
            attempt++;
            if (attempt >= maxAttempts) throw new Error("High Demand");
            
            setStatusMsg(lang === 'en' ? `Server busy. Waiting 15s...` : `ဆာဗာ အလုပ်များနေပါသည်။ ၁၅ စက္ကန့် စောင့်ပါ...`);
            await new Promise(resolve => {
               const timeout = setTimeout(resolve, 15000); 
               signal.addEventListener('abort', () => { clearTimeout(timeout); resolve(); });
            });
          } else {
            throw new Error(errorMessage); 
          }
        }

        const newQuestions = Array.isArray(chunkData) ? chunkData : (chunkData.questions || []);
        
        const formattedBatch = newQuestions.map((q) => ({
          ...q,
          type: (q.type || 'mcq').toLowerCase(),
          question: q.question || "Question text missing",
          options: q.options || [],
          correctAnswerIndex: q.correctAnswerIndex ?? 0,
          answerText: q.answerText || "",
          colA: q.colA || [],
          colB: q.colB || [],
          correctMatches: q.correctMatches || {}
        }));

        allQuestionsAccumulator = [...allQuestionsAccumulator, ...formattedBatch];

        setSections(prev => {
          const updated = { ...prev, [name]: allQuestionsAccumulator };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });

        setModuleFolders(prev => {
          const updated = { ...prev, [name]: folderToSave };
          localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });

        setProgress(5 + ((i + 1) / chunks.length) * 85);

        if (i < chunks.length - 1) {
          await new Promise(resolve => {
            const timeout = setTimeout(resolve, 8000); 
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        }
      } 

      if (!isLocalDev && user && db && appId) {
        const safeId = getSafeDocId(name);
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'modules', safeId), {
          displayName: name,
          content: JSON.stringify(allQuestionsAccumulator),
          folderName: folderToSave,
          updatedAt: Date.now()
        });
      }

      setIsProcessing(false);
      setIsSuccess(true);
      setProgress(100);
      setStatusMsg(t[lang].parsedSuccessfully);
      
      setExpandedFolders(prev => ({ ...prev, [folderToSave]: true }));

      setTimeout(() => {
        setRawInput(''); 
        setModuleName('');
        setIsSuccess(false);
        setView('menu');
      }, 2000);

   } catch (error) {
      setIsProcessing(false);
      setStatusMsg('');
      setProgress(0);
      if (error.name === 'AbortError') return; 

      const errorString = (error.message || "").toLowerCase();
      if (errorString.includes('quota') || errorString.includes('limit') || errorString.includes('429') || errorString.includes('busy') || errorString.includes('503')) {
        if (userCustomKey) {
          alert(lang === 'en' ? "Your Private API Key hit a limit. Please wait a minute." : "သင်၏ API Key ကန့်သတ်ချက် ပြည့်သွားပါပြီ။");
        } else {
          alert(`${t[lang].freeTierBusy}\n\n${t[lang].freeTierBusyDesc}`);
          setShowSettings(true); 
        }
      } else {
        alert(t[lang].errorGeneric);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!showConfirm) return;
    const name = showConfirm;
    
    const newSections = { ...sections };
    delete newSections[name];
    setSections(newSections);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSections));

    const newFolders = { ...moduleFolders };
    delete newFolders[name];
    setModuleFolders(newFolders);
    localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(newFolders));

    setShowConfirm(null);

    if (!isLocalDev && user && db && appId) {
      try {
        const safeDocId = getSafeDocId(name);
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'modules', safeDocId));
      } catch (err) {}
    }
  };

  const handleDeleteFolderConfirm = async () => {
    if (!showFolderDeleteConfirm) return;
    const folderName = showFolderDeleteConfirm;
    
    const modulesToDelete = Object.keys(sections).filter(modName => 
      (moduleFolders[modName] || 'Saved Modules') === folderName
    );

    const newSections = { ...sections };
    const newFolders = { ...moduleFolders };

    modulesToDelete.forEach(mod => {
      delete newSections[mod];
      delete newFolders[mod];
    });

    setSections(newSections);
    setModuleFolders(newFolders);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSections));
    localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(newFolders));
    
    setShowFolderDeleteConfirm(null);

    if (!isLocalDev && user && db && appId) {
      try {
        await Promise.all(modulesToDelete.map(mod => {
          const safeDocId = getSafeDocId(mod);
          return deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'modules', safeDocId));
        }));
      } catch (err) {}
    }
  };

  const checkCorrect = (q, val) => {
    if (!q || val === undefined || q.type === 'header') return false;
    if (q.type === 'mcq' || q.type === 'tf') return val === q.correctAnswerIndex;
    if (q.type === 'fib') {
      const cleanInput = (str) => str?.trim().toLowerCase().replace(/\s*,\s*/g, ',').replace(/\s+/g, ' '); 
      const userInput = cleanInput(val);
      const officialAnswer = cleanInput(q.answerText);
      if (!userInput || !officialAnswer) return false;
      const officialParts = officialAnswer.split(/\s+or\s+|\//);
      const userParts = userInput.split(/\s+or\s+|\//);
      return userParts.every(part => officialParts.includes(part));
    }
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

  const existingFolders = Array.from(new Set(Object.values(moduleFolders).filter(f => f && f.trim() !== '')));

  const groupedModules = Object.keys(sections).reduce((acc, modName) => {
    const folder = moduleFolders[modName] || "Saved Modules";
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(modName);
    return acc;
  }, {});

  const th = {
    bgMain: isDark ? 'bg-[#0B1120]' : 'bg-slate-50',
    textMain: isDark ? 'text-white' : 'text-slate-900',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    card: isDark ? 'bg-[#111827] border-slate-800/60 shadow-lg' : 'bg-white border-slate-200 shadow-sm',
    cardHover: isDark ? 'hover:border-slate-700' : 'hover:border-slate-300 hover:shadow-md',
    navBg: isDark ? 'bg-[#0B1120]/80 border-white/5' : 'bg-white/80 border-slate-200 shadow-sm',
    btnDefault: isDark ? 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-blue-600',
    btnActive: isDark ? 'bg-white/10 text-blue-400' : 'bg-blue-50 text-blue-600',
    inputBg: isDark ? 'bg-[#0B1120] border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-500',
    pill: isDark ? 'bg-slate-800/60 border-slate-700/80 text-blue-400/90' : 'bg-blue-50 border-blue-200 text-blue-600',
    mcqOpt: isDark ? 'bg-[#1f2937]/30 border-slate-700 hover:bg-[#1f2937]/80 text-slate-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700',
    matchCont: isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-100 border-slate-200',
    matchItem: isDark ? 'bg-[#111827] border-slate-800/50 hover:bg-slate-800/40 text-slate-200' : 'bg-white border-b-slate-100 hover:bg-slate-50 text-slate-700',
    matchActive: isDark ? 'bg-blue-900/30' : 'bg-blue-50',
    modalOverlay: isDark ? 'bg-black/80' : 'bg-slate-900/40',
  };

  if (loading) return (
    <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${th.bgMain}`}>
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <div className="text-blue-500 font-bold uppercase tracking-widest text-[10px]">{t[lang].loading}</div>
    </div>
  );

  let questionCounter = 0;
  const totalQuestions = questions.filter(q => q.type !== 'header').length;

  return (
    <div className={`min-h-screen font-sans selection:bg-blue-500/30 pt-24 transition-colors duration-300 ${th.bgMain}`}>
      
      <nav className={`fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl z-[1000] backdrop-blur-xl border rounded-2xl px-4 py-2.5 flex justify-between items-center transition-all ${th.navBg}`}>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 mr-4 cursor-pointer group" onClick={() => setView('menu')}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20 group-hover:bg-blue-500 transition-colors">
              <BookOpen className="text-white w-5 h-5" />
            </div>
            <h1 className={`hidden sm:block text-sm font-black tracking-widest uppercase italic ${th.textMain}`}>
              {t[lang].appTitle}
            </h1>
          </div>

          <div className={`h-6 w-px mx-2 hidden sm:block ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

          <button 
            onClick={startFolderSelection} 
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-xs font-bold uppercase tracking-tight ${view === 'import' ? th.btnActive : th.btnDefault}`}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:block">{t[lang].addNewModule}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {view === 'quiz' && (
            <div className={`mr-2 flex items-center gap-3 px-3 py-1.5 rounded-full ${isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
              <Target className={`w-3.5 h-3.5 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
              <span className={`text-[10px] font-black uppercase tracking-tighter ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                {calculateScore()} / {totalQuestions}
              </span>
              <button 
                onClick={() => {setAnswers({}); setFibInput({}); setRevealed({}); setMatchTemp({}); setMatchSelectedA({}); window.scrollTo(0,0);}} 
                className={`transition-colors ml-1 p-0.5 ${isDark ? 'text-green-500 hover:text-green-300' : 'text-green-600 hover:text-green-800'}`}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}

          <button 
            onClick={() => setIsDark(!isDark)} 
            className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all border ${th.btnDefault}`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button 
            onClick={() => setLang(lang === 'en' ? 'mm' : 'en')} 
            className={`h-9 px-3 rounded-xl border text-[10px] font-black transition-all ${th.btnDefault}`}
          >
            {lang === 'en' ? 'မြန်မာ' : 'ENG'}
          </button>
          
          <button 
            onClick={() => setShowSettings(true)} 
            className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all border ${showSettings ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : th.btnDefault}`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto p-4 md:p-8 relative z-0 mt-4">
        
        {view === 'menu' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            {Object.keys(groupedModules).length === 0 && (
              <div className="text-center py-20">
                <button onClick={startFolderSelection} className={`p-10 border-2 border-dashed rounded-3xl font-black uppercase text-xs transition-all flex flex-col items-center gap-4 mx-auto group ${isDark ? 'border-slate-800 text-slate-600 hover:text-blue-400 hover:border-blue-500/50' : 'border-slate-300 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50'}`}>
                  <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" /> {t[lang].addNewFolder}
                </button>
                <p className={`text-xs mt-4 opacity-50 italic ${th.textMuted}`}>
                   {t[lang].folderHint}
                </p>
              </div>
            )}
            
            {/* RENDER ACCORDION FOLDERS */}
            {Object.entries(groupedModules).map(([folderName, mods]) => {
              const isExpanded = expandedFolders[folderName] !== false;
              
              return (
                <div key={folderName} className={`mb-10 rounded-[2rem] border transition-all duration-300 ${isDark ? 'border-slate-800/60 bg-[#0F1626]' : 'border-slate-200 bg-slate-50'}`}>
                  
                  {/* FOLDER HEADER */}
                  <div 
                    onClick={() => toggleFolder(folderName)}
                    className="flex items-center justify-between p-6 cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl transition-colors ${isExpanded ? 'bg-blue-600 text-white' : (isDark ? 'bg-slate-800 text-blue-500' : 'bg-blue-100 text-blue-600')}`}>
                        {isExpanded ? <FolderOpen className="w-6 h-6" /> : <Folder className="w-6 h-6" />}
                      </div>
                      
                      {/* EDIT FOLDER NAME */}
                      {editingFolder === folderName ? (
                         <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                           <input 
                              autoFocus 
                              value={editFolderInput} 
                              onChange={e => setEditFolderInput(e.target.value)} 
                              onKeyDown={(e) => {
                                 if(e.key === 'Enter') handleRenameFolder(folderName, editFolderInput); 
                                 if(e.key === 'Escape') setEditingFolder(null);
                              }} 
                              className={`px-3 py-1 rounded bg-transparent border-b outline-none font-black uppercase tracking-widest ${th.textMain} ${isDark ? 'border-blue-500 focus:bg-slate-800' : 'border-blue-600 focus:bg-white'}`} 
                           />
                           <button onClick={() => handleRenameFolder(folderName, editFolderInput)} className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"><Check className="w-5 h-5"/></button>
                           <button onClick={() => setEditingFolder(null)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
                         </div>
                      ) : (
                         <div className="flex items-center gap-4">
                           <div>
                             <h2 className={`text-xl font-black uppercase tracking-widest ${th.textMain}`}>{folderName}</h2>
                             <p className={`text-[10px] font-bold mt-1 tracking-widest uppercase ${th.textMuted}`}>
                               {mods.length} {mods.length === 1 ? 'Module' : 'Modules'}
                             </p>
                           </div>
                           
                           {/* HEADER ACTION BUTTONS */}
                           <div className="flex gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setEditingFolder(folderName); setEditFolderInput(folderName); }} 
                                className={`p-2.5 rounded-xl transition-all ${isDark ? 'text-slate-500 hover:text-blue-500 hover:bg-blue-500/10' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'}`}
                              >
                                <Pencil className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setShowFolderDeleteConfirm(folderName); }} 
                                className={`p-2.5 rounded-xl transition-all ${isDark ? 'text-slate-500 hover:text-red-500 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                           </div>
                         </div>
                      )}
                    </div>
                    
                    <div className={`p-2 rounded-full transition-colors ${isDark ? 'group-hover:bg-slate-800' : 'group-hover:bg-slate-200'}`}>
                      {isExpanded ? 
                        <ChevronDown className={`w-5 h-5 ${th.textMuted}`} /> : 
                        <ChevronRight className={`w-5 h-5 ${th.textMuted}`} />
                      }
                    </div>
                  </div>
                  
                  {/* FOLDER CONTENTS */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                      {mods.map(name => (
                        <div key={name} className={`relative group border rounded-3xl p-6 transition-all cursor-pointer ${th.card} ${th.cardHover}`} onClick={() => {setActiveSection(name); setAnswers({}); setView('quiz'); window.scrollTo(0,0);}}>
                          
                          {/* EDIT MODULE NAME */}
                          {editingModule === name ? (
                             <div className="mb-2 relative z-10" onClick={(e) => e.stopPropagation()}>
                               <input 
                                  autoFocus 
                                  value={editModuleInput} 
                                  onChange={e => setEditModuleInput(e.target.value)} 
                                  onKeyDown={(e) => {
                                     if(e.key === 'Enter') handleRenameModule(name, editModuleInput); 
                                     if(e.key === 'Escape') setEditingModule(null);
                                  }} 
                                  className={`w-full px-2 py-1.5 rounded bg-transparent border-b outline-none font-bold text-lg ${th.textMain} ${isDark ? 'border-blue-500 focus:bg-slate-800' : 'border-blue-600 focus:bg-slate-100'}`} 
                               />
                               <div className="flex gap-2 mt-3">
                                  <button onClick={() => handleRenameModule(name, editModuleInput)} className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors"><Check className="w-4 h-4"/></button>
                                  <button onClick={() => setEditingModule(null)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
                               </div>
                             </div>
                          ) : (
                             <>
                                <h3 className={`text-lg font-bold mb-1 pr-20 ${th.textMain}`}>{name}</h3>
                                <p className={`text-[10px] uppercase font-black tracking-widest ${th.textMuted}`}>{sections[name].filter(q => q.type !== 'header').length} {t[lang].questions}</p>
                             </>
                          )}

                          <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); setEditingModule(name); setEditModuleInput(name); }} className={`p-2 rounded-xl border transition-all shadow-xl ${isDark ? 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-blue-500 hover:border-blue-500/50' : 'bg-white border-slate-200 text-slate-400 hover:text-blue-500 hover:bg-blue-50'}`}><Pencil className="w-4 h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); setShowConfirm(name); }} className={`p-2 rounded-xl border transition-all shadow-xl ${isDark ? 'bg-[#0B1120] border-slate-800 text-slate-400 hover:text-red-500 hover:border-red-500/50' : 'bg-white border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50'}`}><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                      
                      {/* ADD TO THIS FOLDER BUTTON */}
                      <div 
                        onClick={() => {
                          setSelectedFolderForImport(folderName);
                          setRawInput(''); 
                          setModuleName('');
                          setView('import');
                          window.scrollTo(0,0);
                        }}
                        className={`relative flex flex-col items-center justify-center min-h-[120px] group border-2 border-dashed rounded-3xl p-6 transition-all cursor-pointer ${isDark ? 'border-slate-800 text-slate-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5' : 'border-slate-300 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50'}`}
                      >
                        <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-center">Add to <br/>{folderName}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* PERSISTENT 'ADD NEW FOLDER' BUTTON AT THE BOTTOM */}
            {Object.keys(groupedModules).length > 0 && (
              <div 
                onClick={startFolderSelection} 
                className={`mt-8 mb-20 rounded-[2rem] border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-10 group ${isDark ? 'border-slate-800 text-slate-500 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5' : 'border-slate-300 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50'}`}
              >
                <div className={`p-4 rounded-full mb-3 transition-transform duration-300 group-hover:scale-110 ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                  <Plus className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">{t[lang].addNewFolder}</h3>
                <p className={`text-[10px] mt-2 tracking-widest uppercase ${th.textMuted}`}>{t[lang].clickToStart}</p>
              </div>
            )}
          </div>
        )}

        {view === 'quiz' && (
          <div className="space-y-8 pb-40 animate-in slide-in-from-right-4 duration-300">
            <h2 className={`text-2xl font-black border-b pb-4 tracking-tight uppercase italic ${th.textMain} ${isDark ? 'border-slate-800/60' : 'border-slate-200'}`}>{activeSection}</h2>
            {questions.map((q, idx) => {
              if (q.type === 'header') {
                questionCounter = 0; 
                return (
                  <div key={idx} className="pt-8 pb-2 pl-4">
                    <div className="flex items-center gap-3">
                       <Layout className="text-blue-500 w-5 h-5" />
                       <h3 className={`text-xl font-black tracking-tight uppercase italic ${th.textMain}`}>{q.text}</h3>
                    </div>
                  </div>
                );
              }
              questionCounter++;
              const isAns = answers[idx] !== undefined;
              const isRev = revealed[idx];
              const userVal = answers[idx];
              return (
                <div key={idx} id={`q-card-${idx}`} className={`p-6 md:p-8 rounded-[2rem] border transition-all duration-300 ${th.card} ${isAns ? (checkCorrect(q, userVal) ? (isDark ? 'border-green-500/30' : 'border-green-400 bg-green-50/30') : (isDark ? 'border-red-500/30' : 'border-red-400 bg-red-50/30')) : ''}`}>
                  <div className="mb-5 flex justify-between items-center">
                    <span className={`inline-block border px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${th.pill}`}>
                      {t[lang].questionLabel} {questionCounter}
                    </span>
                    {isAns && (
                      <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 ${checkCorrect(q, userVal) ? 'text-green-500' : 'text-red-500'}`}>
                        {checkCorrect(q, userVal) ? <CheckCircle2 className="w-3 h-3"/> : <X className="w-3 h-3"/>}
                        {checkCorrect(q, userVal) ? t[lang].correct : t[lang].incorrect}
                      </span>
                    )}
                  </div>
                  <p className={`text-lg md:text-xl font-medium mb-6 whitespace-pre-line leading-relaxed ${th.textMain}`}>{q.question}</p>
                  {(q.type === 'mcq' || q.type === 'tf') && (
                    <div className="space-y-3">
                      {q.options.map((opt, oIdx) => {
                        const isCorrectOpt = q.correctAnswerIndex === oIdx;
                        const isSelected = userVal === oIdx;
                        let style = th.mcqOpt; 
                        if (isAns || isRev) {
                          if (isCorrectOpt) style = (q.type === 'tf' && !isSelected && isAns) ? "opacity-40" : (isDark ? "bg-green-900/30 border-green-500 text-green-400 font-bold" : "bg-green-100 border-green-500 text-green-700 font-bold");
                          else if (isAns && isSelected) style = isDark ? "bg-red-900/30 border-red-500 text-red-400 font-bold" : "bg-red-100 border-red-500 text-red-700 font-bold";
                          else style = "opacity-40";
                        }
                        return (
                          <button key={oIdx} disabled={isAns} onClick={() => { setAnswers({...answers, [idx]: oIdx}); if(!isAns) setTimeout(() => scrollToNext(idx), 600); }} className={`w-full text-left p-4 rounded-2xl border transition-colors flex justify-between items-center group ${style}`}>
                            <span className="flex items-start text-sm md:text-base font-normal">
                              {q.type !== 'tf' && <span className="mr-2 opacity-60">{String.fromCharCode(65 + oIdx)})</span>}
                              {opt}
                            </span>
                            {(isAns || isRev) && isCorrectOpt && (q.type === 'mcq' || isSelected || isRev) && <CircleCheck className="w-5 h-5 text-green-500 ml-2 shrink-0" />}
                            {isAns && isSelected && !isCorrectOpt && <CircleX className="w-5 h-5 text-red-500 ml-2 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {q.type === 'matching' && (
                    <div className="space-y-4">
                      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-px border rounded-2xl overflow-hidden ${th.matchCont}`}>
                        <div className="flex flex-col">
                          {q.colA.map((item, aIdx) => {
                            const match = isAns ? userVal[aIdx] : (matchTemp[idx] || {})[aIdx];
                            return (
                              <button key={aIdx} onClick={() => !isAns && setMatchSelectedA({...matchSelectedA, [idx]: matchSelectedA[idx] === aIdx ? null : aIdx})} className={`p-4 text-left border-b min-h-[70px] flex items-center justify-between transition-colors ${matchSelectedA[idx] === aIdx ? th.matchActive : th.matchItem}`}>
                                <span className="text-sm font-normal">{aIdx + 1}. {item.text}</span>
                                {match !== undefined && (
                                  <div className="flex items-center gap-2 ml-4">
                                    <span className="text-blue-500 font-bold text-sm">{String.fromCharCode(65 + Number(match))})</span>
                                    {!isAns && (
                                      <div onClick={(e) => { e.stopPropagation(); const updated = { ...(matchTemp[idx] || {}) }; delete updated[aIdx]; setMatchTemp({...matchTemp, [idx]: updated}); if (matchSelectedA[idx] === aIdx) setMatchSelectedA({...matchSelectedA, [idx]: null}); }} className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-full transition-colors"><X className="w-3 h-3" /></div>
                                    )}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className={`flex flex-col border-t sm:border-t-0 sm:border-l ${isDark ? 'border-slate-800/50' : 'border-slate-200'}`}>
                          {q.colB.map((item, bIdx) => {
                            const isUsed = Object.values(matchTemp[idx] || {}).includes(bIdx);
                            return (
                              <button key={bIdx} onClick={() => { if (isAns || matchSelectedA[idx] === null || matchSelectedA[idx] === undefined) return; const currentA = matchSelectedA[idx]; const updated = { ...(matchTemp[idx] || {}) }; Object.keys(updated).forEach(k => { if(updated[k] === bIdx) delete updated[k]; }); updated[currentA] = bIdx; setMatchTemp({...matchTemp, [idx]: updated}); setMatchSelectedA({...matchSelectedA, [idx]: null}); }} className={`p-4 text-left border-b min-h-[70px] flex items-start transition-all ${isUsed && !isAns ? 'opacity-30 grayscale' : th.matchItem}`}>
                                <span className="text-sm font-bold text-blue-500 mr-2 shrink-0">{String.fromCharCode(65 + bIdx)})</span>
                                <span className="text-sm font-normal">{item.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {!isAns && (
                        <div className="flex flex-col sm:flex-row gap-3 w-full mt-4">
                          <button onClick={() => { setAnswers({...answers, [idx]: matchTemp[idx]}); setTimeout(() => scrollToNext(idx), 600); }} className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all"><ClipboardCheck className="w-4 h-4" /> {t[lang].submitMatch}</button>
                          <button onClick={() => { setMatchTemp({...matchTemp, [idx]: {}}); setMatchSelectedA({...matchSelectedA, [idx]: null}); }} className={`flex-1 py-4 border rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${isDark ? 'border-slate-700 hover:bg-slate-800/60 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-600'}`}><RotateCcw className="w-4 h-4" /> {t[lang].clearAll}</button>
                        </div>
                      )}
                    </div>
                  )}
                  {q.type === 'fib' && (
                    <div className="space-y-4">
                      <form onSubmit={(e) => { e.preventDefault(); const val = (fibInput[idx] || "").trim(); if(val){ setAnswers({...answers, [idx]: val}); setTimeout(()=>scrollToNext(idx), 600); } else setRevealed({...revealed, [idx]: !isRev}); }}>
                        <input id={`fib-inp-${idx}`} type="text" disabled={isAns} value={fibInput[idx] || ""} onChange={(e)=>setFibInput({...fibInput, [idx]: e.target.value})} placeholder={t[lang].typeAnswer} className={`w-full p-5 rounded-2xl border-2 outline-none transition-all text-lg font-medium placeholder:text-slate-400 ${isAns ? (checkCorrect(q, userVal) ? 'border-green-500 text-green-500 bg-green-500/5' : 'border-red-500 text-red-500 bg-red-500/5') : (isRev ? 'border-blue-500 bg-blue-500/5 text-blue-500' : th.inputBg)}`} />
                      </form>
                    </div>
                  )}
                  {(isAns || isRev) && (q.type === 'fib' || q.type === 'matching') && (
                    <div className={`p-4 mt-6 rounded-2xl border flex items-start gap-3 animate-in slide-in-from-top-2 ${isDark ? 'bg-[#0B1120] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="w-full">
                        <div className="flex justify-between items-center mb-3">
                           <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{t[lang].officialAnswer}</p>
                           {q.type === 'matching' && isAns && (
                              <button onClick={() => {
                                 const newAns = {...answers}; delete newAns[idx]; setAnswers(newAns);
                                 const newTemp = {...matchTemp}; delete newTemp[idx]; setMatchTemp(newTemp);
                                 setRevealed({...revealed, [idx]: false});
                                 setMatchSelectedA({...matchSelectedA, [idx]: null});
                              }} className="text-[10px] text-blue-500 hover:text-blue-400 font-bold uppercase flex items-center gap-1 transition-colors"><RotateCcw className="w-3 h-3" /> {t[lang].retry}</button>
                           )}
                        </div>
                        {q.type === 'matching' ? (
                          <div className="space-y-1">
                            {q.colA.map((item, aIdx) => {
                              const correctBIdx = q.correctMatches[aIdx] ?? q.correctMatches[String(aIdx)];
                              const correctB = q.colB[correctBIdx];
                              const isUserCorrect = isAns && userVal && userVal[aIdx] === correctBIdx;
                              return (
                                <div key={aIdx} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm p-3 rounded-xl border ${isAns ? (isUserCorrect ? (isDark ? 'bg-green-900/10 border-green-500/20' : 'bg-green-50 border-green-200') : (isDark ? 'bg-red-900/10 border-red-500/20' : 'bg-red-50 border-red-200')) : (isDark ? 'bg-transparent border-slate-800/50' : 'bg-white border-slate-200')}`}>
                                  <div className="flex items-center gap-2 flex-1">
                                     {isAns && (isUserCorrect ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> : <X className="w-4 h-4 text-red-500 shrink-0" />)}
                                     <span className={`font-normal ${isDark ? 'text-slate-300' : 'text-slate-700'}`}><span className="text-slate-400 mr-2">{aIdx + 1}.</span>{item.text}</span>
                                  </div>
                                  <ArrowRightLeft className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
                                  <div className="flex items-start gap-2 flex-1 pl-6 sm:pl-0">
                                     <span className="text-blue-500 font-bold shrink-0">{String.fromCharCode(65 + Number(correctBIdx))})</span>
                                     <span className={`font-normal ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{correctB?.text}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <span className={`font-mono text-base break-all ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{q.answerText}</span>
                        )}
                      </div>
                    </div>
                  )}
                  {!isAns && (
                    <div className="mt-4 flex justify-end">
                      <button onClick={() => setRevealed({...revealed, [idx]: !isRev})} className="text-[10px] font-bold text-slate-400 hover:text-slate-500 flex items-center gap-1 uppercase tracking-widest transition-colors">
                        <Eye className="w-3 h-3"/> {isRev ? t[lang].hideAnswer : t[lang].showAnswer}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-center pt-10">
              <button onClick={() => setView('results')} className="px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold uppercase tracking-widest shadow-xl transition-all flex items-center gap-3">
                {t[lang].finishExam} <Trophy className="w-5 h-5 text-yellow-400" />
              </button>
            </div>
          </div>
        )}

        {view === 'results' && (
          <div className={`p-10 md:p-16 rounded-[2rem] text-center border shadow-2xl animate-in zoom-in ${th.card}`}>
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-6 drop-shadow-[0_0_20px_rgba(234,179,8,0.3)]" />
            <h2 className={`text-3xl font-black mb-8 tracking-tight italic uppercase leading-none ${th.textMain}`}>{t[lang].moduleComplete}</h2>
            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#0B1120] border-slate-800/60 shadow-inner' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">{t[lang].finalScore}</p>
                <p className={`text-4xl font-black ${th.textMain}`}>{calculateScore()} <span className="text-lg text-slate-500 font-medium">/ {totalQuestions}</span></p>
              </div>
              <div className={`p-6 rounded-2xl border ${isDark ? 'bg-[#0B1120] border-slate-800/60 shadow-inner' : 'bg-slate-50 border-slate-200'}`}>
                <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">{t[lang].accuracy}</p>
                <p className="text-4xl font-black text-blue-500">{totalQuestions > 0 ? Math.round((calculateScore()/totalQuestions)*100) : 0}%</p>
              </div>
            </div>
            <button onClick={() => setView('menu')} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-widest shadow-xl transition-all">
              {t[lang].modulesHome}
            </button>
          </div>
        )}

        {/* UNIFIED COMBOBOX FOLDER MODAL */}
        {showFolderModal && (
          <div className={`fixed inset-0 z-[2000] backdrop-blur-sm flex items-center justify-center p-6 bg-black/80`}>
            <div className={`border p-8 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in duration-200 ${th.card}`}>
              <h3 className={`text-xl font-black italic uppercase mb-6 tracking-tight ${th.textMain}`}>{t[lang].selectFolderTitle}</h3>
              
              <div className="relative mb-8" ref={dropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    value={tempFolderInput}
                    onChange={(e) => {
                      setTempFolderInput(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder={t[lang].folderPlaceholder}
                    className={`w-full p-4 rounded-xl border font-medium outline-none transition-all pr-12 ${th.inputBg}`}
                  />
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>

                {isDropdownOpen && (
                  <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2 ${isDark ? 'bg-[#111827] border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="max-h-48 overflow-y-auto">
                      {existingFolders.length > 0 ? (
                        existingFolders.filter(f => f.toLowerCase().includes(tempFolderInput.toLowerCase())).map(f => (
                          <div
                            key={f}
                            onClick={() => {
                              setTempFolderInput(f);
                              setIsDropdownOpen(false);
                            }}
                            className={`px-4 py-3 cursor-pointer flex items-center gap-3 transition-colors ${isDark ? 'hover:bg-blue-600/20 text-slate-200' : 'hover:bg-blue-50 text-slate-700'}`}
                          >
                            <Folder className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-sm">{f}</span>
                          </div>
                        ))
                      ) : null}

                      {/* CREATE NEW OPTION */}
                      {tempFolderInput.trim() && !existingFolders.some(f => f.toLowerCase() === tempFolderInput.trim().toLowerCase()) && (
                        <div
                          onClick={() => setIsDropdownOpen(false)}
                          className={`px-4 py-3 cursor-pointer flex items-center gap-3 border-t transition-colors ${isDark ? 'border-slate-800 hover:bg-green-600/20 text-green-400' : 'border-slate-100 hover:bg-green-50 text-green-600'}`}
                        >
                          <Plus className="w-4 h-4" />
                          <span className="font-bold text-sm">Create "{tempFolderInput.trim()}"</span>
                        </div>
                      )}
                      
                      {/* EMPTY STATE */}
                      {existingFolders.length === 0 && !tempFolderInput.trim() && (
                        <div className={`px-4 py-3 text-sm text-center italic opacity-50 ${th.textMuted}`}>
                          Type to create your first folder
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowFolderModal(false)} className={`flex-1 py-3 border rounded-xl font-bold uppercase text-xs transition-colors ${isDark ? 'border-slate-700 hover:bg-slate-800/60 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'}`}>{t[lang].cancelBtn}</button>
                <button 
                  disabled={!tempFolderInput.trim()}
                  onClick={() => {
                   const f = tempFolderInput.trim();
                   if(!f) return;
                   setSelectedFolderForImport(f);
                   setShowFolderModal(false);
                   setRawInput(''); 
                   setModuleName('');
                   setView('import');
                }} className={`flex-1 py-3 rounded-xl font-bold uppercase text-xs text-white transition-colors ${tempFolderInput.trim() ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-500 cursor-not-allowed opacity-50'}`}>
                   {t[lang].continueBtn}
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'import' && (
          <div className={`p-8 rounded-[2rem] border shadow-2xl animate-in slide-in-from-bottom duration-500 ${th.card}`}>
            
            {/* LOCKED FOLDER INDICATOR */}
            <div className={`mb-6 p-4 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-[#0B1120] border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
               <div className="flex items-center gap-3">
                 <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/10' : 'bg-blue-100'}`}><Folder className="w-5 h-5 text-blue-500"/></div>
                 <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t[lang].folderLabel}</p>
                    <p className={`text-sm font-black tracking-wide ${th.textMain}`}>{selectedFolderForImport}</p>
                 </div>
               </div>
               <button onClick={() => { 
                  setTempFolderInput(selectedFolderForImport);
                  setIsDropdownOpen(false);
                  setShowFolderModal(true); 
               }} className="px-3 py-1.5 rounded-lg border border-slate-300 text-[10px] font-bold text-slate-500 hover:text-blue-500 hover:border-blue-500 uppercase tracking-widest transition-all">
                  {t[lang].changeFolder}
               </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-100'}`}><Wand2 className="text-blue-600 w-5 h-5" /></div>
                <div>
                  <h2 className={`text-xl font-black uppercase italic leading-none mb-1 ${th.textMain}`}>{t[lang].textImport}</h2>
                  <p className="text-slate-500 text-[10px] font-bold tracking-tight italic flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-green-500" />
                    {t[lang].poweredBy}
                  </p>
                </div>
              </div>
            </div>
            
            <div className={`mb-4 border p-4 rounded-xl flex gap-3 items-start ${isDark ? 'bg-blue-900/20 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
               <FileSearch className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
               <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <strong className="text-blue-500">{t[lang].aiParserActive}</strong> {t[lang].aiParserDesc}
               </p>
            </div>
            
            <input type="text" value={moduleName} onChange={(e)=>setModuleName(e.target.value)} placeholder={t[lang].moduleNamePlaceholder} className={`w-full p-4 rounded-xl border mb-4 font-medium outline-none transition-all ${th.inputBg}`} />
            
            <textarea value={rawInput} onChange={(e)=>setRawInput(e.target.value)} placeholder={t[lang].pasteRawTextPlaceholder} className={`w-full h-80 p-5 rounded-xl border font-mono text-sm mb-6 outline-none transition-all leading-relaxed ${th.inputBg}`} />
            
            {(isProcessing || isSuccess) && (
              <div className="w-full mb-6 animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest animate-pulse">
                    {isSuccess ? t[lang].processingComplete : statusMsg}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden border ${isDark ? 'bg-[#0B1120] border-slate-800' : 'bg-slate-200 border-slate-300'}`}>
                  <div 
                    className={`h-full transition-all duration-500 ease-out ${isSuccess ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="flex flex-col md:flex-row gap-3 mt-4">
              <button 
                onClick={handleAI_Import} 
                disabled={isProcessing || isSuccess || !rawInput}
                className={`flex-[2] py-4 text-white rounded-xl font-bold uppercase text-sm tracking-wide shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${isSuccess ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'}`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t[lang].generateBtn}
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    {t[lang].processingComplete}
                  </>
                ) : (
                  <>{t[lang].generateBtn}</>
                )}
              </button>
              <button 
                onClick={() => {
                  if (abortControllerRef.current) {
                      abortControllerRef.current.abort(); 
                  }
                  setIsProcessing(false);
                  setStatusMsg('');
                  setProgress(0);
                  setView('menu');
                }} 
                className={`flex-1 py-4 border rounded-xl font-bold uppercase text-sm tracking-wide transition-all ${isDark ? 'border-slate-700 hover:bg-slate-800/60 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-600'}`}
              >
                {t[lang].cancelBtn}
              </button>
            </div>
          </div>
        )}

        {/* MODULE DELETE MODAL */}
        {showConfirm && (
          <div className={`fixed inset-0 z-[2000] backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto ${th.modalOverlay}`}>
            <div className={`border p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-200 ${th.card}`}>
              <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-4" />
              <h3 className={`text-xl font-bold mb-2 ${th.textMain}`}>{t[lang].deleteModule}</h3>
              <p className={`text-sm mb-8 ${th.textMuted}`}>{t[lang].deleteWarning} <br/><span className={`font-bold mt-2 inline-block ${th.textMain}`}>"{showConfirm}"</span></p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(null)} className={`flex-1 py-3 border rounded-xl font-bold uppercase text-xs transition-colors ${isDark ? 'border-slate-700 hover:bg-slate-800/60 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'}`}>{t[lang].cancelBtn}</button>
                <button onClick={handleDeleteConfirm} className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold uppercase text-xs text-white transition-colors">{t[lang].deleteBtn}</button>
              </div>
            </div>
          </div>
        )}

        {/* FOLDER DELETE MODAL */}
        {showFolderDeleteConfirm && (
          <div className={`fixed inset-0 z-[2000] backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto ${th.modalOverlay}`}>
            <div className={`border p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-200 ${th.card}`}>
              <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-4" />
              <h3 className={`text-xl font-bold mb-2 ${th.textMain}`}>{t[lang].deleteFolderTitle}</h3>
              <p className={`text-sm mb-8 leading-relaxed ${th.textMuted}`}>{t[lang].deleteFolderWarning} <br/><span className={`font-bold mt-3 inline-block ${th.textMain}`}>"{showFolderDeleteConfirm}"</span></p>
              <div className="flex gap-3">
                <button onClick={() => setShowFolderDeleteConfirm(null)} className={`flex-1 py-3 border rounded-xl font-bold uppercase text-xs transition-colors ${isDark ? 'border-slate-700 hover:bg-slate-800/60 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'}`}>{t[lang].cancelBtn}</button>
                <button onClick={handleDeleteFolderConfirm} className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold uppercase text-xs text-white transition-colors">{t[lang].deleteBtn}</button>
              </div>
            </div>
          </div>
        )}
        
        {/* --- SETTINGS MODAL (USER FRIENDLY & SCROLLABLE) --- */}
        {showSettings && (
          <div 
            className={`fixed inset-0 z-[2000] backdrop-blur-sm overflow-y-auto flex justify-center items-start pt-12 pb-12 px-4 animate-in fade-in duration-200 pointer-events-auto ${th.modalOverlay}`}
            onClick={() => setShowSettings(false)}
          >
            <div 
              onClick={(e) => e.stopPropagation()} 
              className={`relative border p-6 md:p-8 rounded-3xl w-full max-w-[600px] shadow-2xl animate-in zoom-in-95 duration-200 my-auto ${th.card}`}
            >
              <button 
                onClick={() => setShowSettings(false)} 
                className={`absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full transition-all z-10 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-8 pr-8">
                <div className={`p-2.5 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <Settings className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
                </div>
                <h3 className={`text-xl font-black uppercase italic tracking-tight ${th.textMain}`}>{t[lang].settings}</h3>
              </div>

              {/* ACCOUNT SYNC SECTION */}
              <div className={`mb-8 border-b pb-6 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 ml-1 flex items-center gap-2">
                  <Cloud className="w-3 h-3 text-blue-500" /> {t[lang].cloudSyncTitle}
                </label>
                
                {user ? (
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${isDark ? 'bg-green-900/10 border-green-500/30' : 'bg-green-50 border-green-200'}`}>
                    <div>
                      <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">{t[lang].accountLinked}</p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{user.email || "Google Account"}</p>
                    </div>
                    <button onClick={handleLogout} className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors rounded-lg text-xs font-bold uppercase tracking-widest">
                      {t[lang].logoutBtn}
                    </button>
                  </div>
                ) : (
                  <button onClick={handleGoogleLogin} className={`w-full py-4 border rounded-xl font-bold uppercase text-xs transition-colors flex items-center justify-center gap-3 shadow-sm ${isDark ? 'bg-[#111827] text-white border-slate-700 hover:bg-slate-800' : 'bg-white text-slate-900 border-slate-300 hover:bg-slate-50'}`}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    {t[lang].signInGoogle}
                  </button>
                )}
              </div>
              
              <div className="mb-8 group">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 ml-1 flex items-center gap-2">
                  <Wand2 className="w-3 h-3 text-blue-500" /> {t[lang].videoGuideTitle}
                </label>
                <div className={`rounded-2xl overflow-hidden border shadow-xl transition-all ${isDark ? 'border-slate-800 bg-slate-900 group-hover:border-blue-500/30' : 'border-slate-200 bg-slate-100 group-hover:border-blue-300'}`}>
                  <LiteYouTubeEmbed 
                    id="A4NZB-ebU38" 
                    title="How to get Gemini API Key"
                    poster="maxresdefault"
                    noCookie={true}
                    params="rel=0"
                  />
                </div>
              </div>

              {userCustomKey && (
                <div className={`border p-5 rounded-2xl mb-6 shadow-inner ${isDark ? 'bg-green-900/10 border-green-500/20' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">
                      {t[lang].privateLimitsActive}
                    </span>
                  </div>
                  <p className={`text-[10px] font-medium leading-relaxed ${isDark ? 'text-green-500/80' : 'text-green-700'}`}>
                    {t[lang].privateKeyActiveDesc}
                  </p>
                </div>
              )}
              
              <div>
                <div className="flex items-center justify-between mb-3 ml-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Key className="w-3 h-3 text-blue-500" /> {t[lang].privateApiKey}
                  </label>
                  {userCustomKey && (
                    <button 
                      onClick={removeCustomKey} 
                      className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-widest transition-colors"
                    >
                      {t[lang].removeKey}
                    </button>
                  )}
                </div>
                <input 
                  type="password" 
                  value={userCustomKey}
                  onChange={(e) => saveCustomKey(e.target.value)}
                  placeholder={t[lang].pasteKey}
                  className={`w-full p-4 rounded-xl border text-sm font-mono outline-none transition-all shadow-inner ${userCustomKey ? (isDark ? 'bg-[#0B1120] border-green-500/50 text-green-400 focus:border-green-400' : 'bg-slate-50 border-green-400 text-green-700 focus:border-green-500') : th.inputBg}`}
                />
                {!userCustomKey && (
                  <p className="text-[10px] text-slate-500 mt-3 leading-relaxed ml-1">
                    {t[lang].keyPrivacyDesc}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}