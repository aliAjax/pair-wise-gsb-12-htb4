/**
 * 车辆资料层：牵引车、挂车、司机的主数据，以及交接台账领域类型。
 * 该文件只描述“有什么资料”，不包含判定规则与持久化逻辑。
 */

export interface MaintenanceRange {
  start: string; // ISO 本地时刻 yyyy-MM-ddTHH:mm
  end: string;
  reason: string;
}

export interface Tractor {
  id: string;
  plate: string;
  model: string;
  team: string;
}

export interface Trailer {
  id: string;
  plate: string;
  model: string;
  capacity: string;
  maintenance: MaintenanceRange[];
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  /** 当前已记分（0-12） */
  points: number;
}

export type TaskStatus = "待发车" | "在途" | "已回场";
export type SealStatus = "正常" | "异常";

/** 派车任务（甩挂运输交接单） */
export interface DispatchTask {
  id: string;
  tractorId: string;
  /** 当前挂载挂车；换挂经交接记录生效后更新 */
  trailerId: string;
  /** 发车时的原挂车，组合冻结后不可变更 */
  originalTrailerId: string;
  driverId: string;
  startAt: string;
  endAt: string;
  route: string;
  notes: string;
  status: TaskStatus;
  departedAt?: string;
  returnedAt?: string;
  sealStatus?: SealStatus;
  createdAt: string;
}

export type HandoverStatus = "待确认交回" | "已确认交回";

/** 换挂交接记录 */
export interface TrailerHandover {
  id: string;
  taskId: string;
  tractorId: string;
  fromTrailerId: string;
  toTrailerId: string;
  detachedAt: string;
  attachedAt: string;
  location: string;
  operator: string;
  note: string;
  status: HandoverStatus;
  confirmedAt?: string;
  createdAt: string;
}

/** 铅封异常等只允许“另存”的修订记录，不回写任务原始数据 */
export interface RevisionRecord {
  id: string;
  taskId: string;
  kind: "铅封异常" | "其他";
  reason: string;
  oldSealNo: string;
  newSealNo: string;
  detail: string;
  reportedAt: string;
  createdAt: string;
}

export interface Ledger {
  version: 1;
  seq: { task: number; handover: number; revision: number };
  tasks: DispatchTask[];
  handovers: TrailerHandover[];
  revisions: RevisionRecord[];
}

export const TRACTORS: Tractor[] = [
  { id: "t1", plate: "沪A·D8206", model: "解放 J7", team: "一队" },
  { id: "t2", plate: "沪B·F3719", model: "重汽豪沃 T7H", team: "一队" },
  { id: "t3", plate: "沪C·K6052", model: "东风天龙 KL", team: "二队" },
  { id: "t4", plate: "沪A·P9148", model: "陕汽德龙 X5000", team: "二队" }
];

export const TRAILERS: Trailer[] = [
  { id: "tr1", plate: "沪D·0138挂", model: "三轴栏板半挂", capacity: "34t", maintenance: [] },
  { id: "tr2", plate: "沪E·2706挂", model: "厢式半挂", capacity: "32t", maintenance: [] },
  {
    id: "tr3",
    plate: "沪F·4491挂",
    model: "冷藏半挂",
    capacity: "30t",
    maintenance: [
      {
        start: "2026-09-21T20:00",
        end: "2026-09-23T18:00",
        reason: "制冷机组检修"
      }
    ]
  },
  {
    id: "tr4",
    plate: "沪E·5820挂",
    model: "集装箱骨架半挂",
    capacity: "35t",
    maintenance: [
      {
        start: "2026-09-25T08:00",
        end: "2026-09-26T18:00",
        reason: "制动系统检修"
      }
    ]
  }
];

export const DRIVERS: Driver[] = [
  { id: "d1", name: "马奔", phone: "138-0182-0456", points: 0 },
  { id: "d2", name: "罗海峰", phone: "139-1776-2310", points: 3 },
  { id: "d3", name: "田跃", phone: "137-6110-8524", points: 10 },
  { id: "d4", name: "高庆", phone: "135-0219-4471", points: 6 }
];

export const tractorsById = new Map(TRACTORS.map((item) => [item.id, item]));
export const trailersById = new Map(TRAILERS.map((item) => [item.id, item]));
export const driversById = new Map(DRIVERS.map((item) => [item.id, item]));
