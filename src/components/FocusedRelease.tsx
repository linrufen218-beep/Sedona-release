import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppSettings, saveRecord, addStuckSentence, getStuckSentences, removeStuckSentence, getComponentState, saveComponentState, STORAGE_KEYS, WantType, getFocusedProjects, saveFocusedProject, deleteFocusedProject, FocusedProject } from '@/lib/store';
import { analyzeAreaAnswers, analyzeAIGen, callAI } from '@/services/geminiService';
import { Loader2, Target, RefreshCcw, ChevronLeft, X, LogOut, MessageCircle, Trash2, Send, Smile, CheckCircle2, Save, Zap, HelpCircle, User, Plus, Circle, CheckCircle, ArrowRight, FolderPlus, FileText, Calendar, StickyNote, Mic } from 'lucide-react';
import { VoiceInput } from './VoiceInput';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const THEMES = [
  { 
    id: 'stuck', 
    title: '化解卡住', 
    description: '整合卡住课题、智能导师与问答挖掘。',
    questions: [] 
  },
  { 
    id: 'change', 
    title: '我想改变什么', 
    description: '列出生活中你想要改变的人、事、物。', 
    questions: [
      '列出生活中你想要改变的一些情况、人或问题。',
      '我现在对此有什么感受？'
    ] 
  },
  { 
    id: 'suppress_express', 
    title: '压抑或表达', 
    description: '释放过去压抑或不当表达的情绪。', 
    questions: [
      '回忆一件我当时压抑情绪的具体事情。',
      '我现在对此有什么感受？',
      '回忆一件我当时表达情绪的具体事情。',
      '我现在对此有什么感受？'
    ] 
  },
  { 
    id: 'success', 
    title: '成功', 
    description: '释放对成功或失败的执着。', 
    questions: [
      '想一想在你的生活中你想变得更成功的一个领域。',
      '如果成功，我现在的感受是什么？',
      '如果失败，我现在的感受是什么？'
    ] 
  },
  { 
    id: 'like_dislike', 
    title: '喜欢与不喜欢', 
    description: '释放对特定事物的极端好恶。', 
    questions: [
      '你现在关注的主题是什么？',
      '我喜欢该主题的哪些方面？',
      '我现在对此有什么感受？',
      '我不喜欢该主题的哪些方面？',
      '我现在对此有什么感受？'
    ] 
  },
  { 
    id: 'must_do', 
    title: '我必须做的事', 
    description: '释放“不得不”的沉重感。', 
    questions: [
      '你觉得你必须做（不得不做）的事情是什么？',
      '我现在对此有什么感受？',
      '如果我不做这件事会怎样？',
      '我现在对此有什么感受？'
    ] 
  },
  { 
    id: 'goal', 
    title: '目标释放', 
    description: '释放对结果的执着。', 
    questions: [
      '你的目标是什么？',
      '我对目标现在有什么感受？',
      '为了达成目标“我要做的事”是什么？',
      '我现在对每一件事有什么感受？'
    ] 
  },
  { 
    id: 'wants_awareness', 
    title: '觉察想要', 
    description: '识别行为背后的深层动机。', 
    questions: [
      '我寻求被认同的方式有哪些？',
      '我试图控制的方式有哪些？',
      '我寻求安全的方式有哪些？',
      '我现在对这些方式的感觉是什么？'
    ] 
  },
  {
    id: 'ai-gen',
    title: 'AI 深度引导',
    description: '输入你的现状，AI为你深度定制释放流程。',
    questions: []
  }
];

const WANT_LABELS: Record<WantType, string> = {
  approval: '想要被认可',
  control: '想要控制',
  security: '想要安全',
};

const SIX_STEPS = [
  "你必须想要‘波澜不惊’超过你想要‘被认可’、‘控制’或‘安全’吗？",
  "你决定通过释放来达到‘波澜不惊’吗？",
  "你能看到所有这些情绪感受都源自这三个想要吗？你能立即释放它们吗？",
  "你愿意在任何时候，无论独处或人前，都持续释放这些想要吗？",
  "如果你现在感到‘卡住了’，你愿意放开对这个‘卡住’的想要控制吗？",
  "你现在感到更轻松、更快乐了一点吗？"
];

const EMOTION_STEPS = [
  "你允许这种感觉存在吗？",
  "你愿意让它离开吗？"
];

const THREE_STEPS = [
  "你允许这种感觉存在吗？",
  "你能识别这是哪种想要吗？",
  "你能释放它吗？"
];

