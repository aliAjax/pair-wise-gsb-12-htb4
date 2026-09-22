// 判定规则：挂车检修期、车牌尾号限行、司机记分、时段重叠、挂账原组合拦截。
// 纯函数模块：输入资料 + 业务数据，输出命中项列表；不读写 localStorage。

import type {
  DispatchTask,
  Driver,
  HandoverRecord,
  Tractor,
  Trailer,
  Violation
} from "../types";
import {
  DRIVER_POINT_LIMIT,
  RESTRICT_END_HOUR,
  RESTRICT_START_HOUR,
  TAIL_RESTRICTIONS,
  tailDigit
} from "../data/masterData";
import { dayStart, overlaps } from "../utils/time";

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface DispatchInput {
  content: string;
  tractorId: string;
  trailerId: string;
  driverId: string;
  /** datetime-local 原值 */
  startAt: string;
  endAt: string;
}

export interface RuleContext {
  tractors: Tractor[];
  trailers: Trailer[];
  drivers: Driver[];
  tasks: DispatchTask[];
  handovers: HandoverRecord[];
}

/** 任务当前实际挂载的挂车：取最近一次换挂的目标挂车，否则为出场挂车 */
export function currentTrailerId(task: DispatchTask, handovers: HandoverRecord[]): string {
  const list = handovers
    .filter((h) => h.taskId === task.id)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return list.length ? list[list.length - 1].toTrailerId : task.trailerId;
}

/** 参与资源占用的任务：待发车、运输中 */
export function isActive(task: DispatchTask): boolean {
  return task.status === "scheduled" || task.status === "departed";
}

/** 挂车检修期与任务时段是否相撞（按日期，检修含端点；任务按起止日逐日判定） */
export function maintenanceHit(trailer: Trailer, start: Date, end: Date): string | null {
  if (!trailer.maintenanceStart || !trailer.maintenanceEnd) return null;
  const mStart = dayStart(trailer.maintenanceStart);
  const mEnd = dayStart(trailer.maintenanceEnd);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = dayStart(dayKey(d));
    if (day.getTime() >= mStart.getTime() && day.getTime() <= mEnd.getTime()) {
      return `${trailer.maintenanceStart} ~ ${trailer.maintenanceEnd}`;
    }
  }
  return null;
}

/**
 * 车牌尾号限行命中：遍历任务覆盖的每一天，工作日 7:00–20:00 时段相撞即命中。
 * 返回命中的日期+尾号说明，未命中返回 null。
 */
export function restrictionHit(plate: string, start: Date, end: Date): string | null {
  const digit = tailDigit(plate);
  if (digit == null) return null;
  const hits: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const matched = TAIL_RESTRICTIONS.find(
      (r) => r.week === d.getDay() && r.digits.includes(digit)
    );
    if (matched) {
      const winStart = new Date(d);
      winStart.setHours(RESTRICT_START_HOUR, 0, 0, 0);
      const winEnd = new Date(d);
      winEnd.setHours(RESTRICT_END_HOUR, 0, 0, 0);
      if (overlaps(start, end, winStart, winEnd)) {
        hits.push(`${dayKey(d)} 禁行尾号 ${matched.digits.join("/")}`);
      }
    }
  }
  return hits.length ? `${plate} 尾号 ${digit}：${hits.join("；")}` : null;
}

/** 司机记分是否不足：剩余可记分 < 门槛 */
export function driverScoreBlocked(driver: Driver): boolean {
  return 12 - driver.points < DRIVER_POINT_LIMIT;
}

/**
 * 派车整单校验：任一命中即整单不通过，返回全部命中项（前端保留输入并列出）。
 */
