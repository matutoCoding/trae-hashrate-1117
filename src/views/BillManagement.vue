<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Document /></el-icon>
        账单管理
      </h2>
    </div>

    <el-row :gutter="16">
      <el-col :span="16">
        <el-card class="card-shadow">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px">
              <span style="font-weight: 600; font-size: 16px">已完成账单记录</span>
              <div class="action-bar" style="margin: 0">
                <el-date-picker
                  v-model="month"
                  type="month"
                  placeholder="选择月份"
                  value-format="YYYY-MM"
                  style="width: 160px"
                />
                <el-input
                  v-model="searchPlate"
                  placeholder="车牌号"
                  clearable
                  :prefix-icon="'Search'"
                  style="width: 140px"
                  size="default"
                />
                <el-input
                  v-model="searchCardNo"
                  placeholder="月卡编号"
                  clearable
                  :prefix-icon="'CreditCard'"
                  style="width: 140px"
                  size="default"
                />
              </div>
            </div>
          </template>
          <el-table :data="monthlyBills" stripe max-height="480">
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="plateNumber" label="车牌" width="110">
              <template #default="{ row }">
                <span style="font-family: monospace; font-weight: 600">{{ row.plateNumber }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="cardNo" label="关联月卡" width="130">
              <template #default="{ row }">
                <el-tag v-if="row.cardNo" type="warning" effect="light" size="small">
                  {{ row.cardNo }}
                </el-tag>
                <span v-else style="color: #c0c4cc; font-size: 12px">临时车</span>
              </template>
            </el-table-column>
            <el-table-column label="入→出" width="260">
              <template #default="{ row }">
                <div style="font-size: 12px">
                  <div>入: {{ row.entryTime.slice(5) }}</div>
                  <div>出: {{ row.exitTime?.slice(5) }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="时长" width="90">
              <template #default="{ row }">{{ formatDuration(row.totalDuration) }}</template>
            </el-table-column>
            <el-table-column label="应收" width="80">
              <template #default="{ row }">
                <span style="color: #909399">¥{{ row.grossAmount.toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="优惠" width="90">
              <template #default="{ row }">
                <span class="negative">-¥{{ (row.freeDeduction + row.quotaDeduction).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="实付" width="100">
              <template #default="{ row }">
                <span style="color: #f56c6c; font-weight: 600">¥{{ row.selfPayAmount.toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="支付" width="80">
              <template #default="{ row }">
                <el-tag v-if="row.paymentMethod === 'wechat'" type="success" size="small" effect="light">微信</el-tag>
                <el-tag v-else-if="row.paymentMethod === 'alipay'" type="primary" size="small" effect="light">支付宝</el-tag>
                <el-tag v-else-if="row.paymentMethod === 'cash'" type="info" size="small" effect="light">现金</el-tag>
                <el-tag v-else type="warning" size="small" effect="light">免费</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" link @click="showReceipt(row)">小票</el-button>
                <el-button type="success" size="small" link @click="showDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="monthlyBills.length === 0" description="暂无账单数据" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="card-shadow">
          <template #header>
            <span style="font-weight: 600; font-size: 16px">
              <el-icon><DataLine /></el-icon>
              月度统计汇总
            </span>
          </template>
          <div style="padding: 8px 0">
            <div class="info-row">
              <span class="info-label">统计月份</span>
              <span class="info-value">{{ month || '本月' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">总交易笔数</span>
              <span class="info-value" style="font-size: 18px; color: #409eff; font-weight: 600">
                {{ summary.totalCount }} 笔
              </span>
            </div>
            <el-divider style="margin: 8px 0" />
            <div class="info-row">
              <span class="info-label">月卡车交易</span>
              <span class="info-value">{{ summary.monthlyCount }} 笔</span>
            </div>
            <div class="info-row">
              <span class="info-label">临时车交易</span>
              <span class="info-value">{{ summary.tempCount }} 笔</span>
            </div>
            <el-divider style="margin: 8px 0" />
            <div class="info-row">
              <span class="info-label">应收总金额</span>
              <span class="info-value">¥{{ summary.grossTotal.toFixed(2) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">免费抵扣合计</span>
              <span class="info-value negative">-¥{{ summary.freeTotal.toFixed(2) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">月卡额度抵扣</span>
              <span class="info-value negative">-¥{{ summary.quotaTotal.toFixed(2) }}</span>
            </div>
            <div class="info-row" style="padding-top: 12px; border-top: 2px solid #dcdfe6; margin-top: 4px">
              <span class="info-label" style="font-size: 15px; font-weight: 600">实际总收入</span>
              <span class="info-value" style="font-size: 22px; color: #f56c6c; font-weight: 700">
                ¥{{ summary.payTotal.toFixed(2) }}
              </span>
            </div>
            <div style="margin-top: 16px">
              <div style="font-size: 13px; color: #606266; margin-bottom: 8px">收入占比</div>
              <div style="display: flex; flex-direction: column; gap: 8px">
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
                    <span>临时车收入</span>
                    <span style="color: #409eff">{{ summary.tempPayPercent }}%</span>
                  </div>
                  <div class="progress-bar-wrapper">
                    <div class="progress-bar-inner" :style="{ width: summary.tempPayPercent + '%', background: 'linear-gradient(90deg, #409eff, #66b1ff)' }"></div>
                  </div>
                </div>
                <div>
                  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
                    <span>月卡车自费</span>
                    <span style="color: #67c23a">{{ summary.overPayPercent }}%</span>
                  </div>
                  <div class="progress-bar-wrapper">
                    <div class="progress-bar-inner" :style="{ width: summary.overPayPercent + '%', background: 'linear-gradient(90deg, #67c23a, #95d475)' }"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="receiptVisible" title="收费小票" width="620px" destroy-on-close>
      <ParkingReceipt v-if="currentBill" :data="currentBill" />
    </el-dialog>

    <el-dialog v-model="detailVisible" title="账单详细信息" width="720px" destroy-on-close>
      <div v-if="currentBill">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="车牌号" :span="2">
            <span style="font-family: monospace; font-weight: 600; letter-spacing: 2px">{{ currentBill.plateNumber }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="关联月卡">{{ currentBill.cardNo || '临时车' }}</el-descriptions-item>
          <el-descriptions-item label="车主姓名">{{ currentBill.ownerName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="入场时间">{{ currentBill.entryTime }}</el-descriptions-item>
          <el-descriptions-item label="出场时间">{{ currentBill.exitTime }}</el-descriptions-item>
          <el-descriptions-item label="停放时长" :span="2">
            <strong>{{ formatDuration(currentBill.totalDuration) }}</strong>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">
          <span style="color:#409eff; font-weight:600">① 原始分段计费（未抵扣）</span>
        </el-divider>
        <div class="billing-detail-box">
          <div v-for="(seg, idx) in (currentBill.originalSegments || currentBill.billedSegments)" :key="'o'+idx" class="segment-row">
            <span class="segment-label">
              [{{ seg.rateName }}] {{ seg.startTime.slice(5, 16) }}~{{ seg.endTime.slice(5, 16) }}
              <span style="color: #909399">({{ seg.durationMinutes }}分 × ¥{{ seg.ratePerHour }}/时)</span>
            </span>
            <span class="segment-value">¥{{ seg.amount.toFixed(2) }}</span>
          </div>
          <div class="total-row">
            <span>原始合计</span>
            <span>¥{{ currentBill.grossAmount.toFixed(2) }}</span>
          </div>
        </div>

        <el-divider content-position="left">
          <span style="color:#67c23a; font-weight:600">② 抵扣明细</span>
        </el-divider>
        <div class="billing-detail-box">
          <div class="segment-row" v-if="currentBill.freeDeduction > 0">
            <span class="segment-label negative">
              免费时长抵扣（{{ currentBill.freeDeductedMinutes || 0 }}分钟）
            </span>
            <span class="segment-value negative">-¥{{ currentBill.freeDeduction.toFixed(2) }}</span>
          </div>
          <div class="segment-row" v-if="currentBill.quotaDeduction > 0">
            <span class="segment-label negative">
              月卡额度抵扣（{{ currentBill.quotaDeductedMinutes || 0 }}分钟）
            </span>
            <span class="segment-value negative">-¥{{ currentBill.quotaDeduction.toFixed(2) }}</span>
          </div>
          <div class="segment-row" v-if="currentBill.freeDeduction === 0 && currentBill.quotaDeduction === 0">
            <span class="segment-label" style="color:#909399">无抵扣</span>
            <span class="segment-value" style="color:#909399">¥0.00</span>
          </div>
        </div>

        <el-divider content-position="left">
          <span style="color:#f56c6c; font-weight:600">③ 最终实付</span>
        </el-divider>
        <div style="background:#f5f7fa; padding: 12px; border-radius: 6px">
          <div style="display:flex; justify-content: space-between; align-items: center">
            <span style="font-size: 15px; font-weight: 600">应付金额</span>
            <span style="font-size: 22px; color: #f56c6c; font-weight: 700">¥{{ currentBill.selfPayAmount.toFixed(2) }}</span>
          </div>
        </div>

        <el-descriptions :column="2" border size="small" style="margin-top: 12px">
          <el-descriptions-item label="支付方式">
            <el-tag v-if="currentBill.paymentMethod === 'wechat'" type="success" effect="light">微信支付</el-tag>
            <el-tag v-else-if="currentBill.paymentMethod === 'alipay'" type="primary" effect="light">支付宝</el-tag>
            <el-tag v-else-if="currentBill.paymentMethod === 'cash'" type="info" effect="light">现金</el-tag>
            <el-tag v-else type="warning" effect="light">免费放行</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="支付时间">{{ currentBill.paidAt || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { detailStorage } from '@/store/storage'
import type { ConsumptionDetail } from '@/types'
import dayjs from 'dayjs'
import ParkingReceipt from '@/components/ParkingReceipt.vue'

const month = ref(dayjs().format('YYYY-MM'))
const searchPlate = ref('')
const searchCardNo = ref('')
const details = ref<ConsumptionDetail[]>([])
const receiptVisible = ref(false)
const detailVisible = ref(false)
const currentBill = ref<ConsumptionDetail | null>(null)

const monthlyBills = computed(() => {
  const prefix = month.value + '-'
  let list = details.value.filter(d => d.paidAt && d.paidAt.startsWith(prefix))
  if (searchPlate.value) {
    const kw = searchPlate.value.toLowerCase()
    list = list.filter(d => d.plateNumber.toLowerCase().includes(kw))
  }
  if (searchCardNo.value) {
    const kw = searchCardNo.value.toLowerCase()
    list = list.filter(d => d.cardNo && d.cardNo.toLowerCase().includes(kw))
  }
  return list
})

const summary = computed(() => {
  const bills = monthlyBills.value
  const totalCount = bills.length
  const monthlyCount = bills.filter(b => !!b.cardNo).length
  const tempCount = totalCount - monthlyCount
  const grossTotal = bills.reduce((s, b) => s + b.grossAmount, 0)
  const freeTotal = bills.reduce((s, b) => s + b.freeDeduction, 0)
  const quotaTotal = bills.reduce((s, b) => s + b.quotaDeduction, 0)
  const payTotal = bills.reduce((s, b) => s + b.selfPayAmount, 0)
  const tempPay = bills.filter(b => !b.cardNo).reduce((s, b) => s + b.selfPayAmount, 0)
  const overPay = bills.filter(b => !!b.cardNo).reduce((s, b) => s + b.selfPayAmount, 0)

  return {
    totalCount, monthlyCount, tempCount,
    grossTotal, freeTotal, quotaTotal, payTotal,
    tempPayPercent: payTotal > 0 ? Math.round((tempPay / payTotal) * 100) : 0,
    overPayPercent: payTotal > 0 ? Math.round((overPay / payTotal) * 100) : 0
  }
})

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0分'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}时`
  return `${h}时${m}分`
}

function showDetail(row: ConsumptionDetail) {
  currentBill.value = row
  detailVisible.value = true
}
function showReceipt(row: ConsumptionDetail) {
  currentBill.value = row
  receiptVisible.value = true
}

function loadData() {
  details.value = detailStorage.getAll().sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''))
}

onMounted(loadData)
</script>

<style scoped>
.progress-bar-inner {
  transition: width 0.5s ease;
}
</style>
