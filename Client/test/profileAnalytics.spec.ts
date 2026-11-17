import { test, expect } from '@playwright/test'

const profile = {
  schemaVersion: 1, fullName: 'Dashboard Candidate', headline: null, summary: null,
  contact: {}, skills: [{ name: 'TypeScript', category: null }], education: [],
  languages: [], certifications: [], additionalSections: [],
  experience: [
    { company: 'Example', role: 'Developer', location: null, startDate: '2020', endDate: '2022-06', current: false, description: ['Built reporting tools.'] },
    { company: 'Other', role: 'Undated work', location: null, startDate: null, endDate: null, current: null, description: [] },
    { company: 'Invalid', role: 'Reversed dates', location: null, startDate: '2025-01', endDate: '2023-01', current: false, description: [] },
  ],
  projects: [
    { name: 'Reporting', description: 'Reporting project', technologies: ['React', 'TypeScript'], url: null },
    { name: 'Backend', description: '<img src=x onerror=alert(1)>', technologies: ['Node.js'], url: null },
  ],
}

test('timeline preserves date uncertainty and excludes missing or reversed ranges', async ({ page }) => {
  await page.route('**/api/shared/profiles/**', route => route.fulfill({ json: { profile, profileRevision: 7 } }))
  await page.goto(`/shared/${'a'.repeat(43)}`)
  await expect(page.getByText('Saved version 7')).toBeVisible()
  await expect(page.locator('.career-bar')).toHaveCount(1)
  await expect(page.locator('.career-bar')).toHaveClass(/is-approximate/)
  await page.getByText('Employment dates and details (3)').click()
  await expect(page.getByRole('row', { name: /Undated work/ })).toContainText('not plotted')
  await expect(page.getByRole('row', { name: /Reversed dates/ })).toContainText('not plotted')
  await expect(page.getByRole('row', { name: /Developer · Example/ })).toContainText('2020 → 2022-06')
})

test('sunburst supports keyboard drill-down, plain text, and all ten capability descriptions', async ({ page }) => {
  await page.route('**/api/shared/profiles/**', route => route.fulfill({ json: { profile, profileRevision: 1 } }))
  await page.goto(`/shared/${'a'.repeat(43)}`)
  const button = page.getByRole('button', { name: 'Backend', exact: true })
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.stack-project-details article')).toHaveCount(1)
  await expect(page.locator('.stack-project-details')).toContainText('Node.js')
  await expect(page.locator('.stack-project-details')).toContainText('<img src=x onerror=alert(1)>')
  await expect(page.locator('.stack-project-details img')).toHaveCount(0)
  await page.getByRole('button', { name: 'All projects', exact: true }).click()
  await expect(page.locator('.stack-project-details article')).toHaveCount(2)
  await page.getByRole('button', { name: 'Explore all 10 visualization types' }).click()
  await expect(page.locator('.analytics-planned .analytics-card')).toHaveCount(8)
  await expect(page.getByRole('heading', { name: 'Pipeline funnel', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('empty profiles show missing information without fabricated charts or scores', async ({ page }) => {
  await page.route('**/api/shared/profiles/**', route => route.fulfill({ json: { profile: { ...profile, experience: [], projects: [] }, profileRevision: 1 } }))
  await page.goto(`/shared/${'a'.repeat(43)}`)
  await expect(page.getByText('No employment entries have a usable start and end date yet.')).toBeVisible()
  await expect(page.getByText('No projects are listed in the saved profile.')).toBeVisible()
  await expect(page.locator('.career-bar')).toHaveCount(0)
  await expect(page.locator('.stack-explorer svg')).toHaveCount(0)
})
