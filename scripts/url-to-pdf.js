import { promises as fs, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const outputDir = join(__dirname, '../pdfs')

/**
 * read article data from latest-raw.json file
 * @returns {Array} article array with full data
 */
function getArticlesFromJson() {
	try {
		const jsonPath = join(__dirname, '../data/latest-raw.json')
		const jsonData = readFileSync(jsonPath, 'utf8')
		const data = JSON.parse(jsonData)

		if (!data.articles || !Array.isArray(data.articles)) {
			throw new Error('JSON file does not contain articles array')
		}

		console.log(`📖 Read ${data.articles.length} articles from latest-raw.json`)
		return data.articles
	} catch (error) {
		console.error('❌ Failed to read latest-raw.json:', error.message)
		throw error
	}
}

/**
 * format timestamp for display using UTC time
 * @param {Date} date - Date object
 * @returns {string} formatted timestamp in UTC
 */
function formatTimestamp(date) {
	return (
		date.toLocaleString('en-US', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
			timeZone: 'UTC'
		}) + ' UTC'
	)
}

/**
 * calculate duration between two dates
 * @param {Date} start - start time
 * @param {Date} end - end time
 * @returns {string} formatted duration
 */
function calculateDuration(start, end) {
	const durationMs = end.getTime() - start.getTime()
	const seconds = Math.floor(durationMs / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m ${seconds % 60}s`
	} else if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`
	} else {
		return `${seconds}s`
	}
}

