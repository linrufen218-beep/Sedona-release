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
    // 灏濊瘯浠?markdown 浠ｇ爜鍧椾腑鎻愬彇
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let targetText = text;
    if (jsonMatch && jsonMatch[1]) {
      targetText = jsonMatch[1];
      try {
        return JSON.parse(targetText);
      } catch (e2) {}
    }

    // 灏濊瘯鎴彇绗竴涓?{ 鍒版渶鍚庝竴涓?} 涔嬮棿鐨勫唴瀹?    const firstBrace = targetText.indexOf('{');
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
    throw new Error('Unable to parse AI response JSON.');
  }
}

function splitIntoChunks(text: string, maxLength: number): string[] {
  const sentences = text.match(/[^銆傦紒锛?!?\n]+[銆傦紒锛?!?\n]*/g) || [text];
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
    return new Error(`閭€璇风爜閿欒: 璇峰墠寰€璁剧疆妫€鏌ユ殫鍙锋槸鍚︽纭?(${response.status})`);
  } else if (response.status === 400) {
    return new Error(`閰嶇疆閿欒: ${errorDetail} (${response.status})`);
  } else if (response.status === 401) {
    return new Error(`Authentication failed: invalid API Key (${response.status})`);
  } else if (response.status === 404) {
    return new Error(`Endpoint not found: check whether Base URL should end at /v1 and avoid duplicating /chat/completions. (${response.status}) ${errorDetail}`);
  }

  return new Error(`鏈嶅姟鍣ㄨ繛鎺ュけ璐?(${response.status}): ${errorDetail || '鏈煡閿欒'}`);
}

