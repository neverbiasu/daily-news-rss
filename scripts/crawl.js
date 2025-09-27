import { promises as fs } from 'fs'
import path from 'path'
import Parser from 'rss-parser'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const parser = new Parser({
	timeout: 10000,
	maxRedirects: 3
})

// Load sources
async function loadSources() {
	const sourcesPath = path.join(__dirname, '../sources.json')
	const sourcesData = await fs.readFile(sourcesPath, 'utf-8')
	const { theconversation_sources } = JSON.parse(sourcesData)

	return [...(theconversation_sources || [])]
}

// Extract domain from URL
function extractDomain(url) {
	try {
		return new URL(url).hostname.replace('www.', '')
	} catch {
		return 'unknown'
	}
}

// Clean and normalize title
function cleanTitle(title) {
	return title
		.replace(/\[.*?\]/g, '') // Remove [tags]
		.replace(/\(.*?\)/g, '') // Remove (parentheses)
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim()
}

// Main crawl function
async function crawlAllSources() {
	console.log('🤖 Starting crawl...')

	const sources = await loadSources()
	console.log(`Found ${sources.length} sources to crawl`)

	// Crawl all sources in parallel (but with some delay to be nice)
	const allArticles = []
	const crawlStats = { totalProcessed: 0, filtered: 0 }
	const batchSize = 5 // Process 5 sources at a time

	for (let i = 0; i < sources.length; i += batchSize) {
		const batch = sources.slice(i, i + batchSize)
		const promises = batch.map(source => crawlFeed(source, crawlStats))
		const results = await Promise.all(promises)

		for (const result of results) {
			if (result.articles) {
				allArticles.push(...result.articles)
			}
		}

		// Small delay between batches
		if (i + batchSize < sources.length) {
			await new Promise(resolve => setTimeout(resolve, 1000))
		}
	}

	// Remove duplicates
	const uniqueArticles = removeDuplicates(allArticles)

	// Sort by publication date (newest first)
	uniqueArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))

	console.log(`📰 Found ${uniqueArticles.length} unique articles`)
	console.log(`📊 Crawl stats: ${crawlStats.totalProcessed} processed → ${uniqueArticles.length} kept (${crawlStats.filtered} filtered)`)

	// Ensure data directory exists
	const dataDir = path.join(__dirname, '../data')
	await fs.mkdir(dataDir, { recursive: true })

	// Save raw crawled data
	const output = {
		crawledAt: new Date().toISOString(),
		totalSources: sources.length,
		totalArticles: uniqueArticles.length,
		articles: uniqueArticles
	}

	// Save only as latest-raw.json (no dated duplicates)
	const filepath = path.join(dataDir, 'latest-raw.json')
	await fs.writeFile(filepath, JSON.stringify(output, null, 2))
	console.log(`💾 Saved raw data to: latest-raw.json`)

	return uniqueArticles
}

// Crawl a single RSS feed with keyword-based filtering
async function crawlFeed(source, stats = null) {
	try {
		console.log(`Crawling: ${source.name}`)

		const articles = []

		// parse the feed url
		const feed = await parser.parseURL(source.url)
		console.log(`feed articles length: ${feed.items.length}`)

		// articles length limit
		const itemLimit = 10
		const items = feed.items.slice(0, itemLimit)
		console.log(`itemLimit: ${itemLimit} items length: ${items.length}`)

		for (const item of items) {
			const title = cleanTitle(item.title || '')
			const url = item.link || item.guid

			if (!title || !url) continue

			if (stats) stats.totalProcessed++

			// Extract description for filtering
			let description = ''
			if (item.contentSnippet) {
				description = item.contentSnippet.substring(0, 200)
			} else if (item.content) {
				description = item.content.replace(/<[^>]*>/g, '').substring(0, 200)
			} else if (item.summary) {
				description = item.summary.replace(/<[^>]*>/g, '').substring(0, 200)
			}

			// 15 days to align with cleanup
			const daysBack = 15
			const pubDate = new Date(item.pubDate || item.isoDate || item.published || Date.now())

			// Validate date - skip articles with invalid or future dates
			if (isNaN(pubDate.getTime())) {
				console.log(`⚠️ Invalid date for article: "${title.substring(0, 50)}..."`)
				continue
			}

			const now = new Date()
			if (pubDate > now) {
				console.log(`⚠️ Future date detected for article: "${title.substring(0, 50)}..." (${pubDate.toISOString()})`)
				// Use current time instead of future date
				pubDate.setTime(now.getTime())
			}

			const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
			if (pubDate < cutoffDate) continue

			articles.push({
				title: title,
				url: url,
				source: source.name,
				source_domain: extractDomain(url),
				source_category: source.category,
				source_priority: source.priority,
				pubDate: pubDate.toISOString(),
				metaDescription: description,

				// Will be filled by LLM processing
				category: null,
				difficulty: null,
				confidence: null,

				// Metadata
				crawledAt: new Date().toISOString(),
				id: generateId(title, url)
			})
		}

		console.log(`✓ ${source.name}: ${articles.length} articles found`)
		return { articles, stats }
	} catch (error) {
		console.error(`✗ Failed to crawl ${source.name}:`, error.message)
		return { articles: [], stats }
	}
}

// Generate unique ID for article
function generateId(title, url) {
	const content = title + url
	let hash = 0
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(36)
}

// Remove duplicates based on similarity
function removeDuplicates(articles) {
	const unique = []
	const seen = new Set()

	for (const article of articles) {
		// Create a normalized key for duplicate detection
		const key = article.title
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, '')
			.replace(/\s+/g, ' ')
			.trim()
			.split(' ')
			.slice(0, 8) // First 8 words
			.join(' ')

		if (!seen.has(key)) {
			seen.add(key)
			unique.push(article)
		}
	}

	return unique
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	crawlAllSources()
		.then(articles => {
			console.log(`✅ Crawl complete! Found ${articles.length} articles`)
		})
		.catch(error => {
			console.error('❌ Crawl failed:', error)
			process.exit(1)
		})
}

export { crawlAllSources }

