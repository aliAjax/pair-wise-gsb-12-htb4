/**
 * 判定规则层：硬编码业务参数与四类整单拦截规则（纯函数）。
 *
 * 规则总览（任一命中即整单不通过，保留全部输入，逐项列出命中项）：
 *  1. 挂车检修期：任务时段与挂车检修期相交；
 *  2. 车牌尾号限行：牵引车尾号在覆盖日期落入限行映射（工作日 7:00-20:00）；
 *  3. 司机记分不足：当前记分已达到 SCORE_LIMIT（12 分制下累计 9 分即拦截）；
 *  4. 时段重叠：牵引车 / 挂车 / 司机与未完成任务时段相交，
 *     或“牵引车 + 挂车”原组合存在未确认交回的换挂交接。
 */
import type { DispatchTask, Driver, Trailer, TrailerHandover, Tractor } from "../data/master";
import { eachCoveredDate, overlaps, plateTailDigit, toTime, within } from "./time";

/** 司机累计记分阈值：达到该分值（含）不得再派车（12 分制）。 */
export const SCORE_LIMIT = 9;

/** 限行适用时刻范围：每日 [07:00, 20:00)。 */
export const RESTRICT_START = "07:00";
export const RESTRICT_END = "20:00";

/**
 * 车牌尾号限行映射（周一至周五）。
 * 默认采用常见“五日制”轮换口径，实际以属地交管通告为准，
 * 调整本映射即可改变判定，不需改动调用方。
 */
export const WEEKDAY_TAIL_RESTRICTION: Readonly<Record<1 | 2 | 3 | 4 | 5, readonly number[]>> = {
  1: [3, 8],
  2: [4, 9],
  3: [5, 0],
  4: [6, 1],
  5: [7, 2]
};

export interface DispatchDraft {
  tractorId: string;
  trailerId: string;
  driverId: string;
  startAt: string;
  endAt: string;
  route: string;
  notes: string;
}

export interface RuleHit {
  /** 命中规则编码，便于列表分组与高亮 */
  code: "FORM" | "TRAILER_MAINT" | "PLATE_RESTRICT" | "DRIVER_SCORE" | "OVERLAP" | "OPEN_HANDOVER";
  label: string;
  detail: string;
}

export interface EvaluateInput {
  draft: DispatchDraft;
  tractor?: Tractor;
  trailer?: Trailer;
  driver?: Driver;
  /** 未完成任务（待发车 / 在途），用于时段重叠判定 */
  activeTasks: DispatchTask[];
  /** 未确认交回的交接记录 */
  openHandovers: TrailerHandover[];
  /** 编辑既有任务时排除自身 */
  excludeTaskId?: string;
}

export interface EvaluateResult {
  ok: boolean;
  hits: RuleHit[];
}

/** 表单完整性与时段合法性（同样按命中项列出，整单不通过）。 */
export function checkForm(draft: DispatchDraft): RuleHit[] {
  const hits: RuleHit[] = [];
  if (!draft.tractorId) hits.push({ code: "FORM", label: "牵引车未选择", detail: "请选择牵引车。" });
  if (!draft.trailerId) hits.push({ code: "FORM", label: "挂车未选择", detail: "请选择挂车。" });
  if (!draft.driverId) hits.push({ code: "FORM", label: "司机未选择", detail: "请选择司机。" });
  if (!draft.startAt) hits.push({ code: "FORM", label: "起始时刻缺失", detail: "请填写起始时刻。" });
  if (!draft.endAt) hits.push({ code: "FORM", label: "结束时刻缺失", detail: "请填写预计回场时刻。" });
  if (draft.startAt && draft.endAt && toTime(draft.endAt) <= toTime(draft.startAt)) {
    hits.push({ code: "FORM", label: "起止时刻不合法", detail: "预计回场时刻必须晚于起始时刻。" });
  }
  return hits;
}

