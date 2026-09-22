<script setup lang="ts">
/**
 * 换挂交接记录面板：换挂先形成记录，原组合确认交回前处于锁定。
 */
import { tractorsById, trailersById } from "../data/master";
import { fmtDateTime } from "../rules/time";
import { useLedger } from "../store/dispatch";

const store = useLedger();

function trailerPlate(id: string) {
  return trailersById.get(id)?.plate ?? id;
}
function tractorPlate(id: string) {
  return tractorsById.get(id)?.plate ?? id;
}
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <h2>换挂交接记录</h2>
      <span class="panel-count">{{ store.handovers.length }} 条 · 待确认 {{ store.openHandovers.length }} 条</span>
    </div>

    <div v-if="store.handovers.length === 0" class="empty">暂无换挂交接</div>

    <div class="handover-list">
      <article v-for="handover in store.handovers" :key="handover.id" class="handover-card">
        <header class="handover-head">
          <span class="handover-id">{{ handover.id }}</span>
          <span :class="['status-pill', handover.status === '待确认交回' ? 'status-lock' : 'status-done']">
            {{ handover.status }}
          </span>
        </header>
        <p class="handover-flow">
          {{ tractorPlate(handover.tractorId) }}
          <span class="swap-arrow">{{ trailerPlate(handover.fromTrailerId) }} → {{ trailerPlate(handover.toTrailerId) }}</span>
        </p>
        <div class="handover-meta">
          <span>任务 {{ handover.taskId }}</span>
          <span>摘挂 {{ fmtDateTime(handover.detachedAt) }}</span>
          <span>挂接 {{ fmtDateTime(handover.attachedAt) }}</span>
          <span>地点 {{ handover.location }}</span>
          <span>交接人 {{ handover.operator }}</span>
          <span v-if="handover.confirmedAt">交回确认 {{ fmtDateTime(handover.confirmedAt) }}</span>
        </div>
        <p v-if="handover.note" class="task-note">{{ handover.note }}</p>
        <footer class="task-actions">
          <button
            v-if="handover.status === '待确认交回'"
            type="button"
            class="secondary"
            @click="store.confirmHandover(handover.id)"
          >
            确认原组合交回（解除锁定）
          </button>
        </footer>
      </article>
    </div>
  </section>
</template>
