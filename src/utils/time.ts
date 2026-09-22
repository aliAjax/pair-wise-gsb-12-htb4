// 时间小工具：全部按浏览器本地时间处理，datetime-local 需要无时区后缀的 ISO 串。

/** Date -> "YYYY-MM-DDTHH:mm"（datetime-local 的值） */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** 取某天指定时分的本地时间 */
export function dateAt(base: Date, hours: number, minutes = 0): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** "YYYY-MM-DD" -> Date（本地零点） */
export function dayStart(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** 半开区间重叠判断 [aStart,aEnd) ∩ [bStart,bEnd) */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** 展示用："MM-DD HH:mm" */
export function fmtDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 展示用："YYYY-MM-DD" */
export function fmtDay(day?: string): string {
  return day ?? "—";
}

/** 生成业务编号 */
export function bizId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${Date.now().toString(36)}${rand}`;
}
