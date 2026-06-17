import dayjs from 'dayjs'
import type {
  ParkingRecord,
  ConsumptionDetail,
  BillingSegment,
  DashboardStats,
  SystemConfig,
  MonthlyCard
} from '@/types'
import {
  rateStorage,
  recordStorage,
  cardStorage,
  detailStorage,
  configStorage
} from '@/store/storage'
import { calculateBilling, applyFreeDeduction } from './billingEngine'
import {
  checkMonthlyCardValid,
  applyQuotaToBilling,
  resetAllQuotasForNewMonth,
  resetMonthlyQuotaIfNeeded
} from './quotaManager'

export interface ExitBillingResult {
  record: ParkingRecord
  totalDuration: number
  segments: BillingSegment[]
  grossAmount: number
  freeDeductedMinutes: number
  freeDeductedAmount: number
  quotaDeductedMinutes: number
  quotaDeductedAmount: number
  selfPayAmount: number
  remainingQuota?: number
  isMonthlyCard: boolean
  canFreePass: boolean
}

export interface EntryResult {
  success: boolean
  record?: ParkingRecord
  message: string
  isMonthlyCard: boolean
  monthlyCardInfo?: {
    cardNo: string
    ownerName: string
    remainingQuota: number
    monthlyQuota: number
  }
}

interface BillingPipeline {
  billing: ReturnType<typeof calculateBilling>
  segmentsAfterFree: BillingSegment[]
  freeDeductedMinutes: number
  freeDeductedAmount: number
  finalSegments: BillingSegment[]
  quotaDeductedMinutes: number
  quotaDeductedAmount: number
  remainingQuota?: number
  activeCard?: MonthlyCard
  selfPayAmount: number
}

function runBillingPipeline(
  record: ParkingRecord,
  exitTime: string,
  dryRun: boolean
): BillingPipeline {
  const rates = rateStorage.getAll()
  const billing = calculateBilling(record.entryTime, exitTime, rates)

  const {
    segments: segmentsAfterFree,
    deductedMinutes: freeDeductedMinutes,
    deductedAmount: freeDeductedAmount
  } = applyFreeDeduction(billing, billing.freeMinutesEligible)

  let finalSegments = segmentsAfterFree
  let quotaDeductedMinutes = 0
  let quotaDeductedAmount = 0
  let remainingQuota: number | undefined
  let activeCard: MonthlyCard | undefined

  if (record.vehicleType === 'monthly' && record.monthlyCardId) {
    const card = cardStorage.getAll().find(c => c.id === record.monthlyCardId)
    if (card) {
      activeCard = resetMonthlyQuotaIfNeeded(card, exitTime)
      const quotaResult = applyQuotaToBilling(activeCard, finalSegments, exitTime, dryRun)
      finalSegments = quotaResult.finalSegments
      quotaDeductedMinutes = quotaResult.quotaAppliedMinutes
      quotaDeductedAmount = quotaResult.quotaDeductedAmount
      remainingQuota = quotaResult.availableQuota
    }
  }

  const selfPayAmount = Number(
    finalSegments.reduce((sum, s) => sum + s.amount, 0).toFixed(2)
  )

  return {
    billing,
    segmentsAfterFree,
    freeDeductedMinutes,
    freeDeductedAmount,
    finalSegments,
    quotaDeductedMinutes,
    quotaDeductedAmount,
    remainingQuota,
    activeCard,
    selfPayAmount
  }
}

function finalizeExit(
  record: ParkingRecord,
  exitTime: string,
  pipeline: BillingPipeline,
  status: 'completed' | 'free',
  paymentMethod?: 'cash' | 'wechat' | 'alipay' | 'card'
): ConsumptionDetail {
  const detailData: Omit<ConsumptionDetail, 'id'> = {
    recordId: record.id,
    plateNumber: record.plateNumber,
    cardNo: pipeline.activeCard?.cardNo,
    ownerName: pipeline.activeCard?.ownerName,
    entryTime: record.entryTime,
    exitTime,
    totalDuration: pipeline.billing.totalDuration,
    billedSegments: pipeline.finalSegments,
    grossAmount: pipeline.billing.grossAmount,
    freeDeduction: pipeline.freeDeductedAmount,
    quotaDeduction: pipeline.quotaDeductedAmount,
    selfPayAmount: pipeline.selfPayAmount,
    paymentMethod,
    paidAt: exitTime,
    createdAt: exitTime
  }
  const detail = detailStorage.add(detailData)

  recordStorage.update(record.id, {
    exitTime,
    durationMinutes: pipeline.billing.totalDuration,
    billedSegments: pipeline.finalSegments,
    totalAmount: pipeline.billing.grossAmount,
    freeMinutesUsed: pipeline.freeDeductedMinutes,
    quotaUsed: pipeline.quotaDeductedMinutes,
    selfPaidAmount: pipeline.selfPayAmount,
    status,
    paymentMethod,
    paidAt: exitTime
  })

  const config = configStorage.get()
  configStorage.save({ ...config, availableSpaces: config.availableSpaces + 1 })

  return detail
}

