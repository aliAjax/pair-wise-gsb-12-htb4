<script setup lang="ts">
import { reactive, ref } from "vue";
import type { Violation } from "./types";
import { clearAll, createTask, metrics, reseed, tasks } from "./store/dispatch";
import { dateAt, toLocalInput } from "./utils/time";
import type { DispatchFormState } from "./components/types";
import DispatchForm from "./components/DispatchForm.vue";
import TaskBoard from "./components/TaskBoard.vue";
import TrailerBoard from "./components/TrailerBoard.vue";
import HandoverBoard from "./components/HandoverBoard.vue";
import ReferenceBoard from "./components/ReferenceBoard.vue";

function defaultForm(): DispatchFormState {
  const today = new Date();
  return {
    content: "",
    tractorId: "",
    trailerId: "",
    driverId: "",
    startAt: toLocalInput(dateAt(today, 8, 0)),
    endAt: toLocalInput(dateAt(today, 12, 0))
  };
}

const form = reactive<DispatchFormState>(defaultForm());
const violations = ref<Violation[]>([]);
const success = ref("");

function submit() {
  success.value = "";
  const res = createTask({ ...form });
  violations.value = res.violations;
  if (res.ok) {
    Object.assign(form, defaultForm());
    success.value = "派车通过，任务已进入待发车队列";
  }
}

function resetForm() {
  Object.assign(form, defaultForm());
  violations.value = [];
  success.value = "";
}

function doReseed() {
  if (window.confirm("恢复演示数据将覆盖当前任务、交接与修订，是否继续？")) {
    reseed();
    resetForm();
  }
}

function doClear() {
  if (window.confirm("清空全部任务、交接与修订（车辆资料保留）？")) {
    clearAll();
    resetForm();
  }
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">甩挂运输 · 场站调度</p>
          <h1>甩挂运输交接台</h1>
          <p class="subtitle">
            一车一挂一司机派单；挂车检修、尾号限行、记分不足、时段重叠、挂账未交回整单拦截。
            换挂先生成交接记录，发车后组合冻结，铅封异常只能带原因另存修订。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue 3</span>
          <span class="tag">TypeScript</span>
          <span class="tag">localStorage</span>
          <span class="tag">无新增依赖</span>
        </div>
      </header>

      <section class="metrics">
        <article class="metric">
          <span>在途 / 待发任务</span>
          <strong>{{ metrics.active }}</strong>
        </article>
        <article class="metric">
          <span>挂账待确认交回</span>
          <strong>{{ metrics.pending }}</strong>
        </article>
        <article class="metric">
          <span>可派挂挂车</span>
          <strong>{{ metrics.freeTrailers }}</strong>
        </article>
        <article class="metric">
          <span>铅封异常回场</span>
          <strong>{{ metrics.abnormal }}</strong>
        </article>
      </section>

      <div v-if="success" class="toast ok">{{ success }}</div>

      <section class="workspace">
        <div class="left-col">
          <DispatchForm
            :model-value="form"
            :violations="violations"
            @update:model-value="(patch) => Object.assign(form, patch)"
            @submit="submit"
            @reset="resetForm"
          />
        </div>
        <div class="right-col">
          <TaskBoard :tasks="tasks" />
          <TrailerBoard />
          <HandoverBoard />
          <ReferenceBoard />
        </div>
      </section>

      <footer class="footer">
        <span>数据仅保存在本机浏览器 localStorage；刷新后任务、挂车占用、交接与修订保持一致。</span>
        <div class="footer-actions">
          <button type="button" class="secondary small" @click="doReseed">恢复演示数据</button>
          <button type="button" class="danger small" @click="doClear">清空业务数据</button>
        </div>
      </footer>
    </div>
  </main>
</template>
