<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><CreditCard /></el-icon>
        月卡管理
      </h2>
      <div class="action-bar" style="margin: 0">
        <el-button type="success" :icon="'Refresh'" @click="handleBatchReset">
          月度额度重置
        </el-button>
        <el-button type="primary" :icon="'Plus'" @click="openAddDialog">
          新增月卡
        </el-button>
      </div>
    </div>

    <el-card class="card-shadow">
      <div class="action-bar">
        <el-input
          v-model="searchKw"
          placeholder="搜索卡号/车牌/车主"
          clearable
          :prefix-icon="'Search'"
          style="width: 260px"
        />
        <el-select v-model="filterStatus" placeholder="状态筛选" style="width: 140px" clearable>
          <el-option label="生效中" value="active" />
          <el-option label="已过期" value="expired" />
          <el-option label="已停用" value="disabled" />
        </el-select>
      </div>

      <el-table :data="filteredCards" stripe>
        <el-table-column prop="cardNo" label="月卡编号" width="130" />
        <el-table-column prop="plateNumber" label="绑定车牌" width="120">
          <template #default="{ row }">
            <span style="font-family: monospace; font-weight: 600; letter-spacing: 1px">
              {{ row.plateNumber }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="ownerName" label="车主姓名" width="100" />
        <el-table-column prop="phone" label="联系电话" width="130" />
        <el-table-column label="有效期" width="220">
          <template #default="{ row }">
            <div style="font-size: 12px">
              <div>起：{{ row.startDate }}</div>
              <div>止：{{ row.endDate }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="额度使用情况" min-width="240">
          <template #default="{ row }">
            <div style="padding: 8px 0">
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px">
                <span>
                  已用 <strong style="color: #f56c6c">{{ formatDuration(row.usedQuotaThisMonth) }}</strong>
                </span>
                <span>
                  总额度 <strong>{{ formatDuration(row.monthlyQuotaMinutes) }}</strong>
                </span>
              </div>
              <div class="progress-bar-wrapper">
                <div
                  class="progress-bar-inner"
                  :style="{
                    width: `${getUsagePercent(row)}%`,
                    background: getUsagePercent(row) > 90
                      ? 'linear-gradient(90deg, #f56c6c, #e6a23c)'
                      : getUsagePercent(row) > 60
                      ? 'linear-gradient(90deg, #e6a23c, #f0c78a)'
                      : 'linear-gradient(90deg, #67c23a, #95d475)'
                  }"
                ></div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 4px; color: #909399">
                <span>剩余: {{ formatDuration(row.remainingQuota) }}</span>
                <span>上次重置: {{ row.lastResetDate || '-' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="月费" width="90">
          <template #default="{ row }">¥{{ row.monthlyFee }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : row.status === 'expired' ? 'info' : 'danger'" effect="dark" round>
              {{ row.status === 'active' ? '生效' : row.status === 'expired' ? '过期' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button type="warning" size="small" link @click="openHistoryDialog(row)">
              用量流水
            </el-button>
            <el-button type="success" size="small" link @click="openIssueDialog(row)">
              发放额度
            </el-button>
            <el-button type="primary" size="small" link @click="openEditDialog(row)">
              编辑
            </el-button>
            <el-popconfirm title="确认删除该月卡？" @confirm="removeCard(row)">
              <template #reference>
                <el-button type="danger" size="small" link>删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="filteredCards.length === 0" description="暂无月卡数据" />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑月卡' : '新增月卡'" width="520px" destroy-on-close>
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="月卡编号" prop="cardNo">
          <el-input v-model="form.cardNo" :disabled="isEdit" placeholder="如：MC20250001" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="车主姓名" prop="ownerName">
              <el-input v-model="form.ownerName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="form.phone" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="绑定车牌" prop="plateNumber">
              <el-input v-model="form.plateNumber" placeholder="京A12345" style="text-transform: uppercase" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="车辆类型">
              <el-select v-model="form.vehicleType" style="width: 100%">
                <el-option label="小型轿车" value="小型轿车" />
                <el-option label="SUV" value="SUV" />
                <el-option label="新能源" value="新能源" />
                <el-option label="货车" value="货车" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="月费金额" prop="monthlyFee">
          <el-input-number v-model="form.monthlyFee" :min="0" :step="10" style="width: 100%" />
        </el-form-item>
        <el-form-item label="月度免费额度(小时)" prop="monthlyQuotaMinutes">
          <el-input-number
            v-model="quotaHours"
            :min="0"
            :step="10"
            style="width: 100%"
            placeholder="每月免费停放时长"
          />
        </el-form-item>
        <el-form-item label="有效期" prop="dateRange">
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="卡片状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="生效" value="active" />
            <el-option label="停用" value="disabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="historyVisible" title="额度用量流水" width="860px" destroy-on-close>
      <div v-if="currentCard" style="padding: 4px 0 16px 0">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="月卡编号">{{ currentCard.cardNo }}</el-descriptions-item>
          <el-descriptions-item label="车主/车牌">
            {{ currentCard.ownerName }} /
            <span style="font-family: monospace; font-weight: 600">{{ currentCard.plateNumber }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="剩余额度">
            <span style="color:#67c23a; font-weight: 600">{{ formatDuration(currentCard.remainingQuota) }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-row :gutter="12" style="margin-top: 16px">
          <el-col :span="6">
            <div class="stat-card blue card-shadow" style="padding: 12px">
              <div class="stat-label">本月已用</div>
              <div class="stat-value">{{ formatDuration(currentCard.usedQuotaThisMonth) }}</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card green card-shadow" style="padding: 12px">
              <div class="stat-label">发放累计</div>
              <div class="stat-value">{{ formatDuration(historyStats.issued) }}</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card orange card-shadow" style="padding: 12px">
              <div class="stat-label">扣减累计</div>
              <div class="stat-value">{{ formatDuration(historyStats.used) }}</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-card purple card-shadow" style="padding: 12px">
              <div class="stat-label">抵扣金额</div>
              <div class="stat-value">¥{{ historyStats.amount.toFixed(2) }}</div>
            </div>
          </el-col>
        </el-row>

        <el-table :data="historyList" stripe max-height="360" style="margin-top: 16px">
          <el-table-column prop="createdAt" label="时间" width="160" />
          <el-table-column label="类型" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.type === 'use'" type="danger" effect="light" size="small">扣减</el-tag>
              <el-tag v-else-if="row.type === 'issue'" type="success" effect="light" size="small">发放</el-tag>
              <el-tag v-else type="info" effect="light" size="small">重置</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="变动时长" width="120">
            <template #default="{ row }">
              <span :class="row.type === 'use' ? 'positive' : 'negative'">
                {{ row.type === 'use' ? '-' : '+' }}{{ formatDuration(Math.abs(row.changeMinutes)) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="抵扣金额" width="110">
            <template #default="{ row }">
              <span v-if="row.deductedAmount && row.deductedAmount > 0" style="color:#f56c6c">
                -¥{{ row.deductedAmount.toFixed(2) }}
              </span>
              <span v-else style="color:#c0c4cc">-</span>
            </template>
          </el-table-column>
          <el-table-column label="余额变动" width="150">
            <template #default="{ row }">
              <span style="color:#909399">{{ formatDuration(row.balanceBefore) }}</span>
              <el-icon style="vertical-align: -2px; margin: 0 4px; color:#c0c4cc"><ArrowRight /></el-icon>
              <span style="color:#409eff; font-weight: 600">{{ formatDuration(row.balanceAfter) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="160">
            <template #default="{ row }">
              <span v-if="row.remark">{{ row.remark }}</span>
              <span v-else-if="row.type === 'use' && row.detailId" style="color:#c0c4cc">账单已关联</span>
              <span v-else style="color:#c0c4cc">-</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="historyList.length === 0" description="暂无额度流水" style="padding: 32px 0" />
      </div>
    </el-dialog>

    <el-dialog v-model="issueVisible" title="发放额外免费额度" width="420px" destroy-on-close>
      <div v-if="currentCard" style="padding: 8px 0">
        <div class="info-row">
          <span class="info-label">月卡编号</span>
          <span class="info-value">{{ currentCard.cardNo }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">车主/车牌</span>
          <span class="info-value">{{ currentCard.ownerName }} · {{ currentCard.plateNumber }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">当前剩余额度</span>
          <span class="info-value negative">{{ formatDuration(currentCard.remainingQuota) }}</span>
        </div>
        <el-form label-width="100px" style="margin-top: 16px">
          <el-form-item label="发放时长">
            <el-input-number
              v-model="issueMinutes"
              :min="0"
              :step="30"
              style="width: 100%"
              placeholder="单位：分钟"
            />
          </el-form-item>
          <div style="color: #909399; font-size: 12px; margin-top: -8px">
            发放后总剩余：{{ formatDuration(currentCard.remainingQuota + issueMinutes) }}
          </div>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="issueVisible = false">取消</el-button>
        <el-button type="success" @click="confirmIssue">确认发放</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import type { MonthlyCard, QuotaTransaction } from '@/types'
import { cardStorage, quotaTransactionStorage } from '@/store/storage'
import { issueMonthlyQuota, resetAllQuotasForNewMonth } from '@/services/quotaManager'

const cards = ref<MonthlyCard[]>([])
const searchKw = ref('')
const filterStatus = ref('')

const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref('')
const formRef = ref<FormInstance>()
const quotaHours = ref(60)

const issueVisible = ref(false)
const historyVisible = ref(false)
const currentCard = ref<MonthlyCard | null>(null)
const issueMinutes = ref(600)
const historyList = ref<QuotaTransaction[]>([])
const historyStats = reactive({ issued: 0, used: 0, amount: 0 })

const form = reactive({
  cardNo: '',
  ownerName: '',
  phone: '',
  plateNumber: '',
  vehicleType: '小型轿车',
  monthlyFee: 300,
  dateRange: [] as string[],
  status: 'active'
})

const rules: FormRules = {
  cardNo: [{ required: true, message: '请输入月卡编号', trigger: 'blur' }],
  ownerName: [{ required: true, message: '请输入车主姓名', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入联系电话', trigger: 'blur' }],
  plateNumber: [{ required: true, message: '请输入车牌号', trigger: 'blur' }],
  monthlyFee: [{ required: true, message: '请输入月费金额', trigger: 'blur' }],
  dateRange: [{ required: true, message: '请选择有效期', trigger: 'change' }]
}

const filteredCards = computed(() => {
  let list = cards.value
  if (filterStatus.value) list = list.filter(c => c.status === filterStatus.value)
  if (searchKw.value) {
    const kw = searchKw.value.toLowerCase()
    list = list.filter(c =>
      c.cardNo.toLowerCase().includes(kw) ||
      c.plateNumber.toLowerCase().includes(kw) ||
      c.ownerName.toLowerCase().includes(kw)
    )
  }
  return list
})

function refreshCards() {
  cards.value = cardStorage.getAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0分钟'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分钟`
  if (m === 0) return `${h}小时`
  return `${h}小时${m}分钟`
}

function getUsagePercent(card: MonthlyCard): number {
  if (card.monthlyQuotaMinutes <= 0) return 0
  return Math.min(100, Math.round((card.usedQuotaThisMonth / card.monthlyQuotaMinutes) * 100))
}

function openAddDialog() {
  isEdit.value = false
  editingId.value = ''
  const today = new Date()
  const next = new Date()
  next.setMonth(next.getMonth() + 1)
  Object.assign(form, {
    cardNo: 'MC' + new Date().getFullYear() + String(cards.value.length + 1).padStart(5, '0'),
    ownerName: '',
    phone: '',
    plateNumber: '',
    vehicleType: '小型轿车',
    monthlyFee: 300,
    dateRange: [
      today.toISOString().split('T')[0],
      next.toISOString().split('T')[0]
    ],
    status: 'active'
  })
  quotaHours.value = 60
  dialogVisible.value = true
}

function openEditDialog(row: MonthlyCard) {
  isEdit.value = true
  editingId.value = row.id
  Object.assign(form, {
    cardNo: row.cardNo,
    ownerName: row.ownerName,
    phone: row.phone,
    plateNumber: row.plateNumber,
    vehicleType: row.vehicleType,
    monthlyFee: row.monthlyFee,
    dateRange: [row.startDate, row.endDate],
    status: row.status
  })
  quotaHours.value = Math.round(row.monthlyQuotaMinutes / 60)
  dialogVisible.value = true
}

async function submitForm() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    const quotaMin = quotaHours.value * 60
    const data = {
      cardNo: form.cardNo.toUpperCase(),
      ownerName: form.ownerName,
      phone: form.phone,
      plateNumber: form.plateNumber.toUpperCase(),
      vehicleType: form.vehicleType,
      monthlyQuotaMinutes: quotaMin,
      remainingQuota: isEdit.value ? cardStorage.getAll().find(c => c.id === editingId.value)?.remainingQuota ?? quotaMin : quotaMin,
      usedQuotaThisMonth: isEdit.value ? cardStorage.getAll().find(c => c.id === editingId.value)?.usedQuotaThisMonth ?? 0 : 0,
      startDate: form.dateRange[0],
      endDate: form.dateRange[1],
      status: form.status as any,
      monthlyFee: Number(form.monthlyFee),
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    }
    if (isEdit.value) {
      cardStorage.update(editingId.value, data)
      ElMessage.success('月卡更新成功')
    } else {
      cardStorage.add(data)
      ElMessage.success('月卡创建成功')
    }
    dialogVisible.value = false
    refreshCards()
  })
}

function removeCard(row: MonthlyCard) {
  cardStorage.remove(row.id)
  refreshCards()
  ElMessage.success('删除成功')
}

function openIssueDialog(row: MonthlyCard) {
  currentCard.value = { ...row }
  issueMinutes.value = 600
  issueVisible.value = true
}

function openHistoryDialog(row: MonthlyCard) {
  currentCard.value = { ...row }
  historyList.value = quotaTransactionStorage.getByCardId(row.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  historyStats.issued = historyList.value.filter(t => t.type === 'issue').reduce((s, t) => s + Math.abs(t.changeMinutes), 0)
  historyStats.used = historyList.value.filter(t => t.type === 'use').reduce((s, t) => s + Math.abs(t.changeMinutes), 0)
  historyStats.amount = historyList.value.reduce((s, t) => s + (t.deductedAmount || 0), 0)
  historyVisible.value = true
}

function confirmIssue() {
  if (!currentCard.value) return
  const result = issueMonthlyQuota(currentCard.value, issueMinutes.value)
  if (result.success) {
    ElMessage.success(result.message)
    issueVisible.value = false
    refreshCards()
  } else {
    ElMessage.warning(result.message)
  }
}

function handleBatchReset() {
  const result = resetAllQuotasForNewMonth()
  ElMessage.success(`已重置 ${result.reset} 张月卡额度，跳过 ${result.skipped} 张`)
  refreshCards()
}

onMounted(() => {
  refreshCards()
  if (cards.value.length === 0) {
    const today = new Date()
    const next = new Date()
    next.setMonth(next.getMonth() + 3)
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    cardStorage.add({
      cardNo: 'MC20250001', ownerName: '张三', phone: '13800138001',
      plateNumber: '京A12345', vehicleType: '小型轿车', monthlyQuotaMinutes: 60 * 60,
      remainingQuota: 60 * 60, usedQuotaThisMonth: 0, startDate: fmt(today),
      endDate: fmt(next), status: 'active', monthlyFee: 300,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    })
    cardStorage.add({
      cardNo: 'MC20250002', ownerName: '李四', phone: '13800138002',
      plateNumber: '京B67890', vehicleType: 'SUV', monthlyQuotaMinutes: 100 * 60,
      remainingQuota: 100 * 60, usedQuotaThisMonth: 0, startDate: fmt(today),
      endDate: fmt(next), status: 'active', monthlyFee: 500,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    })
    cardStorage.add({
      cardNo: 'MC20250003', ownerName: '王五', phone: '13800138003',
      plateNumber: '京N88888', vehicleType: '新能源', monthlyQuotaMinutes: 120 * 60,
      remainingQuota: 120 * 60, usedQuotaThisMonth: 0, startDate: fmt(today),
      endDate: fmt(next), status: 'active', monthlyFee: 600,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    })
    refreshCards()
    ElMessage.info('已初始化示例月卡数据')
  }
})
</script>
