#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load .env file
function loadEnvFile() {
	const envPath = path.join(__dirname, '..', '.env')
	if (!fs.existsSync(envPath)) {
		console.log('⚠️ .env file not found, using environment variables only')
		return
	}

	const envContent = fs.readFileSync(envPath, 'utf8')
	const lines = envContent.split('\n')

	for (const line of lines) {
		const trimmedLine = line.trim()
		if (trimmedLine && !trimmedLine.startsWith('#')) {
			const [key, ...valueParts] = trimmedLine.split('=')
			if (key && valueParts.length > 0) {
				const value = valueParts.join('=').trim()
				process.env[key.trim()] = value
			}
		}
	}
	console.log('✅ .env file loaded successfully')
}

// load environment variables
loadEnvFile()

// config
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'pdfs'
const TABLE_NAME = process.env.SUPABASE_TABLE_NAME || 'test'
const PDFS_DIR = process.env.PDFS_DIR || process.argv[2] || path.join(__dirname, '..', 'pdfs')

// check environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error('❌ error: please set the following environment variables:')
	console.error('   SUPABASE_URL - your Supabase project URL')
	console.error('   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key')
	console.error('   SUPABASE_BUCKET_NAME - bucket name (optional, default is "pdfs")')
	console.error('   SUPABASE_TABLE_NAME - table name (optional, default is "test")')
	process.exit(1)
}

// create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

/**
 * Load articles from latest-raw.json
 * @returns {Array} articles array
 */
function loadArticlesFromJson() {
	try {
		const jsonPath = path.join(__dirname, '..', 'data', 'latest-raw.json')
		if (!fs.existsSync(jsonPath)) {
			console.error('❌ latest-raw.json not found')
			return []
		}

		const jsonData = fs.readFileSync(jsonPath, 'utf8')
		const data = JSON.parse(jsonData)

		if (!data.articles || !Array.isArray(data.articles)) {
			console.error('❌ Invalid JSON structure')
			return []
		}

		console.log(`✅ Loaded ${data.articles.length} articles from latest-raw.json`)
		return data.articles
	} catch (error) {
		console.error('❌ Failed to load articles:', error.message)
		return []
	}
}

/**
 * Get all PDF files recursively from directory
 * @param {string} dir - directory path
 * @param {string} baseDir - base directory path
 * @returns {Array} PDF file info array
 */
function getAllPdfFiles(dir, baseDir = dir) {
	const files = []
	
	if (!fs.existsSync(dir)) {
		return files
	}

	const items = fs.readdirSync(dir)

	for (const item of items) {
		const fullPath = path.join(dir, item)
		const stat = fs.statSync(fullPath)

		if (stat.isDirectory()) {
			files.push(...getAllPdfFiles(fullPath, baseDir))
		} else if (path.extname(item).toLowerCase() === '.pdf') {
			const relativePath = path.relative(baseDir, fullPath)
			files.push({
				localPath: fullPath,
				remotePath: relativePath.replace(/\\/g, '/'),
				fileName: item,
				size: stat.size
			})
		}
	}

	return files
}

/**
 * Build directory cache from Supabase Storage
 * @param {Array} pdfFiles - local PDF files
 * @returns {Map} directory cache map
 */
async function buildDirectoryCache(pdfFiles) {
	const directoryCache = new Map()
	const directoryPaths = new Set()

	console.log('🔍 Building directory cache from Supabase Storage...')

	for (const pdfFile of pdfFiles) {
		const directoryPath = path.dirname(pdfFile.remotePath)
		if (directoryPaths.has(directoryPath)) {
			continue
		}

		const { data: files, error } = await supabase.storage.from(BUCKET_NAME).list(directoryPath, {
			limit: 1000,
			offset: 0
		})

		if (error) {
			console.log(`⚠️ Directory not found or get failed: ${directoryPath}`)
			directoryCache.set(directoryPath, [])
		} else {
			console.log(`📁 Cached directory ${directoryPath}: ${files.length} files`)
			directoryCache.set(directoryPath, files)
		}

		directoryPaths.add(directoryPath)
	}

	return directoryCache
}

