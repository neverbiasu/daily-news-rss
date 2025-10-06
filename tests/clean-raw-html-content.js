import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
 * Load HTML template from file
 * @param {string} sourceDomain - source domain of the article
 * @returns {string} HTML template content
 */
function loadHtmlTemplate(sourceDomain) {
	try {
		const templatePath = join(__dirname, '..', 'templates', 'theconversation-article-template.html')
		return readFileSync(templatePath, 'utf8')
	} catch (error) {
		console.error('❌ Failed to load HTML template:', error.message)
		throw error
	}
}

/**
 * Generate complete HTML content from article data
 * @param {Object} article - article object
 * @returns {string} complete HTML content
 */
function generateCompleteHtml(article) {
	// Load template
	const template = loadHtmlTemplate(article.source_domain || 'theconversation.com')

	// Clean the HTML content
	const rawContent = article.content || article.metaDescription || 'No content available'
	const articleContent = cleanHtmlContent(rawContent)

	// Create byline from author information
	const byline = article.author || 'Unknown Author'

	// Replace template placeholders with actual data
	return template
		.replace('{{TITLE}}', article.title || 'Untitled Article')
		.replace('{{ARTICLE_TITLE}}', article.title || 'Untitled Article')
		.replace('{{BYLINE}}', byline)
		.replace('{{ARTICLE_CONTENT}}', articleContent)
}

/**
 * Save HTML content to file
 * @param {string} htmlContent - HTML content to save
 * @param {string} filename - output filename
 * @returns {void}
 */
function saveHtmlToFile(htmlContent, filename) {
	try {
		const outputPath = join(__dirname, '..', 'output', filename)
		const outputDir = join(__dirname, '..', 'output')

		// Create output directory if it doesn't exist
		if (!existsSync(outputDir)) {
			mkdirSync(outputDir, { recursive: true })
		}

		writeFileSync(outputPath, htmlContent, 'utf8')
		console.log(`💾 HTML saved to: ${outputPath}`)
	} catch (error) {
		console.error('❌ Failed to save HTML file:', error.message)
	}
}

// Read the first article's content from latest-raw.json
try {
	const jsonPath = join(__dirname, '..', 'data', 'latest-raw.json')
	const jsonData = readFileSync(jsonPath, 'utf8')
	const data = JSON.parse(jsonData)

	if (data.articles && data.articles.length > 0) {
		const firstArticle = data.articles[0]
		const rawHtmlContent = firstArticle.content || ''

		console.log('📖 Reading first article from latest-raw.json:')
		console.log(`📰 Title: ${firstArticle.title}`)
		console.log(`🔗 URL: ${firstArticle.url}`)
		console.log(`👤 Author: ${firstArticle.author}`)
		console.log(`🌐 Source Domain: ${firstArticle.source_domain}`)

		console.log(`\n📝 Original HTML Content (first 500 chars):`)
		console.log(rawHtmlContent.substring(0, 500) + '...')

		console.log(`\n✨ Cleaned HTML Content (first 500 chars):`)
		const cleanedContent = cleanHtmlContent(rawHtmlContent)
		console.log(cleanedContent.substring(0, 500) + '...')

		// Test the new functionality with a sample img tag
		console.log(`\n🧪 Testing "The Conversation" img hiding functionality:`)
		const testHtml = '<p>Some content</p><img src="test.jpg" alt="The Conversation" width="1" height="1"><p>More content</p>'
		const testResult = cleanHtmlContent(testHtml)
		console.log(`Original: ${testHtml}`)
		console.log(`Cleaned: ${testResult}`)

		console.log(`\n🏗️ Generating complete HTML structure...`)
		const completeHtml = generateCompleteHtml(firstArticle)

		console.log(`📊 Complete HTML stats:`)
		console.log(`   📄 Total length: ${completeHtml.length} characters`)
		console.log(`   📝 Title: ${firstArticle.title}`)
		console.log(`   👤 Author: ${firstArticle.author}`)
		console.log(`   📅 Published: ${firstArticle.pubDate}`)

		// Save complete HTML to file
		const filename = `article-${firstArticle.id || 'sample'}.html`
		saveHtmlToFile(completeHtml, filename)

		console.log(`\n✅ HTML generation completed!`)
		console.log(`📁 Output file: output/${filename}`)
		console.log(`🌐 You can open this file in a browser to preview the result`)
	} else {
		console.log('❌ No articles found in latest-raw.json')
	}
} catch (error) {
	console.error('❌ Error processing article:', error.message)
}
