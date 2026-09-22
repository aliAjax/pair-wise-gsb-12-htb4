// 调度状态层：持有任务 / 交接 / 修订的响应式状态，所有写操作经此处落盘。
// 车辆资料是静态档案（data/masterData），规则是纯函数（rules/rules），本层只做编排。

import { computed, ref } from "vue";
import type { DispatchTask, HandoverRecord, SealRevision, Trailer } from "../types";
import { DRIVERS, TRACTORS, TRAILERS } from "../data/masterData";
import { storage } from "../data/storage";
import {
  currentTrailerId,
  isActive,
  validateDispatch,
  validateHandover,
  type DispatchInput,
  type HandoverInput
} from "../rules/rules";
import type { Violation } from "../types";
import { bizId } from "../utils/time";

const initial = storage.load();

const tasks = ref<DispatchTask[]>(initial.tasks);
const handovers = ref<HandoverRecord[]>(initial.handovers);
const revisions = ref<SealRevision[]>(initial.revisions);

export { tasks, handovers, revisions };

export const tractors = TRACTORS;
export const trailers = TRAILERS;
export const drivers = DRIVERS;

// ---------- 档案查询 ----------
export function tractorOf(id: string) {
  return TRACTORS.find((t) => t.id === id);
}
export function trailerOf(id: string) {
  return TRAILERS.find((t) => t.id === id);
}
export function driverOf(id: string) {
  return DRIVERS.find((d) => d.id === id);
}
export function taskOf(id: string) {
  return tasks.value.find((t) => t.id === id);
}
export function handoversOf(taskId: string) {
  return handovers.value
    .filter((h) => h.taskId === taskId)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
export function revisionsOf(taskId: string) {
  return revisions.value
    .filter((r) => r.taskId === taskId)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** 未确认交回的挂账交接（原组合冻结中） */
export const pendingHandovers = computed(() =>
  handovers.value.filter((h) => !h.confirmedAt)
);

export function pendingHandoverFor(tractorId: string, trailerId: string) {
  return handovers.value.find(
    (h) => !h.confirmedAt && h.tractorId === tractorId && h.fromTrailerId === trailerId
  );
}

// ---------- 派车 ----------
export function createTask(input: DispatchInput): { ok: boolean; violations: Violation[] } {
  const violations = validateDispatch(input, {
    tractors: TRACTORS,
    trailers: TRAILERS,
    drivers: DRIVERS,
    tasks: tasks.value,
    handovers: handovers.value
  });
  if (violations.length) return { ok: false, violations };

  const task: DispatchTask = {
    id: bizId("RW"),
    content: input.content.trim(),
    tractorId: input.tractorId,
    trailerId: input.trailerId,
    driverId: input.driverId,
    startAt: new Date(input.startAt).toISOString(),
    endAt: new Date(input.endAt).toISOString(),
    status: "scheduled",
    createdAt: new Date().toISOString()
  };
  tasks.value = [task, ...tasks.value];
  storage.saveTasks(tasks.value);
  return { ok: true, violations: [] };
}

/** 发车：组合冻结（任务信息自此不可直接编辑） */
export function depart(taskId: string) {
  const task = taskOf(taskId);
  if (!task || task.status !== "scheduled") return;
  task.status = "departed";
  task.departedAt = new Date().toISOString();
  storage.saveTasks(tasks.value);
}

/** 发车前取消，释放占用 */
export function cancelTask(taskId: string) {
  const task = taskOf(taskId);
  if (!task || task.status !== "scheduled") return;
  task.status = "canceled";
  storage.saveTasks(tasks.value);
}

/** 正常回场：铅封正常，任务终结、资源释放 */
export function returnNormal(taskId: string) {
  const task = taskOf(taskId);
  if (!task || task.status !== "departed") return;
  task.status = "returned";
  task.returnedAt = new Date().toISOString();
  storage.saveTasks(tasks.value);
}

/** 铅封异常回场：组合已冻结不能改，只能另存带原因修订 */
export function returnAbnormal(
  taskId: string,
  payload: { sealNo: string; reason: string; handler: string }
): { ok: boolean; violations: Violation[] } {
  const violations: Violation[] = [];
  const task = taskOf(taskId);
  if (!task || task.status !== "departed") {
    violations.push({ code: "status", level: "reject", message: "只有运输中的任务可以办理回场" });
    return { ok: false, violations };
  }
  if (!payload.sealNo.trim()) violations.push({ code: "sealNo", level: "reject", message: "请填写异常铅封号" });
  if (!payload.reason.trim()) violations.push({ code: "reason", level: "reject", message: "铅封异常必须填写原因，修订需带原因另存" });
  if (!payload.handler.trim()) violations.push({ code: "handler", level: "reject", message: "请填写登记人" });
  if (violations.length) return { ok: false, violations };

  const revision: SealRevision = {
    id: bizId("XD"),
    taskId,
    sealNo: payload.sealNo.trim(),
    reason: payload.reason.trim(),
    handler: payload.handler.trim(),
    at: new Date().toISOString()
  };
  revisions.value = [revision, ...revisions.value];
  storage.saveRevisions(revisions.value);

  task.status = "abnormal";
  task.returnedAt = revision.at;
  storage.saveTasks(tasks.value);
  return { ok: true, violations: [] };
}

// ---------- 换挂交接 ----------
export function createHandover(
  input: HandoverInput
): { ok: boolean; violations: Violation[] } {
  const violations = validateHandover(input, {
    tractors: TRACTORS,
    trailers: TRAILERS,
    drivers: DRIVERS,
    tasks: tasks.value,
    handovers: handovers.value
  });
  if (violations.length) return { ok: false, violations };

  const task = taskOf(input.taskId)!;
  const record: HandoverRecord = {
    id: bizId("HJ"),
    taskId: input.taskId,
    tractorId: task.tractorId,
    fromTrailerId: currentTrailerId(task, handovers.value),
    toTrailerId: input.toTrailerId,
    at: new Date(input.at).toISOString(),
    operator: input.operator.trim(),
    note: input.note?.trim() || undefined
  };
  handovers.value = [record, ...handovers.value];
  storage.saveHandovers(handovers.value);
  return { ok: true, violations: [] };
}

/** 确认原挂车交回：解除"原组合不得再派"挂账 */
export function confirmHandover(handoverId: string) {
  const h = handovers.value.find((x) => x.id === handoverId);
  if (!h || h.confirmedAt) return;
  h.confirmedAt = new Date().toISOString();
  storage.saveHandovers(handovers.value);
}

// ---------- 维护 ----------
export function reseed() {
  const data = storage.reseed();
  tasks.value = data.tasks;
  handovers.value = data.handovers;
  revisions.value = data.revisions;
}

export function clearAll() {
  const data = storage.clearAll();
  tasks.value = data.tasks;
  handovers.value = data.handovers;
  revisions.value = data.revisions;
}

// ---------- 占用派生（刷新后由任务+交接自动重算，不做冗余存储） ----------
export interface TrailerStatus {
  trailer: Trailer;
  state: "active" | "pending" | "maintenance" | "free";
  label: string;
  detail: string;
  taskId?: string;
}

/** 检修判定（以今天为准） */
export function trailerInMaintenance(trailer: Trailer, day = new Date()): boolean {
  if (!trailer.maintenanceStart || !trailer.maintenanceEnd) return false;
  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
    day.getDate()
  ).padStart(2, "0")}`;
  return key >= trailer.maintenanceStart && key <= trailer.maintenanceEnd;
}

export const trailerStatuses = computed<TrailerStatus[]>(() => {
  const now = Date.now();
  return TRAILERS.map((trailer) => {
    // 挂账：该挂车被换下线且未确认交回
    const pending = handovers.value.find((h) => !h.confirmedAt && h.fromTrailerId === trailer.id);
    if (pending) {
      const t = taskOf(pending.taskId);
      return {
        trailer,
        state: "pending",
        label: "待交回",
        detail: `已换下，等待确认交回（任务「${t?.content ?? "—"}」，${pending.operator}）`,
        taskId: pending.taskId
      };
    }
    // 在挂占用
    const occupant = tasks.value
      .filter(isActive)
      .find((t) => currentTrailerId(t, handovers.value) === trailer.id);
    if (occupant) {
      const running = now >= new Date(occupant.startAt).getTime();
      return {
        trailer,
        state: "active",
        label: running ? "在挂运输" : "已排占用",
        detail: `任务「${occupant.content}」（${occupant.status === "departed" ? "运输中" : "待发车"}）`,
        taskId: occupant.id
      };
    }
    if (trailerInMaintenance(trailer)) {
      return {
        trailer,
        state: "maintenance",
        label: "检修中",
        detail: `检修期 ${trailer.maintenanceStart} ~ ${trailer.maintenanceEnd}${trailer.note ? `（${trailer.note}）` : ""}`
      };
    }
    return { trailer, state: "free", label: "可派挂", detail: "当前无占用" };
  });
});

export const metrics = computed(() => ({
  active: tasks.value.filter(isActive).length,
  pending: handovers.value.filter((h) => !h.confirmedAt).length,
  abnormal: tasks.value.filter((t) => t.status === "abnormal").length,
  freeTrailers: trailerStatuses.value.filter((s) => s.state === "free").length
}));
