<script setup lang="ts">
import { drivers, trailers, tractors } from "../store/dispatch";
import { DRIVER_POINT_LIMIT } from "../data/masterData";
import { fmtDay } from "../utils/time";

function scoreCls(points: number): string {
  return 12 - points < DRIVER_POINT_LIMIT ? "bad" : points >= 6 ? "warn" : "ok";
}
</script>

<template>
  <section class="panel reference-panel">
    <div class="panel-head">
      <h2>车辆与司机资料</h2>
      <span class="hint">静态档案 · 与业务数据分开组织</span>
    </div>

    <h3 class="ledger-sub">牵引车（尾号限行对象）</h3>
    <div class="ref-grid">
      <div v-for="t in tractors" :key="t.id" class="ref-item">
        <strong>{{ t.plate }}</strong>
        <span class="muted">{{ t.model }}</span>
      </div>
    </div>

    <h3 class="ledger-sub">挂车（检修期管理）</h3>
    <div class="ref-grid">
      <div v-for="t in trailers" :key="t.id" class="ref-item">
        <strong>{{ t.plate }}</strong>
        <span class="muted">{{ t.model }}</span>
        <span v-if="t.maintenanceStart" class="maint-chip">
          检修 {{ fmtDay(t.maintenanceStart) }} ~ {{ fmtDay(t.maintenanceEnd) }}
        </span>
      </div>
    </div>

    <h3 class="ledger-sub">司机（记分门槛：剩余 ≥ {{ DRIVER_POINT_LIMIT }} 分）</h3>
    <div class="ref-grid">
      <div v-for="d in drivers" :key="d.id" class="ref-item">
        <strong>{{ d.name }}</strong>
        <span class="muted">{{ d.phone }}</span>
        <span class="score-chip" :class="scoreCls(d.points)">
          已记 {{ d.points }} · 余 {{ 12 - d.points }}
        </span>
      </div>
    </div>
  </section>
</template>
