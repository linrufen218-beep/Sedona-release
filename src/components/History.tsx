import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getHistory, getHarvests, saveHarvest, ReleaseRecord, HarvestRecord, getFocusedProjects, FocusedProject, WantType, updateRecord, STORAGE_KEYS } from '@/lib/store';
import { Calendar as CalendarIcon, BookOpen, Trash2, ChevronRight, Plus, Sparkles, Target, Trophy, StickyNote, Zap, CheckCircle2, RefreshCcw, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { ChevronDown, ChevronUp } from 'lucide-react';

const AREAS = [
  { id: 'wealth', title: '财富' },
  { id: 'relationship', title: '人际关系' },
  { id: 'appearance', title: '外貌' },
  { id: 'sex', title: '性' }
];

const WANT_LABELS: Record<string, string> = {
  approval: '想要被认可',
  control: '想要控制',
  security: '想要安全',
};

const RE_RELEASE_STEPS = [
  "你允许这种感觉存在吗？",
  "你能识别是哪种想要吗？",
  "?", // Placeholder for step 3, logic in handleNextStep decides text
  "你允许这种想要离开吗？" // Optional step 4
];

export default function History() {
  const [history, setHistory] = useState<ReleaseRecord[]>([]);
  const [harvests, setHarvests] = useState<HarvestRecord[]>([]);
  const [completedProjects, setCompletedProjects] = useState<FocusedProject[]>([]);
  const [releasedAreas, setReleasedAreas] = useState<{id: string, timestamp: number}[]>([]);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [newHarvest, setNewHarvest] = useState('');
  const [isAddingHarvest, setIsAddingHarvest] = useState(false);

  // Re-release states
  const [activeReRelease, setActiveReRelease] = useState<{ 
    recordId: string; 
    sentenceIndex: number; 
    deepIndex?: number;
    text: string;
    identifiedWant?: string;
  } | null>(null);
  const [reReleasePhase, setReReleasePhase] = useState<'steps' | 'feeling' | 'deep_input'>('steps');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [deepWantInput, setDeepWantInput] = useState('');

  const getRecordSentenceWants = (recordId: string, sentenceIndex: number) => {
    const record = history.find(r => r.id === recordId);
    if (!record || !record.analysis || !record.analysis.list) return [];
    return record.analysis.list[sentenceIndex]?.w || [];
  };

  const getReReleaseSteps = () => {
    // 1、你允许这种感觉存在吗？允许/不允许
    // 2、你能识别是哪种想要吗？能/不能
    // 若选择能，3、你允许这种想要离开吗？允许/不允许
    // 若选择不能，3、你能识别这是来自（具体句子分析出来的想要）吗？4、你允许这种想要离开吗？允许/不允许
    
    // This logic needs to be dynamic in handleNextStep to support the branching.
    return ["你允许这种感觉存在吗？", "你能识别是哪种想要吗？"];
  };

  useEffect(() => {
    setHistory(getHistory());
    setHarvests(getHarvests());
    setCompletedProjects(getFocusedProjects().filter(p => p.completed));
    const areaData = localStorage.getItem(STORAGE_KEYS.RELEASED_AREAS);
    if (areaData) setReleasedAreas(JSON.parse(areaData));
  }, []);

  const handleRecordUpdate = (updatedRecord: ReleaseRecord) => {
    if (updateRecord(updatedRecord)) {
      setHistory(getHistory());
    }
  };

  const startReRelease = (record: ReleaseRecord, sentenceIndex: number, deepIndex?: number) => {
    let text = '';
    if (deepIndex !== undefined) {
      text = (record.analysis?.list?.[sentenceIndex] as any)?.deepWants?.[deepIndex]?.s || '';
    } else {
      text = (record.analysis?.list || (record.analysis as any)?.sentences)?.[sentenceIndex]?.s || (record.analysis as any)?.sentences?.[sentenceIndex]?.text || '';
    }
    
    setActiveReRelease({ recordId: record.id, sentenceIndex, deepIndex, text });
    setReReleasePhase('steps');
    setCurrentStepIndex(0);
  };

  const [stepBranch, setStepBranch] = useState<'can' | 'cant' | null>(null);

  const handleNextStep = (isPrimary: boolean) => {
    if (activeReRelease && currentStepIndex === 1) { // Question 2: 能识别吗？
      if (isPrimary) { // “能”
        setStepBranch('can');
        setCurrentStepIndex(2); // "你允许这种想要离开吗？"
      } else { // “不能”
        setStepBranch('cant');
        setCurrentStepIndex(2); // "你能识别这是来自（...）吗？"
      }
      return;
    }

    if (activeReRelease && currentStepIndex === 2) {
      if (stepBranch === 'can') {
         setReReleasePhase('feeling');
         return;
      } else if (stepBranch === 'cant') {
         if (isPrimary) { // "是"
           setCurrentStepIndex(3);
         } else { // "否"
           setReReleasePhase('feeling');
         }
         return;
      }
    }
    
    if (activeReRelease && currentStepIndex === 3) {
      setReReleasePhase('feeling');
      return;
    }
    
    // Fallback/standard
    if (currentStepIndex < RE_RELEASE_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setReReleasePhase('feeling');
    }
  };

  const handleStartDeepWant = () => {
    if (!deepWantInput.trim() || !activeReRelease) return;
    
    const record = history.find(r => r.id === activeReRelease.recordId);
    if (!record || !record.analysis || !record.analysis.list) return;

    const newList = [...record.analysis.list];
    const sentence = newList[activeReRelease.sentenceIndex];
    if (!sentence.deepWants) sentence.deepWants = [];
    
    const newDeepWant = {
      s: deepWantInput,
      timestamp: Date.now()
    };
    
    sentence.deepWants.push(newDeepWant);
    const updatedRecord = { ...record, analysis: { ...record.analysis, list: newList } };
    handleRecordUpdate(updatedRecord);

    // Start releasing the new deep want
    setActiveReRelease({ 
      recordId: record.id, 
      sentenceIndex: activeReRelease.sentenceIndex, 
      deepIndex: sentence.deepWants.length - 1,
      text: deepWantInput
    });
    setReReleasePhase('steps');
    setCurrentStepIndex(0);
    setDeepWantInput('');
  };

  const dateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const dayRecords = history.filter(r => r.date === dateStr);
  const dayHarvests = harvests.filter(h => h.date === dateStr);
  const dayCompletedProjects = completedProjects.filter(p => format(p.timestamp, 'yyyy-MM-dd') === dateStr);
  const dayReleasedAreas = Array.isArray(releasedAreas) ? releasedAreas.filter(a => format(a.timestamp, 'yyyy-MM-dd') === dateStr) : [];

  const handleAddHarvest = () => {
    if (!newHarvest.trim() || !selectedDate) return;
    const harvest: HarvestRecord = {
      id: crypto.randomUUID(),
      date: dateStr,
      content: newHarvest,
      timestamp: Date.now()
    };
    saveHarvest(harvest);
    setHarvests([harvest, ...harvests]);
    setNewHarvest('');
    setIsAddingHarvest(false);
  };

  const clearHistory = () => {
    if (confirm('确定要清空所有历史记录和收获本吗？')) {
      localStorage.removeItem('sedona_history');
      localStorage.removeItem('sedona_harvests');
      setHistory([]);
      setHarvests([]);
    }
  };

  const finishReleaseAndMarkReleased = () => {
    if (!activeReRelease) return;
    const record = history.find(r => r.id === activeReRelease.recordId);
    if (record && record.analysis && record.analysis.list) {
      const newList = [...record.analysis.list];
      const sentence = newList[activeReRelease.sentenceIndex];
      sentence.released = true;

      const updatedRecord = { ...record, analysis: { ...record.analysis, list: newList } };
      handleRecordUpdate(updatedRecord);
    }
    setActiveReRelease(null);
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left: Calendar */}
      <div className="lg:col-span-5 space-y-6">
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={zhCN}
            className="rounded-xl"
            classNames={{
              day_selected: "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
              day_today: "bg-primary/20 text-primary font-bold",
            }}
            components={{
              DayButton: (props) => {
                const { day } = props;
                const d = format(day.date, 'yyyy-MM-dd');
                const hasRelease = history.some(r => r.date === d);
                const hasHarvest = harvests.some(h => h.date === d);
                
                return (
                  <CalendarDayButton {...props}>
                    <div className="flex flex-col items-center justify-center w-full h-full relative pt-1 pb-1.5">
                      <span className="relative z-10">{day.date.getDate()}</span>
                      <div className="flex gap-0.5 absolute bottom-1 left-1/2 -translate-x-1/2 z-20">
                        {hasRelease && <div className="w-1 h-1 rounded-full bg-primary" />}
                        {hasHarvest && <div className="w-1 h-1 rounded-full bg-amber-400" />}
                      </div>
                    </div>
                  </CalendarDayButton>
                );
              }
            }}
          />
        </Card>

        <Card className="border-none shadow-xl bg-secondary/10 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-secondary-foreground" />
              今日收获本
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence>
              {dayHarvests.map((h) => (
                <motion.div 
                  key={h.id} 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  className="p-3 rounded-lg bg-background/40 border border-border/20 text-sm leading-relaxed"
                >
                  <Sparkles className="w-3 h-3 text-accent inline mr-2" />
                  {h.content}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isAddingHarvest ? (
              <div className="space-y-3 pt-2">
                <Textarea 
                  value={newHarvest} 
                  onChange={(e) => setNewHarvest(e.target.value)}
                  placeholder="记录今天的感悟、进步或美好的瞬间..."
                  className="text-sm bg-background/50"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-accent" onClick={handleAddHarvest}>保存</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsAddingHarvest(false)}>取消</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full border-dashed border-primary/40 text-primary hover:bg-primary/10" onClick={() => setIsAddingHarvest(true)}>
                <Plus className="w-4 h-4 mr-2" /> 记录新收获
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-primary/5 backdrop-blur-md overflow-hidden">
          <CardHeader 
            className="pb-3 border-b border-primary/10 cursor-pointer hover:bg-primary/5 transition-colors select-none"
            onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
          >
            <div className="flex items-center justify-between w-full">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-accent animate-pulse" />
                今日已完成项目
                <Badge variant="secondary" className="ml-2 bg-accent/20 text-accent border-none text-[10px]">
                  {dayCompletedProjects.length + dayReleasedAreas.length}
                </Badge>
              </CardTitle>
              {isProjectsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
          <AnimatePresence>
            {isProjectsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="p-0">
                  <ScrollArea className={`${(dayCompletedProjects.length + dayReleasedAreas.length) > 3 ? 'h-[250px]' : 'h-auto'}`}>
                    <div className="divide-y divide-primary/10">
                      {dayCompletedProjects.length === 0 && dayReleasedAreas.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground opacity-60 italic">
                          这一天没有已完成的项目，继续加油！
                        </div>
                      ) : (
                        <>
                          {dayCompletedProjects.map((project) => (
                            <div key={project.id} className="p-4 flex items-center gap-3 hover:bg-primary/5 transition-colors group">
                              <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                                <Target className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-grow">
                                <h4 className="text-sm font-serif font-bold truncate">{project.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground">{format(project.timestamp, 'HH:mm')}</span>
                                  <Badge variant="outline" className="text-[8px] h-3.5 py-0 border-success/30 text-success bg-success/5">已圆满</Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                          {dayReleasedAreas.map((ra) => {
                            const area = AREAS.find(a => a.id === ra.id);
                            return (
                              <div key={ra.id} className="p-4 flex items-center gap-3 hover:bg-primary/5 transition-colors group">
                                <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                                  <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-grow">
                                  <h4 className="text-sm font-serif font-bold truncate">{area?.title || ra.id} 领域</h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-muted-foreground">{format(ra.timestamp, 'HH:mm')}</span>
                                    <Badge variant="outline" className="text-[8px] h-3.5 py-0 border-success/30 text-success bg-success/5">已解脱</Badge>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10" onClick={clearHistory}>
          <Trash2 className="w-4 h-4 mr-2" /> 清空所有记录
        </Button>
      </div>

      {/* Right: Records */}
      <div className="lg:col-span-7 space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-[16px] font-serif flex items-center gap-3">
            <CalendarIcon className="w-6 h-6 text-primary" />
            {dateStr} 的释放记录
          </h2>
          <Badge variant="secondary" className="bg-primary/20 text-primary border-none">
            {dayRecords.length} 条记录
          </Badge>
        </div>

        <ScrollArea className="h-[700px] pr-4">
          <div className="space-y-6">
            {dayRecords.length === 0 ? (
              <div className="text-center py-20 opacity-40">
                <CalendarIcon className="w-16 h-16 mx-auto mb-4" />
                <p>这一天没有释放记录</p>
              </div>
            ) : (
              dayRecords.map((record) => (
                <Dialog key={record.id} onOpenChange={(open) => {
                  if (!open) setActiveReRelease(null);
                }}>
                  <DialogTrigger nativeButton={false} render={
                    <Card className="border-none shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden group cursor-pointer hover:shadow-xl transition-all" onClick={() => setActiveReRelease(null)}>
                      <div className="h-1 bg-primary/30 group-hover:bg-accent transition-colors" />
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <Badge className="bg-secondary/20 text-secondary-foreground border-none">
                            {record.type === 'daily' ? '日常释放' : record.type === 'area' ? '领域释放' : record.type === 'focused' ? '集中释放' : '自定义'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{format(record.timestamp, 'HH:mm')}</span>
                        </div>
                        <CardTitle className="text-[16px] font-serif mt-2 line-clamp-2">
                          {record.content}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {record.analysis && (
                          <div className="space-y-3">
                            <div className="p-4 rounded-xl bg-background/40 border border-border/20 text-sm leading-relaxed italic opacity-80">
                              {record.analysis.ana || record.analysis.sum || record.analysis.deepAnalysis}
                            </div>
                            {record.analysis.supplement && (
                              <div className="text-xs text-muted-foreground border-l-2 border-accent pl-3 py-1">
                                补充: {record.analysis.supplement}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex justify-end pt-2">
                           <div className="flex items-center gap-1 text-muted-foreground group-hover:text-accent transition-colors">
                             <span className="text-xs">详情</span>
                             <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                           </div>
                        </div>
                      </CardContent>
                    </Card>
                  } />
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-xl border-border/50 p-0 overflow-hidden flex flex-col">
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                          {activeReRelease ? (
                            <div className="space-y-12 py-10 flex flex-col items-center">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="absolute left-4 top-4 text-muted-foreground hover:text-foreground"
                                onClick={() => setActiveReRelease(null)}
                              >
                                <ArrowLeft className="w-4 h-4 mr-2" /> 返回记录
                              </Button>

                              <div className="text-center space-y-4 max-w-md px-6">
                                <Badge variant="outline" className="border-accent/40 text-accent uppercase tracking-widest text-[10px]">
                                  {activeReRelease.deepIndex !== undefined ? '深层想要释放' : '重新释放句子'}
                                </Badge>
                                <h3 className="text-xl md:text-2xl font-serif font-bold italic text-foreground leading-relaxed">
                                  "{activeReRelease.text}"
                                </h3>

                                {activeReRelease.deepIndex === undefined && (getRecordSentenceWants(activeReRelease.recordId, activeReRelease.sentenceIndex).length > 0) && (
                                  <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                                    {getRecordSentenceWants(activeReRelease.recordId, activeReRelease.sentenceIndex).map((w: any) => (
                                      <Badge key={w} variant="secondary" className="text-[10px] bg-accent/10 text-accent border-none">
                                        {WANT_LABELS[w] || w}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="w-full max-w-sm">
                                <AnimatePresence mode="wait">
                                  {reReleasePhase === 'steps' && (
                                    <motion.div 
                                      key="steps"
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -10 }}
                                      className="space-y-10"
                                    >
                                      <div className="text-center space-y-2">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Step {currentStepIndex + 1}</p>
                                        <p className="text-lg font-medium text-foreground min-h-[60px] flex items-center justify-center">
                                          {currentStepIndex === 2 && activeReRelease
                                             ? stepBranch === 'can' 
                                               ? "你允许这种想要离开吗？"
                                               : `你能识别这是来自（${getRecordSentenceWants(activeReRelease.recordId, activeReRelease.sentenceIndex).length > 0 ? (WANT_LABELS[getRecordSentenceWants(activeReRelease.recordId, activeReRelease.sentenceIndex)[0]] || getRecordSentenceWants(activeReRelease.recordId, activeReRelease.sentenceIndex)[0]) : '某种想要'}）吗？`
                                             : RE_RELEASE_STEPS[currentStepIndex]
                                          }
                                        </p>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <Button size="lg" className="h-12 rounded-xl bg-primary hover:bg-accent text-white font-bold" onClick={() => handleNextStep(true)}>
                                          {currentStepIndex === 3 ? '现在' : '能 / 是'}
                                        </Button>
                                        <Button variant="outline" size="lg" className="h-12 rounded-xl border-border hover:bg-muted text-muted-foreground" onClick={() => handleNextStep(false)}>
                                          {currentStepIndex === 3 ? '以后' : '不能 / 不'}
                                        </Button>
                                      </div>
                                    </motion.div>
                                  )}

                                  {reReleasePhase === 'feeling' && (
                                    <motion.div 
                                      key="feeling"
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      className="space-y-8 bg-accent/5 p-8 rounded-3xl border border-accent/10"
                                    >
                                      <div className="text-center space-y-2">
                                        <CheckCircle2 className="w-12 h-12 text-accent mx-auto" />
                                        <h3 className="text-xl font-bold">这一句释放完成了</h3>
                                        <p className="text-sm text-muted-foreground">你现在感觉好吗？</p>
                                      </div>
                                      <div className="flex flex-col gap-3">
                                        <Button className="w-full h-11 bg-accent text-white font-bold rounded-xl shadow-lg" onClick={finishReleaseAndMarkReleased}>
                                          结束释放
                                        </Button>
                                        <Button variant="outline" className="w-full h-11 border-accent/30 text-accent hover:bg-accent/5 rounded-xl" onClick={() => {
                                          setCurrentStepIndex(0);
                                          setReReleasePhase('steps');
                                        }}>
                                          <RefreshCcw className="w-4 h-4 mr-2" /> 重新释放
                                        </Button>
                                        <Button variant="secondary" className="w-full h-11 rounded-xl" onClick={() => setReReleasePhase('deep_input')}>
                                          <Plus className="w-4 h-4 mr-2" /> 释放深层想要
                                        </Button>
                                      </div>
                                    </motion.div>
                                  )}

                                  {reReleasePhase === 'deep_input' && (
                                    <motion.div 
                                      key="deep_input"
                                      initial={{ opacity: 0, x: 20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      className="space-y-6"
                                    >
                                      <div className="space-y-2">
                                        <h3 className="text-lg font-bold text-center">挖掘更深的想要</h3>
                                        <p className="text-xs text-muted-foreground text-center">在刚才的释放中，你察觉到更隐秘的渴求了吗？</p>
                                      </div>
                                      <Textarea 
                                        placeholder="例如：我想要被那个人特别关注..."
                                        value={deepWantInput}
                                        onChange={(e) => setDeepWantInput(e.target.value)}
                                        className="min-h-[120px] rounded-xl bg-background/50 text-sm p-4 border-accent/20 focus:border-accent"
                                        autoFocus
                                      />
                                      <div className="flex gap-3">
                                        <Button className="flex-1 h-11 bg-accent" disabled={!deepWantInput.trim()} onClick={handleStartDeepWant}>
                                          开始释放深层
                                        </Button>
                                        <Button variant="ghost" className="h-11" onClick={() => setReReleasePhase('feeling')}>
                                          取消
                                        </Button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          ) : (
                            <>
                              <DialogHeader>
                                <DialogTitle className="font-serif text-[16px]">{record.content}</DialogTitle>
                                <DialogDescription>{format(record.timestamp, 'yyyy年MM月dd日 HH:mm')}</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-10 py-6">
                                {(record.analysis?.list || record.analysis?.sentences) && (
                                  <div className="space-y-6">
                                    <h4 className="font-bold text-sm flex items-center gap-2 text-primary">
                                      <Sparkles className="w-4 h-4 text-accent" /> 释放句分析
                                    </h4>
                                    <div className="space-y-6">
                                      {(record.analysis.list || record.analysis.sentences).map((s: any, i: number) => (
                                        <div key={i} className="group/item">
                                          <div className="p-5 rounded-2xl bg-background/40 border border-border/20 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col gap-4">
                                            <div className="absolute top-0 right-0 p-1">
                                               <Badge variant="outline" className={`text-[8px] h-3 px-1 border-none ${s.released ? 'text-success bg-success/10' : 'text-muted-foreground bg-muted/10'}`}>
                                                 {s.released ? '已释放' : '待释放'}
                                               </Badge>
                                            </div>

                                            <div className="space-y-1.5">
                                              <p className="text-[16px] font-serif font-bold italic leading-relaxed text-foreground/90">
                                                "{s.s || s.text || '解析内容中...'}"
                                              </p>
                                              {s.a && (
                                                <p className="text-[11px] text-muted-foreground/80 leading-relaxed bg-accent/5 p-2 rounded-lg border border-accent/10 italic">
                                                  {s.a}
                                                </p>
                                              )}
                                            </div>

                                            <div className="flex items-center justify-between mt-auto pt-1">
                                              <div className="flex flex-wrap gap-1.5">
                                                {(s.w || s.wants || []).map((w: any) => (
                                                  <Badge key={w} variant="outline" className="text-[9px] h-5 px-2 border-accent/20 text-accent bg-accent/5 font-medium">
                                                    {WANT_LABELS[w] || w}
                                                  </Badge>
                                                ))}
                                              </div>
                                              <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 rounded-full text-primary hover:text-accent hover:bg-accent/10 shrink-0" 
                                                onClick={() => startReRelease(record, i)}
                                              >
                                                <Zap className="w-4 h-4" />
                                              </Button>
                                            </div>

                                            {/* Deep Wants List */}
                                            {s.deepWants && s.deepWants.length > 0 && (
                                              <div className="mt-2 space-y-3 pt-3 border-t border-border/10">
                                                {s.deepWants.map((dw: any, di: number) => (
                                                  <div key={di} className="ml-4 p-3 rounded-xl bg-accent/[0.03] border border-accent/10 flex flex-col gap-2 relative">
                                                    <div className="absolute -left-4 top-5 w-4 h-px bg-accent/20" />
                                                    <div className="flex justify-between items-start">
                                                      <p className="text-[11px] font-serif italic text-accent/80 font-bold leading-relaxed">
                                                        "更深：{dw.s}"
                                                      </p>
                                                      <span className="text-[8px] text-muted-foreground shrink-0 ml-2">{format(dw.timestamp, 'HH:mm')}</span>
                                                    </div>
                                                    <div className="flex justify-end">
                                                      <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-6 w-6 rounded-full text-muted-foreground hover:text-accent"
                                                        onClick={() => startReRelease(record, i, di)}
                                                      >
                                                        <Zap className="w-3 h-3" />
                                                      </Button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {/* Note position: bottom of the whole sentence content, but inside the container */}
                                            {s.note && (
                                              <div className="mt-2 p-3 rounded-xl bg-secondary/5 border border-secondary/10 flex gap-3 items-start animate-in slide-in-from-top-1 duration-300">
                                                <StickyNote className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                                                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed italic">{s.note}</p>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div className="space-y-4 pt-6 border-t border-border/20">
                                  <h4 className="font-bold text-sm flex items-center gap-2 text-primary">
                                    <BookOpen className="w-4 h-4 text-accent" /> 全局总结与深层洞察
                                  </h4>
                                  <p className="text-sm leading-relaxed text-foreground/80 bg-secondary/5 p-6 rounded-3xl border border-secondary/10 italic shadow-inner">
                                    {record.analysis?.ana || record.analysis?.sum || record.analysis?.deepAnalysis}
                                  </p>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      );
    }
