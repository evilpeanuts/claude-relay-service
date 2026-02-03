<template>
  <div class="translation-stats-view">
    <!-- Header with better spacing -->
    <div class="header">
      <div class="flex items-center gap-3">
        <div
          class="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-2xl shadow-lg"
        >
          🌍
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">翻译统计</h1>
          <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">查看翻译服务使用情况</p>
        </div>
      </div>
    </div>

    <!-- Filters with Element Plus -->
    <div class="filters glass-card">
      <el-form label-position="top" :model="filterForm">
        <el-row :gutter="16">
          <el-col :sm="8" :xs="24">
            <el-form-item label="开始日期">
              <el-date-picker
                v-model="startDate"
                :clearable="false"
                format="YYYY-MM-DD"
                placeholder="选择开始日期"
                style="width: 100%"
                type="date"
                value-format="YYYY-MM-DD"
                @change="loadStats"
              />
            </el-form-item>
          </el-col>
          <el-col :sm="8" :xs="24">
            <el-form-item label="结束日期">
              <el-date-picker
                v-model="endDate"
                :clearable="false"
                format="YYYY-MM-DD"
                placeholder="选择结束日期"
                style="width: 100%"
                type="date"
                value-format="YYYY-MM-DD"
                @change="loadStats"
              />
            </el-form-item>
          </el-col>
          <el-col :sm="8" :xs="24">
            <el-form-item label="供应商筛选">
              <el-select
                v-model="selectedProvider"
                placeholder="全部供应商"
                style="width: 100%"
                @change="loadStats"
              >
                <el-option label="全部供应商" value="" />
                <el-option label="🐂 小牛翻译" value="niutrans" />
                <el-option label="🔷 DeepL" value="deepl" />
                <el-option label="☁️ 腾讯云" value="tencent" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <!-- Stats cards with enhanced design -->
    <div class="stats-card glass-card">
      <h2 class="mb-6 flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white">
        <svg class="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
          />
        </svg>
        统计汇总
      </h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-icon-wrapper bg-blue-100 dark:bg-blue-900/30">
            <svg
              class="h-6 w-6 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">总字符数</div>
            <div class="stat-value">{{ formatNumber(totalStats.chars) }}</div>
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-icon-wrapper bg-purple-100 dark:bg-purple-900/30">
            <svg
              class="h-6 w-6 text-purple-600 dark:text-purple-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M13 10V3L4 14h7v7l9-11h-7z"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
          </div>
          <div class="stat-content">
            <div class="stat-label">总调用次数</div>
            <div class="stat-value">{{ formatNumber(totalStats.calls) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Provider account management with improved design -->
    <div class="provider-management">
      <div v-for="provider in providers" :key="provider" class="provider-section glass-card">
        <div class="provider-header">
          <h3 class="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-white">
            <span class="text-2xl">{{ providerNames[provider].split(' ')[0] }}</span>
            <span>{{ providerNames[provider].split(' ').slice(1).join(' ') }}</span>
          </h3>
          <button class="btn-add group" @click="showAddAccountModal(provider)">
            <svg
              class="h-4 w-4 transition-transform group-hover:rotate-90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 4v16m8-8H4"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              />
            </svg>
            <span>添加账户</span>
          </button>
        </div>

        <!-- Account table with responsive design -->
        <div v-if="accounts[provider]?.length > 0" class="accounts-table-wrapper">
          <div class="accounts-table">
            <table>
              <thead>
                <tr>
                  <th class="sticky-col">账户名称</th>
                  <th v-if="provider === 'deepl'">API Key</th>
                  <th v-if="provider === 'niutrans'">App ID</th>
                  <th v-if="provider === 'niutrans'">API Key</th>
                  <th v-if="provider === 'tencent'">Secret ID</th>
                  <th v-if="provider === 'tencent'">Secret Key</th>
                  <th class="text-center">字符数</th>
                  <th class="text-center">调用次数</th>
                  <th class="text-center">周期日期</th>
                  <th class="text-center">周期</th>
                  <th class="text-center">状态</th>
                  <th>额度使用</th>
                  <th>原因</th>
                  <th class="text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="account in accounts[provider]" :key="account.id" class="hover-row">
                  <td class="sticky-col">
                    <div class="account-name-cell">
                      <div class="font-semibold text-gray-900 dark:text-gray-100">
                        {{ account.name || '未命名' }}
                      </div>
                      <div
                        v-if="account.description"
                        class="text-xs text-gray-500 dark:text-gray-400"
                      >
                        {{ account.description }}
                      </div>
                    </div>
                  </td>
                  <td v-if="provider === 'deepl'" class="font-mono text-sm">
                    <code class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">{{
                      maskKey(account.apiKey)
                    }}</code>
                  </td>
                  <td v-if="provider === 'niutrans'" class="font-mono text-sm">
                    <code class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">{{
                      account.appId
                    }}</code>
                  </td>
                  <td v-if="provider === 'niutrans'" class="font-mono text-sm">
                    <code class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">{{
                      maskKey(account.apiKey)
                    }}</code>
                  </td>
                  <td v-if="provider === 'tencent'" class="font-mono text-sm">
                    <code class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">{{
                      maskKey(account.secretId)
                    }}</code>
                  </td>
                  <td v-if="provider === 'tencent'" class="font-mono text-sm">
                    <code class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">{{
                      maskKey(account.secretKey)
                    }}</code>
                  </td>
                  <td class="text-center">
                    <span
                      class="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    >
                      {{ formatNumber(account.stats?.chars || 0) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span
                      class="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-sm font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    >
                      {{ formatNumber(account.stats?.calls || 0) }}
                    </span>
                  </td>
                  <td class="text-center">
                    <div class="text-sm">
                      <div class="font-medium text-gray-900 dark:text-gray-100">
                        {{ account.cycleStart || '—' }}
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">至</div>
                      <div class="font-medium text-gray-900 dark:text-gray-100">
                        {{ account.cycleEnd || '—' }}
                      </div>
                    </div>
                  </td>
                  <td class="text-center">
                    <span
                      class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    >
                      {{ account.period === 'day' ? '按天' : '按月' }}
                    </span>
                  </td>
                  <td class="text-center">
                    <span
                      class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                      :class="{
                        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400':
                          account.status === 1,
                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400':
                          account.status === 0,
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400':
                          account.status < 0
                      }"
                    >
                      <span
                        class="h-1.5 w-1.5 rounded-full"
                        :class="{
                          'bg-green-600 dark:bg-green-400': account.status === 1,
                          'bg-orange-600 dark:bg-orange-400': account.status === 0,
                          'bg-red-600 dark:bg-red-400': account.status < 0
                        }"
                      ></span>
                      {{ getStatusText(account.status) }}
                    </span>
                  </td>
                  <td>
                    <div class="quota-cell">
                      <div class="mb-1 flex items-center justify-between text-xs">
                        <span class="text-gray-600 dark:text-gray-400">
                          {{ formatNumber(account.usage || 0) }} /
                          {{ formatNumber(account.quota || 50000) }}
                        </span>
                        <span
                          class="font-medium"
                          :class="{
                            'text-green-600 dark:text-green-400': account.quotaPct < 70,
                            'text-orange-600 dark:text-orange-400':
                              account.quotaPct >= 70 && account.quotaPct < 90,
                            'text-red-600 dark:text-red-400': account.quotaPct >= 90
                          }"
                        >
                          {{ account.quotaPct || 0 }}%
                        </span>
                      </div>
                      <div class="progress-bar">
                        <div
                          class="progress-fill"
                          :class="{
                            'bg-green-500': account.quotaPct < 70,
                            'bg-orange-500': account.quotaPct >= 70 && account.quotaPct < 90,
                            'bg-red-500': account.quotaPct >= 90
                          }"
                          :style="{ width: account.quotaPct + '%' }"
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="text-sm text-gray-600 dark:text-gray-400">
                      {{ account.disabledReason || '无' }}
                    </div>
                  </td>
                  <td>
                    <div class="action-buttons">
                      <button
                        class="action-btn action-btn-edit"
                        title="编辑账户"
                        @click="showEditAccountModal(provider, account)"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                          />
                        </svg>
                      </button>
                      <button
                        v-if="account.status !== 1"
                        class="action-btn action-btn-activate"
                        title="激活账户"
                        @click="activateAccount(provider, account.id)"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                          />
                          <path
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                          />
                        </svg>
                      </button>
                      <button
                        class="action-btn action-btn-delete"
                        title="删除账户"
                        @click="deleteAccount(provider, account.id)"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else class="empty-state">
          <svg
            class="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
          </svg>
          <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">暂无账户</p>
          <button
            class="mt-3 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            @click="showAddAccountModal(provider)"
          >
            添加第一个账户
          </button>
        </div>
      </div>
    </div>

    <!-- Modal with Element Plus -->
    <el-dialog
      v-model="showModal"
      append-to-body
      :close-on-click-modal="false"
      :title="`${editingAccount ? '编辑' : '添加'} ${providerNames[currentProvider]} 账户`"
      width="500px"
    >
      <el-form label-position="top" label-width="100px" :model="newAccount">
        <!-- 账户名称（必填） -->
        <el-form-item label="账户名称" required>
          <el-input
            v-model="newAccount.name"
            clearable
            placeholder="输入账户名称（用于识别账户）"
          />
        </el-form-item>

        <!-- 账户描述（可选） -->
        <el-form-item label="账户描述">
          <el-input v-model="newAccount.description" clearable placeholder="输入账户描述（可选）" />
        </el-form-item>

        <!-- DeepL API Key -->
        <el-form-item
          v-if="currentProvider === 'deepl'"
          label="DeepL API Key"
          :required="!editingAccount"
        >
          <el-input
            v-model="newAccount.apiKey"
            clearable
            :placeholder="editingAccount ? '留空则不修改' : '输入 DeepL API Key'"
            show-password
          />
        </el-form-item>

        <!-- 小牛翻译凭据 -->
        <template v-if="currentProvider === 'niutrans'">
          <el-form-item label="小牛翻译 App ID" :required="!editingAccount">
            <el-input
              v-model="newAccount.appId"
              clearable
              :placeholder="editingAccount ? '留空则不修改' : '输入 App ID'"
            />
          </el-form-item>
          <el-form-item label="小牛翻译 API Key" :required="!editingAccount">
            <el-input
              v-model="newAccount.apiKey"
              clearable
              :placeholder="editingAccount ? '留空则不修改' : '输入 API Key'"
              show-password
            />
          </el-form-item>
        </template>

        <!-- 腾讯云凭据 -->
        <template v-if="currentProvider === 'tencent'">
          <el-form-item label="腾讯云 Secret ID" :required="!editingAccount">
            <el-input
              v-model="newAccount.secretId"
              clearable
              :placeholder="editingAccount ? '留空则不修改' : '输入 Secret ID'"
            />
          </el-form-item>
          <el-form-item label="腾讯云 Secret Key" :required="!editingAccount">
            <el-input
              v-model="newAccount.secretKey"
              clearable
              :placeholder="editingAccount ? '留空则不修改' : '输入 Secret Key'"
              show-password
            />
          </el-form-item>
          <el-form-item label="腾讯云 Region">
            <el-input
              v-model="newAccount.region"
              clearable
              placeholder="输入地域标识，如 ap-beijing、ap-shanghai 等（留空默认 ap-beijing）"
            />
          </el-form-item>
          <el-form-item label="腾讯云 Region 说明">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              常用地域：ap-beijing（北京）、na-ashburn（美国东部）、na-siliconvalley（美国西部）、ap-shanghai（上海）、ap-guangzhou（广州）
              <el-link
                class="text-blue-500 hover:text-blue-600"
                href="https://cloud.tencent.com/document/api/551/15615#.E5.9C.B0.E5.9F.9F.E5.88.97.E8.A1.A8"
                target="_blank"
              >
                更多地域
              </el-link>
            </div>
          </el-form-item>
        </template>

        <!-- 配额设置 -->
        <el-form-item label="字符配额">
          <el-input-number
            v-model="newAccount.quota"
            controls-position="right"
            :min="0"
            placeholder="留空使用默认配额"
            :step="1000"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="配额周期">
          <el-select v-model="newAccount.period" placeholder="选择配额周期" style="width: 100%">
            <el-option label="默认" value="" />
            <el-option label="按天" value="day" />
            <el-option label="按月" value="month" />
          </el-select>
        </el-form-item>

        <!-- 自定义周期配置 -->
        <template v-if="newAccount.period === 'month'">
          <el-divider content-position="left">
            <span class="text-sm text-gray-600 dark:text-gray-400">自定义周期（可选）</span>
          </el-divider>

          <el-form-item label="周期起始日期">
            <el-date-picker
              v-model="newAccount.cycleStart"
              clearable
              format="YYYY-MM-DD"
              placeholder="选择周期起始日期"
              style="width: 100%"
              type="date"
              value-format="YYYY-MM-DD"
            />
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              当前选择：
              <span
                v-if="newAccount.cycleStart"
                class="font-semibold text-blue-600 dark:text-blue-400"
              >
                {{ newAccount.cycleStart }}
              </span>
              <span v-else>未选择</span>
            </div>
          </el-form-item>

          <el-form-item label="周期结束日期">
            <el-date-picker
              v-model="newAccount.cycleEnd"
              clearable
              format="YYYY-MM-DD"
              placeholder="选择周期结束日期"
              style="width: 100%"
              type="date"
              value-format="YYYY-MM-DD"
            />
            <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              当前选择：
              <span
                v-if="newAccount.cycleEnd"
                class="font-semibold text-blue-600 dark:text-blue-400"
              >
                {{ newAccount.cycleEnd }}
              </span>
              <span v-else>未选择</span>
            </div>
          </el-form-item>

          <el-alert :closable="false" style="margin-bottom: 16px" type="info">
            <template #title>
              <div class="text-xs">
                <strong>说明：</strong>留空则使用自然月（1日-月末）。<br />
                <strong>示例：</strong>选择起始日期 2026-01-18，结束日期 2026-02-28，表示从
                <strong>2026-01-18</strong> 到 <strong>2026-02-28</strong> 为一个计费周期。<br />
                <strong>注意：</strong>周期结束后需要手动更新日期到下一个周期。
              </div>
            </template>
          </el-alert>
        </template>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeModal">取消</el-button>
          <el-button type="primary" @click="editingAccount ? updateAccount() : addAccount()">
            {{ editingAccount ? '保存' : '确认' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Loading with Element Plus -->
    <el-loading :active="loading" fullscreen :lock="true" text="加载中..." />
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
// import { ElMessage, ElMessageBox } from 'element-plus'
// import { apiClient } from '@/config/api'
import * as httpApis from '@/utils/http_apis'

// Form data
const filterForm = reactive({})

const startDate = ref(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
const endDate = ref(new Date().toISOString().split('T')[0])
const selectedProvider = ref('')
const loading = ref(false)
const showModal = ref(false)
const editingAccount = ref(null)
const currentProvider = ref('')
const newAccount = ref({})
const accounts = ref({ niutrans: [], deepl: [], tencent: [] })
const rangeStats = ref([])

const providers = ['niutrans', 'deepl', 'tencent']
const providerNames = {
  niutrans: '🐂 小牛翻译',
  deepl: '🔷 DeepL',
  tencent: '☁️ 腾讯云'
}

const totalStats = computed(() => {
  return rangeStats.value.reduce(
    (sum, day) => ({
      chars: sum.chars + (day.chars || 0),
      calls: sum.calls + (day.calls || 0)
    }),
    { chars: 0, calls: 0 }
  )
})

const formatNumber = (num) => {
  return new Intl.NumberFormat('zh-CN').format(num)
}

const maskKey = (key) => {
  if (!key) return ''
  if (key.length <= 8) return '***'
  return key.substring(0, 4) + '***' + key.substring(key.length - 4)
}

const getStatusText = (status) => {
  // 状态映射：1=正常, 0=限额, 负数=禁用/错误
  switch (status) {
    case 1:
      return '正常'
    case 0:
      return '限额'
    case -1:
      return '禁用'
    case -2:
      return '错误'
    default:
      return '未知'
  }
}

const loadStats = async () => {
  loading.value = true
  try {
    const params = {
      startDate: startDate.value,
      endDate: endDate.value
    }
    if (selectedProvider.value) {
      params.provider = selectedProvider.value
    }

    const rangeRes = await httpApis.translationstatsrange({
      params
    })
    rangeStats.value = rangeRes

    for (const provider of providers) {
      if (selectedProvider.value && selectedProvider.value !== provider) continue

      const accountsRes = await httpApis.translationAccounts(provider)
      accounts.value[provider] = accountsRes

      // 账户数据已包含基于配置周期的 usage 和 calls 字段
      for (const account of accounts.value[provider]) {
        account.stats = {
          chars: account.usage || 0,
          calls: account.calls || 0
        }
      }
    }
  } catch (error) {
    console.error('Failed to load translation stats:', error)
  } finally {
    loading.value = false
  }
}

const showAddAccountModal = (provider) => {
  currentProvider.value = provider
  editingAccount.value = null
  newAccount.value = {}
  showModal.value = true
}

const showEditAccountModal = (provider, account) => {
  currentProvider.value = provider
  editingAccount.value = account
  newAccount.value = {
    name: account.name || '',
    description: account.description || '',
    quota: account.quota,
    period: account.period,
    rps: account.rps,
    region: account.region || '',
    cycleStart: account.cycleStart || null,
    cycleEnd: account.cycleEnd || null
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingAccount.value = null
  newAccount.value = {}
}

const addAccount = async () => {
  // 验证必填字段
  if (!newAccount.value.name || newAccount.value.name.trim() === '') {
    alert('请输入账户名称')
    return
  }

  try {
    await httpApis.translationAccountAdd(currentProvider.value, newAccount.value)
    closeModal()
    loadStats()
  } catch (error) {
    alert('添加失败: ' + (error.response?.data?.error || error.message))
  }
}

const updateAccount = async () => {
  // 验证必填字段
  if (!newAccount.value.name || newAccount.value.name.trim() === '') {
    alert('请输入账户名称')
    return
  }

  try {
    // 构建更新数据，只包含有值的字段
    const updateData = {
      name: newAccount.value.name,
      description: newAccount.value.description
    }

    // 添加凭据字段（如果有值）
    if (newAccount.value.appId?.trim()) {
      updateData.appId = newAccount.value.appId
    }
    if (newAccount.value.apiKey?.trim()) {
      updateData.apiKey = newAccount.value.apiKey
    }
    if (newAccount.value.secretId?.trim()) {
      updateData.secretId = newAccount.value.secretId
    }
    if (newAccount.value.secretKey?.trim()) {
      updateData.secretKey = newAccount.value.secretKey
    }

    // 添加配额设置（如果有值）
    if (newAccount.value.quota !== undefined && newAccount.value.quota !== null) {
      updateData.quota = newAccount.value.quota
    }
    if (newAccount.value.period) {
      updateData.period = newAccount.value.period
    }
    if (newAccount.value.rps !== undefined && newAccount.value.rps !== null) {
      updateData.rps = newAccount.value.rps
    }

    // 添加 region 字段（如果有值）
    if (newAccount.value.region !== undefined) {
      updateData.region = newAccount.value.region
    }

    // 添加自定义周期字段（如果有值）
    if (newAccount.value.cycleStart !== undefined && newAccount.value.cycleStart !== null) {
      updateData.cycleStart = newAccount.value.cycleStart
    }
    if (newAccount.value.cycleEnd !== undefined && newAccount.value.cycleEnd !== null) {
      updateData.cycleEnd = newAccount.value.cycleEnd
    }

    await httpApis.translationAccountUpdate(
      currentProvider.value,
      editingAccount.value.id,
      updateData
    )
    closeModal()
    loadStats()
  } catch (error) {
    alert('更新失败: ' + (error.response?.data?.error || error.message))
  }
}

const activateAccount = async (provider, accountId) => {
  if (confirm('确认激活此账户？')) {
    try {
      await httpApis.translationAccountActivate(provider, accountId)
      loadStats()
    } catch (error) {
      alert(`激活失败: ${error.response?.data?.error || error.message}`)
    }
  }
}

const deleteAccount = async (provider, accountId) => {
  if (confirm('确认删除此账户？此操作不可恢复！')) {
    try {
      await httpApis.translationAccountDelete(provider, accountId)
      loadStats()
    } catch (error) {
      alert(`删除失败: ${error.response?.data?.error || error.message}`)
    }
  }
}

// 页面加载时获取统计数据
loadStats()
</script>

<style scoped>
.translation-stats-view {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

@media (max-width: 640px) {
  .translation-stats-view {
    padding: 1rem;
  }
}

.header {
  margin-bottom: 2rem;
}

.glass-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(229, 231, 235, 0.5);
  margin-bottom: 1.5rem;
  transition: all 0.2s;
}

.dark .glass-card {
  background: rgba(31, 41, 55, 0.95);
  border-color: rgba(75, 85, 99, 0.5);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 2px 4px -1px rgba(0, 0, 0, 0.2);
}

.filters {
  margin-bottom: 1.5rem;
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

@media (max-width: 640px) {
  .filter-row {
    grid-template-columns: 1fr;
  }
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dark .filter-label {
  color: #d1d5db;
}

.input-wrapper {
  position: relative;
}

.input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  background: white;
  color: #1f2937;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.input:hover {
  border-color: #d1d5db;
}

.input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow:
    0 0 0 3px rgba(59, 130, 246, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.05);
}

.dark .input {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

.dark .input:hover {
  border-color: #6b7280;
}

.dark .input:focus {
  border-color: #60a5fa;
  box-shadow:
    0 0 0 3px rgba(96, 165, 250, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.05);
}

.input-date::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.input-date::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}

.dark .input-date::-webkit-calendar-picker-indicator {
  filter: invert(1);
}

.input-select {
  appearance: none;
  padding-right: 2.5rem;
  cursor: pointer;
}

.select-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 1.25rem;
  color: #6b7280;
  pointer-events: none;
  transition: all 0.2s;
}

.dark .select-icon {
  color: #9ca3af;
}

.input-select:focus ~ .select-icon {
  color: #3b82f6;
}

.dark .input-select:focus ~ .select-icon {
  color: #60a5fa;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(249, 250, 251, 0.5);
  border-radius: 12px;
  transition: all 0.2s;
}

.stat-item:hover {
  background: rgba(249, 250, 251, 0.8);
  transform: translateY(-2px);
}

.dark .stat-item {
  background: rgba(55, 65, 81, 0.3);
}

.dark .stat-item:hover {
  background: rgba(55, 65, 81, 0.5);
}

.stat-icon-wrapper {
  flex-shrink: 0;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.dark .stat-label {
  color: #9ca3af;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1f2937;
  line-height: 1.2;
}

.dark .stat-value {
  color: #f9fafb;
}

.provider-section {
  margin-bottom: 1.5rem;
}

.provider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.btn-add {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.btn-add:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

.accounts-table-wrapper {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.dark .accounts-table-wrapper {
  border-color: #4b5563;
}

.accounts-table {
  min-width: 100%;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 1rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.dark th,
.dark td {
  border-color: #374151;
}

th {
  font-weight: 600;
  color: #374151;
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #f9fafb;
  white-space: nowrap;
}

.dark th {
  color: #d1d5db;
  background: #1f2937;
}

td {
  color: #6b7280;
  font-size: 0.875rem;
}

.dark td {
  color: #9ca3af;
}

.hover-row {
  transition: background-color 0.15s;
}

.hover-row:hover {
  background-color: rgba(249, 250, 251, 0.5);
}

.dark .hover-row:hover {
  background-color: rgba(55, 65, 81, 0.3);
}

.sticky-col {
  position: sticky;
  left: 0;
  background: white;
  z-index: 1;
}

.dark .sticky-col {
  background: #1f2937;
}

.hover-row:hover .sticky-col {
  background-color: rgba(249, 250, 251, 0.5);
}

.dark .hover-row:hover .sticky-col {
  background-color: rgba(55, 65, 81, 0.3);
}

.account-name-cell {
  min-width: 150px;
}

.quota-cell {
  min-width: 180px;
}

.progress-bar {
  height: 6px;
  width: 100%;
  border-radius: 9999px;
  background: #e5e7eb;
  overflow: hidden;
}

.dark .progress-bar {
  background: #374151;
}

.progress-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.action-btn {
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn-edit {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.action-btn-edit:hover {
  background: rgba(59, 130, 246, 0.2);
  transform: scale(1.1);
}

.action-btn-activate {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.action-btn-activate:hover {
  background: rgba(16, 185, 129, 0.2);
  transform: scale(1.1);
}

.action-btn-delete {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.action-btn-delete:hover {
  background: rgba(239, 68, 68, 0.2);
  transform: scale(1.1);
}

.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  color: #9ca3af;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dark .modal-content {
  background: #1f2937;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: #1f2937;
}

.dark .modal-title {
  color: white;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.dark .form-group label {
  color: #d1d5db;
}

.form-group label.required::after {
  content: ' *';
  color: #ef4444;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 2rem;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f3f4f6;
  color: #374151;
}

.btn-cancel:hover {
  background: #e5e7eb;
}

.dark .btn-cancel {
  background: #374151;
  color: #d1d5db;
}

.dark .btn-cancel:hover {
  background: #4b5563;
}

.btn-confirm {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
}

.btn-confirm:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

.loading {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  z-index: 40;
  color: #6b7280;
}

.dark .loading {
  background: rgba(17, 24, 39, 0.9);
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

.dark .spinner {
  border-color: #374151;
  border-top-color: #60a5fa;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
