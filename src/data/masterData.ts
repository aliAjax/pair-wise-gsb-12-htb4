// 车辆资料：牵引车、挂车、司机的基础档案，以及车牌尾号限行规则表。
// 只负责"资料"，不读取 localStorage；业务数据见 storage.ts。

import type { Driver, Tractor, Trailer } from "../types";

/** 牵引车档案 */
export const TRACTORS: Tractor[] = [
  { id: "tr1", plate: "沪D·8266", model: "解放 J7 · 460 马力" },
  { id: "tr2", plate: "沪D·5312", model: "东风天龙 KL · 440 马力" },
  { id: "tr3", plate: "沪D·9048", model: "重汽豪沃 T7H · 480 马力" },
  { id: "tr4", plate: "沪D·2175", model: "陕汽德龙 X5000 · 500 马力" }
];

/**
 * 挂车档案（含检修期，日期含端点）
 * 日期为相对演示种子生成，见 seed.ts；这里给 2026-09 固定窗口，覆盖当前日期。
 */
export const TRAILERS: Trailer[] = [
  {
    id: "tl1",
    plate: "沪J挂 036",
    model: "40 尺三轴集装箱半挂",
    maintenanceStart: "2026-09-20",
    maintenanceEnd: "2026-09-25",
    note: "气路整改"
  },
  { id: "tl2", plate: "沪J挂 118", model: "40 尺三轴集装箱半挂" },
  { id: "tl3", plate: "沪J挂 205", model: "13.75 米仓栅半挂" },
  { id: "tl4", plate: "沪J挂 472", model: "40 尺三轴集装箱半挂" }
];

/** 司机档案（points 为当前累计记分） */
export const DRIVERS: Driver[] = [
  { id: "dv1", name: "董铁山", phone: "138-0173-2266", points: 3 },
  { id: "dv2", name: "周航行", phone: "139-1852-7310", points: 6 },
  { id: "dv3", name: "高立群", phone: "137-6640-9048", points: 11 },
  { id: "dv4", name: "陆长河", phone: "136-2217-5005", points: 0 }
];

/**
 * 车牌尾号限行规则（工作日 7:00–20:00，按星期轮换，与城市尾号限行口径一致）
 * week: 1=周一 … 5=周五；digits: 当日禁行尾号；限行窗口按本地时间判定。
 */
export const TAIL_RESTRICTIONS: { week: number; digits: number[] }[] = [
  { week: 1, digits: [1, 6] },
  { week: 2, digits: [2, 7] },
  { week: 3, digits: [3, 8] },
  { week: 4, digits: [4, 9] },
  { week: 5, digits: [5, 0] }
];

export const RESTRICT_START_HOUR = 7;
export const RESTRICT_END_HOUR = 20;

/** 司机记分门槛：剩余可记分低于该值（即当前记分过高）不得派车 */
export const DRIVER_POINT_LIMIT = 3;

/** 取车牌最后一位数字作为限行尾号；车牌无数字尾号时返回 null */
export function tailDigit(plate: string): number | null {
  const match = plate.match(/(\d)\D*$/);
  return match ? Number(match[1]) : null;
}
