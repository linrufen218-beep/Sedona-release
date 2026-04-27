import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { analyzeReleaseText } from '@/services/geminiService';
import { AppSettings, saveRecord, WantType, addStuckSentence, getComponentState, saveComponentState, STORAGE_KEYS } from '@/lib/store';
import { Loader2, Plus, CheckCircle2, RefreshCcw, ArrowRight, ArrowLeft, X, Zap, LogOut, Save, ChevronLeft, StickyNote, Mic } from 'lucide-react';
import { VoiceInput } from './VoiceInput';
import { motion, AnimatePresence } from 'motion/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const WANT_LABELS: Record<WantType, string> = {
  approval: '想要被认同',
  control: '想要控制',
  security: '想要安全',
};

const SIX_STEPS = [
  '你必须想要“波动不想”超过你想要“被认同”、“控制”或“安全”吗？',
  '你决定通过释放来达到“波动不想”吗？',
  '你能看到这些情绪感受都源自这三个想要吗？你能立即释放它们吗？',
  '你愿意在任何时候，无论独处或人前，都持续释放这些想要吗？',
  '如果你现在感觉“卡住了”，你愿意放开对这个“卡住”的想要控制吗？',
  '你现在感觉更轻松、更快乐了一点吗？',
];

const THREE_STEPS = [
  '你允许这种感觉存在吗？',
  '你能识别这是什么想要吗？',
  '你能释放它吗？',
];

function getAnalysisSummary(analysis: any) {
  return analysis?.sum || analysis?.ana || '';
}

