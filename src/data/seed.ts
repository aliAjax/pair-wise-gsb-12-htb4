// 首次进入的演示种子：按"今天"相对生成，保证检修期、限行、占用、挂账交接均可现场触发。

import type { DispatchTask, HandoverRecord, SealRevision } from "../types";
import { bizId, dateAt, toLocalInput } from "../utils/time";

export function buildSeed() {
  const now = new Date();
  const iso = (d: Date) => new Date(toLocalInput(d)).toISOString();

  // 今天 08:00–17:00 已发车：tr4 + tl3 出场，10:00 换挂到 tl4，原挂车 tl3 尚未确认交回
  const t1Start = dateAt(now, 8, 0);
  const t1End = dateAt(now, 17, 0);
  const task1: DispatchTask = {
    id: "seed-rw1",
    content: "临港集装箱疏港（A12 泊位）",
    tractorId: "tr4",
    trailerId: "tl3",
    driverId: "dv1",
    startAt: iso(t1Start),
    endAt: iso(t1End),
    status: "departed",
    createdAt: iso(dateAt(now, 7, 40)),
    departedAt: iso(dateAt(now, 8, 5))
  };
  const handover1: HandoverRecord = {
    id: "seed-hj1",
    taskId: task1.id,
    tractorId: "tr4",
    fromTrailerId: "tl3",
    toTrailerId: "tl4",
    at: iso(dateAt(now, 10, 0)),
    operator: "场站理货员 赵师傅",
    note: "B 区换装重箱，原空箱挂车留场待验"
  };

  // 今天 13:00–18:00 待发车：tr3 + tl2
  const task2: DispatchTask = {
    id: "seed-rw2",
    content: "医药冷链市区配送（三批次）",
    tractorId: "tr3",
    trailerId: "tl2",
    driverId: "dv2",
    startAt: iso(dateAt(now, 13, 0)),
    endAt: iso(dateAt(now, 18, 0)),
    status: "scheduled",
    createdAt: iso(dateAt(now, 9, 15))
  };

  // 前天已正常回场
  const dayMinus2 = new Date(now);
  dayMinus2.setDate(now.getDate() - 2);
  const task3: DispatchTask = {
    id: "seed-rw3",
    content: "昆山仓商超补货",
    tractorId: "tr2",
    trailerId: "tl4",
    driverId: "dv4",
    startAt: iso(dateAt(dayMinus2, 8, 0)),
    endAt: iso(dateAt(dayMinus2, 12, 0)),
    status: "returned",
    createdAt: iso(dateAt(dayMinus2, 7, 30)),
    departedAt: iso(dateAt(dayMinus2, 8, 5)),
    returnedAt: iso(dateAt(dayMinus2, 12, 10))
  };

  // 上周铅封异常回场，已另存修订
  const dayMinus7 = new Date(now);
  dayMinus7.setDate(now.getDate() - 7);
  const task4: DispatchTask = {
    id: "seed-rw4",
    content: "钢材卷板短驳",
    tractorId: "tr3",
    trailerId: "tl1",
    driverId: "dv2",
    startAt: iso(dateAt(dayMinus7, 6, 30)),
    endAt: iso(dateAt(dayMinus7, 11, 0)),
    status: "abnormal",
    createdAt: iso(dateAt(dayMinus7, 6, 0)),
    departedAt: iso(dateAt(dayMinus7, 6, 35)),
    returnedAt: iso(dateAt(dayMinus7, 11, 20))
  };
  const revision1: SealRevision = {
    id: bizId("XD"),
    taskId: task4.id,
    sealNo: "F-2291",
    reason: "回场核对铅封号与运单不一致，疑似途中被换，已封存现场照片并移交安全科复查",
    at: iso(dateAt(dayMinus7, 11, 30)),
    handler: "安全科 孟祥东"
  };

  return {
    tasks: [task2, task1, task3, task4],
    handovers: [handover1],
    revisions: [revision1]
  };
}
