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

loadEnvFile()

// config
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'pdfs'
const TABLE_NAME = process.env.SUPABASE_TABLE_NAME || 'test'
const argvPositional = process.argv.slice(2).filter(arg => !arg.startsWith('-'))
const PDFS_DIR = process.env.PDFS_DIR || argvPositional[0] || path.join(__dirname, '..', 'pdfs')
const DRY_RUN = (process.env.DRY_RUN === 'true') || process.argv.includes('--dry-run') || process.argv.includes('-d')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ error: please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// --- Helper: get all pdf files ---
function getAllPdfFiles(dir, baseDir = dir) {
  const files = []
  if (!fs.existsSync(dir)) return files
  const items = fs.readdirSync(dir)
  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...getAllPdfFiles(fullPath, baseDir))
    } else if (path.extname(item).toLowerCase() === '.pdf') {
      const relativePath = path.relative(baseDir, fullPath)
      files.push({ localPath: fullPath, remotePath: relativePath.replace(/\\/g, '/'), fileName: item, size: stat.size })
    }
  }
  return files
}

// --- upload helpers (from upload-pdfs-to-supabase.js) ---
async function ensureBucketExists() {
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    if (listError) {
      console.error('❌ get bucket list failed:', listError.message)
      return false
    }
    const bucketExists = buckets.some(b => b.name === BUCKET_NAME)
    if (!bucketExists) {
      console.log(`📦 create bucket: ${BUCKET_NAME}`)
      const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, { public: true, fileSizeLimit: 50 * 1024 * 1024, allowedMimeTypes: ['application/pdf'] })
      if (error) {
        console.error('❌ create bucket failed:', error.message)
        return false
      }
      console.log(`✅ create bucket success: ${BUCKET_NAME}`)
    } else {
      console.log(`✅ bucket already exists: ${BUCKET_NAME}`)
    }
    return true
  } catch (err) {
    console.error('❌ check bucket failed:', err.message)
    return false
  }
}

async function uploadPdfFile(localPath, remotePath) {
  try {
    console.log(`📤 upload: ${remotePath}`)
    const fileBuffer = fs.readFileSync(localPath)
    const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(remotePath, fileBuffer, { contentType: 'application/pdf', upsert: true })
    if (error) {
      console.error(`❌ upload failed ${remotePath}:`, error.message)
      return false
    }
    console.log(`✅ upload success: ${remotePath}`)
    return true
  } catch (err) {
    console.error(`❌ upload error ${remotePath}:`, err.message)
    return false
  }
}

// directory cache used for both upload and sync
const directoryCache = new Map()

async function fillDirectoryCache(pdfFiles) {
  const directoryPaths = new Set()
  for (const pdfFile of pdfFiles) {
    const directoryPath = path.dirname(pdfFile.remotePath)
    if (directoryPaths.has(directoryPath)) continue
    const { data: files, error } = await supabase.storage.from(BUCKET_NAME).list(directoryPath, { limit: 1000, offset: 0 })
    if (error) {
      console.log(`⚠️ directory not found or get failed: ${directoryPath}`)
      directoryCache.set(directoryPath, [])
      directoryPaths.add(directoryPath)
      continue
    }
    console.log(`📁 fill cache directory ${directoryPath}: ${files.length} files`)
    directoryCache.set(directoryPath, files)
    directoryPaths.add(directoryPath)
  }
}

function checkFileExistsByCache(filePath, fileName) {
  try {
    const directoryPath = path.dirname(filePath)
    if (directoryCache.has(directoryPath)) {
      const cachedFiles = directoryCache.get(directoryPath)
      return cachedFiles.some(f => f.name === fileName)
    }
    return false
  } catch (err) {
    console.error('❌ check file exists failed:', err.message)
    return false
  }
}

// matching helpers (from sync script)
function matchArticleByFilename(fileName, articles) {
  try {
    const cleanName = fileName.replace('.pdf', '').replace(/[_]/g, '-')
    for (const article of articles) {
      try {
        const urlObj = new URL(article.url)
        const urlPath = urlObj.pathname.split('/').pop() || ''
        const cleanUrlPath = urlPath.replace(/[^a-zA-Z0-9\-_]/g, '_')
        if (cleanName === cleanUrlPath || fileName.includes(cleanUrlPath) || cleanUrlPath.includes(cleanName)) {
          return article
        }
      } catch (e) { continue }
    }
    return null
  } catch (err) {
    console.error('❌ Error matching article:', err.message)
    return null
  }
}

function extractRegionFromSource(sourceName) {
  try {
    const sourcesPath = path.join(__dirname, '..', 'sources.json')
    if (!fs.existsSync(sourcesPath)) return 'unknown'
    const sourcesData = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'))
    for (const [key, arr] of Object.entries(sourcesData)) {
      if (Array.isArray(arr)) {
        const found = arr.find(s => s.name === sourceName)
        if (found && found.language) return found.language
      }
    }
    return 'unknown'
  } catch (err) { console.error('⚠️ Failed to extract region:', err.message); return 'unknown' }
}

