<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Money /></el-icon>
        时段费率表维护
      </h2>
      <el-button type="primary" :icon="'Plus'" @click="openAddDialog">
        新增费率时段
      </el-button>
    </div>

    <el-card class="card-shadow">
      <el-table :data="rates" stripe>
        <el-table-column label="排序" width="70">
          <template #default="{ row }">
            <el-tag type="info" effect="plain" round>{{ row.sortOrder }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="时段名称" width="140">
          <template #default="{ row }">
            <el-icon style="color: #409eff"><Clock /></el-icon>
            <strong style="margin-left: 6px">{{ row.name }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="时段范围" width="180">
          <template #default="{ row }">
            <span style="font-family: monospace; font-weight: 600">
              {{ row.startTime }} - {{ row.endTime }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="小时费率" width="120">
          <template #default="{ row }">
            <span style="color: #f56c6c; font-size: 18px; font-weight: 700">
              ¥{{ row.ratePerHour }}
            </span>
            <span style="color: #909399; font-size: 12px">/时</span>
          </template>
        </el-table-column>
        <el-table-column prop="freeMinutes" label="免费时长" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.freeMinutes && row.freeMinutes > 0" type="success" effect="light">
              {{ row.freeMinutes }}分钟
            </el-tag>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="minFee" label="最低消费" width="100">
          <template #default="{ row }">
            <span v-if="row.minFee">¥{{ row.minFee }}</span>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="maxFeePerDay" label="每日封顶" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.maxFeePerDay" type="warning" effect="light">
              ¥{{ row.maxFeePerDay }}
            </el-tag>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              @change="toggleRate(row)"
              active-text="启用"
              inactive-text="禁用"
              inline-prompt
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link :icon="'Edit'" @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-popconfirm title="确认删除该时段费率？" @confirm="removeRate(row)">
              <template #reference>
                <el-button type="danger" size="small" link :icon="'Delete'">
                  删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="rates.length === 0" description="暂无费率数据，请点击右上角新增" />
    </el-card>

    <el-card class="card-shadow" style="margin-top: 20px">
      <template #header>
        <span style="font-weight: 600; font-size: 16px">
          <el-icon><DataLine /></el-icon>
          跨时段计费演示
        </span>
      </template>
      <el-row :gutter="16">
        <el-col :span="6">
          <el-form label-position="top">
            <el-form-item label="入场时间">
              <el-date-picker
                v-model="demoEntry"
                type="datetime"
                placeholder="选择入场时间"
                style="width: 100%"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DD HH:mm:ss"
              />
            </el-form-item>
          </el-form>
        </el-col>
        <el-col :span="6">
          <el-form label-position="top">
            <el-form-item label="出场时间">
              <el-date-picker
                v-model="demoExit"
                type="datetime"
                placeholder="选择出场时间"
                style="width: 100%"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DD HH:mm:ss"
              />
            </el-form-item>
          </el-form>
        </el-col>
        <el-col :span="12" style="display: flex; align-items: flex-end">
          <el-button type="primary" :icon="'Calculator'" @click="runDemo" style="height: 40px">
            计算演示
          </el-button>
        </el-col>
      </el-row>

      <div v-if="demoResult" class="billing-detail-box">
        <div class="segment-row">
          <span class="segment-label">总停放时长</span>
          <span class="segment-value">{{ formatDuration(demoResult.totalDuration) }}</span>
        </div>
        <el-divider style="margin: 8px 0" />
        <div style="font-weight: 600; margin: 8px 0; color: #303133">分段计费明细</div>
        <div v-for="(seg, idx) in demoResult.segments" :key="idx" class="segment-row">
          <span class="segment-label">
            [{{ seg.rateName }}] {{ seg.startTime.slice(5, 16) }} ~ {{ seg.endTime.slice(5, 16) }}
            ({{ seg.durationMinutes }}分钟 × ¥{{ seg.ratePerHour }}/时)
          </span>
          <span class="segment-value">¥{{ seg.amount.toFixed(2) }}</span>
        </div>
        <div class="segment-row" v-if="demoResult.freeMinutesEligible > 0">
          <span class="segment-label negative">免费时长抵扣</span>
          <span class="segment-value negative">前{{ demoResult.freeMinutesEligible }}分钟免费</span>
        </div>
        <div class="total-row">
          <span>应付金额</span>
          <span class="positive">¥{{ demoResult.grossAmount.toFixed(2) }}</span>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑时段费率' : '新增时段费率'"
      width="560px"
      destroy-on-close
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="24">
            <el-form-item label="时段名称" prop="name">
              <el-input v-model="form.name" placeholder="如：早高峰、白天、夜间" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开始时间" prop="startTime">
              <el-time-picker
                v-model="form.startTime"
                placeholder="选择开始时间"
                format="HH:mm"
                value-format="HH:mm"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间" prop="endTime">
              <el-time-picker
                v-model="form.endTime"
                placeholder="选择结束时间"
                format="HH:mm"
                value-format="HH:mm"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="小时费率" prop="ratePerHour">
              <el-input-number
                v-model="form.ratePerHour"
                :min="0"
                :step="0.5"
                :precision="2"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序权重" prop="sortOrder">
              <el-input-number
                v-model="form.sortOrder"
                :min="1"
                :step="1"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="免费时长">
              <el-input-number
                v-model="form.freeMinutes"
                :min="0"
                :step="5"
                placeholder="分钟"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="最低消费">
              <el-input-number
                v-model="form.minFee"
                :min="0"
                :step="1"
                placeholder="元"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="每日封顶">
              <el-input-number
                v-model="form.maxFeePerDay"
                :min="0"
                :step="5"
                placeholder="元"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="启用状态">
              <el-switch v-model="form.enabled" active-text="启用" inactive-text="禁用" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import type { TimeRate } from '@/types'
import { rateStorage } from '@/store/storage'
import { calculateBilling, type BillingResult } from '@/services/billingEngine'
import dayjs from 'dayjs'

const rates = ref<TimeRate[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()

const form = reactive({
  name: '',
  startTime: '08:00',
  endTime: '20:00',
  ratePerHour: 5,
  sortOrder: 1,
  freeMinutes: 15,
  minFee: undefined as number | undefined,
  maxFeePerDay: undefined as number | undefined,
  enabled: true
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入时段名称', trigger: 'blur' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
  ratePerHour: [{ required: true, message: '请输入费率', trigger: 'blur' }]
}

const demoEntry = ref(dayjs().subtract(3, 'hour').format('YYYY-MM-DD HH:mm:ss'))
const demoExit = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'))
const demoResult = ref<BillingResult | null>(null)

function refreshRates() {
  rates.value = rateStorage.getAll().sort((a, b) => a.sortOrder - b.sortOrder)
}

function openAddDialog() {
  isEdit.value = false
  editingId.value = ''
  Object.assign(form, {
    name: '',
    startTime: '08:00',
    endTime: '20:00',
    ratePerHour: 5,
    sortOrder: rates.value.length + 1,
    freeMinutes: 15,
    minFee: undefined,
    maxFeePerDay: undefined,
    enabled: true
  })
  dialogVisible.value = true
}

function openEditDialog(row: TimeRate) {
  isEdit.value = true
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    startTime: row.startTime,
    endTime: row.endTime,
    ratePerHour: row.ratePerHour,
    sortOrder: row.sortOrder,
    freeMinutes: row.freeMinutes || 0,
    minFee: row.minFee,
    maxFeePerDay: row.maxFeePerDay,
    enabled: row.enabled
  })
  dialogVisible.value = true
}

async function submitForm() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    const data = {
      name: form.name,
      startTime: form.startTime,
      endTime: form.endTime,
      ratePerHour: Number(form.ratePerHour),
      sortOrder: Number(form.sortOrder),
      freeMinutes: form.freeMinutes || 0,
      minFee: form.minFee,
      maxFeePerDay: form.maxFeePerDay,
      enabled: form.enabled
    }
    if (isEdit.value) {
      rateStorage.update(editingId.value, data)
      ElMessage.success('费率更新成功')
    } else {
      rateStorage.add(data)
      ElMessage.success('费率新增成功')
    }
    dialogVisible.value = false
    refreshRates()
  })
}

