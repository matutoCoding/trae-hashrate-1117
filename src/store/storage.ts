import type {
  TimeRate,
  ParkingRecord,
  MonthlyCard,
  ConsumptionDetail,
  SystemConfig,
  QuotaTransaction
} from '@/types'

const STORAGE_KEYS = {
  TIME_RATES: 'sp_time_rates',
  PARKING_RECORDS: 'sp_parking_records',
  MONTHLY_CARDS: 'sp_monthly_cards',
  CONSUMPTION_DETAILS: 'sp_consumption_details',
  QUOTA_TRANSACTIONS: 'sp_quota_transactions',
  SYSTEM_CONFIG: 'sp_system_config'
}

function readData<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key)
    if (data) return JSON.parse(data) as T
    return defaultValue
  } catch {
    return defaultValue
  }
}

function writeData<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data))
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

export const rateStorage = {
  getAll(): TimeRate[] {
    return readData<TimeRate[]>(STORAGE_KEYS.TIME_RATES, [])
  },
  saveAll(rates: TimeRate[]): void {
    writeData(STORAGE_KEYS.TIME_RATES, rates)
  },
  add(rate: Omit<TimeRate, 'id'>): TimeRate {
    const rates = this.getAll()
    const newRate: TimeRate = { ...rate, id: generateId() }
    rates.push(newRate)
    this.saveAll(rates)
    return newRate
  },
  update(id: string, data: Partial<TimeRate>): boolean {
    const rates = this.getAll()
    const idx = rates.findIndex(r => r.id === id)
    if (idx >= 0) {
      rates[idx] = { ...rates[idx], ...data }
      this.saveAll(rates)
      return true
    }
    return false
  },
  remove(id: string): boolean {
    const rates = this.getAll().filter(r => r.id !== id)
    this.saveAll(rates)
    return true
  },
  getEnabled(): TimeRate[] {
    return this.getAll().filter(r => r.enabled).sort((a, b) => a.sortOrder - b.sortOrder)
  }
}

export const recordStorage = {
  getAll(): ParkingRecord[] {
    return readData<ParkingRecord[]>(STORAGE_KEYS.PARKING_RECORDS, [])
  },
  saveAll(records: ParkingRecord[]): void {
    writeData(STORAGE_KEYS.PARKING_RECORDS, records)
  },
  add(record: Omit<ParkingRecord, 'id'>): ParkingRecord {
    const records = this.getAll()
    const newRecord: ParkingRecord = { ...record, id: generateId() }
    records.push(newRecord)
    this.saveAll(records)
    return newRecord
  },
  update(id: string, data: Partial<ParkingRecord>): boolean {
    const records = this.getAll()
    const idx = records.findIndex(r => r.id === id)
    if (idx >= 0) {
      records[idx] = { ...records[idx], ...data }
      this.saveAll(records)
      return true
    }
    return false
  },
  getActiveParking(plateNumber: string): ParkingRecord | undefined {
    return this.getAll().find(r => r.plateNumber === plateNumber && r.status === 'parking')
  },
  getAllActive(): ParkingRecord[] {
    return this.getAll().filter(r => r.status === 'parking')
  },
  getByDateRange(start: string, end: string): ParkingRecord[] {
    return this.getAll().filter(r => {
      if (!r.exitTime) return false
      return r.exitTime >= start && r.exitTime <= end
    })
  },
  getByPlate(plateNumber: string): ParkingRecord[] {
    return this.getAll().filter(r => r.plateNumber === plateNumber)
  },
  getByCardId(cardId: string): ParkingRecord[] {
    return this.getAll().filter(r => r.monthlyCardId === cardId)
  }
}

