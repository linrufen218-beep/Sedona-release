const WORKER_URL = 'https://fc-mp-31707de5-7305-41e5-aeee-60eee477448d.next.bspapp.com/rufen';
const LOCAL_PROXY_URL = '/api/ai-proxy';
type AIOptions = {
  model_type?: string;
  invite_code?: string;
  aiBaseUrl?: string;
  aiApiKey?: string;
  aiModelName?: string;
};

function isSiliconFlowUrl(url: string) {
  return /siliconflow\.cn/i.test(url);
}

function normalizeOpenAIUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/$/, '');
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/chat/completions`;
}

function resolveSiliconFlowModel(modelName?: string, selectedModel?: string) {
  const normalizedModel = modelName?.trim();
  if (normalizedModel) return normalizedModel;

  if (selectedModel === 'DEEPSEEK32') {
    return 'deepseek-ai/DeepSeek-V3';
  }

  if (selectedModel === 'MINIMAX25') {
    throw new Error(
      'SiliconFlow custom config is missing a real model name. MINIMAX25 is only an internal UI alias, not a SiliconFlow model id. Please fill in the exact model name in Settings.'
    );
  }

  return 'deepseek-ai/DeepSeek-V3';
}

function buildWorkerRequestBody(prompt: string, options?: AIOptions) {
  const hasCustomConfig = !!(options?.aiBaseUrl || options?.aiApiKey || options?.aiModelName);

  if (!hasCustomConfig) {
    return {
      text: prompt,
      platform: 'SILICONFLOW',
      model: options?.model_type || 'DEEPSEEK32',
      model_type: options?.model_type || 'DEEPSEEK32',
      invite_code: options?.invite_code || '',
      max_tokens: 8192,
      stream: false,
    };
  }

  const normalizedBaseUrl = options?.aiBaseUrl ? normalizeOpenAIUrl(options.aiBaseUrl) : '';
  const resolvedModel = options?.aiBaseUrl && isSiliconFlowUrl(options.aiBaseUrl)
    ? resolveSiliconFlowModel(options?.aiModelName, options?.model_type)
    : (options?.aiModelName || options?.model_type || 'gpt-3.5-turbo');

  return {
    text: prompt,
    platform: 'CUSTOM_OPENAI',
    model: resolvedModel,
    model_type: options?.model_type || resolvedModel,
    invite_code: options?.invite_code || '',
    max_tokens: 8192,
    stream: false,
    aiBaseUrl: normalizedBaseUrl,
    aiApiKey: options?.aiApiKey || '',
    aiModelName: resolvedModel,
  };
}

function shouldUseLocalProxy() {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

async function postToWorker(body: any) {
  if (shouldUseLocalProxy()) {
    return fetch(LOCAL_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: WORKER_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      }),
    });
  }

  return fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function safeJSONParse(text: string) {
  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch (e) {
    // 尝试从 markdown 代码块中提取
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let targetText = text;
    if (jsonMatch && jsonMatch[1]) {
      targetText = jsonMatch[1];
      try {
        return JSON.parse(targetText);
      } catch (e2) {}
    }

    // 尝试截取第一个 { 到最后一个 } 之间的内容
    const firstBrace = targetText.indexOf('{');
    const firstBracket = targetText.indexOf('[');
    
    let startIdx = firstBrace;
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      startIdx = firstBracket;
    }

    if (startIdx !== -1) {
      const isArray = targetText[startIdx] === '[';
      const endChar = isArray ? ']' : '}';
      const jsonCandidate = targetText.substring(startIdx);
      const lastIdx = jsonCandidate.lastIndexOf(endChar);
      if (lastIdx !== -1) {
        try {
          const full = JSON.parse(jsonCandidate.substring(0, lastIdx + 1));
          return full;
        } catch (e3) {}
      }
    }

    console.error('Failed to parse JSON string:', text);
    throw new Error('无法解析 AI 返回的 JSON 数据。');
  }
}

function splitIntoChunks(text: string, maxLength: number): string[] {
  const sentences = text.match(/[^。！？.!?\n]+[。！？.!?\n]*/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

export async function callAI(
  prompt: string,
  onProgress?: (text: string) => void,
  options?: AIOptions
) {
  if (!WORKER_URL.trim()) {
    throw new Error('WORKER_URL is not configured.');
  }

  const body = buildWorkerRequestBody(prompt, options);

  try {
    const response = await postToWorker(body);

    if (!response.ok) {
      throw await handleError(response);
    }

    const result = (await response.json()) as any;
    const content = result.choices?.[0]?.message?.content || result.content || result.text || result.data || result.answer || (typeof result === 'string' ? result : JSON.stringify(result));

    console.log('[API Raw Result]:', result);
    console.log('[Extracted Content]:', content);

    if (onProgress) onProgress(content);
    return content;
  } catch (err: any) {
    console.error('[API Error]', err);
    if (err instanceof TypeError) {
      throw new Error('Network request failed before reaching the worker. If you are on localhost, make sure the dev server is running so /api/ai-proxy can forward to rufen.');
    }
    throw err;
  }
}

async function handleError(response: Response) {
  let errorDetail = '';
  try {
    const errorJson = (await response.json()) as any;
    if (typeof errorJson.error === 'string') {
      errorDetail = errorJson.error;
    } else if (typeof errorJson.error?.message === 'string') {
      errorDetail = errorJson.error.message;
    } else if (typeof errorJson.message === 'string') {
      errorDetail = errorJson.message;
    } else {
      errorDetail = JSON.stringify(errorJson);
    }
  } catch (e) {
    try {
      errorDetail = await response.text();
    } catch (e2) {}
  }

  if (response.status === 403) {
    return new Error(`邀请码错误: 请前往设置检查暗号是否正确 (${response.status})`);
  } else if (response.status === 400) {
    return new Error(`配置错误: ${errorDetail} (${response.status})`);
  } else if (response.status === 401) {
    return new Error(`鉴权失败: API Key 无效 (${response.status})`);
  } else if (response.status === 404) {
    return new Error(`Endpoint not found: check whether Base URL should end at /v1 and avoid duplicating /chat/completions. (${response.status}) ${errorDetail}`);
  }

  return new Error(`服务器连接失败 (${response.status}): ${errorDetail || '未知错误'}`);
}

export async function analyzeReleaseText(
  text: string,
  onProgress?: (data: any) => void,
  options?: { model_type?: string; invite_code?: string; aiBaseUrl?: string; aiApiKey?: string; aiModelName?: string }
) {
  const prompt = `导师指令：分析文本并拆分为释放清单。
    输入：${text}
    要求：
    1. 【极致覆盖】：必须处理输入文本的所有核心要点。即使文本较长，也要确保识别出其中每一个独立的情绪触发点或事件，不要随意合并或省略，如果是多句话，请逐句深度拆解，务必保证释放的全面性。
    2. 【关键：叙事者视角】：用户是叙事的"我"。文中描述"别人做了某事"时，拆出来的句子必须保留"别人"这个主语，不能把别人的行为写成用户自己的行为。分析的对象始终是"用户面对这些事时内心的想要"，而不是"用户做了什么事"。例如原文"室友熬夜外放"，原始句子应写成"室友熬夜外放打游戏吵到我"，分析应为"渴望安静环境被尊重却得不到，触发想要控制的念头"——绝对不能写成"自己做错了什么"。
    3. 深度剖析：挖掘每项背后用户自身的底层想要（想要被认可、想要控制、想要安全），揭示这些动力的运作方式。
    4. "想要"仅限 [approval, control, security]。
    5. 每项的解析（a）应约30-50字，直击核心。
    6. 分析总结（ana）：对整体进行深度提炼，约50字。

    输出必须是纯JSON格式：
    {
      "list": [
        { "s": "原始句子", "w": ["approval"], "a": "潜意识挖掘分析", "phase": "主题切入点" }
      ],
      "ana": "分析总结内容"
    }`;

  try {
    const responseText = await callAI(prompt, undefined, options);
    const result = safeJSONParse(responseText || '');
    if (onProgress) onProgress(result);
    return result;
  } catch (err: any) {
    console.error('Analysis failed:', err.message);
    throw err;
  }
}

export async function analyzeAIGen(
  text: string,
  onProgress?: (data: any) => void,
  options?: { model_type?: string; invite_code?: string; aiBaseUrl?: string; aiApiKey?: string; aiModelName?: string }
) {
  const prompt = `你是一位精通圣多纳释放法与显化法则的教练。
    任务：深度剖析以下文本片段，像剥洋葱一样拆解痛点。

    输入文本内容：${text}

    Logic (全息释放逻辑 - 针对该片段识别出的具体事件/情况，都需执行以下5层结构):
    1. 针对事件正反面的允许 (生成3-4句)：【绝对不要点出具体情绪，而是重点释放在事件/情况本身】。生成允许该情况存在、以及允许其反面情况存在的问句。例如："你允许别人忽视你吗？"、"你允许别人不忽视你吗？"。带到情绪时只说"你允许这种感觉存在吗？"。
    2. 清理执着面 (生成1句)：引导察觉对当前事件"想要改变它"或"推开它"的渴求。
    3. 挖掘深层动机 (生成1句)：指出隐藏的匮乏需求（想要控制、认同或安全），引导放下。
    4. 对立融合 (生成1句)：允许事件发生与不发生并存，察觉都是能量。
    5. 终极释放与存在 (生成1句)："你能把它放下吗？"终极清理。

    要求：
    1. 【极致全面】：只要该片段有多个层面或多个句子，就必须逐个痛点/句子循环产出上述问句！把文中提到的每一个核心矛盾/具体事件细细拆解，为它们分别生成连续深入的上述释放问句链。不限数量，务必把片段内的事件放干净，不要省略！
    2. 【极度简明短促】：每句问句必须非常短。只要纯JSON，不输出多余废话。
    3. 【克制的引用】：直接使用用户的词汇描述事件，不乱加情绪形容词。

    输出必须是纯JSON格式：
    {
      "list": [
        {
          "s": "生成的具体释放问句内容",
          "w": ["control", "approval", "security"],
          "phase": "主题切入点 - 步骤名称"
        }
      ]
    }`;

  try {
    const responseText = await callAI(prompt, undefined, options);
    const result = safeJSONParse(responseText || '');
    if (onProgress) onProgress(result);
    return result;
  } catch (err: any) {
    console.error('AI Generation failed:', err.message);
    throw err;
  }
}

export async function generateCustomAreaQuestions(
  topic: string,
  onProgress?: (data: any) => void,
  options?: { model_type?: string; invite_code?: string; aiBaseUrl?: string; aiApiKey?: string; aiModelName?: string }
) {
  const prompt = `导师指令：根据用户输入的"领域/主题"，生成一套专属该领域的深层释放问句。
    输入主题：${topic}

    任务：
    请为这个特定领域生成 6-8 个针对性的圣多纳释放问句。

    要求：
    1. 前2个问句：挖掘并面对该领域里的负面抗拒（例如：关于${topic}你最抗拒/害怕的方面？到现在你的感觉是什么？）
    2. 接下来2-3句：挖掘该领域背后的底层想要（极力探讨这段关系/这件事跟"想要控制"、"想要被认同"、"想要安全"有什么关联？你的感觉是什么？）
    3. 接下来1-2句：极端的想象（如果是最坏结局/如果已经非常完美，你现在的感觉是什么？）
    4. 最后1句：包容与允许（你能允许当前对${topic}的一切现状吗？）

    极度重要：句式尽量结尾带上"我现在对它的感觉是什么？"或"你现在对此的感觉是什么？"，直接针对事件对象。
    请直接返回一个字符串数组的JSON！不要有多余的解析和寒暄！

    输出纯JSON:
    {
      "questions": [
        "问句内容1",
        "问句内容2"
      ]
    }`;

  const responseText = await callAI(prompt, undefined, options);
  const result = safeJSONParse(responseText || '');
  return result?.questions || [];
}

export async function analyzeAreaAnswers(
  area: string,
  questions: string[],
  answers: string[],
  onProgress?: (data: any) => void,
  options?: { model_type?: string; invite_code?: string; history?: any[]; aiBaseUrl?: string; aiApiKey?: string; aiModelName?: string }
) {
  const answeredIndices = answers.map((a, i) => (a.trim() ? i : -1)).filter(i => i !== -1);
  const answeredQuestions = answeredIndices.map(i => questions[i]);
  const answeredAnswers = answeredIndices.map(i => answers[i]);

  const historyContext =
    options?.history && options.history.length > 0
      ? `\n历史解析背景（仅供参考，请结合这些历史洞见进行更深一层的进阶挖掘）：\n${options.history
          .map(h => `[轮次:${h.round || 1}] 问:${h.q} 答:${h.ans} 解析:${h.a}`)
          .join('\n')}`
      : '';

  const prompt = `导师指令：深度分析"${area}"
    ${historyContext}

    本次新的回答对照：
    ${answeredQuestions.map((q, i) => `Q:${q}\nA:${answeredAnswers[i]}`).join('\n')}

    要求：
    若回答较为冗长或重复，请提炼并合并，以提高分析效率。
    分析焦点：挖掘每个回答背后用户自身隐藏的底层想要（想要被认可、想要控制、想要安全），揭示这些想要如何驱动了当前的回应。若回答中描述了"别人的行为"，分析对象始终是用户面对这些行为时的内在想要，绝不能把别人的行为归到用户身上。同时，如果提供了历史背景，请务必在原有解析基础上进行"进阶"挖掘，不要只是重复。
    "想要"仅限 [approval, control, security]。
    每个回答的s字段必须保留用户原始答句（直接引用，不要改写）。每个回答的解析（a）应约30-50字。
    分析总结（sum）：结合整体回答以及历史挖掘背景，对底层想要进行深度总结，约50字。

    输出必须是纯JSON格式：
    {
      "list": [
        { "q": "对应的问题内容", "s": "直接引用用户的原始答句", "w": ["approval"], "a": "潜意识想要深度分析（30-50字）" }
      ],
      "w": ["核心想要"],
      "sum": "分析总结内容"
    }`;

  const responseText = await callAI(prompt, undefined, options);
  const result = safeJSONParse(responseText || '');
  if (onProgress) onProgress(result);
  return result;
}

export async function generateDeepExploreQuestions(
  area: string,
  previousQA: { q: string; a: string; analysis?: string; wants?: string[] }[],
  round: number,
  onProgress?: (data: any) => void,
  options?: { model_type?: string; invite_code?: string; aiBaseUrl?: string; aiApiKey?: string; aiModelName?: string }
) {
  const qaText = previousQA.map((item, i) => 
    `Q${i + 1}: ${item.q}\nA${i + 1}: ${item.a || '(未回答)'}\n解析${i + 1}: ${item.analysis || '(无)'}`
  ).join('\n\n');

  const prompt = `导师指令：根据用户第${round - 1}轮的问答记录，生成第${round}轮更深入的释放问句。
    领域：${area}
    这是第${round}轮深度探索。

    上一轮问答记录：
    ${qaText}

    任务：
    请基于上一轮的回答和解析，生成6-8个更具穿透力的圣多纳释放问句。新问句应该比上一轮更深一层——不再停留在表面，而是直击问题背后的核心无意识模式。

    要求：
    1. 递进挖掘：基于上一轮的底层想要分析，针对性地生成更深的问题。例如如果上一轮发现了"想要控制"的模式，本轮就要问这个控制欲的根源。
    2. 不拘泥于原问题：可以重新组织语言，用更尖锐的角度切入。
    3. 句式简练短促：每句约15-30字。
    4. 结尾尽量带上"我现在对它的感觉是什么？"或"你对这的感觉是什么？"
    5. 覆盖全面：同时涵盖恐惧面、贪恋面和允许面。

    请直接返回一个字符串数组的JSON！

    输出纯JSON:
    {
      "questions": [
        "问句内容1",
        "问句内容2"
      ]
    }`;

  const responseText = await callAI(prompt, undefined, options);
  const result = safeJSONParse(responseText || '');
  return result?.questions || [];
}

export async function analyzeEmotions(
  text: string,
  onProgress?: (data: any) => void,
  options?: { model_type?: string; invite_code?: string; aiBaseUrl?: string; aiApiKey?: string; aiModelName?: string }
) {
  const prompt = `导师指令：分析情绪类别与根源想要。
    输入：${text}
    类别：[万念俱灰, 悲苦, 恐惧, 贪求, 愤怒, 自尊自傲, 无畏, 接纳, 平和]
    要求：
    1. 深度分析背后的心理动机和想要，控制在50字左右。

    输出必须是纯JSON格式：
    {
      "emo": ["具体情绪"],
      "cat": ["情绪类别"],
      "ana": "底层想要与根源分析"
    }`;

  const responseText = await callAI(prompt, undefined, options);
  const result = safeJSONParse(responseText || '');
  if (onProgress) onProgress(result);
  return result;
}
