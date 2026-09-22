// 本地存储层：任务、交接、修订各自独立的 localStorage 键，互不覆盖。
// 首次进入写入演示种子；解析失败回退为空/种子，保证刷新后数据一致。

import type { DispatchTask, HandoverRecord, SealRevision } from "../types";
import { buildSeed } from "../data/seed";

const VERSION = "v1";
const KEY_TASKS = `drop-hook/${VERSION}/tasks`;
const KEY_HANDOVERS = `drop-hook/${VERSION}/handovers`;
const KEY_REVISIONS = `drop-hook/${VERSION}/revisions`;
const KEY_SEEDED = `drop-hook/${VERSION}/seeded`;

function read<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback();
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储不可用时静默降级（隐私模式/配额），当前会话仍可操作
  }
}

export interface SeedData {
  tasks: DispatchTask[];
  handovers: HandoverRecord[];
  revisions: SealRevision[];
}

function loadAll(): SeedData {
  if (!localStorage.getItem(KEY_SEEDED)) {
    const seed = buildSeed();
    write(KEY_TASKS, seed.tasks);
    write(KEY_HANDOVERS, seed.handovers);
    write(KEY_REVISIONS, seed.revisions);
    write(KEY_SEEDED, true);
    return seed;
  }
  return {
    tasks: read<DispatchTask[]>(KEY_TASKS, () => []),
    handovers: read<HandoverRecord[]>(KEY_HANDOVERS, () => []),
    revisions: read<SealRevision[]>(KEY_REVISIONS, () => [])
  };
}

/** 仅在本会话尚未取数时读一次，之后由 store 统一回写 */
let cached: SeedData | null = null;

export const storage = {
  load(): SeedData {
    if (!cached) cached = loadAll();
    return cached;
  },
  saveTasks(tasks: DispatchTask[]) {
    if (cached) cached.tasks = tasks;
    write(KEY_TASKS, tasks);
  },
  saveHandovers(handovers: HandoverRecord[]) {
    if (cached) cached.handovers = handovers;
    write(KEY_HANDOVERS, handovers);
  },
  saveRevisions(revisions: SealRevision[]) {
    if (cached) cached.revisions = revisions;
    write(KEY_REVISIONS, revisions);
  },
  /** 恢复演示数据 */
  reseed(): SeedData {
    const seed = buildSeed();
    cached = seed;
    write(KEY_TASKS, seed.tasks);
    write(KEY_HANDOVERS, seed.handovers);
    write(KEY_REVISIONS, seed.revisions);
    write(KEY_SEEDED, true);
    return seed;
  },
  /** 清空全部业务数据 */
  clearAll(): SeedData {
    const empty: SeedData = { tasks: [], handovers: [], revisions: [] };
    cached = empty;
    write(KEY_TASKS, empty.tasks);
    write(KEY_HANDOVERS, empty.handovers);
    write(KEY_REVISIONS, empty.revisions);
    write(KEY_SEEDED, true);
    return empty;
  }
};
