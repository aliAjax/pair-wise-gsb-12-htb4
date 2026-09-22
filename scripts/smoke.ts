/**
 * 规则与台账冒烟校验（非自动化测试框架，仅用 vite-node 直跑，不加依赖）。
 * 运行：npx vite-node scripts/smoke.ts
 */
import { DRIVERS, TRACTORS, TRAILERS, type DispatchTask, type TrailerHandover } from "../src/data/master";
import { evaluateDispatch, type DispatchDraft } from "../src/rules/validation";
import { overlaps, plateTailDigit } from "../src/rules/time";

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    failures += 1;
    console.error("✗", name);
  } else {
    console.log("✓", name);
  }
}

// 基础工具
check("尾号提取：沪A·D8206 -> 6", plateTailDigit("沪A·D8206") === 6);
check("尾号提取：挂车剔除挂字", plateTailDigit("沪D·0138挂") === 8);
check("相接时段不重叠", !overlaps("2026-09-23T17:00", "2026-09-23T18:00", "2026-09-23T18:00", "2026-09-23T20:00"));
check("相交时段重叠", overlaps("2026-09-23T17:00", "2026-09-23T19:00", "2026-09-23T18:30", "2026-09-23T20:00"));

const active: DispatchTask[] = [
  {
    id: "X1",
    tractorId: "t1",
    trailerId: "tr1",
    originalTrailerId: "tr1",
    driverId: "d1",
    startAt: "2026-09-23T08:00",
    endAt: "2026-09-23T17:00",
    route: "",
    notes: "",
    status: "在途",
    createdAt: ""
  }
];
const openHandovers: TrailerHandover[] = [
  {
    id: "H1",
    taskId: "X9",
    tractorId: "t2",
    fromTrailerId: "tr1",
    toTrailerId: "tr2",
    detachedAt: "2026-09-22T10:00",
    attachedAt: "2026-09-22T10:30",
    location: "x",
    operator: "x",
    note: "",
    status: "待确认交回",
    createdAt: ""
  }
];

function run(draft: DispatchDraft) {
  return evaluateDispatch({
    draft,
    tractor: TRACTORS.find((t) => t.id === draft.tractorId),
    trailer: TRAILERS.find((t) => t.id === draft.trailerId),
    driver: DRIVERS.find((d) => d.id === draft.driverId),
    activeTasks: active,
    openHandovers
  });
}

const base: DispatchDraft = {
  tractorId: "t3",
  trailerId: "tr2",
  driverId: "d4",
  startAt: "2026-09-24T08:00",
  endAt: "2026-09-24T17:00",
  route: "x",
  notes: ""
};

// 1 通过单
check("正常单整单通过", run(base).ok);

// 2 挂车检修：tr3 检修至 2026-09-23T18:00
const maint = { ...base, trailerId: "tr3", startAt: "2026-09-23T17:00", endAt: "2026-09-23T19:00" };
check("命中挂车检修期", run(maint).hits.some((h) => h.code === "TRAILER_MAINT"));
check("检修结束后不命中", run({ ...maint, startAt: "2026-09-23T19:00", endAt: "2026-09-23T21:00" }).hits.every((h) => h.code !== "TRAILER_MAINT"));

// 3 限行：2026-09-22 周二，限 4/9；t2 沪B·F3719 尾号9，白天命中；夜间不命中
const restrictDay = { ...base, tractorId: "t2", startAt: "2026-09-22T08:00", endAt: "2026-09-22T12:00" };
check("周二白天尾号9限行命中", run(restrictDay).hits.some((h) => h.code === "PLATE_RESTRICT"));
const restrictNight = { ...base, tractorId: "t2", startAt: "2026-09-22T20:00", endAt: "2026-09-22T22:00" };
check("周二20点后不限行", run(restrictNight).hits.every((h) => h.code !== "PLATE_RESTRICT"));
const restrictWeekend = { ...base, tractorId: "t2", startAt: "2026-09-26T08:00", endAt: "2026-09-26T12:00" };
check("周六不限行", run(restrictWeekend).hits.every((h) => h.code !== "PLATE_RESTRICT"));

// 4 司机记分：d3 已记10分
const score = { ...base, driverId: "d3" };
check("记分10分拦截", run(score).hits.some((h) => h.code === "DRIVER_SCORE"));
check("记分3分放行", run({ ...base, driverId: "d2" }).hits.every((h) => h.code !== "DRIVER_SCORE"));

// 5 重叠：牵引车/司机/挂车
const overlapT = { ...base, tractorId: "t1", startAt: "2026-09-23T10:00", endAt: "2026-09-23T12:00" };
check("牵引车时段重叠命中", run(overlapT).hits.some((h) => h.code === "OVERLAP" && h.label.includes("牵引车")));
const overlapR = { ...base, trailerId: "tr1", startAt: "2026-09-23T10:00", endAt: "2026-09-23T12:00" };
check("挂车时段重叠命中", run(overlapR).hits.some((h) => h.code === "OVERLAP" && h.label.includes("挂车")));
const overlapD = { ...base, driverId: "d1", startAt: "2026-09-23T10:00", endAt: "2026-09-23T12:00" };
check("司机时段重叠命中", run(overlapD).hits.some((h) => h.code === "OVERLAP" && h.label.includes("司机")));
check("相接时段不判重叠", run({ ...overlapT, startAt: "2026-09-23T17:00", endAt: "2026-09-23T19:00" }).hits.every((h) => h.code !== "OVERLAP"));

// 6 原组合未确认交回：t2 + tr1 被 H1 锁定
const locked = { ...base, tractorId: "t2", trailerId: "tr1" };
check("原组合未交回锁定命中", run(locked).hits.some((h) => h.code === "OPEN_HANDOVER"));
check("同牵引车头换别的挂车不锁", run({ ...base, tractorId: "t2", trailerId: "tr4" }).hits.every((h) => h.code !== "OPEN_HANDOVER"));

// 7 多项同时命中全部列出
const multi = {
  tractorId: "t1",
  trailerId: "tr1",
  driverId: "d3",
  startAt: "2026-09-23T10:00",
  endAt: "2026-09-23T09:00",
  route: "",
  notes: ""
};
const multiResult = run(multi);
const codes = new Set(multiResult.hits.map((h) => h.code));
check("多问题逐项列出(>=4类)", multiResult.hits.length >= 4 && codes.has("FORM") && codes.has("DRIVER_SCORE"));

if (failures > 0) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log("\n全部冒烟校验通过");