export default function DailyRelease({ settings }: { settings?: AppSettings }) {
  const [text, setText] = useState(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.text || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.analysis || null);
  const [step, setStep] = useState<'input' | 'analysis' | 'release'>(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.step || 'input');
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.currentSentenceIndex || 0);
  const [sixStepIndex, setSixStepIndex] = useState(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.sixStepIndex || 0);
  const [activeSteps, setActiveSteps] = useState<string[]>(SIX_STEPS);
  const [isSequential, setIsSequential] = useState(true);
  const [isSentenceFinished, setIsSentenceFinished] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [skippedIndices, setSkippedIndices] = useState<number[]>(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.skippedIndices || []);
  const [releasedIndices, setReleasedIndices] = useState<number[]>(() => getComponentState(STORAGE_KEYS.DAILY_STATE)?.releasedIndices || []);
  const [isMoreReleaseOpen, setIsMoreReleaseOpen] = useState(false);
  const [moreReleaseEmotion, setMoreReleaseEmotion] = useState('');
  const [moreReleaseWants, setMoreReleaseWants] = useState<WantType[]>([]);
  const [isSubQuestion, setIsSubQuestion] = useState(false);
  const [prevStepWasNegative, setPrevStepWasNegative] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'unreleased' | 'released'>('all');
  const [exploreMoreText, setExploreMoreText] = useState('');
  const [isExploringMore, setIsExploringMore] = useState(false);
  const [showExploreMoreUI, setShowExploreMoreUI] = useState(false);

  // Resolve current active steps and labels
  const getAssignment = () => {
    const groupId = settings?.moduleAssignments?.daily;
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

  // Save state on changes
  useEffect(() => {
    saveComponentState(STORAGE_KEYS.DAILY_STATE, {
      text,
      analysis,
      step,
      currentSentenceIndex,
      releasedIndices,
      skippedIndices,
      sixStepIndex
    });
  }, [text, analysis, step, currentSentenceIndex, releasedIndices, skippedIndices, sixStepIndex]);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    setStep('analysis');
    setAnalysis({ list: [], sum: '', ana: '' });
    setReleasedIndices([]);
    setSkippedIndices([]);
    setCurrentSentenceIndex(0);
    setSixStepIndex(0);
    try {
      const result = await analyzeReleaseText(
        text, 
        (partial) => {
          setAnalysis(partial);
        },
        {
          model_type: settings?.selectedModel || 'MINIMAX25',
          invite_code: settings?.inviteCode,
          aiBaseUrl: settings?.useCustomConfig ? settings?.aiBaseUrl : undefined,
          aiApiKey: settings?.useCustomConfig ? settings?.aiApiKey : undefined,
          aiModelName: settings?.useCustomConfig ? settings?.aiModelName : undefined
        }
      );
      setAnalysis(result);
      
      // Auto save record after successful analysis
      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'daily',
        content: text,
        analysis: result,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      console.error(error);
      alert(error.message || '分析失败，请检查 Worker 配置或网络。');
      setStep('input');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateSentenceNote = (index: number, note: string) => {
    const newAnalysis = { ...analysis };
    newAnalysis.list[index].note = note;
    setAnalysis(newAnalysis);
  };

  const toggleWant = (sentenceIndex: number, want: WantType) => {
    const newAnalysis = { ...analysis };
    const wants = [...newAnalysis.list[sentenceIndex].w];
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
      reset();
    } else {
      setAnalysis(newAnalysis);
      // Check if all remaining are processed
      if (newAnalysis.list.length > 0 && newReleased.length + newSkipped.length === newAnalysis.list.length) {
        finishAll();
      }
    }
  };

  const startRelease = (index: number, mode: 'sequential' | 'single') => {
    setStep('release');
    setCurrentSentenceIndex(index);
    setSixStepIndex(0);
    setPrevStepWasNegative(false);
    setIsSequential(mode === 'sequential');
    setIsSentenceFinished(false);
    setIsSubQuestion(false);
    if (mode === 'sequential') {
      setSkippedIndices([]);
      setReleasedIndices([]);
    }
    
    setActiveSteps(getEffectiveSteps(index, mode));
  };

  const getStepContent = () => {
    const group = getAssignment();

    if (isSubQuestion) {
      if (group && group.steps[sixStepIndex]?.hasBranch) {
        return group.steps[sixStepIndex].branchQuestion || '你想补充什么吗？';
      }
      const isThreeSteps = activeSteps.length === THREE_STEPS.length && activeSteps[0] === THREE_STEPS[0];
      if (isThreeSteps && (sixStepIndex === 0 || sixStepIndex === 1)) {
        const wants = analysis?.list?.[currentSentenceIndex]?.w || [];
        const wantLabels = wants.map((w: any) => WANT_LABELS[w as WantType]).filter(Boolean).join(', ');
        return `你能识别这是${wantLabels || '某种想要'}吗？`;
      }
      return '你能识别这是什么想要吗？';
    }

    const stepText = activeSteps[sixStepIndex];
    
    if (activeSteps.length === THREE_STEPS.length && activeSteps[0] === THREE_STEPS[0]) {
      if (sixStepIndex === 0) return '你允许这种感觉存在吗？';
      if (sixStepIndex === 1) {
        if (prevStepWasNegative) {
          const currentItem = analysis?.list?.[currentSentenceIndex];
          const wants = currentItem?.w || [];
          const wantLabels = wants.map((w: any) => WANT_LABELS[w as WantType]).filter(Boolean).join(', ');
          return `你能识别这是${wantLabels || '某种想要'}吗？`;
        }
        return '你能识别这是什么想要吗？';
      }
      if (sixStepIndex === 2) return '你能释放它吗？';
    }
    
    return stepText;
  };

  const getButtonLabels = () => {
    const group = getAssignment();
    
    if (isSubQuestion) {
      if (group && group.steps[sixStepIndex]?.hasBranch) {
        const branchText = group.steps[sixStepIndex].branchQuestion || '';
        if (branchText.includes('allow')) return { primary: '允许', secondary: '还不能' };
        if (branchText.includes('willing')) return { primary: '愿意', secondary: '不愿意' };
        if (branchText.includes('can')) return { primary: '能', secondary: '不能' };
        if (branchText.includes('when')) return { primary: '现在', secondary: '以后' };
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
    if (stepText.includes('allow')) return { primary: '允许', secondary: '还不能' };
    if (stepText.includes('willing')) return { primary: '愿意', secondary: '不愿意' };
    if (stepText.includes('can')) return { primary: '能', secondary: '不能' };
    if (stepText.includes('when')) return { primary: '现在', secondary: '以后' };
    
    return { primary: '能', secondary: '不能' };
  };

  const nextStep = (isPrimary: boolean) => {
    const group = getAssignment();

    if (!isSentenceFinished && !isPrimary && !isSubQuestion && group && group.steps[sixStepIndex]?.hasBranch) {
      setIsSubQuestion(true); // Reuse isSubQuestion state for branch to keep UI minimal
      return;
    }

    if (isSubQuestion) {
      setIsSubQuestion(false);
      if (sixStepIndex < activeSteps.length - 1) {
        setSixStepIndex(sixStepIndex + 1);
      } else {
        setIsSentenceFinished(true);
      }
      return;
    }

    // Tracking negative answer
    setPrevStepWasNegative(!isPrimary && !isSubQuestion);

    // Task: If on Step 2 of Three Steps and user clicks "No" (Secondary)
    // Three steps are: allow the feeling, identify the want, release it.
    const isThreeSteps = activeSteps.length === THREE_STEPS.length && activeSteps[0] === THREE_STEPS[0];
    if (isThreeSteps && sixStepIndex === 1 && !isPrimary) {
      setIsSubQuestion(true);
      return;
    }

    if (sixStepIndex < activeSteps.length - 1) {
      setSixStepIndex(sixStepIndex + 1);
    } else {
      setIsSentenceFinished(true);
    }
  };

  const continueRelease = () => {
    const newReleased = [...releasedIndices, currentSentenceIndex];
    setReleasedIndices(newReleased);
    setPrevStepWasNegative(false);
    setIsSentenceFinished(false);
    
    if (currentSentenceIndex < analysis.list.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
      setSixStepIndex(0);
      setActiveSteps(getEffectiveSteps(currentSentenceIndex + 1, isSequential ? 'sequential' : 'single'));
    } else {
      // Finished current sentences
      if (isAnalyzing) {
        setStep('analysis');
      } else {
        finishAll(newReleased);
      }
    }
  };

  const reRelease = () => {
    setSixStepIndex(0);
    setPrevStepWasNegative(false);
    setIsSentenceFinished(false);
  };

  const handleMoreRelease = () => {
    if (!moreReleaseEmotion.trim() || moreReleaseWants.length === 0) return;
    
    const newAnalysis = { ...analysis };
    newAnalysis.list[currentSentenceIndex] = {
      ...newAnalysis.list[currentSentenceIndex],
      s: `(深入) ${moreReleaseEmotion}`,
      w: moreReleaseWants,
      a: `针对“${moreReleaseEmotion}”的进一步释放引导`,
    };
    
    setAnalysis(newAnalysis);
    setMoreReleaseEmotion('');
    setMoreReleaseWants([]);
    setIsMoreReleaseOpen(false);
    reRelease();
  };

  const toggleMoreWant = (want: WantType) => {
    setMoreReleaseWants(prev => 
      prev.includes(want) ? prev.filter(w => w !== want) : [...prev, want]
    );
  };

  const skipSentence = () => {
    const newSkipped = [...skippedIndices, currentSentenceIndex];
    setSkippedIndices(newSkipped);
    if (currentSentenceIndex < analysis.list.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
      setSixStepIndex(0);
      setActiveSteps(getEffectiveSteps(currentSentenceIndex + 1, isSequential ? 'sequential' : 'single'));
    } else {
      // Finished current sentences
      if (isAnalyzing) {
        setStep('analysis');
      } else {
        finishAll();
      }
    }
  };

  const restartRelease = () => {
    setCurrentSentenceIndex(0);
    setSixStepIndex(0);
    setIsSentenceFinished(false);
    setReleasedIndices([]);
  };

  const toggleManualRelease = (index: number) => {
    if (!analysis || !analysis.list) return;
    const newList = [...analysis.list];
    newList[index] = { ...newList[index], released: !newList[index].released };
    setAnalysis({ ...analysis, list: newList });
  };

  const finishAll = (forceReleasedIndices?: number[]) => {
    if (analysis && analysis.list) {
      const finalReleased = forceReleasedIndices || releasedIndices;
      const shouldAutoMark = (settings as any)?.autoMarkReleased !== false;
      
      // Mark as released in analysis list
      const newList = analysis.list.map((item: any, idx: number) => ({
        ...item,
        released: item.released || (shouldAutoMark && (finalReleased.includes(idx) || (isSentenceFinished && idx === currentSentenceIndex)))
      }));
      
      setAnalysis({ ...analysis, list: newList });

      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'daily',
        content: text,
        analysis: { ...analysis, list: newList },
        timestamp: Date.now(),
      });
    }
    setStep('analysis');
    setReleasedIndices([]);
    setIsSentenceFinished(false);
  };

  const handleManualSave = () => {
    if (!analysis) return;
    saveRecord({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'daily',
      content: text,
      analysis: analysis,
      timestamp: Date.now(),
    });
    alert('记录已手动保存。');
  };

  const handleQuit = (moveToStuck: boolean) => {
    if (moveToStuck) {
      // Find unreleased and skipped sentences
      analysis.list.forEach((s: any, i: number) => {
        if (!releasedIndices.includes(i)) {
          addStuckSentence({
            text: s.s,
            wants: s.w,
            analysis: s.a,
            source: '日常释放'
          });
        }
      });
    }
    
    // Save progress before quitting
    finishAll();
    setShowQuitDialog(false);
  };

  const reset = () => {
    setStep('input');
    setText('');
    setAnalysis(null);
    setPrevStepWasNegative(false);
    setExploreMoreText('');
    setFilterMode('all');
  };

  const handleExploreMore = async () => {
    if (!exploreMoreText.trim()) return;
    setIsExploringMore(true);
    try {
      const result = await analyzeReleaseText(
        exploreMoreText,
        undefined,
        {
          model_type: settings?.selectedModel || 'MINIMAX25',
          invite_code: settings?.inviteCode,
          aiBaseUrl: settings?.useCustomConfig ? settings?.aiBaseUrl : undefined,
          aiApiKey: settings?.useCustomConfig ? settings?.aiApiKey : undefined,
          aiModelName: settings?.useCustomConfig ? settings?.aiModelName : undefined
        }
      );
      
      if (result && result.list) {
        const newAnalysis = { ...analysis };
        newAnalysis.list = [...newAnalysis.list, ...result.list];
        const extraSummary = getAnalysisSummary(result);
        if (extraSummary) {
          newAnalysis.sum = (getAnalysisSummary(analysis) || '') + " \n\n[探究更多]: " + extraSummary;
        }
        setAnalysis(newAnalysis);
        setExploreMoreText('');
        setShowExploreMoreUI(false);
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message || '分析失败，请检查网络。');
    } finally {
      setIsExploringMore(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {step === 'input' && (
          <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="px-1">
            <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
              <CardHeader className="py-4 md:py-6">
                <CardTitle className="text-xl md:text-2xl font-serif text-foreground">记录当下的感受</CardTitle>
                <CardDescription className="text-xs md:text-sm">你可以释放任何负面或正面的情绪。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 relative px-3 md:px-6 pb-6">
                <div className="relative">
                  <Textarea
                    placeholder="我现在感觉到什么？"
                    className="min-h-[220px] md:min-h-[250px] text-base md:text-lg leading-relaxed resize-none bg-background/50 border-border/50 focus-visible:ring-accent pr-12"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  {settings?.enableVoiceInput && (
                    <div className="absolute right-3 bottom-3">
                      <VoiceInput onResult={(voiceText) => setText(prev => prev + voiceText)} />
                    </div>
                  )}
                </div>
                <Button 
                  className="w-full h-12 md:h-14 text-base md:text-lg font-medium bg-primary hover:bg-accent text-primary-foreground transition-all duration-300" 
                  disabled={isAnalyzing || !text.trim()}
                  onClick={handleAnalyze}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 md:h-6 md:w-6 animate-spin" />
                      AI 正在深度分析中...
                    </>
                  ) : (
                    '开始深度分析'
                  )}
                </Button>
                <Button 
                  variant="ghost"
                  className="w-full h-10 text-muted-foreground hover:text-accent mt-2"
                  onClick={() => setText('')}
                  disabled={isAnalyzing || !text.trim()}
                >
                  清空
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'analysis' && analysis && showExploreMoreUI && (
          <motion.div key="explore-more" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="px-1">
            <Card className="border-none shadow-xl bg-card">
              <CardHeader className="py-4 md:py-6 relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-1 top-4 md:left-2 rounded-full h-8 w-8"
                  onClick={() => setShowExploreMoreUI(false)}
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <div className="pl-8 text-center md:text-left">
                  <CardTitle className="text-lg md:text-xl font-serif">在当前项目中继续挖掘</CardTitle>
                  <CardDescription className="text-xs md:text-sm">你可以补充更多当下的感受、拉扯或念头。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-3 md:px-6 pb-6">
                <Textarea
                  placeholder="补充更多..."
                  className="min-h-[220px] md:min-h-[250px] text-base md:text-lg leading-relaxed resize-none bg-background border-border"
                  value={exploreMoreText}
                  onChange={(e) => setExploreMoreText(e.target.value)}
                />
                <Button 
                  className="w-full h-12 md:h-14 bg-primary hover:bg-accent text-primary-foreground"
                  onClick={handleExploreMore}
                  disabled={isExploringMore || !exploreMoreText.trim()}
                >
                  {isExploringMore ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 分析中...</>
                  ) : (
                    '分析并合并'
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'analysis' && analysis && !showExploreMoreUI && (
          <motion.div key="analysis" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4 md:space-y-6 px-1">
            <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
              <CardHeader className="pt-4 pb-1 md:pt-6 md:pb-2 relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-1 top-4 md:left-2 rounded-full h-8 w-8"
                  onClick={() => setStep('input')}
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
                <div className="pl-8">
                  <CardTitle className="text-lg md:text-xl font-serif">分析结果与调整</CardTitle>
                  <CardDescription className="text-xs md:text-sm">AI 深度提示潜意识想要。你也可以手动调整。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4 px-3 md:px-6 pb-6 pt-0">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-1 p-1 bg-muted/20 rounded-lg">
                    <Button 
                      className={`flex-1 h-7 text-[14px] rounded-md transition-all ${filterMode === 'all' ? 'bg-background shadow-sm text-accent font-bold' : 'text-muted-foreground hover:bg-background/40'}`}
                      variant="ghost"
                      onClick={() => setFilterMode('all')}
                    >
                      全部 ({analysis.list.length})
                    </Button>
                    <Button 
                      className={`flex-1 h-7 text-[14px] rounded-md transition-all ${filterMode === 'unreleased' ? 'bg-background shadow-sm text-accent font-bold' : 'text-muted-foreground hover:bg-background/40'}`}
                      variant="ghost" 
                      onClick={() => setFilterMode('unreleased')}
                    >
                      未释放 ({analysis.list.filter((s: any, i: any) => !s.released && !releasedIndices.includes(i)).length})
                    </Button>
                    <Button 
                      className={`flex-1 h-7 text-[14px] rounded-md transition-all ${filterMode === 'released' ? 'bg-background shadow-sm text-accent font-bold' : 'text-muted-foreground hover:bg-background/40'}`}
                      variant="ghost" 
                      onClick={() => setFilterMode('released')}
                    >
                      已释放 ({analysis.list.filter((s: any, i: any) => s.released || releasedIndices.includes(i)).length})
                    </Button>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      className="flex-[2] h-10 bg-primary hover:bg-accent text-primary-foreground shadow-lg gap-1.5 text-xs" 
                      onClick={() => {
                        const firstUnreleased = analysis.list.findIndex((s: any, i: number) => !s.released && !releasedIndices.includes(i));
                        startRelease(firstUnreleased === -1 ? 0 : firstUnreleased, 'sequential');
                      }}
                      disabled={!analysis.list || analysis.list.length === 0}
                    >
                      <RefreshCcw className="w-3.5 h-3.5" /> {isAnalyzing ? '分析中...' : '开始释放'}
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-[3] h-10 border-primary/30 hover:bg-primary/5 text-primary gap-1.5 text-xs"
                      onClick={() => setShowExploreMoreUI(true)}
                    >
                      <Plus className="w-3.5 h-3.5" /> +探索更多想要
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[350px] md:h-[400px] pr-2 md:pr-4">
                  <div className="space-y-4">
                    {analysis.list && analysis.list
                      .map((s: any, i: number) => ({ ...s, originalIdx: i }))
                      .filter((s: any) => {
                        if (filterMode === 'all') return true;
                        const isReleased = s.released || releasedIndices.includes(s.originalIdx);
                        if (filterMode === 'unreleased') return !isReleased;
                        if (filterMode === 'released') return isReleased;
                        return true;
                      })
                      .map((s: any) => {
                        const i = s.originalIdx;
                        return (
                          <div key={i} className={`p-3 md:p-4 rounded-xl border border-border/30 group space-y-2 relative ${(s.released || releasedIndices.includes(i)) ? 'opacity-50 bg-muted/20 grayscale-[0.5]' : 'bg-background/40 hover:border-accent/30 shadow-sm transition-all'}`}>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest px-1"># {i + 1}</span>
                                {(s.released || releasedIndices.includes(i)) && <Badge variant="outline" className="text-[7px] md:text-[8px] h-3.5 px-1 border-success text-success bg-success/10">已释放</Badge>}
                              </div>
                              <button 
                                onClick={() => toggleManualRelease(i)}
                                className={`h-4 w-4 shrink-0 rounded-full flex items-center justify-center transition-all ${(s.released || releasedIndices.includes(i)) ? 'bg-success text-white shadow-sm' : 'bg-muted/30 text-muted-foreground hover:bg-success/10 hover:text-success'}`}
                                title={s.released ? "取消标注已释放" : "手动标注已释放"}
                              >
                                <CheckCircle2 className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1 items-center py-0.5 justify-end">
                              {s.w && s.w.map((w: WantType) => (
                                <Badge key={w} variant="secondary" className="bg-secondary/10 text-muted-foreground border-none px-1 py-0 text-[8px] flex items-center gap-1 shrink-0">
                                  {WANT_LABELS[w]}
                                  <X className="w-2 h-2 cursor-pointer hover:text-destructive" onClick={() => toggleWant(i, w)} />
                                </Badge>
                              ))}
                              <Popover>
                                <PopoverTrigger render={
                                  <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full bg-primary/10 hover:bg-primary/20 shrink-0">
                                    <Plus className="w-2.5 h-2.5" />
                                  </Button>
                                } />
                                <PopoverContent className="w-40 p-1.5 bg-popover/95 backdrop-blur-sm border-border/50">
                                  <div className="flex flex-col gap-0.5">
                                    {(Object.keys(WANT_LABELS) as WantType[]).map((w) => (
                                      <Button 
                                        key={w} 
                                        variant="ghost" 
                                        size="sm" 
                                        className={`justify-start font-normal text-[10px] h-7 ${s.w && s.w.includes(w) ? 'bg-accent/20 text-accent' : ''}`}
                                        onClick={() => toggleWant(i, w)}
                                      >
                                        {WANT_LABELS[w]}
                                      </Button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                            
                            <p className="text-[13px] md:text-sm text-foreground/90 leading-snug font-serif italic">"{s.s}"</p>
                            
                            {s.note && (
                              <div className="p-2 rounded-lg bg-secondary/5 border border-secondary/10 flex gap-2 items-start">
                                <StickyNote className="w-3 h-3 text-secondary mt-0.5 shrink-0" />
                                <p className="text-[10px] text-muted-foreground whitespace-pre-wrap">{s.note}</p>
                              </div>
                            )}

                            {s.a && (
                              <div className="p-3 rounded-xl bg-accent/5 border border-accent/10">
                                <p className="text-[11px] md:text-[12px] text-muted-foreground leading-relaxed">
                                  <span className="font-bold text-accent mr-1 uppercase text-[9px] tracking-tight">分析:</span> {s.a}
                                </p>
                              </div>
                            )}
                            
                            <div className="pt-1 flex gap-2">
                              <Button 
                                variant="outline"
                                className="flex-[2] border-accent/30 hover:bg-accent/10 text-accent rounded-xl h-9 gap-2 text-xs"
                                onClick={() => startRelease(i, 'single')}
                              >
                                <Zap className="w-3.5 h-3.5" /> 快速释放                              </Button>
                              <Button 
                                variant="outline"
                                className="flex-1 border-border/30 hover:bg-muted text-muted-foreground rounded-xl h-9 text-xs"
                                onClick={() => removeSentence(i)}
                              >
                                取消
                              </Button>
                            </div>
                          </div>
                      );
                    })}
                    {isAnalyzing && (
                      <div className="p-5 rounded-2xl bg-accent/5 border border-dashed border-accent/20 animate-pulse flex items-center justify-center h-24">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-accent" />
                          <p className="text-[10px] text-accent font-medium">AI 正在深度分析中...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                <div className="p-4 md:p-5 rounded-xl bg-secondary/10 border border-secondary/20 min-h-[80px]">
                  <h4 className="font-bold text-[11px] md:text-sm mb-2 text-secondary-foreground flex items-center gap-2 uppercase tracking-wide">
                    <RefreshCcw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isAnalyzing ? 'animate-spin' : ''}`} /> 分析总结
                  </h4>
                  {isAnalyzing && (!getAnalysisSummary(analysis) || getAnalysisSummary(analysis).length < 5) ? (
                    <div className="flex items-center gap-2 text-muted-foreground animate-pulse mt-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-[11px]">正在深度分析整体执念...</span>
                    </div>
                  ) : (
                    <p className="text-xs md:text-sm leading-relaxed opacity-90 text-foreground/80 italic whitespace-pre-wrap">{getAnalysisSummary(analysis)}</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button variant="outline" className="flex-1 h-11 md:h-12 border-primary/30 hover:bg-primary/10 text-xs md:text-sm" onClick={() => { reset(); setStep('input'); }}>
                    清空并退出                  </Button>
                  <Button variant="secondary" className="flex-1 h-11 md:h-12 border-accent/30 hover:bg-accent/10 text-xs md:text-sm" onClick={handleManualSave}>
                    <Save className="w-4 h-4 mr-2" /> 手动保存
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'release' && analysis && (
          <motion.div key="release" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="flex flex-col items-center justify-center min-h-[85vh] md:min-h-[70vh] text-center space-y-4 md:space-y-6 relative px-4 text-center">
            
            <div className="space-y-3 md:space-y-4 max-w-xl w-full flex flex-col items-center">
              {/* Row 1: Progress (Center) & X (Right) */}
              <div className="w-full relative flex items-center justify-center">
                <Badge variant="outline" className="px-3 md:px-4 py-1 border-accent/50 text-accent text-[10px] md:text-xs">
                  閲婃斁杩涚▼ {currentSentenceIndex + 1} / {analysis.list.length}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setShowQuitDialog(true)}
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </Button>
              </div>

              {/* Row 2: Original Sentence */}
              <h2 className="text-[19px] md:text-[22px] font-serif font-bold leading-relaxed text-foreground px-2">
                "{analysis.list[currentSentenceIndex].s}"
              </h2>

              {/* Row 3: Explanation */}
              {analysis.list[currentSentenceIndex].a && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="text-[11px] md:text-sm text-muted-foreground italic max-w-sm mx-auto bg-background/50 p-3 rounded-xl border border-border/20 shadow-sm"
                >
                  <span className="font-bold text-accent mr-1 uppercase text-[9px] block mb-1">分析说明</span>
                  {analysis.list[currentSentenceIndex].a}
                </motion.div>
              )}

              {/* Row 4: Three Wants */}
              <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
                {analysis.list[currentSentenceIndex].w.map((w: WantType) => (
                  <Badge key={w} variant="secondary" className="bg-accent/10 text-accent border border-accent/20 px-3 py-1 text-[9px] md:text-[10px] font-bold">
                    {WANT_LABELS[w]}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-8 md:space-y-10 w-full max-w-sm md:max-w-md bg-card/40 p-6 md:p-8 rounded-3xl backdrop-blur-sm border border-border/20 shadow-2xl">
              <AnimatePresence mode="wait">
                {!isSentenceFinished ? (
                  <motion.div key="steps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8 md:space-y-10">
                    <div className="space-y-1 md:space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        {/* Row 5: Step count renamed */}
                        <p className="text-[9px] md:text-xs text-muted-foreground uppercase tracking-widest pl-6">
                          step{sixStepIndex + 1}/{activeSteps.length}
                        </p>
                        <Popover>
                          <PopoverTrigger render={
                            <Button variant="ghost" size="icon" className={`h-6 w-6 rounded-full transition-colors ${analysis.list[currentSentenceIndex].note ? 'text-accent bg-accent/10' : 'text-muted-foreground hover:text-accent'}`}>
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
                                  <VoiceInput size="sm" onResult={(voiceText) => updateSentenceNote(currentSentenceIndex, (analysis.list[currentSentenceIndex].note || '') + voiceText)} />
                                )}
                              </h4>
                              <Textarea 
                                placeholder="在这里添加感悟或记录..." 
                                value={analysis.list[currentSentenceIndex].note || ''}
                                onChange={(e) => updateSentenceNote(currentSentenceIndex, e.target.value)}
                                className="min-h-[100px] text-xs resize-none bg-background/50 border-border/30 focus:border-accent/40"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.div key={sixStepIndex + (isSubQuestion ? '-sub' : '')} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-lg md:text-xl font-medium text-foreground leading-snug min-h-[70px] flex items-center justify-center px-4">
                          {getStepContent()}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <div className="flex flex-col gap-3 md:gap-4">
                      <Button size="lg" className="h-12 md:h-14 text-base md:text-lg rounded-2xl bg-primary hover:bg-accent text-primary-foreground shadow-lg transition-all" onClick={() => nextStep(true)}>
                        {getButtonLabels().primary}
                      </Button>
                      <Button variant="outline" className="h-12 md:h-14 text-base md:text-lg rounded-2xl border-border hover:bg-muted text-muted-foreground transition-all" onClick={() => nextStep(false)}>
                        {getButtonLabels().secondary}
                      </Button>
                      <button 
                        className="text-[10px] text-muted-foreground hover:text-accent transition-colors underline underline-offset-4"
                        onClick={skipSentence}
                      >
                        先不释放，跳到下一个                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="choice" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 md:space-y-8">
                    <div className="space-y-1">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                        <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                      </div>
                      <h3 className="text-lg md:text-xl font-medium">感觉好些了吗？</h3>
                    </div>
                    <div className="flex flex-col gap-2 md:gap-3">
                      {currentSentenceIndex < analysis.list.length - 1 ? (
                        <Button size="lg" className="h-12 md:h-14 rounded-2xl bg-primary hover:bg-accent text-primary-foreground text-sm md:text-base font-bold shadow-lg" onClick={continueRelease}>
                          继续下一句                        </Button>
                      ) : (
                        <>
                          <Button size="lg" className="h-12 md:h-14 rounded-2xl bg-primary hover:bg-accent text-primary-foreground text-sm md:text-base font-bold shadow-lg" onClick={continueRelease}>
                            完成并退出                          </Button>
                          <Button size="lg" variant="outline" className="h-12 md:h-14 rounded-2xl border-primary text-primary hover:bg-primary/5 text-sm md:text-base font-bold shadow-sm" onClick={restartRelease}>
                            从头开始释放                          </Button>
                        </>
                      )}
                      
                      <Button variant="outline" size="lg" className="h-12 md:h-14 rounded-2xl border-accent/30 text-accent hover:bg-accent/10 text-sm md:text-base font-medium" onClick={reRelease}>
                        重新释放这一句                      </Button>


                      
                      <Button 
                        variant="ghost" 
                        className="text-accent hover:text-accent/80 flex items-center gap-2 text-[11px] md:text-sm h-8 md:h-10 mt-2"
                        onClick={() => setIsMoreReleaseOpen(true)}
                      >
                        <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" /> 释放更多 (探索底层想要)
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex gap-3">
              {activeSteps.map((_, i) => (
                <div 
                  key={i} 
                  className={`w-3 h-3 rounded-full transition-all duration-500 ${i === sixStepIndex ? 'bg-accent w-8' : 'bg-muted'}`} 
                />
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
              你还有未完成释放的句子。是否需要将这些句子移动到“化解卡住”板块，以便日后处理？            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleQuit(false)}>
              直接退出            </Button>
            <Button className="flex-1 bg-accent hover:bg-accent/80" onClick={() => handleQuit(true)}>
              移动到“化解卡住”并退出            </Button>
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
              深入挖掘当前感受背后的底层想要。            </DialogDescription>
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
                placeholder="例如：隐约的焦虑、不知所措..."
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
              开始深入分析释放            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

