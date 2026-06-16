import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    redirect: '/dashboard'
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { title: '数据看板', icon: 'DataAnalysis' }
  },
  {
    path: '/parking',
    name: 'Parking',
    component: () => import('@/views/ParkingEntry.vue'),
    meta: { title: '进出管理', icon: 'Van' }
  },
  {
    path: '/rates',
    name: 'Rates',
    component: () => import('@/views/RateManagement.vue'),
    meta: { title: '时段费率', icon: 'Money' }
  },
  {
    path: '/cards',
    name: 'Cards',
    component: () => import('@/views/MonthlyCards.vue'),
    meta: { title: '月卡管理', icon: 'CreditCard' }
  },
  {
    path: '/details',
    name: 'Details',
    component: () => import('@/views/ConsumptionDetails.vue'),
    meta: { title: '消费明细', icon: 'Tickets' }
  },
  {
    path: '/bills',
    name: 'Bills',
    component: () => import('@/views/BillManagement.vue'),
    meta: { title: '账单管理', icon: 'Document' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/SystemSettings.vue'),
    meta: { title: '系统设置', icon: 'Setting' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
