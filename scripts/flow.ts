/**
 * 完整台账流转冒烟：localStorage 内存桩 + Pinia setActivePinia。
 * 验证：整单拦截保留 / 交接锁定 / 发车冻结 / 异常只另存 / 刷新重载一致。
 */
import { setActivePinia, createPinia } from "pinia";
import { useLedger } from "../src/store/dispatch";

let failures = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    failures += 1;
    console.error("✗", name);
  } else {
    console.log("✓", name);
  }
}

// 极简 localStorage 内存桩
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k)
};

setActivePinia(createPinia());
const store = useLedger();
const initialTasks = store.tasks.length;

// 1 缺字段整单不通过
const bad = store.dispatch({
  tractorId: "",
  trailerId: "",
  driverId: "",
  startAt: "2026-10-01T08:00",
  endAt: "2026-10-01T17:00",
  route: "",
  notes: ""
});
check("缺字段不通过", !bad.ok);
if (!bad.ok) check("命中表单项", bad.hits.some((h) => h.code === "FORM"));
check("不通过不建单", store.tasks.length === initialTasks);

// 2 找一个空闲组合：t4 当前无未完成任务（种子中其任务已回场）；tr2 被0001在途占用
//    先用 t4 + tr1（tr1 在 HJ-0001/HJ-0002 中为原挂，且 0005 当前挂 tr1 在途）→ 验证换挂锁定/占用
const blocked = store.dispatch({
  tractorId: "t3",
  trailerId: "tr1",
  driverId: "d1",
  startAt: "2026-10-02T08:00",
  endAt: "2026-10-02T17:00",
  route: "测试",
  notes: ""
});
check("原组合(t3+tr1)未交回被锁定", !blocked.ok && blocked.hits.some((h) => h.code === "OPEN_HANDOVER"));

// 3 合法派车：t4 + tr2? tr2 在途(0001)。用 t4 + tr1：无 OPEN_HANDOVER（HJ-0002 是 t3+tr1），
//    但 tr1 是 0005 当前挂车（在途占用）→ OVERLAP。选 10 月 2 日依然重叠（0005 是 9-18，不重叠），
//    但 0001 在 tr2。tr1 当前由 0005 在途（startAt 2026-09-18~18:30 但 status 在途）→ 10月不重叠。
const ok = store.dispatch({
  tractorId: "t4",
  trailerId: "tr1",
  driverId: "d1",
  startAt: "2026-10-02T08:00",
  endAt: "2026-10-02T17:00",
  route: "测试线路",
  notes: "新建"
});
check("空闲组合派车通过", ok.ok);
const newId = ok.ok ? ok.taskId : "";
check("通过后建单", store.tasks.some((t) => t.id === newId && t.status === "待发车"));

// 4 发车冻结
store.depart(newId);
const departed = store.tasks.find((t) => t.id === newId)!;
check("发车后状态在途", departed.status === "在途" && !!departed.departedAt);
check("发车后取消无效（仍存在）", (store.cancelTask(newId), store.tasks.some((t) => t.id === newId)));

// 5 换挂：换到 tr3。种子中 tr3 被待发车单 0002 占用，先取消该单释放挂车。
store.cancelTask("RW-20260922-0002");
check("待发车单可取消并释放占用", !store.tasks.some((t) => t.id === "RW-20260922-0002"));
const swap = store.createHandover({
  taskId: newId,
  toTrailerId: "tr3",
  detachedAt: "2026-10-02T11:00",
  attachedAt: "2026-10-02T11:30",
  location: "测试道口",
  operator: "测试员",
  note: ""
});
check("换挂形成交接记录", swap.ok);
const hjId = swap.ok ? swap.handoverId : "";
check("任务当前挂车切换为 tr3", store.tasks.find((t) => t.id === newId)!.trailerId === "tr3");
check("原挂车记录保留为 tr1", store.tasks.find((t) => t.id === newId)!.originalTrailerId === "tr1");
check("交接为待确认交回", store.handovers.find((h) => h.id === hjId)!.status === "待确认交回");

// 6 原组合 t4+tr1 在确认前再次派车被拦截
const lockedAgain = store.dispatch({
  tractorId: "t4",
  trailerId: "tr1",
  driverId: "d2",
  startAt: "2026-10-05T08:00",
  endAt: "2026-10-05T17:00",
  route: "",
  notes: ""
});
check("未确认交回前原组合不得再派", !lockedAgain.ok && lockedAgain.hits.some((h) => h.code === "OPEN_HANDOVER"));

// 7 确认交回后原组合解锁
store.confirmHandover(hjId);
const unlocked = store.dispatch({
  tractorId: "t4",
  trailerId: "tr1",
  driverId: "d2",
  startAt: "2026-10-05T08:00",
  endAt: "2026-10-05T17:00",
  route: "",
  notes: ""
});
check("确认交回后原组合可再派（无交接锁定）", unlocked.ok || unlocked.hits.every((h) => h.code !== "OPEN_HANDOVER"));

// 8 铅封异常：只能另存，原单不回写（仍在途冻结）
const before = JSON.stringify(departed);
store.saveSealRevision(newId, {
  reason: "铅封号不符",
  oldSealNo: "A1",
  newSealNo: "B2",
  detail: "测试"
});
const after = store.tasks.find((t) => t.id === newId)!;
check("异常修订另存一条", store.revisionsOfTask(newId).some((r) => r.reason === "铅封号不符"));
check("原单仍为在途冻结", after.status === "在途");
check("原单核心字段未回写", before.includes('"status":"在途"') && after.trailerId === "tr3" && after.tractorId === "t4");
check("修订带原因留痕", store.revisionsOfTask(newId)[0].reason.length > 0);

// 9 刷新一致：重建 store 从 localStorage 装载
setActivePinia(createPinia());
const reloaded = useLedger();
check("刷新后任务一致", reloaded.tasks.some((t) => t.id === newId && t.status === "在途" && t.trailerId === "tr3"));
check("刷新后交接一致", reloaded.handovers.some((h) => h.id === hjId && h.status === "已确认交回"));
check("刷新后修订一致", reloaded.revisions.some((r) => r.taskId === newId && r.reason === "铅封号不符"));
check("刷新后挂车占用与任务一致", (() => {
  const occ = reloaded.tasks.filter((t) => t.status === "在途" && t.trailerId === "tr3");
  return occ.length >= 1 && occ.some((t) => t.id === newId);
})());

if (failures > 0) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log("\n全部流转校验通过");
