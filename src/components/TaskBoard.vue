<script setup lang="ts">
import { computed, ref } from "vue";
import type { DispatchTask, Violation } from "../types";
import {
  cancelTask,
  confirmHandover,
  createHandover,
  depart,
  driverOf,
  handovers,
  handoversOf,
  returnAbnormal,
  returnNormal,
  revisions,
  tractorOf,
  trailerOf,
  trailers
} from "../store/dispatch";
import { currentTrailerId } from "../rules/rules";
import type { AbnormalFormState, HandoverFormState } from "./types";
import { fmtDateTime, toLocalInput } from "../utils/time";

const props = defineProps<{ tasks: DispatchTask[] }>();

const filter = ref<"active" | "scheduled" | "departed" | "closed" | "all">("active");

const statusMeta: Record<DispatchTask["status"], { label: string; cls: string }> = {
  scheduled: { label: "待发车", cls: "st-scheduled" },
  departed: { label: "运输中", cls: "st-departed" },
  returned: { label: "正常回场", cls: "st-returned" },
  abnormal: { label: "铅封异常", cls: "st-abnormal" },
  canceled: { label: "已取消", cls: "st-canceled" }
};

const filtered = computed(() => {
  const list = [...props.tasks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  if (filter.value === "all") return list;
  if (filter.value === "active") return list.filter((t) => ["scheduled", "departed"].includes(t.status));
  if (filter.value === "closed") return list.filter((t) => ["returned", "abnormal", "canceled"].includes(t.status));
  return list.filter((t) => t.status === filter.value);
});

// ---------- 换挂弹窗 ----------
const handoverTarget = ref<DispatchTask | null>(null);
const handoverForm = ref<HandoverFormState>({ taskId: "", toTrailerId: "", at: "", operator: "", note: "" });
const handoverErrors = ref<Violation[]>([]);

function openHandover(task: DispatchTask) {
  handoverTarget.value = task;
  handoverForm.value = {
    taskId: task.id,
    toTrailerId: "",
    at: toLocalInput(new Date()),
    operator: "",
    note: ""
  };
  handoverErrors.value = [];
}

function submitHandover() {
  if (!handoverTarget.value) return;
  const res = createHandover(handoverForm.value);
  handoverErrors.value = res.violations;
  if (res.ok) handoverTarget.value = null;
}

// ---------- 铅封异常回场弹窗 ----------
const abnormalTarget = ref<DispatchTask | null>(null);
const abnormalForm = ref<AbnormalFormState>({ sealNo: "", reason: "", handler: "" });
const abnormalErrors = ref<Violation[]>([]);

function openAbnormal(task: DispatchTask) {
  abnormalTarget.value = task;
  abnormalForm.value = { sealNo: "", reason: "", handler: "" };
  abnormalErrors.value = [];
}

function submitAbnormal() {
  if (!abnormalTarget.value) return;
  const res = returnAbnormal(abnormalTarget.value.id, abnormalForm.value);
  abnormalErrors.value = res.violations;
  if (res.ok) abnormalTarget.value = null;
}

// ---------- 详情展开 ----------
const expanded = ref<Set<string>>(new Set());
function toggle(id: string) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

function taskRevisions(taskId: string) {
  return revisions.value
    .filter((r) => r.taskId === taskId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function nowTrailerId(task: DispatchTask) {
  return currentTrailerId(task, handovers.value);
}

function confirmAndRefresh(handoverId: string) {
  confirmHandover(handoverId);
}

const emptyTask = computed(() => filtered.value.length === 0);
</script>

<template>
  <section class="panel task-panel">
    <div class="panel-head">
      <h2>调度任务台</h2>
      <div class="filter-tabs">
        <button
          v-for="tab in [
            { k: 'active', t: '在途/待发' },
            { k: 'scheduled', t: '待发车' },
            { k: 'departed', t: '运输中' },
            { k: 'closed', t: '已闭环' },
            { k: 'all', t: '全部' }
          ]"
          :key="tab.k"
          type="button"
          class="tab"
          :class="{ on: filter === tab.k }"
          @click="filter = tab.k as typeof filter"
        >
          {{ tab.t }}
        </button>
      </div>
    </div>

    <div v-if="emptyTask" class="empty">暂无任务，左侧填写任务单后提交派车</div>

    <div class="task-list">
      <article v-for="task in filtered" :key="task.id" class="task-card" :class="statusMeta[task.status].cls">
        <div class="task-head" @click="toggle(task.id)">
          <div class="task-title">
            <span class="status-badge" :class="statusMeta[task.status].cls">
              {{ statusMeta[task.status].label }}
            </span>
            <strong>{{ task.content || "（未命名任务）" }}</strong>
          </div>
          <div class="task-times">
            {{ fmtDateTime(task.startAt) }} → {{ fmtDateTime(task.endAt) }}
          </div>
        </div>

        <div class="task-combo">
          <span class="combo-item">
            <em>牵引车</em>{{ tractorOf(task.tractorId)?.plate ?? task.tractorId }}
          </span>
          <span class="combo-arrow">＋</span>
          <span class="combo-item" :class="{ swapped: nowTrailerId(task) !== task.trailerId }">
            <em>挂车</em>{{ trailerOf(nowTrailerId(task))?.plate ?? nowTrailerId(task) }}
          </span>
          <span class="combo-arrow">·</span>
          <span class="combo-item">
            <em>司机</em>{{ driverOf(task.driverId)?.name ?? task.driverId }}
          </span>
          <span v-if="nowTrailerId(task) !== task.trailerId" class="swap-flag">已换挂</span>
        </div>

        <div v-if="task.status === 'scheduled' || task.status === 'departed'" class="task-actions">
          <button v-if="task.status === 'scheduled'" type="button" class="primary small" @click="depart(task.id)">
            发车（冻结组合）
          </button>
          <button v-if="task.status === 'scheduled'" type="button" class="secondary small" @click="cancelTask(task.id)">
            取消
          </button>
          <button v-if="task.status === 'departed'" type="button" class="secondary small" @click="openHandover(task)">
            换挂交接
          </button>
          <template v-if="task.status === 'departed'">
            <button type="button" class="secondary small" @click="returnNormal(task.id)">
              回场·铅封正常
            </button>
            <button type="button" class="danger small" @click="openAbnormal(task)">
              回场·铅封异常
            </button>
          </template>
        </div>

        <div v-if="expanded.has(task.id)" class="task-detail">
          <div v-if="task.departedAt" class="detail-line">发车时刻：{{ fmtDateTime(task.departedAt) }}</div>
          <div v-if="task.returnedAt" class="detail-line">回场时刻：{{ fmtDateTime(task.returnedAt) }}</div>
          <div class="detail-line">出场挂车：{{ trailerOf(task.trailerId)?.plate ?? task.trailerId }}（发车后冻结）</div>

          <template v-if="handoversOf(task.id).length">
            <p class="detail-sub">交接记录</p>
            <div v-for="h in handoversOf(task.id)" :key="h.id" class="handover-row">
              <div>
                <span class="swap-flow">
                  {{ trailerOf(h.fromTrailerId)?.plate }} → {{ trailerOf(h.toTrailerId)?.plate }}
                </span>
                <span class="muted">{{ fmtDateTime(h.at) }} · {{ h.operator }}</span>
                <span v-if="h.note" class="muted">（{{ h.note }}）</span>
              </div>
              <div class="handover-state">
                <span v-if="h.confirmedAt" class="confirmed">已确认交回 · {{ fmtDateTime(h.confirmedAt) }}</span>
                <template v-else>
                  <span class="unconfirmed">原挂车未确认交回，原组合冻结</span>
                  <button type="button" class="small primary" @click="confirmAndRefresh(h.id)">确认交回</button>
                </template>
              </div>
            </div>
          </template>

          <template v-if="taskRevisions(task.id).length">
            <p class="detail-sub">铅封异常修订（另存留痕）</p>
            <div v-for="r in taskRevisions(task.id)" :key="r.id" class="revision-row">
              <div class="revision-head">
                <span class="revision-seal">铅封号 {{ r.sealNo }}</span>
                <span class="muted">{{ fmtDateTime(r.at) }} · {{ r.handler }}</span>
              </div>
              <p class="revision-reason">{{ r.reason }}</p>
            </div>
          </template>
        </div>
      </article>
    </div>

    <!-- 换挂交接弹窗 -->
    <div v-if="handoverTarget" class="modal-mask" @click.self="handoverTarget = null">
      <div class="modal">
        <h3>换挂交接单</h3>
        <p class="modal-sub">
          任务「{{ handoverTarget.content }}」：{{ tractorOf(handoverTarget.tractorId)?.plate }} 当前挂载
          {{ trailerOf(nowTrailerId(handoverTarget))?.plate }}。提交后先生成交接记录，原挂车确认交回前原组合不得再派。
        </p>
        <div class="form-grid">
          <label>
            换上挂车
            <select v-model="handoverForm.toTrailerId">
              <option value="">请选择目标挂车</option>
              <option v-for="t in trailers.filter((t) => t.id !== nowTrailerId(handoverTarget!))" :key="t.id" :value="t.id">
                {{ t.plate }} · {{ t.model }}
              </option>
            </select>
          </label>
          <label>
            交接时刻
            <input type="datetime-local" v-model="handoverForm.at" />
          </label>
          <label>
            经办人
            <input v-model="handoverForm.operator" placeholder="场站理货员姓名" />
          </label>
          <label class="full">
            交接说明
            <textarea v-model="handoverForm.note" placeholder="换装货种、箱号、铅封情况等"></textarea>
          </label>
        </div>
        <ul v-if="handoverErrors.length" class="error-list">
          <li v-for="(e, i) in handoverErrors" :key="e.code + i">· {{ e.message }}</li>
        </ul>
        <div class="modal-actions">
          <button type="button" class="primary" @click="submitHandover">生成交接记录</button>
          <button type="button" class="secondary" @click="handoverTarget = null">取消</button>
        </div>
      </div>
    </div>

    <!-- 铅封异常回场弹窗 -->
    <div v-if="abnormalTarget" class="modal-mask" @click.self="abnormalTarget = null">
      <div class="modal">
        <h3>回场铅封异常 · 修订登记</h3>
        <p class="modal-sub warn">
          发车后组合已冻结，异常情况不得直接改写任务，只能另存带原因修订。
        </p>
        <div class="form-grid">
          <label>
            异常铅封号
            <input v-model="abnormalForm.sealNo" placeholder="如 F-2291" />
          </label>
          <label>
            登记人
            <input v-model="abnormalForm.handler" placeholder="安全科 / 值班员姓名" />
          </label>
          <label class="full">
            异常原因（必填）
            <textarea v-model="abnormalForm.reason" placeholder="铅封与运单不符 / 断裂 / 缺失 的具体情况与处置去向"></textarea>
          </label>
        </div>
        <ul v-if="abnormalErrors.length" class="error-list">
          <li v-for="(e, i) in abnormalErrors" :key="e.code + i">· {{ e.message }}</li>
        </ul>
        <div class="modal-actions">
          <button type="button" class="danger" @click="submitAbnormal">另存修订并标记异常回场</button>
          <button type="button" class="secondary" @click="abnormalTarget = null">取消</button>
        </div>
      </div>
    </div>
  </section>
</template>
