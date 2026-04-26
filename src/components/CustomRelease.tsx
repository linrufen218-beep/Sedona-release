import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AppSettings, saveRecord, getComponentState, saveComponentState, STORAGE_KEYS, WantType } from '@/lib/store';
import { analyzeEmotions } from '@/services/geminiService';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Heart, Settings2, Smile, Zap, Layers, Search, Loader2, RefreshCcw, ArrowRight, Save, ChevronLeft, LogOut, Plus, Mic } from 'lucide-react';
import { VoiceInput } from './VoiceInput';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const EMOTION_CATEGORIES = [
  { name: '万念俱灰', color: 'bg-slate-500', emotions: ['无聊', '不能赢', '粗心大意', '冷淡', '停止', '死亡', '被打败', '沮丧', '泄气', '凄惨', '绝望', '气馁', '幻想破灭', '死定了', '精疲力竭', '失败', '可遗忘的', '没出息', '放弃', '冷酷无情的', '没有希望', '没有幽默感', '我不行', '我不在乎', '我没有价值', '漫不经心', '优柔寡断', '冷漠', '没有存在感', '太晚了', '懒惰', '再等等吧', '无精打采', '失败者', '失败的', '消极', '麻木不仁', '击溃', '无能为力', '认命', '震惊', '魂不守舍', '神志恍惚', '停滞不前', '太累', '冷酷无情', '漫无目的', '没用', '模糊不清', '废品', '有什么用呢', '为什么要试呢', '不值得'] },
  { name: '悲苦', color: 'bg-blue-500', emotions: ['被遗弃', '被羞辱', '被控告', '极度痛苦', '丢脸', '被背叛', '忧郁', '被欺骗', '绝望', '失望', '心烦意乱', '尴尬的', '被忘掉', '愧疚的', '心碎的', '头痛', '沮丧', '无助的', '受伤', '要是就好了', '被忽视的', '不够', '伤心欲绝', '不公平', '被遗忘', '极度渴望', '损失', '哀愁', '被误解', '哀悼', '被忽略', '没有人关心我', '没有人爱我', '乡愁', '错误', '遗憾', '可怜的我', '后悔', '被拒绝', '懊悔', '悲伤', '让人落泪的', '被折磨', '被虐待', '不开心', '不被爱', '脆弱', '为什么是我', '受伤的'] },
  { name: '恐惧', color: 'bg-purple-500', emotions: ['焦虑', '不安', '小心谨慎', '冷黏湿', '胆小怯懦', '自我防卫', '不信任', '怀疑', '惧怕', '逃避的', '预感', '狂乱的', '犹豫不决', '惊骇的', '歇斯底里', '拘束的', '不理智', '恶心', '紧张', '恐慌', '麻痹的', '偏执狂', '被吓到', '偷偷摸摸', '可靠的', '羞涩', '怀疑的', '怯场', '迷信的', '多疑的', '简短生硬', '被吓坏', '被威胁', '羞怯', '陷入困境', '迟疑不决', '心神不宁', '易受伤', '想要', '逃避', '小心翼翼', '担心'] },
  { name: '贪求', color: 'bg-orange-500', emotions: ['预期', '冷酷无情', '等不了', '冲动', '渴望', '苛求的', '狡诈的', '被驱使', '嫉妒', '剥削', '过分迷恋', '暴怒', '失意的', '贪吃暴食', '贪婪', '囤积', '饥饿', '我想', '不耐烦', '好色的', '淫荡的', '操纵别人', '吝啬的', '一定要得到', '从来不满足', '从来不满意', '没意识到的', '着迷的', '溺爱娇纵', '占有欲强', '掠夺成性', '固执见', '鲁莽', '残忍的', '诡计多端', '自私的', '如饥似渴', '放肆'] },
  { name: '愤怒', color: 'bg-red-500', emotions: ['伤人感情', '奸诈的', '被惹恼', '好辩的', '好战的', '激烈', '令人恐惧', '刻慢的', '挑衅的', '苛求的', '毁灭性', '嫌恶', '脾气暴躁', '凶猛的', '泄气的', '气愤', '狂怒的', '严厉', '憎恨', '故意', '不耐烦', '愤愤不平', '生气', '嫉妒', '妒忌', '怒气冲冲', '疯狂', '卑鄙', '残忍', '凶残的', '义愤填膺', '坏脾气', '一意孤行', '叛逆的', '怨恨', '顽固', '抵制', '粗鲁', '野蛮', '冲突激化', '怒气冲天', '五肉俱焚', '怀根在心', '钢铁般的', '着急', '倔强', '愠怒', '复仇心切', '邪恶', '暴力', '易爆发', '恶劣的', '任性的'] },
  { name: '自尊自傲', color: 'bg-yellow-600', emotions: ['无懈可击', '超然离群', '自负', '固执己见', '聪明的', '封闭的', '沾沾自喜', '逞能', '轻蔑的', '潇洒', '挑剔的', '鄙弃', '傲慢专断', '假谦卑', '虚假美德', '扬扬得意', '傲慢', '自以为是', '虚伪', '冷冰冰', '孤僻的', '批判性', '自称全知', '心胸狭隘', '不会错', '武断', '盛气凌人', '神气十足', '偏颇的', '放肆', '自以公正', '刚直不屈', '自恋的', '自鸣得意', '自私', '自命不凡', '势利眼', '独特', '被宠坏', '禁欲主义', '顽固不化', '自高自大', '优越感', '强硬不妥协', '无感觉', '不宽恕', '不屈服', '虚荣'] },
  { name: '无畏', color: 'bg-emerald-500', emotions: ['喜欢冒险', '警惕的', '活着的', '胸有成竹', '机警的', '有中心的', '有把握', '愉快', '思路清晰', '怜悯', '能干的', '自信的', '创新的', '大胆', '果断的', '有活力', '热切的', '热情的', '欢欣', '探索', '灵活性', '专注的', '乐善好施', '开心', '可敬的', '幽默', '我行', '独立', '首创精神', '正直', '所向披靡', '有爱的', '头脑清楚', '自强不息', '来者不拒', '开放', '乐观', '洞察力', '积极', '意志坚强', '敏感的', '稳当的', '自给自足', '犀利的', '坚强的', '助人为乐', '不知疲倦', '精力充沛', '乐意', '热忱'] },
  { name: '接纳', color: 'bg-teal-500', emotions: ['丰盛', '有眼力的', '平衡', '美丽', '有归属感', '天真烂漫', '同情心', '体贴的', '高兴', '兴高采烈', '拥抱', '善解人意', '丰富', '一切安好', '友善的', '丰满', '温柔', '热情洋溢', '亲切的', '和谐', '直觉的', '合拍', '令人高兴', '富有爱心', '宽宏大量', '成熟的', '轻松自如', '无需更改', '开放', '幽默的', '容光焕发', '善于接受', '稳当的', '温和的', '柔和的', '理解', '温暖', '幸福', '奇迹'] },
  { name: '平和', color: 'bg-indigo-400', emotions: ['永不衰老', '有觉悟的', '存在', '无边无际', '镇静', '不朽', '自由', '满足的', '热情洋溢', '轻松', '同一性', '完美', '纯粹', '安静', '宁静', '无限空间', '静止', '永恒的', '安宁', '无限', '完整'] },
];

