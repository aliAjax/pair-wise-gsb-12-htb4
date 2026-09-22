/**
 * 车辆资料层：本地台账的初始演示数据。
 * 仅在首次打开（localStorage 无台账）时使用。
 */
import type { Ledger } from "./master";

export function seedLedger(nowIso: string): Ledger {
  return {
    version: 1,
    seq: { task: 5, handover: 2, revision: 2 },
    tasks: [
      {
        id: "RW-20260922-0001",
        tractorId: "t1",
        trailerId: "tr2",
        originalTrailerId: "tr1",
        driverId: "d1",
        startAt: "2026-09-22T08:00",
        endAt: "2026-09-22T17:00",
        route: "太仓堆场 → 昆山仓",
        notes: "途中甩挂：tr1 留昆山仓装货，换 tr2 空挂回场",
        status: "在途",
        departedAt: "2026-09-22T08:05",
        createdAt: "2026-09-21T16:20"
      },
      {
        id: "RW-20260922-0002",
        tractorId: "t2",
        trailerId: "tr3",
        originalTrailerId: "tr3",
        driverId: "d2",
        startAt: "2026-09-23T20:00",
        endAt: "2026-09-24T06:00",
        route: "上海仓 → 杭州分拨",
        notes: "夜间冷链班次",
        status: "待发车",
        createdAt: "2026-09-22T09:10"
      },
      {
        id: "RW-20260922-0003",
        tractorId: "t3",
        trailerId: "tr2",
        originalTrailerId: "tr2",
        driverId: "d4",
        startAt: "2026-09-21T06:30",
        endAt: "2026-09-21T19:00",
        route: "外高桥港区 → 青浦",
        notes: "回场铅封与运单不符，已另存修订",
        status: "在途",
        departedAt: "2026-09-21T06:40",
        sealStatus: "异常",
        createdAt: "2026-09-20T17:00"
      },
      {
        id: "RW-20260922-0004",
        tractorId: "t4",
        trailerId: "tr4",
        originalTrailerId: "tr4",
        driverId: "d1",
        startAt: "2026-09-19T07:30",
        endAt: "2026-09-19T16:00",
        route: "嘉定 → 苏州工业园",
        notes: "正常回场",
        status: "已回场",
        departedAt: "2026-09-19T07:40",
        returnedAt: "2026-09-19T15:50",
        sealStatus: "正常",
        createdAt: "2026-09-18T15:00"
      },
      {
        id: "RW-20260922-0005",
        tractorId: "t3",
        trailerId: "tr1",
        originalTrailerId: "tr1",
        driverId: "d4",
        startAt: "2026-09-18T08:00",
        endAt: "2026-09-18T18:30",
        route: "芦潮港 → 松江",
        notes: "换挂交接未确认交回示例",
        status: "在途",
        departedAt: "2026-09-18T08:10",
        createdAt: "2026-09-17T14:00"
      }
    ],
    handovers: [
      {
        id: "HJ-0001",
        taskId: "RW-20260922-0001",
        tractorId: "t1",
        fromTrailerId: "tr1",
        toTrailerId: "tr2",
        detachedAt: "2026-09-22T11:20",
        attachedAt: "2026-09-22T11:50",
        location: "昆山仓 3 号道口",
        operator: "陆建明",
        note: "原挂留仓装下午批次",
        status: "待确认交回",
        createdAt: "2026-09-22T11:55"
      },
      {
        id: "HJ-0002",
        taskId: "RW-20260922-0005",
        tractorId: "t3",
        fromTrailerId: "tr1",
        toTrailerId: "tr4",
        detachedAt: "2026-09-18T12:00",
        attachedAt: "2026-09-18T12:30",
        location: "松江交接区",
        operator: "陆建明",
        note: "原挂箱况待复核",
        status: "待确认交回",
        createdAt: "2026-09-18T12:40"
      }
    ],
    revisions: [
      {
        id: "XD-0001",
        taskId: "RW-20260922-0003",
        kind: "铅封异常",
        reason: "回场铅封号与运单登记不一致",
        oldSealNo: "SL-883210",
        newSealNo: "SL-902745",
        detail: "司机反映途中在服务区例行检查时发现原铅封松动，现场拍照留存。",
        reportedAt: "2026-09-21T19:20",
        createdAt: "2026-09-21T19:25"
      },
      {
        id: "XD-0002",
        taskId: "RW-20260922-0003",
        kind: "其他",
        reason: "补记装卸交接单编号",
        oldSealNo: "",
        newSealNo: "",
        detail: "补充交接单 JJD-0921-17 扫描件归档。",
        reportedAt: "2026-09-22T08:40",
        createdAt: "2026-09-22T08:45"
      }
    ]
  };
}
