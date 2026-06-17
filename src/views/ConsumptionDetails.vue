<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Tickets /></el-icon>
        消费明细查询
      </h2>
      <div class="action-bar" style="margin: 0">
        <el-button type="warning" :icon="'Download'" :disabled="filteredDetails.length === 0">
          导出明细
        </el-button>
      </div>
    </div>

    <el-card class="card-shadow">
      <div class="action-bar">
        <el-date-picker
          v-model="dateRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm"
          style="width: 400px"
        />
        <el-input
          v-model="searchPlate"
          placeholder="输入车牌号查询"
          clearable
          :prefix-icon="'Search'"
          style="width: 180px"
        />
        <el-input
          v-model="searchCardNo"
          placeholder="输入月卡编号"
          clearable
          :prefix-icon="'CreditCard'"
          style="width: 180px"
        />
        <el-select v-model="filterType" placeholder="车辆类型" style="width: 140px" clearable>
          <el-option label="月卡车" value="monthly" />
          <el-option label="临时车" value="temporary" />
        </el-select>
        <el-button type="primary" :icon="'Search'" @click="loadData">查询</el-button>
        <el-button :icon="'Refresh'" @click="resetFilter">重置</el-button>
      </div>

      <el-row :gutter="16" style="margin: 16px 0">
        <el-col :span="6">
          <div class="stat-card blue card-shadow">
            <div class="stat-label">总记录数</div>
            <div class="stat-value">{{ filteredDetails.length }}</div>
            <div class="stat-sub">笔</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card green card-shadow">
            <div class="stat-label">累计自付</div>
            <div class="stat-value">¥{{ totalSelfPay.toFixed(2) }}</div>
            <div class="stat-sub">元</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card purple card-shadow">
            <div class="stat-label">免费抵扣</div>
            <div class="stat-value">¥{{ totalFreeDeduct.toFixed(2) }}</div>
            <div class="stat-sub">元 ({{ totalFreeMinutes }}分钟)</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card orange card-shadow">
            <div class="stat-label">额度抵扣</div>
            <div class="stat-value">¥{{ totalQuotaDeduct.toFixed(2) }}</div>
            <div class="stat-sub">元 ({{ totalQuotaMinutes }}分钟)</div>
          </div>
        </el-col>
      </el-row>

      <el-table :data="filteredDetails" stripe max-height="520">
        <el-table-column prop="plateNumber" label="车牌号" width="110">
          <template #default="{ row }">
            <span style="font-family: monospace; font-weight: 600">{{ row.plateNumber }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="cardNo" label="月卡编号" width="130">
          <template #default="{ row }">
            <el-tag v-if="row.cardNo" type="warning" effect="light">{{ row.cardNo }}</el-tag>
            <span v-else style="color: #c0c4cc">临时车</span>
          </template>
        </el-table-column>
        <el-table-column prop="ownerName" label="车主" width="90" />
        <el-table-column prop="entryTime" label="入场时间" width="150" />
        <el-table-column prop="exitTime" label="出场时间" width="150" />
        <el-table-column label="停放时长" width="100">
          <template #default="{ row }">{{ formatDuration(row.totalDuration) }}</template>
        </el-table-column>
        <el-table-column label="原始分段" min-width="160">
          <template #default="{ row }">
            <el-popover placement="left" :width="380" trigger="hover">
              <template #reference>
                <el-tag type="info" effect="plain" style="cursor: pointer">
                  {{ (row.originalSegments || row.billedSegments).length }}段明细
                </el-tag>
              </template>
              <div style="font-size: 13px">
                <div style="font-weight: 600; color: #409eff; margin-bottom: 6px">① 原始分段（未抵扣）</div>
                <div v-for="(seg, idx) in (row.originalSegments || row.billedSegments)" :key="idx" class="segment-row">
                  <span>
                    <strong>{{ seg.rateName }}</strong>
                    {{ seg.startTime.slice(11, 16) }}-{{ seg.endTime.slice(11, 16) }}
                    ({{ seg.durationMinutes }}分)
                  </span>
                  <span style="color: #f56c6c">¥{{ seg.amount.toFixed(2) }}</span>
                </div>
                <el-divider style="margin: 6px 0" />
                <div class="segment-row">
                  <span>毛金额</span>
                  <span>¥{{ row.grossAmount.toFixed(2) }}</span>
                </div>
                <div class="segment-row" v-if="row.freeDeduction > 0">
                  <span class="negative">免费抵扣 ({{row.freeDeductedMinutes || 0}}分)</span>
                  <span class="negative">-¥{{ row.freeDeduction.toFixed(2) }}</span>
                </div>
                <div class="segment-row" v-if="row.quotaDeduction > 0">
                  <span class="negative">额度抵扣 ({{row.quotaDeductedMinutes || 0}}分)</span>
                  <span class="negative">-¥{{ row.quotaDeduction.toFixed(2) }}</span>
                </div>
                <div class="total-row">
                  <span>实收</span>
                  <span class="positive">¥{{ row.selfPayAmount.toFixed(2) }}</span>
                </div>
              </div>
            </el-popover>
          </template>
        </el-table-column>
        <el-table-column label="支付方式" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.paymentMethod === 'wechat'" type="success" effect="light">微信</el-tag>
            <el-tag v-else-if="row.paymentMethod === 'alipay'" type="primary" effect="light">支付宝</el-tag>
            <el-tag v-else-if="row.paymentMethod === 'cash'" type="info" effect="light">现金</el-tag>
            <el-tag v-else-if="row.selfPayAmount === 0" type="warning" effect="light">免费</el-tag>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="应收" width="90">
          <template #default="{ row }">
            <span style="color: #909399">¥{{ row.grossAmount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="优惠" width="100">
          <template #default="{ row }">
            <span class="negative">-¥{{ (row.freeDeduction + row.quotaDeduction).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实收" width="100" fixed="right">
          <template #default="{ row }">
            <span style="color: #f56c6c; font-weight: 600">¥{{ row.selfPayAmount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="openReceipt(row)">小票</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="filteredDetails.length === 0" description="暂无消费明细数据" style="padding: 40px 0" />
    </el-card>

    <el-dialog v-model="receiptVisible" title="收费小票" width="600px" destroy-on-close>
      <ParkingReceipt v-if="currentDetail" :data="currentDetail" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { detailStorage } from '@/store/storage'
import type { ConsumptionDetail } from '@/types'
import dayjs from 'dayjs'
import ParkingReceipt from '@/components/ParkingReceipt.vue'

const details = ref<ConsumptionDetail[]>([])
const searchPlate = ref('')
const searchCardNo = ref('')
const filterType = ref('')
const dateRange = ref<string[]>([
  dayjs().startOf('month').format('YYYY-MM-DD 00:00:00'),
  dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss')
])

const receiptVisible = ref(false)
const currentDetail = ref<ConsumptionDetail | null>(null)

const filteredDetails = computed(() => {
  let list = details.value
  if (dateRange.value && dateRange.value.length === 2) {
    list = list.filter(d => d.createdAt >= dateRange.value![0] && d.createdAt <= dateRange.value![1])
  }
  if (searchPlate.value) {
    const kw = searchPlate.value.toLowerCase()
    list = list.filter(d => d.plateNumber.toLowerCase().includes(kw))
  }
  if (searchCardNo.value) {
    const kw = searchCardNo.value.toLowerCase()
    list = list.filter(d => d.cardNo && d.cardNo.toLowerCase().includes(kw))
  }
  if (filterType.value) {
    list = list.filter(d =>
      filterType.value === 'monthly' ? !!d.cardNo : !d.cardNo
    )
  }
  return list
})

const totalSelfPay = computed(() =>
  filteredDetails.value.reduce((s, d) => s + d.selfPayAmount, 0)
)
const totalFreeDeduct = computed(() =>
  filteredDetails.value.reduce((s, d) => s + d.freeDeduction, 0)
)
const totalQuotaDeduct = computed(() =>
  filteredDetails.value.reduce((s, d) => s + d.quotaDeduction, 0)
)
const totalFreeMinutes = computed(() =>
  filteredDetails.value.reduce((s, d) => s + (d.freeDeductedMinutes || 0), 0)
)
const totalQuotaMinutes = computed(() =>
  filteredDetails.value.reduce((s, d) => s + (d.quotaDeductedMinutes || 0), 0)
)

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0分'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}时`
  return `${h}时${m}分`
}

function loadData() {
  details.value = detailStorage.getAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function resetFilter() {
  searchPlate.value = ''
  searchCardNo.value = ''
  filterType.value = ''
  dateRange.value = [
    dayjs().startOf('month').format('YYYY-MM-DD 00:00:00'),
    dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss')
  ]
  loadData()
}

function openReceipt(row: ConsumptionDetail) {
  currentDetail.value = row
  receiptVisible.value = true
}

onMounted(loadData)
</script>
