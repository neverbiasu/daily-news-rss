// saveConversationLog.js
import { chromium } from 'playwright';

const URL = 'https://theconversation.com/how-sea-star-wasting-disease-transformed-the-west-coasts-ecology-and-economy-263253'

;(async () => {
	console.log('[1/6] 启动 Chromium …')
	const browser = await chromium.launch() // headless: false 可调
	const page = await browser.newPage({
		userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
		extraHTTPHeaders: { referer: 'https://theconversation.com' }
	})

	// 监听所有图片请求，打印状态
	page.on('response', res => {
		const url = res.url()
		if (url.includes('images.theconversation.com/files')) {
			console.log(`[IMG] ${res.status()}  ${url.split('/').pop().split('?')[0]}`)
		}
	})

	console.log('[2/6] 导航到目标页面 …')
	await page.goto(URL, { waitUntil: 'networkidle' })
	console.log('[3/6] 页面 DOM 加载完成，开始滚动触发懒加载 …')

	// 滚动到底
	await page.evaluate(() => {
		window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
	})
	await page.waitForTimeout(10000)
	console.log('[4/6] 滚动回顶部，等待最后一张图出现在视口 …')
	await page.evaluate(() => window.scrollTo({ top: 0 }))

	// 等最后一张 figure 配图
	let prev = 0,
		curr
	do {
		prev = curr || 0
		await page.waitForTimeout(1000)
		curr = await page.locator('figure img[src*="files"]').count()
		console.log(`[lazy] 当前 ${curr} 张`)
	} while (curr > prev)

	console.log(`[5/6] 共检测到 ${curr} 张 <figure> 图片已渲染。`)

	// 生成 PDF
	console.log('[6/6] 正在生成 PDF …')
	const pdfBuffer = await page.pdf({
		path: '../pdfs/sea-star-wasting.pdf',
		format: 'A4',
		printBackground: true,
		margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' }
	})

	console.log(`✅ PDF 已保存：sea-star-wasting.pdf (${(pdfBuffer.length / 1024).toFixed(1)} KB)`)
	await browser.close()
})()
