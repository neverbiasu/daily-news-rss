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

// PDF path configuration - support environment variable and command line argument
const PDFS_DIR = process.env.PDFS_DIR || process.argv[2] || path.join(__dirname, '..', 'pdfs')

// check environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error('❌ error: please set the following environment variables:')
	console.error('   SUPABASE_URL - your Supabase project URL')
	console.error('   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key')
	console.error('   SUPABASE_BUCKET_NAME - bucket name (optional, default is "pdfs")')
	process.exit(1)
}

// create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

/**
 * recursively get all PDF files in the directory
 * @param {string} dir - directory path
 * @param {string} baseDir - base directory path
 * @returns {Array} PDF file path array
 */
function getAllPdfFiles(dir, baseDir = dir) {
	const files = []
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
				remotePath: relativePath.replace(/\\/g, '/'), // ensure using forward slash
				fileName: item, // save original file name
				size: stat.size
			})
		}
	}

	return files
}

/**
 * upload single PDF file to Supabase
 * @param {string} localPath - local file path
 * @param {string} remotePath - remote file path
 * @returns {Promise<boolean>} whether upload is successful
 */
async function uploadPdfFile(localPath, remotePath) {
	try {
		console.log(`📤 upload: ${remotePath}`)

		// read file
		const fileBuffer = fs.readFileSync(localPath)

		// upload to Supabase Storage
		const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(remotePath, fileBuffer, {
			contentType: 'application/pdf',
			upsert: true // if file exists, overwrite
		})

		if (error) {
			console.error(`❌ upload failed ${remotePath}:`, error.message)
			return false
		}

		console.log(`✅ upload success: ${remotePath}`)
		return true
	} catch (error) {
		console.error(`❌ upload error ${remotePath}:`, error.message)
		return false
	}
}

/**
 * check if bucket exists, if not, create it
 */
async function ensureBucketExists() {
	try {
		const { data: buckets, error: listError } = await supabase.storage.listBuckets()

		if (listError) {
			console.error('❌ get bucket list failed:', listError.message)
			return false
		}

		const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME)

		if (!bucketExists) {
			console.log(`📦 create bucket: ${BUCKET_NAME}`)
			const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
				public: false, // private bucket (recommended for security)
				fileSizeLimit: 50 * 1024 * 1024, // 50MB file size limit
				allowedMimeTypes: ['application/pdf']
			})

			if (error) {
				console.error('❌ create bucket failed:', error.message)
				return false
			}

			console.log(`✅ create bucket success: ${BUCKET_NAME}`)
		} else {
			console.log(`✅ bucket already exists: ${BUCKET_NAME}`)
		}

		return true
	} catch (error) {
		console.error('❌ check bucket failed:', error.message)
		return false
	}
}

// directory file cache - avoid duplicate API calls
const directoryCache = new Map()

async function fillDirectoryCache(pdfFiles) {
	const directoryPaths = new Set()
	for (const pdfFile of pdfFiles) {
		// extract directory path
		const directoryPath = path.dirname(pdfFile.remotePath)
		if (directoryPaths.has(directoryPath)) {
			continue
		}

		const { data: files, error } = await supabase.storage.from(BUCKET_NAME).list(directoryPath, {
			limit: 1000,
			offset: 0
		})

		if (error) {
			console.log(`⚠️ directory not found or get failed: ${directoryPath}`)
			directoryCache.set(directoryPath, [])
			directoryPaths.add(directoryPath)
		}

		// 缓存文件列表
		console.log(`📁 fill cache directory ${directoryPath}: ${files.length} files`)
		directoryCache.set(directoryPath, files)
		directoryPaths.add(directoryPath)
	}
}

/**
 * check if file exists (by directory) with caching
 */
async function checkFileExistsByCache(filePath, fileName) {
	try {
		// extract directory path
		const directoryPath = path.dirname(filePath)

		// check if the directory file list is already in the cache
		if (directoryCache.has(directoryPath)) {
			const cachedFiles = directoryCache.get(directoryPath)
			return cachedFiles.some(file => file.name === fileName)
		}
	} catch (error) {
		console.error('❌ check file exists failed:', error.message)
		return false
	}
}

/**
 * main function
 */
