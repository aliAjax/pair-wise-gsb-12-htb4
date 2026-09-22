<script setup lang="ts">
import {
  confirmHandover,
  driverOf,
  handovers,
  revisions,
  taskOf,
  tractorOf,
  trailerOf
} from "../store/dispatch";
import { fmtDateTime } from "../utils/time";
</script>

<template>
  <section class="panel ledger-panel">
    <div class="panel-head">
      <h2>交接与修订台账</h2>
      <span class="hint">换挂先记账 · 异常另存留痕</span>
    </div>

    <h3 class="ledger-sub">换挂交接记录（{{ handovers.length }}）</h3>
    <div v-if="!handovers.length" class="empty small">暂无交接记录</div>
    <div class="ledger-list">
      <article v-for="h in handovers" :key="h.id" class="ledger-row" :class="{ blocked: !h.confirmedAt }">
        <div class="ledger-main">
          <p class="swap-line">
            <strong>{{ tractorOf(h.tractorId)?.plate ?? h.tractorId }}</strong>
            <span class="swap-flow">{{ trailerOf(h.fromTrailerId)?.plate }} → {{ trailerOf(h.toTrailerId)?.plate }}</span>
          </p>
          <p class="muted">
            任务「{{ taskOf(h.taskId)?.content ?? h.taskId }}」 · {{ fmtDateTime(h.at) }} · 经办 {{ h.operator }}
            <template v-if="h.note">（{{ h.note }}）</template>
          </p>
        </div>
        <div class="ledger-side">
          <span v-if="h.confirmedAt" class="confirmed">已确认交回 {{ fmtDateTime(h.confirmedAt) }}</span>
          <template v-else>
            <span class="unconfirmed">原组合挂账中 · 不得再派</span>
            <button type="button" class="small primary" @click="confirmHandover(h.id)">确认交回</button>
          </template>
        </div>
      </article>
    </div>

    <h3 class="ledger-sub">铅封异常修订（{{ revisions.length }}）</h3>
    <div v-if="!revisions.length" class="empty small">暂无修订记录</div>
    <div class="ledger-list">
      <article v-for="r in revisions" :key="r.id" class="ledger-row revision">
        <div class="ledger-main">
          <p class="swap-line">
            <span class="revision-seal">铅封号 {{ r.sealNo }}</span>
            <span class="muted">任务「{{ taskOf(r.taskId)?.content ?? r.taskId }}」 · {{ driverOf(taskOf(r.taskId)?.driverId ?? "")?.name ?? "" }}</span>
          </p>
          <p class="revision-reason">{{ r.reason }}</p>
          <p class="muted">{{ fmtDateTime(r.at) }} · 登记 {{ r.handler }}</p>
        </div>
        <div class="ledger-side">
          <span class="revision-tag">另存修订</span>
        </div>
      </article>
    </div>
  </section>
</template>
