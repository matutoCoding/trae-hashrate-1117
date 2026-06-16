<template>
  <el-container class="layout-container">
    <el-aside :width="isCollapse ? '64px' : '220px'" class="layout-aside">
      <div class="logo-area">
        <el-icon :size="28" color="#fff"><Van /></el-icon>
        <span v-show="!isCollapse" class="logo-text">智慧停车场</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="el-menu-vertical-demo"
        :collapse="isCollapse"
        background-color="#1f2937"
        text-color="#9ca3af"
        active-text-color="#4facfe"
        router
      >
        <el-menu-item v-for="route in menuRoutes" :key="route.path" :index="route.path">
          <el-icon>
            <component :is="route.meta.icon" />
          </el-icon>
          <template #title>{{ route.meta.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="layout-header">
        <div class="header-left">
          <el-icon :size="20" class="collapse-btn" @click="toggleCollapse">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentPageTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <div class="parking-status">
            <el-icon :size="18" color="#67c23a"><LocationFilled /></el-icon>
            <span>{{ config.parkingLotName }}</span>
            <el-divider direction="vertical" />
            <el-tag type="success" effect="dark" round>
              空闲 {{ config.availableSpaces }}/{{ config.totalSpaces }}
            </el-tag>
          </div>
          <div class="current-time">
            <el-icon :size="16"><Clock /></el-icon>
            <span>{{ currentTime }}</span>
          </div>
        </div>
      </el-header>

      <el-main class="layout-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { getSystemConfig } from '@/services/parkingService'
import type { SystemConfig } from '@/types'

const route = useRoute()
const isCollapse = ref(false)
const currentTime = ref('')
const config = ref<SystemConfig>(getSystemConfig())

const menuRoutes: RouteRecordRaw[] = [
  { path: '/dashboard', meta: { title: '数据看板', icon: 'DataAnalysis' } },
  { path: '/parking', meta: { title: '进出管理', icon: 'Van' } },
  { path: '/rates', meta: { title: '时段费率', icon: 'Money' } },
  { path: '/cards', meta: { title: '月卡管理', icon: 'CreditCard' } },
  { path: '/details', meta: { title: '消费明细', icon: 'Tickets' } },
  { path: '/bills', meta: { title: '账单管理', icon: 'Document' } },
  { path: '/settings', meta: { title: '系统设置', icon: 'Setting' } }
] as RouteRecordRaw[]

const activeMenu = computed(() => route.path)
const currentPageTitle = computed(() => route.meta.title as string || '')

function toggleCollapse() {
  isCollapse.value = !isCollapse.value
}

function updateTime() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  currentTime.value = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

let timer: number

onMounted(() => {
  config.value = getSystemConfig()
  updateTime()
  timer = window.setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.layout-aside {
  background: #1f2937;
  transition: width 0.3s;
  overflow-x: hidden;
}

.logo-area {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #111827;
  color: #fff;
  border-bottom: 1px solid #374151;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  white-space: nowrap;
}

.el-menu-vertical-demo {
  border-right: none;
}

:deep(.el-menu-item) {
  height: 52px;
  line-height: 52px;
}

:deep(.el-menu-item.is-active) {
  background: rgba(79, 172, 254, 0.1) !important;
  border-right: 3px solid #4facfe;
}

.layout-header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ebeef5;
  padding: 0 20px;
  height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  cursor: pointer;
  color: #606266;
  padding: 6px;
  border-radius: 4px;
  transition: background 0.2s;
}

.collapse-btn:hover {
  background: #f5f7fa;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.parking-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #606266;
  font-size: 14px;
}

.current-time {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #606266;
  font-size: 14px;
  font-family: 'Courier New', monospace;
}

.layout-main {
  background: #f0f2f5;
  padding: 0;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
