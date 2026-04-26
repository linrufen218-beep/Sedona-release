
export type WantType = 'approval' | 'control' | 'security';

export interface ReleaseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'daily' | 'area' | 'focused' | 'custom';
  content: string;
  analysis?: {
    // New simplified keys
    list?: {
      s: string;
      w: string[];
      a?: string;
      note?: string;
      released?: boolean;
      deepWants?: {
        s: string;
        timestamp: number;
        note?: string;
      }[];
    }[];
    ana?: string;
    sum?: string;
    // Old keys (backward compatibility)
    sentences?: {
      text: string;
      wants: WantType[];
    }[];
    deepAnalysis?: string;
    supplement?: string;
  };
  feelings?: string;
  timestamp: number;
}

export interface StuckSentence {
  id: string;
  text: string;
  wants: string[];
  analysis?: string;
  source: string;
  timestamp: number;
}

export interface HarvestRecord {
  id: string;
  date: string;
  content: string;
  category?: string;
  timestamp: number;
}

export interface QuestionStep {
  id: string;
  question: string;
  positive: string;
  negative: string;
  hasBranch?: boolean;
  branchQuestion?: string;
}

export interface QuestionGroup {
  id: string;
  name: string;
  steps: QuestionStep[];
}

export interface CustomAiConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  selectedModel: 'DEEPSEEK32' | 'MINIMAX25';
  inviteCode: string;
  aiBaseUrl?: string;
  aiApiKey?: string;
  aiModelName?: string;
  enableVoiceInput?: boolean;
  useCustomConfig?: boolean;
  customAiConfigs?: CustomAiConfig[];
  selectedCustomConfigId?: string;
  useDefaultQuestions?: boolean;
  questionGroups?: QuestionGroup[];
  moduleAssignments?: {
    daily?: string;
    area?: string;
    focused?: string;
    focused_ai_gen?: string;
    custom?: string;
    custom_want?: string;
    custom_want_three?: string;
    custom_want_six?: string;
    custom_emotion?: string;
    stuck_three?: string;
    stuck_six?: string;
    stuck_emotion?: string;
    stuck_qa?: string;
    stuck?: string;
  };
  autoMarkReleased?: boolean;
}

export const STORAGE_KEYS = {
  HISTORY: 'sedona_history',
  SETTINGS: 'sedona_settings',
  HARVESTS: 'sedona_harvests',
  STUCK: 'sedona_stuck',
  FOCUSED_PROJECTS: 'sedona_focused_projects',
  DAILY_STATE: 'sedona_daily_state',
  AREA_STATE: 'sedona_area_state',
  FOCUSED_STATE: 'sedona_focused_state',
  CUSTOM_STATE: 'sedona_custom_state',
  AREA_SESSIONS: 'sedona_area_sessions',
  CUSTOM_AREAS: 'sedona_custom_areas',
  RELEASED_AREAS: 'sedona_released_areas',
};

export interface CustomArea {
  id: string;
  title: string;
  description: string;
  questions: string[];
}

export interface AreaSession {
  id: string;
  areaId: string;
  name: string;
  date: string;
  list: {
    s: string;
    w: string[];
    a?: string;
    round?: number;
    released?: boolean;
    ans?: string;
    q?: string;
  }[];
  sum?: string;
  timestamp: number;
}

export function getAreaSessions(): AreaSession[] {
  const data = localStorage.getItem(STORAGE_KEYS.AREA_SESSIONS);
  return data ? JSON.parse(data) : [];
}

export function saveAreaSessions(sessions: AreaSession[]) {
  localStorage.setItem(STORAGE_KEYS.AREA_SESSIONS, JSON.stringify(sessions));
}

export function saveAreaSession(session: Omit<AreaSession, 'id' | 'timestamp' | 'date'> & { id?: string }) {
  const sessions = getAreaSessions();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  
  if (session.id) {
    const index = sessions.findIndex(s => s.id === session.id);
    if (index !== -1) {
      sessions[index] = { ...sessions[index], ...session, timestamp: Date.now() } as AreaSession;
      saveAreaSessions(sessions);
      return sessions[index];
    }
  }
  
  const newSession = {
    ...session,
    id: crypto.randomUUID(),
    date: dateStr,
    timestamp: Date.now()
  } as AreaSession;
  sessions.unshift(newSession);
  saveAreaSessions(sessions);
  return newSession;
}

export function deleteAreaSession(id: string) {
  const sessions = getAreaSessions();
  const filtered = sessions.filter(s => s.id !== id);
  saveAreaSessions(filtered);
}

