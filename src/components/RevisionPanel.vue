<script setup lang="ts">
/**
 * 修订记录面板：铅封异常等只能另存，不回写任务原单。
 */
import { tractorsById, trailersById } from "../data/master";
import { fmtDateTime } from "../rules/time";
import { useLedger } from "../store/dispatch";

const store = useLedger();

function taskPlateLine(taskId: string) {
  const task = store.tasks.find((item) => item.id === taskId);
  if (!task) return taskId;
  return `${tractorsById.get(task.tractorId)?.plate ?? task.tractorId} ＋ ${
    trailersById.get(task.trailerId)?.plate ?? task.trailerId
  }`;
}
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <h2>异常修订（另存留痕）</h2>
      <span class="panel-count">{{ store.revisions.length }} 条 · 原单均不回写</span>
    </div>

    <div v-if="store.revisions.length === 0" class="empty">暂无修订记录</div>

    <div class="revision-list">
      <article v-for="revision in store.revisions" :key="revision.id" class="revision-card">
        <header class="handover-head">
          <span class="handover-id">{{ revision.id }}</span>
          <span class="status-pill status-seal-bad">{{ revision.kind }}</span>
        </header>
        <p class="revision-task">任务 {{ revision.taskId }} · {{ taskPlateLine(revision.taskId) }}</p>
        <p class="revision-reason">{{ revision.reason }}</p>
        <div v-if="revision.oldSealNo || revision.newSealNo" class="seal-change">
          <span>原铅封 {{ revision.oldSealNo || "—" }}</span>
          <span>→</span>
          <span>新铅封 {{ revision.newSealNo || "—" }}</span>
        </div>
        <p v-if="revision.detail" class="task-note">{{ revision.detail }}</p>
        <small class="revision-time">上报 {{ fmtDateTime(revision.reportedAt) }}</small>
      </article>
    </div>
  </section>
</template>
