<script setup lang="ts">
/**
 * 甩挂运输交接台：
 * - 派车整单校验（挂车检修 / 尾号限行 / 司机记分 / 时段重叠与交接锁定）；
 * - 换挂先形成交接记录，原组合确认交回前不得再次派车；
 * - 发车后组合冻结，铅封异常只能另存带原因修订；
 * - 任务、占用、交接与修订均由本地台账持久化，刷新后一致。
 */
import { computed } from "vue";
import DispatchForm from "./components/DispatchForm.vue";
import TaskBoard from "./components/TaskBoard.vue";
import HandoverPanel from "./components/HandoverPanel.vue";
import OccupancyPanel from "./components/OccupancyPanel.vue";
import RevisionPanel from "./components/RevisionPanel.vue";
import { useLedger } from "./store/dispatch";

const store = useLedger();

const metrics = computed(() => [
  { label: "待发车", value: store.tasks.filter((task) => task.status === "待发车").length },
  { label: "在途（组合冻结）", value: store.tasks.filter((task) => task.status === "在途").length },
  { label: "待确认交回", value: store.openHandovers.length },
  { label: "异常修订", value: store.revisions.length }
]);

function resetDemo() {
  if (window.confirm("确定恢复为演示台账？当前本地数据将被覆盖。")) {
    store.resetDemo();
  }
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">物流 · 甩挂运输</p>
          <h1>甩挂运输交接台</h1>
          <p class="subtitle">
            牵引车、挂车、司机与起止时刻整单校验派车；换挂形成交接记录，原组合交回前锁定；发车冻结，异常另存修订。
          </p>
        </div>
        <div class="topbar-side">
          <div class="stack">
            <span class="tag">Vue3</span>
            <span class="tag">Pinia</span>
            <span class="tag">TypeScript</span>
            <span class="tag">localStorage</span>
          </div>
          <button type="button" class="secondary reset-btn" @click="resetDemo">恢复演示数据</button>
        </div>
      </header>

      <section class="metrics">
        <article v-for="metric in metrics" :key="metric.label" class="metric">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </section>

      <section class="workspace">
        <DispatchForm />
        <TaskBoard />
      </section>

      <section class="bottom-grid">
        <OccupancyPanel />
        <HandoverPanel />
        <RevisionPanel />
      </section>

      <footer class="footnote">
        车辆资料（src/data）、判定规则（src/rules）、本地存储（src/storage）分别组织，台账仅存于本机浏览器，无外部依赖。
      </footer>
    </div>
  </main>
</template>
