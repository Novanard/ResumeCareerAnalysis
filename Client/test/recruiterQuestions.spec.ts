import { test, expect, type Page, type Route } from '@playwright/test'

const token = 'a'.repeat(43)
const path = `/shared/${token}`
const original = {
  schemaVersion: 1, fullName: 'Maya Cohen', headline: 'Developer', summary: null,
  contact: {}, skills: [{ name: 'React', category: 'Framework' }], experience: [],
  education: [], projects: [], languages: [], certifications: [], additionalSections: [],
}
const result = { answer: 'The profile lists React.', status: 'answered', sources: ['skills'], profileRevision: 1 }
async function mock(page: Page, question: (route: Route) => Promise<void>, version = () => 1) {
  await page.route('**/api/shared/profiles/**', async route => {
    if (route.request().method() === 'POST') return question(route)
    await route.fulfill({ json: { profile: { ...original, headline: version() === 1 ? 'Developer' : 'Updated developer' }, profileRevision: version() } })
  })
  await page.goto(path)
  await expect(page.getByRole('heading', { name: 'Maya Cohen' })).toBeVisible()
}

test('anonymous page, explicit suggestions, pending guard, sources, plain text and transcript clearing', async ({ page }) => {
  const bodies: unknown[] = []
  let finish: () => void = () => {}
  const pending = new Promise<void>(resolve => { finish = resolve })
  await mock(page, async route => {
    bodies.push(route.request().postDataJSON())
    await pending
    await route.fulfill({ json: { ...result, answer: '<img src=x onerror=alert(1)> React is listed.' } })
  })
  const input = page.getByRole('textbox', { name: 'Your question' })
  const send = page.getByRole('button', { name: 'Ask candidate profile', exact: true })
  await expect(send).toBeDisabled()
  await page.getByRole('button', { name: 'What technologies has this candidate used?' }).click()
  await expect(input).toHaveValue('What technologies has this candidate used?')
  expect(bodies).toHaveLength(0)
  await send.click()
  await expect(page.getByRole('button', { name: 'Generating answer...' })).toBeDisabled()
  await expect(input).toBeDisabled()
  expect(bodies).toEqual([{ question: 'What technologies has this candidate used?' }])
  finish()
  await expect(page.getByText('Sources: Skills')).toBeVisible()
  await expect(page.getByText('<img src=x onerror=alert(1)> React is listed.', { exact: false })).toBeVisible()
  await expect(page.locator('.question-transcript img')).toHaveCount(0)
  await expect(input).toHaveValue('')
  await page.reload()
  await expect(page.locator('.question-transcript li')).toHaveCount(0)
  await input.fill('Skills?')
  await send.click()
  await expect(page.locator('.question-transcript li')).toHaveCount(1)
  await page.getByRole('button', { name: 'New conversation' }).click()
  await expect(page.locator('.question-transcript li')).toHaveCount(0)
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([])
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => /question|transcript/i.test(key)))).toEqual([])
})

