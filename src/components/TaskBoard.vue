<script setup lang="ts">
/**
 * 任务看板：展示甩挂任务与组合状态。
 * 发车后组合冻结；正常回场释放占用；铅封异常只能另存带原因的修订。
 */
import { computed, ref } from "vue";
import {
  driversById,
  tractorsById,
  trailersById,
  type DispatchTask
} from "../data/master";
import { fmtDateTime } from "../rules/time";
import { useLedger } from "../store/dispatch";
import SwapModal from "./SwapModal.vue";
import RevisionModal from "./RevisionModal.vue";

const store = useLedger();

const statusFilter = ref<"全部" | "待发车" | "在途" | "已回场">("全部");
const keyword = ref("");

const filtered = computed(() =>
  store.tasks.filter((task) => {
    if (statusFilter.value !== "全部" && task.status !== statusFilter.value) return false;
    if (!keyword.value.trim()) return true;
    const kw = keyword.value.trim();
    const text = [
      task.id,
      task.route,
      task.notes,
      tractorsById.get(task.tractorId)?.plate ?? "",
      trailersById.get(task.trailerId)?.plate ?? "",
      trailersById.get(task.originalTrailerId)?.plate ?? "",
      driversById.get(task.driverId)?.name ?? ""
    ].join(" ");
    return text.includes(kw);
  })
);

const swapTask = ref<DispatchTask | null>(null);
const revisionTask = ref<DispatchTask | null>(null);

function tractorPlate(id: string) {
  return tractorsById.get(id)?.plate ?? id;
}
function trailerPlate(id: string) {
  return trailersById.get(id)?.plate ?? id;
}
function driverName(id: string) {
  return driversById.get(id)?.name ?? id;
}

function openHandovers(taskId: string) {
  return store.handoversOfTask(taskId).filter((item) => item.status === "待确认交回");
}

function statusClass(task: DispatchTask) {
  if (task.status === "在途" && task.sealStatus === "异常") return "status-seal-bad";
  return `status-${task.status}`;
}
</script>

<template>
  <section class="panel board">
    <div class="panel-head">
      <h2>派车任务与组合</h2>
      <div class="board-tools">
        <input v-model="keyword" class="search" type="search" placeholder="搜索任务号 / 车牌 / 司机 / 路线" />
        <select v-model="statusFilter">
          <option>全部</option>
          <option>待发车</option>
          <option>在途</option>
          <option>已回场</option>
        </select>
      </div>
    </div>

    <div v-if="filtered.length === 0" class="empty">暂无匹配任务</div>

    <div class="task-list">
      <article v-for="task in filtered" :key="task.id" class="task-card">
        <header class="task-head">
          <div>
            <span class="task-id">{{ task.id }}</span>
            <span :class="['status-pill', statusClass(task)]">
              {{ task.status }}<template v-if="task.status === '在途'"> · 组合冻结</template>
            </span>
            <span v-if="task.sealStatus === '异常'" class="status-pill status-seal-bad">铅封异常 · 已另存修订</span>
          </div>
          <span class="task-route">{{ task.route || "未填路线" }}</span>
        </header>

        <div class="combo">
          <div class="combo-item">
            <small>牵引车</small>
            <strong>{{ tractorPlate(task.tractorId) }}</strong>
          </div>
          <span class="combo-link">＋</span>
          <div class="combo-item">
            <small>当前挂车</small>
            <strong>{{ trailerPlate(task.trailerId) }}</strong>
            <em v-if="task.trailerId !== task.originalTrailerId" class="swapped">
              原挂 {{ trailerPlate(task.originalTrailerId) }}
            </em>
          </div>
          <span class="combo-link">—</span>
          <div class="combo-item">
            <small>司机</small>
            <strong>{{ driverName(task.driverId) }}</strong>
          </div>
        </div>

        <div class="task-meta">
          <span>起运 {{ fmtDateTime(task.startAt) }}</span>
          <span>预计回场 {{ fmtDateTime(task.endAt) }}</span>
          <span v-if="task.departedAt">发车 {{ fmtDateTime(task.departedAt) }}</span>
          <span v-if="task.returnedAt">回场 {{ fmtDateTime(task.returnedAt) }}</span>
        </div>
        <p v-if="task.notes" class="task-note">{{ task.notes }}</p>

        <div v-if="openHandovers(task.id).length" class="task-handovers">
          <span v-for="handover in openHandovers(task.id)" :key="handover.id" class="handover-chip">
            换挂 {{ handover.id }}：{{ trailerPlate(handover.fromTrailerId) }} →
            {{ trailerPlate(handover.toTrailerId) }}，原组合待确认交回
            <button type="button" class="link-btn" @click="store.confirmHandover(handover.id)">确认交回</button>
          </span>
        </div>

        <footer class="task-actions">
          <button v-if="task.status === '待发车'" type="button" @click="store.depart(task.id)">
            发车（冻结组合）
          </button>
          <button v-if="task.status === '在途'" type="button" class="secondary" @click="swapTask = task">
            办理换挂交接
          </button>
          <button v-if="task.status === '在途'" type="button" class="secondary" @click="store.returnToYard(task.id)">
            正常回场交回
          </button>
          <button v-if="task.status === '在途'" type="button" class="danger ghost" @click="revisionTask = task">
            回场铅封异常 · 另存修订
          </button>
          <button
            v-if="task.status === '待发车'"
            type="button"
            class="danger ghost"
            @click="store.cancelTask(task.id)"
          >
            取消派车
          </button>
        </footer>
      </article>
    </div>

    <SwapModal v-if="swapTask" :task="swapTask" @close="swapTask = null" />
    <RevisionModal v-if="revisionTask" :task="revisionTask" @close="revisionTask = null" />
  </section>
</template>
