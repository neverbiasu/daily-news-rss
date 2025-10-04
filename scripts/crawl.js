import { promises as fs } from 'fs'
import path from 'path'
import Parser from 'rss-parser'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const parser = new Parser({
	timeout: 30000, // add timeout to 30 seconds
	maxRedirects: 5 // add max redirects to 5
})

// Load sources
async function loadSources() {
	const sourcesPath = path.join(__dirname, '../sources.json')
	const sourcesData = await fs.readFile(sourcesPath, 'utf-8')
	const sourcesJson = JSON.parse(sourcesData)

	// Extract all sources from the JSON structure
	const allSources = []
	for (const [sourceName, sourceArray] of Object.entries(sourcesJson)) {
		if (Array.isArray(sourceArray)) {
			// Add source identifier to each source
			sourceArray.forEach(source => {
				source.sourceIdentifier = sourceName
			})
			allSources.push(...sourceArray)
		}
	}

	return allSources
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

	// Group sources by sourceIdentifier
	const sourcesByGroup = {}
	sources.forEach(source => {
		const groupName = source.sourceIdentifier
		if (!sourcesByGroup[groupName]) {
			sourcesByGroup[groupName] = []
		}
		sourcesByGroup[groupName].push(source)
	})

	console.log(`📊 Source groups: ${Object.keys(sourcesByGroup).join(', ')}`)

	// Process each source group separately
	const allGroupResults = {}

	for (const [groupName, groupSources] of Object.entries(sourcesByGroup)) {
		console.log(`\n🔄 Processing source group: ${groupName}`)

		// Crawl all sources in this group
		const allArticles = []
		const crawlStats = { totalProcessed: 0, filtered: 0, failed: 0 }
		const batchSize = 3

		for (let i = 0; i < groupSources.length; i += batchSize) {
			const batch = groupSources.slice(i, i + batchSize)
			console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(groupSources.length / batchSize)}`)

			const promises = batch.map(source => crawlFeed(source, crawlStats))
			const results = await Promise.allSettled(promises)

			for (let j = 0; j < results.length; j++) {
				const result = results[j]
				const source = batch[j]

				if (result.status === 'fulfilled' && result.value.articles) {
					allArticles.push(...result.value.articles)
					console.log(`✅ ${source.name}: ${result.value.articles.length} articles`)
				} else {
					crawlStats.failed++
					console.error(`❌ ${source.name}: Failed to crawl`)
					if (result.status === 'rejected') {
						console.error(`   Error: ${result.reason.message}`)
					}
				}
			}

			// add delay between batches
			if (i + batchSize < groupSources.length) {
				console.log('⏳ Waiting 2 seconds before next batch...')
				await new Promise(resolve => setTimeout(resolve, 2000))
			}
		}

		// Remove duplicates for this group
		const uniqueArticles = removeDuplicates(allArticles)

		// Sort by publication date (newest first)
		uniqueArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))

		console.log(`\n📰 Group ${groupName}: Found ${uniqueArticles.length} unique articles`)
		console.log(`📊 Group stats: ${crawlStats.totalProcessed} processed → ${uniqueArticles.length} kept (${crawlStats.filtered} filtered, ${crawlStats.failed} failed)`)

		// Save data for this group
		const groupOutput = {
			crawledAt: new Date().toISOString(),
			sourceGroup: groupName,
			totalSources: groupSources.length,
			totalArticles: uniqueArticles.length,
			articles: uniqueArticles
		}

		// Create timestamp for filename (YYYY-MM-DD-HH format)
		const now = new Date()
		const timestamp = now.toISOString().slice(0, 13).replace('T', '-')

		// Ensure data directory exists for this group
		const groupDataDir = path.join(__dirname, '../data', groupName)
		await fs.mkdir(groupDataDir, { recursive: true })

		// Save with timestamp
		const filename = `${timestamp}-latest-raw.json`
		const filepath = path.join(groupDataDir, filename)
		await fs.writeFile(filepath, JSON.stringify(groupOutput, null, 2))
		console.log(`💾 Saved group data to: ${groupName}/${filename}`)

		allGroupResults[groupName] = {
			articles: uniqueArticles,
			stats: crawlStats,
			filepath: filepath
		}
	}

	// Create a combined summary
	const totalArticles = Object.values(allGroupResults).reduce((sum, result) => sum + result.articles.length, 0)
	console.log(`\n🎉 All groups processed! Total articles: ${totalArticles}`)

	// Create combined data for all articles
	const allCombinedArticles = []
	Object.values(allGroupResults).forEach(result => {
		allCombinedArticles.push(...result.articles)
	})

	// Sort combined articles by publication date (newest first)
	allCombinedArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))

	// Save combined data to data/latest-raw.json
	const combinedOutput = {
		crawledAt: new Date().toISOString(),
		totalSourceGroups: Object.keys(allGroupResults).length,
		totalSources: sources.length,
		totalArticles: allCombinedArticles.length,
		articles: allCombinedArticles
	}

	const combinedFilepath = path.join(__dirname, '../data/latest-raw.json')
	await fs.writeFile(combinedFilepath, JSON.stringify(combinedOutput, null, 2))
	console.log(`💾 Saved combined data to: latest-raw.json (${allCombinedArticles.length} articles)`)

	return allGroupResults
}

// Crawl a single RSS feed with keyword-based filtering
async function crawlFeed(source, stats = null) {
	let retryCount = 0
	const maxRetries = 2

	while (retryCount <= maxRetries) {
		try {
			console.log(`🔍 Crawling: ${source.name} - ${source.url} (attempt ${retryCount + 1}/${maxRetries + 1})`)

			const articles = []

			// parse the feed url with retry mechanism
			const feed = await parser.parseURL(source.url)
			console.log(`📄 Feed articles length: ${feed.items.length}`)

			// articles length limit
			const itemLimit = 2
			const items = feed.items.slice(0, itemLimit)
			console.log(`itemLimit: ${itemLimit} items length: ${items.length}`)

			for (const item of items) {
				const title = cleanTitle(item.title || '')
				const url = item.link || item.guid

				if (!title || !url) continue

				if (stats) stats.totalProcessed++

				// extract description for filtering
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
				if (pubDate < cutoffDate) {
					if (stats) stats.filtered++
					continue
				}

				articles.push({
					id: generateId(title, url),

					// article
					title: title,
					url: url,
					author: item.author || '',
					// content: item.content || '',
					pubDate: pubDate.toISOString(),
					metaDescription: description,
					crawledAt: new Date().toISOString(),

					// source
					source: source.name,
					source_domain: extractDomain(url),
					source_category: source.category,
					source_priority: source.priority
				})
			}

			console.log(`✅ ${source.name}: ${articles.length} articles found`)
			return { articles, stats }
		} catch (error) {
			retryCount++
			if (retryCount <= maxRetries) {
				console.log(`⚠️ Failed to crawl ${source.name}, retrying... (${retryCount}/${maxRetries})`)
				console.log(`   Error: ${error.message}`)
				// wait for a while before retrying
				await new Promise(resolve => setTimeout(resolve, 2000 * retryCount))
			} else {
				console.error(`❌ Failed to crawl ${source.name} after ${maxRetries + 1} attempts:`, error.message)
				return { articles: [], stats }
			}
		}
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
		.then(results => {
			const totalArticles = Object.values(results).reduce((sum, result) => sum + result.articles.length, 0)
			console.log(`✅ Crawl complete! Found ${totalArticles} articles across ${Object.keys(results).length} source groups`)

			// Print summary for each group
			Object.entries(results).forEach(([groupName, result]) => {
				console.log(`   📊 ${groupName}: ${result.articles.length} articles`)
			})
		})
		.catch(error => {
			console.error('❌ Crawl failed:', error)
			process.exit(1)
		})
}

export { crawlAllSources }

