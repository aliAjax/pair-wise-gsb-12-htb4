<script setup lang="ts">
/**
 * 铅封异常修订弹窗：回场铅封异常时只能“另存”一条带原因的修订，
 * 任务原单保持在途冻结，不做回写。
 */
import { reactive, ref } from "vue";
import { tractorsById, trailersById, type DispatchTask } from "../data/master";
import { nowLocalInput } from "../rules/time";
import { useLedger } from "../store/dispatch";

const props = defineProps<{ task: DispatchTask }>();
const emit = defineEmits<{ close: [] }>();

const store = useLedger();

const form = reactive({
  reason: "",
  oldSealNo: "",
  newSealNo: "",
  detail: ""
});
const error = ref("");
const doneId = ref("");

function submit() {
  error.value = "";
  if (!form.reason.trim()) {
    error.value = "修订必须填写异常原因。";
    return;
  }
  if (!form.oldSealNo.trim() || !form.newSealNo.trim()) {
    error.value = "请登记原铅封号与换封后的新铅封号。";
    return;
  }
  store.saveSealRevision(props.task.id, { ...form, kind: "铅封异常" });
  const latest = store.revisionsOfTask(props.task.id)[0];
  doneId.value = latest?.id ?? "";
}

function close() {
  emit("close");
}
</script>

<template>
  <div class="modal-mask" @click.self="close">
    <div class="modal">
      <header class="modal-head">
        <h3>回场铅封异常 · 另存修订</h3>
        <button type="button" class="icon-btn" @click="close">×</button>
      </header>

      <p class="modal-sub warn">
        任务 {{ task.id }}（{{ tractorsById.get(task.tractorId)?.plate }} ＋
        {{ trailersById.get(task.trailerId)?.plate }}）已发车，组合冻结。
        异常不得直接改单，本窗口只形成带原因的修订记录，原单继续冻结留痕。
      </p>

      <div v-if="doneId" class="pass-banner">
        ✓ 修订 <strong>{{ doneId }}</strong> 已另存（原单未改动，仍为在途冻结）。
        <button type="button" class="link-btn" @click="close">关闭</button>
      </div>

      <form v-else class="form-grid" @submit.prevent="submit()">
        <label>
          异常原因 <em class="req">*</em>
          <input v-model="form.reason" type="text" placeholder="例：回场铅封号与运单登记不一致" />
        </label>
        <div class="time-row">
          <label>
            原铅封号 <em class="req">*</em>
            <input v-model="form.oldSealNo" type="text" placeholder="例：SL-883210" />
          </label>
          <label>
            新铅封号 <em class="req">*</em>
            <input v-model="form.newSealNo" type="text" placeholder="例：SL-902745" />
          </label>
        </div>
        <label>
          情况说明
          <textarea v-model="form.detail" placeholder="发现环节、现场处置、影像留存情况等"></textarea>
        </label>

        <p class="report-time">上报时刻：{{ nowLocalInput().replace("T", " ") }}</p>
        <div v-if="error" class="hit-box">
          <div class="hit-head"><span class="hit-icon">!</span><span>{{ error }}</span></div>
        </div>

        <div class="form-actions">
          <button type="submit" class="danger">另存修订（不改原单）</button>
          <button type="button" class="secondary" @click="close">取消</button>
        </div>
      </form>
    </div>
  </div>
</template>