test('retry keeps question, preserves readable profile, and creates no duplicate exchanges', async ({ page }) => {
  let calls = 0
  await mock(page, async route => {
    calls++
    await route.fulfill(calls === 1
      ? { status: 502, json: { error: 'Unable to generate an answer. Please try again.' } }
      : { json: result })
  })
  const input = page.getByRole('textbox', { name: 'Your question' })
  await input.fill('Skills?')
  await page.getByRole('button', { name: 'Ask candidate profile', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Please try again')
  await expect(input).toHaveValue('Skills?')
  await expect(page.getByRole('heading', { name: 'Maya Cohen' })).toBeVisible()
  expect(calls).toBe(1)
  await page.getByRole('button', { name: 'Ask candidate profile', exact: true }).click()
  await expect(page.locator('.question-transcript li')).toHaveCount(1)
  expect(calls).toBe(2)
})

test('partial and unavailable answers have distinct labels and blank input cannot submit', async ({ page }) => {
  let calls = 0
  await mock(page, async route => {
    calls++
    await route.fulfill({ json: calls === 1
      ? { ...result, answer: 'React development is listed; leadership is unspecified.', status: 'partial' }
      : { ...result, answer: 'Kubernetes information is not available in the shared profile.', status: 'unavailable', sources: [] } })
  })
  const input = page.getByRole('textbox')
  await expect(input).toHaveAttribute('maxlength', '1000')
  await input.fill('   ')
  await expect(page.getByRole('button', { name: 'Ask candidate profile', exact: true })).toBeDisabled()
  expect(calls).toBe(0)
  for (const question of ['React leadership?', 'Kubernetes?']) {
    await input.fill(question)
    await page.getByRole('button', { name: 'Ask candidate profile', exact: true }).click()
    await expect(input).toHaveValue('')
  }
  await expect(page.getByText('Partially supported by the profile', { exact: true })).toBeVisible()
  await expect(page.getByText('Information unavailable in the profile', { exact: true })).toBeVisible()
  await expect(page.locator('.question-transcript li').last()).not.toContainText('Sources:')
})

test('revoked link clears profile and earlier answers', async ({ page }) => {
  let calls = 0
  await mock(page, async route => {
    calls++
    await route.fulfill(calls === 1 ? { json: result } : { status: 404, json: { error: 'Shared profile unavailable' } })
  })
  for (const question of ['Skills?', 'Education?']) {
    await page.getByRole('textbox', { name: 'Your question' }).fill(question)
    await page.getByRole('button', { name: 'Ask candidate profile', exact: true }).click()
    if (question === 'Skills?') await expect(page.locator('.question-transcript li')).toHaveCount(1)
  }
  await expect(page.getByRole('heading', { name: 'Shared profile unavailable' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Maya Cohen' })).toHaveCount(0)
  await expect(page.locator('.question-transcript li')).toHaveCount(0)
})

test('409 clears transcript, reloads current profile, and requires explicit resubmission', async ({ page }) => {
  let revision = 1
  let calls = 0
  await mock(page, async route => {
    calls++
    if (calls === 1) return route.fulfill({ json: result })
    revision = 2
    await route.fulfill({ status: 409, json: { error: 'Profile changed' } })
  }, () => revision)
  for (const question of ['Skills?', 'What experience?']) {
    await page.getByRole('textbox', { name: 'Your question' }).fill(question)
    await page.getByRole('button', { name: 'Ask candidate profile', exact: true }).click()
    if (question === 'Skills?') await expect(page.locator('.question-transcript li')).toHaveCount(1)
  }
  await expect(page.getByRole('alert')).toContainText('submit your question again')
  await expect(page.getByText('Updated developer', { exact: true })).toBeVisible()
  await expect(page.locator('.question-transcript li')).toHaveCount(0)
  await expect(page.getByRole('textbox')).toHaveValue('What experience?')
  expect(calls).toBe(2)
})

test('a successful answer on a newer revision refreshes profile and replaces stale answers', async ({ page }) => {
  let revision = 1
  let calls = 0
  await mock(page, async route => {
    calls++
    if (calls > 1) revision = 2
    await route.fulfill({ json: { ...result, profileRevision: revision } })
  }, () => revision)
  for (const question of ['Skills?', 'Which technologies?']) {
    await page.getByRole('textbox').fill(question)
    await page.getByRole('button', { name: 'Ask candidate profile', exact: true }).click()
    await expect(page.getByRole('textbox')).toHaveValue('')
  }
  await expect(page.getByText('Updated developer', { exact: true })).toBeVisible()
  await expect(page.locator('.question-transcript li')).toHaveCount(1)
  await expect(page.locator('.question-transcript')).toContainText('Which technologies?')
  await expect(page.locator('.question-transcript')).not.toContainText('Skills?')
})
