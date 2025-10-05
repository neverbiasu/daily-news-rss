#!/usr/bin/env node

import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * read pdf config and validate
 */
function readPdfConfig() {
	try {
		const configPath = join(__dirname, '../config.json')
		const configData = readFileSync(configPath, 'utf8')
		const config = JSON.parse(configData)

		console.log('📋 PDF config info:')
		console.log(`   description: ${config.pdfGeneration.description}`)

		// Find the enabled method
		const enabledMethods = Object.entries(config.pdfGeneration.options).filter(([key, option]) => option.open === true)

		if (enabledMethods.length === 0) {
			console.log('   ⚠️ No PDF generation method is enabled')
			return config
		}

		// Select the first enabled method
		const [currentMethodKey, currentMethod] = enabledMethods[0]
		console.log(`   current method: ${currentMethod.name} (${currentMethodKey})`)
		console.log(`   script: ${currentMethod.script}`)

		if (enabledMethods.length > 1) {
			console.log(`   ℹ️ Multiple methods enabled, using first one: ${currentMethod.name}`)
		}

		return config
	} catch (error) {
		console.error('❌ read config file failed:', error.message)
		console.log('💡 please ensure config.json file exists and is formatted correctly')
		return null
	}
}

/**
 * show all available pdf generation methods
 */
function showAllMethods() {
	try {
		const configPath = join(__dirname, '../config.json')
		const configData = readFileSync(configPath, 'utf8')
		const config = JSON.parse(configData)

		console.log('\n📚 all available pdf generation methods:')
		Object.entries(config.pdfGeneration.options).forEach(([key, method], index) => {
			const isEnabled = method.open === true
			const enabledMethods = Object.entries(config.pdfGeneration.options).filter(([k, opt]) => opt.open === true)
			const isFirstEnabled = isEnabled && enabledMethods.length > 0 && enabledMethods[0][0] === key

			let status
			if (isFirstEnabled) {
				status = '✅ (enabled - selected)'
			} else if (isEnabled) {
				status = '✅ (enabled)'
			} else {
				status = '⚪ (disabled)'
			}

			console.log(`\n${status} ${method.name} (${key})`)
			console.log(`   script: ${method.script}`)
			console.log(`   command: npm run ${key}`)
		})
	} catch (error) {
		console.error('❌ show method list failed:', error.message)
	}
}

function main() {
	console.log('🔍 PDF config check tool')
	console.log('='.repeat(50))

	const config = readPdfConfig()
	if (config) {
		showAllMethods()

		console.log('\n💡 how to switch generation method:')
		console.log('   1. edit config.json file')
		console.log('   2. set "open": true for the method you want to use')
		console.log('   3. set "open": false for other methods')
		console.log('   4. save file and rerun workflow')

		// Find enabled method for test command
		const enabledMethods = Object.entries(config.pdfGeneration.options).filter(([key, option]) => option.open === true)

		if (enabledMethods.length > 0) {
			const [enabledKey] = enabledMethods[0]
			console.log('\n🚀 local test command:')
			console.log(`   npm run ${enabledKey}`)
		}
	}
}

// run main function
if (import.meta.url === `file://${process.argv[1]}`) {
	main()
} else {
	// if run script directly, also run main function
	main()
}

export { readPdfConfig, showAllMethods }