export function vehicleEntry(plateNumber: string): EntryResult {
  plateNumber = plateNumber.toUpperCase().trim()

  if (!plateNumber) {
    return { success: false, message: '请输入车牌号', isMonthlyCard: false }
  }

  const existing = recordStorage.getActiveParking(plateNumber)
  if (existing) {
    return { success: false, message: '该车辆已在场内', isMonthlyCard: false }
  }

  const config = configStorage.get()
  if (config.availableSpaces <= 0) {
    return { success: false, message: '车位已满', isMonthlyCard: false }
  }

  const monthlyCard = checkMonthlyCardValid(plateNumber)
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')

  const record = recordStorage.add({
    plateNumber,
    vehicleType: monthlyCard ? 'monthly' : 'temporary',
    monthlyCardId: monthlyCard?.id,
    entryTime: now,
    status: 'parking',
    createdAt: now
  })

  configStorage.save({
    ...config,
    availableSpaces: config.availableSpaces - 1
  })

  return {
    success: true,
    record,
    message: '入场登记成功',
    isMonthlyCard: !!monthlyCard,
    monthlyCardInfo: monthlyCard
      ? {
          cardNo: monthlyCard.cardNo,
          ownerName: monthlyCard.ownerName,
          remainingQuota: monthlyCard.remainingQuota,
          monthlyQuota: monthlyCard.monthlyQuotaMinutes
        }
      : undefined
  }
}

export function vehicleExit(
  plateNumber: string
): { success: boolean; message: string; result?: ExitBillingResult; needPayment: boolean } {
  plateNumber = plateNumber.toUpperCase().trim()

  const record = recordStorage.getActiveParking(plateNumber)
  if (!record) {
    return { success: false, message: '未找到在场记录', needPayment: false }
  }

  const now = dayjs()
  const exitTime = now.format('YYYY-MM-DD HH:mm:ss')

  const pipeline = runBillingPipeline(record, exitTime, true)
  const canFreePass = pipeline.selfPayAmount <= 0

  return {
    success: true,
    message: canFreePass ? '免费放行，无需缴费' : `应缴费用: ¥${pipeline.selfPayAmount.toFixed(2)}`,
    needPayment: !canFreePass,
    result: {
      record: { ...record },
      totalDuration: pipeline.billing.totalDuration,
      segments: pipeline.finalSegments,
      grossAmount: pipeline.billing.grossAmount,
      freeDeductedMinutes: pipeline.freeDeductedMinutes,
      freeDeductedAmount: pipeline.freeDeductedAmount,
      quotaDeductedMinutes: pipeline.quotaDeductedMinutes,
      quotaDeductedAmount: pipeline.quotaDeductedAmount,
      selfPayAmount: pipeline.selfPayAmount,
      remainingQuota: pipeline.remainingQuota,
      isMonthlyCard: record.vehicleType === 'monthly',
      canFreePass
    }
  }
}

