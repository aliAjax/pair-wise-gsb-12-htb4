<script setup lang="ts">
/**
 * 占用总览：挂车 / 牵引车 / 司机占用一律由台账实时推导，刷新后一致。
 */
import { computed } from "vue";
import { DRIVERS, driversById, TRACTORS, TRAILERS, tractorsById, trailersById } from "../data/master";
import { driverOccupancy, tractorOccupancy, trailerOccupancy } from "../rules/occupancy";
import { useLedger } from "../store/dispatch";

const store = useLedger();
const nowIso = new Date().toISOString();

const trailerRows = computed(() =>
  TRAILERS.map((trailer) => ({
    trailer,
    state: trailerOccupancy(trailer, store.tasks, store.handovers, nowIso)
  }))
);

const tractorRows = computed(() =>
  TRACTORS.map((tractor) => ({ tractor, state: tractorOccupancy(tractor, store.tasks) }))
);

const driverRows = computed(() =>
  DRIVERS.map((driver) => ({ driver, state: driverOccupancy(driver, store.tasks) }))
);

function comboText(combo?: string) {
  if (!combo) return "";
  const [tractorId, trailerId, driverId] = combo.split("|");
  return [
    tractorsById.get(tractorId)?.plate ?? tractorId,
    "＋",
    trailerId ? trailersLabel(trailerId) : "",
    driverId ? `— ${driversById.get(driverId)?.name ?? driverId}` : ""
  ]
    .filter(Boolean)
    .join(" ");
}
</script>

<template>
  <section class="panel occupancy">
    <div class="panel-head">
      <h2>车辆 / 司机占用</h2>
      <span class="panel-tip">由任务与交接实时推导</span>
    </div>

    <h3 class="occ-title">挂车占用</h3>
    <div class="occ-grid">
      <div v-for="row in trailerRows" :key="row.trailer.id" :class="['occ-card', `occ-${row.state.kind}`]">
        <strong>{{ row.trailer.plate }}</strong>
        <span class="occ-kind">{{ row.state.kind }}</span>
        <small>{{ row.state.detail }}</small>
        <small v-if="row.state.combo">{{ comboText(row.state.combo) }}</small>
      </div>
    </div>

    <h3 class="occ-title">牵引车 / 司机</h3>
    <div class="occ-grid two">
      <div v-for="row in tractorRows" :key="row.tractor.id" :class="['occ-card', `occ-${row.state.kind}`]">
        <strong>{{ row.tractor.plate }}</strong>
        <span class="occ-kind">{{ row.state.kind }}</span>
        <small>{{ row.state.detail }}</small>
      </div>
      <div v-for="row in driverRows" :key="row.driver.id" :class="['occ-card', `occ-${row.state.kind}`]">
        <strong>{{ row.driver.name }}</strong>
        <span class="occ-kind">{{ row.state.kind }}</span>
        <small>{{ row.state.detail }}</small>
      </div>
    </div>
  </section>
</template>
