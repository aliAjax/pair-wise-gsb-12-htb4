<script setup lang="ts">
import type { Violation } from "../types";
import { DRIVER_POINT_LIMIT } from "../data/masterData";
import { drivers, trailers, tractors, trailerInMaintenance } from "../store/dispatch";
import type { DispatchFormState } from "./types";

const props = defineProps<{
  modelValue: DispatchFormState;
  violations: Violation[];
}>();
const emit = defineEmits<{
  (e: "update:modelValue", value: DispatchFormState): void;
  (e: "submit"): void;
  (e: "reset"): void;
}>();

function update<K extends keyof DispatchFormState>(key: K, value: DispatchFormState[K]) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}

const restrictionRows: { label: string; digits: string }[] = [
  { label: "周一", digits: "1 / 6" },
  { label: "周二", digits: "2 / 7" },
  { label: "周三", digits: "3 / 8" },
  { label: "周四", digits: "4 / 9" },
  { label: "周五", digits: "5 / 0" }
];
</script>

<template>
  <form class="panel form-panel" @submit.prevent="emit('submit')">
    <div class="panel-head">
      <h2>派车任务单</h2>
      <span class="hint">整单判定 · 任一命中即不通过</span>
    </div>

    <div class="form-grid">
      <label class="full">
        运输任务内容
        <input
          :value="modelValue.content"
          placeholder="如：临港集装箱疏港（A12 泊位）"
          @input="update('content', ($event.target as HTMLInputElement).value)"
        />
      </label>

      <label>
        牵引车
        <select :value="modelValue.tractorId" @change="update('tractorId', ($event.target as HTMLSelectElement).value)">
          <option value="">请选择牵引车</option>
          <option v-for="t in tractors" :key="t.id" :value="t.id">
            {{ t.plate }} · {{ t.model }}
          </option>
        </select>
      </label>

      <label>
        挂车
        <select :value="modelValue.trailerId" @change="update('trailerId', ($event.target as HTMLSelectElement).value)">
          <option value="">请选择挂车</option>
          <option v-for="t in trailers" :key="t.id" :value="t.id">
            {{ t.plate }}{{ trailerInMaintenance(t) ? "（检修中）" : "" }}
          </option>
        </select>
        <small v-if="modelValue.trailerId" class="field-extra">
          {{ trailers.find((t) => t.id === modelValue.trailerId)?.model }}
        </small>
      </label>

      <label class="full">
        司机
        <select :value="modelValue.driverId" @change="update('driverId', ($event.target as HTMLSelectElement).value)">
          <option value="">请选择司机</option>
          <option v-for="d in drivers" :key="d.id" :value="d.id">
            {{ d.name }} · 已记 {{ d.points }} 分（剩余 {{ 12 - d.points }} 分）
          </option>
        </select>
      </label>

      <label>
        起始时刻
        <input
          type="datetime-local"
          :value="modelValue.startAt"
          @input="update('startAt', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label>
        截止时刻
        <input
          type="datetime-local"
          :value="modelValue.endAt"
          @input="update('endAt', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <div v-if="violations.length" class="violation-box" role="alert">
      <p class="violation-title">整单不通过，命中 {{ violations.length }} 项（输入已保留）：</p>
      <ul>
        <li v-for="(v, i) in violations" :key="v.code + i" class="violation-item">
          <span class="dot"></span>{{ v.message }}
        </li>
      </ul>
    </div>

    <div class="form-actions">
      <button type="submit" class="primary">提交派车</button>
      <button type="button" class="secondary" @click="emit('reset')">清空表单</button>
    </div>

    <details class="rules-hint">
      <summary>判定口径</summary>
      <ul>
        <li>挂车检修期：任务日期与检修窗口（含端点）相交即拦截。</li>
        <li>尾号限行：工作日 07:00–20:00，
          <span v-for="(r, i) in restrictionRows" :key="r.label">
            {{ r.label }}禁 {{ r.digits }}<span v-if="i < restrictionRows.length - 1">；</span>
          </span>
        </li>
        <li>司机记分：剩余可记分不足 {{ DRIVER_POINT_LIMIT }} 分不得派车。</li>
        <li>时段重叠：牵引车 / 司机 / 目标挂车与在途、待发任务重叠均拦截。</li>
        <li>换挂挂账：原"牵引车+挂车"组合确认交回前不得再次派车。</li>
      </ul>
    </details>
  </form>
</template>