function getFileUrlSync(filePath) {
  try {
    const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath)
    if (publicData && publicData.publicUrl) return publicData.publicUrl
    return filePath
  } catch (err) {
    console.error(`⚠️ Failed to get file URL for ${filePath}:`, err.message)
    return filePath
  }
}

async function getExistingFilePaths() {
  try {
    const { data, error } = await supabase.from(TABLE_NAME).select('filePath')
    if (error) { console.error('❌ Failed to get existing articles:', error.message); return new Set() }
    const paths = new Set(data.map(r => r.filePath).filter(Boolean))
    console.log(`📊 Found ${paths.size} existing articles in database`)
    return paths
  } catch (err) { console.error('❌ Error getting existing articles:', err.message); return new Set() }
}

async function insertArticleRecord(article, filePath) {
  try {
    const region = extractRegionFromSource(article.source)
    const fileUrl = getFileUrlSync(filePath)
    const record = { title: article.title, author: article.author || null, datePublished: article.pubDate, region, topic: article.source_category || 'unknown', filePath: fileUrl }
    if (DRY_RUN) { console.log('🔬 DRY RUN - would insert record:'); console.log(JSON.stringify(record, null, 2)); return true }
    const { data, error } = await supabase.from(TABLE_NAME).insert(record)
    if (error) { console.error(`❌ Failed to insert article "${article.title}":`, error.message); return false }
    console.log(`✅ Inserted article: ${article.title}`)
    return true
  } catch (err) { console.error('❌ Error inserting article:', err.message); return false }
}

// Main: upload then sync
async function main() {
  console.log('🚀 Starting upload-and-sync...')
  console.log(`📁 PDF directory: ${PDFS_DIR}`)
  if (!fs.existsSync(PDFS_DIR)) { console.error('❌ PDFs directory not found:', PDFS_DIR); process.exit(1) }

  // list local pdfs
  const pdfFiles = getAllPdfFiles(PDFS_DIR)
  console.log(`📄 Found ${pdfFiles.length} PDF files locally`)
  if (pdfFiles.length === 0) return console.log('ℹ️ No PDF files to upload/sync')

  // ensure bucket
  const ok = await ensureBucketExists()
  if (!ok) process.exit(1)

  // upload files (concurrent batches)
  const CONCURRENT_LIMIT = 3
  let uploadSuccess = 0, uploadSkip = 0, uploadFail = 0

  for (let i = 0; i < pdfFiles.length; i += CONCURRENT_LIMIT) {
    const batch = pdfFiles.slice(i, i + CONCURRENT_LIMIT)
    const results = await Promise.all(batch.map(async file => {
      try {
        // check if exists in storage cache (we'll fill cache later) - attempt upload anyway with upsert true
        const res = await uploadPdfFile(file.localPath, file.remotePath)
        return { success: res }
      } catch (e) { return { success: false } }
    }))
    results.forEach(r => r.success ? uploadSuccess++ : uploadFail++)
    if (i + CONCURRENT_LIMIT < pdfFiles.length) await new Promise(r => setTimeout(r, 200))
  }

  console.log(`📊 Upload finished. success=${uploadSuccess} failed=${uploadFail}`)

  // Build directory cache for sync
  await fillDirectoryCache(pdfFiles)

  // Load articles and existing DB paths
  const articles = (function(){
    try { const p = path.join(__dirname, '..', 'data', 'latest-raw.json'); return JSON.parse(fs.readFileSync(p,'utf8')).articles || [] } catch(e){ return [] }
  })()
  console.log(`✅ Loaded ${articles.length} articles from latest-raw.json`)

  const existingFilePaths = await getExistingFilePaths()

  // identify new articles
  const newArticles = []
  for (const pdfFile of pdfFiles) {
    const existsInStorage = checkFileExistsByCache(pdfFile.remotePath, pdfFile.fileName)
    if (!existsInStorage) continue
    const fileUrl = getFileUrlSync(pdfFile.remotePath)
    const article = matchArticleByFilename(pdfFile.fileName, articles)
    if (article && !existingFilePaths.has(fileUrl)) newArticles.push({ article, filePath: pdfFile.remotePath })
  }

  console.log(`📊 Found ${newArticles.length} new articles to insert`)

  let successCount = 0, failCount = 0
  for (let i = 0; i < newArticles.length; i++) {
    const { article, filePath } = newArticles[i]
    const ok = await insertArticleRecord(article, filePath)
    if (ok) {
      successCount++
    } else {
      failCount++
    }
    if (i < newArticles.length - 1) await new Promise(r => setTimeout(r, 100))
  }

  console.log('\n📊 Sync Summary:')
  console.log(`✅ Successfully inserted: ${successCount} articles`)
  console.log(`❌ Failed to insert: ${failCount} articles`)
  console.log(`📄 Total new articles: ${newArticles.length}`)
  console.log('🎉 upload-and-sync completed!')
}

main().catch(err => { console.error('❌ upload-and-sync failed:', err); process.exit(1) })
