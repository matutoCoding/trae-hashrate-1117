<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Van /></el-icon>
        车辆进出管理
      </h2>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <div class="entry-box card-shadow">
          <div class="box-title">
            <el-icon :size="22" color="#00acc1"><CircleCheck /></el-icon>
            车辆入场登记
          </div>
          <el-form :model="entryForm" label-position="top">
            <el-form-item label="车牌号">
              <el-input
                v-model="entryForm.plateNumber"
                class="big-plate-input"
                placeholder="请输入车牌号，如：京A12345"
                maxlength="8"
                clearable
                @keyup.enter="handleEntry"
              />
            </el-form-item>
            <el-button
              type="primary"
              size="large"
              style="width: 100%; height: 56px; font-size: 18px"
              :icon="'ArrowDownBold'"
              @click="handleEntry"
            >
              确认入场
            </el-button>
          </el-form>

          <div v-if="entryResultMsg" class="charge-info">
            <el-result
              :icon="entrySuccess ? 'success' : 'warning'"
              :title="entryResultMsg"
              v-if="entrySuccess"
            >
              <template #extra v-if="entryMonthlyInfo">
                <div style="text-align: left; margin-top: 12px">
                  <div class="info-row">
                    <span class="info-label">月卡编号</span>
                    <span class="info-value">{{ entryMonthlyInfo.cardNo }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">车主姓名</span>
                    <span class="info-value">{{ entryMonthlyInfo.ownerName }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">剩余额度</span>
                    <span class="info-value negative">
                      {{ formatDuration(entryMonthlyInfo.remainingQuota) }}
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">月度总额度</span>
                    <span class="info-value">{{ formatDuration(entryMonthlyInfo.monthlyQuota) }}</span>
                  </div>
                </div>
              </template>
            </el-result>
            <el-result
              icon="warning"
              :title="entryResultMsg"
              v-else
            />
          </div>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="exit-box card-shadow">
          <div class="box-title">
            <el-icon :size="22" color="#f57c00"><CircleClose /></el-icon>
            车辆出场计费
          </div>
          <el-form :model="exitForm" label-position="top">
            <el-form-item label="车牌号">
              <el-input
                v-model="exitForm.plateNumber"
                class="big-plate-input"
                placeholder="请输入车牌号，如：京A12345"
                maxlength="8"
                clearable
                @keyup.enter="handleExit"
              />
            </el-form-item>
            <el-button
              type="warning"
              size="large"
              style="width: 100%; height: 56px; font-size: 18px"
              :icon="'ArrowUpBold'"
              @click="handleExit"
            >
              计算费用
            </el-button>
          </el-form>

          <div v-if="exitResult" class="charge-info">
            <template v-if="!exitResult.needPayment && exitResult.result">
              <el-result icon="success" :title="exitResult.message">
                <template #extra>
                  <div class="info-row">
                    <span class="info-label">入场时间</span>
                    <span class="info-value">{{ exitResult.result.record.entryTime }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">出场时间</span>
                    <span class="info-value">{{ exitResult.result.record.exitTime }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">停放时长</span>
                    <span class="info-value">{{ formatDuration(exitResult.result.totalDuration) }}</span>
                  </div>
                  <div v-if="exitResult.result.remainingQuota !== undefined" class="info-row">
                    <span class="info-label">剩余额度</span>
                    <span class="info-value negative">
                      {{ formatDuration(exitResult.result.remainingQuota) }}
                    </span>
                  </div>
                </template>
              </el-result>
            </template>

            <template v-else-if="exitResult.needPayment && exitResult.result">
              <div class="info-row">
                <span class="info-label">入场时间</span>
                <span class="info-value">{{ exitResult.result.record.entryTime }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">停放时长</span>
                <span class="info-value">{{ formatDuration(exitResult.result.totalDuration) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">车辆类型</span>
                <span class="info-value">
                  <span class="monthly-tag" v-if="exitResult.result.isMonthlyCard">月卡车</span>
                  <span class="temp-tag" v-else>临时车</span>
                </span>
              </div>

              <div class="billing-detail-box">
                <div style="font-weight: 600; margin-bottom: 8px; color: #303133">
                  分段计费明细
                </div>
                <div v-for="(seg, idx) in exitResult.result.segments" :key="idx" class="segment-row">
                  <span class="segment-label">
                    {{ seg.rateName }} · {{ seg.startTime.slice(11, 16) }}-{{ seg.endTime.slice(11, 16) }}
                    ({{ seg.durationMinutes }}分钟 · ¥{{ seg.ratePerHour }}/时)
                  </span>
                  <span class="segment-value">¥{{ seg.amount.toFixed(2) }}</span>
                </div>
                <div class="segment-row" v-if="exitResult.result.freeDeductedMinutes > 0">
                  <span class="segment-label negative">
                    免费时长抵扣 ({{ exitResult.result.freeDeductedMinutes }}分钟)
                  </span>
                  <span class="segment-value negative">-¥{{ exitResult.result.freeDeductedAmount.toFixed(2) }}</span>
                </div>
                <div class="segment-row" v-if="exitResult.result.quotaDeductedMinutes > 0">
                  <span class="segment-label negative">
                    月卡额度抵扣 ({{ exitResult.result.quotaDeductedMinutes }}分钟)
                  </span>
                  <span class="segment-value negative">-¥{{ exitResult.result.quotaDeductedAmount.toFixed(2) }}</span>
                </div>
                <div class="total-row">
                  <span>应付金额</span>
                  <span class="positive">¥{{ exitResult.result.selfPayAmount.toFixed(2) }}</span>
                </div>
              </div>

              <div class="action-bar" style="justify-content: center">
                <el-button type="success" size="large" :icon="'Wallet'" @click="handlePay('wechat')">
                  微信支付
                </el-button>
                <el-button type="primary" size="large" :icon="'CreditCard'" @click="handlePay('alipay')">
                  支付宝
                </el-button>
                <el-button type="info" size="large" :icon="'Coin'" @click="handlePay('cash')">
                  现金
                </el-button>
              </div>
            </template>

            <el-result v-else icon="warning" :title="exitResult.message" />
          </div>
        </div>
      </el-col>
    </el-row>

    <el-card class="card-shadow" style="margin-top: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: 600; font-size: 16px">
            <el-icon><List /></el-icon>
            在场车辆列表 ({{ activeRecords.length }}辆)
          </span>
          <div class="filter-group">
            <el-input
              v-model="searchPlate"
              placeholder="搜索车牌号"
              clearable
              :prefix-icon="'Search'"
              style="width: 200px"
            />
          </div>
        </div>
      </template>
      <el-table :data="filteredActiveRecords" stripe max-height="360">
        <el-table-column prop="plateNumber" label="车牌号" width="140" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <span class="monthly-tag" v-if="row.vehicleType === 'monthly'">月卡</span>
            <span class="temp-tag" v-else>临时</span>
          </template>
        </el-table-column>
        <el-table-column prop="entryTime" label="入场时间" width="180" />
        <el-table-column label="已停时长">
          <template #default="{ row }">
            {{ formatDuration(getCurrentParkingDuration(row.entryTime)) }}
          </template>
        </el-table-column>
        <el-table-column label="预估费用">
          <template #default="{ row }">
            ¥{{ estimateFee(row.entryTime).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="quickExit(row)">
              出场计费
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { ParkingRecord } from '@/types'
import { rateStorage, recordStorage } from '@/store/storage'
import {
  vehicleEntry,
  vehicleExit,
  confirmPayment,
  type EntryResult,
  type ExitBillingResult
} from '@/services/parkingService'
import { calculateBilling } from '@/services/billingEngine'

const entryForm = reactive({ plateNumber: '' })
const exitForm = reactive({ plateNumber: '' })
const searchPlate = ref('')

const entryResultMsg = ref('')
const entrySuccess = ref(false)
const entryMonthlyInfo = ref<EntryResult['monthlyCardInfo']>()
const exitResult = ref<{
  success: boolean
  message: string
  result?: ExitBillingResult
  needPayment: boolean
} | null>(null)

const activeRecords = ref<ParkingRecord[]>([])

function refreshActiveRecords() {
  activeRecords.value = recordStorage.getAllActive()
}

const filteredActiveRecords = computed(() => {
  if (!searchPlate.value) return activeRecords.value
  return activeRecords.value.filter(r =>
    r.plateNumber.toLowerCase().includes(searchPlate.value.toLowerCase())
  )
})

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0分钟'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分钟`
  if (m === 0) return `${h}小时`
  return `${h}小时${m}分钟`
}

function getCurrentParkingDuration(entryTime: string): number {
  const entry = new Date(entryTime).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - entry) / 60000))
}

function estimateFee(entryTime: string): number {
  try {
    const now = new Date()
    const exitTime = now.toISOString().replace('T', ' ').substring(0, 19)
    const rates = rateStorage.getAll()
    const result = calculateBilling(entryTime, exitTime, rates)
    return result.grossAmount
  } catch {
    return 0
  }
}

function handleEntry() {
  const result = vehicleEntry(entryForm.plateNumber)
  entryResultMsg.value = result.message
  entrySuccess.value = result.success
  entryMonthlyInfo.value = result.monthlyCardInfo

  if (result.success) {
    if (result.isMonthlyCard) {
      ElMessage.success({
        message: `月卡车 ${entryForm.plateNumber} 入场成功，欢迎 ${result.monthlyCardInfo?.ownerName}`,
        duration: 3000
      })
    } else {
      ElMessage.success(result.message)
    }
    entryForm.plateNumber = ''
    refreshActiveRecords()
  } else {
    ElMessage.warning(result.message)
  }
}

function handleExit() {
  const plate = exitForm.plateNumber
  if (!plate) {
    ElMessage.warning('请输入车牌号')
    return
  }
  exitResult.value = vehicleExit(plate)

  if (!exitResult.value.success) {
    ElMessage.warning(exitResult.value.message)
  } else if (!exitResult.value.needPayment) {
    ElMessage.success(exitResult.value.message)
    exitForm.plateNumber = ''
    refreshActiveRecords()
  }
}

function handlePay(method: 'cash' | 'wechat' | 'alipay' | 'card') {
  const plate = exitForm.plateNumber
  const result = confirmPayment(plate, method)

  if (result.success) {
    ElMessage.success(result.message)
    exitResult.value = null
    exitForm.plateNumber = ''
    refreshActiveRecords()
  } else {
    ElMessage.error(result.message)
  }
}

function quickExit(row: ParkingRecord) {
  exitForm.plateNumber = row.plateNumber
  handleExit()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(refreshActiveRecords)
</script>
