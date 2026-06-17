import dayjs from 'dayjs'
import type { MonthlyCard, BillingSegment, QuotaTransaction } from '@/types'
import { cardStorage, quotaTransactionStorage } from '@/store/storage'

export interface QuotaApplication {
  cardId: string
  availableQuota: number
  usedQuota: number
  quotaAppliedMinutes: number
  quotaDeductedAmount: number
  excessMinutes: number
  excessAmount: number
  finalSegments: BillingSegment[]
  transactionId?: string
}

function createQuotaTx(params: Omit<QuotaTransaction, 'id' | 'createdAt'>): QuotaTransaction {
  return quotaTransactionStorage.add(params)
}

function isFirstOfMonth(dateStr: string, lastReset?: string): boolean {
  const date = dayjs(dateStr)
  if (!lastReset) return true
  const last = dayjs(lastReset)
  if (last.month() !== date.month() || last.year() !== date.year()) return true
  return false
}

export function resetMonthlyQuotaIfNeeded(card: MonthlyCard, currentDate: string): MonthlyCard {
  if (isFirstOfMonth(currentDate, card.lastResetDate)) {
    const balanceBefore = card.remainingQuota
    const updated = {
      ...card,
      remainingQuota: card.monthlyQuotaMinutes,
      usedQuotaThisMonth: 0,
      lastResetDate: dayjs(currentDate).startOf('month').format('YYYY-MM-DD')
    }
    cardStorage.update(card.id, updated)
    createQuotaTx({
      cardId: card.id,
      cardNo: card.cardNo,
      plateNumber: card.plateNumber,
      ownerName: card.ownerName,
      type: 'reset',
      changeMinutes: card.monthlyQuotaMinutes - balanceBefore,
      balanceBefore,
      balanceAfter: card.monthlyQuotaMinutes,
      remark: '月度额度重置'
    })
    return updated
  }
  return card
}

export function resetAllQuotasForNewMonth(currentDate?: string): { reset: number; skipped: number } {
  const now = currentDate || dayjs().format('YYYY-MM-DD')
  const cards = cardStorage.getAll()
  let resetCount = 0
  let skipCount = 0

  for (const card of cards) {
    if (card.status !== 'active') {
      skipCount++
      continue
    }
    if (isFirstOfMonth(now, card.lastResetDate)) {
      const balanceBefore = card.remainingQuota
      const newRemaining = card.monthlyQuotaMinutes
      cardStorage.update(card.id, {
        remainingQuota: newRemaining,
        usedQuotaThisMonth: 0,
        lastResetDate: dayjs(now).startOf('month').format('YYYY-MM-DD')
      })
      createQuotaTx({
        cardId: card.id,
        cardNo: card.cardNo,
        plateNumber: card.plateNumber,
        ownerName: card.ownerName,
        type: 'reset',
        changeMinutes: newRemaining - balanceBefore,
        balanceBefore,
        balanceAfter: newRemaining,
        remark: '批量月度额度重置'
      })
      resetCount++
    } else {
      skipCount++
    }
  }

  return { reset: resetCount, skipped: skipCount }
}

export function issueMonthlyQuota(
  card: MonthlyCard,
  additionalMinutes: number
): { success: boolean; card?: MonthlyCard; message: string } {
  if (additionalMinutes <= 0) return { success: false, message: '发放时长必须大于0' }

  const balanceBefore = card.remainingQuota
  const balanceAfter = balanceBefore + additionalMinutes
  const updated = {
    ...card,
    remainingQuota: balanceAfter
  }
  cardStorage.update(card.id, updated)
  createQuotaTx({
    cardId: card.id,
    cardNo: card.cardNo,
    plateNumber: card.plateNumber,
    ownerName: card.ownerName,
    type: 'issue',
    changeMinutes: additionalMinutes,
    balanceBefore,
    balanceAfter,
    remark: '管理员发放额外额度'
  })
  return { success: true, card: updated, message: `成功发放${additionalMinutes}分钟` }
}