function toggleRate(row: TimeRate) {
  rateStorage.update(row.id, { enabled: row.enabled })
  ElMessage.success(row.enabled ? '已启用' : '已禁用')
}

function removeRate(row: TimeRate) {
  rateStorage.remove(row.id)
  refreshRates()
  ElMessage.success('删除成功')
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0分钟'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}小时${m}分钟`
}

function runDemo() {
  if (!demoEntry.value || !demoExit.value) {
    ElMessage.warning('请选择入场和出场时间')
    return
  }
  demoResult.value = calculateBilling(demoEntry.value, demoExit.value, rates.value)
}

onMounted(() => {
  refreshRates()
  if (rates.value.length === 0) {
    rateStorage.add({ name: '早高峰', startTime: '07:00', endTime: '10:00', ratePerHour: 8, freeMinutes: 15, minFee: 5, maxFeePerDay: 60, sortOrder: 1, enabled: true })
    rateStorage.add({ name: '白天平峰', startTime: '10:00', endTime: '17:00', ratePerHour: 5, freeMinutes: 0, sortOrder: 2, enabled: true })
    rateStorage.add({ name: '晚高峰', startTime: '17:00', endTime: '21:00', ratePerHour: 8, freeMinutes: 0, maxFeePerDay: 60, sortOrder: 3, enabled: true })
    rateStorage.add({ name: '夜间优惠', startTime: '21:00', endTime: '07:00', ratePerHour: 2, freeMinutes: 0, maxFeePerDay: 20, sortOrder: 4, enabled: true })
    refreshRates()
    ElMessage.info('已初始化默认时段费率')
  }
})
</script>