/** 规则 1：挂车检修期与任务时段相交（检修期为闭区间，端点相接也拦截）。 */
export function checkTrailerMaintenance(draft: DispatchDraft, trailer?: Trailer): RuleHit[] {
  if (!trailer || !draft.startAt || !draft.endAt) return [];
  const hits: RuleHit[] = [];
  for (const range of trailer.maintenance) {
    // 相交判定：检修开始早于任务结束，且检修结束晚于任务开始（检修端点视为占用）。
    const intersects =
      toTime(range.start) < toTime(draft.endAt) && toTime(range.end) > toTime(draft.startAt);
    if (intersects || within(draft.startAt, range.start, range.end) || within(draft.endAt, range.start, range.end)) {
      hits.push({
        code: "TRAILER_MAINT",
        label: "挂车检修期",
        detail: `${trailer.plate} 检修「${range.reason}」（${range.start.replace("T", " ")} ~ ${range.end.replace("T", " ")}）与任务时段相交。`
      });
    }
  }
  return hits;
}

/** 规则 2：牵引车车牌尾号限行（只限牵引车，不限挂车）。 */
export function checkPlateRestriction(draft: DispatchDraft, tractor?: Tractor): RuleHit[] {
  if (!tractor || !draft.startAt || !draft.endAt) return [];
  const tail = plateTailDigit(tractor.plate);
  if (tail === null) return [];
  const hits: RuleHit[] = [];
  const seen = new Set<string>();
  for (const day of eachCoveredDate(draft.startAt, draft.endAt)) {
    const weekday = day.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    if (weekday === 0 || weekday === 6) continue; // 周末不限
    const tails = WEEKDAY_TAIL_RESTRICTION[weekday];
    if (!tails.includes(tail)) continue;
    // 当日任务时段与限行时段 [07:00, 20:00) 有交集才命中。
    const dayPrefix = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
      day.getDate()
    ).padStart(2, "0")}`;
    if (overlaps(draft.startAt, draft.endAt, `${dayPrefix}T${RESTRICT_START}`, `${dayPrefix}T${RESTRICT_END}`)) {
      const key = dayPrefix;
      if (seen.has(key)) continue;
      seen.add(key);
      const weekdayName = ["日", "一", "二", "三", "四", "五", "六"][weekday];
      hits.push({
        code: "PLATE_RESTRICT",
        label: "车牌尾号限行",
        detail: `${tractor.plate}（尾号 ${tail}）在周${weekdayName} ${dayPrefix} 限行，时段 ${RESTRICT_START}-${RESTRICT_END} 与任务重叠。`
      });
    }
  }
  return hits;
}

/** 规则 3：司机记分不足。 */
export function checkDriverScore(driver?: Driver): RuleHit[] {
  if (!driver) return [];
  if (driver.points >= SCORE_LIMIT) {
    return [
      {
        code: "DRIVER_SCORE",
        label: "司机记分不足",
        detail: `${driver.name} 当前已记 ${driver.points} 分，达到 ${SCORE_LIMIT} 分阈值（12 分制），不得派车。`
      }
    ];
  }
  return [];
}

/** 规则 4a：牵引车 / 挂车 / 司机与未完成任务的时段重叠。 */
export function checkOverlap(draft: DispatchDraft, activeTasks: DispatchTask[], excludeTaskId?: string): RuleHit[] {
  if (!draft.startAt || !draft.endAt) return [];
  const hits: RuleHit[] = [];
  const findTractor = (id: string) => activeTasks.find((task) => task.id !== excludeTaskId && task.tractorId === id);
  const findTrailer = (id: string) =>
    activeTasks.find((task) => task.id !== excludeTaskId && task.trailerId === id);
  const findDriver = (id: string) => activeTasks.find((task) => task.id !== excludeTaskId && task.driverId === id);

  const conflictT = draft.tractorId ? findTractor(draft.tractorId) : undefined;
  if (conflictT && overlaps(draft.startAt, draft.endAt, conflictT.startAt, conflictT.endAt)) {
    hits.push({
      code: "OVERLAP",
      label: "牵引车时段重叠",
      detail: `牵引车与任务 ${conflictT.id}（${conflictT.startAt.replace("T", " ")} ~ ${conflictT.endAt.replace(
        "T",
        " "
      )}）时段重叠。`
    });
  }
  const conflictR = draft.trailerId ? findTrailer(draft.trailerId) : undefined;
  if (conflictR && overlaps(draft.startAt, draft.endAt, conflictR.startAt, conflictR.endAt)) {
    hits.push({
      code: "OVERLAP",
      label: "挂车时段重叠",
      detail: `挂车与任务 ${conflictR.id}（${conflictR.startAt.replace("T", " ")} ~ ${conflictR.endAt.replace(
        "T",
        " "
      )}）时段重叠。`
    });
  }
  const conflictD = draft.driverId ? findDriver(draft.driverId) : undefined;
  if (conflictD && overlaps(draft.startAt, draft.endAt, conflictD.startAt, conflictD.endAt)) {
    hits.push({
      code: "OVERLAP",
      label: "司机时段重叠",
      detail: `司机与任务 ${conflictD.id}（${conflictD.startAt.replace("T", " ")} ~ ${conflictD.endAt.replace(
        "T",
        " "
      )}）时段重叠。`
    });
  }
  return hits;
}

/** 规则 4b：同“牵引车 + 挂车”原组合存在未确认交回的交接，不得再次派车。 */
export function checkOpenHandover(
  draft: DispatchDraft,
  openHandovers: TrailerHandover[],
  excludeTaskId?: string
): RuleHit[] {
  if (!draft.tractorId || !draft.trailerId) return [];
  const hit = openHandovers.find(
    (handover) =>
      handover.tractorId === draft.tractorId &&
      handover.fromTrailerId === draft.trailerId &&
      handover.taskId !== excludeTaskId
  );
  if (!hit) return [];
  return [
    {
      code: "OPEN_HANDOVER",
      label: "原组合未确认交回",
      detail: `交接 ${hit.id}（任务 ${hit.taskId}）的原组合尚未确认交回，确认交回前该牵引车与该挂车不得再次组合派车。`
    }
  ];
}

/** 汇总执行整单校验。 */
export function evaluateDispatch(input: EvaluateInput): EvaluateResult {
  const { draft, tractor, trailer, driver, activeTasks, openHandovers, excludeTaskId } = input;
  const hits = [
    ...checkForm(draft),
    ...checkTrailerMaintenance(draft, trailer),
    ...checkPlateRestriction(draft, tractor),
    ...checkDriverScore(driver),
    ...checkOverlap(draft, activeTasks, excludeTaskId),
    ...checkOpenHandover(draft, openHandovers, excludeTaskId)
  ];
  return { ok: hits.length === 0, hits };
}

/** 换挂草稿的单独校验：目标挂车不得检修、不得与在途/待发车任务占用重叠。 */
export interface SwapDraft {
  taskId: string;
  toTrailerId: string;
  detachedAt: string;
  attachedAt: string;
  location: string;
  operator: string;
  note: string;
}

export function evaluateSwap(
  draft: SwapDraft,
  target?: Trailer,
  activeTasks: DispatchTask[] = []
): RuleHit[] {
  const hits: RuleHit[] = [];
  if (!draft.toTrailerId) hits.push({ code: "FORM", label: "挂车未选择", detail: "请选择换入挂车。" });
  if (!draft.detachedAt || !draft.attachedAt) {
    hits.push({ code: "FORM", label: "交接时刻缺失", detail: "请填写摘挂与挂接时刻。" });
  } else if (toTime(draft.attachedAt) < toTime(draft.detachedAt)) {
    hits.push({ code: "FORM", label: "交接时刻不合法", detail: "挂接时刻不得早于摘挂时刻。" });
  }
  if (!draft.location.trim()) hits.push({ code: "FORM", label: "交接地点缺失", detail: "请填写交接地点。" });
  if (!draft.operator.trim()) hits.push({ code: "FORM", label: "交接人缺失", detail: "请填写现场交接人。" });

  if (target && draft.detachedAt && draft.attachedAt) {
    for (const range of target.maintenance) {
      if (
        (toTime(draft.detachedAt) >= toTime(range.start) && toTime(draft.detachedAt) <= toTime(range.end)) ||
        (toTime(draft.attachedAt) >= toTime(range.start) && toTime(draft.attachedAt) <= toTime(range.end))
      ) {
        hits.push({
          code: "TRAILER_MAINT",
          label: "换入挂车检修期",
          detail: `${target.plate} 检修「${range.reason}」覆盖交接时刻，不能挂接。`
        });
      }
    }
    const occupied = activeTasks.find(
      (task) => task.id !== draft.taskId && task.trailerId === target.id
    );
    if (occupied) {
      hits.push({
        code: "OVERLAP",
        label: "换入挂车被占用",
        detail: `${target.plate} 当前由任务 ${occupied.id} 占用（状态：${occupied.status}），不能换挂。`
      });
    }
  }
  return hits;
}
