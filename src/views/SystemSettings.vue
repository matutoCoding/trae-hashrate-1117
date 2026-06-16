<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Setting /></el-icon>
        系统设置
      </h2>
    </div>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="card-shadow">
          <template #header>
            <span style="font-weight: 600; font-size: 16px">
              <el-icon><Tools /></el-icon>
              计费规则设置
            </span>
          </template>
          <el-form :model="form" label-width="140px" style="max-width: 600px">
            <el-form-item label="停车场名称">
              <el-input v-model="form.parkingLotName" />
            </el-form-item>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="车位数(总)">
                  <el-input-number v-model="form.totalSpaces" :min="1" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="可用车位数">
                  <el-input-number v-model="form.availableSpaces" :min="0" :max="form.totalSpaces" style="width: 100%" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-divider content-position="left">计费参数</el-divider>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="默认免费时长(分钟)">
                  <el-input-number v-model="form.defaultFreeMinutes" :min="0" :step="5" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="最小计费单位(分钟)">
                  <el-select v-model="form.minChargeUnitMinutes" style="width: 100%">
                    <el-option label="5分钟" :value="5" />
                    <el-option label="10分钟" :value="10" />
                    <el-option label="15分钟" :value="15" />
                    <el-option label="30分钟" :value="30" />
                    <el-option label="60分钟" :value="60" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="进位取整规则">
              <el-radio-group v-model="form.roundUpRule">
                <el-radio value="up">向上取整(不足按单位计)</el-radio>
                <el-radio value="down">向下取整(舍去零头)</el-radio>
                <el-radio value="nearest">四舍五入</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="每日封顶金额(元)">
              <el-input-number v-model="form.maxDailyFee" :min="0" :step="5" style="width: 50%" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :icon="'Check'" @click="saveConfig">保存设置</el-button>
              <el-button :icon="'Refresh'" @click="loadConfig">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="card-shadow">
          <template #header>
            <span style="font-weight: 600; font-size: 16px">
              <el-icon><Warning /></el-icon>
              数据管理
            </span>
          </template>
          <div style="display: flex; flex-direction: column; gap: 16px">
            <div>
              <div style="font-weight: 500; margin-bottom: 6px">系统数据统计</div>
              <el-descriptions :column="1" size="small" border>
                <el-descriptions-item label="时段费率">{{ dataStats.rates }} 条</el-descriptions-item>
                <el-descriptions-item label="月卡总数">{{ dataStats.cards }} 张</el-descriptions-item>
                <el-descriptions-item label="停车记录">{{ dataStats.records }} 条</el-descriptions-item>
                <el-descriptions-item label="消费明细">{{ dataStats.details }} 条</el-descriptions-item>
              </el-descriptions>
            </div>
            <el-divider style="margin: 0" />
            <div>
              <div style="font-weight: 500; margin-bottom: 8px; color: #f56c6c">危险操作</div>
              <el-popconfirm title="确认清空所有停车记录和消费明细？此操作不可撤销！" @confirm="clearRecords">
                <template #reference>
                  <el-button type="danger" :icon="'Delete'" style="width: 100%">
                    清空运营数据
                  </el-button>
                </template>
              </el-popconfirm>
              <el-popconfirm title="确认重置所有数据到初始状态？" @confirm="resetAllData">
                <template #reference>
                  <el-button type="danger" plain :icon="'RefreshRight'" style="width: 100%; margin-top: 8px">
                    恢复出厂设置
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
        </el-card>

        <el-card class="card-shadow" style="margin-top: 20px">
          <template #header>
            <span style="font-weight: 600; font-size: 16px">
              <el-icon><InfoFilled /></el-icon>
              关于系统
            </span>
          </template>
          <div style="padding: 8px 0">
            <div class="info-row">
              <span class="info-label">系统名称</span>
              <span class="info-value">智慧停车场运营管理系统</span>
            </div>
            <div class="info-row">
              <span class="info-label">版本号</span>
              <span class="info-value">v1.0.0</span>
            </div>
            <div class="info-row">
              <span class="info-label">技术栈</span>
              <span class="info-value">Electron + Vue3 + TS</span>
            </div>
            <div class="info-row">
              <span class="info-label">UI框架</span>
              <span class="info-value">Element Plus</span>
            </div>
            <el-divider style="margin: 10px 0" />
            <div style="font-size: 12px; color: #909399; line-height: 1.6">
              功能说明：支持分时段差异化计费、跨档时长自动拆分、月卡额度按月重置、
              超额自动转自费、多维度消费统计与账单管理。
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSystemConfig, updateSystemConfig } from '@/services/parkingService'
import {
  rateStorage, cardStorage, recordStorage, detailStorage, configStorage
} from '@/store/storage'
import type { SystemConfig } from '@/types'

const form = reactive<SystemConfig>({
  defaultFreeMinutes: 15,
  minChargeUnitMinutes: 15,
  roundUpRule: 'up',
  maxDailyFee: 60,
  parkingLotName: '智慧停车场',
  totalSpaces: 500,
  availableSpaces: 500
})

const dataStats = ref({ rates: 0, cards: 0, records: 0, details: 0 })

function loadConfig() {
  Object.assign(form, getSystemConfig())
  dataStats.value = {
    rates: rateStorage.getAll().length,
    cards: cardStorage.getAll().length,
    records: recordStorage.getAll().length,
    details: detailStorage.getAll().length
  }
}

function saveConfig() {
  updateSystemConfig({ ...form })
  ElMessage.success('系统设置保存成功')
  loadConfig()
}

function clearRecords() {
  const activeCount = recordStorage.getAllActive().length
  if (activeCount > 0) {
    ElMessageBox.alert(
      `当前有 ${activeCount} 辆车在场内，无法清空记录。`,
      '操作被阻止',
      { type: 'warning' }
    )
    return
  }
  recordStorage.saveAll([])
  detailStorage.saveAll([])
  const cfg = getSystemConfig()
  updateSystemConfig({ availableSpaces: cfg.totalSpaces })
  ElMessage.success('运营数据已清空')
  loadConfig()
}

function resetAllData() {
  rateStorage.saveAll([])
  cardStorage.saveAll([])
  recordStorage.saveAll([])
  detailStorage.saveAll([])
  configStorage.save({
    defaultFreeMinutes: 15,
    minChargeUnitMinutes: 15,
    roundUpRule: 'up',
    maxDailyFee: 60,
    parkingLotName: '智慧停车场',
    totalSpaces: 500,
    availableSpaces: 500
  })
  ElMessage.success('已恢复出厂设置，请刷新页面加载初始数据')
  loadConfig()
}

onMounted(loadConfig)
</script>