export const cardStorage = {
  getAll(): MonthlyCard[] {
    return readData<MonthlyCard[]>(STORAGE_KEYS.MONTHLY_CARDS, [])
  },
  saveAll(cards: MonthlyCard[]): void {
    writeData(STORAGE_KEYS.MONTHLY_CARDS, cards)
  },
  add(card: Omit<MonthlyCard, 'id'>): MonthlyCard {
    const cards = this.getAll()
    const newCard: MonthlyCard = { ...card, id: generateId() }
    cards.push(newCard)
    this.saveAll(cards)
    return newCard
  },
  update(id: string, data: Partial<MonthlyCard>): boolean {
    const cards = this.getAll()
    const idx = cards.findIndex(c => c.id === id)
    if (idx >= 0) {
      cards[idx] = { ...cards[idx], ...data }
      this.saveAll(cards)
      return true
    }
    return false
  },
  remove(id: string): boolean {
    const cards = this.getAll().filter(c => c.id !== id)
    this.saveAll(cards)
    return true
  },
  findByPlate(plateNumber: string): MonthlyCard | undefined {
    const now = new Date().toISOString().split('T')[0]
    return this.getAll().find(
      c => c.plateNumber === plateNumber && c.status === 'active' && c.startDate <= now && c.endDate >= now
    )
  },
  findByCardNo(cardNo: string): MonthlyCard | undefined {
    return this.getAll().find(c => c.cardNo === cardNo)
  },
  getById(id: string): MonthlyCard | undefined {
    return this.getAll().find(c => c.id === id)
  }
}

export const detailStorage = {
  getAll(): ConsumptionDetail[] {
    return readData<ConsumptionDetail[]>(STORAGE_KEYS.CONSUMPTION_DETAILS, [])
  },
  saveAll(details: ConsumptionDetail[]): void {
    writeData(STORAGE_KEYS.CONSUMPTION_DETAILS, details)
  },
  add(detail: Omit<ConsumptionDetail, 'id'>): ConsumptionDetail {
    const details = this.getAll()
    const newDetail: ConsumptionDetail = { ...detail, id: generateId() }
    details.push(newDetail)
    this.saveAll(details)
    return newDetail
  },
  getByDateRange(start: string, end: string): ConsumptionDetail[] {
    return this.getAll().filter(d => d.createdAt >= start && d.createdAt <= end)
  },
  getByPlate(plateNumber: string): ConsumptionDetail[] {
    return this.getAll().filter(d => d.plateNumber === plateNumber)
  },
  getByCardNo(cardNo: string): ConsumptionDetail[] {
    return this.getAll().filter(d => d.cardNo === cardNo)
  },
  getByRecordId(recordId: string): ConsumptionDetail | undefined {
    return this.getAll().find(d => d.recordId === recordId)
  },
  getByCardId(cardId: string): ConsumptionDetail[] {
    const cards = cardStorage.getAll()
    const card = cards.find(c => c.id === cardId)
    if (!card) return []
    return this.getAll().filter(d => d.cardNo === card.cardNo)
  }
}

export const quotaTransactionStorage = {
  getAll(): QuotaTransaction[] {
    return readData<QuotaTransaction[]>(STORAGE_KEYS.QUOTA_TRANSACTIONS, [])
  },
  saveAll(list: QuotaTransaction[]): void {
    writeData(STORAGE_KEYS.QUOTA_TRANSACTIONS, list)
  },
  add(tx: Omit<QuotaTransaction, 'id'>): QuotaTransaction {
    const list = this.getAll()
    const newTx: QuotaTransaction = { ...tx, id: generateId() }
    list.push(newTx)
    this.saveAll(list)
    return newTx
  },
  update(id: string, data: Partial<QuotaTransaction>): boolean {
    const list = this.getAll()
    const idx = list.findIndex(t => t.id === id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...data }
      this.saveAll(list)
      return true
    }
    return false
  },
  getByCardId(cardId: string): QuotaTransaction[] {
    return this.getAll().filter(t => t.cardId === cardId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  getByCardNo(cardNo: string): QuotaTransaction[] {
    return this.getAll().filter(t => t.cardNo === cardNo).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  getByPlate(plateNumber: string): QuotaTransaction[] {
    return this.getAll().filter(t => t.plateNumber === plateNumber).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  getByDetailId(detailId: string): QuotaTransaction | undefined {
    return this.getAll().find(t => t.detailId === detailId)
  }
}

export const configStorage = {
  get(): SystemConfig {
    return readData<SystemConfig>(STORAGE_KEYS.SYSTEM_CONFIG, {
      defaultFreeMinutes: 15,
      minChargeUnitMinutes: 15,
      roundUpRule: 'up',
      maxDailyFee: 60,
      parkingLotName: '智慧停车场',
      totalSpaces: 500,
      availableSpaces: 500
    })
  },
  save(config: SystemConfig): void {
    writeData(STORAGE_KEYS.SYSTEM_CONFIG, config)
  }
}