export function getCustomAreas(): CustomArea[] {
  const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_AREAS);
  return data ? JSON.parse(data) : [];
}

export function saveCustomArea(area: CustomArea): CustomArea {
  const areas = getCustomAreas();
  const index = areas.findIndex(a => a.id === area.id);
  if (index !== -1) {
    areas[index] = area;
  } else {
    areas.push(area);
  }
  saveCustomAreas(areas);
  return area;
}

export function saveCustomAreas(areas: CustomArea[]) {
  localStorage.setItem(STORAGE_KEYS.CUSTOM_AREAS, JSON.stringify(areas));
}

export function deleteCustomArea(id: string) {
  const areas = getCustomAreas().filter(a => a.id !== id);
  saveCustomAreas(areas);
}

export function getComponentState(key: string): any {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

export function saveComponentState(key: string, state: any) {
  localStorage.setItem(key, JSON.stringify(state));
}

export function getHistory(): ReleaseRecord[] {
  const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
  return data ? JSON.parse(data) : [];
}

export function saveRecord(record: ReleaseRecord) {
  const history = getHistory();
  history.unshift(record);
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

export function updateRecord(record: ReleaseRecord) {
  const history = getHistory();
  const index = history.findIndex(r => r.id === record.id);
  if (index !== -1) {
    history[index] = record;
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    return true;
  }
  return false;
}

export function getHarvests(): HarvestRecord[] {
  const data = localStorage.getItem(STORAGE_KEYS.HARVESTS);
  return data ? JSON.parse(data) : [];
}

export function saveHarvest(harvest: HarvestRecord) {
  const harvests = getHarvests();
  harvests.unshift(harvest);
  localStorage.setItem(STORAGE_KEYS.HARVESTS, JSON.stringify(harvests));
}

export function getSettings(): AppSettings {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return data ? JSON.parse(data) : { 
    theme: 'light',
    selectedModel: 'MINIMAX25',
    inviteCode: '',
    aiBaseUrl: '',
    aiApiKey: '',
    aiModelName: '',
    enableVoiceInput: false,
    useCustomConfig: false,
    customAiConfigs: [],
    selectedCustomConfigId: '',
    useDefaultQuestions: true,
    questionGroups: [],
    moduleAssignments: {},
    autoMarkReleased: true
  };
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function getStuckSentences(): StuckSentence[] {
  const data = localStorage.getItem(STORAGE_KEYS.STUCK);
  return data ? JSON.parse(data) : [];
}

export function saveStuckSentences(sentences: StuckSentence[]) {
  localStorage.setItem(STORAGE_KEYS.STUCK, JSON.stringify(sentences));
}

export function addStuckSentence(sentence: Omit<StuckSentence, 'id' | 'timestamp'>) {
  const stuck = getStuckSentences();
  stuck.unshift({
    ...sentence,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  });
  saveStuckSentences(stuck);
}

export function removeStuckSentence(id: string) {
  const stuck = getStuckSentences();
  const filtered = stuck.filter(s => s.id !== id);
  saveStuckSentences(filtered);
}

export interface FocusedProject {
  id: string;
  themeId: string;
  name: string;
  completed?: boolean;
  list: {
    s: string;
    w: string[];
    a?: string;
    round?: number;
    released?: boolean;
    ans?: string;
    q?: string;
  }[];
  sum?: string;
  timestamp: number;
}

export function getFocusedProjects(): FocusedProject[] {
  const data = localStorage.getItem(STORAGE_KEYS.FOCUSED_PROJECTS);
  return data ? JSON.parse(data) : [];
}

export function saveFocusedProjects(projects: FocusedProject[]) {
  localStorage.setItem(STORAGE_KEYS.FOCUSED_PROJECTS, JSON.stringify(projects));
}

export function saveFocusedProject(project: Omit<FocusedProject, 'id' | 'timestamp'> & { id?: string }) {
  const projects = getFocusedProjects();
  if (project.id) {
    const index = projects.findIndex(p => p.id === project.id);
    if (index !== -1) {
      projects[index] = { ...projects[index], ...project, timestamp: Date.now() } as FocusedProject;
      saveFocusedProjects(projects);
      return projects[index];
    }
  }
  
  const newProject = {
    ...project,
    id: crypto.randomUUID(),
    timestamp: Date.now()
  } as FocusedProject;
  projects.unshift(newProject);
  saveFocusedProjects(projects);
  return newProject;
}

export function deleteFocusedProject(id: string) {
  const projects = getFocusedProjects();
  const filtered = projects.filter(p => p.id !== id);
  saveFocusedProjects(filtered);
}
