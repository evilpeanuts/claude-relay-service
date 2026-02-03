// Migration script to add cycleStart and cycleEnd fields to existing translation accounts
const redis = require('../src/models/redis')
const { calculateCycleDates } = require('../src/services/translationQuotaService')

async function migrateAccounts() {
  console.log('=== Translation Account Cycle Migration ===\n')

  const providers = ['niutrans', 'deepl', 'tencent']
  let totalUpdated = 0
  let totalSkipped = 0

  try {
    for (const provider of providers) {
      console.log(`\nChecking ${provider} accounts...`)
      const pattern = `translation_account:${provider}:*`
      const keys = await redis.keys(pattern)

      if (keys.length === 0) {
        console.log(`  No ${provider} accounts found`)
        continue
      }

      for (const key of keys) {
        const data = await redis.get(key)
        const account = JSON.parse(data)
        const accountId = key.split(':')[2]

        // Check if account already has cycleStart/cycleEnd
        if (account.cycleStart && account.cycleEnd) {
          console.log(`  ✓ ${accountId}: Already has cycle dates, skipping`)
          totalSkipped++
          continue
        }

        // Check if account has cycleStartDay/cycleEndDay
        if (account.cycleStartDay && account.cycleEndDay) {
          // Calculate cycle dates from day numbers
          const cycleDates = calculateCycleDates(account)
          account.cycleStart = cycleDates.startDate
          account.cycleEnd = cycleDates.endDate

          // Save updated account
          await redis.set(key, JSON.stringify(account))
          console.log(
            `  ✓ ${accountId}: Added cycle dates ${account.cycleStart} → ${account.cycleEnd} (from days ${account.cycleStartDay}-${account.cycleEndDay})`
          )
          totalUpdated++
        } else {
          console.log(`  - ${accountId}: No custom cycle configured, skipping`)
          totalSkipped++
        }
      }
    }

    console.log('\n=== Migration Summary ===')
    console.log(`Total accounts updated: ${totalUpdated}`)
    console.log(`Total accounts skipped: ${totalSkipped}`)
    console.log('\n✅ Migration completed successfully!')
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    process.exit(0)
  }
}

// Run migration
migrateAccounts()
