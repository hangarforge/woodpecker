import { ref, onUnmounted } from 'vue';
import useConfig from '~/compositions/useConfig';

export interface BoardStageCommit {
  sha?: string;
  shortSha?: string;
  message?: string;
  author?: string;
  authorAvatar?: string;
  at?: number;
}

export interface BoardStageBuild {
  pipelineNum: number;
  status: string;
  duration?: number;
  steps: { name: string; state: string; duration: number }[];
}

export interface BoardStageTest {
  pipelineNum: number;
  status: string;
  deployedAt?: number;
}

export interface BoardStageApproval {
  id: string;
  status: string;
  votes: { user: { login: string; avatarUrl?: string }; decision: string; comment?: string }[];
  requiredCount: number;
  expiresAt?: string;
}

export interface BoardStageProd {
  pipelineNum: number;
  status: string;
  deployedAt?: number;
}

export interface BoardPromotion {
  id: string;
  status: string;
  triggeredBy: string;
  createdAt: string;
}

export interface BoardRow {
  app: string;
  repoId: number;
  commit: BoardStageCommit;
  build: BoardStageBuild;
  test: BoardStageTest;
  approval: BoardStageApproval | null;
  prod: BoardStageProd | null;
  promotion: BoardPromotion | null;
}

export interface BoardData {
  rows: BoardRow[];
  updatedAt: string;
}

export function usePromotionBoard(repoId: number) {
  const config = useConfig();
  const hfciApiUrl = config.rootPath.replace('woodpecker', 'hfci-api');
  const hfciBaseUrl = `${window.location.protocol}//${window.location.host.replace('woodpecker', 'hfci-api')}`;
  const apiBase = import.meta.env.VITE_HFCI_API_URL ?? hfciBaseUrl;

  const board = ref<BoardData | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let timer: ReturnType<typeof setInterval> | null = null;

  function getToken(): string {
    return localStorage.getItem('hfci-jwt') ?? '';
  }

  async function fetchBoard() {
    loading.value = true;
    error.value = null;
    try {
      const res = await fetch(`${apiBase}/api/promotions/board?repoId=${repoId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      board.value = await res.json();
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  }

  async function triggerPromotion(payload: {
    repoId: number;
    repoFullName: string;
    pipelineNumber: number;
    app: string;
    commitSha: string;
    commitMessage?: string;
    commitAuthor?: string;
    branch: string;
  }): Promise<{ status: string; promotion: BoardPromotion }> {
    const res = await fetch(`${apiBase}/api/promotions/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  function startAutoRefresh(intervalMs = 15_000) {
    stopAutoRefresh();
    timer = setInterval(() => fetchBoard(), intervalMs);
  }

  function stopAutoRefresh() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  onUnmounted(() => stopAutoRefresh());

  return { board, loading, error, fetchBoard, triggerPromotion, startAutoRefresh, stopAutoRefresh };
}
