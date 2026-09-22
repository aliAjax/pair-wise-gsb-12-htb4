// 组件间共享的表单状态类型

import type { Violation } from "../types";

export interface DispatchFormState {
  content: string;
  tractorId: string;
  trailerId: string;
  driverId: string;
  /** datetime-local 原值（无时区后缀） */
  startAt: string;
  endAt: string;
}

export interface HandoverFormState {
  taskId: string;
  toTrailerId: string;
  at: string;
  operator: string;
  note: string;
}

export interface AbnormalFormState {
  sealNo: string;
  reason: string;
  handler: string;
}

export type { Violation };
