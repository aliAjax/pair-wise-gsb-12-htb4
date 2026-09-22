/**
 * 本地存储层：只负责交接台账在 localStorage 的序列化读取与写入。
 * 与资料、规则解耦：存储键、容错和版本升级集中在本文件。
 */
import type { Ledger } from "../data/master";
import { seedLedger } from "../data/seed";

const STORAGE_KEY = "dfwlfront-3-drop-hook-ledger-v1";

/**
 * 读取台账：
 * - 首次使用 → 落一份演示数据后返回；
 * - 数据损坏 → 回退到演示数据，避免页面空白。
 */
export function loadLedger(): Ledger {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (!raw) {
    const seeded = seedLedger(new Date().toISOString());
    saveLedger(seeded);
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as Ledger;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.tasks)) {
      throw new Error("unsupported ledger version");
    }
    return {
      version: 1,
      seq: {
        task: parsed.seq?.task ?? 0,
        handover: parsed.seq?.handover ?? 0,
        revision: parsed.seq?.revision ?? 0
      },
      tasks: parsed.tasks,
      handovers: parsed.handovers ?? [],
      revisions: parsed.revisions ?? []
    };
  } catch {
    const seeded = seedLedger(new Date().toISOString());
    saveLedger(seeded);
    return seeded;
  }
}

export function saveLedger(ledger: Ledger): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
  } catch {
    // 隐私模式或配额异常时静默处理：本次会话内操作仍然有效。
  }
}

export function resetLedger(): Ledger {
  const seeded = seedLedger(new Date().toISOString());
  saveLedger(seeded);
  return seeded;
}

export const LEDGER_STORAGE_KEY = STORAGE_KEY;
