import dayjs from 'dayjs'
import type { TimeRate, BillingSegment, SystemConfig } from '@/types'
import { configStorage } from '@/store/storage'

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

export interface BillingResult {
  segments: BillingSegment[]
  totalDuration: number
  grossAmount: number
  freeMinutesEligible: number
}

interface RateBoundary {
  rate: TimeRate
  startMin: number
  endMin: number
}

function buildDayBoundaries(rates: TimeRate[]): RateBoundary[] {
  const boundaries: RateBoundary[] = []
  for (const rate of rates) {
    const startMin = parseTimeToMinutes(rate.startTime)
    const rawEndMin = parseTimeToMinutes(rate.endTime)
    if (rawEndMin <= startMin) {
      boundaries.push({ rate, startMin: 0, endMin: rawEndMin })
      boundaries.push({ rate, startMin, endMin: 24 * 60 })
    } else {
      boundaries.push({ rate, startMin, endMin: rawEndMin })
    }
  }
  boundaries.sort((a, b) => a.startMin - b.startMin)
  return boundaries
}

function fillGapWithPreviousRate(boundaries: RateBoundary[]): RateBoundary[] {
  if (boundaries.length === 0) return boundaries
  const filled: RateBoundary[] = []
  let lastEnd = 0
  let lastBoundary: RateBoundary | null = boundaries[boundaries.length - 1]

  for (const b of boundaries) {
    if (b.startMin > lastEnd) {
      filled.push({
        ...lastBoundary,
        startMin: lastEnd,
        endMin: b.startMin
      })
    }
    filled.push(b)
    lastEnd = b.endMin
    lastBoundary = b
  }

  if (lastEnd < 24 * 60) {
    filled.push({
      ...lastBoundary,
      startMin: lastEnd,
      endMin: 24 * 60
    })
  }
  return filled
}

export function splitIntoSegments(
  entryTime: string,
  exitTime: string,
  rates: TimeRate[]
): BillingSegment[] {
  const segments: BillingSegment[] = []
  const entry = dayjs(entryTime)
  const exit = dayjs(exitTime)

  if (!exit.isAfter(entry)) return segments

  const enabledRates = rates.filter(r => r.enabled).sort((a, b) => a.sortOrder - b.sortOrder)
  if (enabledRates.length === 0) return segments

  const boundaries = fillGapWithPreviousRate(buildDayBoundaries(enabledRates))

  let current = entry.clone()
  while (current.isBefore(exit)) {
    const dayStart = current.startOf('day')
    const currentMinOfDay = current.diff(dayStart, 'minute')
    const normalizedMin = currentMinOfDay % (24 * 60)

    const boundary = boundaries.find(b => normalizedMin >= b.startMin && normalizedMin < b.endMin)
      || boundaries[boundaries.length - 1]

    let segmentEndMin: number
    segmentEndMin = boundary.endMin
    if (segmentEndMin <= normalizedMin) segmentEndMin = normalizedMin + 1

    const dayBoundaryMinutes = segmentEndMin
    const segmentEndTime = dayStart.clone().add(dayBoundaryMinutes, 'minute')

    const actualEnd = segmentEndTime.isAfter(exit) ? exit : segmentEndTime
    const duration = actualEnd.diff(current, 'minute')

    if (duration > 0) {
      const amount = calculateSegmentAmount(duration, boundary.rate)
      segments.push({
        startTime: current.format('YYYY-MM-DD HH:mm:ss'),
        endTime: actualEnd.format('YYYY-MM-DD HH:mm:ss'),
        durationMinutes: duration,
        rateId: boundary.rate.id,
        rateName: boundary.rate.name,
        ratePerHour: boundary.rate.ratePerHour,
        amount
      })
    }

    current = actualEnd.clone()
    if (duration === 0) break
  }

  return segments
}

