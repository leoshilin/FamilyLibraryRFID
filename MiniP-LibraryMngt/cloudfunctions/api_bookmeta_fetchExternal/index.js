/**
 * 云函数：根据 ISBN 查询图书信息
 * 使用 douban 的 Html页面解析
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const https = require('https')
const cheerio = require('cheerio')

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''

      // 处理 301 / 302
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location
        return resolve(fetch(location))
      }
      res.on('data', chunk => (data += chunk))
      res.on('end', () => resolve(data))     
    }).on('error', err => {
      reject(err)
    })
  })
}

function parseInfo(html,isbn) {
  const $ = cheerio.load(html)

  // 书名
  const title = $('#wrapper h1 span').text().trim() || ''
  
  // 封面缩略图： douban版权保护，无法获取
  const cover_url = ''

  // info 区域
  const infoText = $('#info').text()
  
  const getField = (label) => {
    const reg = new RegExp(label + '[:：]\\s*([^\\n]+)')
    const match = infoText.match(reg)
    return match ? match[1].trim() : ''
  }

  const authors = getField('作者')
  const publisher = getField('出版社')
  const publishYear = getField('出版年')
  const price = getField('定价')
  const binding = getField('装帧')

  return {
    _version: 'v2',
    isbn,
    title,
    authors,
    publisher,
    publishYear,
    price,
    binding,
    cover_url,
    isSet: null,
    setTotalCount: null,
    setIndex: null,
    source: 'douban'
  }
}

exports.main = async (event) => {
  const { isbn } = event
  console.log(`getBookFromDouban params: isbn=${isbn}`)

  if (!isbn) {
    return { success: false, message: 'ISBN missing' }
  }

  const url = `https://book.douban.com/isbn/${isbn}/`

  try {
    const html = await fetch(url)
    const book = parseInfo(html,isbn)
  
    console.log(`getBookFromDouban done: book=${book}`)
    return {
      success: true,
      book
    }
  } catch (e) {
    return {
      success: false,
      error: e.message
    }
  }
}