export default function FocusedRelease({ settings }: { settings?: AppSettings }) {
  const [selectedTheme, setSelectedTheme] = useState<any>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.selectedTheme || null);
  const [answers, setAnswers] = useState<string[]>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.answers || []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.analysis || null);
  const [step, setStep] = useState<'list' | 'projects' | 'questions' | 'analysis' | 'release'>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.step || 'list');
  const [releaseIndex, setReleaseIndex] = useState(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.releaseIndex || 0);
  
  // Project states
  const [projects, setProjects] = useState<FocusedProject[]>(getFocusedProjects());
  const [currentProject, setCurrentProject] = useState<FocusedProject | null>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.currentProject || null);
  const [newProjectName, setNewProjectName] = useState('');
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [sixStepIndex, setSixStepIndex] = useState(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.sixStepIndex || 0);
  const [activeSteps, setActiveSteps] = useState<string[]>(SIX_STEPS);
  const [isSequential, setIsSequential] = useState(true);
  const [isSentenceFinished, setIsSentenceFinished] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [isMoreReleaseOpen, setIsMoreReleaseOpen] = useState(false);
  const [releasedIndices, setReleasedIndices] = useState<number[]>([]);
  const [skippedIndices, setSkippedIndices] = useState<number[]>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.skippedIndices || []);
  const [isSubQuestion, setIsSubQuestion] = useState(false);
  const [prevStepWasNegative, setPrevStepWasNegative] = useState(false);
  
  // Stuck section states
  const [stuckSentences, setStuckSentences] = useState<any[]>(getStuckSentences());
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', content: string}[]>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.chatMessages || []);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [stuckMode, setStuckMode] = useState<'none' | 'self' | 'qa'>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.stuckMode || 'none');
  const [manualStuckTopic, setManualStuckTopic] = useState('');
  const [selectedStuckIds, setSelectedStuckIds] = useState<string[]>([]);
  const [tempWants, setTempWants] = useState<WantType[]>([]);
  const [isWantSelectorOpen, setIsWantSelectorOpen] = useState(false);
  const [releaseMethod, setReleaseMethod] = useState<'three' | 'six' | 'emotions'>('six');
  const [isMergedRelease, setIsMergedRelease] = useState(false);
  const [releaseOrderMode, setReleaseOrderMode] = useState<'round' | 'list'>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.releaseOrderMode || 'round');
  const [selectedRound, setSelectedRound] = useState<number | 'all'>(() => getComponentState(STORAGE_KEYS.FOCUSED_STATE)?.selectedRound || 'all');

  // Resolve current active steps and labels
  const getAssignment = () => {
    if (selectedTheme?.id === 'stuck') {
      let key: keyof NonNullable<AppSettings['moduleAssignments']> = 'stuck';
      if (stuckMode === 'qa') key = 'stuck_qa';
      else if (releaseMethod === 'three') key = 'stuck_three';
      else if (releaseMethod === 'emotions') key = 'stuck_emotion';
      else if (releaseMethod === 'six') key = 'stuck_six';
      
      const groupId = settings?.moduleAssignments?.[key];
      return settings?.questionGroups?.find(g => g.id === groupId);
    }
    
    if (selectedTheme?.id === 'ai-gen') {
      const groupId = settings?.moduleAssignments?.focused_ai_gen;
      return settings?.questionGroups?.find(g => g.id === groupId);
    }

    const groupId = settings?.moduleAssignments?.focused;
    return settings?.questionGroups?.find(g => g.id === groupId);
  };

  const getEffectiveSteps = (index: number, mode: 'sequential' | 'single') => {
    const group = getAssignment();
    if (group && group.steps.length > 0) {
      return group.steps.map(s => s.question);
    }

    if (selectedTheme?.id === 'ai-gen') {
      return ['AI_GEN_STEP'];
    }
    
    if (settings?.useDefaultQuestions !== false) {
      if (selectedTheme?.id === 'stuck') {
        if (releaseMethod === 'emotions') return EMOTION_STEPS;
        return THREE_STEPS;
      }
      return THREE_STEPS;
    }
    
    return THREE_STEPS; // Fallback
  };

  // Save state on changes
  useEffect(() => {
    saveComponentState(STORAGE_KEYS.FOCUSED_STATE, {
      selectedTheme,
      answers,
      analysis,
      step,
      stuckMode,
      chatMessages,
      releaseIndex,
      releasedIndices,
      skippedIndices,
      sixStepIndex,
      currentProject,
      releaseOrderMode
    });

    // Auto-sync analysis to current project if it exists
    if (currentProject && analysis && (step === 'analysis' || step === 'release')) {
      const updated = {
        ...currentProject,
        list: analysis.list,
        sum: analysis.sum
      };
      saveFocusedProject(updated);
    }
  }, [selectedTheme, answers, analysis, step, stuckMode, chatMessages, releaseIndex, releasedIndices, skippedIndices, sixStepIndex, currentProject, releaseOrderMode]);

  const startTheme = (theme: any) => {
    setSelectedTheme(theme);
    setCurrentProject(null);
    setAnalysis(null);
    setAnswers([]);
    
    if (theme.id === 'stuck') {
      setStuckSentences(getStuckSentences());
      setStep('analysis');
      setStuckMode('none');
      return;
    }
    setStep('projects');
  };

  const handleCreateNewProject = () => {
    if (!newProjectName.trim()) return;
    setCurrentProject(null);
    setAnalysis(null);
    setAnswers(new Array(selectedTheme.questions.length).fill(''));
    setStep('questions');
    setIsNewProjectDialogOpen(false);
  };

  const loadProject = (project: FocusedProject) => {
    setCurrentProject(project);
    setAnalysis({
      list: project.list,
      sum: project.sum
    });
    setStep('analysis');
  };

  const deleteProject = (id: string) => {
    deleteFocusedProject(id);
    setProjects(getFocusedProjects());
  };

  const toggleProjectCompletion = (id: string) => {
    const p = projects.find(it => it.id === id);
    if (!p) return;
    const isNowCompleted = !p.completed;
    const updated = { ...p, completed: isNowCompleted };
    saveFocusedProject(updated);
    setProjects(getFocusedProjects());
    if (currentProject?.id === id) {
      setCurrentProject(updated);
    }

    // Add to daily release record if completed
    if (isNowCompleted) {
      saveRecord({
        id: crypto.randomUUID(),
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'focused',
        content: `完成释放项目: ${p.name}`,
        analysis: {
          list: p.list,
          sum: p.sum || `${p.name} 项目已圆满完成释放。`
        },
        timestamp: Date.now()
      });
    }
  };

  const toggleManualRelease = (index: number) => {
    setAnalysis((prev: any) => {
      if (!prev) return prev;
      const newList = [...prev.list];
      newList[index] = { ...newList[index], released: !newList[index].released };
      
      const newAnalysis = { ...prev, list: newList };
      
      // Persist to current project if it exists
      if (currentProject) {
        const updatedProject = {
          ...currentProject,
          list: newList,
          sum: prev.sum
        };
        setCurrentProject(updatedProject);
        saveFocusedProject(updatedProject);
      }
      
      return newAnalysis;
    });
  };

  const handleAddStuck = () => {
    if (!manualStuckTopic.trim()) return;
    addStuckSentence({
      text: manualStuckTopic,
      wants: tempWants,
      analysis: '手动添加的卡住课题',
      source: '手动添加'
    });
    setStuckSentences(getStuckSentences());
    setManualStuckTopic('');
    setTempWants([]);
    setIsWantSelectorOpen(false);
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setStep('analysis');
    setAnalysis({ list: [], w: [], sum: '' });
    try {
      let result;
      if (selectedTheme?.id === 'ai-gen') {
        result = await analyzeAIGen(answers[0], (partial) => {
          setAnalysis((prev: any) => ({ ...prev, ...partial }));
        }, {
          model_type: settings?.selectedModel || 'MINIMAX25',
          invite_code: settings?.inviteCode || '',
          aiBaseUrl: settings?.useCustomConfig ? settings?.aiBaseUrl : undefined,
          aiApiKey: settings?.useCustomConfig ? settings?.aiApiKey : undefined,
          aiModelName: settings?.useCustomConfig ? settings?.aiModelName : undefined
        });
      } else {
        const currentRound = currentProject 
          ? (Math.max(0, ...currentProject.list.map(i => i.round || 1)) + 1) 
          : 1;

        result = await analyzeAreaAnswers(
          selectedTheme.title, 
          selectedTheme.questions, 
          answers, 
          (partial) => {
            const answeredIndices = answers.map((a, i) => a.trim() ? i : -1).filter(i => i !== -1);
            if (partial.list) {
              partial.list = partial.list.map((item: any, idx: number) => {
                const originalAnswer = answers[answeredIndices[idx]];
                return {
                  ...item,
                  ans: originalAnswer,
                  round: currentRound
                };
              });
            }
            setAnalysis((prev: any) => {
              if (!prev) return partial;
              if (currentProject) {
                return {
                  ...partial,
                  list: [...(currentProject?.list || []), ...(partial.list || [])]
                };
              }
              return partial;
            });
          },
          {
            model_type: settings?.selectedModel || 'MINIMAX25',
            invite_code: settings?.inviteCode || '',
            history: currentProject?.list || [],
            aiBaseUrl: settings?.useCustomConfig ? settings?.aiBaseUrl : undefined,
            aiApiKey: settings?.useCustomConfig ? settings?.aiApiKey : undefined,
            aiModelName: settings?.useCustomConfig ? settings?.aiModelName : undefined
          }
        );
        
        // Merge user answers into the analysis list
        const answeredIndices = answers.map((a, i) => a.trim() ? i : -1).filter(i => i !== -1);
        if (result.list) {
          result.list = result.list.map((item: any, idx: number) => {
            const originalAnswer = answers[answeredIndices[idx]];
            return {
              ...item,
              ans: originalAnswer,
              round: currentRound
            };
          });
        }
      }
      
      // Auto save record after successful analysis
      const newList = currentProject ? [...currentProject.list, ...result.list] : result.list;
      const projectData = {
        themeId: selectedTheme.id,
        name: currentProject ? currentProject.name : (newProjectName || `${selectedTheme.title} - ${new Date().toLocaleDateString()}`),
        list: newList,
        sum: result.sum,
        id: currentProject?.id
      };
      
      const savedProject = saveFocusedProject(projectData);
      setCurrentProject(savedProject);
      if (selectedTheme?.id === 'ai-gen') {
        setReleaseOrderMode('round');
      }
      setAnalysis({
        list: newList,
        sum: result.sum
      });
      setProjects(getFocusedProjects());
      setNewProjectName('');

      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'focused',
        content: `${selectedTheme.title} 集中释放`,
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

  const getReleaseSequence = () => {
    if (!analysis || !analysis.list) return [];
    const base = analysis.list
      .map((item: any, index: number) => ({ ...item, originalIndex: index }))
      .filter((item: any) => !item.released);
    
    if (releaseOrderMode === 'round') {
      return base
        .filter(item => selectedRound === 'all' || item.round === selectedRound)
        .sort((a, b) => {
          const roundA = a.round || 1;
          const roundB = b.round || 1;
          if (roundA !== roundB) return roundA - roundB;
          return a.originalIndex - b.originalIndex;
        })
        .map(item => item.originalIndex);
    }
    
    // Normal list order
    return base.map(item => item.originalIndex);
  };

  const startRelease = (index: number, mode: 'sequential' | 'single') => {
    const item = analysis?.list?.[index];
    const isReleased = item?.released;
    
    let targetIndex = index;
    let targetMode = mode;
    let targetOrder: 'round' | 'list' = 'round';

    if (mode === 'sequential') {
      // Global "Start Release" button
      targetOrder = 'round';
      const roundSeq = analysis.list
        .map((item: any, i: number) => ({ ...item, originalIndex: i }))
        .filter((item: any) => !item.released)
        .sort((a, b) => (a.round || 1) - (b.round || 1) || a.originalIndex - b.originalIndex)
        .map(item => item.originalIndex);

      if (roundSeq.length === 0) {
        alert('当前没有待释放的句子。');
        return;
      }
      targetIndex = roundSeq[0];
      targetMode = 'sequential';
    } else {
      // Individual Zap button
      if (isReleased) {
        targetMode = 'single';
      } else {
        targetMode = 'sequential';
        targetOrder = 'list';
      }
    }

    setReleaseOrderMode(targetOrder);
    setStep('release');
    setReleaseIndex(targetIndex);
    setSixStepIndex(0);
    setIsSequential(targetMode === 'sequential');
    setIsSentenceFinished(false);
    
    if (targetMode === 'sequential') {
      setReleasedIndices([]);
      setSkippedIndices([]);
    }
    
    setActiveSteps(getEffectiveSteps(targetIndex, targetMode));
  };

  const nextReleaseStep = (isPrimary: boolean) => {
    const group = getAssignment();

    // Check custom group step branch logic first
    if (!isSentenceFinished && !isPrimary && !isSubQuestion && group && group.steps[sixStepIndex]?.hasBranch) {
      setIsSubQuestion(true); // Reuse isSubQuestion state for branch to keep UI minimal
      return;
    }

    // Original hardcoded logic for sub-question on step 2
    if (!isSentenceFinished && sixStepIndex === 1 && !isPrimary && activeSteps === THREE_STEPS && !isSubQuestion) {
      setIsSubQuestion(true);
      return;
    }

    if (isSubQuestion) {
      setIsSubQuestion(false);
    }

    // Tracking negative answer
    setPrevStepWasNegative(!isPrimary && !isSubQuestion);

    if (sixStepIndex < activeSteps.length - 1) {
      setSixStepIndex(sixStepIndex + 1);
    } else {
      setIsSentenceFinished(true);
    }
  };

  const continueRelease = () => {
    const isStuck = selectedTheme?.id === 'stuck';
    
    if (isStuck) {
      // Remove current sentence from stuck list
      const currentSentence = analysis.list[releaseIndex];
      if (currentSentence && currentSentence.id) {
        removeStuckSentence(currentSentence.id);
        const updatedStuck = getStuckSentences();
        setStuckSentences(updatedStuck);
        
        // Filter out released items from analysis.list
        const remainingInAnalysis = analysis.list.filter((_: any, i: number) => i !== releaseIndex);
        
        if (remainingInAnalysis.length === 0) {
          if (updatedStuck.length === 0) {
            reset();
            setStep('list');
          } else {
            setStep('analysis'); // Return to stuck list
            setAnalysis(null);
            setSelectedStuckIds([]);
            setStuckMode('none');
          }
          return;
        }
        
        const newAnalysis = {
          ...analysis,
          list: remainingInAnalysis
        };
        setAnalysis(newAnalysis);
        
        // Move to next index (looping)
        let nextIndex = releaseIndex;
        if (nextIndex >= newAnalysis.list.length) {
          nextIndex = 0;
        }
        
        setReleaseIndex(nextIndex);
        setSixStepIndex(0);
        setIsSentenceFinished(false);
        return;
      }
    }

    const newReleased = [...releasedIndices, releaseIndex];
    setReleasedIndices(newReleased);
    
    // Mark as released in analysis list immediately to persist progress
    if (analysis?.list?.[releaseIndex]) {
      const newList = [...analysis.list];
      newList[releaseIndex] = { ...newList[releaseIndex], released: true };
      const newAnalysis = { ...analysis, list: newList };
      setAnalysis(newAnalysis);
      
      if (currentProject) {
        const updatedProject = { ...currentProject, list: newList };
        setCurrentProject(updatedProject);
        saveFocusedProject(updatedProject);
      }
    }

    setPrevStepWasNegative(false);
    setIsSentenceFinished(false);
    
    if (isSequential) {
      const sequence = getReleaseSequence();
      const currentIndexInSeq = sequence.indexOf(releaseIndex);
      
      if (currentIndexInSeq !== -1 && currentIndexInSeq < sequence.length - 1) {
        const nextIndex = sequence[currentIndexInSeq + 1];
        setReleaseIndex(nextIndex);
        setSixStepIndex(0);
        setActiveSteps(getEffectiveSteps(nextIndex, 'sequential'));
      } else {
        if (isAnalyzing) {
          setStep('analysis');
        } else {
          finishRelease(newReleased);
        }
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
        // If single release, we still want to save the status
        finishRelease(newReleased);
      }
    }
  };

  const skipAndContinue = () => {
    setPrevStepWasNegative(false);
    const isStuck = selectedTheme?.id === 'stuck';
    if (isStuck) {
      let nextIndex = releaseIndex + 1;
      if (nextIndex >= analysis.list.length) {
        nextIndex = 0;
      }
      setReleaseIndex(nextIndex);
      setSixStepIndex(0);
      
      if (releaseMethod === 'three') setActiveSteps(THREE_STEPS);
      else if (releaseMethod === 'emotions') setActiveSteps(EMOTION_STEPS);
      else setActiveSteps(SIX_STEPS);
      
      setIsSentenceFinished(false);
    }
  };

  const reRelease = () => {
    setSixStepIndex(0);
    setPrevStepWasNegative(false);
    setIsSentenceFinished(false);
  };

  const skipSentence = () => {
    const isStuck = selectedTheme?.id === 'stuck';
    if (isStuck) {
      skipAndContinue();
      return;
    }

    const newSkipped = [...skippedIndices, releaseIndex];
    setSkippedIndices(newSkipped);
    
    if (isSequential) {
      const sequence = getReleaseSequence();
      const currentIndexInSeq = sequence.indexOf(releaseIndex);
      
      if (currentIndexInSeq !== -1 && currentIndexInSeq < sequence.length - 1) {
        const nextIndex = sequence[currentIndexInSeq + 1];
        setReleaseIndex(nextIndex);
        setSixStepIndex(0);
        setActiveSteps(getEffectiveSteps(nextIndex, 'sequential'));
      } else {
        if (isAnalyzing) {
          setStep('analysis');
        } else {
          finishRelease();
        }
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
  };

  const handleQuit = (moveToStuck: boolean) => {
    if (moveToStuck) {
      const currentSentence = analysis.list[releaseIndex];
      addStuckSentence({
        text: currentSentence.s,
        wants: currentSentence.w || [],
        analysis: currentSentence.a,
        source: selectedTheme?.id === 'stuck' ? '化解卡住' : `${selectedTheme.title}集中释放`
      });
    }
    
    // Save progress before quitting
    finishRelease();
    setShowQuitDialog(false);
  };

  const toggleSentenceWant = (sentenceIndex: number, want: WantType) => {
    const newAnalysis = { ...analysis };
    const wants = [...(newAnalysis.list[sentenceIndex].w || [])];
    if (wants.includes(want)) {
      newAnalysis.list[sentenceIndex].w = wants.filter((w: string) => w !== want);
    } else {
      newAnalysis.list[sentenceIndex].w = [...wants, want];
    }
    setAnalysis(newAnalysis);

    if (currentProject) {
      const updatedProject = {
        ...currentProject,
        list: newAnalysis.list,
        sum: analysis.sum
      };
      setCurrentProject(updatedProject);
      saveFocusedProject(updatedProject);
    }
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

    if (currentProject) {
      const updatedProject = {
        ...currentProject,
        list: newAnalysis.list,
        sum: analysis.sum
      };
      setCurrentProject(updatedProject);
      saveFocusedProject(updatedProject);
    }

    if (newAnalysis.list.length === 0) {
      reset();
    } else {
      setAnalysis(newAnalysis);
      // Check if all remaining are processed
      if (newAnalysis.list.length > 0 && newReleased.length + newSkipped.length === newAnalysis.list.length) {
        finishRelease(newReleased);
      }
    }
  };

  const updateSentenceNote = (index: number, note: string) => {
    const newAnalysis = { ...analysis };
    newAnalysis.list[index].note = note;
    setAnalysis(newAnalysis);

    if (currentProject) {
      const updatedProject = {
        ...currentProject,
        list: newAnalysis.list,
        sum: analysis.sum
      };
      saveFocusedProject(updatedProject);
      setCurrentProject(updatedProject);
    }
  };

  const finishRelease = (forceReleased?: number[]) => {
    if (analysis && analysis.list) {
      const finalReleasedIndices = forceReleased || releasedIndices;
      // If we're finishing from the middle of a sentence (i.e. choice screen), ensure current is included
      const sessionReleased = isSentenceFinished && !finalReleasedIndices.includes(releaseIndex) 
        ? [...finalReleasedIndices, releaseIndex] 
        : finalReleasedIndices;

      const shouldAutoMark = (settings as any)?.autoMarkReleased !== false;

      const newList = analysis.list.map((item: any, idx: number) => ({
        ...item,
        released: item.released || (shouldAutoMark && sessionReleased.includes(idx))
      }));
      
      const newAnalysis = { ...analysis, list: newList };
      setAnalysis(newAnalysis);

      if (currentProject) {
        const updatedProject = { ...currentProject, list: newList };
        setCurrentProject(updatedProject);
        saveFocusedProject(updatedProject);
      }

      // Record update
      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'focused',
        content: `${selectedTheme.title} 集中释放`,
        analysis: {
          list: newList,
          ana: analysis.sum
        },
        timestamp: Date.now()
      });
    }

    if (currentProject) {
      setStep('analysis');
      setReleaseIndex(0);
      setSixStepIndex(0);
      setIsSentenceFinished(false);
      setIsAnalyzing(false);
      setReleasedIndices([]);
      setSkippedIndices([]);
    } else {
      reset();
    }
  };

  const restartSequentialRelease = () => {
    const sequence = getReleaseSequence();
    if (sequence.length > 0) {
      setReleaseIndex(sequence[0]);
      setSixStepIndex(0);
      setIsSentenceFinished(false);
      // We don't mark as persistent released yet, just restart the session
      setReleasedIndices([]); 
    }
  };

  const handleManualSave = () => {
    if (!analysis) return;
    saveRecord({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'focused',
      content: `${selectedTheme.title} 集中释放`,
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
    setSelectedTheme(null);
    setAnalysis(null);
    setAnswers([]);
    setReleaseIndex(0);
    setSixStepIndex(0);
    setPrevStepWasNegative(false);
    setChatMessages([]);
    setChatInput('');
    setCurrentProject(null);
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

    let stepText = activeSteps[sixStepIndex];

    if (activeSteps === THREE_STEPS) {
      if (sixStepIndex === 0) {
        const currentItem = analysis?.list?.[releaseIndex];
        const content = currentItem?.ans || currentItem?.s || currentItem?.q || '这种感觉';
        return `你允许「${content}」存在吗？`;
      }
      if (sixStepIndex === 1) {
        if (prevStepWasNegative) {
          const currentItem = analysis?.list?.[releaseIndex];
          const wants = currentItem?.w || [];
          const wantLabels = wants.map((w: any) => WANT_LABELS[w as WantType]).filter(Boolean).join('、');
          return `你能识别出「${currentItem?.ans || currentItem?.s || '它'}」背后是${wantLabels || '哪种想要'}吗？`;
        }
        return `你能识别这是哪种想要吗？`;
      }
      if (sixStepIndex === 2) return `你能释放它吗？`;
    }

    if (activeSteps === EMOTION_STEPS) {
      if (sixStepIndex === 0) {
        const currentItem = analysis?.list?.[releaseIndex];
        const content = currentItem?.ans || currentItem?.s || currentItem?.q || '这种感觉';
        return `你允许「${content}」存在吗？`;
      }
      if (sixStepIndex === 1) return `你愿意让它离开吗？`;
    }

    if (activeSteps === SIX_STEPS && sixStepIndex === 2) {
      return `你能看到这些感受都源自这三个想要吗？你能立即释放它们吗？`;
    }

    if (stepText === 'AI_GEN_STEP') {
      const sentence = analysis?.list?.[releaseIndex]?.s || analysis?.list?.[releaseIndex]?.ans || analysis?.list?.[releaseIndex]?.q || '';
      return sentence;
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
    if (stepText === 'AI_GEN_STEP') {
      const sentence = analysis?.list?.[releaseIndex]?.s || analysis?.list?.[releaseIndex]?.ans || analysis?.list?.[releaseIndex]?.q || '';
      if (sentence.includes('允许')) return { primary: '允许', secondary: '不允许' };
      if (sentence.includes('愿意')) return { primary: '愿意', secondary: '不愿意' };
      if (sentence.includes('什么时候') || sentence.includes('何时')) return { primary: '现在', secondary: '以后' };
      return { primary: '能', secondary: '不能' };
    }

    if (stepText.includes('允许')) return { primary: '允许', secondary: '不允许' };
    if (stepText.includes('愿意')) return { primary: '愿意', secondary: '不愿意' };
    if (stepText.includes('能') || stepText.includes('可以')) return { primary: '能', secondary: '不能' };
    if (stepText.includes('什么时候') || stepText.includes('何时')) return { primary: '现在', secondary: '以后' };
    
    return { primary: '能', secondary: '不能' };
  };

  const [moreReleaseEmotion, setMoreReleaseEmotion] = useState('');
  const [moreReleaseWants, setMoreReleaseWants] = useState<WantType[]>([]);

  const handleMoreRelease = (wants: WantType[], emotion?: string) => {
    // Update current sentence wants and restart release
    const newList = [...analysis.list];
    const current = newList[releaseIndex];
    newList[releaseIndex] = {
      ...current,
      s: emotion ? `${current.s} (感受: ${emotion})` : current.s,
      w: wants.length > 0 ? wants : current.w,
      a: `追溯分析: ${emotion ? `情绪[${emotion}] ` : ''}${wants.map(w => WANT_LABELS[w]).join('、')}`
    };
    setAnalysis({ ...analysis, list: newList });
    setSixStepIndex(0);
    setIsSentenceFinished(false);
    setIsMoreReleaseOpen(false);
    setMoreReleaseEmotion('');
  };

  const toggleMoreWant = (want: WantType) => {
    setMoreReleaseWants(prev => 
      prev.includes(want) ? prev.filter(w => w !== want) : [...prev, want]
    );
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);
    
    const systemPrompt = "你是一个专业的瑟多纳释放法（Sedona Method）导师。你的目标是帮助用户化解他们在生活中感到的“卡住”或“胶着”的状态。请通过温和、觉察的提问，引导用户识别背后的“想要”（被认可、控制、安全、分离、合一），并引导他们进行释放。保持对话简洁、深刻且富有同理心。";
    
    try {
      let aiContent = '';
      setChatMessages(prev => [...prev, { role: 'ai', content: '' }]);
      
      const responseText = await callAI(
        `${systemPrompt}\n\n用户目前感到卡住的情况：${stuckSentences.map(s => s.text).join('; ')}\n\n用户说：${userMsg}`,
        (accumulated) => {
          setChatMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'ai') {
              return [...prev.slice(0, -1), { role: 'ai', content: accumulated }];
            }
            return prev;
          });
        },
        {
          model_type: settings?.selectedModel || 'MINIMAX25',
          invite_code: settings?.inviteCode || '',
          aiBaseUrl: settings?.useCustomConfig ? settings?.aiBaseUrl : undefined,
          aiApiKey: settings?.useCustomConfig ? settings?.aiApiKey : undefined,
          aiModelName: settings?.useCustomConfig ? settings?.aiModelName : undefined
        }
      );
      setChatMessages(prev => {
        const last = prev[prev.length - 1];
        if (last.role === 'ai') {
          return [...prev.slice(0, -1), { role: 'ai', content: responseText }];
        }
        return prev;
      });
    } catch (error) {
      console.error(error);
      setChatMessages(prev => [...prev, { role: 'ai', content: '抱歉，我遇到了一些问题，请稍后再试。' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const deleteStuck = (id: string) => {
    removeStuckSentence(id);
    setStuckSentences(getStuckSentences());
  };

  const releaseStuck = (sentence: any) => {
    const currentStuck = getStuckSentences();
    // Use selected items if any, otherwise use the clicked one
    const targetIds = selectedStuckIds.length > 0 ? selectedStuckIds : [sentence.id];
    const targetItems = currentStuck.filter(s => targetIds.includes(s.id));
    
    if (isMergedRelease && targetItems.length > 1) {
      const mergedText = targetItems.map(s => s.text).join(' & ');
      const mergedWants = Array.from(new Set(targetItems.flatMap(s => s.wants || [])));
      setAnalysis({
        list: [{ s: mergedText, w: mergedWants, a: '合并释放多个课题', id: 'merged' }],
        sum: '合并专项释放'
      });
    } else {
      setAnalysis({
        list: targetItems.map(s => ({ s: s.text, w: s.wants || [], a: s.analysis, id: s.id })),
        sum: '针对卡住课题的专项释放'
      });
    }
    startRelease(0, 'sequential');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {step === 'list' && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 px-1.5 md:px-2">
            {THEMES.map((theme) => (
              <Card 
                key={theme.id} 
                className="cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all border-none bg-card/60 backdrop-blur-sm group"
                onClick={() => startTheme(theme)}
              >
                <CardHeader className="p-4 md:p-6">
                  <CardTitle className="font-serif text-base md:text-lg flex items-center gap-2 group-hover:text-accent transition-colors">
                    <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                    {theme.title}
                  </CardTitle>
                  <CardDescription className="text-[10px] md:text-xs leading-relaxed">{theme.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </motion.div>
        )}

        {step === 'projects' && selectedTheme && (
          <motion.div key="projects" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 px-1">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep('list')} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> 返回主题列表
              </Button>
              <Badge variant="outline" className="border-accent text-accent">{selectedTheme.title}</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Card 
                className="cursor-pointer hover:bg-accent/5 transition-all border-dashed border-2 border-accent/30 hover:border-accent bg-transparent group h-32 flex flex-col items-center justify-center gap-2"
                onClick={() => setIsNewProjectDialogOpen(true)}
              >
                <FolderPlus className="w-8 h-8 text-accent group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-accent">开启新释放项目</span>
              </Card>

              <div className="space-y-3">
                <h3 className="text-sm font-serif font-bold text-muted-foreground uppercase tracking-widest px-1">历史项目</h3>
                {projects.filter(p => p.themeId === selectedTheme.id).length === 0 ? (
                  <div className="text-center py-10 bg-muted/20 rounded-2xl border border-dashed border-border/50 italic text-muted-foreground text-xs">
                    暂无项目记录
                  </div>
                ) : (
                  projects.filter(p => p.themeId === selectedTheme.id).map(project => (
                    <Card key={project.id} className="relative border-none shadow-md bg-card/60 backdrop-blur-sm group hover:shadow-lg transition-all overflow-hidden">
                      <div className="p-4 md:p-5 flex flex-col gap-4">
                        {/* Top-right Mark Complete */}
                        <div className="absolute top-3 right-3 z-10">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`h-7 text-[10px] px-2.5 rounded-full border transition-colors ${project.completed ? 'bg-success/10 text-success border-success/30' : 'bg-background/40 text-muted-foreground border-border/50 hover:bg-success/10 hover:text-success hover:border-success/30'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleProjectCompletion(project.id);
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {project.completed ? '已完成' : '标记完成'}
                          </Button>
                        </div>

                        {/* Project Info - Full Width (with padding for top-right button) */}
                        <div className="flex items-start gap-4 pr-24 cursor-pointer" onClick={() => loadProject(project)}>
                          <div className="p-3.5 rounded-2xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-all shrink-0 shadow-inner">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="flex-grow min-w-0 flex flex-col gap-2">
                            <h4 className={`font-serif font-bold text-base md:text-lg leading-tight break-words ${project.completed ? 'line-through text-muted-foreground opacity-70' : ''}`}>
                              {project.name}
                            </h4>
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant="outline" className="text-[9px] h-5 px-2 py-0 border-muted-foreground/20 text-muted-foreground bg-muted/5">{project.list.length} 条课题</Badge>
                              {project.list.some(i => i.released) && (
                                <Badge className="bg-success text-success-foreground border-none text-[9px] h-5 px-2 py-0 shadow-sm">释放中</Badge>
                              )}
                              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5 font-medium">
                                <Calendar className="w-3.5 h-3.5" />
                                {format(project.timestamp, 'yyyy-MM-dd HH:mm')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="flex items-center justify-between mt-1 pt-3 border-t border-border/10">
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            className="h-10 px-5 font-bold text-xs shadow-sm bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all" 
                            onClick={() => loadProject(project)}
                          >
                            进入项目继续释放 <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                          
                          {/* Bottom-right Trash */}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-full transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProject(project.id);
                            }}
                            title="删除项目"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
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
                  onClick={() => {
                    if (selectedTheme?.id === 'stuck_digging') {
                      setStep('analysis');
                      setSelectedTheme(THEMES.find(t => t.id === 'stuck'));
                    } else if (currentProject) {
                      setStep('analysis');
                    } else {
                      setStep('list');
                    }
                  }}
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <div className="pt-2">
                  <Badge variant="outline" className="w-fit mx-auto mb-1 border-accent text-accent text-[8px] md:text-[10px] py-0">{selectedTheme.title}</Badge>
                  <CardTitle className="font-serif text-lg md:text-2xl">请回答以下引导问句</CardTitle>
                  <CardDescription className="text-[9px] md:text-xs">您可以留空，直接进入分析。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-3 md:px-6 pb-6">
                <ScrollArea className="h-[400px] md:h-[500px] pr-2 md:pr-4">
                  <div className="space-y-6 py-2">
                    {selectedTheme.id === 'ai-gen' ? (
                      <div className="space-y-4">
                        <label className="text-sm font-medium text-foreground/80">请输入你当前想要显化或改变的主题/目标：</label>
                        <div className="relative">
                          <Textarea 
                            value={answers[0] || ''}
                            onChange={(e) => {
                              const newAnswers = [...answers];
                              newAnswers[0] = e.target.value;
                              setAnswers(newAnswers);
                            }}
                            placeholder="例如：我想显化 SP..."
                            className="min-h-[150px] bg-background/40 border-border/30 focus-visible:ring-accent text-sm pr-12"
                          />
                          {settings?.enableVoiceInput && (
                            <div className="absolute right-3 bottom-3">
                              <VoiceInput onResult={(voiceText) => {
                                const newAnswers = [...answers];
                                newAnswers[0] = (newAnswers[0] || '') + voiceText;
                                setAnswers(newAnswers);
                              }} />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      selectedTheme.questions.map((q: string, i: number) => (
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
                              className="h-10 md:h-12 bg-background/40 border-border/30 focus-visible:ring-accent text-[13px] md:text-sm pr-10"
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
                      ))
                    )}
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

        {step === 'analysis' && selectedTheme?.id === 'stuck' && (
          <motion.div key="stuck" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={() => { reset(); setStep('list'); }} className="gap-2">
                <ChevronLeft className="w-4 h-4" /> 返回主题列表
              </Button>
              <Badge variant="outline" className="border-accent text-accent">化解卡住中心</Badge>
            </div>

            <div className="space-y-6">
              <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Plus className="w-4 h-4 text-accent" />
                    添加卡住课题
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <Input 
                        placeholder="输入您感到卡住的主题..." 
                        value={manualStuckTopic}
                        onChange={(e) => setManualStuckTopic(e.target.value)}
                        className="h-12 bg-background/40 pr-10"
                      />
                      {settings?.enableVoiceInput && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2">
                          <VoiceInput size="sm" onResult={(voiceText) => setManualStuckTopic(prev => prev + voiceText)} />
                        </div>
                      )}
                    </div>
                    <Popover open={isWantSelectorOpen} onOpenChange={setIsWantSelectorOpen}>
                      <PopoverTrigger render={
                        <Button size="icon" className="h-12 w-12 rounded-xl bg-primary hover:bg-accent" disabled={!manualStuckTopic.trim()}>
                          <Plus className="w-6 h-6" />
                        </Button>
                      } />
                      <PopoverContent className="w-56 p-2 bg-card/90 backdrop-blur-xl border-border/40">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1">选择背后的想要 (可多选)</p>
                          <div className="space-y-1">
                            {(['approval', 'control', 'security'] as WantType[]).map((want) => (
                              <Button 
                                key={want} 
                                variant="ghost" 
                                className={`w-full justify-between text-xs h-9 ${tempWants.includes(want) ? 'bg-accent/20 text-accent' : ''}`}
                                onClick={() => {
                                  if (tempWants.includes(want)) {
                                    setTempWants(tempWants.filter(w => w !== want));
                                  } else {
                                    setTempWants([...tempWants, want]);
                                  }
                                }}
                              >
                                {want === 'approval' ? '想要被认可' : want === 'control' ? '想要控制' : '想要安全'}
                                {tempWants.includes(want) && <CheckCircle2 className="w-3 h-3" />}
                              </Button>
                            ))}
                          </div>
                          <Button 
                            className="w-full h-9 bg-primary hover:bg-accent text-primary-foreground text-xs"
                            onClick={handleAddStuck}
                          >
                            确认添加
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="font-serif text-lg">卡住列表</CardTitle>
                  <CardDescription className="text-xs">选择一个课题进行释放。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      {stuckSentences.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-xs italic">
                          列表为空
                        </div>
                      ) : (
                        stuckSentences.map((s) => (
                          <div 
                            key={s.id} 
                            onClick={() => {
                              if (selectedStuckIds.includes(s.id)) {
                                setSelectedStuckIds(selectedStuckIds.filter(id => id !== s.id));
                              } else {
                                setSelectedStuckIds([...selectedStuckIds, s.id]);
                              }
                              setStuckMode('none');
                            }}
                            className={`p-4 rounded-xl border transition-all cursor-pointer relative group flex items-center gap-3 ${
                              selectedStuckIds.includes(s.id) ? 'bg-accent/10 border-accent' : 'bg-background/40 border-border/30 hover:border-accent/30'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {selectedStuckIds.includes(s.id) ? (
                                <CheckCircle className="w-5 h-5 text-accent" />
                              ) : (
                                <Circle className="w-5 h-5 text-muted-foreground/30" />
                              )}
                            </div>
                            <div className="flex-grow">
                              <p className="text-sm font-serif italic pr-8 line-clamp-2">"{s.text}"</p>
                              <div className="flex gap-1 mt-1">
                                {s.wants && s.wants.map((w: string) => (
                                  <Badge key={w} variant="outline" className="text-[8px] h-4 px-1 border-accent/30 text-accent/70">
                                    {w === 'approval' ? '认可' : w === 'control' ? '控制' : '安全'}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteStuck(s.id);
                                if (selectedStuckIds.includes(s.id)) {
                                  setSelectedStuckIds(selectedStuckIds.filter(id => id !== s.id));
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {selectedStuckIds.length > 0 && (
                    <div className="flex flex-col gap-4 pt-4 border-t border-border/30">
                      <div className="flex gap-3">
                        <Button 
                          variant={stuckMode === 'self' ? 'default' : 'outline'}
                          className="flex-1 h-12 gap-2"
                          onClick={() => setStuckMode('self')}
                        >
                          <User className="w-4 h-4" /> 自主释放
                        </Button>
                        <Button 
                          variant={stuckMode === 'qa' ? 'default' : 'outline'}
                          className="flex-1 h-12 gap-2"
                          disabled={selectedStuckIds.length > 1}
                          onClick={() => setStuckMode('qa')}
                        >
                          <HelpCircle className="w-4 h-4" /> 问答释放
                        </Button>
                      </div>

                      {stuckMode === 'self' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            {(['three', 'six', 'emotions'] as const).map((m) => {
                              let label = m === 'three' ? '三步骤' : m === 'six' ? '六步骤' : '释放情绪';
                              
                              // Map customized names for 'three' and 'six' only
                              if (m === 'three' || m === 'six') {
                                const key = m === 'three' ? 'stuck_three' : 'stuck_six';
                                const groupId = settings?.moduleAssignments?.[key];
                                const group = settings?.questionGroups?.find(g => g.id === groupId);
                                if (group) label = group.name;
                              }

                              return (
                                <Button
                                  key={m}
                                  variant={releaseMethod === m ? 'secondary' : 'ghost'}
                                  size="sm"
                                  className="text-[10px] h-8 truncate px-1"
                                  title={label}
                                  onClick={() => setReleaseMethod(m)}
                                >
                                  {label}
                                </Button>
                              );
                            })}
                          </div>
                          
                          {selectedStuckIds.length > 1 && (
                            <div className="flex items-center justify-center gap-4 py-1 bg-accent/5 rounded-lg border border-accent/10">
                              <span className="text-[10px] text-muted-foreground">释放方式:</span>
                              <div className="flex gap-2">
                                <Button 
                                  variant={!isMergedRelease ? 'secondary' : 'ghost'} 
                                  size="sm" 
                                  className="h-6 text-[9px] px-2"
                                  onClick={() => setIsMergedRelease(false)}
                                >
                                  逐个释放
                                </Button>
                                <Button 
                                  variant={isMergedRelease ? 'secondary' : 'ghost'} 
                                  size="sm" 
                                  className="h-6 text-[9px] px-2"
                                  onClick={() => setIsMergedRelease(true)}
                                >
                                  合并释放
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          <Button 
                            className="w-full h-10 bg-accent hover:bg-accent/90 text-white text-xs font-bold shadow-lg shadow-accent/20"
                            onClick={() => releaseStuck(null)}
                          >
                            开始释放 ({selectedStuckIds.length}个课题)
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    {stuckMode === 'qa' && selectedStuckIds.length === 1 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -10 }}
                        className="pt-6 space-y-6 border-t border-border/30 mt-6"
                      >
                        <div className="text-center space-y-4">
                          <div className="p-6 rounded-2xl bg-accent/5 border border-accent/10 max-w-md mx-auto">
                            <p className="text-lg font-serif italic">"{stuckSentences.find(s => s.id === selectedStuckIds[0])?.text}"</p>
                          </div>
                          <p className="text-sm text-muted-foreground">通过深度问答挖掘潜意识中的阻碍。</p>
                          <Button 
                            size="lg" 
                            className="h-14 px-10 rounded-full bg-accent hover:bg-accent/80 text-accent-foreground shadow-xl transition-all gap-2"
                            onClick={() => {
                              const s = stuckSentences.find(s => s.id === selectedStuckIds[0]);
                              if (!s) return;
                              setSelectedTheme({
                                id: 'stuck_digging',
                                title: '问答挖掘',
                                questions: [
                                  '你现在感到卡住的主题是什么？',
                                  '这件事对我有什么好处？',
                                  '这件事对我有什么坏处？',
                                  '我现在对此的感觉是什么？'
                                ]
                              });
                              setAnswers([s.text, '', '', '']);
                              setStep('questions');
                            }}
                          >
                            <HelpCircle className="w-5 h-5" /> 进入问答挖掘
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {step === 'analysis' && selectedTheme?.id !== 'stuck' && analysis && (
          <motion.div key="analysis" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 md:space-y-6 px-1">
            <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
              <CardHeader className="relative pt-2.5 pb-1 md:pt-4 md:pb-2 px-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-1 top-2 md:left-4 md:top-3 rounded-full h-8 w-8"
                  onClick={() => currentProject ? setStep('projects') : setStep('questions')}
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <div className="pt-1 px-6 md:pt-2 md:px-8">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <Badge variant="outline" className="border-accent/40 text-accent/70 text-[8px] uppercase tracking-wider">{selectedTheme.title}</Badge>
                    {currentProject && <Badge className="bg-primary/20 text-primary border-none text-[8px] uppercase tracking-wider">项目: {currentProject.name}</Badge>}
                  </div>
                  <CardTitle className="font-serif text-base md:text-xl">释放进度与深度剖析</CardTitle>
                  <CardDescription className="text-[8px] md:text-xs">您可以调整 AI 挖掘出的“想要”。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-3 md:px-6 pb-6 pt-0">
                <div className="flex flex-col gap-2">
                  {selectedTheme?.id !== 'ai-gen' && (
                    <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 rounded-xl">
                      <button 
                        className={`py-1.5 md:py-2 text-[10px] md:text-sm rounded-lg transition-all ${releaseOrderMode === 'round' ? 'bg-background shadow-sm text-accent font-bold' : 'text-muted-foreground hover:bg-background/40'}`}
                        onClick={() => setReleaseOrderMode('round')}
                      >
                        按解析批次
                      </button>
                      <button 
                        className={`py-1.5 md:py-2 text-[10px] md:text-sm rounded-lg transition-all ${releaseOrderMode === 'list' ? 'bg-background shadow-sm text-accent font-bold' : 'text-muted-foreground hover:bg-background/40'}`}
                        onClick={() => setReleaseOrderMode('list')}
                      >
                        按题目顺序
                      </button>
                    </div>
                  )}

                  {releaseOrderMode === 'round' && (
                    <div className="flex items-center justify-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      <Button 
                        variant={selectedRound === 'all' ? 'default' : 'outline'} 
                        size="sm" 
                        className="rounded-full h-6 text-[9px] px-2.5 shrink-0"
                        onClick={() => setSelectedRound('all')}
                      >
                        全部
                      </Button>
                      {Array.from(new Set((analysis.list || []).map((item: any) => item.round || 1)))
                        .sort((a: any, b: any) => a - b)
                        .map((round: any) => (
                        <Button 
                          key={round}
                          variant={selectedRound === round ? 'default' : 'outline'} 
                          size="sm" 
                          className="rounded-full h-6 text-[9px] px-2.5 shrink-0"
                          onClick={() => setSelectedRound(round)}
                        >
                          第 {round} 批
                        </Button>
                      ))}
                    </div>
                  )}

                  <Button 
                    className="w-full h-12 md:h-14 bg-primary hover:bg-accent text-primary-foreground shadow-lg gap-2 text-sm md:text-base font-bold rounded-2xl" 
                    onClick={() => {
                      startRelease(getReleaseSequence()[0] || 0, 'sequential');
                    }}
                    disabled={!analysis.list || analysis.list.length === 0 || getReleaseSequence().length === 0}
                  >
                    <RefreshCcw className="w-5 h-5" /> 开始释放项目内容
                  </Button>
                  
                  {currentProject && (
                    <Button 
                      variant="outline"
                      className="w-full h-10 border-accent/40 text-accent hover:bg-accent/5 gap-2 text-xs" 
                      onClick={() => {
                        setAnswers(new Array(selectedTheme.questions.length).fill(''));
                        setStep('questions');
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> 在当前项目中继续挖掘
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 md:gap-3">
                  {analysis.w && analysis.w.map((w: string) => (
                    <Badge key={w} className="bg-accent/20 text-accent border-none px-2.5 md:px-4 py-1.5 text-[10px] md:text-sm">
                      {WANT_LABELS[w as WantType] || w}
                    </Badge>
                  ))}
                </div>

                <ScrollArea className="h-[400px] md:h-[450px] pr-2 md:pr-4">
                  <div className="space-y-4 md:space-y-6">
                    {/* List Rendering logic based on mode */}
                        {Object.entries(
                          (analysis.list || [])
                            .filter((item: any) => releaseOrderMode !== 'round' || selectedRound === 'all' || item.round === selectedRound)
                            .reduce((acc: any, curr: any) => {
                              let groupKey = '释放导引';
                              if (releaseOrderMode === 'list') {
                                groupKey = curr.phase || curr.q || '自由书写';
                              } else {
                                groupKey = `第 ${curr.round || 1} 批`;
                              }
                              
                              if (!acc[groupKey]) acc[groupKey] = [];
                              acc[groupKey].push(curr);
                              return acc;
                            }, {})
                        ).map(([groupTitle, items]: [string, any], groupIdx) => (
                      <div key={groupIdx} className="space-y-2.5">
                        {(selectedTheme?.id !== 'ai-gen' || (releaseOrderMode === 'round')) && (
                          <div className="flex items-center gap-2 px-1">
                            <div className="w-1 h-6 bg-accent rounded-full" />
                            <h3 className="text-xs md:text-sm font-serif font-bold text-foreground/80 leading-snug">
                              {groupTitle}
                            </h3>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {items.map((item: any, itemIdx: number) => {
                            // Find the original index in analysis.list to ensure actions like toggleManualRelease work
                            const originalIdx = (analysis.list || []).indexOf(item);
                            
                            const isReleased = item.released || releasedIndices.includes(originalIdx);
                            const isAIGen = selectedTheme?.id === 'ai-gen';
                            
                            return (
                              <div key={itemIdx} className={`p-3 md:p-4 rounded-xl border transition-all duration-300 space-y-2 relative group ${isReleased ? 'opacity-50 grayscale-[0.3] bg-muted/10 border-success/30' : 'bg-background/40 border-border/30 hover:border-accent/40 shadow-sm'}`}>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <span className="shrink-0 bg-accent/10 text-accent/60 text-[8px] md:text-[9px] px-1 md:px-1.5 h-4 rounded shadow-sm flex items-center justify-center font-bold not-italic" title={`${item.round || 1} 次解析`}>
                                        {isAIGen ? (item.phase || `第 ${item.round || 1} 批`) : `第 ${item.round || 1} 批`}
                                      </span>
                                      {isReleased && <Badge variant="outline" className="text-[8px] h-4 px-1 border-success text-success bg-success/10">已释放</Badge>}
                                    </div>
                                  <button 
                                    onClick={() => toggleManualRelease(originalIdx)}
                                    className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center transition-all ${isReleased ? 'bg-success text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-success/10 hover:text-success'}`}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1 items-center py-0.5 justify-end">
                                  {item.w && item.w.length > 0 && item.w.map((w: WantType) => (
                                    <Badge key={w} variant="secondary" className="bg-secondary/10 text-muted-foreground border-none px-1.5 py-0 text-[8px] flex items-center gap-1 shrink-0">
                                      {WANT_LABELS[w]}
                                      <X className="w-2 h-2 cursor-pointer hover:text-destructive" onClick={() => toggleSentenceWant(originalIdx, w)} />
                                    </Badge>
                                  ))}
                                  {(!isAIGen || (item.w && item.w.length > 0)) && (
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
                                            onClick={() => toggleSentenceWant(originalIdx, w)}
                                          >
                                            {WANT_LABELS[w]}
                                          </Button>
                                        ))}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>

                                <div className="text-[12px] md:text-[13px] text-foreground/90 leading-snug font-serif italic border-l-2 border-accent/20 pl-3 flex flex-col gap-1">
                                  {!isAIGen && item.q && (
                                    <div className="flex flex-col gap-0.5 mb-0.5">
                                      <span className="text-muted-foreground/60 text-[9px] not-italic font-sans font-medium">问题：</span>
                                      <span className="text-muted-foreground/80 font-sans not-italic text-[10px] md:text-xs bg-muted/20 p-1 rounded-md border border-border/10">{item.q}</span>
                                    </div>
                                  )}
                                  {!isAIGen && <span className="text-muted-foreground/60 text-[9px] not-italic font-sans font-medium">回答：</span>}
                                  <span>"{item.s || item.ans || '未内容'}"</span>
                                </div>

                                {item.note && (
                                  <div className="p-1.5 rounded-lg bg-secondary/5 border border-secondary/10 flex gap-1.5 items-start">
                                    <StickyNote className="w-3 h-3 text-secondary mt-0.5 shrink-0" />
                                    <p className="text-[9px] text-muted-foreground whitespace-pre-wrap">{item.note}</p>
                                  </div>
                                )}

                                {!isAIGen && item.a && (
                                  <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/10">
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                      <span className="font-bold text-accent mr-1 uppercase text-[8px]">解析:</span> {item.a}
                                    </p>
                                  </div>
                                )}
                                
                                <div className="pt-1 flex gap-2">
                                  <Button size="sm" variant="outline" className="flex-1 h-8 border-accent/30 text-accent hover:bg-accent/10 text-[10px] gap-1.5" onClick={() => {
                                    startRelease(originalIdx, 'single');
                                  }}>
                                    <Zap className="w-3 h-3" /> 释放
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeSentence(originalIdx)}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    
                    {isAnalyzing && (
                      <div className="p-5 rounded-2xl bg-accent/5 border border-dashed border-accent/20 animate-pulse flex items-center justify-center h-24">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-accent" />
                          <p className="text-[10px] text-accent font-medium">AI 深度分析中...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="p-4 md:p-6 rounded-2xl bg-secondary/10 border border-secondary/20 leading-relaxed text-xs md:text-base text-foreground/90 italic">
                  <h4 className="font-bold text-[10px] md:text-sm mb-2 text-secondary-foreground flex items-center gap-2 uppercase tracking-wide not-italic">
                    <RefreshCcw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isAnalyzing ? 'animate-spin' : ''}`} /> 分析总结
                  </h4>
                  {isAnalyzing && (!analysis.sum || analysis.sum.length < 5) ? (
                    <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>正在深度提炼整体执念...</span>
                    </div>
                  ) : (
                    analysis.sum
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-11 md:h-12 border-primary/30 hover:bg-primary/10 text-xs md:text-sm" 
                    onClick={() => {
                      setAnswers(new Array(selectedTheme.questions.length).fill(''));
                      setAnalysis(null);
                      setStep('questions');
                    }}
                  >
                    清空并退出
                  </Button>
                  <Button variant="secondary" className="flex-1 h-11 md:h-12 border-accent/30 hover:bg-accent/10 text-xs md:text-sm" onClick={handleManualSave}>
                    <Save className="w-4 h-4 mr-2" /> 手动保存
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
                <Badge variant="outline" className="px-3 md:px-4 py-1 border-accent text-accent text-[9px] md:text-sm">
                  第 {analysis.list[releaseIndex].round || 1} 批
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

              {/* Row 2: Original Sentence (with its wrapper) */}
              <div className="w-full">
                <h2 className="text-[19px] md:text-[24px] font-serif leading-tight text-foreground px-2 font-bold">
                  "{analysis.list[releaseIndex].ans || analysis.list[releaseIndex].s || analysis.list[releaseIndex].q}"
                </h2>
              </div>

              {/* Row 3: Explanation */}
              {analysis.list[releaseIndex].a && (
                <div className="text-[10px] md:text-[12px] text-muted-foreground bg-background/50 p-3 rounded-xl border border-border/20 shadow-sm max-w-sm mx-auto">
                   <span className="font-bold text-accent mr-1 uppercase text-[8px] block mb-1 font-sans">解析说明</span>
                  {analysis.list[releaseIndex].a}
                </div>
              )}

              {/* Row 4: Three Wants */}
              <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
                {analysis.list[releaseIndex].w && analysis.list[releaseIndex].w.map((w: WantType) => (
                  <Badge key={w} variant="secondary" className="bg-accent/10 text-accent border border-accent/20 px-3 py-1 text-[10px] md:text-[12px] font-bold">
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
                              <h4 className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  <StickyNote className="w-3 h-3" /> 释放记录/便签
                                </div>
                                {settings?.enableVoiceInput && (
                                  <VoiceInput size="sm" onResult={(voiceText) => updateSentenceNote(releaseIndex, (analysis.list[releaseIndex].note || '') + voiceText)} />
                                )}
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
                        <motion.div key={sixStepIndex} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-[17px] md:text-lg font-medium text-foreground leading-snug min-h-[70px] flex items-center justify-center px-4">
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
                      {(() => {
                        const sequence = getReleaseSequence();
                        const currentIndexInSeq = sequence.indexOf(releaseIndex);
                        const isLastInSeq = !isSequential || currentIndexInSeq === sequence.length - 1;

                        if (isLastInSeq) {
                          return (
                            <>
                              <Button size="lg" className="h-12 md:h-14 rounded-2xl bg-primary hover:bg-accent text-primary-foreground text-sm md:text-base font-bold shadow-lg" onClick={continueRelease}>
                                完成并退出项目
                              </Button>
                              <Button variant="outline" size="lg" className="h-12 md:h-14 rounded-2xl border-primary/30 text-primary hover:bg-primary/5 text-sm md:text-base font-bold shadow-sm" onClick={restartSequentialRelease}>
                                从头开始释放项目
                              </Button>
                            </>
                          );
                        }

                        return (
                          <Button size="lg" className="h-12 md:h-14 rounded-2xl bg-primary hover:bg-accent text-primary-foreground text-sm md:text-base font-bold shadow-lg" onClick={continueRelease}>
                            继续下一句
                          </Button>
                        );
                      })()}
                      
                      <Button variant="outline" size="lg" className="h-12 md:h-14 rounded-2xl border-accent/30 text-accent hover:bg-accent/10 text-sm md:text-base font-medium" onClick={reRelease}>
                        重新释放这一句
                      </Button>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:text-accent text-[11px] h-8 mt-2"
                        onClick={() => setIsMoreReleaseOpen(true)}
                      >
                        <Zap className="w-3.5 h-3.5 mr-1" /> 深入释放更多
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

      <Dialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card/90 backdrop-blur-xl border-border/40">
          <DialogHeader>
            <DialogTitle className="font-serif">开启新释放项目</DialogTitle>
            <DialogDescription>为这个释放过程起一个容易辨识的名字。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name" className="flex items-center justify-between w-full">
                项目名称
                {settings?.enableVoiceInput && (
                  <VoiceInput size="sm" onResult={(voiceText) => setNewProjectName(prev => prev + voiceText)} />
                )}
              </Label>
              <Input 
                id="project-name" 
                placeholder="例如：目标提升、化解XX的焦虑..." 
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateNewProject();
                }}
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setIsNewProjectDialogOpen(false)}>取消</Button>
            <Button className="flex-1 bg-accent" onClick={handleCreateNewProject} disabled={!newProjectName.trim()}>确认开启</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认退出本句释放？</DialogTitle>
            <DialogDescription>
              您可以选择将本句移动到“化解卡住”板块，或者直接返回。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleQuit(false)}>
              直接返回
            </Button>
            <Button className="flex-1 bg-accent hover:bg-accent/80" onClick={() => handleQuit(true)}>
              移动到“化解卡住”并返回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isMoreReleaseOpen} onOpenChange={setIsMoreReleaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <Zap className="w-5 h-5 text-accent" /> 释放更多
            </DialogTitle>
            <DialogDescription>
              深入挖掘当前感受背后的底层想要。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="flex items-center justify-between w-full">
                现在的感受/情绪是什么？
                {settings?.enableVoiceInput && (
                  <VoiceInput size="sm" onResult={(voiceText) => setMoreReleaseEmotion(prev => prev + voiceText)} />
                )}
              </Label>
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
              onClick={() => handleMoreRelease(moreReleaseWants, moreReleaseEmotion)}
            >
              开始深入分析释放
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
