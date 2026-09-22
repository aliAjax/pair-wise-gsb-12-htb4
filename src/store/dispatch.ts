/**
 * 交接台账状态（Pinia）：任务、换挂交接、异常修订的唯一数据源。
 * 所有判定调用 rules 纯函数；每次变更经 storage 层落盘，刷新后一致。
 */
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  driversById,
  tractorsById,
  trailersById,
  type DispatchTask,
  type Ledger,
  type RevisionRecord,
  type SealStatus,
  type TrailerHandover
} from "../data/master";
import { evaluateDispatch, evaluateSwap, type DispatchDraft, type RuleHit, type SwapDraft } from "../rules/validation";
import { isActiveTask } from "../rules/occupancy";
import { loadLedger, resetLedger, saveLedger } from "../storage/ledgerStore";

export type DispatchOutcome =
  | { ok: true; taskId: string }
  | { ok: false; hits: RuleHit[] };

function padSeq(n: number): string {
  return String(n).padStart(4, "0");
}

function todayCompact(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export const useLedger = defineStore("drop-hook-ledger", () => {
  const ledger = ref<Ledger>(loadLedger());

  const tasks = computed(() => ledger.value.tasks);
  const handovers = computed(() => ledger.value.handovers);
  const revisions = computed(() => ledger.value.revisions);

  const activeTasks = computed(() => tasks.value.filter(isActiveTask));
  const openHandovers = computed(() =>
    handovers.value.filter((item) => item.status === "待确认交回")
  );

  function persist() {
    saveLedger(ledger.value);
  }

  function nextId(kind: keyof Ledger["seq"], prefix: string): string {
    ledger.value.seq[kind] += 1;
    return kind === "task"
      ? `RW-${todayCompact()}-${padSeq(ledger.value.seq[kind])}`
      : `${prefix}-${padSeq(ledger.value.seq[kind])}`;
  }

  /** 整单校验派车：通过才建单；不通过返回全部命中项，输入由页面保留。 */
  function dispatch(draft: DispatchDraft): DispatchOutcome {
    const result = evaluateDispatch({
      draft,
      tractor: tractorsById.get(draft.tractorId),
      trailer: trailersById.get(draft.trailerId),
      driver: driversById.get(draft.driverId),
      activeTasks: activeTasks.value,
      openHandovers: openHandovers.value
    });
    if (!result.ok) return { ok: false, hits: result.hits };

    const task: DispatchTask = {
      id: nextId("task", "RW"),
      tractorId: draft.tractorId,
      trailerId: draft.trailerId,
      originalTrailerId: draft.trailerId,
      driverId: draft.driverId,
      startAt: draft.startAt,
      endAt: draft.endAt,
      route: draft.route.trim(),
      notes: draft.notes.trim(),
      status: "待发车",
      createdAt: new Date().toISOString()
    };
    ledger.value.tasks.unshift(task);
    persist();
    return { ok: true, taskId: task.id };
  }

  /** 发车：组合冻结，锁定当前牵引车/挂车/司机。 */
  function depart(taskId: string): void {
    const task = ledger.value.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== "待发车") return;
    task.status = "在途";
    task.departedAt = new Date().toISOString().slice(0, 16);
    persist();
  }

  /** 正常回场：原组合交回，占用解除。 */
  function returnToYard(taskId: string): void {
    const task = ledger.value.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== "在途") return;
    task.status = "已回场";
    task.returnedAt = new Date().toISOString().slice(0, 16);
    task.sealStatus = "正常";
    persist();
  }

  /**
   * 回场铅封异常：原单在途组合保持冻结，
   * 只能另存一条带原因的修订记录，不回写任务。
   */
  function saveSealRevision(
    taskId: string,
    payload: { reason: string; oldSealNo: string; newSealNo: string; detail: string; kind?: RevisionRecord["kind"] }
  ): void {
    const task = ledger.value.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== "在途") return;
    const revision: RevisionRecord = {
      id: nextId("revision", "XD"),
      taskId,
      kind: payload.kind ?? "铅封异常",
      reason: payload.reason.trim(),
      oldSealNo: payload.oldSealNo.trim(),
      newSealNo: payload.newSealNo.trim(),
      detail: payload.detail.trim(),
      reportedAt: new Date().toISOString().slice(0, 16),
      createdAt: new Date().toISOString()
    };
    ledger.value.revisions.unshift(revision);
    task.sealStatus = "异常" as SealStatus;
    persist();
  }

  /**
   * 换挂：先形成交接记录（待确认交回），
   * 原组合在确认交回前不得再次派车（由 validation 规则拦截）。
   */
  function createHandover(draft: SwapDraft): { ok: true; handoverId: string } | { ok: false; hits: RuleHit[] } {
    const task = ledger.value.tasks.find((item) => item.id === draft.taskId);
    if (!task || task.status !== "在途") {
      return {
        ok: false,
        hits: [{ code: "FORM", label: "任务不可换挂", detail: "仅在途任务允许办理换挂交接。" }]
      };
    }
    if (draft.toTrailerId === task.trailerId) {
      return {
        ok: false,
        hits: [{ code: "FORM", label: "挂车未变化", detail: "换入挂车与当前挂车相同，无需交接。" }]
      };
    }
    const hits = evaluateSwap(draft, trailersById.get(draft.toTrailerId), activeTasks.value);
    if (hits.length) return { ok: false, hits };

    const handover: TrailerHandover = {
      id: nextId("handover", "HJ"),
      taskId: task.id,
      tractorId: task.tractorId,
      fromTrailerId: task.trailerId,
      toTrailerId: draft.toTrailerId,
      detachedAt: draft.detachedAt,
      attachedAt: draft.attachedAt,
      location: draft.location.trim(),
      operator: draft.operator.trim(),
      note: draft.note.trim(),
      status: "待确认交回",
      createdAt: new Date().toISOString()
    };
    ledger.value.handovers.unshift(handover);
    // 交接成立后，任务当前挂车切换；原挂车记录在 originalTrailerId / fromTrailerId 中留痕。
    task.trailerId = draft.toTrailerId;
    persist();
    return { ok: true, handoverId: handover.id };
  }

  /** 确认原组合交回：解除原组合锁定（占用随之释放）。 */
  function confirmHandover(handoverId: string): void {
    const handover = ledger.value.handovers.find((item) => item.id === handoverId);
    if (!handover || handover.status !== "待确认交回") return;
    handover.status = "已确认交回";
    handover.confirmedAt = new Date().toISOString().slice(0, 16);
    persist();
  }

  /** 取消待发车任务：发车前可撤销，发车后冻结不可取消。 */
  function cancelTask(taskId: string): void {
    const task = ledger.value.tasks.find((item) => item.id === taskId);
    if (!task || task.status !== "待发车") return;
    ledger.value.tasks = ledger.value.tasks.filter((item) => item.id !== taskId);
    persist();
  }

  function handoversOfTask(taskId: string): TrailerHandover[] {
    return ledger.value.handovers.filter((item) => item.taskId === taskId);
  }

  function revisionsOfTask(taskId: string): RevisionRecord[] {
    return ledger.value.revisions.filter((item) => item.taskId === taskId);
  }

  function resetDemo(): void {
    ledger.value = resetLedger();
  }

  return {
    ledger,
    tasks,
    handovers,
    revisions,
    activeTasks,
    openHandovers,
    dispatch,
    depart,
    returnToYard,
    saveSealRevision,
    createHandover,
    confirmHandover,
    cancelTask,
    handoversOfTask,
    revisionsOfTask,
    resetDemo
  };
});
