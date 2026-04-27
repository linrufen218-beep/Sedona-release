import re

with open('src/components/AreaRelease.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

original = content

# 1. Add step type 'deep_questions'
content = content.replace(
    "useState<'list' | 'area_history' | 'questions' | 'analysis' | 'release' | 'history'>",
    "useState<'list' | 'area_history' | 'questions' | 'deep_questions' | 'analysis' | 'release' | 'history'>"
)

# 2. Add new state variables after isDeepExploring
if 'deepExploreProjectId' not in content:
    content = content.replace(
        'const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);',
        '''const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [deepExploreProjectId, setDeepExploreProjectId] = useState<string | null>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.deepExploreProjectId || null);
  const [deepExploreRound, setDeepExploreRound] = useState<number>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.deepExploreRound || 0);
  const [deepExploreQuestions, setDeepExploreQuestions] = useState<string[]>(() => getComponentState(STORAGE_KEYS.AREA_STATE)?.deepExploreQuestions || []);
  const [isDeepExploring, setIsDeepExploring] = useState(false);
  const [swipedCardId, setSwipedCardId] = useState<string | null>(null);
  const swipeStartX = useRef(0);
  const swipeCurrentX = useRef(0);'''
    )

# 3. Save auto-exit
content = content.replace(
    'setIsCustomAreaDialogOpen(false);\n    setTimeout(() => {',
    'setIsCustomAreaDialogOpen(false);\n    setIsEditMode(false);\n    setTimeout(() => {'
)

# 4. Add deep explore state vars to saveComponentState
old_save = 'sixStepIndex,\n      currentSession\n    });\n  }, [selectedArea, answers, analysis, step, releaseIndex, releasedIndices, skippedIndices, sixStepIndex, currentSession]);'
new_save = '''sixStepIndex,
      currentSession,
      deepExploreProjectId,
      deepExploreRound,
      deepExploreQuestions
    });
  }, [selectedArea, answers, analysis, step, releaseIndex, releasedIndices, skippedIndices, sixStepIndex, currentSession, deepExploreProjectId, deepExploreRound, deepExploreQuestions]);'''
content = content.replace(old_save, new_save)

# 5. Modify toggleAreaReleased to clear swipedCardId
content = content.replace(
    ');\n  };',
    ');\n    setSwipedCardId(null);\n  };'
)

# 5b. Add swipe handlers after toggleAreaReleased
old_toggle = '  const allAreas = [...AREAS, ...customAreas];'
new_swipe = '''
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

  const allAreas = [...AREAS, ...customAreas];'''
content = content.replace(old_toggle, new_swipe)

# 6. Modify handleDeepExplore
if 'const handleDeepExplore = async (session?: AreaSession) => {' not in content:
    # Read existing handleDeepExplore... wait, it doesn't exist in the original!
    # We need to ADD it
    
    # 7. Modify startNewAnalysis
    content = content.replace(
        "setAnswers(new Array(selectedArea.questions.length).fill(''));\n    setStep('questions');\n    setCurrentSession(null);\n  };",
        "setDeepExploreProjectId(null);\n    setDeepExploreRound(0);\n    setDeepExploreQuestions([]);\n    setAnswers(new Array(selectedArea.questions.length).fill(''));\n    setStep('questions');\n    setCurrentSession(null);\n  };"
    )
    
    # 8. Modify loadSession to preserve deep explore
    content = content.replace(
        "setStep('analysis');\n  };",
        "setStep('analysis');\n    if (session.projectId) {\n      setDeepExploreProjectId(session.projectId);\n      setDeepExploreRound(session.round || 1);\n    }\n  };"
    )
    
    # 9. Modify handleAnalyze to add projectId/round
    content = content.replace(
        "setAnalysis(result);\n      \n      // Create new area session",
        '''setAnalysis(result);
      
      // Generate projectId for the first round of deep exploration
      const projectId = crypto.randomUUID();
      setDeepExploreProjectId(projectId);
      setDeepExploreRound(1);
      
      // Create new area session'''
    )
    content = content.replace(
        "name: `${selectedArea.title} 领域释放`,\n        list: result.list,\n        sum: result.sum\n      });",
    '''name: `${selectedArea.title} 领域释放`,
        list: result.list,
        sum: result.sum,
        projectId,
        round: 1
      });'''
    )
    
    # 10. Add handleDeepExplore and handleDeepExploreFromLatest after handleAnalyze's closing }
    # Find:  };  \n\n  const startRelease
    old_start = "  };\n\n  const startRelease = (index: number, mode: 'sequential' | 'single') => {"
    new_deep = '''  };

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

  const startRelease = (index: number, mode: 'sequential' | 'single') => {'''
    content = content.replace(old_start, new_deep)
    
    # 11. Modify reset
    content = content.replace(
        "setCurrentSession(null);\n  };\n\n  return (",
        "setCurrentSession(null);\n    setDeepExploreProjectId(null);\n    setDeepExploreRound(0);\n    setDeepExploreQuestions([]);\n  };\n\n  return ("
    )

# 12. Modify answer display: item.ans before item.s
content = content.replace(
    '"item.s || item.ans ||',
    '"item.ans || item.s ||'
)

# 13. Fix long press dialog text: 标记为已释放 -> 标记为已完成
content = content.replace('标记为已释放', '标记为已完成')
content = content.replace('撤销已释放标记', '撤销已完成标记')
content = content.replace('已释放', '已完成')

# 14. Add deep_questions UI step after the questions UI step
content = content.replace(
    "{step === 'questions' && (",
    "{step === 'deep_questions' && (\n          <motion.div key=\"deep_questions\" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className=\"space-y-4 md:space-y-6 px-1\">\n            <Card className=\"border-none shadow-xl bg-card/80 backdrop-blur-md\">\n              <CardHeader className=\"text-center relative py-4 px-3\">\n                <Button \n                  variant=\"ghost\" \n                  size=\"icon\" \n                  className=\"absolute left-1 top-2 md:left-2 rounded-full h-8 w-8\"\n                  onClick={() => setStep('analysis')}\n                >\n                  <ChevronLeft className=\"w-4 h-4 md:w-5 md:h-5\" />\n                </Button>\n                <div className=\"pt-2\">\n                  <Badge variant=\"outline\" className=\"w-fit mx-auto mb-1 border-accent text-accent text-[8px] md:text-[10px] py-0\">\n                    {selectedArea.title}领域 · 第{deepExploreRound}轮深度探索\n                  </Badge>\n                  <CardTitle className=\"font-serif text-lg md:text-2xl\">请回答以下深入问句</CardTitle>\n                  <CardDescription className=\"text-[9px] md:text-xs\">基于上一轮的解析，AI 生成了更深入的问题。</CardDescription>\n                </div>\n              </CardHeader>\n              <CardContent className=\"px-3 md:px-6 pb-6\">\n                <ScrollArea className=\"h-[400px] md:h-[500px] pr-2 md:pr-4\">\n                  <div className=\"space-y-6 py-2\">\n                    {deepExploreQuestions.map((q: string, i: number) => (\n                      <div key={i} className=\"space-y-2 relative\">\n                        <label className=\"text-[11px] md:text-xs font-medium text-foreground/80 leading-relaxed block\">{i + 1}. {q}</label>\n                        <div className=\"relative\">\n                          <Input \n                            value={answers[i] || ''}\n                            onChange={(e) => {\n                              const newAnswers = [...answers];\n                              newAnswers[i] = e.target.value;\n                              setAnswers(newAnswers);\n                            }}\n                            placeholder=\"写下您的感受...\"\n                            className=\"h-10 md:h-12 bg-transparent border-border/30 focus-visible:ring-accent focus-visible:bg-background/10 text-sm pr-10 backdrop-blur-sm\"\n                          />\n                          {settings?.enableVoiceInput && (\n                            <div className=\"absolute right-1 top-1/2 -translate-y-1/2\">\n                              <VoiceInput size=\"sm\" onResult={(voiceText) => {\n                                const newAnswers = [...answers];\n                                newAnswers[i] = (newAnswers[i] || '') + voiceText;\n                                setAnswers(newAnswers);\n                              }} />\n                            </div>\n                          )}\n                        </div>\n                      </div>\n                    ))}\n                  </div>\n                </ScrollArea>\n                <div className=\"flex gap-4 mt-6\">\n                  <Button className=\"flex-1 h-12 bg-primary hover:bg-accent text-primary-foreground text-sm\" onClick={handleDeepAnalyze} disabled={isAnalyzing}>\n                    {isAnalyzing ? <Loader2 className=\"animate-spin mr-2 h-4 w-4\" /> : <RefreshCcw className=\"mr-2 w-4 h-4\" />}\n                    开始释放\n                  </Button>\n                </div>\n              </CardContent>\n            </Card>\n          </motion.div>\n        )}\n\n        {step === 'questions' && ("
)

# 15. Modify analysis bottom buttons: add green "继续深入"
old_buttons = '清空并退出\n                  </Button>\n                  <Button variant="secondary" className="flex-1 h-11 md:h-12 border-accent/30 hover:bg-accent/10 text-xs md:text-sm" onClick={handleManualSave}>\n                    <Save className="w-4 h-4 mr-2" /> 手动保存\n                  </Button>'
new_buttons = '''继续深入
                  </Button>
                  <Button variant="secondary" className="flex-1 h-11 md:h-12 border-primary/30 hover:bg-primary/5 text-xs md:text-sm" onClick={handleManualSave}>
                    <Save className="w-4 h-4 mr-2" /> 手动保存
                  </Button>
                  <Button 
                    className="flex-1 h-11 md:h-12 bg-primary hover:bg-accent text-primary-foreground text-xs md:text-sm font-bold shadow-md" 
                    onClick={() => handleDeepExplore()}
                    disabled={isDeepExploring}
                    title="基于本轮回答，AI 生成更深入的释放问句"
                  >
                    {isDeepExploring ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Target className="w-4 h-4 mr-2" />} 继续深入
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
                  </Button>'''
content = content.replace(old_buttons, new_buttons)

# 16. Modify area_history card: dual buttons
old_card = '''<Card className="border-none bg-accent/5 shadow-inner">
              <CardContent className="p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <Zap className="w-8 h-8 text-accent animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif text-lg font-bold">新解析探索</h3>
                  <p className="text-xs text-muted-foreground">通过一系列引导问句，深入解析当前在 {selectedArea.title} 方面的想要。</p>
                </div>
                <Button className="w-full h-12 bg-accent hover:bg-accent/80 text-white rounded-xl shadow-lg gap-2" onClick={startNewAnalysis}>
                  <Plus className="w-5 h-5" /> 开启深度探索
                </Button>
              </CardContent>
            </Card>'''

new_card = '''<Card className="border-none bg-accent/5 shadow-inner">
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
            </Card>'''
content = content.replace(old_card, new_card)

# 17. Add floating edit button before the area_history closing </motion.div>
old_list_close = '            </div>\n          </motion.div>\n        )}\n\n        {step === \'area_history\''
new_list_close = '''            </div>\n\n            <Button\n              size="icon"\n              className={`fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full shadow-2xl transition-all duration-300 ${isEditMode ? 'bg-primary text-primary-foreground rotate-90' : 'bg-card/90 backdrop-blur-md border border-border/40 text-muted-foreground hover:text-primary'}`}\n              onClick={() => setIsEditMode(!isEditMode)}\n              title={isEditMode ? '完成编辑' : '编辑模块'}\n            >\n              <Settings2 className="w-5 h-5" />\n            </Button>\n          </motion.div>\n        )}\n\n        {step === \'area_history\''
content = content.replace(old_list_close, new_list_close)

# 18. Add swipe section to cards
# Replace card div wrapper to add swipe reveal
old_card_start = '<div key={area.id} className="relative overflow-hidden rounded-xl">\n                    <Card'
new_card_start = '''<div key={area.id} className="relative overflow-hidden rounded-xl">
                    {!isEditMode && swipedCardId === area.id && (
                      <div className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center z-0">
                        <Button
                          size="sm"
                          className={`h-full w-full rounded-xl text-xs font-bold ${releasedAreaIds.find(i => i.id === area.id) ? 'bg-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/30' : 'bg-success/90 hover:bg-success text-white'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAreaReleased(area.id, e);
                          }}
                        >
                          {releasedAreaIds.find(i => i.id === area.id) ? '取消' : '完成'}
                        </Button>
                      </div>
                    )}
                    <Card'''
content = content.replace(old_card_start, new_card_start)

# 19. Replace the Card className to add swipe transform
old_card_class = "className={`cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all border border-border/30 bg-card/45 backdrop-blur-sm group relative`}"
new_card_class = 'className={`cursor-pointer hover:shadow-2xl transition-all border border-border/30 bg-card/45 backdrop-blur-sm group relative ${!isEditMode && swipedCardId !== area.id ? \'hover:scale-[1.02]\' : \'\'}`}\n                      style={{\n                        transform: !isEditMode && swipedCardId === area.id ? \'translateX(-5rem)\' : \'translateX(0)\',\n                        transition: \'transform 0.2s ease\',\n                        position: \'relative\',\n                        zIndex: 10,\n                      }}'
content = content.replace(old_card_class, new_card_class)

# 20. Modify onPointerDown to track swipe
old_pointer_down = '''onPointerDown={(e) => {
                        isLongPressActive.current = false;
                        const timer = setTimeout(() => {'''
new_pointer_down = '''onPointerDown={(e) => {
                        if (isEditMode) return;
                        swipeStartX.current = e.clientX;
                        swipeCurrentX.current = e.clientX;
                        isLongPressActive.current = false;
                        const timer = setTimeout(() => {'''
content = content.replace(old_pointer_down, new_pointer_down)

# 21. Add onPointerMove and onPointerUp
old_pointer_up_before = "window.addEventListener('pointermove', clearTimer);\n                      }}\n                      onClick={(e) => {"
new_pointer_up_before = '''window.addEventListener('pointermove', clearTimer);
                      }}
                      onPointerMove={(e) => {
                        if (isEditMode || isLongPressActive.current) return;
                        handleSwipeMove(e.clientX);
                      }}
                      onPointerUp={(e) => {
                        if (isEditMode || isLongPressActive.current) return;
                        handleSwipeEnd(area.id);
                      }}
                      onClick={(e) => {'''
content = content.replace(old_pointer_up_before, new_pointer_up_before)

# 22. Modify onClick to handle swipe state
old_onclick = '''if (!isEditMode) {
                          startArea(area);
                        }'''
new_onclick = '''if (swipedCardId && swipedCardId !== area.id) {
                          setSwipedCardId(null);
                          return;
                        }
                        if (!isEditMode) {
                          startArea(area);
                        }'''
content = content.replace(old_onclick, new_onclick)

# 23. Fix "已完成" badge text
content = content.replace('animate-in fade-in zoom-in', '')

# 24. Add round badge to session display in area_history and history
content = content.replace(
    '<h4 className="font-serif font-bold text-sm truncate">{session.name}</h4>',
    '''<h4 className="font-serif font-bold text-sm truncate flex items-center gap-2">
                                      {session.name}
                                      {session.round && session.round > 1 && (
                                        <Badge variant="outline" className="text-[7px] h-4 px-1 border-accent/50 text-accent shrink-0">第{session.round}轮</Badge>
                                      )}
                                    </h4>'''
)

content = content.replace(
    '<h4 className="font-serif font-bold text-sm md:text-base mb-1 truncate">{session.name}</h4>',
    '''<h4 className="font-serif font-bold text-sm md:text-base mb-1 truncate flex items-center gap-2">
                                  {session.name}
                                  {session.round && session.round > 1 && (
                                    <Badge variant="outline" className="text-[7px] h-4 px-1 border-accent/50 text-accent shrink-0">第{session.round}轮</Badge>
                                  )}
                                </h4>'''
)

with open('src/components/AreaRelease.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

if content != original:
    print('MODIFIED AreaRelease.tsx successfully')
else:
    print('NO CHANGES MADE to AreaRelease.tsx!')
