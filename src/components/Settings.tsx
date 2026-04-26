import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AppSettings, saveSettings, QuestionGroup, QuestionStep } from '@/lib/store';
import { Settings as SettingsIcon, Save, Trash2, Plus, CheckCircle2, ChevronRight, HelpCircle, Leaf, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

export default function Settings({ settings, onSettingsChange }: SettingsProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Local state for editing custom config
  const activeCustomConfig = settings.customAiConfigs?.find(c => c.id === settings.selectedCustomConfigId);
  const [editConfig, setEditConfig] = useState<Partial<AppSettings>>({
    aiBaseUrl: activeCustomConfig?.baseUrl || settings.aiBaseUrl || '',
    aiApiKey: activeCustomConfig?.apiKey || settings.aiApiKey || '',
    aiModelName: activeCustomConfig?.modelName || settings.aiModelName || '',
  });

  const updateSettings = (newSettings: AppSettings) => {
    onSettingsChange(newSettings);
    saveSettings(newSettings);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleAddGroup = () => {
    const newGroup: QuestionGroup = {
      id: crypto.randomUUID(),
      name: `问句组 ${ (settings.questionGroups?.length || 0) + 1 }`,
      steps: [
        { id: crypto.randomUUID(), question: '你允许这种感觉存在吗？', positive: '能 / 允许', negative: '不能 / 不允许' }
      ]
    };
    updateSettings({
      ...settings,
      questionGroups: [...(settings.questionGroups || []), newGroup]
    });
  };

  const handleUpdateGroupName = (groupId: string, name: string) => {
    const newGroups = settings.questionGroups?.map(g => 
      g.id === groupId ? { ...g, name } : g
    ) || [];
    updateSettings({ ...settings, questionGroups: newGroups });
  };

  const handleDeleteGroup = (groupId: string) => {
    const newGroups = settings.questionGroups?.filter(g => g.id !== groupId) || [];
    updateSettings({ ...settings, questionGroups: newGroups });
  };

  const handleAddStep = (groupId: string) => {
    const newGroups = settings.questionGroups?.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          steps: [
            ...g.steps,
            { id: crypto.randomUUID(), question: '', positive: '是', negative: '否' }
          ]
        };
      }
      return g;
    }) || [];
    updateSettings({ ...settings, questionGroups: newGroups });
  };

  const handleUpdateStep = (groupId: string, stepId: string, updates: Partial<QuestionStep>) => {
    const newGroups = settings.questionGroups?.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          steps: g.steps.map(s => s.id === stepId ? { ...s, ...updates } : s)
        };
      }
      return g;
    }) || [];
    updateSettings({ ...settings, questionGroups: newGroups });
  };

  const handleDeleteStep = (groupId: string, stepId: string) => {
    const newGroups = settings.questionGroups?.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          steps: g.steps.filter(s => s.id !== stepId)
        };
      }
      return g;
    }) || [];
    updateSettings({ ...settings, questionGroups: newGroups });
  };

  const handleModuleBind = (module: string, groupId: string) => {
    updateSettings({
      ...settings,
      moduleAssignments: {
        ...(settings.moduleAssignments || {}),
        [module]: groupId === 'default' ? undefined : groupId
      }
    });
  };

  const modules = [
    { id: 'daily', title: '日常释放' },
    { id: 'area', title: '领域释放' },
    { id: 'focused', title: '集中释放' },
    { id: 'focused_ai_gen', title: '集中 - AI深度引导' },
    { id: 'custom_want_three', title: '自定义 - 释放想要 - 1' },
    { id: 'custom_want_six', title: '自定义 - 释放想要 - 2' },
    { id: 'custom_emotion', title: '自定义 - 释放情绪' },
    { id: 'stuck_three', title: '化解卡住 - 1' },
    { id: 'stuck_six', title: '化解卡住 - 2' },
    { id: 'stuck_emotion', title: '化解卡住 - 情绪释放' },
    { id: 'stuck_qa', title: '化解卡住 - 问答释放' },
  ];

  const handleAddCustomConfig = () => {
    const newConfig = {
      id: crypto.randomUUID(),
      name: `新配置 ${ (settings.customAiConfigs?.length || 0) + 1 }`,
      baseUrl: editConfig.aiBaseUrl || '',
      apiKey: editConfig.aiApiKey || '',
      modelName: editConfig.aiModelName || '',
    };
    updateSettings({
      ...settings,
      customAiConfigs: [...(settings.customAiConfigs || []), newConfig],
      selectedCustomConfigId: newConfig.id,
      useCustomConfig: true,
      aiBaseUrl: newConfig.baseUrl,
      aiApiKey: newConfig.apiKey,
      aiModelName: newConfig.modelName,
    });
  };

  const handleSaveCurrentToConfig = (configId: string) => {
    const newConfigs = settings.customAiConfigs?.map(c => 
      c.id === configId ? { 
        ...c, 
        baseUrl: settings.aiBaseUrl || '', 
        apiKey: settings.aiApiKey || '', 
        modelName: settings.aiModelName || '' 
      } : c
    ) || [];
    updateSettings({ ...settings, customAiConfigs: newConfigs });
  };

  const handleUpdateConfigName = (configId: string, name: string) => {
    const newConfigs = settings.customAiConfigs?.map(c => 
      c.id === configId ? { ...c, name } : c
    ) || [];
    updateSettings({ ...settings, customAiConfigs: newConfigs });
  };

  const handleDeleteConfig = (configId: string) => {
    const newConfigs = settings.customAiConfigs?.filter(c => c.id !== configId) || [];
    const isSelected = settings.selectedCustomConfigId === configId;
    updateSettings({ 
      ...settings, 
      customAiConfigs: newConfigs,
      selectedCustomConfigId: isSelected ? '' : settings.selectedCustomConfigId,
      useCustomConfig: isSelected ? false : settings.useCustomConfig
    });
  };

  const handleSelectConfig = (configId: string) => {
    if (configId === 'builtin') {
      updateSettings({ ...settings, useCustomConfig: false, selectedCustomConfigId: '' });
      return;
    }
    
    const config = settings.customAiConfigs?.find(c => c.id === configId);
    if (config) {
      updateSettings({
        ...settings,
        useCustomConfig: true,
        selectedCustomConfigId: config.id,
        aiBaseUrl: config.baseUrl,
        aiApiKey: config.apiKey,
        aiModelName: config.modelName
      });
    }
  };

  const handleDuplicateConfig = (configId: string) => {
    const config = settings.customAiConfigs?.find(c => c.id === configId);
    if (config) {
      const newConfig = {
        ...config,
        id: crypto.randomUUID(),
        name: `${config.name} (副本)`
      };
      updateSettings({
        ...settings,
        customAiConfigs: [...(settings.customAiConfigs || []), newConfig],
        selectedCustomConfigId: newConfig.id
      });
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-24 px-4 md:px-0">
      <Accordion type="multiple" defaultValue={[]} className="space-y-4">
        {/* 访问配置 */}
        <AccordionItem value="access" className="border-none">
          <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl rounded-2xl overflow-hidden">
            <AccordionTrigger className="hover:no-underline py-0">
              <CardHeader className="bg-accent/5 pb-4 w-full text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-accent/10">
                    <SettingsIcon className="w-5 h-5 text-accent" />
                  </div>
                  <CardTitle className="text-lg font-serif">访问配置</CardTitle>
                </div>
                <CardDescription>管理您的 AI 模型与访问授权。</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between gap-4 p-1 bg-muted/30 rounded-xl border border-border/20">
                  <button 
                    onClick={() => handleSelectConfig('builtin')}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${!settings.useCustomConfig ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    系统内置
                  </button>
                  <button 
                    onClick={() => {
                      if (!settings.customAiConfigs?.length) {
                        handleAddCustomConfig();
                      } else {
                        handleSelectConfig(settings.selectedCustomConfigId || settings.customAiConfigs[0].id);
                      }
                    }}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${settings.useCustomConfig ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    自填配置
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {!settings.useCustomConfig ? (
                    <motion.div
                      key="builtin"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="space-y-4"
                    >
                      <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl">
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          正在使用系统预设的高速 AI 引擎，无需额外配置。您可以选择不同的偏好模型。
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground ml-1">模型引擎</Label>
                        <Select value={settings.selectedModel} onValueChange={(v) => updateSettings({ ...settings, selectedModel: v as any })}>
                          <SelectTrigger className="w-full h-11 bg-background/40 border-border/40 rounded-xl">
                            <SelectValue placeholder="选择模型" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MINIMAX25">MiniMax (极速版) - 敏捷</SelectItem>
                            <SelectItem value="DEEPSEEK32">DeepSeek (增强版) - 深度</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="custom"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="space-y-5"
                    >
                      {/* 配置管理 */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">选择配置方案</Label>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 rounded-md text-primary hover:bg-primary/10"
                            onClick={handleAddCustomConfig}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        
                        <div className="flex gap-2">
                          <div className="flex-grow">
                            <Select 
                              value={settings.selectedCustomConfigId || ''} 
                              onValueChange={handleSelectConfig}
                            >
                              <SelectTrigger className="h-11 bg-background/40 border-border/40 rounded-xl">
                                <SelectValue placeholder="选择自定义配置" />
                              </SelectTrigger>
                              <SelectContent>
                                {settings.customAiConfigs?.map(config => (
                                  <SelectItem key={config.id} value={config.id}>{config.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {settings.selectedCustomConfigId && (
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-11 w-11 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5"
                                onClick={() => handleDuplicateConfig(settings.selectedCustomConfigId!)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-11 w-11 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                onClick={() => handleDeleteConfig(settings.selectedCustomConfigId!)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {settings.selectedCustomConfigId && (
                        <div className="space-y-4 pt-1">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground ml-1">方案名称</Label>
                            <Input 
                              value={settings.customAiConfigs?.find(c => c.id === settings.selectedCustomConfigId)?.name || ''}
                              onChange={(e) => handleUpdateConfigName(settings.selectedCustomConfigId!, e.target.value)}
                              placeholder="给这个配置起个名字"
                              className="h-11 bg-background/40 border-border/40 rounded-xl"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground ml-1">AI 接口 Base URL</Label>
                            <Input 
                              type="text"
                              placeholder="https://your-api.com/v1"
                              className="h-11 bg-background/40 border-border/40 rounded-xl"
                              value={settings.aiBaseUrl || ''}
                              onChange={(e) => updateSettings({ ...settings, aiBaseUrl: e.target.value })}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground ml-1">API Key</Label>
                            <Input 
                              type="password"
                              placeholder="sk-..."
                              className="h-11 bg-background/40 border-border/40 rounded-xl"
                              value={settings.aiApiKey || ''}
                              onChange={(e) => updateSettings({ ...settings, aiApiKey: e.target.value })}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground ml-1">模型名称</Label>
                            <Input 
                              type="text"
                              placeholder="如: gpt-3.5-turbo..."
                              className="h-11 bg-background/40 border-border/40 rounded-xl"
                              value={settings.aiModelName || ''}
                              onChange={(e) => updateSettings({ ...settings, aiModelName: e.target.value })}
                            />
                          </div>

                          <Button 
                            className="w-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                            onClick={() => handleSaveCurrentToConfig(settings.selectedCustomConfigId!)}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            同步保存至当前方案
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-4 border-t border-border/10">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground ml-1">邀请码 (可选)</Label>
                    <Input 
                      type="password"
                      placeholder="如果您有验证码，请在此输入"
                      className="h-11 bg-background/40 border-border/40 rounded-xl"
                      value={settings.inviteCode}
                      onChange={(e) => updateSettings({ ...settings, inviteCode: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </AccordionContent>
          </Card>
        </AccordionItem>

        {/* 问句组配置 */}
        <AccordionItem value="questions" className="border-none">
          <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl rounded-2xl overflow-hidden">
            <AccordionTrigger className="hover:no-underline py-0">
              <CardHeader className="bg-accent/5 pb-4 w-full text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-accent/10">
                    <HelpCircle className="w-5 h-5 text-accent" />
                  </div>
                  <CardTitle className="text-lg font-serif">问句组设置</CardTitle>
                </div>
                <CardDescription>自定义释放流程中的引导问句与回答选项。</CardDescription>
              </CardHeader>
            </AccordionTrigger>
            <AccordionContent>
              <CardContent className="space-y-6 pt-6">

          {/* 默认问句开关 */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/30">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">使用内置默认问句</Label>
              <p className="text-[10px] text-muted-foreground">未关联自定义组的功能将使用系统预设问句</p>
            </div>
            <Switch 
              checked={settings.useDefaultQuestions} 
              onCheckedChange={(checked) => updateSettings({ ...settings, useDefaultQuestions: checked })}
            />
          </div>

          {/* 问句组列表 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <Label className="text-sm font-semibold">问句组库</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/5"
                onClick={handleAddGroup}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                添加组
              </Button>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {(settings.questionGroups || []).map((group) => (
                <AccordionItem 
                  key={group.id} 
                  value={group.id} 
                  className="border border-border/30 rounded-xl overflow-hidden bg-background/20 px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-sm font-medium">{group.name}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                        {group.steps.length} 步
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-5 space-y-4">
                    {/* 修改组名 */}
                    <div className="space-y-1.5 px-0.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">组名称</Label>
                      <div className="flex gap-2">
                        <Input 
                          value={group.name}
                          onChange={(e) => handleUpdateGroupName(group.id, e.target.value)}
                          className="h-10 bg-background/50 border-border/30 rounded-lg text-sm"
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 text-destructive/60 hover:text-destructive hover:bg-destructive/5"
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* 步骤列表 */}
                    <div className="space-y-4 pt-2 border-t border-border/10">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">问句流程</Label>
                      <div className="space-y-3">
                        {group.steps.map((step, idx) => (
                          <div key={step.id} className="p-3 bg-muted/40 rounded-xl space-y-3 relative group">
                            <div className="absolute -left-2 top-3 w-5 h-5 bg-background border border-border/30 rounded-full flex items-center justify-center text-[10px] font-bold text-muted-foreground shadow-sm">
                              {idx + 1}
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-medium text-muted-foreground px-1">引导问句</Label>
                              <textarea 
                                value={step.question}
                                onChange={(e) => handleUpdateStep(group.id, step.id, { question: e.target.value })}
                                placeholder="输入释放引导语..."
                                className="w-full min-h-[60px] p-2 text-sm bg-background border-border/20 rounded-lg focus:ring-1 focus:ring-primary/20 outline-none resize-none"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-[10px] font-medium text-primary ml-1">顺着主线 (正面回答)</Label>
                                <Input 
                                  value={step.positive}
                                  onChange={(e) => handleUpdateStep(group.id, step.id, { positive: e.target.value })}
                                  className="h-8 text-xs bg-primary/5 border-primary/20 rounded-md"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] font-medium text-muted-foreground ml-1">分支触发 (反面回答)</Label>
                                <Input 
                                  value={step.negative}
                                  onChange={(e) => handleUpdateStep(group.id, step.id, { negative: e.target.value })}
                                  className="h-8 text-xs bg-background/50 border-border/20 rounded-md"
                                />
                              </div>
                            </div>
                            
                            <div className="pt-2 border-t border-border/20">
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-[10px] font-medium text-muted-foreground">当选择【反面回答】时，增加中间一步</Label>
                                <Switch 
                                  checked={!!step.hasBranch}
                                  onCheckedChange={(checked) => handleUpdateStep(group.id, step.id, { hasBranch: checked, branchQuestion: checked ? (step.branchQuestion || '你想补充什么吗？') : undefined })}
                                  className="scale-75 origin-right"
                                />
                              </div>
                              {step.hasBranch && (
                                <div className="space-y-1.5 mt-2 p-2 bg-background border border-border/30 rounded-lg">
                                  <Label className="text-[10px] font-medium text-accent px-1">中间过渡问句 (回答后将回归主线)</Label>
                                  <textarea 
                                    value={step.branchQuestion || ''}
                                    onChange={(e) => handleUpdateStep(group.id, step.id, { branchQuestion: e.target.value })}
                                    placeholder="输入中间步骤的问句..."
                                    className="w-full min-h-[40px] p-2 text-xs bg-background/50 border-border/20 rounded-md focus:ring-1 focus:ring-accent/20 outline-none resize-none"
                                  />
                                </div>
                              )}
                            </div>

                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="absolute -right-2 -top-2 h-7 w-7 bg-background shadow-sm border border-border/20 rounded-full text-destructive/50 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteStep(group.id, step.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full h-9 border-dashed border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5"
                        onClick={() => handleAddStep(group.id)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        添加一步
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {(!settings.questionGroups || settings.questionGroups.length === 0) && (
              <div className="py-4 text-center border border-dashed rounded-xl border-border/40">
                <p className="text-xs text-muted-foreground">暂无自定义问句组</p>
              </div>
            )}
          </div>

          {/* 模块绑定配置 */}
          <div className="space-y-4 pt-4 border-t border-border/10">
            <Label className="text-sm font-semibold px-1">功能板块关联</Label>
            <div className="grid gap-3">
              {modules.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-4 p-3 bg-muted/20 border border-border/20 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-xs font-medium">{m.title}</span>
                  </div>
                  <Select 
                    value={settings.moduleAssignments?.[m.id as keyof AppSettings['moduleAssignments']] || 'default'} 
                    onValueChange={(v) => handleModuleBind(m.id, v)}
                  >
                    <SelectTrigger className="w-40 h-8 text-xs bg-background/40 border-border/30 rounded-lg text-left px-2">
                      <div className="truncate">
                        {settings.moduleAssignments?.[m.id as keyof AppSettings['moduleAssignments']] 
                          ? (settings.questionGroups?.find(g => g.id === settings.moduleAssignments?.[m.id as keyof AppSettings['moduleAssignments']])?.name || '内置默认')
                          : '内置默认'
                        }
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default" className="text-xs italic">内置默认</SelectItem>
                      {(settings.questionGroups || []).map(g => (
                        <SelectItem key={g.id} value={g.id} className="text-xs">{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
            </CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>

      {/* 释放交互个性化 */}
      <AccordionItem value="experience" className="border-none">
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl rounded-2xl overflow-hidden">
          <AccordionTrigger className="hover:no-underline py-0">
            <CardHeader className="bg-accent/5 pb-4 w-full text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-accent/10">
                  <CheckCircle2 className="w-5 h-5 text-accent" />
                </div>
                <CardTitle className="text-lg font-serif">释放交互个性化</CardTitle>
              </div>
              <CardDescription>配置释放过程中的个性化行为与偏好。</CardDescription>
            </CardHeader>
          </AccordionTrigger>
          <AccordionContent>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/30">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">释放后自动标注</Label>
                  <p className="text-[10px] text-muted-foreground">完成单句释放流程后，自动将其在列表中标记为“已释放”</p>
                </div>
                <Switch 
                  checked={settings.autoMarkReleased !== false} 
                  onCheckedChange={(checked) => updateSettings({ ...settings, autoMarkReleased: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/30">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">语音输入</Label>
                  <p className="text-[10px] text-muted-foreground">开启后在各输入框显示录音图标</p>
                </div>
                <Switch 
                  checked={settings.enableVoiceInput} 
                  onCheckedChange={(checked) => updateSettings({ ...settings, enableVoiceInput: checked })}
                />
              </div>
            </CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>

      {/* 主题选择 */}
      <AccordionItem value="theme" className="border-none">
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-xl rounded-2xl overflow-hidden">
          <AccordionTrigger className="hover:no-underline py-0">
            <CardHeader className="bg-accent/5 pb-4 w-full text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-accent/10">
                  <Leaf className="w-5 h-5 text-accent" />
                </div>
                <CardTitle className="text-lg font-serif">主题风格</CardTitle>
              </div>
              <CardDescription>个性化您的应用外观。</CardDescription>
            </CardHeader>
          </AccordionTrigger>
          <AccordionContent>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => updateSettings({ ...settings, theme: 'light' })}
                  className={`p-4 rounded-xl border-2 transition-all text-center space-y-2 ${settings.theme === 'light' ? 'border-primary bg-primary/5' : 'border-border/30 hover:border-primary/20'}`}
                >
                  <div className="w-full h-12 bg-white rounded-md border border-border/20 shadow-sm flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  </div>
                  <span className="text-xs font-medium">明亮模式</span>
                </button>
                <button
                  onClick={() => updateSettings({ ...settings, theme: 'dark' })}
                  className={`p-4 rounded-xl border-2 transition-all text-center space-y-2 ${settings.theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border/30 hover:border-primary/20'}`}
                >
                  <div className="w-full h-12 bg-[#0a0a0a] rounded-md border border-white/10 shadow-sm flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                  </div>
                  <span className="text-xs font-medium">深邃模式</span>
                </button>
              </div>
            </CardContent>
          </AccordionContent>
        </Card>
      </AccordionItem>
    </Accordion>

      {/* 提示保存成功 */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm pointer-events-none z-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            配置已自动保存
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
