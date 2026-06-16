<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><DataAnalysis /></el-icon>
        运营数据看板
      </h2>
      <el-button type="primary" :icon="'Refresh'" @click="loadStats">
        刷新数据
      </el-button>
    </div>

    <el-row :gutter="16">
      <el-col :span="4">
        <div class="stat-card blue card-shadow">
          <div class="stat-label">今日进场</div>
          <div class="stat-value">{{ stats.todayInCount }}</div>
          <div class="stat-sub">辆次</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card green card-shadow">
          <div class="stat-label">今日出场</div>
          <div class="stat-value">{{ stats.todayOutCount }}</div>
          <div class="stat-sub">辆次</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card orange card-shadow">
          <div class="stat-label">今日营收</div>
          <div class="stat-value">¥{{ stats.todayRevenue }}</div>
          <div class="stat-sub">元</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card card-shadow">
          <div class="stat-label">平均停放</div>
          <div class="stat-value">{{ avgDurationFormatted }}</div>
          <div class="stat-sub">小时/次</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card purple card-shadow">
          <div class="stat-label">在役月卡</div>
          <div class="stat-value">{{ stats.monthlyCardCount }}</div>
          <div class="stat-sub">张</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card red card-shadow">
          <div class="stat-label">车位占用率</div>
          <div class="stat-value">{{ stats.occupancyRate }}%</div>
          <div class="stat-sub">高峰时段: {{ stats.peakHour }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 20px">
      <el-col :span="16">
        <el-card class="card-shadow">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span style="font-weight: 600; font-size: 16px">
                <el-icon><TrendCharts /></el-icon>
                近7日营收趋势
              </span>
            </div>
          </template>
          <div style="height: 280px; display: flex; align-items: flex-end; gap: 12px; padding: 20px 0">
            <div
              v-for="(item, idx) in revenueTrend"
              :key="idx"
              style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px"
            >
              <div style="font-size: 12px; color: #f56c6c; font-weight: 600">
                ¥{{ item.revenue }}
              </div>
              <div
                :style="{
                  height: maxRevenue > 0 ? `${(item.revenue / maxRevenue) * 200 + 8}px` : '8px',
                  width: '100%',
                  background: 'linear-gradient(180deg, #4facfe 0%, #00c6fb 100%)',
                  borderRadius: '8px 8px 0 0',
                  minWidth: '32px',
                  transition: 'height 0.5s ease'
                }"
              ></div>
              <div style="font-size: 12px; color: #909399">{{ item.date }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="card-shadow">
          <template #header>
            <span style="font-weight: 600; font-size: 16px">
              <el-icon><Medal /></el-icon>
              高频访问车辆TOP5
            </span>
          </template>
          <el-empty v-if="stats.topVehicles.length === 0" description="暂无数据" />
          <div v-else style="display: flex; flex-direction: column; gap: 12px">
            <div
              v-for="(v, idx) in stats.topVehicles"
              :key="idx"
              style="display: flex; align-items: center; gap: 12px"
            >
              <div
                :style="{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: idx === 0 ? '#f56c6c' : idx === 1 ? '#e6a23c' : idx === 2 ? '#67c23a' : '#909399',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  flexShrink: 0
                }"
              >
                {{ idx + 1 }}
              </div>
              <div style="flex: 1; font-weight: 600; letter-spacing: 1px">
                {{ v.plateNumber }}
              </div>
              <div style="color: #606266; font-size: 13px">{{ v.count }}次</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 20px">
      <el-col :span="12">
        <el-card class="card-shadow">
          <template #header>
            <span style="font-weight: 600; font-size: 16px">
              <el-icon><Van /></el-icon>
              最新出场记录
            </span>
          </template>
          <el-table :data="recentRecords" stripe size="small">
            <el-table-column prop="plateNumber" label="车牌" width="110" />
            <el-table-column label="类型" width="70">
              <template #default="{ row }">
                <span class="monthly-tag" v-if="row.vehicleType === 'monthly'" style="font-size: 11px">月</span>
                <span class="temp-tag" v-else style="font-size: 11px">临</span>
              </template>
            </el-table-column>
            <el-table-column label="时长" width="90">
              <template #default="{ row }">
                {{ formatDuration(row.durationMinutes || 0) }}
              </template>
            </el-table-column>
            <el-table-column label="费用" width="80">
              <template #default="{ row }">
                <span class="positive">¥{{ (row.selfPaidAmount || 0).toFixed(0) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="paidAt" label="支付时间">
              <template #default="{ row }">
                {{ row.paidAt ? row.paidAt.slice(11, 16) : '-' }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="card-shadow">
          <template #header>
            <span style="font-weight: 600; font-size: 16px">
              <el-icon><Clock /></el-icon>
              时段费率分布
            </span>
          </template>
          <el-empty v-if="rates.length === 0" description="请先配置时段费率" />
          <div v-else style="display: flex; flex-direction: column; gap: 10px; padding: 8px 0">
            <div v-for="(r, idx) in rates" :key="idx" style="display: flex; flex-direction: column; gap: 4px">
              <div style="display: flex; justify-content: space-between; font-size: 13px">
                <span style="color: #303133; font-weight: 500">
                  {{ r.name }} ({{ r.startTime }} - {{ r.endTime }})
                </span>
                <span style="color: #f56c6c; font-weight: 600">¥{{ r.ratePerHour }}/时</span>
              </div>
              <div class="progress-bar-wrapper">
                <div
                  class="progress-bar-inner"
                  :style="{
                    width: maxRate > 0 ? `${(r.ratePerHour / maxRate) * 100}%` : '0%',
                    background: idx % 3 === 0
                      ? 'linear-gradient(90deg, #4facfe, #00c6fb)'
                      : idx % 3 === 1
                      ? 'linear-gradient(90deg, #fa709a, #fee140)'
                      : 'linear-gradient(90deg, #43e97b, #38f9d7)'
                  }"
                ></div>
              </div>
              <div style="font-size: 11px; color: #909399">
                <span v-if="r.minFee">最低¥{{ r.minFee }}</span>
                <span v-if="r.minFee && r.maxFeePerDay"> / </span>
                <span v-if="r.maxFeePerDay">日封顶¥{{ r.maxFeePerDay }}</span>
                <span v-if="r.freeMinutes"> / 免费{{ r.freeMinutes }}分钟</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getDashboardStats } from '@/services/parkingService'
import { recordStorage, rateStorage } from '@/store/storage'
import { detailStorage } from '@/store/storage'
import type { DashboardStats, ParkingRecord, TimeRate } from '@/types'
import dayjs from 'dayjs'

const stats = ref<DashboardStats>({
  todayInCount: 0,
  todayOutCount: 0,
  todayRevenue: 0,
  todayAverageDuration: 0,
  monthlyCardCount: 0,
  occupancyRate: 0,
  peakHour: '-',
  topVehicles: []
})

const rates = ref<TimeRate[]>([])
const recentRecords = ref<ParkingRecord[]>([])

const avgDurationFormatted = computed(() => {
  const h = stats.value.todayAverageDuration / 60
  return h.toFixed(1)
})

const maxRate = computed(() => {
  if (rates.value.length === 0) return 0
  return Math.max(...rates.value.map(r => r.ratePerHour))
})

const revenueTrend = computed(() => {
  const days: { date: string; revenue: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const day = dayjs().subtract(i, 'day')
    const dayStart = day.startOf('day').format('YYYY-MM-DD HH:mm:ss')
    const dayEnd = day.endOf('day').format('YYYY-MM-DD HH:mm:ss')
    const details = detailStorage.getByDateRange(dayStart, dayEnd)
    const revenue = Number(
      details.reduce((sum, d) => sum + d.selfPayAmount, 0).toFixed(0)
    )
    days.push({
      date: day.format('MM/DD'),
      revenue
    })
  }
  return days
})

const maxRevenue = computed(() => {
  const vals = revenueTrend.value.map(d => d.revenue)
  return Math.max(...vals, 1)
})

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0分'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}时`
  return `${h}时${m}分`
}

function loadStats() {
  stats.value = getDashboardStats()
  rates.value = rateStorage.getEnabled()
  const allRecords = recordStorage
    .getAll()
    .filter(r => r.status !== 'parking')
    .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''))
  recentRecords.value = allRecords.slice(0, 8)
}

onMounted(loadStats)
</script>