const THREE_STEPS = [
  "你允许这种感觉存在吗？",
  "你能识别出这是哪种‘想要’吗？",
  "你允许自己放下它吗？"
];

const SIX_STEPS = [
  "你必须想要‘波澜不惊’超过你想要‘被认可’、‘控制’或‘安全’吗？",
  "你决定通过释放来达到‘波澜不惊’吗？",
  "你能看到所有这些情绪感受都源自这三个想要吗？你能立即释放它们吗？",
  "你愿意在任何时候，无论独处或人前，都持续释放这些想要吗？",
  "如果你现在感到‘卡住了’，你愿意放开对这个‘卡住’的想要控制吗？",
  "你现在感到更轻松、更快乐了一点吗？"
];

const EMOTION_STEPS = [
  "你能放下它吗？",
  "你愿意放下它吗？"
];

const RELEASE_MODES = [
  { id: 'emotion', title: '释放情绪', description: '针对特定情绪的快速释放。', icon: Smile, steps: EMOTION_STEPS },
  { id: 'want_3', title: '释放想要 (三步骤)', description: '深入释放底层的想要。', icon: Shield, steps: THREE_STEPS },
  { id: 'want_6', title: '释放想要 (六步骤)', description: '全方位、系统性地释放想要。', icon: Zap, steps: SIX_STEPS }
];