export async function analyzeReleaseText(
  text: string,
  onProgress?: (data: any) => void,
  options?: { model_type?: string; invite_code?: string; aiBaseUrl?: string; aiApiKey?: string; aiModelName?: string }
) {
  const prompt = `瀵煎笀鎸囦护锛氬垎鏋愭枃鏈苟鎷嗗垎涓洪噴鏀炬竻鍗曘€?    杈撳叆锛?${text}
    瑕佹眰锛?    1. 銆愭瀬鑷磋鐩栥€戯細蹇呴』澶勭悊杈撳叆鏂囨湰鐨勬墍鏈夋牳蹇冭鐐广€傚嵆浣挎枃鏈緝闀匡紝涔熻纭繚璇嗗埆鍑哄叾涓瘡涓€涓嫭绔嬬殑鎯呯华瑙﹀彂鐐规垨浜嬩欢锛屼笉瑕侀殢鎰忓悎骞舵垨鐪佺暐锛屽鏋滄槸澶氬彞璇濓紝璇烽€愬彞娣卞害鎷嗚В锛屽姟蹇呬繚璇侀噴鏀剧殑鍏ㄩ潰鎬с€?    2. 娣卞害鍓栨瀽锛氭寲鎺樻瘡椤硅儗鍚庣殑搴曞眰鎯宠锛堟兂瑕佽璁ゅ彲銆佹兂瑕佹帶鍒躲€佹兂瑕佸畨鍏級锛屾彮绀鸿繖浜涘姩鍔涚殑杩愪綔鏂瑰紡銆?    3. 鈥滄兂瑕佲€濅粎闄?[approval, control, security]銆?    4. 姣忛」鐨勮В鏋愶紙a锛夊簲绾?0瀛楀乏鍙筹紝鐩村嚮鏍稿績銆?    5. 鍒嗘瀽鎬荤粨锛坅na锛夛細瀵规暣浣撹繘琛屾繁搴︽彁鐐硷紝绾?0瀛椼€?    
    杈撳嚭蹇呴』鏄函JSON鏍煎紡锛?    {
      "list": [
        { "s": "鍘熷鍙ュ瓙", "w": ["approval"], "a": "娼滄剰璇嗘寲鎺樺垎鏋?, "phase": "涓婚鍒囧叆鐐? }
      ],
      "ana": "鍒嗘瀽鎬荤粨鍐呭"
    }`;

  try {
    // Wait for the full non-streaming AI response before parsing.
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
  const prompt = `浣犳槸涓€浣嶇簿閫氬湥澶氱撼閲婃斁娉曚笌鏄惧寲娉曞垯鐨勬暀缁冦€?    浠诲姟锛氭繁搴﹀墫鏋愪互涓嬫枃鏈墖娈碉紝鍍忓墺娲嬭懕涓€鏍锋媶瑙ｇ棝鐐广€?
    杈撳叆鏂囨湰鍐呭锛?${text}
    
    Logic (鍏ㄦ伅閲婃斁閫昏緫 - 閽堝璇ョ墖娈佃瘑鍒嚭鐨勫叿浣撲簨浠?鎯呭喌锛岄兘闇€鎵ц浠ヤ笅5灞傜粨鏋?:
    1. 閽堝浜嬩欢姝ｅ弽闈㈢殑鍏佽 (鐢熸垚3-4鍙?锛氥€愮粷瀵逛笉瑕佺偣鍑哄叿浣撴儏缁紝鑰屾槸閲嶇偣閲婃斁鍦ㄤ簨浠?鎯呭喌鏈韩銆戙€傜敓鎴愬厑璁歌鎯呭喌瀛樺湪銆佷互鍙婂厑璁稿叾鍙嶉潰鎯呭喌瀛樺湪鐨勯棶鍙ャ€備緥濡傦細鈥滀綘鍏佽鍒汉蹇借浣犲悧锛熲€濄€佲€滀綘鍏佽鍒汉涓嶅拷瑙嗕綘鍚楋紵鈥濄€傚甫鍒版儏缁椂鍙鈥滀綘鍏佽杩欑鎰熻瀛樺湪鍚楋紵鈥濄€?    2. 娓呯悊鎵х潃闈?(鐢熸垚1鍙?锛氬紩瀵煎療瑙夊褰撳墠浜嬩欢鈥滄兂瑕佹敼鍙樺畠鈥濇垨鈥滄帹寮€瀹冣€濈殑娓存眰銆?    3. 鎸栨帢娣卞眰鍔ㄦ満 (鐢熸垚1鍙?锛氭寚鍑洪殣钘忕殑鍖箯闇€姹傦紙鎯宠鎺у埗銆佽鍚屾垨瀹夊叏锛夛紝寮曞鏀句笅銆?    4. 瀵圭珛铻嶅悎 (鐢熸垚1鍙?锛氬厑璁镐簨浠跺彂鐢熶笌涓嶅彂鐢熷苟瀛橈紝瀵熻閮芥槸鑳介噺銆?    5. 缁堟瀬閲婃斁涓庡瓨鍦?(鐢熸垚1鍙?锛氣€滀綘鑳芥妸瀹冩斁涓嬪悧锛熲€濈粓鏋佹竻鐞嗐€?    
    瑕佹眰锛?    1. 銆愭瀬鑷村叏闈€戯細鍙璇ョ墖娈垫湁澶氫釜灞傞潰鎴栧涓彞瀛愶紝灏卞繀椤婚€愪釜鐥涚偣/鍙ュ瓙寰幆浜у嚭涓婅堪闂彞锛佹妸鏂囦腑鎻愬埌鐨勬瘡涓€涓牳蹇冪煕鐩?鍏蜂綋浜嬩欢缁嗙粏鎷嗚В锛屼负瀹冧滑鍒嗗埆鐢熸垚杩炵画娣卞叆鐨勪笂杩伴噴鏀鹃棶鍙ラ摼銆備笉闄愭暟閲忥紝鍔″繀鎶婄墖娈靛唴鐨勪簨浠舵斁骞插噣锛屼笉瑕佺渷鐣ワ紒
    2. 銆愭瀬搴︾畝鏄庣煭淇冦€戯細姣忓彞闂彞蹇呴』闈炲父鐭€傚彧瑕佺函JSON锛屼笉杈撳嚭澶氫綑搴熻瘽銆?    3. 銆愬厠鍒剁殑寮曠敤銆戯細鐩存帴浣跨敤鐢ㄦ埛鐨勮瘝姹囨弿杩颁簨浠讹紝涓嶄贡鍔犳儏缁舰瀹硅瘝銆?    
    杈撳嚭蹇呴』鏄函JSON鏍煎紡锛?    {
      "list": [
        { 
          "s": "鐢熸垚鐨勫叿浣撻噴鏀鹃棶鍙ュ唴瀹?, 
          "w": ["control", "approval", "security"],
          "phase": "涓婚鍒囧叆鐐?- 姝ラ鍚嶇О" 
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
  const prompt = `瀵煎笀鎸囦护锛氭牴鎹敤鎴疯緭鍏ョ殑鈥滈鍩?涓婚鈥濓紝鐢熸垚涓€濂椾笓灞炶棰嗗煙鐨勬繁灞傞噴鏀鹃棶鍙ャ€?    杈撳叆涓婚锛?${topic}
    
    浠诲姟锛?    璇蜂负杩欎釜鐗瑰畾棰嗗煙鐢熸垚 6-8 涓拡瀵规€х殑鍦ｅ绾抽噴鏀鹃棶鍙ャ€?    
    瑕佹眰锛?    1. 鍓?涓棶鍙ワ細鎸栨帢骞堕潰瀵硅棰嗗煙閲岀殑璐熼潰鎶楁嫆锛堜緥濡傦細鍏充簬${topic}浣犳渶鎶楁嫆/瀹虫€曠殑鏂归潰锛熷埌鐜板湪浣犵殑鎰熻鏄粈涔堬紵锛?    2. 鎺ヤ笅鏉?-3鍙ワ細鎸栨帢璇ラ鍩熻儗鍚庣殑搴曞眰鎯宠锛堟瀬鍔涙帰璁ㄨ繖娈靛叧绯?杩欎欢浜嬭窡鈥滄兂瑕佹帶鍒垛€濄€佲€滄兂瑕佽璁ゅ悓鈥濄€佲€滄兂瑕佸畨鍏ㄢ€濇湁浠€涔堝叧鑱旓紵浣犵殑鎰熻鏄粈涔堬紵锛?    3. 鎺ヤ笅鏉?-2鍙ワ細鏋佺鐨勬兂璞★紙濡傛灉鏄渶鍧忕粨灞€/濡傛灉宸茬粡闈炲父瀹岀編锛屼綘鐜板湪鐨勬劅瑙夋槸浠€涔堬紵锛?    4. 鏈€鍚?鍙ワ細鍖呭涓庡厑璁革紙浣犺兘鍏佽褰撳墠瀵?${topic}鐨勪竴鍒囩幇鐘跺悧锛燂級
    
    鏋佸害閲嶈锛氬彞寮忓敖閲忕粨灏惧甫涓娾€滄垜鐜板湪瀵瑰畠鐨勬劅瑙夋槸浠€涔堬紵鈥濇垨鈥滀綘鐜板湪瀵规鐨勬劅瑙夋槸浠€涔堬紵鈥濓紝鐩存帴閽堝浜嬩欢瀵硅薄銆?    璇风洿鎺ヨ繑鍥炰竴涓瓧绗︿覆鏁扮粍鐨凧SON锛佷笉瑕佹湁澶氫綑鐨勮В鏋愬拰瀵掓殑锛?    
    杈撳嚭绾疛SON:
    {
      "questions": [
        "闂彞鍐呭1",
        "闂彞鍐呭2"
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
      ? `\n鍘嗗彶瑙ｆ瀽鑳屾櫙锛堜緵鍙傝€冿紝璇风粨鍚堣繖浜涘巻鍙叉礊瀵熻繘琛屾洿娣变竴灞傜殑杩涢樁鎸栨帢锛夛細\n${options.history
          .map(h => `[杞:${h.round || 1}] 闂?${h.q} 绛?${h.ans} 瑙ｆ瀽:${h.a}`)
          .join('\n')}`
      : '';

  const prompt = `瀵煎笀鎸囦护锛氭繁搴﹀垎鏋愨€?${area}鈥?    ${historyContext}
    
    鏈鏂扮殑鍥炵瓟瀵圭収锛?    ${answeredQuestions.map((q, i) => `Q:${q}\nA:${answeredAnswers[i]}`).join('\n')}
    
    瑕佹眰锛?    鑻ュ洖绛旇緝涓哄啑闀挎垨閲嶅锛岃鎻愮偧骞跺悎骞讹紝浠ユ彁楂樺垎鏋愭晥鐜囥€?    鍒嗘瀽鐒︾偣锛氭寲鎺樻瘡涓洖绛旇儗鍚庨殣钘忕殑搴曞眰鎯宠锛堟兂瑕佽璁ゅ彲銆佹兂瑕佹帶鍒躲€佹兂瑕佸畨鍏級锛屾彮绀鸿繖浜涙兂瑕佸浣曢┍鍔ㄤ簡褰撳墠鐨勫洖搴斻€傚悓鏃讹紝濡傛灉鎻愪緵浜嗗巻鍙茶儗鏅紝璇峰姟蹇呭湪鍘熸湁瑙ｆ瀽鍩虹涓婅繘琛屸€滆繘闃垛€濇寲鎺橈紝涓嶈鍙槸閲嶅銆?    鈥滄兂瑕佲€濅粎闄?[approval, control, security]銆?    姣忎釜鍥炵瓟鐨勮В鏋愶紙a锛夊簲绾?5瀛楀乏鍙炽€?    鍒嗘瀽鎬荤粨锛坰um锛夛細缁撳悎鏁翠綋鍥炵瓟浠ュ強鍘嗗彶鎸栨帢鑳屾櫙锛屽搴曞眰鎯宠杩涜娣卞害鎬荤粨锛岀害50瀛椼€?    
    杈撳嚭蹇呴』鏄函JSON鏍煎紡锛?    {
      "list": [
        { "q": "瀵瑰簲鐨勯棶棰樺唴瀹?, "s": "瀵瑰簲鐨勫洖绛旇繘琛屾繁搴︽彁鐐?鍚堝苟锛堢害50瀛楋級", "w": ["approval"], "a": "娼滄剰璇嗘兂瑕佹繁搴﹀垎鏋? }
      ],
      "w": ["鏍稿績鎯宠"],
      "sum": "鍒嗘瀽鎬荤粨鍐呭"
    }`;

  const responseText = await callAI(prompt, undefined, options);
  const result = safeJSONParse(responseText || '');
  if (onProgress) onProgress(result);
  return result;
}

export async function analyzeEmotions(
  text: string,
  onProgress?: (data: any) => void,
  options?: { model_type?: string; invite_code?: string; aiBaseUrl?: string; aiApiKey?: string; aiModelName?: string }
) {
  const prompt = `瀵煎笀鎸囦护锛氬垎鏋愭儏缁被鍒笌鏍规簮鎯宠銆?    杈撳叆锛?${text}
    绫诲埆锛歔涓囧康淇辩伆, 鎮茶嫤, 鎭愭儳, 璐眰, 鎰ゆ€? 鑷皧鑷偛, 鏃犵晱, 鎺ョ撼, 骞冲拰]
    瑕佹眰锛?    1. 娣卞害鍒嗘瀽鑳屽悗鐨勫績鐞嗗姩鏈哄拰鎯宠锛屾帶鍒跺湪80瀛楀乏鍙炽€?    
    杈撳嚭蹇呴』鏄函JSON鏍煎紡锛?    {
      "emo": ["鍏蜂綋鎯呯华"],
      "cat": ["鎯呯华绫诲埆"],
      "ana": "搴曞眰鎯宠涓庢牴婧愬垎鏋?
    }`;

  const responseText = await callAI(prompt, undefined, options);
  const result = safeJSONParse(responseText || '');
  if (onProgress) onProgress(result);
  return result;
}