async function urlsToPdf() {
	const articles = getArticlesFromJson()

	if (!Array.isArray(articles) || articles.length === 0) {
		throw new Error('Articles must be a non-empty array')
	}

	// Group articles by source domain
	const articlesBySource = {}
	articles.forEach(article => {
		const sourceDomain = article.source_domain || 'unknown'
		if (!articlesBySource[sourceDomain]) {
			articlesBySource[sourceDomain] = []
		}
		articlesBySource[sourceDomain].push(article)
	})

	console.log(`\n📊 Articles grouped by source:`)
	Object.entries(articlesBySource).forEach(([source, articles]) => {
		console.log(`   📰 ${source}: ${articles.length} articles`)
	})

	// 记录开始时间
	const startTime = new Date()
	console.log(`\n🚀 PDF generation started at: ${formatTimestamp(startTime)}`)
	console.log(`📋 Processing ${articles.length} articles across ${Object.keys(articlesBySource).length} sources...`)

	try {
		console.log('[1/6] Launching Chromium …')

		// Check if Playwright browsers are installed, install if needed
		try {
			const testBrowser = await chromium.launch({ headless: true })
			await testBrowser.close()
			console.log('✅ Playwright browsers are ready')
		} catch (error) {
			if (error.message.includes("Executable doesn't exist")) {
				console.log('📦 Playwright browsers not found, installing...')
				console.log('⏳ This may take a few minutes...')
				const { execSync } = require('child_process')
				execSync('npx playwright install --with-deps chromium', {
					stdio: 'inherit',
					timeout: 300000 // 5 minutes timeout
				})
				console.log('✅ Playwright browsers installed successfully')
			} else {
				throw error
			}
		}

		const browser = await chromium.launch() // headless: false can be adjusted

		// count success and failure
		let successCount = 0
		let failureCount = 0
		const failedUrls = []

		// Process each source group
		for (const [sourceDomain, sourceArticles] of Object.entries(articlesBySource)) {
			console.log(`\n🔄 Processing source: ${sourceDomain} (${sourceArticles.length} articles)`)

			// Create source-specific PDF directory
			const sourcePdfDir = join(outputDir, sourceDomain)
			await fs.mkdir(sourcePdfDir, { recursive: true })

			for (let i = 0; i < sourceArticles.length; i++) {
				const article = sourceArticles[i]
				const url = article.url
				const refererUrl = `https://${sourceDomain}`

				console.log(`\nProcessing ${i + 1}/${sourceArticles.length} from ${sourceDomain}: ${url}`)

				try {
					const page = await browser.newPage({
						userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
						extraHTTPHeaders: { referer: refererUrl }
					})

					// Listen to all image requests, print status
					page.on('response', res => {
						const responseUrl = res.url()
						if (responseUrl.includes('images.theconversation.com/files')) {
							console.log(`[IMG] ${res.status()}  ${responseUrl.split('/').pop().split('?')[0]}`)
						}
					})

					// add retry mechanism
					let retryCount = 0
					const maxRetries = 2
					let pageLoaded = false

					while (retryCount <= maxRetries && !pageLoaded) {
						try {
							console.log(`[2/6] Navigating to target page (attempt ${retryCount + 1}/${maxRetries + 1}) …`)
							await page.goto(url, {
								waitUntil: 'domcontentloaded',
								timeout: 30000
							})
							pageLoaded = true
							console.log('[3/6] Page DOM loaded, starting lazy loading …')
						} catch (gotoError) {
							retryCount++
							if (retryCount <= maxRetries) {
								console.log(`⚠️  Navigation failed, retrying... (${retryCount}/${maxRetries})`)
								console.log(`   Error: ${gotoError.message}`)
								await page.waitForTimeout(2000) // wait 2 seconds before retrying
							} else {
								throw gotoError // retry count exceeded, throw error
							}
						}
					}

					// check if page is loaded properly
					const pageTitle = await page.title()
					console.log(`📄 Page title: ${pageTitle}`)

					// check if page content is long enough
					const bodyText = await page.textContent('body')
					if (bodyText.length < 100) {
						throw new Error('Page content seems too short, might not have loaded properly')
					}

					// Scroll to the bottom
					await page.evaluate(() => {
						window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
					})
					await page.waitForTimeout(10000)
					console.log('[4/6] Scrolling back to top, waiting for last image to appear in viewport …')
					await page.evaluate(() => window.scrollTo({ top: 0 }))

					// Wait for the last figure image
					let prev = 0,
						curr
					do {
						prev = curr || 0
						await page.waitForTimeout(3000)
						curr = await page.locator('figure img[src*="files"]').count()
						console.log(`[lazy] Current ${curr} images`)
					} while (curr > prev)

					console.log(`[5/6] Total ${curr} <figure> images rendered.`)

					// Generate file name
					const urlObj = new URL(url)
					const filename = urlObj.pathname.split('/').pop() || 'page'
					const cleanFilename = filename.replace(/[^a-zA-Z0-9\-_]/g, '_')
					const pdfPath = join(sourcePdfDir, `${cleanFilename}.pdf`)

					// Generate PDF
					console.log('[6/6] Generating PDF …')
					const pdfBuffer = await page.pdf({
						path: pdfPath,
						format: 'A4',
						printBackground: true,
						margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' }
					})

					console.log(`✅ PDF saved: ${sourceDomain}/${cleanFilename}.pdf (${(pdfBuffer.length / 1024).toFixed(1)} KB)`)
					await page.close()

					successCount++
					console.log(`✅ Successfully processed URL ${i + 1}/${sourceArticles.length} from ${sourceDomain}`)
				} catch (urlError) {
					failureCount++
					failedUrls.push({
						url,
						error: urlError.message,
						retryCount: retryCount || 0,
						sourceDomain: sourceDomain
					})
					console.error(`❌ Failed to process URL ${i + 1}/${sourceArticles.length} from ${sourceDomain}: ${url}`)
					console.error(`   ⚠️  Error: ${urlError.message}`)
					console.error(`   🔄 Retry attempts: ${retryCount || 0}`)
					console.log(`   ⏭️  Skipping to next URL...`)
				}
			}
		}

		await browser.close()

		// 记录结束时间
		const endTime = new Date()
		const totalDuration = calculateDuration(startTime, endTime)

		// output final summary
		console.log(`\n📊 Processing Summary:`)
		console.log(`✅ Successfully processed: ${successCount} URLs`)
		console.log(`❌ Failed to process: ${failureCount} URLs`)
		console.log(`📈 Success rate: ${((successCount / articles.length) * 100).toFixed(1)}%`)
		console.log(`📄 Total URLs processed: ${articles.length}`)
		console.log(`📁 PDFs organized by ${Object.keys(articlesBySource).length} sources`)
		console.log(`\n⏰ Time Information:`)
		console.log(`🚀 Started at: ${formatTimestamp(startTime)}`)
		console.log(`🏁 Finished at: ${formatTimestamp(endTime)}`)
		console.log(`⏱️  Total duration: ${totalDuration}`)

		if (failedUrls.length > 0) {
			console.log(`\n🔍 Failed URLs Details:`)
			failedUrls.forEach((item, index) => {
				console.log(`   ${index + 1}. 🔗 ${item.url}`)
				console.log(`      ⚠️  Error: ${item.error}`)
				console.log(`      🔄 Retry attempts: ${item.retryCount}`)
				console.log(`      🌐 Source domain: ${item.sourceDomain}`)
			})
		}

		console.log(`\n🎉 Processing completed!`)
		return { successCount, failureCount, failedUrls, totalUrls: articles.length, startTime, endTime, duration: totalDuration }
	} catch (error) {
		console.error('❌ url-to-pdf processing error:', error)
		process.exit(1)
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	// if (import.meta.url) {
	console.log(`import.meta.url: ${import.meta.url}`)
	urlsToPdf()
		.then(result => {
			console.log(`\n🏁 url-to-pdf complete!`)
			console.log(`📊 Final Results:`)
			console.log(`   📄 Total URLs: ${result.totalUrls}`)
			console.log(`   ✅ Success: ${result.successCount}`)
			console.log(`   ❌ Failed: ${result.failureCount}`)
			console.log(`   📈 Success Rate: ${((result.successCount / result.totalUrls) * 100).toFixed(1)}%`)
			console.log(`   ⏱️  Total Duration: ${result.duration}`)
		})
		.catch(error => {
			console.error('❌ url-to-pdf failed:', error)
			process.exit(1)
		})
}

export { urlsToPdf }

