<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Tickets /></el-icon>
        消费明细查询
      </h2>
      <div class="action-bar" style="margin: 0">
        <el-button type="warning" :icon="'Download'" :disabled="allDetails.length === 0" @click="quickExportAll">
          导出全量明细
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="明细列表" name="list">
        <el-card class="card-shadow">
          <div class="action-bar">
            <el-date-picker v-model="dateRange" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm" style="width: 400px" />
            <el-input v-model="searchPlate" placeholder="输入车牌号查询" clearable :prefix-icon="'Search'" style="width: 180px" />
            <el-input v-model="searchCardNo" placeholder="输入月卡编号" clearable :prefix-icon="'CreditCard'" style="width: 180px" />
            <el-select v-model="filterType" placeholder="车辆类型" style="width: 140px" clearable>
              <el-option label="月卡车" value="monthly" />
              <el-option label="临时车" value="temporary" />
            </el-select>
            <el-button type="primary" :icon="'Search'" @click="noop">查询</el-button>
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

          <el-table ref="detailTableRef" :data="filteredDetails" stripe max-height="520" @selection-change="handleSelectionChange">
            <el-table-column type="selection" width="40" />
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
          <div style="margin-top: 12px; display: flex; gap: 8px" v-if="selectedDetails.length > 0">
            <el-tag type="info">已选 {{ selectedDetails.length }} 条</el-tag>
            <el-button type="primary" size="small" @click="batchPrintReceipt">补打小票</el-button>
            <el-button type="success" size="small" @click="exportReconciliation(selectedDetails)">导出对账单</el-button>
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="对账视图" name="reconcile">
        <el-card class="card-shadow">
          <div class="action-bar" style="margin-bottom: 16px">
            <el-date-picker v-model="reconcileDateRange" type="datetimerange" range-separator="至" start-placeholder="开始时间" end-placeholder="结束时间" value-format="YYYY-MM-DD HH:mm:ss" format="YYYY-MM-DD HH:mm" style="width: 400px" />
            <el-input v-model="reconcilePlate" placeholder="车牌号" clearable :prefix-icon="'Search'" style="width: 160px" />
            <el-input v-model="reconcileCardNo" placeholder="月卡编号" clearable :prefix-icon="'CreditCard'" style="width: 160px" />
            <el-button type="primary" :icon="'Search'" @click="loadReconcileData">查询</el-button>
            <el-button :icon="'Refresh'" @click="resetReconcile">重置</el-button>
            <el-button type="success" @click="exportReconciliationFromReconcileView" :disabled="reconcileRows.length === 0">导出对账单</el-button>
          </div>

          <el-table :data="reconcileRows" stripe max-height="560" :row-class-name="reconcileRowClass">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div style="padding: 8px 16px; background:#fafbfc; border-left: 3px solid #409eff; margin-left: 40px; border-radius: 4px">
                  <div style="display:flex; justify-content: space-between; margin-bottom: 8px">
                    <strong style="color:#409eff">原始计费分段（未抵扣）</strong>
                    <el-button size="small" type="primary" link @click="openReceipt(row.detail)">查看完整小票</el-button>
                  </div>
                  <el-table :data="row.originalSegments || []" size="small" :show-header="true" style="margin-bottom: 12px">
                    <el-table-column prop="rateName" label="费率档位" width="120" />
                    <el-table-column label="时间段" width="160">
                      <template #default="{ r }">
                        {{ r.row.startTime.slice(5, 16) }} 至 {{ r.row.endTime.slice(5, 16) }}
                      </template>
                    </el-table-column>
                    <el-table-column prop="durationMinutes" label="时长(分)" width="80" />
                    <el-table-column prop="ratePerHour" label="费率(元/时)" width="100" />
                    <el-table-column label="原始金额" width="100">
                      <template #default="{ r }">
                        <span style="color:#f56c6c; font-weight:600">¥{{ r.row.amount.toFixed(2) }}</span>
                      </template>
                    </el-table-column>
                  </el-table>

                  <el-descriptions :column="4" border size="small">
                    <el-descriptions-item label="应收(原始合计)">
                      ¥{{ (row.grossAmount ?? 0).toFixed(2) }}
                      <span v-if="row.grossMismatch" style="color:#f56c6c; margin-left:4px">⚠不一致</span>
                    </el-descriptions-item>
                    <el-descriptions-item label="免费抵扣">
                      -¥{{ (row.freeDeduction ?? 0).toFixed(2) }}
                      <div style="font-size:11px; color:#909399">({{ row.freeDeductedMinutes || 0 }}分)</div>
                    </el-descriptions-item>
                    <el-descriptions-item label="月卡额度抵扣">
                      -¥{{ (row.quotaDeduction ?? 0).toFixed(2) }}
                      <div style="font-size:11px; color:#909399">({{ row.quotaDeductedMinutes || 0 }}分)</div>
                      <div v-if="row.quotaMinutesMismatch || row.quotaAmountMismatch" style="font-size:11px; color:#f56c6c">⚠流水对不上</div>
                    </el-descriptions-item>
                    <el-descriptions-item label="实付">
                      <strong style="color:#f56c6c; font-size:16px">¥{{ (row.selfPayAmount ?? 0).toFixed(2) }}</strong>
                      <span v-if="row.payMismatch" style="color:#f56c6c; margin-left:4px">⚠不一致</span>
                    </el-descriptions-item>
                  </el-descriptions>

                  <el-descriptions :column="3" border size="small" style="margin-top: 8px">
                    <el-descriptions-item label="停车记录关联">
                      <el-tag v-if="row.record" type="success" size="small" effect="light">已匹配</el-tag>
                      <el-tag v-else type="danger" size="small" effect="light">未匹配</el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="额度流水关联">
                      <el-tag v-if="row.quotaTx" type="warning" size="small" effect="light">已匹配</el-tag>
                      <el-tag v-else-if="row.quotaDeductedMinutes > 0" type="danger" size="small" effect="light">缺失</el-tag>
                      <el-tag v-else size="small" effect="plain">无关</el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="综合状态">
                      <el-tag v-if="row.allMatch" type="success" effect="light">全部一致</el-tag>
                      <el-tag v-else type="danger" effect="light">存在异常</el-tag>
                    </el-descriptions-item>
                  </el-descriptions>
                </div>
              </template>
            </el-table-column>
            <el-table-column type="index" label="#" width="50" />
            <el-table-column label="一致性" width="90">
              <template #default="{ row }">
                <el-tag v-if="row.allMatch" type="success" effect="light" size="small">✓一致</el-tag>
                <el-tag v-else type="danger" effect="light" size="small">✗异常</el-tag>
              </template>
            </el-table-column>
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
              <template #default="{ row }">
                <span :style="{ color: row.durationMismatch ? '#f56c6c' : '#303133', fontWeight: row.durationMismatch ? '600' : 'normal' }">
                  {{ row.totalDuration ?? '-' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="应收" width="80">
              <template #default="{ row }">
                <span :style="{ color: row.grossMismatch ? '#f56c6c' : '#909399', fontWeight: row.grossMismatch ? '600' : 'normal' }">
                  ¥{{ (row.grossAmount ?? 0).toFixed(2) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="免费抵扣" width="90">
              <template #default="{ row }">
                <span class="negative">-¥{{ (row.freeDeduction ?? 0).toFixed(2) }}</span>
                <div v-if="row.freeDeductedMinutes" style="font-size:11px; color:#909399">{{ row.freeDeductedMinutes }}分</div>
              </template>
            </el-table-column>
            <el-table-column label="额度抵扣" width="100">
              <template #default="{ row }">
                <span class="negative" :style="{ fontWeight: (row.quotaMinutesMismatch || row.quotaAmountMismatch) ? '700' : 'normal' }">
                  -¥{{ (row.quotaDeduction ?? 0).toFixed(2) }}
                </span>
                <div style="font-size:11px; color:#909399">
                  {{ row.quotaDeductedMinutes || 0 }}分
                  <span v-if="row.quotaMinutesMismatch || row.quotaAmountMismatch" style="color:#f56c6c">⚠</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="实付" width="90">
              <template #default="{ row }">
                <span :style="{ color: '#f56c6c', fontWeight: row.payMismatch ? '700' : '600', fontSize: row.payMismatch ? '15px' : '14px' }">
                  ¥{{ (row.selfPayAmount ?? 0).toFixed(2) }}
                </span>
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
            <el-table-column label="异常项" min-width="130">
              <template #default="{ row }">
                <template v-if="!row.allMatch">
                  <el-tag v-if="row.grossMismatch" type="danger" size="small" effect="plain" style="margin:2px">应收</el-tag>
                  <el-tag v-if="row.durationMismatch" type="danger" size="small" effect="plain" style="margin:2px">时长</el-tag>
                  <el-tag v-if="row.payMismatch" type="danger" size="small" effect="plain" style="margin:2px">实付</el-tag>
                  <el-tag v-if="row.quotaMinutesMismatch" type="warning" size="small" effect="plain" style="margin:2px">额分</el-tag>
                  <el-tag v-if="row.quotaAmountMismatch" type="warning" size="small" effect="plain" style="margin:2px">额金</el-tag>
                  <el-tag v-if="row.missingQuotaTx" type="danger" size="small" effect="plain" style="margin:2px">缺流水</el-tag>
                </template>
                <span v-else style="color:#67c23a; font-size:12px">✓ 正常</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" link @click="openReceipt(row.detail)">小票</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="reconcileRows.length === 0" description="暂无对账数据，请点击查询" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="receiptVisible" title="收费小票" width="620px" destroy-on-close>
      <ParkingReceipt v-if="currentDetail" :data="currentDetail" />
    </el-dialog>

    <el-dialog v-model="batchReceiptVisible" title="对账单汇总（含原始分段）" width="960px" destroy-on-close>
      <div v-if="exportData.rows.length > 0" style="padding: 0 0 16px 0">
        <el-descriptions :column="4" border size="small">
          <el-descriptions-item label="记录数">{{ exportData.rows.length }} 笔</el-descriptions-item>
          <el-descriptions-item label="应收合计">¥{{ exportData.grossTotal.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="免费抵扣合计">-¥{{ exportData.freeTotal.toFixed(2) }}</el-descriptions-item>
          <el-descriptions-item label="实收合计" :span="2">
            <strong style="color:#f56c6c; font-size:18px">¥{{ exportData.payTotal.toFixed(2) }}</strong>
          </el-descriptions-item>
          <el-descriptions-item label="月卡额度抵扣合计" :span="2">-¥{{ exportData.quotaTotal.toFixed(2) }}</el-descriptions-item>
        </el-descriptions>

        <el-table :data="exportData.rows" stripe max-height="480" style="margin-top: 12px" row-key="$index">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div style="padding: 8px 16px; background:#f5f7fa; border-left: 3px solid #67c23a; margin-left: 40px; border-radius: 4px">
                <div style="font-weight: 600; color:#67c23a; margin-bottom: 6px">原始分段明细</div>
                <el-table :data="row.originalSegments || []" size="small" style="margin-bottom: 8px">
                  <el-table-column prop="rateName" label="费率档位" width="110" />
                  <el-table-column label="时间段" width="150">
                    <template #default="{ r }">
                      {{ r.row.startTime.slice(5, 16) }} ~ {{ r.row.endTime.slice(5, 16) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="durationMinutes" label="时长(分)" width="70" />
                  <el-table-column prop="ratePerHour" label="费率(元/时)" width="90" />
                  <el-table-column label="原始金额" width="90">
                    <template #default="{ r }">¥{{ r.row.amount.toFixed(2) }}</template>
                  </el-table-column>
                </el-table>
                <div style="display:flex; gap:24px; font-size:13px">
                  <span>应收合计: <strong>¥{{ row.grossAmount.toFixed(2) }}</strong></span>
                  <span class="negative">免费抵扣: -¥{{ row.freeDeduction.toFixed(2) }} ({{ row.freeDeductedMinutes }}分)</span>
                  <span class="negative">额度抵扣: -¥{{ row.quotaDeduction.toFixed(2) }} ({{ row.quotaDeductedMinutes }}分)</span>
                  <span class="positive">实付: ¥{{ row.selfPayAmount.toFixed(2) }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="序号" type="index" width="60" />
          <el-table-column prop="plateNumber" label="车牌" width="100" />
          <el-table-column prop="cardNo" label="月卡号" width="120">
            <template #default="{ row }">
              <el-tag v-if="row.cardNo" type="warning" size="small" effect="light">{{ row.cardNo }}</el-tag>
              <span v-else style="color:#c0c4cc">临时</span>
            </template>
          </el-table-column>
          <el-table-column label="入→出" width="180">
            <template #default="{ row }">
              <div style="font-size:12px">
                <div>入: {{ row.entryTime?.slice(5) || '-' }}</div>
                <div>出: {{ row.exitTime?.slice(5) || '-' }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="时长(分)" width="70">
            <template #default="{ row }">{{ row.totalDuration }}</template>
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
            <template #default="{ row }">
              <span style="color:#f56c6c; font-weight:600">¥{{ row.selfPayAmount.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="一致性" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.allMatch" type="success" effect="light" size="small">一致</el-tag>
              <el-tag v-else type="danger" effect="light" size="small">异常</el-tag>
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
import { ElMessage } from 'element-plus'
import { detailStorage, recordStorage, quotaTransactionStorage } from '@/store/storage'
import type { ConsumptionDetail, ParkingRecord, QuotaTransaction, BillingSegment } from '@/types'
import dayjs from 'dayjs'
import ParkingReceipt from '@/components/ParkingReceipt.vue'

const activeTab = ref('list')
const allDetails = ref<ConsumptionDetail[]>([])
const searchPlate = ref('')
const searchCardNo = ref('')
const filterType = ref('')
const dateRange = ref<string[]>([
  dayjs().startOf('month').format('YYYY-MM-DD 00:00:00'),
  dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss')
])

const receiptVisible = ref(false)
const batchReceiptVisible = ref(false)
const currentDetail = ref<ConsumptionDetail | null>(null)
const selectedDetails = ref<ConsumptionDetail[]>([])
const detailTableRef = ref()

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
  payTotal: 0
})

const filteredDetails = computed(() => {
  let list = allDetails.value
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

const totalSelfPay = computed(() => filteredDetails.value.reduce((s, d) => s + d.selfPayAmount, 0))
const totalFreeDeduct = computed(() => filteredDetails.value.reduce((s, d) => s + d.freeDeduction, 0))
const totalQuotaDeduct = computed(() => filteredDetails.value.reduce((s, d) => s + d.quotaDeduction, 0))
const totalFreeMinutes = computed(() => filteredDetails.value.reduce((s, d) => s + (d.freeDeductedMinutes || 0), 0))
const totalQuotaMinutes = computed(() => filteredDetails.value.reduce((s, d) => s + (d.quotaDeductedMinutes || 0), 0))

function noop() {}

function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0分钟'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分钟`
  if (m === 0) return `${h}小时`
  return `${h}小时${m}分钟`
}

function handleSelectionChange(rows: ConsumptionDetail[]) {
  selectedDetails.value = rows
}

function buildReconcileRow(
  detail: ConsumptionDetail,
  record: ParkingRecord | undefined,
  quotaTx: QuotaTransaction | undefined
) {
  const recordGross = record?.totalAmount
  const recordDuration = record?.durationMinutes
  const detailGross = detail.grossAmount
  const detailDuration = detail.totalDuration
  const expectedPay = Number((detailGross - detail.freeDeduction - detail.quotaDeduction).toFixed(2))

  const grossMismatch = recordGross !== undefined && Math.abs(recordGross - detailGross) > 0.01
  const durationMismatch = recordDuration !== undefined && recordDuration !== detailDuration
  const payMismatch = Math.abs(detail.selfPayAmount - expectedPay) > 0.01

  let quotaMinutesMismatch = false
  let quotaAmountMismatch = false
  let missingQuotaTx = false
  if ((detail.quotaDeductedMinutes ?? 0) > 0 || (detail.quotaDeduction ?? 0) > 0.001) {
    if (!quotaTx) {
      missingQuotaTx = true
    } else {
      quotaMinutesMismatch = Math.abs(Math.abs(quotaTx.changeMinutes) - (detail.quotaDeductedMinutes || 0)) > 0
      quotaAmountMismatch = Math.abs((quotaTx.deductedAmount || 0) - (detail.quotaDeduction || 0)) > 0.01
    }
  }

  const allMatch = !grossMismatch && !durationMismatch && !payMismatch && !quotaMinutesMismatch && !quotaAmountMismatch && !missingQuotaTx

  return {
    plateNumber: detail.plateNumber,
    cardNo: detail.cardNo,
    entryTime: detail.entryTime,
    exitTime: detail.exitTime,
    totalDuration: detailDuration,
    grossAmount: detailGross,
    freeDeduction: detail.freeDeduction,
    freeDeductedMinutes: detail.freeDeductedMinutes,
    quotaDeduction: detail.quotaDeduction,
    quotaDeductedMinutes: detail.quotaDeductedMinutes,
    selfPayAmount: detail.selfPayAmount,
    originalSegments: (detail.originalSegments || detail.billedSegments || []) as BillingSegment[],
    quotaTx: quotaTx
      ? {
          id: quotaTx.id,
          changeMinutes: Math.abs(quotaTx.changeMinutes),
          balanceAfter: quotaTx.balanceAfter,
          deductedAmount: quotaTx.deductedAmount || 0
        }
      : null,
    record: !!record,
    grossMismatch,
    durationMismatch,
    payMismatch,
    quotaMinutesMismatch,
    quotaAmountMismatch,
    missingQuotaTx,
    allMatch,
    detail
  }
}

function reconcileRowClass({ row }: { row: any }): string {
  if (!row.allMatch) return 'reconcile-mismatch-row'
  return ''
}

function loadReconcileData() {
  let detailList = allDetails.value
  if (reconcileDateRange.value && reconcileDateRange.value.length === 2) {
    detailList = detailList.filter(
      d => d.createdAt >= reconcileDateRange.value![0] && d.createdAt <= reconcileDateRange.value![1]
    )
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

  const abnormal = rows.filter(r => !r.allMatch).length
  if (rows.length > 0) {
    ElMessage[abnormal > 0 ? 'warning' : 'success'](
      `查询完成：共 ${rows.length} 条，异常 ${abnormal} 条`
    )
  } else {
    ElMessage.info('查询条件下无记录')
  }
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

function openReceipt(row: ConsumptionDetail) {
  currentDetail.value = row
  receiptVisible.value = true
}

function batchPrintReceipt() {
  if (selectedDetails.value.length === 0) return
  currentDetail.value = selectedDetails.value[0]
  receiptVisible.value = true
}

function exportReconciliation(sourceRows: ConsumptionDetail[]) {
  if (!sourceRows || sourceRows.length === 0) return

  const rows: any[] = []
  let grossTotal = 0, freeTotal = 0, quotaTotal = 0, payTotal = 0

  for (const detail of sourceRows) {
    const record = recordStorage.getAll().find(r => r.id === detail.recordId)
    const quotaTx = detail.id ? quotaTransactionStorage.getByDetailId(detail.id) : undefined
    const row = buildReconcileRow(detail, record, quotaTx)
    rows.push(row)
    grossTotal += detail.grossAmount
    freeTotal += detail.freeDeduction
    quotaTotal += detail.quotaDeduction
    payTotal += detail.selfPayAmount
  }

  exportData.rows = rows
  exportData.grossTotal = grossTotal
  exportData.freeTotal = freeTotal
  exportData.quotaTotal = quotaTotal
  exportData.payTotal = payTotal
  batchReceiptVisible.value = true
}

function exportReconciliationFromReconcileView() {
  const sourceRows = reconcileRows.value.map(r => r.detail).filter(Boolean) as ConsumptionDetail[]
  if (sourceRows.length === 0) {
    ElMessage.warning('当前对账视图无记录')
    return
  }
  exportReconciliation(sourceRows)
}

function quickExportAll() {
  if (filteredDetails.value.length === 0) {
    ElMessage.warning('当前筛选条件下无记录')
    return
  }
  exportReconciliation(filteredDetails.value)
}

function loadData() {
  allDetails.value = detailStorage.getAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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

onMounted(loadData)
</script>

<style scoped>
:deep(.reconcile-mismatch-row) {
  background-color: #fef0f0 !important;
}
:deep(.reconcile-mismatch-row:hover > td) {
  background-color: #fde2e2 !important;
}
</style>
