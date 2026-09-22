/**
 * 判定规则层：时刻与区间工具（纯函数）。
 */

/** 将 yyyy-MM-ddTHH:mm 转为时间戳（按本地时区）。 */
export function toTime(value: string): number {
  if (!value) return NaN;
  return new Date(value.replace(" ", "T")).getTime();
}

/** 两个半开区间是否占用重叠（端点相接不算重叠，允许 10:00 回场、10:00 再派）。 */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = toTime(aStart);
  const ae = toTime(aEnd);
  const bs = toTime(bStart);
  const be = toTime(bEnd);
  if ([as, ae, bs, be].some(Number.isNaN)) return false;
  return as < be && bs < ae;
}

/** 点时刻是否落在闭区间内（检修期按闭区间拦截，端点不安排任务）。 */
export function within(point: string, rangeStart: string, rangeEnd: string): boolean {
  const p = toTime(point);
  const s = toTime(rangeStart);
  const e = toTime(rangeEnd);
  if ([p, s, e].some(Number.isNaN)) return false;
  return p >= s && p <= e;
}

/** 枚举任务时段覆盖到的每一天（用于跨日车牌限行逐日判定）。 */
export function eachCoveredDate(startAt: string, endAt: string): Date[] {
  const start = new Date(startAt.replace(" ", "T"));
  const end = new Date(endAt.replace(" ", "T"));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const days: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 当前日期默认起运时刻（今天 08:00 / 次日 17:00）。 */
export function defaultWindow(now: Date = new Date()): { startAt: string; endAt: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const start = new Date(now);
  start.setHours(8, 0, 0, 0);
  if (start.getTime() < now.getTime()) start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(17, 0, 0, 0);
  return { startAt: fmt(start), endAt: fmt(end) };
}

/** 从车牌提取用于限行/比对的尾号数字；挂车“挂”字先剔除。 */
export function plateTailDigit(plate: string): number | null {
  const compact = plate.replace(/[·.\s-]/g, "").replace(/挂$/, "");
  const match = compact.match(/(\d)[^0-9]*$/);
  return match ? Number(match[1]) : null;
}

export function fmtDateTime(value?: string): string {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDate(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
