<template>
  <div class="parking-receipt">
    <div class="receipt-header">
      <div class="receipt-title">智慧停车场 - 收费小票</div>
      <div class="receipt-sub">PARKING RECEIPT</div>
    </div>

    <el-descriptions :column="2" border size="small" class="receipt-desc">
      <el-descriptions-item label="车牌号" :span="2">
        <span class="plate-no">{{ data.plateNumber }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="车辆类型">
        <el-tag v-if="data.cardNo" type="warning" effect="light" size="small">月卡车</el-tag>
        <el-tag v-else type="info" effect="light" size="small">临时车</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="月卡编号">
        <span v-if="data.cardNo">{{ data.cardNo }}</span>
        <span v-else style="color:#c0c4cc">-</span>
      </el-descriptions-item>
      <el-descriptions-item label="车主" v-if="data.ownerName">{{ data.ownerName }}</el-descriptions-item>
      <el-descriptions-item label="入场时间" :span="2">{{ data.entryTime }}</el-descriptions-item>
      <el-descriptions-item label="出场时间" :span="2">{{ data.exitTime }}</el-descriptions-item>
      <el-descriptions-item label="停放时长" :span="2">
        <strong style="color:#409eff; font-size: 14px">{{ formatDuration(data.totalDuration) }}</strong>
      </el-descriptions-item>
    </el-descriptions>

    <el-divider content-position="left">
      <span class="divider-label">① 原始分段计费（未抵扣）</span>
    </el-divider>
    <div class="billing-detail-box" style="margin-top: 4px">
      <div v-for="(seg, idx) in data.originalSegments" :key="'o'+idx" class="segment-row">
        <span class="segment-label">
          <strong>{{ seg.rateName }}</strong>
          {{ seg.startTime.slice(11, 16) }} ~ {{ seg.endTime.slice(11, 16) }}
          <span style="color:#909399">({{ seg.durationMinutes }}分 × ¥{{ seg.ratePerHour }}/时)</span>
        </span>
        <span class="segment-value">¥{{ seg.amount.toFixed(2) }}</span>
      </div>
      <div class="subtotal-row">
        <span>原始计费合计</span>
        <span>¥{{ data.grossAmount.toFixed(2) }}</span>
      </div>
    </div>

    <el-divider content-position="left">
      <span class="divider-label">② 优惠抵扣明细</span>
    </el-divider>
    <div class="billing-detail-box" style="margin-top: 4px">
      <div class="segment-row" v-if="(data.freeDeductedMinutes ?? 0) > 0">
        <span class="segment-label negative">
          免费时长抵扣（{{ data.freeDeductedMinutes }}分钟）
        </span>
        <span class="segment-value negative">-¥{{ (data.freeDeduction ?? 0).toFixed(2) }}</span>
      </div>
      <div class="segment-row" v-if="(data.quotaDeductedMinutes ?? 0) > 0">
        <span class="segment-label negative">
          月卡额度抵扣（{{ data.quotaDeductedMinutes }}分钟）
        </span>
        <span class="segment-value negative">-¥{{ (data.quotaDeduction ?? 0).toFixed(2) }}</span>
      </div>
      <div class="segment-row" v-if="(data.freeDeductedMinutes ?? 0) === 0 && (data.quotaDeductedMinutes ?? 0) === 0">
        <span class="segment-label" style="color:#909399">无抵扣</span>
        <span class="segment-value" style="color:#909399">¥0.00</span>
      </div>
    </div>

    <el-divider content-position="left">
      <span class="divider-label">③ 最终结算</span>
    </el-divider>
    <div class="settle-box">
      <div class="settle-row">
        <span>应收</span>
        <span>¥{{ data.grossAmount.toFixed(2) }}</span>
      </div>
      <div class="settle-row" v-if="(data.freeDeduction ?? 0) > 0">
        <span class="negative">免费抵扣</span>
        <span class="negative">-¥{{ (data.freeDeduction ?? 0).toFixed(2) }}</span>
      </div>
      <div class="settle-row" v-if="(data.quotaDeduction ?? 0) > 0">
        <span class="negative">额度抵扣</span>
        <span class="negative">-¥{{ (data.quotaDeduction ?? 0).toFixed(2) }}</span>
      </div>
      <div class="settle-total">
        <span>实付金额</span>
        <span class="positive big">¥{{ data.selfPayAmount.toFixed(2) }}</span>
      </div>
    </div>

    <el-descriptions :column="2" border size="small" class="receipt-desc" style="margin-top: 12px">
      <el-descriptions-item label="支付方式">
        <el-tag v-if="data.paymentMethod === 'wechat'" type="success" effect="light" size="small">微信支付</el-tag>
        <el-tag v-else-if="data.paymentMethod === 'alipay'" type="primary" effect="light" size="small">支付宝</el-tag>
        <el-tag v-else-if="data.paymentMethod === 'cash'" type="info" effect="light" size="small">现金</el-tag>
        <el-tag v-else type="warning" effect="light" size="small">免费放行</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="支付时间">{{ data.paidAt || '-' }}</el-descriptions-item>
      <el-descriptions-item label="小票编号" :span="2" style="font-family: monospace">{{ data.id || 'RECEIPT-' + Date.now() }}</el-descriptions-item>
    </el-descriptions>

    <div class="receipt-footer">
      <div>感谢光临 · 欢迎再次光临</div>
      <div style="font-size: 11px; color:#909399; margin-top: 4px">Thanks for your coming</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConsumptionDetail, BillingSegment } from '@/types'

