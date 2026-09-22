<script setup lang="ts">
/**
 * 换挂交接弹窗：换挂先形成“待确认交回”交接记录。
 */
import { reactive, ref } from "vue";
import { trailersById, type DispatchTask } from "../data/master";
import { nowLocalInput } from "../rules/time";
import { useLedger } from "../store/dispatch";

const props = defineProps<{ task: DispatchTask }>();
const emit = defineEmits<{ close: [] }>();

const store = useLedger();

const form = reactive({
  toTrailerId: "",
  detachedAt: nowLocalInput(),
  attachedAt: nowLocalInput(),
  location: "",
  operator: "",
  note: ""
});
const hits = ref<{ code: string; label: string; detail: string }[]>([]);
const doneId = ref("");

function submit() {
  const outcome = store.createHandover({ taskId: props.task.id, ...form });
  if (!outcome.ok) {
    hits.value = outcome.hits;
    return;
  }
  hits.value = [];
  doneId.value = outcome.handoverId;
}

const candidates = [...new Set(store.activeTasks.map((item) => item.trailerId))];
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal">
      <header class="modal-head">
        <h3>办理换挂交接</h3>
        <button type="button" class="icon-btn" @click="emit('close')">×</button>
      </header>

      <p class="modal-sub">
        任务 {{ task.id }} · 当前挂车
        <strong>{{ trailersById.get(task.trailerId)?.plate }}</strong>。
        交接记录成立后原组合保持锁定，确认交回前不得再次派车。
      </p>

      <div v-if="doneId" class="pass-banner">
        ✓ 交接记录 <strong>{{ doneId }}</strong> 已形成（待确认交回），任务当前挂车已切换。
      </div>

      <form v-else class="form-grid" @submit.prevent="submit()">
        <label>
          换入挂车
          <select v-model="form.toTrailerId">
            <option value="">请选择换入挂车</option>
            <option
              v-for="trailer in [...trailersById.values()].filter((item) => item.id !== task.trailerId)"
              :key="trailer.id"
              :value="trailer.id"
            >
              {{ trailer.plate }} · {{ trailer.model }}
              <template v-if="candidates.includes(trailer.id)">（被占用）</template>
            </option>
          </select>
        </label>
        <div class="time-row">
          <label>
            摘挂时刻
            <input v-model="form.detachedAt" type="datetime-local" />
          </label>
          <label>
            挂接时刻
            <input v-model="form.attachedAt" type="datetime-local" />
          </label>
        </div>
        <label>
          交接地点
          <input v-model="form.location" type="text" placeholder="例：昆山仓 3 号道口" />
        </label>
        <label>
          现场交接人
          <input v-model="form.operator" type="text" placeholder="例：陆建明" />
        </label>
        <label>
          交接说明
          <textarea v-model="form.note" placeholder="原挂去向、铅封情况等"></textarea>
        </label>

        <div v-if="hits.length" class="hit-box">
          <div class="hit-head"><span class="hit-icon">!</span><span>交接不成立，命中 {{ hits.length }} 项：</span></div>
          <ul class="hit-list">
            <li v-for="(hit, index) in hits" :key="index" class="hit-item tone-maint">
              <span class="hit-tag">{{ hit.label }}</span><span>{{ hit.detail }}</span>
            </li>
          </ul>
        </div>

        <div class="form-actions">
          <button type="submit">形成交接记录</button>
          <button type="button" class="secondary" @click="emit('close')">取消</button>
        </div>
      </form>
    </div>
  </div>
</template>