/**
 * Check if file exists in Supabase Storage using cache
 * @param {string} filePath - file path
 * @param {string} fileName - file name
 * @param {Map} directoryCache - directory cache
 * @returns {boolean} whether file exists
 */
function checkFileExistsByCache(filePath, fileName, directoryCache) {
	try {
		const directoryPath = path.dirname(filePath)

		if (directoryCache.has(directoryPath)) {
			const cachedFiles = directoryCache.get(directoryPath)
			return cachedFiles.some(file => file.name === fileName)
		}

		return false
	} catch (error) {
		console.error('❌ Check file exists failed:', error.message)
		return false
	}
}

/**
 * Match article by PDF filename
 * @param {string} fileName - PDF file name
 * @param {Array} articles - articles array
 * @returns {Object|null} matched article or null
 */
function matchArticleByFilename(fileName, articles) {
	try {
		// Remove .pdf extension and convert underscores back to potential URL characters
		const cleanName = fileName.replace('.pdf', '').replace(/[_]/g, '-')

		// Try to find matching article by URL path
		for (const article of articles) {
			try {
				const urlObj = new URL(article.url)
				const urlPath = urlObj.pathname.split('/').pop() || ''
				const cleanUrlPath = urlPath.replace(/[^a-zA-Z0-9\-_]/g, '_')

				// Match if the cleaned filename matches the cleaned URL path
				if (cleanName === cleanUrlPath || fileName.includes(cleanUrlPath) || cleanUrlPath.includes(cleanName)) {
					return article
				}
			} catch (urlError) {
				// Skip invalid URLs
				continue
			}
		}

		return null
	} catch (error) {
		console.error('❌ Error matching article:', error.message)
		return null
	}
}

/**
 * Extract region from sources.json
 * @param {string} sourceName - source name from article
 * @returns {string} region/language code
 */
function extractRegionFromSource(sourceName) {
	try {
		const sourcesPath = path.join(__dirname, '..', 'sources.json')
		if (!fs.existsSync(sourcesPath)) {
			return 'unknown'
		}

		const sourcesData = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'))

		// Search through all sources
		for (const [sourceKey, sourceArray] of Object.entries(sourcesData)) {
			if (Array.isArray(sourceArray)) {
				const found = sourceArray.find(s => s.name === sourceName)
				if (found && found.language) {
					return found.language
				}
			}
		}

		return 'unknown'
	} catch (error) {
		console.error('⚠️ Failed to extract region:', error.message)
		return 'unknown'
	}
}

/**
 * Get public URL for a file in Supabase Storage
 * @param {string} filePath - file path in storage
 * @returns {string} public URL or signed URL
 */
function getFileUrl(filePath) {
	try {
		// Try to get public URL first
		const { data: publicData } = supabase.storage
			.from(BUCKET_NAME)
			.getPublicUrl(filePath)
		
		if (publicData && publicData.publicUrl) {
			return publicData.publicUrl
		}

		// If bucket is private, return the path (will need signed URL on read)
		return filePath
	} catch (error) {
		console.error(`⚠️ Failed to get file URL for ${filePath}:`, error.message)
		return filePath
	}
}

/**
 * Insert article record into Supabase database
 * @param {Object} article - article object
 * @param {string} filePath - PDF file path in Supabase Storage
 * @returns {Promise<boolean>} success status
 */
async function insertArticleRecord(article, filePath) {
	try {
		const region = extractRegionFromSource(article.source)
		
		// Get the file URL (public URL if bucket is public, or path for signed URL)
		const fileUrl = getFileUrl(filePath)
		
		const record = {
			id: article.id,
			title: article.title,
			author: article.author || null,
			date_published: article.pubDate,
			region: region,
			topic: article.source_category || 'unknown',
			file_path: fileUrl  // Store the full URL or path
		}

		const { data, error } = await supabase
			.from(TABLE_NAME)
			.upsert(record, {
				onConflict: 'id'
			})

		if (error) {
			console.error(`❌ Failed to insert article "${article.title}":`, error.message)
			return false
		}

		console.log(`✅ Inserted article: ${article.title}`)
		console.log(`   📎 File URL: ${fileUrl}`)
		return true
	} catch (error) {
		console.error(`❌ Error inserting article:`, error.message)
		return false
	}
}

