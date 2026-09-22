// 甩挂运输交接台 —— 领域类型定义
// 车辆资料（牵引车 / 挂车 / 司机）、任务、交接、修订四类核心数据。

/** 牵引车（提供动力，挂黄牌；执行车牌尾号限行） */
export interface Tractor {
  id: string;
  /** 车牌，如 沪D·8266 */
  plate: string;
  /** 车型/准牵引总质量说明 */
  model: string;
}

/** 挂车（无动力，挂白牌；存在检修期） */
export interface Trailer {
  id: string;
  plate: string;
  /** 车型/载重说明 */
  model: string;
  /** 检修起（含），YYYY-MM-DD；为空表示当前无检修计划 */
  maintenanceStart?: string;
  /** 检修止（含），YYYY-MM-DD */
  maintenanceEnd?: string;
  note?: string;
}

/** 司机（执行记分门槛判定） */
export interface Driver {
  id: string;
  name: string;
  phone: string;
  /** 当前累计记分（0~12），记满 12 分需重新学习 */
  points: number;
}

/**
 * 任务状态
 * scheduled 待发车：发车前可取消；资源参与占用
 * departed  运输中：组合已冻结，只能走换挂交接 / 回场
 * returned  正常回场：终态，资源释放
 * abnormal  铅封异常回场：终态（另存修订），资源释放、组合留痕
 * canceled  取消：发车前取消，资源释放
 */
export type TaskStatus = "scheduled" | "departed" | "returned" | "abnormal" | "canceled";

/** 派车任务（发车后 tractorId/driverId/起止时刻冻结，不允许直接改） */
export interface DispatchTask {
  id: string;
  /** 运输任务内容 */
  content: string;
  tractorId: string;
  /** 出发时挂的挂车（冻结留痕） */
  trailerId: string;
  driverId: string;
  /** 起始时刻 ISO */
  startAt: string;
  /** 截止时刻 ISO */
  endAt: string;
  status: TaskStatus;
  createdAt: string;
  /** 发车时刻（未发车为空） */
  departedAt?: string;
  /** 回场时刻 */
  returnedAt?: string;
}

/**
 * 换挂交接记录
 * 换挂先形成交接记录；原牵引车+原挂车组合在 confirmedAt 之前不得再次派车。
 */
export interface HandoverRecord {
  id: string;
  taskId: string;
  tractorId: string;
  /** 换下的挂车（原组合挂车） */
  fromTrailerId: string;
  /** 换上的挂车 */
  toTrailerId: string;
  /** 交接时刻 */
  at: string;
  operator: string;
  /** 原挂车交回确认时刻；未确认表示原组合仍在挂账，不得再派 */
  confirmedAt?: string;
  note?: string;
}

/** 回场铅封异常修订（发车后组合冻结，异常只能另存，附原因） */
export interface SealRevision {
  id: string;
  taskId: string;
  /** 异常铅封号 */
  sealNo: string;
  reason: string;
  at: string;
  handler: string;
}

/** 校验命中项（整单不通过时逐条列出，输入保留） */
export interface Violation {
  code: string;
  /** 命中类别，用于分组着色 */
  level: "reject";
  message: string;
}
