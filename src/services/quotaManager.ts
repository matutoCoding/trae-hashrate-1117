import dayjs from 'dayjs'
import type { MonthlyCard, BillingSegment } from '@/types'
import { cardStorage } from '@/store/storage'

export interface QuotaApplication {
  cardId: string
  availableQuota: number
  usedQuota: number
  quotaAppliedMinutes: number
  quotaDeductedAmount: number
  excessMinutes: number
  excessAmount: number
  finalSegments: BillingSegment[]
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
    const updated = {
      ...card,
      remainingQuota: card.monthlyQuotaMinutes,
      usedQuotaThisMonth: 0,
      lastResetDate: dayjs(currentDate).startOf('month').format('YYYY-MM-DD')
    }
    cardStorage.update(card.id, updated)
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
      cardStorage.update(card.id, {
        remainingQuota: card.monthlyQuotaMinutes,
        usedQuotaThisMonth: 0,
        lastResetDate: dayjs(now).startOf('month').format('YYYY-MM-DD')
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

  const updated = {
    ...card,
    remainingQuota: card.remainingQuota + additionalMinutes
  }
  cardStorage.update(card.id, updated)
  return { success: true, card: updated, message: `成功发放${additionalMinutes}分钟` }
}

export function applyQuotaToBilling(
  card: MonthlyCard,
  segments: BillingSegment[],
  currentDate: string,
  dryRun: boolean = false
): QuotaApplication {
  const activeCard = resetMonthlyQuotaIfNeeded(card, currentDate)

  let availableQuota = activeCard.remainingQuota
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

  if (quotaAppliedMinutes > 0 && !dryRun) {
    cardStorage.update(activeCard.id, {
      remainingQuota: availableQuota,
      usedQuotaThisMonth: activeCard.usedQuotaThisMonth + usedQuota
    })
  }

  return {
    cardId: activeCard.id,
    availableQuota,
    usedQuota,
    quotaAppliedMinutes,
    quotaDeductedAmount,
    excessMinutes,
    excessAmount,
    finalSegments: filteredSegments
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