export function confirmFreePass(
  plateNumber: string
): { success: boolean; message: string; detail?: ConsumptionDetail; result?: ExitBillingResult } {
  plateNumber = plateNumber.toUpperCase().trim()

  const record = recordStorage.getActiveParking(plateNumber)
  if (!record) {
    return { success: false, message: '未找到在场记录' }
  }

  const now = dayjs()
  const exitTime = now.format('YYYY-MM-DD HH:mm:ss')

  const pipeline = runBillingPipeline(record, exitTime, false)
  if (pipeline.selfPayAmount > 0.001) {
    return {
      success: false,
      message: `存在自费金额 ¥${pipeline.selfPayAmount.toFixed(2)}，请先完成支付`
    }
  }

  const detail = finalizeExit(record, exitTime, pipeline, 'free')

  return {
    success: true,
    message: pipeline.remainingQuota !== undefined
      ? `放行成功，剩余额度${Math.floor(pipeline.remainingQuota / 60)}小时${pipeline.remainingQuota % 60}分钟`
      : '放行成功，无需缴费',
    detail,
    result: {
      record: { ...record, exitTime, durationMinutes: pipeline.billing.totalDuration, billedSegments: pipeline.finalSegments, totalAmount: pipeline.billing.grossAmount },
      totalDuration: pipeline.billing.totalDuration,
      segments: pipeline.finalSegments,
      grossAmount: pipeline.billing.grossAmount,
      freeDeductedMinutes: pipeline.freeDeductedMinutes,
      freeDeductedAmount: pipeline.freeDeductedAmount,
      quotaDeductedMinutes: pipeline.quotaDeductedMinutes,
      quotaDeductedAmount: pipeline.quotaDeductedAmount,
      selfPayAmount: 0,
      remainingQuota: pipeline.remainingQuota,
      isMonthlyCard: record.vehicleType === 'monthly',
      canFreePass: true
    }
  }
}

export function confirmPayment(
  plateNumber: string,
  paymentMethod: 'cash' | 'wechat' | 'alipay' | 'card'
): { success: boolean; message: string; detail?: ConsumptionDetail } {
  plateNumber = plateNumber.toUpperCase().trim()

  const record = recordStorage.getActiveParking(plateNumber)
  if (!record) {
    return { success: false, message: '未找到在场记录' }
  }

  const now = dayjs()
  const exitTime = now.format('YYYY-MM-DD HH:mm:ss')

  const pipeline = runBillingPipeline(record, exitTime, false)
  const detail = finalizeExit(record, exitTime, pipeline, 'completed', paymentMethod)

  return {
    success: true,
    message: `支付成功，已缴费¥${pipeline.selfPayAmount.toFixed(2)}`,
    detail
  }
}

export function getDashboardStats(): DashboardStats {
  resetAllQuotasForNewMonth()
  const config = configStorage.get()
  const todayStart = dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss')
  const todayEnd = dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss')

  const allRecords = recordStorage.getAll()
  const todayInCount = allRecords.filter(r => r.entryTime >= todayStart && r.entryTime <= todayEnd).length
  const todayOutRecords = allRecords.filter(r => r.exitTime && r.exitTime >= todayStart && r.exitTime <= todayEnd)
  const allCompleted = allRecords.filter(r => r.exitTime && r.status !== 'parking')

  const todayDetails = detailStorage.getByDateRange(todayStart, todayEnd)
  const todayRevenue = todayDetails.reduce((sum, d) => sum + d.selfPayAmount, 0)
  const totalDuration = todayOutRecords.reduce((sum, r) => sum + (r.durationMinutes || 0), 0)

  const vehicleCountMap = new Map<string, number>()
  allCompleted.forEach(r => {
    vehicleCountMap.set(r.plateNumber, (vehicleCountMap.get(r.plateNumber) || 0) + 1)
  })
  const topVehicles = Array.from(vehicleCountMap.entries())
    .map(([plateNumber, count]) => ({ plateNumber, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const hourMap = new Map<number, number>()
  todayDetails.forEach(d => {
    if (!d.paidAt) return
    const h = dayjs(d.paidAt).hour()
    hourMap.set(h, (hourMap.get(h) || 0) + 1)
  })
  let peakHour = '-'
  let peakCount = 0
  hourMap.forEach((count, hour) => {
    if (count > peakCount) {
      peakCount = count
      peakHour = `${hour}:00-${hour + 1}:00`
    }
  })

  const activeCards = cardStorage.getAll().filter(c => c.status === 'active')

  return {
    todayInCount,
    todayOutCount: todayOutRecords.length,
    todayRevenue: Number(todayRevenue.toFixed(2)),
    todayAverageDuration: todayOutRecords.length > 0 ? Math.round(totalDuration / todayOutRecords.length) : 0,
    monthlyCardCount: activeCards.length,
    occupancyRate: config.totalSpaces > 0
      ? Number(((config.totalSpaces - config.availableSpaces) / config.totalSpaces * 100).toFixed(1))
      : 0,
    peakHour,
    topVehicles
  }
}

export function getSystemConfig(): SystemConfig {
  return configStorage.get()
}

export function updateSystemConfig(config: Partial<SystemConfig>): void {
  const current = configStorage.get()
  configStorage.save({ ...current, ...config })
}
