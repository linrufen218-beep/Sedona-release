const WORKER_URL = 'https://fc-mp-31707de5-7305-41e5-aeee-60eee477448d.next.bspapp.com/rufen';
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

async function postToWorker(body: any) {
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
      throw new Error('Network request failed before reaching the worker.');
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
    1. 【绝对禁止重写原句】："原始句子"字段必须100%直接使用输入文本中的原句，绝对禁止对原句进行任何改写、扩展、解释、概括或重述。保持原句的原始表达方式，包括标点符号和语气。
    2. 【语义合并分析】：如果多个句子表达相同的意思或描述同一件事情，请将它们合并为一项进行分析。不要机械地按标点分割，而是根据语义内容进行合并。
    3. 【关键：叙事者视角】：用户是叙事的"我"。文中描述"别人做了某事"时，拆出来的句子必须保留"别人"这个主语，不能把别人的行为写成用户自己的行为。分析的对象始终是"用户面对这些事时内心的想要"，而不是"用户做了什么事"。
    4. 深度剖析：挖掘每项背后用户自身的底层想要（想要被认可、想要控制、想要安全），揭示这些动力的运作方式。
    5. "想要"仅限 [approval, control, security]。
    6. 每项的解析（a）应约30-50字，直击核心。
    7. 分析总结（ana）：对整体进行深度提炼，约50字。

    重要提醒："原始句子"字段必须完全复制输入文本中的句子，不要添加任何内容，不要修改任何词语，不要改变表达方式。

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
  const prompt = `你是一位精通圣多纳释放法的引导者。
 任务：深度剖析以下文本片段，拆解出具体的、可以用一句话概括的痛点事件。
 
 输入文本内容：${text}
 
 Logic (具象化释放逻辑 - 必须将每个事件单独处理，逐层释放):
 
 请先识别文本中的"具体事件/感受"，然后用该事件的"一句话概括"来替换下面模板中的[这件事/这个感受]部分。
 
 针对每一个事件，按顺序生成以下5层问句：
 (注意：下面模板中的[这件事/这个感受]是一个占位符，你必须将其替换为用户原文中提炼出的、极其具体的描述)
 
 1. 允许正反面 (共2句)：
    - 第1句："你能允许[这件事]发生吗？"
        (例如："你能允许他把网址要回去这件事发生吗？")
    - 第2句："你能允许[这件事]不发生吗？"
        (例如："你能允许他不把网址要回去吗？")
    *若事件纯粹是一种感受，则用："你能允许[这个感受]存在吗？/ 你能允许[这个感受]消失吗？"*
 
 2. 放下执着 (1句)：
    直接点出对这件事的内在反应，并引导放下：
    "你能放下对[这件事]的抗拒吗？"
    *如果文本更偏向抓取，则用："你能放下对[这件事]的执着吗？"*
 
 3. 放下深层动机 (1句)：
    指出这件事暴露出的匮乏，并把需求和具体事件绑定，这样更有抓手：
    "你能放下希望通过[这件事]来获得控制/认可/安全的需要吗？"
    (例如："你能放下希望通过得到网址，来获得安全感的渴望吗？")
 
 4. 对立融合 (1句)：
    把抽象概念转为具体的、关于过去与未来的表达：
    "你能允许[这件事]是现在这个样子，同时你又能有一个新的开始吗？"
 
 5. 终极放下 (1句)：
    "关于[这件事]，你能完全把它放下吗？"
 
 要求：
 - 只要片段中有多个独立事件，就必须逐个拆解循环产出上述5层问句链。
 - 每个问句都必须清晰、具体，让用户一听就知道在说什么事，杜绝凭空出现的"它"。
 - 输出纯JSON，格式如下，不添加任何解释：
 
 {
   "list": [
     {
       "s": "你能允许[具体的这件事]发生吗？",
       "w": ["control"],
       "phase": "允许正反面-发生"
     },
     {
       "s": "你能允许[具体的这件事]不发生吗？",
       "w": ["control"],
       "phase": "允许正反面-不发生"
     },
     {
       "s": "你能放下对[具体的这件事]的抗拒吗？",
       "w": ["control"],
       "phase": "放下执着"
     },
     {
       "s": "你能放下希望通过[具体的这件事]来获得认可的渴望吗？",
       "w": ["approval"],
       "phase": "放下深层动机"
     },
     {
       "s": "你能允许[具体的这件事]是现在这个样子，同时你又能有一个新的开始吗？",
       "w": ["security"],
       "phase": "对立融合"
     },
     {
       "s": "关于[具体的这件事]，你能完全把它放下吗？",
       "w": ["security"],
       "phase": "终极放下"
     }
   ]
 }
 (为每个识别出的具体事件，循环以上JSON结构)
 `;

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
