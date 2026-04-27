import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { AppSettings, saveRecord, addStuckSentence, getComponentState, saveComponentState, STORAGE_KEYS, WantType, getAreaSessions, saveAreaSession, deleteAreaSession, AreaSession, CustomArea, getCustomAreas, saveCustomArea, deleteCustomArea, saveCustomAreas } from '@/lib/store';
import { analyzeAreaAnswers, callAI, generateCustomAreaQuestions, generateDeepExploreQuestions } from '@/services/geminiService';
import { Loader2, ChevronRight, ChevronLeft, CheckCircle2, RefreshCcw, X, LogOut, Save, Zap, Plus, Calendar, Trash2, History, ArrowRight, FileText, Circle, CheckCircle, StickyNote, Settings2, Target, ArrowUp, ArrowDown, Mic } from 'lucide-react';
import { VoiceInput } from './VoiceInput';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const AREAS = [
  {
    id: 'wealth',
    title: '财富',
    description: '释放关于金钱、事业和匮乏感的想要。',
    questions: [
      '你贪恋金钱的哪些方面？我现在对它的感觉是什么？',
      '你厌恶金钱的哪些方面？我现在对它的感觉是什么？',
      '你生活中金钱跟想要控制的关联。我现在对它的感觉是什么？',
      '你生活中金钱跟想要认同的关联。我现在对它的感觉是什么？',
      '你生活中金钱跟想要安全的关联。我现在对它的感觉是什么？',
      '想象你的财富状况已经达到你完美预期。我现在对它的感觉是什么？',
      '想象你的财富状况永远达不到完美预期。我现在对它的感觉是什么？',
      '想象你永远都只有一点点钱。我现在对它的感觉是什么？',
      '想象从财富中彻底自由。我现在对它的感觉是什么？',
      '想象在这个世界里完全不用钱生活。我现在对它的感觉是什么？'
    ]
  },
  {
    id: 'relationship',
    title: '人际关系',
    description: '释放关于爱、归属感和他人评价的想要。',
    questions: [
      '你贪恋人际关系的哪些方面？我现在对它的感觉是什么？',
      '你厌恶人际关系的哪些方面？我现在对它的感觉是什么？',
      '你生活中人际关系跟想要控制的关联。我现在对它的感觉是什么？',
      '你生活中人际关系跟想要认同的关联。我现在对它的感觉是什么？',
      '你生活中人际关系跟想要安全的关联。我现在对它的感觉是什么？',
      '在人际关系中我是支配者吗？我现在对它的感觉是什么？',
      '在人际关系中我是被支配者吗？我现在对它的感觉是什么？',
      '人际关系中有哪些琐事。我现在对此的感觉是什么？',
      '我在什么时候感觉跟对方是分离的。我现在对此的感觉是什么？',
      '我在什么时候感觉跟对方一体的。我现在对此的感觉是什么？',
      '我认为这个人和我的关系有什么特殊性吗？我现在对此的感觉是什么？'
    ]
  },
  {
    id: 'appearance',
    title: '外貌',
    description: '释放关于身体形象和自我认同的想要。',
    questions: [
      '你贪恋外貌的哪些方面？我现在对它的感觉是什么？',
      '你厌恶外貌的哪些方面？我现在对它的感觉是什么？',
      '我的外貌跟想要控制的关联。我现在对它的感觉是什么？',
      '我的外貌跟想要认同的关联。我现在对它的感觉是什么？',
      '我的外貌跟想要安全的关联。我现在对它的感觉是什么？',
      '我的外貌与我的关系（比如：我的外貌代表我吗？）。我现在对此的感觉是什么？'
    ]
  },
  {
    id: 'sex',
    title: '性',
    description: '释放关于欲望、羞耻感和亲密关系的想要。',
    questions: [
      '性跟想要控制的关联。我现在对此的感觉是什么？',
      '性跟想要认同的关联。我现在对此的感觉是什么？',
      '性跟想要安全的关联。我现在对此的感觉是什么？',
      '你觉得性与快乐是什么关系？现在对此的感觉是什么？',
      '想象你彻底摆脱性的束缚。现在对此的感觉是什么？',
      '想象你再也不会有性。现在对此的感觉是什么？',
      '我能放下对我是这具身体的认同吗？现在对此的感觉是什么？'
    ]
  }
];

const SIX_STEPS = [
  "你必须想要‘波澜不惊’超过你想要‘被认可’、‘控制’或‘安全’吗？",
  "你决定通过释放来达到‘波澜不惊’吗？",
  "你能看到所有这些情绪感受都源自这三个想要吗？你能立即释放它们吗？",
  "你愿意在任何时候，无论独处或人前，都持续释放这些想要吗？",
  "如果你现在感到‘卡住了’，你愿意放开对这个‘卡住’的想要控制吗？",
  "你现在感到更轻松、更快乐了一点吗？"
];

const WANT_LABELS: Record<WantType, string> = {
  approval: '想要被认可',
  control: '想要控制',
  security: '想要安全',
};

const THREE_STEPS = [
  "你允许这种感觉存在吗？",
  "你能识别这是哪种想要吗？",
  "你能释放它吗？"
];

export default function AreaRelease({ settings }: { settings?: AppSettings }) {
  const [selectedArea, setSelectedArea] = useState<any>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.selectedArea || null);
  const [answers, setAnswers] = useState<string[]>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.answers || []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.analysis || null);
  const [step, setStep] = useState<'list' | 'area_history' | 'questions' | 'deep_questions' | 'analysis' | 'release' | 'history'>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.step || 'list');
  const [releaseIndex, setReleaseIndex] = useState(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.releaseIndex || 0);
  const [sixStepIndex, setSixStepIndex] = useState(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.sixStepIndex || 0);
  const [sessions, setSessions] = useState<AreaSession[]>([]);
  const [customAreas, setCustomAreas] = useState<CustomArea[]>([]);
  const [isCustomAreaDialogOpen, setIsCustomAreaDialogOpen] = useState(false);
  const [editingCustomArea, setEditingCustomArea] = useState<Partial<CustomArea> | null>(null);
  const [selectedTemplateForCustom, setSelectedTemplateForCustom] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<AreaSession | null>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.currentSession || null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [deepExploreProjectId, setDeepExploreProjectId] = useState<string | null>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.deepExploreProjectId || null);
  const [deepExploreRound, setDeepExploreRound] = useState<number>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.deepExploreRound || 0);
  const [deepExploreQuestions, setDeepExploreQuestions] = useState<string[]>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.deepExploreQuestions || []);
  const [isDeepExploring, setIsDeepExploring] = useState(false);
  const [swipedCardId, setSwipedCardId] = useState<string | null>(null);
  const swipeStartX = useRef(0);
  const swipeCurrentX = useRef(0);
  const [prevStepWasNegative, setPrevStepWasNegative] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [longPressArea, setLongPressArea] = useState<any | null>(null);
  const [areaToDelete, setAreaToDelete] = useState<string | null>(null);
  const isLongPressActive = useRef(false);
  const [releasedAreaIds, setReleasedAreaIds] = useState<{id: string, timestamp: number}[]>(() => {
    const data = localStorage.getItem(STORAGE_KEYS.RELEASED_AREAS);
    if (!data) return [];
    const parsed = JSON.parse(data);
    // Backward compatibility for string array
    if (parsed.length > 0 && typeof parsed[0] === 'string') {
      return parsed.map((id: string) => ({ id, timestamp: Date.now() }));
    }
    return parsed;
  });

  // Save releasedAreaIds to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RELEASED_AREAS, JSON.stringify(releasedAreaIds));
  }, [releasedAreaIds]);

  // Sync sessions on mount and periodic
  useEffect(() => {
    setSessions(getAreaSessions());
    setCustomAreas(getCustomAreas());
  }, []);

  const handleSaveCustomArea = () => {
    if (!editingCustomArea?.title) return;
    const newArea: CustomArea = {
      id: editingCustomArea.id || `custom_${Date.now()}`,
      title: editingCustomArea.title || '',
      description: editingCustomArea.description || '',
      questions: Array.isArray(editingCustomArea.questions) ? editingCustomArea.questions.filter(q => typeof q === 'string' && q.trim()) : []
    };
    saveCustomArea(newArea);
    setCustomAreas(getCustomAreas());
    setIsCustomAreaDialogOpen(false);
    setIsEditMode(false);
    setTimeout(() => {
      setEditingCustomArea(null);
    }, 300); // 延迟清理以防退出动画时崩溃
  };

  const handleDeleteCustomArea = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAreaToDelete(id);
  };

  const executeDeleteCustomArea = () => {
    if (areaToDelete) {
      deleteCustomArea(areaToDelete);
      setCustomAreas(getCustomAreas());
      setAreaToDelete(null);
    }
  };

  const handleMoveCustomArea = (id: string, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    const areas = [...customAreas];
    const index = areas.findIndex(a => a.id === id);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [areas[index - 1], areas[index]] = [areas[index], areas[index - 1]];
    } else if (direction === 'down' && index < areas.length - 1) {
      [areas[index + 1], areas[index]] = [areas[index], areas[index + 1]];
    } else {
      return;
    }

    saveCustomAreas(areas);
    setCustomAreas(areas);
  };

