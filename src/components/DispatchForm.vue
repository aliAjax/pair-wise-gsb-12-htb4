<script setup lang="ts">
/**
 * 派车表单：填写牵引车 / 挂车 / 司机 / 起止时刻。
 * 提交前实时预检；任一规则命中则整单不通过，输入全部保留并逐项列出。
 */
import { computed, reactive, ref } from "vue";
import { DRIVERS, TRACTORS, TRAILERS } from "../data/master";
import { evaluateDispatch, SCORE_LIMIT, type RuleHit } from "../rules/validation";
import { defaultWindow } from "../rules/time";
import { useLedger } from "../store/dispatch";

const store = useLedger();
const defaults = defaultWindow();

const form = reactive({
  tractorId: "",
  trailerId: "",
  driverId: "",
  startAt: defaults.startAt,
  endAt: defaults.endAt,
  route: "",
  notes: ""
});

const submitted = ref(false);
const lastHits = ref<RuleHit[]>([]);
const createdId = ref("");

const draft = computed(() => ({ ...form }));

const liveHits = computed(() =>
  evaluateDispatch({
    draft: draft.value,
    tractor: TRACTORS.find((item) => item.id === form.tractorId),
    trailer: TRAILERS.find((item) => item.id === form.trailerId),
    driver: DRIVERS.find((item) => item.id === form.driverId),
    activeTasks: store.activeTasks,
    openHandovers: store.openHandovers
  })
);

const shownHits = computed(() => (submitted.value ? lastHits.value : liveHits.value.hits));
const blocking = computed(() => shownHits.value.length > 0);

function submit() {
  submitted.value = true;
  createdId.value = "";
  const outcome = store.dispatch(draft.value);
  if (!outcome.ok) {
    // 整单不通过：保留所有输入，仅更新命中项列表
    lastHits.value = outcome.hits;
    return;
  }
  lastHits.value = [];
  createdId.value = outcome.taskId;
  submitted.value = false;
  const next = defaultWindow();
  Object.assign(form, {
    tractorId: "",
    trailerId: "",
    driverId: "",
    startAt: next.startAt,
    endAt: next.endAt,
    route: "",
    notes: ""
  });
}

const hitTone: Record<RuleHit["code"], string> = {
  FORM: "tone-form",
  TRAILER_MAINT: "tone-maint",
  PLATE_RESTRICT: "tone-restrict",
  DRIVER_SCORE: "tone-score",
  OVERLAP: "tone-overlap",
  OPEN_HANDOVER: "tone-lock"
};

const hitName: Record<RuleHit["code"], string> = {
  FORM: "表单",
  TRAILER_MAINT: "挂车检修",
  PLATE_RESTRICT: "尾号限行",
  DRIVER_SCORE: "司机记分",
  OVERLAP: "时段重叠",
  OPEN_HANDOVER: "交接锁定"
};
</script>

<template>
  <section class="panel dispatch-form">
    <div class="panel-head">
      <h2>甩挂派车交接台</h2>
      <p class="panel-tip">四类整单校验：挂车检修 · 尾号限行 · 司机记分（达 {{ SCORE_LIMIT }} 分拦截）· 时段/交接锁定</p>
    </div>

    <form class="form-grid" @submit.prevent="submit()">
      <label>
        牵引车
        <select v-model="form.tractorId">
          <option value="">请选择牵引车</option>
          <option v-for="item in TRACTORS" :key="item.id" :value="item.id">
            {{ item.plate }} · {{ item.model }}（{{ item.team }}）
          </option>
        </select>
      </label>

      <label>
        挂车
        <select v-model="form.trailerId">
          <option value="">请选择挂车</option>
          <option v-for="item in TRAILERS" :key="item.id" :value="item.id">
            {{ item.plate }} · {{ item.model }} · {{ item.capacity }}
          </option>
        </select>
      </label>

      <label>
        司机
        <select v-model="form.driverId">
          <option value="">请选择司机</option>
          <option v-for="item in DRIVERS" :key="item.id" :value="item.id">
            {{ item.name }}（已记 {{ item.points }} 分）{{ item.points >= SCORE_LIMIT ? " · 记分不足" : "" }}
          </option>
        </select>
      </label>

      <div class="time-row">
        <label>
          起始时刻
          <input v-model="form.startAt" type="datetime-local" />
        </label>
        <label>
          预计回场
          <input v-model="form.endAt" type="datetime-local" />
        </label>
      </div>

      <label>
        运输路线
        <input v-model="form.route" type="text" placeholder="例：太仓堆场 → 昆山仓" />
      </label>

      <label>
        备注
        <textarea v-model="form.notes" placeholder="甩挂计划、交接要求等"></textarea>
      </label>

      <div v-if="createdId" class="pass-banner">
        ✓ 整单校验通过，已建单 <strong>{{ createdId }}</strong>（待发车）。
      </div>

      <div v-if="blocking" class="hit-box">
        <div class="hit-head">
          <span class="hit-icon">!</span>
          <span>整单不通过，命中 {{ shownHits.length }} 项（输入已保留）：</span>
        </div>
        <ul class="hit-list">
          <li v-for="(hit, index) in shownHits" :key="index" :class="['hit-item', hitTone[hit.code]]">
            <span class="hit-tag">{{ hitName[hit.code] }}</span>
            <span>{{ hit.detail }}</span>
          </li>
        </ul>
      </div>

      <div class="form-actions">
        <button type="submit" :class="{ blocked: blocking }">校验并派车</button>
        <span class="live-tip">输入过程中实时预检；提交命中时整单退回，不生成任务。</span>
      </div>
    </form>
  </section>
</template>