interface ReceiptData {
  id?: string
  plateNumber: string
  cardNo?: string
  ownerName?: string
  entryTime: string
  exitTime: string
  totalDuration: number
  originalSegments: BillingSegment[]
  grossAmount: number
  freeDeduction?: number
  freeDeductedMinutes?: number
  quotaDeduction?: number
  quotaDeductedMinutes?: number
  selfPayAmount: number
  paymentMethod?: string
  paidAt?: string
}

defineProps<{ data: ReceiptData | ConsumptionDetail }>()

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0分'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分钟`
  if (m === 0) return `${h}小时`
  return `${h}小时${m}分钟`
}
</script>

<style scoped>
.parking-receipt {
  background: linear-gradient(180deg, #fafafa 0%, #ffffff 100%);
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  padding: 20px;
  max-width: 520px;
  margin: 0 auto;
  position: relative;
  font-size: 13px;
}
.parking-receipt::before,
.parking-receipt::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  border-radius: 50%;
  left: -10px;
}
.parking-receipt::before { top: 50%; }
.parking-receipt::after { top: 50%; left: auto; right: -10px; }

.receipt-header {
  text-align: center;
  padding-bottom: 12px;
  border-bottom: 1px dashed #e4e7ed;
  margin-bottom: 12px;
}
.receipt-title {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
  letter-spacing: 2px;
}
.receipt-sub {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
  letter-spacing: 1px;
}
.plate-no {
  font-family: monospace;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 3px;
  color: #303133;
}
.receipt-desc {
  margin-top: 0;
}
.divider-label {
  font-weight: 600;
  font-size: 13px;
  color: #409eff;
}
.subtotal-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 4px;
  border-top: 1px dashed #e4e7ed;
  margin-top: 6px;
  font-weight: 600;
  color: #303133;
}
.settle-box {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 12px;
}
.settle-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
  color: #606266;
}
.settle-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  margin-top: 8px;
  border-top: 2px solid #dcdfe6;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.big { font-size: 22px !important; }
.receipt-footer {
  text-align: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed #e4e7ed;
  color: #606266;
  font-size: 13px;
}
.negative { color: #67c23a !important; }
.positive { color: #f56c6c !important; font-weight: 600; }
.segment-label.negative, .segment-value.negative { color: #67c23a !important; }
</style>