function calculateSegmentAmount(durationMinutes: number, rate: TimeRate): number {
  const config = configStorage.get()
  const unit = config.minChargeUnitMinutes
  let chargeableUnits: number

  switch (config.roundUpRule) {
    case 'down':
      chargeableUnits = Math.floor(durationMinutes / unit)
      break
    case 'nearest':
      chargeableUnits = Math.round(durationMinutes / unit)
      break
    case 'up':
    default:
      chargeableUnits = Math.ceil(durationMinutes / unit)
      break
  }

  if (chargeableUnits <= 0) return 0
  const chargeableHours = (chargeableUnits * unit) / 60
  let amount = Number((chargeableHours * rate.ratePerHour).toFixed(2))

  if (rate.minFee && amount < rate.minFee) amount = rate.minFee
  return amount
}

export function aggregateDailyFees(segments: BillingSegment[], rates: TimeRate[]): BillingSegment[] {
  const dayMap = new Map<string, { segments: BillingSegment[]; total: number; rateId: string }>()

  for (const seg of segments) {
    const day = seg.startTime.substring(0, 10)
    const rate = rates.find(r => r.id === seg.rateId)
    if (!dayMap.has(day)) {
      dayMap.set(day, { segments: [], total: 0, rateId: seg.rateId })
    }
    const entry = dayMap.get(day)!
    entry.segments.push(seg)
    entry.total = Number((entry.total + seg.amount).toFixed(2))

    if (rate && rate.maxFeePerDay && entry.total > rate.maxFeePerDay) {
      const excess = entry.total - rate.maxFeePerDay
      const lastSeg = entry.segments[entry.segments.length - 1]
      lastSeg.amount = Number((lastSeg.amount - excess).toFixed(2))
      if (lastSeg.amount < 0) lastSeg.amount = 0
      entry.total = rate.maxFeePerDay
    }
  }

  return dayMap.values()
    .flatMap(e => e.segments)
    .filter(s => s.amount > 0 || s.durationMinutes > 0)
}

export function calculateBilling(
  entryTime: string,
  exitTime: string,
  rates: TimeRate[],
  customConfig?: Partial<SystemConfig>
): BillingResult {
  const config = { ...configStorage.get(), ...customConfig }
  let segments = splitIntoSegments(entryTime, exitTime, rates)
  segments = aggregateDailyFees(segments, rates)

  const totalDuration = segments.reduce((sum, s) => sum + s.durationMinutes, 0)
  const grossAmount = Number(segments.reduce((sum, s) => sum + s.amount, 0).toFixed(2))

  let freeMinutesEligible = config.defaultFreeMinutes
  const firstRate = rates.find(r => r.enabled && r.freeMinutes)
  if (firstRate && firstRate.freeMinutes) freeMinutesEligible = firstRate.freeMinutes

  return {
    segments,
    totalDuration,
    grossAmount,
    freeMinutesEligible
  }
}

export function applyFreeDeduction(
  result: BillingResult,
  freeMinutes: number
): { segments: BillingSegment[]; deductedMinutes: number; deductedAmount: number } {
  if (freeMinutes <= 0 || result.segments.length === 0) {
    return { segments: [...result.segments], deductedMinutes: 0, deductedAmount: 0 }
  }

  const adjustedSegments = result.segments.map(s => ({ ...s }))
  let remainingFree = freeMinutes
  let deductedAmount = 0

  for (const seg of adjustedSegments) {
    if (remainingFree <= 0) break
    if (seg.durationMinutes <= 0) continue

    const applyToThis = Math.min(remainingFree, seg.durationMinutes)
    const rate = seg.ratePerHour / 60
    const freeAmount = Number((applyToThis * rate).toFixed(2))

    seg.durationMinutes -= applyToThis
    seg.amount = Number((seg.amount - freeAmount).toFixed(2))
    if (seg.amount < 0) seg.amount = 0

    remainingFree -= applyToThis
    deductedAmount = Number((deductedAmount + freeAmount).toFixed(2))
  }

  const actuallyDeducted = freeMinutes - remainingFree
  return {
    segments: adjustedSegments.filter(s => s.durationMinutes > 0 || s.amount > 0),
    deductedMinutes: actuallyDeducted,
    deductedAmount
  }
}