/**
 * Get existing article IDs from database
 * @returns {Promise<Set>} set of existing article IDs
 */
async function getExistingArticleIds() {
	try {
		const { data, error } = await supabase
			.from(TABLE_NAME)
			.select('id')

		if (error) {
			console.error('❌ Failed to get existing articles:', error.message)
			return new Set()
		}

		const ids = new Set(data.map(row => row.id))
		console.log(`📊 Found ${ids.size} existing articles in database`)
		return ids
	} catch (error) {
		console.error('❌ Error getting existing articles:', error.message)
		return new Set()
	}
}

/**
 * Main function
 */
async function main() {
	console.log('🚀 Starting sync new articles to database...')
	console.log(`📁 PDF directory: ${PDFS_DIR}`)
	console.log(`🗄️  Table name: ${TABLE_NAME}`)

	// Load articles from JSON
	const articles = loadArticlesFromJson()
	if (articles.length === 0) {
		console.log('ℹ️  No articles to process')
		return
	}

	// Get all local PDF files
	console.log('\n🔍 Scanning local PDF files...')
	const pdfFiles = getAllPdfFiles(PDFS_DIR)
	console.log(`📄 Found ${pdfFiles.length} PDF files locally`)

	if (pdfFiles.length === 0) {
		console.log('ℹ️  No PDF files found')
		return
	}

	// Build directory cache from Supabase Storage
	console.log('\n📦 Building cache from Supabase Storage...')
	const directoryCache = await buildDirectoryCache(pdfFiles)

	// Get existing article IDs from database
	console.log('\n🗄️  Checking existing articles in database...')
	const existingIds = await getExistingArticleIds()

	// Find new articles (PDFs that exist in Supabase Storage but not in database)
	console.log('\n🔍 Identifying new articles...')
	const newArticles = []

	for (const pdfFile of pdfFiles) {
		// Check if PDF exists in Supabase Storage
		const existsInStorage = checkFileExistsByCache(pdfFile.remotePath, pdfFile.fileName, directoryCache)

		if (existsInStorage) {
			// Match with article data
			const article = matchArticleByFilename(pdfFile.fileName, articles)

			if (article) {
				// Check if article already exists in database
				if (!existingIds.has(article.id)) {
					newArticles.push({
						article: article,
						filePath: pdfFile.remotePath
					})
				}
			} else {
				console.log(`⚠️  Could not match article for PDF: ${pdfFile.fileName}`)
			}
		}
	}

	console.log(`\n📊 Found ${newArticles.length} new articles to insert`)

	if (newArticles.length === 0) {
		console.log('✅ No new articles to sync')
		return
	}

	// Insert new articles into database
	console.log('\n💾 Inserting new articles into database...')
	let successCount = 0
	let failCount = 0

	for (let i = 0; i < newArticles.length; i++) {
		const { article, filePath } = newArticles[i]
		console.log(`\n[${i + 1}/${newArticles.length}] Processing: ${article.title}`)

		const success = await insertArticleRecord(article, filePath)
		if (success) {
			successCount++
		} else {
			failCount++
		}

		// Add small delay to avoid rate limiting
		if (i < newArticles.length - 1) {
			await new Promise(resolve => setTimeout(resolve, 100))
		}
	}

	// Print summary
	console.log('\n📊 Sync Summary:')
	console.log(`✅ Successfully inserted: ${successCount} articles`)
	console.log(`❌ Failed to insert: ${failCount} articles`)
	console.log(`📄 Total new articles: ${newArticles.length}`)
	console.log(`📈 Success rate: ${((successCount / newArticles.length) * 100).toFixed(1)}%`)

	console.log('\n🎉 Sync completed!')
}

// Run main function
main().catch(error => {
	console.error('❌ Program execution failed:', error)
	process.exit(1)
})