async function main() {
	console.log('🚀 start upload PDFs to Supabase...')
	console.log(`📁 bucket: ${BUCKET_NAME}`)

	// check bucket
	const bucketReady = await ensureBucketExists()
	if (!bucketReady) {
		process.exit(1)
	}

	// get PDFs directory path
	console.log(`📁 PDF directory: ${PDFS_DIR}`)

	if (!fs.existsSync(PDFS_DIR)) {
		console.error('❌ PDFs directory not found:', PDFS_DIR)
		console.error('💡 You can set PDFS_DIR environment variable or pass directory as argument')
		console.error('💡 Example: node scripts/upload-pdfs-to-supabase.js /path/to/pdfs')
		process.exit(1)
	}

	// get all PDF files
	console.log('🔍 scan PDF files...')
	const pdfFiles = getAllPdfFiles(PDFS_DIR)

	if (pdfFiles.length === 0) {
		console.log('ℹ️  no PDF files found')
		return
	} else {
		console.log(`📄 found ${pdfFiles.length} PDF files`)
	}

	// fill directory cache to check if file exist
	await fillDirectoryCache(pdfFiles)

	// concurrent control configuration
	const CONCURRENT_LIMIT = 3 // at most 3 files at a time
	const DELAY_BETWEEN_BATCHES = 200 // delay between batches 200ms

	// upload files
	let successCount = 0
	let skipCount = 0
	let errorCount = 0

	console.log(`🚀 start batch upload... (concurrent limit: ${CONCURRENT_LIMIT})`)

	// batch process files
	for (let i = 0; i < pdfFiles.length; i += CONCURRENT_LIMIT) {
		const batch = pdfFiles.slice(i, i + CONCURRENT_LIMIT)
		const batchNumber = Math.floor(i / CONCURRENT_LIMIT) + 1
		const totalBatches = Math.ceil(pdfFiles.length / CONCURRENT_LIMIT)

		console.log(`\n📦 process batch ${batchNumber}/${totalBatches} (${batch.length} files):`)

		// concurrent process current batch
		const batchPromises = batch.map(async (file, index) => {
			const fileIndex = i + index + 1
			console.log(`📄 process file ${fileIndex}/${pdfFiles.length}: ${file.fileName}`)

			try {
				// use directory check method with cache
				const fileExists = await checkFileExistsByCache(file.remotePath, file.fileName)
				if (fileExists) {
					console.log(`⏭️  skip existing file: ${file.remotePath}`)
					console.log(`   📄 file already exists in the directory, skip upload`)
					return { success: false, skip: true, error: false }
				}

				console.log(`📤 uploading: ${file.remotePath}`)
				const success = await uploadPdfFile(file.localPath, file.remotePath)
				if (success) {
					console.log(`✅ upload success: ${file.fileName}`)
					return { success: true, skip: false, error: false }
				} else {
					console.log(`❌ upload failed: ${file.fileName}`)
					return { success: false, skip: false, error: true }
				}
			} catch (error) {
				console.error(`❌ process file error ${file.fileName}:`, error.message)
				return { success: false, skip: false, error: true }
			}
		})

		// wait for current batch to complete
		const batchResults = await Promise.all(batchPromises)

		// statistics current batch result
		batchResults.forEach(result => {
			if (result.success) successCount++
			else if (result.skip) skipCount++
			else if (result.error) errorCount++
		})

		// delay between batches (except the last batch)
		if (i + CONCURRENT_LIMIT < pdfFiles.length) {
			console.log(`⏳ delay between batches ${DELAY_BETWEEN_BATCHES}ms...`)
			await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
		}
	}

	// output result statistics
	console.log('\n📊 upload completed statistics:')
	console.log(`✅ success upload: ${successCount} files`)
	console.log(`⏭️  skip files: ${skipCount} files`)
	console.log(`❌ failed files: ${errorCount} files`)
	console.log(`📄 total files: ${pdfFiles.length} files`)

	if (errorCount > 0) {
		console.log('\n⚠️  some files upload failed, please check the error information')
		process.exit(1)
	} else {
		console.log('\n🎉 all files upload completed!')
	}
}

// run main function
main().catch(error => {
	console.error('❌ program execution failed:', error)
	process.exit(1)
})
