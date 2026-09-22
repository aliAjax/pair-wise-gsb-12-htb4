/**
 * 判定规则层：占用情况只读推导。
 * 占用、交接状态一律由持久化台账实时推导，保证刷新后与任务、交接、修订一致。
 */
import type {
  DispatchTask,
  Trailer,
  TrailerHandover,
  Tractor,
  Driver
} from "../data/master";
import { within } from "./time";

export type OccupancyKind = "检修" | "待发车占用" | "在途占用" | "待交回锁定" | "空闲";

export interface TrailerOccupancy {
  kind: OccupancyKind;
  trailerId: string;
  taskId?: string;
  handoverId?: string;
  detail: string;
  /** 当前组合（换挂后与原组合可能不同） */
  combo?: string;
}

export function trailerOccupancy(
  trailer: Trailer,
  tasks: DispatchTask[],
  handovers: TrailerHandover[],
  nowIso: string
): TrailerOccupancy {
  const maintenance = trailer.maintenance.find((range) => within(nowIso, range.start, range.end));
  if (maintenance) {
    return {
      kind: "检修",
      trailerId: trailer.id,
      detail: `检修中：${maintenance.reason}（至 ${maintenance.end.replace("T", " ")}）`
    };
  }

  // 已挂在未完成任务上：以任务当前的 trailerId 为准。
  const active = tasks.find(
    (task) => (task.status === "待发车" || task.status === "在途") && task.trailerId === trailer.id
  );
  if (active) {
    return {
      kind: active.status === "待发车" ? "待发车占用" : "在途占用",
      trailerId: trailer.id,
      taskId: active.id,
      combo: `${active.tractorId}|${active.trailerId}|${active.driverId}`,
      detail: `${active.status} · 任务 ${active.id}（${active.startAt.replace("T", " ")} ~ ${active.endAt.replace(
        "T",
        " "
      )}）`
    };
  }

  // 作为“原挂车”存在未确认交回的交接：原组合锁定，挂车本身可能已在堆场。
  const open = handovers.find(
    (handover) => handover.status === "待确认交回" && handover.fromTrailerId === trailer.id
  );
  if (open) {
    return {
      kind: "待交回锁定",
      trailerId: trailer.id,
      handoverId: open.id,
      taskId: open.taskId,
      combo: `${open.tractorId}|${open.fromTrailerId}`,
      detail: `交接 ${open.id} 原挂待交回（${open.location}），原组合 ${open.tractorId}+${open.fromTrailerId} 已锁定`
    };
  }

  return { kind: "空闲", trailerId: trailer.id, detail: "可派车 / 可换挂" };
}

export type ActiveKind = "待发车" | "在途" | "空闲";

export interface UnitOccupancy {
  kind: ActiveKind;
  taskId?: string;
  detail: string;
}

export function tractorOccupancy(tractor: Tractor, tasks: DispatchTask[]): UnitOccupancy {
  const task = tasks.find(
    (item) => (item.status === "待发车" || item.status === "在途") && item.tractorId === tractor.id
  );
  if (!task) return { kind: "空闲", detail: "可派车" };
  return {
    kind: task.status as ActiveKind,
    taskId: task.id,
    detail: `任务 ${task.id} · 当前挂 ${task.trailerId}`
  };
}

export function driverOccupancy(driver: Driver, tasks: DispatchTask[]): UnitOccupancy {
  const task = tasks.find(
    (item) => (item.status === "待发车" || item.status === "在途") && item.driverId === driver.id
  );
  if (!task) return { kind: "空闲", detail: `可派车（已记 ${driver.points} 分）` };
  return {
    kind: task.status as ActiveKind,
    taskId: task.id,
    detail: `任务 ${task.id} · 驾 ${task.tractorId}`
  };
}

export function isActiveTask(task: DispatchTask): boolean {
  return task.status === "待发车" || task.status === "在途";
}
