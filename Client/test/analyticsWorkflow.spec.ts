import { test, expect, type Page } from '@playwright/test'
import { analytics, profile } from './fixtures/analytics'

const token = 'a'.repeat(43)
async function shared(page: Page) {
  await page.route('**/api/shared/profiles/**', route => route.fulfill({ json: route.request().url().endsWith('/analytics')
    ? { profileRevision: 4, analytics: { content: analytics, revision: 2 } }
    : { profileRevision: 4, profile } }))
  await page.goto(`/shared/${token}`)
  await page.getByRole('button', { name: 'Explore all 10 visualization types' }).click()
}

test('profile-derived analytics populate all five candidate charts and dated projects', async ({ page }) => {
  await shared(page)
  await expect(page.getByText('Not available yet', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Timeline details: Project: Dashboard' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Recorded skill usage duration/ })).toBeVisible()
  await page.getByRole('button', { name: 'React · 6 months · ownership' }).click()
  await expect(page.getByText('Owned the frontend implementation.', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('-50 ms (-50.0% relative change)', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Evidence relationships' })).toBeVisible()
  await page.getByRole('button', { name: 'artifact: Load test report', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Open supporting artifact' })).toHaveAttribute('href', 'https://example.com/report')
  await expect(page.getByRole('img', { name: 'Candidate collaboration network' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('company views explain missing context and candidate analytics cannot be modified', async ({ page }) => {
  await shared(page)
  await expect(page.getByText('No company job rubric', { exact: false })).toBeVisible()
  await expect(page.getByText('No company screening criteria', { exact: false })).toBeVisible()
  await expect(page.getByText('No authorized company pipeline', { exact: false })).toBeVisible()
  await expect(page.locator('.profile-analytics input, .profile-analytics textarea, .profile-analytics select')).toHaveCount(0)
})

test('owner automatically sees read-only analytics without editor or additional approval', async ({ page }) => {
  const access = ['eyJhbGciOiJub25lIn0', Buffer.from(JSON.stringify({ sub: 'owner', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'test'].join('.')
  await page.addInitScript(({ access }) => localStorage.setItem('sb-analytics-test-auth-token', JSON.stringify({ access_token: access, refresh_token: 'test-refresh', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: 'owner', aud: 'authenticated', role: 'authenticated', email: 'owner@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' } })), { access })
  const analyticsMethods: string[] = []
  await page.route('**/api/**', async route => {
    const url = route.request().url()
    if (url.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'owner' } } })
    if (url.endsWith('/profile/draft')) return route.fulfill({ json: { draft: { id: 'draft', revision: 3, state: 'saved', content: profile, review_baseline: null, proposal: null, questions: [], base_profile_revision: 3 } } })
    if (url.endsWith('/profile/sharing')) return route.fulfill({ json: { sharing: { enabled: true, url: `/shared/${token}` } } })
    if (url.endsWith('/analytics')) {
      analyticsMethods.push(route.request().method())
      return route.fulfill({ json: { profileRevision: 4, analytics: { content: analytics, generatedAt: 'date', extractionVersion: 1, method: 'model' } } })
    }
    return route.fulfill({ status: 404, json: { error: 'Unexpected request' } })
  })
  await page.goto('/?page=profile')
  await expect(page.getByRole('heading', { name: 'Profile analytics' })).toBeVisible()
  await expect(page.getByText('No separate analytics approval is needed.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: /Approve.*analytics|Generate analytics|Save analytics/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Explore all 10 visualization types' }).click()
  await expect(page.getByText('-50 ms (-50.0% relative change)', { exact: true })).toBeVisible()
  await expect(page.locator('.own-profile-analytics input, .own-profile-analytics textarea, .own-profile-analytics select')).toHaveCount(0)
  expect(analyticsMethods.length).toBeGreaterThan(0)
  expect(analyticsMethods.every(method => method === 'GET')).toBe(true)
})
