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

/**
 * Find existing PDF file in directory recursively
 * @param {string} directory - directory to search
 * @param {string} filename - filename to search for
 * @returns {Promise<string|null>} path to existing file or null
 */
async function findExistingPdfInDirectory(directory, filename) {
	try {
		if (!fs.existsSync(directory)) {
			return null
		}

		const items = await fs.readdir(directory)

		for (const item of items) {
			const itemPath = join(directory, item)
			const stat = await fs.stat(itemPath)

			if (stat.isDirectory()) {
				// recursively search subdirectories
				const found = await findExistingPdfInDirectory(itemPath, filename)
				if (found) {
					return found
				}
			} else if (item === filename) {
				// found the file
				return itemPath
			}
		}

		return null
	} catch (error) {
		console.error(`❌ Error searching for PDF: ${error.message}`)
		return null
	}
}

/**
 * Clean HTML content by removing specific tags and attributes
 * @param {string} htmlContent - raw HTML content
 * @returns {string} cleaned HTML content
 */
function cleanHtmlContent(htmlContent) {
	if (!htmlContent || typeof htmlContent !== 'string') {
		return htmlContent || ''
	}

	let cleanedContent = htmlContent

	// 1. Remove <a> tags but keep their content
	cleanedContent = cleanedContent.replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')

	// 2. Remove <em> tags but keep their content
	cleanedContent = cleanedContent.replace(/<em\b[^>]*>(.*?)<\/em>/gi, '$1')

	// 3. Remove srcset and sizes attributes from <img> tags
	cleanedContent = cleanedContent.replace(/<img([^>]*?)\s+srcset="[^"]*"([^>]*?)>/gi, '<img$1$2>')
	cleanedContent = cleanedContent.replace(/<img([^>]*?)\s+sizes="[^"]*"([^>]*?)>/gi, '<img$1$2>')

	// 4. Remove <figure> tags that contain <iframe> tags
	cleanedContent = cleanedContent.replace(/<figure[^>]*>[\s\S]*?<iframe[^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/figure>/gi, '')

	// 5. Hide images with alt="The Conversation" by adding display:none style
	cleanedContent = cleanedContent.replace(/<img([^>]*?)\s+alt="The Conversation"([^>]*?)>/gi, (match, before, after) => {
		// Check if style attribute already exists
		if (before.includes('style=') || after.includes('style=')) {
			// Add display:none to existing style
			return match.replace(/style="([^"]*)"/gi, 'style="$1; display:none;"')
		} else {
			// Add new style attribute with display:none
			return `<img${before} style="display:none;"${after}>`
		}
	})

	// 6. Add line breaks for better readability
	cleanedContent = cleanedContent
		.replace(/<\/p>/gi, '</p>\n') // Add line break after paragraphs
		.replace(/<\/h2>/gi, '</h2>\n') // Add line break after h2 headings
		.replace(/<\/h3>/gi, '</h3>\n') // Add line break after h3 headings
		.replace(/<\/figure>/gi, '</figure>\n') // Add line break after figures
		.replace(/<\/figcaption>/gi, '</figcaption>\n') // Add line break after figcaptions

	// 7. Clean up any extra whitespace but preserve intentional line breaks
	cleanedContent = cleanedContent
		.replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
		.replace(/\n\s+/g, '\n') // Remove spaces at start of lines
		.replace(/\s+\n/g, '\n') // Remove spaces at end of lines
		.replace(/\n{3,}/g, '\n\n') // Replace 3+ line breaks with 2
		.trim()

	return cleanedContent
}

/**
 * Get template mapping configuration
 * @returns {Object} template mapping object
 */
function getTemplateMapping() {
	return {
		'theconversation.com': 'theconversation-article-template.html'
	}
}

/**
 * Get template file path based on source domain
 * @param {string} sourceDomain - source domain of the article
 * @returns {string} template file path
 */
function getTemplatePath(sourceDomain) {
	const templateMapping = getTemplateMapping()

	// Get template filename, fallback to default
	const templateFilename = templateMapping[sourceDomain] || 'default-article-template.html'
	return join(__dirname, '..', 'templates', templateFilename)
}

const templateHTMLCache = new Map()

/**
 * Load HTML template from file with caching based on source domain
 * @param {string} sourceDomain - source domain of the article
 * @returns {string} HTML template content
 */
function loadHtmlTemplate(sourceDomain) {
	// Return cached template if available
	if (templateHTMLCache.has(sourceDomain)) {
		return templateHTMLCache.get(sourceDomain)
	}

	try {
		const templatePath = getTemplatePath(sourceDomain)

		// Check if template file exists
		if (!fs.existsSync(templatePath)) {
			throw new Error(`No available template found for ${sourceDomain}`)
		}

		const template = readFileSync(templatePath, 'utf8')
		templateHTMLCache.set(sourceDomain, template)
		console.log(`📄 HTML template loaded and cached for ${sourceDomain}`)
		return template
	} catch (error) {
		console.error(`❌ Failed to load HTML template for ${sourceDomain}:`, error.message)
		throw error
	}
}

