<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Document /></el-icon>
        账单管理
      </h2>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="账单列表" name="list">
        <el-row :gutter="16">
          <el-col :span="16">
            <el-card class="card-shadow">
              <template #header>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px">
                  <span style="font-weight: 600; font-size: 16px">已完成账单记录</span>
                  <div class="action-bar" style="margin: 0">
                    <el-date-picker v-model="month" type="month" placeholder="选择月份" value-format="YYYY-MM" style="width: 160px" />
                    <el-input v-model="searchPlate" placeholder="车牌号" clearable :prefix-icon="'Search'" style="width: 140px" />
                    <el-input v-model="searchCardNo" placeholder="月卡编号" clearable :prefix-icon="'CreditCard'" style="width: 140px" />
                  </div>
                </div>
              </template>
              <el-table ref="billTableRef" :data="monthlyBills" stripe max-height="480" @selection-change="handleSelectionChange">
                <el-table-column type="selection" width="40" />
                <el-table-column type="index" label="#" width="50" />
                <el-table-column prop="plateNumber" label="车牌" width="110">
                  <template #default="{ row }">
                    <span style="font-family: monospace; font-weight: 600">{{ row.plateNumber }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="cardNo" label="关联月卡" width="130">
                  <template #default="{ row }">
                    <el-tag v-if="row.cardNo" type="warning" effect="light" size="small">{{ row.cardNo }}</el-tag>
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
              <div style="margin-top: 12px; display: flex; gap: 8px" v-if="selectedBills.length > 0">
                <el-tag type="info">已选 {{ selectedBills.length }} 条</el-tag>
                <el-button type="primary" size="small" @click="batchPrintReceipt">补打小票</el-button>
                <el-button type="success" size="small" @click="exportReconciliation">导出对账单</el-button>
              </div>
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
                  <span class="info-value" style="font-size: 18px; color: #409eff; font-weight: 600">{{ summary.totalCount }} 笔</span>
                </div>
                <el-divider style="margin: 8px 0" />
                <div class="info-row"><span class="info-label">月卡车交易</span><span class="info-value">{{ summary.monthlyCount }} 笔</span></div>
                <div class="info-row"><span class="info-label">临时车交易</span><span class="info-value">{{ summary.tempCount }} 笔</span></div>
                <el-divider style="margin: 8px 0" />
                <div class="info-row"><span class="info-label">应收总金额</span><span class="info-value">¥{{ summary.grossTotal.toFixed(2) }}</span></div>
                <div class="info-row"><span class="info-label">免费抵扣合计</span><span class="info-value negative">-¥{{ summary.freeTotal.toFixed(2) }}</span></div>
                <div class="info-row"><span class="info-label">月卡额度抵扣</span><span class="info-value negative">-¥{{ summary.quotaTotal.toFixed(2) }}</span></div>
                <div class="info-row" style="padding-top: 12px; border-top: 2px solid #dcdfe6; margin-top: 4px">
                  <span class="info-label" style="font-size: 15px; font-weight: 600">实际总收入</span>
                  <span class="info-value" style="font-size: 22px; color: #f56c6c; font-weight: 700">¥{{ summary.payTotal.toFixed(2) }}</span>
                </div>
                <div style="margin-top: 16px">
                  <div style="font-size: 13px; color: #606266; margin-bottom: 8px">收入占比</div>
                  <div style="display: flex; flex-direction: column; gap: 8px">
                    <div>
                      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
                        <span>临时车收入</span><span style="color: #409eff">{{ summary.tempPayPercent }}%</span>
                      </div>
                      <div class="progress-bar-wrapper">
                        <div class="progress-bar-inner" :style="{ width: summary.tempPayPercent + '%', background: 'linear-gradient(90deg, #409eff, #66b1ff)' }"></div>
                      </div>
                    </div>
                    <div>
                      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
                        <span>月卡车自费</span><span style="color: #67c23a">{{ summary.overPayPercent }}%</span>
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
      </el-tab-pane>

      <el-tab-pane label="对账视图" name="reconcile">
        <el-card class="card-shadow">
          <div class="action-bar" style="margin-bottom: 16px">
            <el-date-picker v-model="reconcileDateRange" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm" style="width: 400px" />
            <el-input v-model="reconcilePlate" placeholder="车牌号" clearable :prefix-icon="'Search'" style="width: 160px" />
            <el-input v-model="reconcileCardNo" placeholder="月卡编号" clearable :prefix-icon="'CreditCard'" style="width: 160px" />
            <el-button type="primary" :icon="'Search'" @click="loadReconcileData">查询</el-button>
            <el-button :icon="'Refresh'" @click="resetReconcile">重置</el-button>
            <el-button type="success" @click="exportReconciliation" :disabled="reconcileRows.length === 0">导出对账单</el-button>
          </div>

          <el-table :data="reconcileRows" stripe max-height="560" :row-class-name="reconcileRowClass">
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="plateNumber" label="车牌" width="100">
              <template #default="{ row }">
                <span style="font-family: monospace; font-weight: 600">{{ row.plateNumber }}</span>
              </template>
            </el-table-column>
            <el-table-column label="入→出" width="210">
              <template #default="{ row }">
                <div style="font-size: 12px">
                  <div>入: {{ row.entryTime?.slice(5) || '-' }}</div>
                  <div>出: {{ row.exitTime?.slice(5) || '-' }}</div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="时长(分)" width="80">
              <template #default="{ row }">{{ row.durationMinutes ?? row.totalDuration ?? '-' }}</template>
            </el-table-column>
            <el-table-column label="应收" width="80">
              <template #default="{ row }">
                <span :style="{ color: row.grossMismatch ? '#f56c6c' : '#909399', fontWeight: row.grossMismatch ? '600' : 'normal' }">¥{{ (row.grossAmount ?? 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="免费抵扣" width="90">
              <template #default="{ row }">
                <span class="negative">-¥{{ (row.freeDeduction ?? 0).toFixed(2) }}</span>
                <div v-if="row.freeDeductedMinutes" style="font-size:11px; color:#909399">{{ row.freeDeductedMinutes }}分</div>
              </template>
            </el-table-column>
            <el-table-column label="额度抵扣" width="90">
              <template #default="{ row }">
                <span class="negative">-¥{{ (row.quotaDeduction ?? 0).toFixed(2) }}</span>
                <div v-if="row.quotaDeductedMinutes" style="font-size:11px; color:#909399">{{ row.quotaDeductedMinutes }}分</div>
              </template>
            </el-table-column>
            <el-table-column label="实付" width="90">
              <template #default="{ row }">
                <span :style="{ color: row.payMismatch ? '#f56c6c' : '#f56c6c', fontWeight: row.payMismatch ? '700' : '600', fontSize: row.payMismatch ? '15px' : '14px' }">¥{{ (row.selfPayAmount ?? 0).toFixed(2) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="额度流水" width="120">
              <template #default="{ row }">
                <template v-if="row.quotaTx">
                  <div style="font-size:12px">扣{{ row.quotaTx.changeMinutes }}分</div>
                  <div style="font-size:11px; color:#909399">余{{ formatDuration(row.quotaTx.balanceAfter) }}</div>
                </template>
                <span v-else style="color:#c0c4cc">-</span>
              </template>
            </el-table-column>
            <el-table-column label="一致性" width="90">
              <template #default="{ row }">
                <el-tag v-if="row.allMatch" type="success" effect="light" size="small">一致</el-tag>
                <el-tag v-else type="danger" effect="light" size="small">异常</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" link @click="showReceiptFromReconcile(row)">小票</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="reconcileRows.length === 0" description="暂无对账数据" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

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
            <span class="segment-label negative">免费时长抵扣（{{ currentBill.freeDeductedMinutes || 0 }}分钟）</span>
            <span class="segment-value negative">-¥{{ currentBill.freeDeduction.toFixed(2) }}</span>
          </div>
          <div class="segment-row" v-if="currentBill.quotaDeduction > 0">
            <span class="segment-label negative">月卡额度抵扣（{{ currentBill.quotaDeductedMinutes || 0 }}分钟）</span>
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

    <el-dialog v-model="batchReceiptVisible" title="对账单汇总" width="800px" destroy-on-close>
      <div v-if="exportData.rows.length > 0" style="padding: 0 0 16px 0">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="记录数">{{ exportData.rows.length }} 笔</el-descriptions-item>
          <el-descriptions-item label="应收合计">¥{{ exportData.grossTotal.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="实收合计">¥{{ exportData.payTotal.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="免费抵扣">-¥{{ exportData.freeTotal.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="额度抵扣">-¥{{ exportData.quotaTotal.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="异常笔数">
            <span :style="{ color: exportData.mismatchCount > 0 ? '#f56c6c' : '#67c23a', fontWeight: '600' }">
              {{ exportData.mismatchCount }} 笔
            </span>
          </el-descriptions-item>
        </el-descriptions>

        <el-table :data="exportData.rows" stripe max-height="400" style="margin-top: 12px">
          <el-table-column prop="plateNumber" label="车牌" width="100" />
          <el-table-column label="入→出" width="210">
            <template #default="{ row }">
              <div style="font-size:12px">{{ row.entryTime?.slice(5) || '-' }} → {{ row.exitTime?.slice(5) || '-' }}</div>
            </template>
          </el-table-column>
          <el-table-column label="时长" width="70">
            <template #default="{ row }">{{ row.totalDuration }}分</template>
          </el-table-column>
          <el-table-column label="应收" width="80">
            <template #default="{ row }">¥{{ row.grossAmount.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="免费抵扣" width="90">
            <template #default="{ row }">-¥{{ row.freeDeduction.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="额度抵扣" width="90">
            <template #default="{ row }">-¥{{ row.quotaDeduction.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="实收" width="80">
            <template #default="{ row }">¥{{ row.selfPayAmount.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="70">
            <template #default="{ row }">
              <el-tag :type="row.allMatch ? 'success' : 'danger'" effect="light" size="small">{{ row.allMatch ? '一致' : '异常' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <el-empty v-else description="暂无数据" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { detailStorage, recordStorage, quotaTransactionStorage } from '@/store/storage'
import type { ConsumptionDetail, ParkingRecord, QuotaTransaction } from '@/types'
import dayjs from 'dayjs'
import ParkingReceipt from '@/components/ParkingReceipt.vue'

const activeTab = ref('list')
const month = ref(dayjs().format('YYYY-MM'))
const searchPlate = ref('')
const searchCardNo = ref('')
const details = ref<ConsumptionDetail[]>([])
const receiptVisible = ref(false)
const detailVisible = ref(false)
const batchReceiptVisible = ref(false)
const currentBill = ref<ConsumptionDetail | null>(null)
const selectedBills = ref<ConsumptionDetail[]>([])
const billTableRef = ref()

const reconcileDateRange = ref<string[]>([
  dayjs().startOf('month').format('YYYY-MM-DD 00:00:00'),
  dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss')
])
const reconcilePlate = ref('')
const reconcileCardNo = ref('')
const reconcileRows = ref<any[]>([])

const exportData = reactive({
  rows: [] as any[],
  grossTotal: 0,
  freeTotal: 0,
  quotaTotal: 0,
  payTotal: 0,
  mismatchCount: 0
})

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
  if (!minutes || minutes <= 0) return '0分'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}时`
  return `${h}时${m}分`
}

function handleSelectionChange(rows: ConsumptionDetail[]) {
  selectedBills.value = rows
}

function showDetail(row: ConsumptionDetail) {
  currentBill.value = row
  detailVisible.value = true
}
function showReceipt(row: ConsumptionDetail) {
  currentBill.value = row
  receiptVisible.value = true
}
function showReceiptFromReconcile(row: any) {
  if (row.detail) {
    currentBill.value = row.detail
    receiptVisible.value = true
  }
}

function buildReconcileRow(detail: ConsumptionDetail, record: ParkingRecord | undefined, quotaTx: QuotaTransaction | undefined) {
  const recordGross = record?.totalAmount
  const recordDuration = record?.durationMinutes
  const detailGross = detail.grossAmount
  const detailDuration = detail.totalDuration
  const expectedPay = Number((detailGross - detail.freeDeduction - detail.quotaDeduction).toFixed(2))

  const grossMismatch = recordGross !== undefined && Math.abs(recordGross - detailGross) > 0.01
  const durationMismatch = recordDuration !== undefined && recordDuration !== detailDuration
  const payMismatch = Math.abs(detail.selfPayAmount - expectedPay) > 0.01
  const allMatch = !grossMismatch && !durationMismatch && !payMismatch

  return {
    plateNumber: detail.plateNumber,
    entryTime: detail.entryTime,
    exitTime: detail.exitTime,
    totalDuration: detail.totalDuration,
    durationMinutes: recordDuration,
    grossAmount: detailGross,
    freeDeduction: detail.freeDeduction,
    freeDeductedMinutes: detail.freeDeductedMinutes,
    quotaDeduction: detail.quotaDeduction,
    quotaDeductedMinutes: detail.quotaDeductedMinutes,
    selfPayAmount: detail.selfPayAmount,
    quotaTx: quotaTx ? { changeMinutes: Math.abs(quotaTx.changeMinutes), balanceAfter: quotaTx.balanceAfter } : null,
    grossMismatch,
    durationMismatch,
    payMismatch,
    allMatch,
    detail
  }
}

function reconcileRowClass({ row }: { row: any }): string {
  if (!row.allMatch) return 'reconcile-mismatch-row'
  return ''
}

function loadReconcileData() {
  let detailList = details.value
  if (reconcileDateRange.value && reconcileDateRange.value.length === 2) {
    detailList = detailList.filter(d => d.createdAt >= reconcileDateRange.value![0] && d.createdAt <= reconcileDateRange.value![1])
  }
  if (reconcilePlate.value) {
    const kw = reconcilePlate.value.toLowerCase()
    detailList = detailList.filter(d => d.plateNumber.toLowerCase().includes(kw))
  }
  if (reconcileCardNo.value) {
    const kw = reconcileCardNo.value.toLowerCase()
    detailList = detailList.filter(d => d.cardNo && d.cardNo.toLowerCase().includes(kw))
  }

  const rows: any[] = []
  for (const detail of detailList) {
    const record = recordStorage.getAll().find(r => r.id === detail.recordId)
    const quotaTx = detail.id ? quotaTransactionStorage.getByDetailId(detail.id) : undefined
    rows.push(buildReconcileRow(detail, record, quotaTx))
  }
  reconcileRows.value = rows
}

function resetReconcile() {
  reconcilePlate.value = ''
  reconcileCardNo.value = ''
  reconcileDateRange.value = [
    dayjs().startOf('month').format('YYYY-MM-DD 00:00:00'),
    dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss')
  ]
  reconcileRows.value = []
}

function batchPrintReceipt() {
  if (selectedBills.value.length === 0) return
  currentBill.value = selectedBills.value[0]
  receiptVisible.value = true
}

function exportReconciliation() {
  const sourceRows = selectedBills.value.length > 0 ? selectedBills.value : reconcileRows.value.map(r => r.detail).filter(Boolean) as ConsumptionDetail[]
  if (sourceRows.length === 0) return

  const rows: any[] = []
  let grossTotal = 0, freeTotal = 0, quotaTotal = 0, payTotal = 0, mismatchCount = 0

  for (const detail of sourceRows) {
    const record = recordStorage.getAll().find(r => r.id === detail.recordId)
    const quotaTx = detail.id ? quotaTransactionStorage.getByDetailId(detail.id) : undefined
    const row = buildReconcileRow(detail, record, quotaTx)
    rows.push(row)
    grossTotal += detail.grossAmount
    freeTotal += detail.freeDeduction
    quotaTotal += detail.quotaDeduction
    payTotal += detail.selfPayAmount
    if (!row.allMatch) mismatchCount++
  }

  exportData.rows = rows
  exportData.grossTotal = grossTotal
  exportData.freeTotal = freeTotal
  exportData.quotaTotal = quotaTotal
  exportData.payTotal = payTotal
  exportData.mismatchCount = mismatchCount
  batchReceiptVisible.value = true
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
:deep(.reconcile-mismatch-row) {
  background-color: #fef0f0 !important;
}
:deep(.reconcile-mismatch-row:hover > td) {
  background-color: #fde2e2 !important;
}
</style>