export function validateDispatch(input: DispatchInput, ctx: RuleContext): Violation[] {
  const violations: Violation[] = [];
  const reject = (code: string, message: string) => violations.push({ code, level: "reject", message });

  if (!input.content.trim()) reject("content", "请填写运输任务内容");
  const tractor = ctx.tractors.find((t) => t.id === input.tractorId);
  const trailer = ctx.trailers.find((t) => t.id === input.trailerId);
  const driver = ctx.drivers.find((d) => d.id === input.driverId);
  if (!tractor) reject("tractor", "请选择牵引车");
  if (!trailer) reject("trailer", "请选择挂车");
  if (!driver) reject("driver", "请选择司机");

  const start = input.startAt ? new Date(input.startAt) : null;
  const end = input.endAt ? new Date(input.endAt) : null;
  if (!start || Number.isNaN(start.getTime())) reject("startAt", "请选择起始时刻");
  if (!end || Number.isNaN(end.getTime())) reject("endAt", "请选择截止时刻");
  if (start && end && end.getTime() <= start.getTime()) {
    reject("endAt", "截止时刻必须晚于起始时刻");
  }

  if (!tractor || !trailer || !driver || !start || !end || end <= start) return violations;

  // 1) 挂车检修期
  const mh = maintenanceHit(trailer, start, end);
  if (mh) reject("maintenance", `挂车 ${trailer.plate} 处于检修期（${mh}${trailer.note ? `，${trailer.note}` : ""}），不得派挂`);

  // 2) 车牌尾号限行
  const rh = restrictionHit(tractor.plate, start, end);
  if (rh) reject("restriction", `${rh}（限行时段 ${pad(RESTRICT_START_HOUR)}:00–${pad(RESTRICT_END_HOUR)}:00）`);

  // 3) 司机记分不足
  if (driverScoreBlocked(driver)) {
    reject(
      "driverScore",
      `司机 ${driver.name} 当前已记 ${driver.points} 分，剩余记分 ${12 - driver.points} 分，不足 ${DRIVER_POINT_LIMIT} 分门槛`
    );
  }

  // 4) 时段重叠：牵引车 / 司机 / 挂车当前占用
  for (const task of ctx.tasks.filter(isActive)) {
    const tStart = new Date(task.startAt);
    const tEnd = new Date(task.endAt);
    if (!overlaps(start, end, tStart, tEnd)) continue;
    if (task.tractorId === tractor.id) {
      const other = ctx.drivers.find((d) => d.id === task.driverId);
      reject("overlapTractor", `牵引车 ${tractor.plate} 与任务「${task.content}」（${fmtRange(tStart, tEnd)}，司机 ${other?.name ?? "—"}）时段重叠`);
    }
    if (task.driverId === driver.id) {
      const otherT = ctx.tractors.find((t) => t.id === task.tractorId);
      reject("overlapDriver", `司机 ${driver.name} 与任务「${task.content}」（${fmtRange(tStart, tEnd)}，${otherT?.plate ?? "—"}）时段重叠`);
    }
    const busyTrailerId = currentTrailerId(task, ctx.handovers);
    if (busyTrailerId === trailer.id) {
      reject("overlapTrailer", `挂车 ${trailer.plate} 在任务「${task.content}」（${fmtRange(tStart, tEnd)}）期间仍在挂，时段重叠`);
    }
  }

  // 5) 换挂挂账：原牵引车+原挂车组合未确认交回前，不得再次派车（不看时段）
  for (const h of ctx.handovers.filter((h) => !h.confirmedAt)) {
    if (h.tractorId === tractor.id && h.fromTrailerId === trailer.id) {
      const task = ctx.tasks.find((t) => t.id === h.taskId);
      reject(
        "pendingHandover",
        `原组合 ${tractor.plate} + ${trailer.plate} 的换挂交接尚未确认交回（任务「${task?.content ?? h.taskId}」于 ${fmtRange(new Date(h.at), new Date(h.at))} 换下），确认交回前不得再次派车`
      );
    }
  }

  return violations;
}

export interface HandoverInput {
  taskId: string;
  toTrailerId: string;
  at: string;
  operator: string;
  note?: string;
}

/** 换挂校验：先成交接记录；目标挂车同样查检修与占用 */
export function validateHandover(input: HandoverInput, ctx: RuleContext): Violation[] {
  const violations: Violation[] = [];
  const reject = (code: string, message: string) => violations.push({ code, level: "reject", message });

  const task = ctx.tasks.find((t) => t.id === input.taskId);
  const target = ctx.trailers.find((t) => t.id === input.toTrailerId);
  const at = input.at ? new Date(input.at) : null;

  if (!task) reject("task", "任务不存在");
  if (task && task.status !== "departed") reject("taskStatus", "只有运输中的任务可以换挂");
  if (!target) reject("toTrailer", "请选择换上的挂车");
  if (!input.operator.trim()) reject("operator", "请填写交接经办人");
  if (!at || Number.isNaN(at.getTime())) reject("at", "请选择交接时刻");

  if (!task || !target || !at) return violations;

  const currentId = currentTrailerId(task, ctx.handovers);
  if (target.id === currentId) {
    reject("toTrailer", `目标挂车 ${target.plate} 与当前在挂挂车相同，无需换挂`);
  }

  const tStart = new Date(task.startAt);
  const tEnd = new Date(task.endAt);
  if (at.getTime() < tStart.getTime() || at.getTime() > tEnd.getTime()) {
    reject("at", `交接时刻必须在任务时段内（${fmtRange(tStart, tEnd)}）`);
  }

  const mh = maintenanceHit(target, at, at);
  if (mh) reject("maintenance", `目标挂车 ${target.plate} 处于检修期（${mh}），不得换挂`);

  // 目标挂车被其他在途任务占用（当前挂载即为占用）
  for (const other of ctx.tasks.filter((t) => isActive(t) && t.id !== task.id)) {
    if (currentTrailerId(other, ctx.handovers) !== target.id) continue;
    if (at.getTime() >= new Date(other.startAt).getTime() && at.getTime() <= new Date(other.endAt).getTime()) {
      reject("trailerBusy", `目标挂车 ${target.plate} 正被任务「${other.content}」占用（${fmtRange(new Date(other.startAt), new Date(other.endAt))}）`);
    }
  }

  return violations;
}

function fmtRange(start: Date, end: Date): string {
  const t = (d: Date) =>
    `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return start.getTime() === end.getTime() ? t(start) : `${t(start)} ~ ${t(end)}`;
}