/**
 * Generate HTML content from article data using external template based on source domain
 * @param {Object} article - article object
 * @returns {string} HTML content
 */
function generateHtmlContent(article) {
	// Load template based on source domain (cached for better performance)
	const sourceDomain = article.source_domain || 'unknown'
	const template = loadHtmlTemplate(sourceDomain)

	// Clean the HTML content
	const rawContent = article.content || article.metaDescription || 'No content available'
	const articleContent = cleanHtmlContent(rawContent)

	const byline = article.author || 'Unknown Author'

	// Replace template placeholders with actual data
	return template
		.replace('{{TITLE}}', article.title || 'Untitled Article')
		.replace('{{ARTICLE_TITLE}}', article.title || 'Untitled Article')
		.replace('{{BYLINE}}', byline)
		.replace('{{ARTICLE_CONTENT}}', articleContent)
}

async function htmlToPdf() {
	console.log('🚀 Starting HTML-to-PDF process...')

	const articles = getArticlesFromJson()
	console.log(`📖 Retrieved ${articles.length} articles`)

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

	// record start time
	const startTime = new Date()
	console.log(`\n🚀 HTML-to-PDF generation started at: ${formatTimestamp(startTime)}`)
	console.log(`📋 Processing ${articles.length} articles across ${Object.keys(articlesBySource).length} sources...`)

	try {
		console.log('[1/5] Launching Chromium …')

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

		const browser = await chromium.launch({ headless: true })

		// count success and failure
		let successCount = 0
		let failureCount = 0
		let skippedCount = 0
		const failedArticles = []

		// Process each source group
		for (const [sourceDomain, sourceArticles] of Object.entries(articlesBySource)) {
			console.log(`\n🔄 Processing source: ${sourceDomain} (${sourceArticles.length} articles)`)

			// Create date-based directory structure: pdfs/[source]/YYYY-MM-DD/
			const now = new Date()
			const dateStr = now.toISOString().slice(0, 10) // 2025-01-03 format
			const sourcePdfDir = join(outputDir, sourceDomain, dateStr)
			await fs.mkdir(sourcePdfDir, { recursive: true })

			console.log(`📁 PDF directory: ${sourceDomain}/${dateStr}/`)

			for (let i = 0; i < sourceArticles.length; i++) {
				const article = sourceArticles[i]

				console.log(`\nProcessing ${i + 1}/${sourceArticles.length} from ${sourceDomain}: ${article.title || 'Untitled'}`)

				try {
					const page = await browser.newPage()

					// Generate HTML content
					const htmlContent = generateHtmlContent(article)
					console.log(`[2/5] Generated HTML content using template for ${sourceDomain} (${htmlContent.length} characters)`)

					console.log('[3/5] Setting HTML content in browser...')
					await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' })
					console.log('[3/5] HTML content loaded successfully')

					// Wait for external CSS resources (fonts) to load
					console.log('[4/5] Waiting for external CSS resources to load...')
					try {
						// Wait for all stylesheets to load
						await page.waitForFunction(
							() => {
								const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
								if (stylesheets.length === 0) return true

								const loadedStylesheets = stylesheets.filter(link => {
									const isLoaded = link.sheet !== null
									if (!isLoaded) {
										console.log(`[4/5] Stylesheet still loading: ${link.href}`)
									}
									return isLoaded
								}).length

								console.log(`[4/5] CSS Progress: ${loadedStylesheets}/${stylesheets.length} stylesheets loaded`)
								return loadedStylesheets === stylesheets.length
							},
							{ timeout: 10000 }
						)
						console.log('[4/5] All CSS resources loaded successfully')
					} catch (error) {
						console.log('[4/5] Some CSS resources may not have loaded completely, continuing...')
						console.log(`[4/5] CSS Error: ${error.message}`)
					}

					// Wait for images to load
					console.log('[5/5] Waiting for images to load...')
					try {
						// Count images first
						const imageCount = await page.locator('img').count()
						console.log(`[5/5] Found ${imageCount} images to load`)

						if (imageCount > 0) {
							console.log('[5/5] Waiting for all images to complete loading...')
							await page.waitForFunction(
								() => {
									const images = Array.from(document.querySelectorAll('img'))
									if (images.length === 0) return true

									const loadedCount = images.filter(img => {
										const isLoaded = img.complete && img.naturalWidth > 0 && img.naturalHeight > 0
										if (!isLoaded) {
											console.log(`[5/5] Image still loading: ${img.src}`)
										}
										return isLoaded
									}).length

									console.log(`[5/5] Progress: ${loadedCount}/${images.length} images loaded`)
									return loadedCount === images.length
								},
								{ timeout: 30000 }
							)
							console.log('[5/5] All images loaded successfully')
						} else {
							console.log('[5/5] No images found in content')
						}
					} catch (error) {
						console.log('[5/5] Some images may not have loaded completely, continuing...')
						console.log(`[5/5] Error: ${error.message}`)
					}

					// Generate file name from URL path (same as url-to-pdf.js)
					const urlObj = new URL(article.url)
					const filename = urlObj.pathname.split('/').pop() || 'page'
					const cleanFilename = filename.replace(/[^a-zA-Z0-9\-_]/g, '_')
					const pdfPath = join(sourcePdfDir, `${cleanFilename}.pdf`)

					// Check if PDF already exists in sourceDomain directory
					const sourceDomainDir = join(outputDir, sourceDomain)
					const existingPdfPath = await findExistingPdfInDirectory(sourceDomainDir, `${cleanFilename}.pdf`)
					if (existingPdfPath) {
						console.log(`⏭️ PDF already exists, skipping: ${sourceDomain}/${path.relative(sourceDomainDir, existingPdfPath)}`)
						await page.close()
						skippedCount++
						console.log(`✅ Skipped existing PDF ${i + 1}/${sourceArticles.length} from ${sourceDomain}`)
						continue
					}

					// Generate PDF
					console.log('[6/6] Generating PDF file...')
					const pdfBuffer = await page.pdf({
						path: pdfPath,
						format: 'A4',
						printBackground: true,
						margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' }
					})

					console.log('[6/6] PDF generation completed')
					console.log(`✅ PDF saved: ${sourceDomain}/${dateStr}/${cleanFilename}.pdf (${(pdfBuffer.length / 1024).toFixed(1)} KB)`)
					await page.close()

					successCount++
					console.log(`✅ Successfully processed article ${i + 1}/${sourceArticles.length} from ${sourceDomain}`)
				} catch (articleError) {
					failureCount++
					failedArticles.push({
						title: article.title || 'Untitled',
						url: article.url,
						error: articleError.message,
						sourceDomain: sourceDomain
					})
					console.error(`❌ Failed to process article ${i + 1}/${sourceArticles.length} from ${sourceDomain}: ${article.title || 'Untitled'}`)
					console.error(`   ⚠️  Error: ${articleError.message}`)
					console.log(`   ⏭️  Skipping to next article...`)
				}
			}
		}

		await browser.close()

		// record end time
		const endTime = new Date()
		const totalDuration = calculateDuration(startTime, endTime)

		// output final summary
		console.log(`\n📊 Processing Summary:`)
		console.log(`✅ Successfully processed: ${successCount} articles`)
		console.log(`⏭️ Skipped existing files: ${skippedCount} articles`)
		console.log(`❌ Failed to process: ${failureCount} articles`)
		console.log(`📈 Success rate: ${(((successCount + skippedCount) / articles.length) * 100).toFixed(1)}%`)
		console.log(`📄 Total articles processed: ${articles.length}`)
		console.log(`📁 PDFs organized by ${Object.keys(articlesBySource).length} sources`)
		console.log(`\n⏰ Time Information:`)
		console.log(`🚀 Started at: ${formatTimestamp(startTime)}`)
		console.log(`🏁 Finished at: ${formatTimestamp(endTime)}`)
		console.log(`⏱️  Total duration: ${totalDuration}`)

		if (failedArticles.length > 0) {
			console.log(`\n🔍 Failed Articles Details:`)
			failedArticles.forEach((item, index) => {
				console.log(`   ${index + 1}. 📰 ${item.title}`)
				console.log(`      ⚠️  Error: ${item.error}`)
				console.log(`      🔗 URL: ${item.url}`)
				console.log(`      🌐 Source domain: ${item.sourceDomain}`)
			})
		}

		console.log(`\n🎉 HTML-to-PDF processing completed!`)
		return { successCount, skippedCount, failureCount, failedArticles, totalArticles: articles.length, startTime, endTime, duration: totalDuration }
	} catch (error) {
		console.error('❌ html-to-pdf processing error:', error)
		process.exit(1)
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	htmlToPdf()
		.then(result => {
			console.log(`\n🏁 html-to-pdf complete!`)
			console.log(`📊 Final Results:`)
			console.log(`   📄 Total articles: ${result.totalArticles}`)
			console.log(`   ✅ Success: ${result.successCount}`)
			console.log(`   ⏭️ Skipped: ${result.skippedCount}`)
			console.log(`   ❌ Failed: ${result.failureCount}`)
			console.log(`   📈 Success Rate: ${(((result.successCount + result.skippedCount) / result.totalArticles) * 100).toFixed(1)}%`)
			console.log(`   ⏱️  Total Duration: ${result.duration}`)
		})
		.catch(error => {
			console.error('❌ html-to-pdf failed:', error)
			process.exit(1)
		})
}

export { htmlToPdf }

