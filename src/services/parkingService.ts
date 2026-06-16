import dayjs from 'dayjs'
import type {
  ParkingRecord,
  ConsumptionDetail,
  BillingSegment,
  DashboardStats,
  SystemConfig
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
  resetAllQuotasForNewMonth
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
  plateNumber: string,
  paymentMethod?: 'cash' | 'wechat' | 'alipay' | 'card'
): { success: boolean; message: string; result?: ExitBillingResult; needPayment: boolean } {
  plateNumber = plateNumber.toUpperCase().trim()

  const record = recordStorage.getActiveParking(plateNumber)
  if (!record) {
    return { success: false, message: '未找到在场记录', needPayment: false }
  }

  const now = dayjs()
  const exitTime = now.format('YYYY-MM-DD HH:mm:ss')
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

  if (record.vehicleType === 'monthly' && record.monthlyCardId) {
    const cards = cardStorage.getAll()
    const card = cards.find(c => c.id === record.monthlyCardId)
    if (card) {
      const quotaResult = applyQuotaToBilling(card, finalSegments, exitTime)
      finalSegments = quotaResult.finalSegments
      quotaDeductedMinutes = quotaResult.quotaAppliedMinutes
      quotaDeductedAmount = quotaResult.quotaDeductedAmount
      remainingQuota = quotaResult.availableQuota
    }
  }

  const selfPayAmount = Number(
    finalSegments.reduce((sum, s) => sum + s.amount, 0).toFixed(2)
  )

  const canFreePass = selfPayAmount <= 0

  if (canFreePass) {
    const detail: Omit<ConsumptionDetail, 'id'> = {
      recordId: record.id,
      plateNumber,
      cardNo: record.monthlyCardId
        ? cardStorage.getAll().find(c => c.id === record.monthlyCardId)?.cardNo
        : undefined,
      ownerName: record.monthlyCardId
        ? cardStorage.getAll().find(c => c.id === record.monthlyCardId)?.ownerName
        : undefined,
      entryTime: record.entryTime,
      exitTime,
      totalDuration: billing.totalDuration,
      billedSegments: finalSegments,
      grossAmount: billing.grossAmount,
      freeDeduction: freeDeductedAmount,
      quotaDeduction: quotaDeductedAmount,
      selfPayAmount: 0,
      paidAt: exitTime,
      createdAt: exitTime
    }
    detailStorage.add(detail)

    recordStorage.update(record.id, {
      exitTime,
      durationMinutes: billing.totalDuration,
      billedSegments: finalSegments,
      totalAmount: billing.grossAmount,
      freeMinutesUsed: freeDeductedMinutes,
      quotaUsed: quotaDeductedMinutes,
      selfPaidAmount: 0,
      status: 'free',
      paidAt: exitTime
    })

    const config = configStorage.get()
    configStorage.save({ ...config, availableSpaces: config.availableSpaces + 1 })

    return {
      success: true,
      message: remainingQuota !== undefined ? `放行成功，剩余额度${Math.floor(remainingQuota / 60)}小时${remainingQuota % 60}分钟` : '放行成功，无需缴费',
      needPayment: false,
      result: {
        record: { ...record, exitTime, durationMinutes: billing.totalDuration, billedSegments: finalSegments, totalAmount: billing.grossAmount },
        totalDuration: billing.totalDuration,
        segments: finalSegments,
        grossAmount: billing.grossAmount,
        freeDeductedMinutes,
        freeDeductedAmount,
        quotaDeductedMinutes,
        quotaDeductedAmount,
        selfPayAmount: 0,
        remainingQuota,
        isMonthlyCard: record.vehicleType === 'monthly',
        canFreePass: true
      }
    }
  }

  return {
    success: true,
    message: `应缴费用: ¥${selfPayAmount.toFixed(2)}`,
    needPayment: true,
    result: {
      record,
      totalDuration: billing.totalDuration,
      segments: finalSegments,
      grossAmount: billing.grossAmount,
      freeDeductedMinutes,
      freeDeductedAmount,
      quotaDeductedMinutes,
      quotaDeductedAmount,
      selfPayAmount,
      remainingQuota,
      isMonthlyCard: record.vehicleType === 'monthly',
      canFreePass: false
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
  const rates = rateStorage.getAll()

  const billing = calculateBilling(record.entryTime, exitTime, rates)
  const { segments: segmentsAfterFree, deductedMinutes: freeDeductedMinutes, deductedAmount: freeDeductedAmount } = applyFreeDeduction(billing, billing.freeMinutesEligible)

  let finalSegments = segmentsAfterFree
  let quotaDeductedAmount = 0
  let quotaDeductedMinutes = 0

  if (record.vehicleType === 'monthly' && record.monthlyCardId) {
    const cards = cardStorage.getAll()
    const card = cards.find(c => c.id === record.monthlyCardId)
    if (card) {
      const quotaResult = applyQuotaToBilling(card, finalSegments, exitTime)
      finalSegments = quotaResult.finalSegments
      quotaDeductedMinutes = quotaResult.quotaAppliedMinutes
      quotaDeductedAmount = quotaResult.quotaDeductedAmount
    }
  }

  const selfPayAmount = Number(
    finalSegments.reduce((sum, s) => sum + s.amount, 0).toFixed(2)
  )

  const detailData: Omit<ConsumptionDetail, 'id'> = {
    recordId: record.id,
    plateNumber,
    cardNo: record.monthlyCardId
      ? cardStorage.getAll().find(c => c.id === record.monthlyCardId)?.cardNo
      : undefined,
    ownerName: record.monthlyCardId
      ? cardStorage.getAll().find(c => c.id === record.monthlyCardId)?.ownerName
      : undefined,
    entryTime: record.entryTime,
    exitTime,
    totalDuration: billing.totalDuration,
    billedSegments: finalSegments,
    grossAmount: billing.grossAmount,
    freeDeduction: freeDeductedAmount,
    quotaDeduction: quotaDeductedAmount,
    selfPayAmount,
    paymentMethod,
    paidAt: exitTime,
    createdAt: exitTime
  }
  const detail = detailStorage.add(detailData)

  recordStorage.update(record.id, {
    exitTime,
    durationMinutes: billing.totalDuration,
    billedSegments: finalSegments,
    totalAmount: billing.grossAmount,
    freeMinutesUsed: freeDeductedMinutes,
    quotaUsed: quotaDeductedMinutes,
    selfPaidAmount: selfPayAmount,
    status: 'completed',
    paymentMethod,
    paidAt: exitTime
  })

  const config = configStorage.get()
  configStorage.save({ ...config, availableSpaces: config.availableSpaces + 1 })

  return {
    success: true,
    message: `支付成功，已缴费¥${selfPayAmount.toFixed(2)}`,
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
