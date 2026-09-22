<script setup lang="ts">
import { trailerStatuses } from "../store/dispatch";
import { fmtDay } from "../utils/time";
</script>

<template>
  <section class="panel trailer-panel">
    <div class="panel-head">
      <h2>挂车占用看板</h2>
      <span class="hint">由任务与交接实时派生，刷新即一致</span>
    </div>
    <div class="trailer-grid">
      <article v-for="s in trailerStatuses" :key="s.trailer.id" class="trailer-card" :class="s.state">
        <div class="trailer-top">
          <strong>{{ s.trailer.plate }}</strong>
          <span class="trailer-state" :class="s.state">{{ s.label }}</span>
        </div>
        <p class="trailer-model">{{ s.trailer.model }}</p>
        <p class="trailer-detail">{{ s.detail }}</p>
        <p v-if="s.trailer.maintenanceStart" class="trailer-maint">
          检修期：{{ fmtDay(s.trailer.maintenanceStart) }} ~ {{ fmtDay(s.trailer.maintenanceEnd) }}
        </p>
      </article>
    </div>
  </section>
</template>