const PREDEFINED_TEMPLATES = [
  {
    id: "study",
    title: "学业",
    description: "释放关于学习压力、成绩焦虑、考试恐惧的想要。",
    questions: [
      "关于学业状况，你最担心的是什么？我现在对它的感觉是什么？",
      "针对你目前的成绩，你的掌控欲有多强？我现在对它的感觉是什么？",
      "你在学业上这么努力/焦虑，是为了获得谁的认同？我现在对它的感觉是什么？",
      "如果把所有的学业压力都当成是对安全的渴望，你现在的感觉是什么？",
      "想象你的考试或学业彻底搞砸了。我现在对它的感觉是什么？",
      "想象你已经掌握了所有的知识，成绩完美。我现在对它的感觉是什么？",
      "你能允许自己目前的学习状态/成绩存在吗？"
    ]
  },
  {
    id: "career",
    title: "事业",
    description: "释放关于工作表现、职场关系、未来发展的想要。",
    questions: [
      "你在工作中最想要控制什么？我现在对它的感觉是什么？",
      "你在职场中最渴望谁的认同？我现在对它的感觉是什么？",
      "如果失去这份工作或搞砸这个项目，你最害怕什么？我现在对它的感觉是什么？",
      "想象你的事业已经达到了巅峰。我现在对它的感觉是什么？",
      "想象你的事业彻底停摆，一事无成。我现在对它的感觉是什么？",
      "你现在能允许你工作中的任何现状存在吗？"
    ]
  },
  {
    id: "family",
    title: "原生家庭",
    description: "释放关于成长环境、父母关系、童年模式的想要。",
    questions: [
      "你对原生家庭最抗拒的模式或特质是什么？我现在对它的感觉是什么？",
      "在潜意识里，你一直想要改变父母/家人的什么？我现在对它的感觉是什么？",
      "你一直渴望从家人那里得到什么没有得到的认同？我现在对它的感觉是什么？",
      "原生家庭的种种模式如何与你对安全的匮乏感挂钩？我现在对它的感觉是什么？",
      "如果家人永远都不会改变他们现在的样子。我现在对它的感觉是什么？",
      "我能允许这整个原生家庭本来的面貌存在吗？"
    ]
  },
  {
    id: "sp",
    title: "特定对象 (SP)",
    description: "释放关于特定的人（前任、暗恋对象、伴侣等）的执念与纠缠。",
    questions: [
      "你在这段关系（或这个人身上）最抗拒面对的是什么？我现在对它的感觉是什么？",
      "你在多大程度上想控制ta的想法、行为或你们之间的走向？我现在对它的感觉是什么？",
      "你多么想要得到ta的认同或爱？我现在对此的感觉是什么？",
      "如果ta永远消失在你的生命中，彻底离开了。我觉得安全感被摧毁了吗？我现在对它的感觉是什么？",
      "想象ta现在如你所愿地疯狂爱上你。我现在对它的感觉是什么？",
      "你能放开对这个人的执念，允许现状存在吗？"
    ]
  }
];

  const handleGenerateQuestions = async () => {
    if (!editingCustomArea?.title) return;
    setIsGeneratingQuestions(true);
    try {
      const generatedQ = await generateCustomAreaQuestions(editingCustomArea.title, undefined, {
        model_type: settings?.selectedModel,
        invite_code: settings?.inviteCode,
        aiBaseUrl: settings?.useCustomConfig ? settings?.aiBaseUrl : undefined,
        aiApiKey: settings?.useCustomConfig ? settings?.aiApiKey : undefined,
        aiModelName: settings?.useCustomConfig ? settings?.aiModelName : undefined
      });
      if (generatedQ && generatedQ.length > 0) {
        setEditingCustomArea(prev => prev ? { ...prev, questions: generatedQ } : null);
      }
    } catch (e) {
      console.error(e);
      alert('生成问题失败，请重试');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const applyTemplateToCustomArea = (templateId: string) => {
    setSelectedTemplateForCustom(templateId);
    if (!templateId) return;
    const tpl = PREDEFINED_TEMPLATES.find(a => a.id === templateId);
    if (tpl && editingCustomArea) {
      setEditingCustomArea({
        ...editingCustomArea,
        title: tpl.title,
        description: tpl.description,
        questions: [...tpl.questions]
      });
    }
  };

  const toggleAreaReleased = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReleasedAreaIds(prev => 
      prev.find(i => i.id === id) 
        ? prev.filter(i => i.id !== id) 
        : [...prev, { id, timestamp: Date.now() }]
    );
      setSwipedCardId(null);
  };

  const handleSwipeStart = (areaId: string, clientX: number) => {
    if (isEditMode) return;
    swipeStartX.current = clientX;
    swipeCurrentX.current = clientX;
    setSwipedCardId(areaId);
  };

  const handleSwipeMove = (clientX: number) => {
    swipeCurrentX.current = clientX;
  };

  const handleSwipeEnd = (areaId: string) => {
    const delta = swipeStartX.current - swipeCurrentX.current;
    if (delta > 60) {
      setSwipedCardId(areaId);
    } else {
      setSwipedCardId(null);
    }
  };

  const allAreas = [...AREAS, ...customAreas];

  // Resolve current active steps and labels
  const getAssignment = () => {
    const groupId = settings?.moduleAssignments?.area;
    return settings?.questionGroups?.find(g => g.id === groupId);
  };

  const getEffectiveSteps = (index: number, mode: 'sequential' | 'single') => {
    const group = getAssignment();
    if (group && group.steps.length > 0) {
      return group.steps.map(s => s.question);
    }
    
    if (settings?.useDefaultQuestions !== false) {
      return THREE_STEPS;
    }
    
    return THREE_STEPS; // Fallback
  };

  const getStepContent = () => {
    const group = getAssignment();

    if (isSubQuestion) {
      if (group && group.steps[sixStepIndex]?.hasBranch) {
        return group.steps[sixStepIndex].branchQuestion || '你想补充什么吗？';
      }
      if (activeSteps === THREE_STEPS && (sixStepIndex === 0 || sixStepIndex === 1)) {
        const wants = analysis?.list?.[releaseIndex]?.w || [];
        const wantLabels = wants.map((w: any) => WANT_LABELS[w as WantType]).filter(Boolean).join('、');
        return `你能识别这是${wantLabels || '哪种想要'}吗？`;
      }
      return '你能识别这是哪种想要吗？';
    }

    const stepText = activeSteps[sixStepIndex];
    
    if (activeSteps === THREE_STEPS) {
      if (sixStepIndex === 0) return `你允许这种感觉存在吗？`;
      if (sixStepIndex === 1) {
        if (prevStepWasNegative) {
          const currentItem = analysis?.list?.[releaseIndex];
          const wants = currentItem?.w || [];
          const wantLabels = wants.map((w: any) => WANT_LABELS[w as WantType]).filter(Boolean).join('、');
          return `你能识别这是${wantLabels || '哪种想要'}吗？`;
        }
        return `你能识别这是哪种想要吗？`;
      }
      if (sixStepIndex === 2) return `你能释放它吗？`;
    }
    
    return stepText;
  };

  const getButtonLabels = () => {
    const group = getAssignment();
    
    if (isSubQuestion) {
      if (group && group.steps[sixStepIndex]?.hasBranch) {
        const branchText = group.steps[sixStepIndex].branchQuestion || '';
        if (branchText.includes('允许')) return { primary: '允许', secondary: '不允许' };
        if (branchText.includes('愿意')) return { primary: '愿意', secondary: '不愿意' };
        if (branchText.includes('能') || branchText.includes('可以')) return { primary: '能', secondary: '不能' };
        if (branchText.includes('什么时候') || branchText.includes('何时')) return { primary: '现在', secondary: '以后' };
      }
      return { primary: '能', secondary: '不能' };
    }

    if (group && group.steps[sixStepIndex]) {
      return { 
        primary: group.steps[sixStepIndex].positive || '能', 
        secondary: group.steps[sixStepIndex].negative || '不能' 
      };
    }

    const stepText = activeSteps[sixStepIndex];
    if (stepText.includes('允许')) return { primary: '允许', secondary: '不允许' };
    if (stepText.includes('愿意')) return { primary: '愿意', secondary: '不愿意' };
    if (stepText.includes('能') || stepText.includes('可以')) return { primary: '能', secondary: '不能' };
    if (stepText.includes('什么时候') || stepText.includes('何时')) return { primary: '现在', secondary: '以后' };
    
    return { primary: '能', secondary: '不能' };
  };

  const [activeSteps, setActiveSteps] = useState<string[]>(SIX_STEPS);
  const [isSequential, setIsSequential] = useState(true);
  const [isSentenceFinished, setIsSentenceFinished] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [releasedIndices, setReleasedIndices] = useState<number[]>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.releasedIndices || []);
  const [skippedIndices, setSkippedIndices] = useState<number[]>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.skippedIndices || []);
  const [isSubQuestion, setIsSubQuestion] = useState(false);
  const [isMoreReleaseOpen, setIsMoreReleaseOpen] = useState(false);
  const [moreReleaseEmotion, setMoreReleaseEmotion] = useState('');
  const [moreReleaseWants, setMoreReleaseWants] = useState<WantType[]>([]);

  // Save state on changes
  useEffect(() => {
    saveComponentState(STORAGE_KEYS.AREA_STATE, {
      selectedArea,
      answers,
      analysis,
      step,
      releaseIndex,
      releasedIndices,
      skippedIndices,
      sixStepIndex,
      currentSession,
      deepExploreProjectId,
      deepExploreRound,
      deepExploreQuestions
    });
  }, [selectedArea, answers, analysis, step, releaseIndex, releasedIndices, skippedIndices, sixStepIndex, currentSession, deepExploreProjectId, deepExploreRound, deepExploreQuestions]);

  const startArea = (area: any) => {
    setSelectedArea(area);
    setStep('area_history');
    setCurrentSession(null);
    setDeepExploreProjectId(null);
    setDeepExploreRound(0);
    setDeepExploreQuestions([]);
  };

  const startNewAnalysis = () => {
    if (!selectedArea) return;
    setDeepExploreProjectId(null);
    setDeepExploreRound(0);
    setDeepExploreQuestions([]);
    setAnswers(new Array(selectedArea.questions.length).fill(''));
    setStep('questions');
    setCurrentSession(null);
  };

  const loadSession = (session: AreaSession) => {
    const area = allAreas.find(a => a.id === session.areaId);
    if (!area) return;
    setSelectedArea(area);
    setAnalysis({
      list: session.list,
      sum: session.sum
    });
    setCurrentSession(session);
    setReleasedIndices(session.list.map((item, idx) => item.released ? idx : -1).filter(i => i !== -1));
    setReleaseIndex(0);
    setSixStepIndex(0);
    setStep('analysis');
    if (session.projectId) {
      setDeepExploreProjectId(session.projectId);
      setDeepExploreRound(session.round || 1);
    }
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteAreaSession(id);
    setSessions(getAreaSessions());
    if (currentSession?.id === id) {
      setCurrentSession(null);
      if (selectedArea) {
        setStep('area_history');
        setAnalysis(null);
        setAnswers([]);
        setReleaseIndex(0);
        setSixStepIndex(0);
      } else {
        reset();
      }
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setStep('analysis');
    setAnalysis({ list: [], w: [], sum: '' });
    setReleasedIndices([]);
    setSkippedIndices([]);
    setReleaseIndex(0);
    setSixStepIndex(0);
    try {
      const result = await analyzeAreaAnswers(
        selectedArea.title, 
        selectedArea.questions, 
        answers, 
        (partial) => {
          const answeredIndices = answers.map((a, i) => a.trim() ? i : -1).filter(i => i !== -1);
          if (partial.list) {
            partial.list = partial.list.map((item: any, idx: number) => {
              const originalAnswer = answers[answeredIndices[idx]];
              return {
                ...item,
                ans: originalAnswer
              };
            });
          }
          setAnalysis(partial);
        },
        {
          model_type: settings?.selectedModel || 'MINIMAX25',
          invite_code: settings?.inviteCode || '',
          aiBaseUrl: settings?.useCustomConfig ? settings?.aiBaseUrl : undefined,
          aiApiKey: settings?.useCustomConfig ? settings?.aiApiKey : undefined,
          aiModelName: settings?.useCustomConfig ? settings?.aiModelName : undefined
        }
      );
      
      // Merge user answers into the analysis list for display during release
      const answeredIndices = answers.map((a, i) => a.trim() ? i : -1).filter(i => i !== -1);
      if (result.list) {
        result.list = result.list.map((item: any, idx: number) => {
          const originalAnswer = answers[answeredIndices[idx]];
          return {
            ...item,
            ans: originalAnswer
          };
        });
      }
      
      setAnalysis(result);
      
      // Generate projectId for the first round of deep exploration
      const projectId = crypto.randomUUID();
      setDeepExploreProjectId(projectId);
      setDeepExploreRound(1);
      
      // Create new area session
      const newSession = saveAreaSession({
        areaId: selectedArea.id,
        name: `${selectedArea.title} 领域释放`,
        list: result.list,
        sum: result.sum,
        projectId,
        round: 1
      });
      setCurrentSession(newSession);
      setSessions(getAreaSessions());
      
      // Auto save record
      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'area',
        content: `${selectedArea.title} 领域释放`,
        analysis: {
          list: result.list,
          ana: result.sum
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error(error);
      alert(error.message || '分析失败，请检查 Worker 配置或网络');
      setStep('questions');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeepExplore = async (session?: AreaSession) => {
    const targetSession = session || currentSession;
    if (!targetSession) return;
    setIsDeepExploring(true);
    try {
      const previousQA = targetSession.list
        .filter(item => item.ans || item.s)
        .map(item => ({
          q: item.q || '',
          a: item.ans || item.s || '',
          analysis: item.a || '',
          wants: item.w || []
        }));

      const newRound = (targetSession.round || 1) + 1;
      const newQuestions = await generateDeepExploreQuestions(
        selectedArea.title,
        previousQA,
        newRound,
        undefined,
        {
          model_type: settings?.selectedModel || 'MINIMAX25',
          invite_code: settings?.inviteCode || '',
          aiBaseUrl: settings?.useCustomConfig ? settings?.aiBaseUrl : undefined,
          aiApiKey: settings?.useCustomConfig ? settings?.aiApiKey : undefined,
          aiModelName: settings?.useCustomConfig ? settings?.aiModelName : undefined
        }
      );

      if (newQuestions && newQuestions.length > 0) {
        setDeepExploreQuestions(newQuestions);
        setDeepExploreRound(newRound);
        setDeepExploreProjectId(targetSession.projectId || '');
        setCurrentSession(targetSession);
        setAnswers(new Array(newQuestions.length).fill(''));
        setStep('deep_questions');
      } else {
        alert('未能生成新的深度问句，请重试');
      }
    } catch (e) {
      console.error(e);
      alert('深度探索生成失败，请重试');
    } finally {
      setIsDeepExploring(false);
    }
  };

  const handleDeepExploreFromLatest = async () => {
    const areaSessions = sessions
      .filter(s => s.areaId === selectedArea.id)
      .sort((a, b) => b.timestamp - a.timestamp);
    if (areaSessions.length === 0) return;
    await handleDeepExplore(areaSessions[0]);
  };

  const handleDeepAnalyze = async () => {
    setIsAnalyzing(true);
    setStep('analysis');
    setAnalysis({ list: [], w: [], sum: '' });
    setReleasedIndices([]);
    setSkippedIndices([]);
    setReleaseIndex(0);
    setSixStepIndex(0);
    try {
      const result = await analyzeAreaAnswers(
        selectedArea.title,
        deepExploreQuestions,
        answers,
        (partial) => {
          const answeredIndices = answers.map((a, i) => a.trim() ? i : -1).filter(i => i !== -1);
          if (partial.list) {
            partial.list = partial.list.map((item: any, idx: number) => {
              const originalAnswer = answers[answeredIndices[idx]];
              return {
                ...item,
                ans: originalAnswer
              };
            });
          }
          setAnalysis(partial);
        },
        {
          model_type: settings?.selectedModel || 'MINIMAX25',
          invite_code: settings?.inviteCode || '',
          aiBaseUrl: settings?.useCustomConfig ? settings?.aiBaseUrl : undefined,
          aiApiKey: settings?.useCustomConfig ? settings?.aiApiKey : undefined,
          aiModelName: settings?.useCustomConfig ? settings?.aiModelName : undefined
        }
      );

      const answeredIndices = answers.map((a, i) => a.trim() ? i : -1).filter(i => i !== -1);
      if (result.list) {
        result.list = result.list.map((item: any, idx: number) => {
          const originalAnswer = answers[answeredIndices[idx]];
          return {
            ...item,
            ans: originalAnswer
          };
        });
      }

      setAnalysis(result);

      const newRound = deepExploreRound || 2;
      const newSession = saveAreaSession({
        areaId: selectedArea.id,
        name: `${selectedArea.title} 深度探索 第${newRound}轮`,
        list: result.list,
        sum: result.sum,
        projectId: deepExploreProjectId || '',
        round: newRound
      });
      setCurrentSession(newSession);
      setSessions(getAreaSessions());

      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'area',
        content: `${selectedArea.title} 深度探索 第${newRound}轮`,
        analysis: {
          list: result.list,
          ana: result.sum
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error(error);
      alert(error.message || '分析失败，请检查 Worker 配置或网络');
      setStep('deep_questions');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startRelease = (index: number, mode: 'sequential' | 'single') => {
    setStep('release');
    setReleaseIndex(index);
    setSixStepIndex(0);
    setPrevStepWasNegative(false);
    setSkippedIndices([]);
    setIsSequential(mode === 'sequential');
    setIsSentenceFinished(false);
    if (mode === 'sequential') {
      setReleasedIndices([]);
    }
    
    setActiveSteps(getEffectiveSteps(index, mode));
  };

  const nextReleaseStep = (isPrimary: boolean) => {
    const group = getAssignment();
    
    // Check custom group step branch logic first
    if (!isSentenceFinished && !isPrimary && !isSubQuestion && group && group.steps[sixStepIndex]?.hasBranch) {
      setIsSubQuestion(true); // Reusing isSubQuestion state for branch to keep UI simple
      return;
    }

    // Original hardcoded logic for sub-question on step 2 for THREE_STEPS
    if (!isSentenceFinished && sixStepIndex === 1 && !isPrimary && activeSteps === THREE_STEPS && !isSubQuestion) {
      setIsSubQuestion(true);
      return;
    }

    if (isSubQuestion) {
      setIsSubQuestion(false);
    }

    // Update negative response tracking
    setPrevStepWasNegative(!isPrimary && !isSubQuestion);

    if (sixStepIndex < activeSteps.length - 1) {
      setSixStepIndex(sixStepIndex + 1);
    } else {
      setIsSentenceFinished(true);
    }
  };

  const continueRelease = () => {
    const newReleased = [...releasedIndices, releaseIndex];
    setReleasedIndices(newReleased);
    setPrevStepWasNegative(false);
    
    // Persist to session
    if (currentSession && analysis) {
      const newList = [...analysis.list];
      newList[releaseIndex] = { ...newList[releaseIndex], released: true };
      const updatedSession = saveAreaSession({
        ...currentSession,
        list: newList,
        sum: analysis.sum
      });
      setCurrentSession(updatedSession);
      setSessions(getAreaSessions());
      setAnalysis({ ...analysis, list: newList });
    }
    
    setIsSentenceFinished(false);
    if (isSequential && releaseIndex < analysis.list.length - 1) {
      setReleaseIndex(releaseIndex + 1);
      setSixStepIndex(0);
      setActiveSteps(getEffectiveSteps(releaseIndex + 1, isSequential ? 'sequential' : 'single'));
    } else {
      if (isSequential) {
        if (isAnalyzing) {
          setStep('analysis');
        } else {
          finishRelease(newReleased);
        }
      } else {
        // Single release finished
        if (analysis.list.length > 0 && newReleased.length + skippedIndices.length === analysis.list.length) {
          if (isAnalyzing) {
            setStep('analysis');
          } else {
            finishRelease(newReleased);
          }
        } else {
          setStep('analysis');
          // For single release, also mark as released
          finishRelease(newReleased);
        }
      }
    }
  };

  const reRelease = () => {
    setSixStepIndex(0);
    setPrevStepWasNegative(false);
    setIsSentenceFinished(false);
  };

  const toggleSentenceReleased = (index: number) => {
    const newReleased = releasedIndices.includes(index) 
      ? releasedIndices.filter(i => i !== index)
      : [...releasedIndices, index];
    setReleasedIndices(newReleased);
    
    if (currentSession && analysis) {
      const newList = [...analysis.list];
      newList[index] = { ...newList[index], released: !newList[index].released };
      const updatedSession = saveAreaSession({
        ...currentSession,
        list: newList,
        sum: analysis.sum
      });
      setCurrentSession(updatedSession);
      setSessions(getAreaSessions());
      setAnalysis({ ...analysis, list: newList });
    }
  };

  const handleMoreRelease = () => {
    if (!moreReleaseEmotion.trim() || moreReleaseWants.length === 0) return;
    
    // Create a NEW item based on current sentence plus more release insight
    const currentItem = analysis.list[releaseIndex];
    const newItem = {
      s: `(更深) ${moreReleaseEmotion}`,
      w: moreReleaseWants,
      a: `针对“${moreReleaseEmotion}”的进一步挖掘 (原课题: ${currentItem.q})`,
      q: currentItem.q,
      round: (currentItem.round || 1) + 1,
      released: false,
      ans: moreReleaseEmotion
    };
    
    const newList = [...analysis.list, newItem];
    const newAnalysis = { ...analysis, list: newList };
    
    if (currentSession) {
      const updatedSession = saveAreaSession({
        ...currentSession,
        list: newList
      });
      setCurrentSession(updatedSession);
      setSessions(getAreaSessions());
    }
    
    setAnalysis(newAnalysis);
    setMoreReleaseEmotion('');
    setMoreReleaseWants([]);
    setIsMoreReleaseOpen(false);
    
    // Jump to the newly added item
    setReleaseIndex(newList.length - 1);
    reRelease();
  };

  const toggleMoreWant = (want: WantType) => {
    setMoreReleaseWants(prev => 
      prev.includes(want) ? prev.filter(w => w !== want) : [...prev, want]
    );
  };

  const skipSentence = () => {
    const newSkipped = [...skippedIndices, releaseIndex];
    setSkippedIndices(newSkipped);
    if (isSequential && releaseIndex < analysis.list.length - 1) {
      setReleaseIndex(releaseIndex + 1);
      setSixStepIndex(0);
      setActiveSteps(getEffectiveSteps(releaseIndex + 1, isSequential ? 'sequential' : 'single'));
    } else {
      if (isSequential) {
        if (isAnalyzing) {
          setStep('analysis');
        } else {
          finishRelease();
        }
      } else {
        // Single release finished
        if (analysis.list.length > 0 && releasedIndices.length + newSkipped.length === analysis.list.length) {
          if (isAnalyzing) {
            setStep('analysis');
          } else {
            finishRelease();
          }
        } else {
          setStep('analysis');
        }
      }
    }
  };

  const handleQuit = (moveToStuck: boolean) => {
    if (moveToStuck) {
      analysis.list.forEach((s: any, i: number) => {
        if (!releasedIndices.includes(i)) {
          addStuckSentence({
            text: s.s,
            wants: [],
            analysis: s.a,
            source: `${selectedArea.title}领域释放`
          });
        }
      });
    }
    
    // Save progress before quitting
    finishRelease();
    setShowQuitDialog(false);
  };

  const toggleWant = (sentenceIndex: number, want: WantType) => {
    const newAnalysis = { ...analysis };
    const wants = [...(newAnalysis.list[sentenceIndex].w || [])];
    if (wants.includes(want)) {
      newAnalysis.list[sentenceIndex].w = wants.filter((w: string) => w !== want);
    } else {
      newAnalysis.list[sentenceIndex].w = [...wants, want];
    }
    setAnalysis(newAnalysis);
  };

  const removeSentence = (index: number) => {
    const newAnalysis = { ...analysis };
    newAnalysis.list.splice(index, 1);
    
    // Adjust released and skipped indices
    const newReleased = releasedIndices
      .filter(i => i !== index)
      .map(i => i > index ? i - 1 : i);
    const newSkipped = skippedIndices
      .filter(i => i !== index)
      .map(i => i > index ? i - 1 : i);
    
    setReleasedIndices(newReleased);
    setSkippedIndices(newSkipped);

    if (newAnalysis.list.length === 0) {
      if (selectedArea) {
        setStep('area_history');
        setAnalysis(null);
        setAnswers([]);
        setReleaseIndex(0);
        setSixStepIndex(0);
        setCurrentSession(null);
      } else {
        reset();
      }
    } else {
      setAnalysis(newAnalysis);
      // Check if all remaining are processed
      if (newAnalysis.list.length > 0 && newReleased.length + newSkipped.length === newAnalysis.list.length) {
        finishRelease();
      }
    }
  };

  const restartRelease = () => {
    setReleaseIndex(0);
    setSixStepIndex(0);
    setIsSentenceFinished(false);
    setReleasedIndices([]);
  };

  const updateSentenceNote = (index: number, note: string) => {
    const newAnalysis = { ...analysis };
    newAnalysis.list[index].note = note;
    setAnalysis(newAnalysis);
  };

  const finishRelease = (forceReleasedIndices?: number[]) => {
    if (analysis && analysis.list) {
      const finalReleased = forceReleasedIndices || releasedIndices;
      const shouldAutoMark = (settings as any)?.autoMarkReleased !== false;

      // Mark as released in analysis list
      const newList = analysis.list.map((item: any, idx: number) => ({
        ...item,
        released: item.released || (shouldAutoMark && (finalReleased.includes(idx) || (isSentenceFinished && idx === releaseIndex)))
      }));
      
      const newAnalysis = { ...analysis, list: newList };
      setAnalysis(newAnalysis);
      
      if (currentSession) {
        const updatedSession = saveAreaSession({
          ...currentSession,
          list: newList,
          sum: analysis.sum
        });
        setCurrentSession(updatedSession);
        setSessions(getAreaSessions());
      }

      // Save record explicitly with updated list
      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'area',
        content: `${selectedArea.title} 领域释放`,
        analysis: {
          list: newList,
          ana: analysis.sum
        },
        timestamp: Date.now()
      });
    }

    if (selectedArea) {
      setStep('area_history');
      setAnalysis(null);
      setAnswers([]);
      setReleaseIndex(0);
      setSixStepIndex(0);
      setCurrentSession(null);
      setReleasedIndices([]);
      setSkippedIndices([]);
      setIsSentenceFinished(false);
    } else {
      reset();
    }
  };

  const handleManualSave = () => {
    if (!analysis) return;
    
    if (currentSession) {
      const updatedSession = saveAreaSession({
        ...currentSession,
        list: analysis.list,
        sum: analysis.sum
      });
      setCurrentSession(updatedSession);
      setSessions(getAreaSessions());
    }

    saveRecord({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'area',
      content: `${selectedArea.title} 领域释放`,
      analysis: {
        list: analysis.list,
        ana: analysis.sum
      },
      timestamp: Date.now()
    });
    alert('记录已手动保存');
  };

  const reset = () => {
    setStep('list');
    setSelectedArea(null);
    setAnalysis(null);
    setAnswers([]);
    setReleaseIndex(0);
    setSixStepIndex(0);
    setPrevStepWasNegative(false);
    setCurrentSession(null);
    setDeepExploreProjectId(null);
    setDeepExploreRound(0);
    setDeepExploreQuestions([]);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {step === 'list' && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="flex justify-between items-center px-1.5 md:px-2">
              <h2 className="text-lg font-serif font-bold text-foreground">领域释放</h2>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`text-xs px-3 h-8 rounded-full transition-all ${isEditMode ? 'bg-accent/10 text-accent font-bold ring-1 ring-accent/20' : 'text-muted-foreground hover:bg-accent/5 hover:text-accent'}`}
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  {isEditMode ? '完成' : '编辑'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-accent/20 text-accent hover:bg-accent/5 h-8 rounded-full"
                  onClick={() => setStep('history')}
                >
                  <History className="w-3.5 h-3.5" /> 全部记录
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 px-1.5 md:px-2">
              {allAreas.map((area) => {
                const isReleased = !!releasedAreaIds.find(i => i.id === area.id);
                const isSwiped = swipedCardId === area.id;
                return (
                  <div key={area.id} className="relative overflow-hidden rounded-xl">
                    {!isEditMode && isSwiped && (
                      <div className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center z-0">
                        <Button
                          size="sm"
                          className={`h-full w-full rounded-xl text-xs font-bold ${isReleased ? 'bg-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/30' : 'bg-success/90 hover:bg-success text-white'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAreaReleased(area.id, e);
                          }}
                        >
                          {isReleased ? '取消' : '完成'}
                        </Button>
                      </div>
                    )}
                    <Card 
                      className={`cursor-pointer hover:shadow-2xl transition-all border border-border/30 bg-card/45 backdrop-blur-sm group relative ${!isEditMode && swipedCardId !== area.id ? 'hover:scale-[1.02]' : ''}`}
                      style={{
                        transform: !isEditMode && swipedCardId === area.id ? 'translateX(-5rem)' : 'translateX(0)',
                        transition: 'transform 0.2s ease',
                        position: 'relative',
                        zIndex: 10,
                      }}
                      onPointerDown={(e) => {
                        if (isEditMode) return;
                        swipeStartX.current = e.clientX;
                        swipeCurrentX.current = e.clientX;
                        isLongPressActive.current = false;
                        const timer = setTimeout(() => {
                          isLongPressActive.current = true;
                          setLongPressArea(area);
                        }, 600);
                        const clearTimer = () => {
                          clearTimeout(timer);
                          window.removeEventListener('pointerup', clearTimer);
                          window.removeEventListener('pointermove', clearTimer);
                        };
                        window.addEventListener('pointerup', clearTimer);
                        window.addEventListener('pointermove', clearTimer);
                      }}
                      onPointerMove={(e) => {
                        if (isEditMode || isLongPressActive.current) return;
                        handleSwipeMove(e.clientX);
                      }}
                      onPointerUp={(e) => {
                        if (isEditMode || isLongPressActive.current) return;
                        handleSwipeEnd(area.id);
                      }}
                      onClick={(e) => {
                        if (isLongPressActive.current) {
                          e.preventDefault();
                          return;
                        }
                        if (swipedCardId && swipedCardId !== area.id) {
                          setSwipedCardId(null);
                          return;
                        }
                        if (!isEditMode) {
                          startArea(area);
                        }
                      }}
                    >
                      <CardHeader className="p-4 md:p-6">
                        <div className="flex items-center justify-between group">
                          <CardTitle className={`font-serif text-base md:text-lg transition-colors group-hover:text-accent ${isReleased ? '' : ''}`}>
                            {area.title}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            {isReleased && (
                              <Badge variant="outline" className="text-[8px] h-4 px-1 border-success text-success bg-success/10">
                                已完成
                              </Badge>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                          </div>
                        </div>
                        <CardDescription className="text-[10px] md:text-xs leading-relaxed mt-1">{area.description}</CardDescription>
                      </CardHeader>

                      {isEditMode && customAreas.find(ca => ca.id === area.id) && (
                        <div className="absolute top-2 right-2 flex gap-1 bg-background/90 backdrop-blur-md rounded-lg p-1 z-10 shadow-sm border border-accent/20 animate-in fade-in zoom-in duration-200">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-accent"
                        onClick={(e) => handleMoveCustomArea(area.id, 'up', e)}
                        disabled={customAreas.findIndex(ca => ca.id === area.id) === 0}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-accent"
                        onClick={(e) => handleMoveCustomArea(area.id, 'down', e)}
                        disabled={customAreas.findIndex(ca => ca.id === area.id) === customAreas.length - 1}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-accent"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCustomArea(area);
                          setIsCustomAreaDialogOpen(true);
                        }}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteCustomArea(area.id, e)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
            );
          })}

        {isEditMode && (
                <Card 
                  className="cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all border border-dashed border-accent/30 bg-card/35 backdrop-blur-sm group"
                  onClick={() => {
                    setEditingCustomArea({ title: '', description: '', questions: [''] });
                    setSelectedTemplateForCustom('');
                    setIsCustomAreaDialogOpen(true);
                  }}
                >
                  <CardHeader className="p-4 md:p-6">
                    <CardTitle className="font-serif text-base md:text-lg flex items-center gap-2 group-hover:text-accent transition-colors text-muted-foreground">
                      <Plus className="w-4 h-4 md:w-5 md:h-5 text-accent" />
                      添加自定义主模块
                    </CardTitle>
                    <CardDescription className="text-[10px] md:text-xs leading-relaxed text-muted-foreground/60">
                      创建你专属的释放领域
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>

            <Button
              size="icon"
              className={`fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full shadow-2xl transition-all duration-300 ${isEditMode ? 'bg-primary text-primary-foreground rotate-90' : 'bg-card/90 backdrop-blur-md border border-border/40 text-muted-foreground hover:text-primary'}`}
              onClick={() => setIsEditMode(!isEditMode)}
              title={isEditMode ? '完成编辑' : '编辑模块'}
            >
              <Settings2 className="w-5 h-5" />
            </Button>
          </motion.div>
        )}

        {step === 'area_history' && selectedArea && (
          <motion.div key="area_history" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-6 px-1.5 md:px-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep('list')} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> 返回
              </Button>
              <div className="text-center">
                <Badge variant="outline" className="border-accent text-accent text-[10px] uppercase tracking-widest mb-1">专题探索</Badge>
                <h2 className="text-xl font-serif font-bold text-foreground">{selectedArea.title}</h2>
              </div>
              <div className="w-20" />
            </div>

            <Card className="border-none bg-accent/5 shadow-inner">
              <CardContent className="p-6 text-center space-y-4">
                {(() => {
                  const areaSessions = sessions
                    .filter(s => s.areaId === selectedArea.id)
                    .sort((a, b) => b.timestamp - a.timestamp);
                  const hasHistory = areaSessions.length > 0;
                  return (
                    <>
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-sm ${hasHistory ? 'bg-primary/20' : 'bg-accent/20'}`}>
                        <Target className={`w-8 h-8 ${hasHistory ? 'text-primary' : 'text-accent'}`} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-serif text-lg font-bold">{hasHistory ? '继续深入探索' : '新解析探索'}</h3>
                        <p className="text-xs text-muted-foreground">
                          {hasHistory
                            ? `基于最新历史记录（${areaSessions[0].name}），AI 生成更深入的释放问句。`
                            : `通过一系列引导问句，深入解析当前在 ${selectedArea.title} 方面的想要。`}
                        </p>
                      </div>
                      <div className="flex flex-col gap-3">
                        {hasHistory && (
                          <Button 
                            className="w-full h-12 bg-primary hover:bg-accent text-primary-foreground rounded-xl shadow-lg gap-2 font-bold" 
                            onClick={handleDeepExploreFromLatest}
                            disabled={isDeepExploring}
                          >
                            {isDeepExploring ? <Loader2 className="animate-spin w-5 h-5" /> : <Target className="w-5 h-5" />} 继续深入
                          </Button>
                        )}
                        <Button 
                          variant="outline"
                          className="w-full h-12 border-primary/40 text-primary hover:bg-primary/5 rounded-xl gap-2" 
                          onClick={startNewAnalysis}
                        >
                          <Plus className="w-5 h-5" /> {hasHistory ? '开启新探索' : '开启深度探索'}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-xs font-serif font-bold text-muted-foreground uppercase tracking-widest px-1">历史解析记录</h3>
              <ScrollArea className="h-[45vh] pr-4">
                <div className="space-y-6">
                  {Object.entries(
                    sessions
                      .filter(s => s.areaId === selectedArea.id)
                      .reduce((acc: Record<string, AreaSession[]>, session) => {
                        if (!acc[session.date]) acc[session.date] = [];
                        acc[session.date].push(session);
                        return acc;
                      }, {})
                  ).length === 0 ? (
                    <div className="text-center py-20 italic text-muted-foreground opacity-50">
                      尚未进行过 {selectedArea.title} 专题的深度解析记录
                    </div>
                  ) : (
                    Object.entries(
                      sessions
                        .filter(s => s.areaId === selectedArea.id)
                        .reduce((acc: Record<string, AreaSession[]>, session) => {
                          if (!acc[session.date]) acc[session.date] = [];
                          acc[session.date].push(session);
                          return acc;
                        }, {})
                    ).sort(([a], [b]) => b.localeCompare(a)).map(([date, dateSessions]) => (
                      <div key={date} className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                          <Calendar className="w-3 h-3 text-accent/60" />
                          <span className="text-[10px] font-bold text-muted-foreground tracking-widest">{date}</span>
                          <div className="flex-grow h-[1px] bg-border/20" />
                        </div>
                        <div className="grid gap-3">
                          {dateSessions.sort((a,b) => b.timestamp - a.timestamp).map((session) => (
                            <Card 
                              key={session.id} 
                              className="p-4 bg-card/40 backdrop-blur-sm border-none shadow-sm hover:shadow-md transition-all cursor-pointer group"
                              onClick={() => loadSession(session)}
                            >
                              <div className="flex items-center gap-4">
                                <div className="p-2.5 rounded-lg bg-background/50 text-accent group-hover:bg-accent group-hover:text-white transition-all">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <div className="flex-grow min-w-0">
                                  <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-serif font-bold text-sm truncate flex items-center gap-2">
                                      {session.name}
                                      {session.round && session.round > 1 && (
                                        <Badge variant="outline" className="text-[7px] h-4 px-1 border-accent/50 text-accent shrink-0">第{session.round}轮</Badge>
                                      )}
                                    </h4>
                                    <span className="text-[10px] text-muted-foreground tabular-nums">{format(session.timestamp, 'HH:mm')}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Badge variant="secondary" className="text-[8px] h-4 px-1.5 bg-success/10 text-success border-none">
                                      {session.list.filter(i => i.released).length} / {session.list.length} 已释放
                                    </Badge>
                                    <div className="flex -space-x-1">
                                      {session.list.slice(0, 5).map((item, idx) => (
                                        <div key={idx} className={`w-1.5 h-1.5 rounded-full border border-background ${item.released ? 'bg-success' : 'bg-muted'}`} />
                                      ))}
                                      {session.list.length > 5 && <span className="text-[7px] text-muted-foreground ml-1">+</span>}
                                    </div>
                                  </div>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground/30 hover:text-destructive rounded-full"
                                  onClick={(e) => deleteSession(e, session.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </motion.div>
        )}

        {step === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6 px-1.5 md:px-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep('list')} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> 返回
              </Button>
              <h2 className="text-sm font-serif font-bold text-muted-foreground uppercase tracking-widest">历史释放解析</h2>
            </div>

            <ScrollArea className="h-[70vh] pr-4">
              <div className="space-y-8">
                {Object.entries(
                  sessions.reduce((acc: Record<string, AreaSession[]>, session) => {
                    if (!acc[session.date]) acc[session.date] = [];
                    acc[session.date].push(session);
                    return acc;
                  }, {})
                ).length === 0 ? (
                  <div className="text-center py-20 italic text-muted-foreground opacity-50">
                    尚无领域释放记录
                  </div>
                ) : (
                  Object.entries(
                    sessions.reduce((acc: Record<string, AreaSession[]>, session) => {
                      if (!acc[session.date]) acc[session.date] = [];
                      acc[session.date].push(session);
                      return acc;
                    }, {})
                  ).sort(([a], [b]) => b.localeCompare(a)).map(([date, dateSessions]) => (
                    <div key={date} className="space-y-3">
                      <div className="flex items-center gap-3 px-1">
                        <Calendar className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-bold text-muted-foreground/80 tracking-widest">{date}</span>
                        <div className="flex-grow h-[1px] bg-border/30" />
                      </div>
                      
                      <div className="space-y-3">
                        {dateSessions.map((session) => (
                          <Card 
                            key={session.id} 
                            className="p-4 bg-card/60 backdrop-blur-sm border-none shadow-md hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden"
                            onClick={() => loadSession(session)}
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-3 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-all shadow-inner">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex-grow min-w-0">
                                <h4 className="font-serif font-bold text-sm md:text-base mb-1 truncate flex items-center gap-2">
                                  {session.name}
                                  {session.round && session.round > 1 && (
                                    <Badge variant="outline" className="text-[7px] h-4 px-1 border-accent/50 text-accent shrink-0">第{session.round}轮</Badge>
                                  )}
                                </h4>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-success" />
                                    {session.list.filter(i => i.released).length} / {session.list.length} 已释放
                                  </span>
                                  <span>{format(session.timestamp, 'HH:mm')}</span>
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-full transition-all"
                                onClick={(e) => deleteSession(e, session.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <ArrowRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-accent group-hover:translate-x-1 transition-all" />
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}

        {step === 'questions' && (
          <motion.div key="questions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4 md:space-y-6 px-1">
            <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
              <CardHeader className="text-center relative py-4 px-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-1 top-2 md:left-2 rounded-full h-8 w-8"
                  onClick={() => setStep('area_history')}
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <div className="pt-2">
                  <Badge variant="outline" className="w-fit mx-auto mb-1 border-accent text-accent text-[8px] md:text-[10px] py-0">{selectedArea.title}领域</Badge>
                  <CardTitle className="font-serif text-lg md:text-2xl">请回答以下引导问句</CardTitle>
                  <CardDescription className="text-[9px] md:text-xs">您可以直接在下方填写感受，也可以留空。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-3 md:px-6 pb-6">
                <ScrollArea className="h-[400px] md:h-[500px] pr-2 md:pr-4">
                  <div className="space-y-6 py-2">
                    {selectedArea.questions.map((q: string, i: number) => (
                      <div key={i} className="space-y-2 relative">
                        <label className="text-[11px] md:text-xs font-medium text-foreground/80 leading-relaxed block">{i + 1}. {q}</label>
                        <div className="relative">
                          <Input 
                            value={answers[i]}
                            onChange={(e) => {
                              const newAnswers = [...answers];
                              newAnswers[i] = e.target.value;
                              setAnswers(newAnswers);
                            }}
                            placeholder="写下您的感受..."
                            className="h-10 md:h-12 bg-transparent border-border/30 focus-visible:ring-accent focus-visible:bg-background/10 text-[13px] md:text-sm pr-10 backdrop-blur-sm"
                          />
                          {settings?.enableVoiceInput && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2">
                              <VoiceInput size="sm" onResult={(voiceText) => {
                                const newAnswers = [...answers];
                                newAnswers[i] = (newAnswers[i] || '') + voiceText;
                                setAnswers(newAnswers);
                              }} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-4 mt-6">
                  <Button className="flex-1 h-12 bg-primary hover:bg-accent text-primary-foreground text-sm" onClick={handleAnalyze} disabled={isAnalyzing}>
                    {isAnalyzing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <RefreshCcw className="mr-2 w-4 h-4" />}
                    开始释放
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'deep_questions' && (
          <motion.div key="deep_questions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4 md:space-y-6 px-1">
            <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
              <CardHeader className="text-center relative py-4 px-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-1 top-2 md:left-2 rounded-full h-8 w-8"
                  onClick={() => setStep('analysis')}
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <div className="pt-2">
                  <Badge variant="outline" className="w-fit mx-auto mb-1 border-accent text-accent text-[8px] md:text-[10px] py-0">
                    {selectedArea.title}领域 · 第{deepExploreRound}轮深度探索
                  </Badge>
                  <CardTitle className="font-serif text-lg md:text-2xl">请回答以下深入问句</CardTitle>
                  <CardDescription className="text-[9px] md:text-xs">基于上一轮的解析，AI 生成了更深入的问题。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-3 md:px-6 pb-6">
                <ScrollArea className="h-[400px] md:h-[500px] pr-2 md:pr-4">
                  <div className="space-y-6 py-2">
                    {deepExploreQuestions.map((q: string, i: number) => (
                      <div key={i} className="space-y-2 relative">
                        <label className="text-[11px] md:text-xs font-medium text-foreground/80 leading-relaxed block">{i + 1}. {q}</label>
                        <div className="relative">
                          <Input 
                            value={answers[i] || ''}
                            onChange={(e) => {
                              const newAnswers = [...answers];
                              newAnswers[i] = e.target.value;
                              setAnswers(newAnswers);
                            }}
                            placeholder="写下您的感受..."
                            className="h-10 md:h-12 bg-transparent border-border/30 focus-visible:ring-accent focus-visible:bg-background/10 text-[13px] md:text-sm pr-10 backdrop-blur-sm"
                          />
                          {settings?.enableVoiceInput && (
                            <div className="absolute right-1 top-1/2 -translate-y-1/2">
                              <VoiceInput size="sm" onResult={(voiceText) => {
                                const newAnswers = [...answers];
                                newAnswers[i] = (newAnswers[i] || '') + voiceText;
                                setAnswers(newAnswers);
                              }} />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-4 mt-6">
                  <Button className="flex-1 h-12 bg-primary hover:bg-accent text-primary-foreground text-sm" onClick={handleDeepAnalyze} disabled={isAnalyzing}>
                    {isAnalyzing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <RefreshCcw className="mr-2 w-4 h-4" />}
                    开始释放
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'analysis' && analysis && (
          <motion.div key="analysis" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 md:space-y-6 px-1">
            <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
              <CardHeader className="relative py-4 md:py-6 px-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-1 top-2 md:left-4 md:top-4 rounded-full h-8 w-8"
                  onClick={() => setStep(currentSession ? 'area_history' : 'questions')}
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <div className="pt-2 px-6 md:pt-4 md:px-8">
                  <CardTitle className="font-serif text-lg md:text-2xl">领域想要深度分析</CardTitle>
                  <CardDescription className="text-[9px] md:text-xs">AI 深度解析想要根源。点击“+”调整想要。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 md:space-y-8 px-3 md:px-6 pb-6">
                <div className="flex flex-col gap-3">
                  <Button 
                    className="w-full h-11 md:h-12 bg-primary hover:bg-accent text-primary-foreground shadow-lg gap-2 text-sm" 
                    onClick={() => startRelease(0, 'sequential')}
                    disabled={!analysis.list || analysis.list.length === 0}
                  >
                    <RefreshCcw className="w-4 h-4" /> {isAnalyzing ? '开始释放 (同步分析中...)' : '开始释放 (全部顺序)'}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 md:gap-3">
                  {analysis.w && analysis.w.map((w: string) => (
                    <Badge key={w} className="bg-accent/20 text-accent border-none px-2.5 md:px-4 py-1.5 text-[10px] md:text-sm">
                      {WANT_LABELS[w as WantType] || w}
                    </Badge>
                  ))}
                </div>
                
                <ScrollArea className="h-[400px] md:h-[450px] pr-2 md:pr-4">
                  <div className="space-y-4">
                    {analysis.list && analysis.list.map((item: any, i: number) => (
                      <div key={i} className={`p-4 rounded-xl border border-border/30 space-y-3 relative group ${(item.released || releasedIndices.includes(i)) ? 'opacity-50 bg-muted/20 border-success/30' : 'bg-background/40'}`}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] md:text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">第 {i + 1} 点</span>
                            {(item.released || releasedIndices.includes(i)) && <Badge variant="outline" className="text-[8px] h-4 px-1 border-success text-success bg-success/10">已释放</Badge>}
                          </div>
                          <button 
                            onClick={() => toggleSentenceReleased(i)}
                            className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center transition-all ${(item.released || releasedIndices.includes(i)) ? 'bg-success text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-success/10 hover:text-success'}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1 items-center py-0.5 justify-end">
                          {item.w && item.w.map((w: WantType) => (
                            <Badge key={w} variant="secondary" className="bg-secondary/20 text-foreground border-none px-1.5 py-0 text-[8px] flex items-center gap-1 shrink-0">
                              {WANT_LABELS[w]}
                              <X className="w-2 h-2 cursor-pointer hover:text-destructive" onClick={() => toggleWant(i, w)} />
                            </Badge>
                          ))}
                          <Popover>
                            <PopoverTrigger render={
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-primary/10 hover:bg-primary/20 shrink-0">
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                            } />
                            <PopoverContent className="w-36 p-1.5 bg-popover/95 backdrop-blur-sm border-border/50">
                              <div className="flex flex-col gap-0.5">
                                {(Object.keys(WANT_LABELS) as WantType[]).map((w) => (
                                  <Button 
                                    key={w} 
                                    variant="ghost" 
                                    size="sm" 
                                    className={`justify-start font-normal text-[10px] h-7 ${item.w && item.w.includes(w) ? 'bg-accent/20 text-accent' : ''}`}
                                    onClick={() => toggleWant(i, w)}
                                  >
                                    {WANT_LABELS[w]}
                                  </Button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] md:text-xs text-muted-foreground/60 leading-tight">Q: {item.q || '问题内容正在同步...'}</p>
                          <p className="text-[13px] md:text-sm text-foreground/90 leading-snug font-serif italic">"{item.ans || item.s || '未回答'}"</p>
                          
                          {item.note && (
                            <div className="p-2 rounded-lg bg-secondary/5 border border-secondary/10 flex gap-2 items-start">
                              <StickyNote className="w-3 h-3 text-secondary mt-0.5 shrink-0" />
                              <p className="text-[10px] text-muted-foreground whitespace-pre-wrap">{item.note}</p>
                            </div>
                          )}
                        </div>
                        
                        {item.a && (
                          <div className="p-3 rounded-xl bg-accent/5 border border-accent/10">
                            <p className="text-[11px] md:text-[12px] text-muted-foreground leading-relaxed">
                              <span className="font-bold text-accent mr-1 uppercase text-[9px] tracking-tight">解析:</span> {item.a}
                            </p>
                          </div>
                        )}
                        <div className="pt-1 flex gap-2">
                          <Button size="sm" variant="outline" className="flex-[2] h-9 border-accent/30 text-accent hover:bg-accent/10 text-[11px] md:text-xs gap-2" onClick={() => startRelease(i, 'single')}>
                            <Zap className="w-3 h-3 md:w-3.5 md:h-3.5" /> 快速释放
                          </Button>
                          <Button 
                            variant="outline"
                            className="flex-1 border-border/30 hover:bg-muted text-muted-foreground rounded-xl h-9 text-[11px] md:text-xs"
                            onClick={() => removeSentence(i)}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="p-4 md:p-6 rounded-2xl bg-secondary/10 border border-secondary/20 leading-relaxed text-xs md:text-base text-foreground/90 italic">
                  <h4 className="font-bold text-[10px] md:text-sm mb-2 text-secondary-foreground flex items-center gap-2 uppercase tracking-wide not-italic">
                    <RefreshCcw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isAnalyzing ? 'animate-spin' : ''}`} /> 分析总结
                  </h4>
                  {isAnalyzing && (!analysis.sum || analysis.sum.length < 5) ? (
                    <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>正在深度提炼整体想要...</span>
                    </div>
                  ) : (
                    analysis.sum
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    className="flex-1 h-11 md:h-12 bg-primary hover:bg-accent text-primary-foreground text-xs md:text-sm font-bold shadow-md" 
                    onClick={() => handleDeepExplore()}
                    disabled={isDeepExploring}
                    title="基于本轮回答，AI 生成更深入的释放问句"
                  >
                    {isDeepExploring ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Target className="w-4 h-4 mr-2" />} 继续深入
                  </Button>
                  <Button variant="secondary" className="flex-1 h-11 md:h-12 border-primary/30 hover:bg-primary/5 text-xs md:text-sm" onClick={handleManualSave}>
                    <Save className="w-4 h-4 mr-2" /> 手动保存
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 h-11 md:h-12 border-primary/30 hover:bg-primary/10 text-xs md:text-sm" 
                    onClick={() => {
                      if (selectedArea) {
                        setStep('area_history');
                        setAnalysis(null);
                        setAnswers([]);
                        setReleaseIndex(0);
                        setSixStepIndex(0);
                        setCurrentSession(null);
                      } else {
                        reset();
                      }
                    }}
                  >
                    清空并退出
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'release' && analysis && (
          <motion.div key="release" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[85vh] md:min-h-[70vh] text-center space-y-3 md:space-y-6 relative px-4 py-4">
            
            <div className="space-y-3 md:space-y-4 max-w-xl w-full flex flex-col items-center">
              {/* Row 1: Progress (Center) & X (Right) */}
              <div className="w-full relative flex items-center justify-center">
                <Badge variant="outline" className="px-3 md:px-4 py-1 border-accent/50 text-accent text-[9px] md:text-sm">
                  释放进程 {releaseIndex + 1} / {analysis.list.length}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setShowQuitDialog(true)}
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>

              {/* Row 2: Original Sentence */}
              <h2 className="text-[19px] md:text-[22px] font-serif font-bold leading-relaxed text-foreground px-2">
                "{analysis.list[releaseIndex].ans || analysis.list[releaseIndex].s || analysis.list[releaseIndex].q}"
              </h2>

              {/* Row 3: Explanation */}
              {analysis.list[releaseIndex].a && (
                <div className="text-[11px] md:text-sm text-muted-foreground italic px-4 bg-background/50 p-3 rounded-xl border border-border/20 shadow-sm max-w-sm mx-auto">
                   <span className="font-bold text-accent mr-1 uppercase text-[8px] block mb-1">解析说明</span>
                  {analysis.list[releaseIndex].a}
                </div>
              )}

              {/* Row 4: Three Wants */}
              <div className="flex flex-wrap justify-center gap-1.5 md:gap-2 mt-2">
                {analysis.list[releaseIndex].w && analysis.list[releaseIndex].w.map((w: WantType) => (
                  <Badge key={w} variant="secondary" className="bg-accent/10 text-accent border border-accent/20 px-3 py-1 text-[9px] md:text-[10px] font-bold">
                    {WANT_LABELS[w]}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-8 md:space-y-10 w-full max-w-sm md:max-w-md bg-card/40 p-6 md:p-8 rounded-3xl backdrop-blur-sm border border-border/20 shadow-2xl">
              <AnimatePresence mode="wait">
                {!isSentenceFinished ? (
                  <motion.div key="steps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 md:space-y-10">
                    <div className="space-y-1 md:space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        {/* Row 5: Step count renamed */}
                        <p className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-widest pl-6">
                          step{sixStepIndex + 1}/{activeSteps.length}
                        </p>
                        <Popover>
                          <PopoverTrigger render={
                            <Button variant="ghost" size="icon" className={`h-6 w-6 rounded-full transition-colors ${analysis.list[releaseIndex].note ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-accent'}`}>
                              <StickyNote className="w-3 h-3" />
                            </Button>
                          } />
                          <PopoverContent className="w-64 p-3 bg-popover/95 backdrop-blur-sm border-border/50 shadow-xl" side="bottom" align="center">
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-1.5">
                                <StickyNote className="w-3 h-3" /> 释放记录/便签
                              </h4>
                              <Textarea 
                                placeholder="在这里添加感悟或记录..." 
                                value={analysis.list[releaseIndex].note || ''}
                                onChange={(e) => updateSentenceNote(releaseIndex, e.target.value)}
                                className="min-h-[100px] text-xs resize-none bg-background/50 border-border/30 focus:border-accent/40"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.div key={sixStepIndex + (isSubQuestion ? '-sub' : '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-[17px] md:text-lg font-medium text-foreground leading-snug min-h-[70px] flex items-center justify-center px-2">
                          {getStepContent()}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <div className="flex flex-col gap-3 md:gap-4">
                      <Button size="lg" className="h-12 md:h-14 text-base md:text-lg rounded-2xl bg-primary hover:bg-accent text-primary-foreground shadow-lg transition-all" onClick={() => nextReleaseStep(true)}>
                        {getButtonLabels().primary}
                      </Button>
                      <Button variant="outline" className="h-12 md:h-14 text-base md:text-lg rounded-2xl border-border hover:bg-muted text-muted-foreground transition-all" onClick={() => nextReleaseStep(false)}>
                        {getButtonLabels().secondary}
                      </Button>
                      <button 
                        className="text-[10px] text-muted-foreground hover:text-accent transition-colors underline underline-offset-4"
                        onClick={skipSentence}
                      >
                        先不释放，跳到下一句
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="choice" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 md:space-y-8">
                    <div className="space-y-1">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                        <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                      </div>
                      <h3 className="text-lg md:text-xl font-medium">感觉好吗？</h3>
                    </div>
                    <div className="flex flex-col gap-2 md:gap-3">
                      {releaseIndex < analysis!.list.length - 1 ? (
                        <Button size="lg" className="h-12 md:h-14 rounded-2xl bg-primary hover:bg-accent text-primary-foreground text-sm md:text-base font-bold shadow-lg" onClick={continueRelease}>
                          继续下一句
                        </Button>
                      ) : (
                        <>
                          <Button size="lg" className="h-12 md:h-14 rounded-2xl bg-primary hover:bg-accent text-primary-foreground text-sm md:text-base font-bold shadow-lg" onClick={continueRelease}>
                            完成并退出
                          </Button>
                          <Button size="lg" variant="outline" className="h-12 md:h-14 rounded-2xl border-primary text-primary hover:bg-primary/5 text-sm md:text-base font-bold shadow-sm" onClick={restartRelease}>
                            从头开始释放
                          </Button>
                        </>
                      )}
                      <Button variant="outline" size="lg" className="h-12 md:h-14 rounded-2xl border-accent/30 text-accent hover:bg-accent/10 text-sm md:text-base font-medium" onClick={reRelease}>
                        重新释放这一句
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-accent hover:text-accent/80 flex items-center gap-2 text-[11px] md:text-sm h-8 md:h-10 mt-2"
                        onClick={() => setIsMoreReleaseOpen(true)}
                      >
                        <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" /> 深入释放更多
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-2.5 md:gap-3">
              {activeSteps.map((_, i) => (
                <div key={i} className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-all duration-500 ${i === sixStepIndex ? 'bg-accent w-6 md:w-8' : 'bg-muted'}`} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认退出释放？</DialogTitle>
            <DialogDescription>
              您还有未完成释放的句子。是否需要将这些句子移动到“化解卡住”板块，以便日后处理？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleQuit(false)}>
              直接退出
            </Button>
            <Button className="flex-1 bg-accent hover:bg-accent/80" onClick={() => handleQuit(true)}>
              移动到“化解卡住”并退出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMoreReleaseOpen} onOpenChange={setIsMoreReleaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" /> 释放更多
            </DialogTitle>
            <DialogDescription>
              深入挖掘当前感受背后的底层想要。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>现在的感受/情绪是什么？</Label>
              <Input 
                placeholder="例如：感到隐约的焦虑、不知所措..." 
                value={moreReleaseEmotion}
                onChange={(e) => setMoreReleaseEmotion(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label>这背后对应哪些“想要”？</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(WANT_LABELS) as WantType[]).map(w => (
                  <Button
                    key={w}
                    variant={moreReleaseWants.includes(w) ? 'default' : 'outline'}
                    size="sm"
                    className={`rounded-full ${moreReleaseWants.includes(w) ? 'bg-accent hover:bg-accent/90' : ''}`}
                    onClick={() => toggleMoreWant(w)}
                  >
                    {WANT_LABELS[w]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full bg-accent hover:bg-accent/90 text-white h-12 rounded-xl"
              disabled={!moreReleaseEmotion.trim() || moreReleaseWants.length === 0}
              onClick={handleMoreRelease}
            >
              开始深入分析释放
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCustomAreaDialogOpen} onOpenChange={setIsCustomAreaDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] p-4 md:p-6 rounded-2xl border-none shadow-2xl bg-gradient-to-br from-card/95 to-card/90 backdrop-blur-xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl md:text-2xl font-serif">{editingCustomArea?.id ? '编辑' : '新建'}自定义主模块</DialogTitle>
            <DialogDescription>你可以从模板库中选择一个，或是自行编写模块需要的释放问句串。</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">快速填充内置模版 (可选)</Label>
              <div className="flex flex-wrap gap-2">
                {PREDEFINED_TEMPLATES.map(tpl => (
                  <Button
                    key={tpl.id}
                    variant={selectedTemplateForCustom === tpl.id ? 'default' : 'outline'}
                    size="sm"
                    className={`rounded-xl border-accent/20 ${selectedTemplateForCustom === tpl.id ? 'bg-accent text-white' : 'hover:bg-accent/10 hover:text-accent'}`}
                    onClick={() => applyTemplateToCustomArea(tpl.id)}
                  >
                    参考【{tpl.title}】
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center justify-between">
                  <span>模块名称 *</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-accent hover:bg-accent/10 rounded-lg px-2 text-[11px]"
                    onClick={handleGenerateQuestions}
                    disabled={!editingCustomArea?.title || isGeneratingQuestions}
                  >
                    {isGeneratingQuestions ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
                    让 AI 为我生成专注问句
                  </Button>
                </Label>
                <Input 
                  value={editingCustomArea?.title || ''} 
                  onChange={e => setEditingCustomArea(prev => prev ? { ...prev, title: e.target.value } : null)}
                  placeholder="输入名称后，点击右上角【让AI生成专属问句】..." 
                  className="bg-background/50 h-11 rounded-xl w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-semibold">简短描述</Label>
                <Input 
                  value={editingCustomArea?.description || ''} 
                  onChange={e => setEditingCustomArea(prev => prev ? { ...prev, description: e.target.value } : null)}
                  placeholder="说明一下这个模块是用来解决什么问题的" 
                  className="bg-background/50 h-11 rounded-xl w-full"
                />
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-sm font-semibold flex items-center justify-between">
                  <span>内置释放问句组 *</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 gap-1 text-accent hover:text-accent hover:bg-accent/10 rounded-lg px-2"
                    onClick={() => setEditingCustomArea(prev => prev ? { ...prev, questions: [...(prev.questions || []), ''] } : null)}
                  >
                    <Plus className="w-3.5 h-3.5" /> 增加问句
                  </Button>
                </Label>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                  {editingCustomArea?.questions?.map((q, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="bg-muted/30 w-7 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground border border-border/50">
                        {i + 1}
                      </div>
                      <Input 
                        value={q} 
                        onChange={e => {
                          const newQ = [...(editingCustomArea.questions || [])];
                          newQ[i] = e.target.value;
                          setEditingCustomArea(prev => prev ? { ...prev, questions: newQ } : null);
                        }}
                        placeholder="请输入释放问句..." 
                        className="bg-background/50 flex-1 h-10 rounded-lg text-sm"
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="shrink-0 h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        onClick={() => {
                          const newQ = editingCustomArea.questions?.filter((_, index) => index !== i);
                          setEditingCustomArea(prev => prev ? { ...prev, questions: newQ } : null);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {(!editingCustomArea?.questions || editingCustomArea.questions.length === 0) && (
                    <div className="text-sm text-muted-foreground text-center py-4 bg-muted/10 rounded-xl border border-dashed border-border/50">
                      请至少添加一个释放问句
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto h-11 rounded-xl" onClick={() => setIsCustomAreaDialogOpen(false)}>取消</Button>
            <Button 
              className="w-full sm:w-auto h-11 bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-accent/20" 
              onClick={handleSaveCustomArea}
              disabled={!editingCustomArea?.title || !Array.isArray(editingCustomArea?.questions) || editingCustomArea.questions.filter(q => typeof q === 'string' && q.trim()).length === 0}
            >
              保存模块
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!longPressArea} onOpenChange={(open) => !open && setLongPressArea(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>领域状态变更</DialogTitle>
            <DialogDescription>
              您可以标记该领域为“已释放”状态，或取消标记。
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            {longPressArea && (
              <Button 
                variant={releasedAreaIds.find(i => i.id === longPressArea.id) ? "outline" : "default"}
                className={releasedAreaIds.find(i => i.id === longPressArea.id) ? "border-destructive text-destructive" : "bg-success hover:bg-success/90 text-white"}
                onClick={() => {
                  toggleAreaReleased(longPressArea.id);
                  setLongPressArea(null);
                }}
              >
                {releasedAreaIds.find(i => i.id === longPressArea.id) ? "撤销已释放标记" : "标记为已完成"}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLongPressArea(null)}>取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!areaToDelete} onOpenChange={(open) => !open && setAreaToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除自定义模块</DialogTitle>
            <DialogDescription>
              确定要删除这个自定义模块吗？相关的会话记录依然会保留。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setAreaToDelete(null)}>取消</Button>
            <Button variant="destructive" onClick={executeDeleteCustomArea}>确定删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