const WANT_LABELS: Record<WantType, string> = {
  approval: '想要被认可',
  control: '想要控制',
  security: '想要安全',
};

export default function CustomRelease({ settings }: { settings?: AppSettings }) {
  const [phase, setPhase] = useState<'entry' | 'want_config' | 'emotion_source' | 'emotion_select' | 'ai_analyze' | 'release' | 'post_release'>(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.phase || 'entry');
  const [selectedMode, setSelectedMode] = useState<any>(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.selectedMode || RELEASE_MODES[0]);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.selectedEmotions || []);
  const [selectedWants, setSelectedWants] = useState<WantType[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.selectedCategories || []);
  const [inputText, setInputText] = useState(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.inputText || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.aiAnalysis || null);
  const [stepIndex, setStepIndex] = useState(() => getComponentState(STORAGE_KEYS.CUSTOM_STATE)?.stepIndex || 0);
  const [releaseIndex, setReleaseIndex] = useState(0);
  const [isMerged, setIsMerged] = useState(false);
  const [isMoreReleaseOpen, setIsMoreReleaseOpen] = useState(false);
  const [moreReleaseEmotion, setMoreReleaseEmotion] = useState('');
  const [moreReleaseWants, setMoreReleaseWants] = useState<WantType[]>([]);
  const [releaseList, setReleaseList] = useState<{s: string, w: string[], c?: string}[]>([]);
  const [isSubQuestion, setIsSubQuestion] = useState(false);
  const [lastSourcePhase, setLastSourcePhase] = useState<'ai_analyze' | 'emotion_select' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [wantMethod, setWantMethod] = useState<'three' | 'six'>('three');

  // Resolve current active steps and labels
  const getAssignment = () => {
    let key: keyof NonNullable<AppSettings['moduleAssignments']> = 'custom_emotion';
    if (phase === 'want_config' || selectedMode?.id?.startsWith('want')) {
      key = wantMethod === 'six' ? 'custom_want_six' : 'custom_want_three';
    }
    const groupId = settings?.moduleAssignments?.[key];
    return settings?.questionGroups?.find(g => g.id === groupId);
  };

  const getEffectiveSteps = () => {
    const group = getAssignment();
    if (group && group.steps.length > 0) {
      return group.steps.map(s => s.question);
    }
    
    if (settings?.useDefaultQuestions !== false) {
      if (phase === 'want_config') {
        const mode = wantMethod === 'three' ? RELEASE_MODES[1] : RELEASE_MODES[2];
        return mode.steps;
      }
      return RELEASE_MODES[0].steps;
    }
    
    return THREE_STEPS; // Fallback
  };

  // Save state on changes
  useEffect(() => {
    saveComponentState(STORAGE_KEYS.CUSTOM_STATE, {
      phase,
      selectedMode,
      selectedEmotions,
      selectedCategories,
      inputText,
      aiAnalysis,
      stepIndex
    });
  }, [phase, selectedMode, selectedEmotions, selectedCategories, inputText, aiAnalysis, stepIndex]);

  const startRelease = () => {
    let list: {s: string, w: string[], c?: string}[] = [];
    
    if (phase === 'want_config') {
      const mode = wantMethod === 'three' ? RELEASE_MODES[1] : RELEASE_MODES[2];
      setSelectedMode(mode);
      selectedWants.forEach(w => {
        list.push({ 
          s: WANT_LABELS[w], 
          w: [w] 
        });
      });
    } else {
      setSelectedMode(RELEASE_MODES[0]); // Emotion mode
      if (isMerged) {
        const mergedEmotions = selectedEmotions.join('、');
        list = [{ 
          s: mergedEmotions, 
          w: [],
          c: selectedCategories.join('、')
        }];
      } else {
        selectedEmotions.forEach(e => {
          // Find category for this emotion if manually selected
          const category = EMOTION_CATEGORIES.find(cat => cat.emotions.includes(e))?.name;
          list.push({ 
            s: e, 
            w: [],
            c: category || (selectedCategories.length > 0 ? selectedCategories[0] : undefined)
          });
        });
      }
    }

    if (list.length === 0) return;

    setReleaseList(list);
    setReleaseIndex(0);
    setStepIndex(0);
    
    const steps = getEffectiveSteps();
    setSelectedMode((prev: any) => ({ ...prev, steps: steps }));
    
    setLastSourcePhase(phase === 'ai_analyze' ? 'ai_analyze' : 'emotion_select');
    setPhase('release');
  };

  const getButtonLabels = () => {
    const group = getAssignment();

    if (isSubQuestion) {
      if (group && group.steps[stepIndex]?.hasBranch) {
        const branchText = group.steps[stepIndex].branchQuestion || '';
        if (branchText.includes('允许')) return { primary: '允许', secondary: '不允许' };
        if (branchText.includes('愿意')) return { primary: '愿意', secondary: '不愿意' };
        if (branchText.includes('能') || branchText.includes('可以')) return { primary: '能', secondary: '不能' };
        if (branchText.includes('什么时候') || branchText.includes('何时')) return { primary: '现在', secondary: '以后' };
      }
      return { primary: '能', secondary: '不能' };
    }

    if (group && group.steps[stepIndex]) {
      return { 
        primary: group.steps[stepIndex].positive || '是', 
        secondary: group.steps[stepIndex].negative || '否' 
      };
    }

    const stepText = selectedMode.steps[stepIndex];
    if (stepText.includes('允许')) return { primary: '允许', secondary: '不允许' };
    if (stepText.includes('愿意')) return { primary: '愿意', secondary: '不愿意' };
    if (stepText.includes('能') || stepText.includes('可以')) return { primary: '能', secondary: '不能' };
    if (stepText.includes('什么时候') || stepText.includes('何时')) return { primary: '现在', secondary: '以后' };
    
    return { primary: '是', secondary: '否' };
  };

  const handleAiAnalyze = async () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    setPhase('ai_analyze');
    setAiAnalysis({ emo: [], cat: [], ana: '' });
    try {
      const result = await analyzeEmotions(
        inputText, 
        (partial) => {
          setAiAnalysis(partial);
          if (partial.emo) setSelectedEmotions(partial.emo);
          if (partial.cat) setSelectedCategories(partial.cat);
        },
        {
          model_type: settings.selectedModel || 'MINIMAX25',
          invite_code: settings.inviteCode,
          aiBaseUrl: settings?.useCustomConfig ? settings.aiBaseUrl : undefined,
          aiApiKey: settings?.useCustomConfig ? settings.aiApiKey : undefined,
          aiModelName: settings?.useCustomConfig ? settings.aiModelName : undefined
        }
      );
      setAiAnalysis(result);
      setSelectedEmotions(result.emo);
      setSelectedCategories(result.cat);

      // Auto save record after successful analysis
      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().split('T')[0],
        type: 'custom',
        content: `自定义释放分析: ${inputText.substring(0, 20)}...`,
        analysis: { list: [], ana: result.ana },
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error(error);
      alert(error.message || '分析失败，请检查 Worker 配置或网络');
      setPhase('emotion_source');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const nextStep = (isPrimary: boolean) => {
    const group = getAssignment();

    // Custom Group branch Question
    if (!isSubQuestion && !isPrimary && group && group.steps[stepIndex]?.hasBranch) {
      setIsSubQuestion(true);
      return;
    }

    if (isSubQuestion) {
      setIsSubQuestion(false);
      // Fall through to go next step
    }

    if (stepIndex < selectedMode.steps.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      if (releaseIndex < releaseList.length - 1) {
        setReleaseIndex(releaseIndex + 1);
        setStepIndex(0);
      } else {
        setPhase('post_release');
      }
    }
  };

  const finishAll = () => {
    handleManualSave();
    reset();
  };

  const handleManualSave = () => {
    saveRecord({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'custom',
      content: `自定义释放: ${selectedMode?.title || ''} - ${selectedEmotions.join(', ')}`,
      analysis: aiAnalysis ? { list: [], ana: aiAnalysis.ana } : undefined,
      timestamp: Date.now()
    });
    alert('记录已手动保存');
  };

  const toggleWant = (want: WantType) => {
    if (selectedWants.includes(want)) {
      setSelectedWants(selectedWants.filter(w => w !== want));
    } else {
      setSelectedWants([...selectedWants, want]);
    }
  };

  const handleQuit = () => {
    if (phase === 'release') {
      if (selectedMode.id === 'emotion') {
        setPhase(lastSourcePhase || (aiAnalysis ? 'ai_analyze' : 'emotion_select'));
      } else {
        setPhase('want_config');
      }
      setStepIndex(0);
      setReleaseIndex(0);
    }
  };

  const handleMoreRelease = () => {
    if (!moreReleaseEmotion.trim() || moreReleaseWants.length === 0) return;
    
    // Add to release list and start from there
    const newReleaseItem = {
      s: `(深入) ${moreReleaseEmotion}`,
      w: moreReleaseWants
    };
    
    setReleaseList([newReleaseItem]);
    setReleaseIndex(0);
    setStepIndex(0);
    setPhase('release');
    setMoreReleaseEmotion('');
    setMoreReleaseWants([]);
    setIsMoreReleaseOpen(false);
  };

  const toggleMoreWant = (want: WantType) => {
    setMoreReleaseWants(prev => 
      prev.includes(want) ? prev.filter(w => w !== want) : [...prev, want]
    );
  };

  const reset = () => {
    setPhase('entry');
    setSelectedMode(RELEASE_MODES[0]);
    setSelectedEmotions([]);
    setSelectedWants([]);
    setSelectedCategories([]);
    setInputText('');
    setAiAnalysis(null);
    setStepIndex(0);
    setReleaseIndex(0);
    setReleaseList([]);
  };

  const toggleEmotion = (emotion: string, category: string) => {
    if (selectedEmotions.includes(emotion)) {
      setSelectedEmotions(selectedEmotions.filter(e => e !== emotion));
    } else {
      setSelectedEmotions([...selectedEmotions, emotion]);
      if (!selectedCategories.includes(category)) {
        setSelectedCategories([...selectedCategories, category]);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <AnimatePresence mode="wait">
        {phase === 'entry' && (
          <motion.div key="entry" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-3xl mx-auto pt-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card 
                className="group border-none shadow-xl bg-card/60 backdrop-blur-md cursor-pointer hover:bg-accent/10 transition-all hover:scale-[1.02]"
                onClick={() => setPhase('want_config')}
              >
                <CardHeader className="text-center space-y-4">
                  <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mx-auto group-hover:bg-accent group-hover:text-white transition-colors">
                    <Shield className="w-8 h-8" />
                  </div>
                  <CardTitle className="text-2xl font-serif">释放想要</CardTitle>
                  <CardDescription>识别并释放行为背后的深层动力（认可、控制、安全）。</CardDescription>
                </CardHeader>
              </Card>

              <Card 
                className="group border-none shadow-xl bg-card/60 backdrop-blur-md cursor-pointer hover:bg-primary/10 transition-all hover:scale-[1.02]"
                onClick={() => setPhase('emotion_source')}
              >
                <CardHeader className="text-center space-y-4">
                  <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto group-hover:bg-primary group-hover:text-white transition-colors">
                    <Smile className="w-8 h-8" />
                  </div>
                  <CardTitle className="text-2xl font-serif">释放情绪</CardTitle>
                  <CardDescription>针对特定、当下的情绪进行有针对性的快速释放。</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </motion.div>
        )}

        {phase === 'want_config' && (
          <motion.div key="want_config" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-2xl mx-auto space-y-8">
            <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md">
              <CardHeader className="relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-4 top-4 rounded-full"
                  onClick={() => setPhase('entry')}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="text-center pt-4">
                  <CardTitle className="text-2xl font-serif">释放想要</CardTitle>
                  <CardDescription>选择您想释放的动力与深度。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <Label className="text-xs uppercase tracking-widest opacity-60">1. 选择释放方式</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {(['three', 'six'] as const).map((m) => {
                      let label = m === 'three' ? '三步骤' : '六步骤';
                      const key = m === 'three' ? 'custom_want_three' : 'custom_want_six';
                      const groupId = settings?.moduleAssignments?.[key];
                      const group = settings?.questionGroups?.find(g => g.id === groupId);
                      if (group) label = group.name;

                      return (
                        <Button 
                          key={m}
                          variant={wantMethod === m ? 'default' : 'outline'}
                          className={`h-14 truncate px-1 ${wantMethod === m ? 'bg-accent' : ''}`}
                          title={label}
                          onClick={() => setWantMethod(m)}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-xs uppercase tracking-widest opacity-60">2. 要释放的想要</Label>
                  <div className="grid grid-cols-1 gap-3">
                    {(Object.keys(WANT_LABELS) as WantType[]).map(w => (
                      <Button
                        key={w}
                        variant={selectedWants.includes(w) ? 'default' : 'outline'}
                        className={`justify-between h-14 px-6 ${selectedWants.includes(w) ? 'bg-accent' : ''}`}
                        onClick={() => {
                          if (selectedWants.includes(w)) {
                            setSelectedWants(selectedWants.filter(item => item !== w));
                          } else {
                            setSelectedWants([...selectedWants, w]);
                          }
                        }}
                      >
                        {WANT_LABELS[w]}
                        {selectedWants.includes(w) && <Plus className="w-4 h-4 rotate-45" />}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button 
                  className="w-full h-14 text-lg bg-primary" 
                  disabled={selectedWants.length === 0}
                  onClick={startRelease}
                >
                  确认并开始释放
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === 'emotion_source' && (
          <motion.div key="source" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-2xl mx-auto space-y-8">
            <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md">
              <CardHeader className="relative">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute left-4 top-4 rounded-full"
                  onClick={() => setPhase('entry')}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="text-center pt-4">
                  <CardTitle className="text-2xl font-serif">您想释放什么情绪？</CardTitle>
                  <CardDescription>您可以直接选择，或让 AI 帮您分析。</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4 relative">
                  <Label className="flex items-center justify-between w-full">
                    输入一段话让 AI 分析情绪
                    {settings?.enableVoiceInput && (
                      <VoiceInput size="sm" onResult={(voiceText) => setInputText(prev => prev + voiceText)} />
                    )}
                  </Label>
                  <div className="relative">
                    <Textarea 
                      placeholder="描述您现在的感受..." 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="h-32 bg-background/40 pr-12"
                    />
                    {settings?.enableVoiceInput && (
                      <div className="absolute right-3 bottom-3">
                        <VoiceInput onResult={(voiceText) => setInputText(prev => prev + voiceText)} />
                      </div>
                    )}
                  </div>
                  <Button className="w-full bg-accent" onClick={handleAiAnalyze} disabled={!inputText.trim()}>
                    AI 情绪分析
                  </Button>
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">或者</span></div>
                </div>
                <Button variant="outline" className="w-full h-14" onClick={() => setPhase('emotion_select')}>
                  <Search className="mr-2 w-4 h-4" /> 手动搜索/选择情绪
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === 'emotion_select' && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex items-center gap-4 bg-card/60 p-4 rounded-2xl backdrop-blur-md sticky top-20 z-10 border border-border/20">
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full"
                onClick={() => setPhase('emotion_source')}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex-grow flex items-center gap-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="搜索情绪 (如: 焦虑, 愤怒...)" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-none bg-transparent focus-visible:ring-0 text-lg"
                />
              </div>
              <div className="flex items-center gap-2 border-l border-border/30 pl-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setSelectedEmotions([]);
                    setSelectedCategories([]);
                  }}
                  disabled={selectedEmotions.length === 0}
                >
                  清空已选
                </Button>
                <Button 
                  variant={isMerged ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-8 text-[10px]"
                  onClick={() => setIsMerged(!isMerged)}
                >
                  {isMerged ? '合并释放' : '逐个释放'}
                </Button>
                <Button onClick={startRelease} disabled={selectedEmotions.length === 0 && selectedWants.length === 0} className="bg-primary">
                  开始释放 ({selectedEmotions.length + selectedWants.length})
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {selectedMode.id !== 'emotion' && (
                <div className="md:col-span-1 space-y-6">
                  <Card className="border-none bg-card/40 backdrop-blur-sm p-4 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-accent">释放三大想要</h4>
                    <div className="flex flex-col gap-2">
                      {(['approval', 'control', 'security'] as WantType[]).map((want) => (
                        <Button
                          key={want}
                          variant={selectedWants.includes(want) ? 'default' : 'outline'}
                          className={`justify-start text-xs h-10 ${selectedWants.includes(want) ? 'bg-accent' : ''}`}
                          onClick={() => toggleWant(want)}
                        >
                          {want === 'approval' ? '想要被认可' : want === 'control' ? '想要控制' : '想要安全'}
                        </Button>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              <div className={selectedMode.id !== 'emotion' ? "md:col-span-3" : "md:col-span-4"}>
                <ScrollArea className="h-[600px] w-full pr-4">
                  <div className={`grid grid-cols-1 ${selectedMode.id !== 'emotion' ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-6 pb-24`}>
                    {EMOTION_CATEGORIES.map((cat) => (
                      <div key={cat.name} className="space-y-3">
                        <h4 className={`text-xs font-bold uppercase tracking-widest p-2 rounded-lg text-white ${cat.color}`}>{cat.name}</h4>
                        <div className="flex flex-wrap gap-2">
                          {cat.emotions.filter(e => e.includes(searchTerm)).map((emo) => (
                            <Badge 
                              key={emo} 
                              variant={selectedEmotions.includes(emo) ? 'default' : 'outline'}
                              className={`cursor-pointer px-3 py-1.5 text-sm transition-all ${selectedEmotions.includes(emo) ? 'bg-accent scale-105' : 'hover:bg-accent/10'}`}
                              onClick={() => toggleEmotion(emo, cat.name)}
                            >
                              {emo}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </motion.div>
        )}

        {phase === 'ai_analyze' && (
          <motion.div key="ai" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto">
            {isAnalyzing && !aiAnalysis ? (
              <div className="text-center py-20 space-y-6">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-accent" />
                <p className="font-serif text-xl">AI 正在深度觉察您的情绪...</p>
              </div>
            ) : (
              <Card className="border-none shadow-xl bg-card/80 backdrop-blur-md">
                <CardHeader className="relative">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute left-4 top-4 rounded-full"
                    onClick={() => setPhase('emotion_source')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <div className="pt-4 text-center">
                    <CardTitle className="text-2xl font-serif">AI 情绪觉察结果</CardTitle>
                    {isAnalyzing && <p className="text-[10px] text-accent animate-pulse">实时分析中...</p>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-3 pb-2 border-b border-border/20">
                    <Label className="text-xs uppercase tracking-widest opacity-60">分析原句</Label>
                    <p className="text-[13px] text-muted-foreground leading-relaxed italic">
                      "{inputText}"
                    </p>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest opacity-60">识别出的情绪</Label>
                    <div className="flex flex-wrap gap-2 min-h-[24px]">
                      {aiAnalysis?.emo && aiAnalysis.emo.map((e: string) => <Badge key={e} className="bg-accent/20 text-accent border-none">{e}</Badge>)}
                      {isAnalyzing && !aiAnalysis?.emo?.length && <span className="text-xs text-muted-foreground animate-pulse">正在识别情绪...</span>}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest opacity-60">所属大项</Label>
                    <div className="flex flex-wrap gap-2 min-h-[24px]">
                      {aiAnalysis?.cat && aiAnalysis.cat.map((c: string) => <Badge key={c} variant="secondary">{c}</Badge>)}
                      {isAnalyzing && !aiAnalysis?.cat?.length && <span className="text-xs text-muted-foreground animate-pulse">正在分类...</span>}
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-secondary/10 border border-secondary/20 italic leading-relaxed min-h-[100px]">
                    <h4 className="font-bold text-[10px] md:text-sm mb-2 text-secondary-foreground flex items-center gap-2 uppercase tracking-wide not-italic">
                      <RefreshCcw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isAnalyzing ? 'animate-spin' : ''}`} /> 分析总结
                    </h4>
                    {aiAnalysis?.ana || (isAnalyzing && <span className="text-muted-foreground animate-pulse">AI 正在进行深层洞察...</span>)}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button 
                      variant="outline" 
                      className="flex-1 h-11 md:h-12 border-primary/30 hover:bg-primary/10 text-xs md:text-sm" 
                      onClick={() => {
                        setInputText('');
                        setSelectedEmotions([]);
                        setAiAnalysis(null);
                        setPhase('emotion_source');
                      }}
                    >
                      清空并退出
                    </Button>
                    <Button variant="secondary" className="flex-1" onClick={handleManualSave}>
                      <Save className="w-4 h-4 mr-2" /> 手动保存
                    </Button>
                    <Button 
                      className="flex-1 bg-primary" 
                      disabled={!aiAnalysis?.emo?.length} 
                      onClick={startRelease}
                    >
                      {isAnalyzing ? '分析中 (可先确认)' : '确认并释放'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {phase === 'release' && (
          <motion.div key="release" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-12 relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-0 top-0 text-muted-foreground hover:text-destructive"
              onClick={handleQuit}
            >
              <LogOut className="w-6 h-6" />
            </Button>

            <div className="space-y-4">
              <Badge variant="outline" className="px-4 py-1 border-accent text-accent">
                {selectedMode.title} ({releaseIndex + 1}/{releaseList.length})
              </Badge>
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {releaseList[releaseIndex]?.w.map(w => (
                  <span key={w} className="text-[10px] text-accent uppercase font-bold">
                    #{w === 'approval' ? '认可' : w === 'control' ? '控制' : '安全'}
                  </span>
                ))}
              </div>
              {releaseList[releaseIndex]?.c ? (
                <div className="space-y-2">
                  <h2 className="text-4xl font-serif text-foreground tracking-tight">
                    {releaseList[releaseIndex].c}
                  </h2>
                  <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                    当前情绪：{releaseList[releaseIndex].s}
                  </p>
                </div>
              ) : (
                <h2 className="text-2xl font-serif leading-relaxed text-foreground px-6 mt-4">
                  {releaseList[releaseIndex]?.s}
                </h2>
              )}
              <p className="text-lg text-muted-foreground font-medium">
                {isSubQuestion 
                  ? (getAssignment()?.steps[stepIndex]?.branchQuestion || '你想补充什么吗？')
                  : selectedMode.steps[stepIndex].replace('对{emo}的', '').replace('{emo}的', '').replace('{emo}', '')}
              </p>
            </div>

            <div className="space-y-6 w-full max-w-sm">
              <Button size="lg" className="w-full h-14 text-lg rounded-2xl bg-primary hover:bg-accent text-primary-foreground shadow-lg transition-all active:scale-95" onClick={() => nextStep(true)}>
                {getButtonLabels().primary}
              </Button>
              <Button variant="outline" className="w-full h-14 text-lg rounded-2xl border-border hover:bg-muted text-muted-foreground transition-all active:scale-95" onClick={() => nextStep(false)}>
                {getButtonLabels().secondary}
              </Button>
            </div>

            <div className="flex gap-3">
              {selectedMode.steps.map((_: any, i: number) => (
                <div key={i} className={`w-3 h-3 rounded-full transition-all duration-500 ${i === stepIndex ? 'bg-accent w-8' : 'bg-muted'}`} />
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'post_release' && (
          <motion.div key="post" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto text-center space-y-10 py-20">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <Smile className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-3xl font-serif">感觉好点了吗？</h2>
              <p className="text-muted-foreground">释放是一个持续的过程，您可以选择继续深入或完成本次旅程。</p>
            </div>

            <div className="flex flex-col gap-4">
              <Button size="lg" className="h-14 text-lg rounded-2xl bg-accent hover:bg-accent/80" onClick={() => { setStepIndex(0); setPhase('release'); }}>
                <RefreshCcw className="mr-2 w-5 h-5" /> 重新释放当前情绪
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-14 text-lg rounded-2xl border-border" 
                onClick={() => {
                  if (selectedMode.id === 'emotion') {
                    setPhase(lastSourcePhase || (aiAnalysis ? 'ai_analyze' : 'emotion_select'));
                  } else {
                    setPhase('want_config');
                  }
                }}
              >
                <ArrowRight className="mr-2 w-5 h-5" /> 继续释放其他情绪
              </Button>
              <Button 
                variant="ghost" 
                className="text-accent hover:text-accent/80 flex items-center gap-2 justify-center"
                onClick={() => setIsMoreReleaseOpen(true)}
              >
                <Zap className="w-4 h-4" /> 释放更多 (探索底层想要)
              </Button>
              <Button size="lg" variant="outline" className="h-14 text-lg rounded-2xl border-border text-muted-foreground" onClick={finishAll}>
                完成并保存记录
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              onClick={handleMoreRelease}
            >
              开始深入分析释放
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
