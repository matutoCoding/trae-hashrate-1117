export interface TimeRate {
  id: string
  name: string
  startTime: string
  endTime: string
  ratePerHour: number
  minFee?: number
  maxFeePerDay?: number
  freeMinutes?: number
  sortOrder: number
  enabled: boolean
}

export interface ParkingRecord {
  id: string
  plateNumber: string
  vehicleType: 'temporary' | 'monthly'
  monthlyCardId?: string
  entryTime: string
  exitTime?: string
  durationMinutes?: number
  billedSegments?: BillingSegment[]
  totalAmount?: number
  freeMinutesUsed?: number
  selfPaidAmount?: number
  quotaUsed?: number
  status: 'parking' | 'completed' | 'free'
  paymentMethod?: 'cash' | 'wechat' | 'alipay' | 'card'
  paidAt?: string
  createdAt: string
}

export interface BillingSegment {
  startTime: string
  endTime: string
  durationMinutes: number
  rateId: string
  rateName: string
  ratePerHour: number
  amount: number
}

export interface MonthlyCard {
  id: string
  cardNo: string
  ownerName: string
  phone: string
  plateNumber: string
  vehicleType: string
  monthlyQuotaMinutes: number
  remainingQuota: number
  usedQuotaThisMonth: number
  startDate: string
  endDate: string
  lastResetDate?: string
  status: 'active' | 'expired' | 'disabled'
  monthlyFee: number
  createdAt: string
}

export interface ConsumptionDetail {
  id: string
  recordId: string
  plateNumber: string
  cardNo?: string
  ownerName?: string
  entryTime: string
  exitTime: string
  totalDuration: number
  billedSegments: BillingSegment[]
  grossAmount: number
  freeDeduction: number
  quotaDeduction: number
  selfPayAmount: number
  paymentMethod?: string
  paidAt?: string
  createdAt: string
}

export interface SystemConfig {
  defaultFreeMinutes: number
  minChargeUnitMinutes: number
  roundUpRule: 'up' | 'down' | 'nearest'
  maxDailyFee: number
  parkingLotName: string
  totalSpaces: number
  availableSpaces: number
}

export interface DashboardStats {
  todayInCount: number
  todayOutCount: number
  todayRevenue: number
  todayAverageDuration: number
  monthlyCardCount: number
  occupancyRate: number
  peakHour: string
  topVehicles: { plateNumber: string; count: number }[]
}