export function applyQuotaToBilling(
  card: MonthlyCard,
  segments: BillingSegment[],
  currentDate: string,
  dryRun: boolean = false,
  extraTx: Partial<QuotaTransaction> = {}
): QuotaApplication {
  const activeCard = resetMonthlyQuotaIfNeeded(card, currentDate)

  let availableQuota = activeCard.remainingQuota
  const balanceBefore = availableQuota
  let usedQuota = 0
  let quotaAppliedMinutes = 0
  let quotaDeductedAmount = 0

  const totalParkingMinutes = segments.reduce((s, seg) => s + seg.durationMinutes, 0)

  const finalSegments: BillingSegment[] = segments.map(s => ({ ...s }))

  if (availableQuota >= totalParkingMinutes && totalParkingMinutes > 0) {
    quotaAppliedMinutes = totalParkingMinutes
    quotaDeductedAmount = Number(segments.reduce((s, seg) => s + seg.amount, 0).toFixed(2))
    availableQuota -= totalParkingMinutes
    usedQuota = totalParkingMinutes
    finalSegments.forEach(seg => {
      seg.durationMinutes = 0
      seg.amount = 0
    })
  } else {
    for (const seg of finalSegments) {
      if (availableQuota <= 0) break
      if (seg.durationMinutes <= 0) continue

      const applyMin = Math.min(availableQuota, seg.durationMinutes)
      const rate = seg.ratePerHour / 60
      const deductAmount = Number((applyMin * rate).toFixed(2))

      seg.durationMinutes -= applyMin
      seg.amount = Number((seg.amount - deductAmount).toFixed(2))
      if (seg.amount < 0) seg.amount = 0

      availableQuota -= applyMin
      usedQuota += applyMin
      quotaAppliedMinutes += applyMin
      quotaDeductedAmount = Number((quotaDeductedAmount + deductAmount).toFixed(2))
    }
  }

  const filteredSegments = finalSegments.filter(s => s.durationMinutes > 0 || s.amount > 0)
  const excessMinutes = filteredSegments.reduce((s, seg) => s + seg.durationMinutes, 0)
  const excessAmount = Number(filteredSegments.reduce((s, seg) => s + seg.amount, 0).toFixed(2))

  let transactionId: string | undefined

  if (quotaAppliedMinutes > 0 && !dryRun) {
    cardStorage.update(activeCard.id, {
      remainingQuota: availableQuota,
      usedQuotaThisMonth: activeCard.usedQuotaThisMonth + usedQuota
    })
    const tx = createQuotaTx({
      cardId: activeCard.id,
      cardNo: activeCard.cardNo,
      plateNumber: activeCard.plateNumber,
      ownerName: activeCard.ownerName,
      type: 'use',
      changeMinutes: usedQuota,
      balanceBefore,
      balanceAfter: availableQuota,
      deductedAmount: quotaDeductedAmount,
      remark: '出场额度抵扣',
      ...extraTx
    })
    transactionId = tx.id
  }

  return {
    cardId: activeCard.id,
    availableQuota,
    usedQuota,
    quotaAppliedMinutes,
    quotaDeductedAmount,
    excessMinutes,
    excessAmount,
    finalSegments: filteredSegments,
    transactionId
  }
}

export function checkMonthlyCardValid(plateNumber: string): MonthlyCard | null {
  const card = cardStorage.findByPlate(plateNumber)
  if (!card) return null

  const now = dayjs().format('YYYY-MM-DD')
  const updated = resetMonthlyQuotaIfNeeded(card, now)

  if (updated.status !== 'active') return null
  if (updated.startDate > now || updated.endDate < now) return null

  return updated
}

export function getQuotaUsageSummary(cardId: string): {
  monthlyQuota: number
  usedThisMonth: number
  remaining: number
  percentUsed: number
  lastReset: string
  nextReset: string
} | null {
  const cards = cardStorage.getAll()
  const card = cards.find(c => c.id === cardId)
  if (!card) return null

  const now = dayjs()
  const nextReset = now.endOf('month').add(1, 'day').startOf('day').format('YYYY-MM-DD')

  return {
    monthlyQuota: card.monthlyQuotaMinutes,
    usedThisMonth: card.usedQuotaThisMonth,
    remaining: card.remainingQuota,
    percentUsed: card.monthlyQuotaMinutes > 0
      ? Math.round((card.usedQuotaThisMonth / card.monthlyQuotaMinutes) * 100)
      : 0,
    lastReset: card.lastResetDate || '-',
    nextReset
  }
}
