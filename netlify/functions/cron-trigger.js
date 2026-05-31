const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

const SUPABASE_URL = "https://abhrrwrclzginwwtirys.supabase.co";
const SUPABASE_KEY = "sb_publishable_e7MZt0br_4YIzt4b0TphNA_6RpIXYIh";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event) => {
    // 获取查询参数中的 rss URL
    const params = event.queryStringParameters || {};
    let rssUrl = params.rss;
    let name = params.name || "自定义源";

    if (!rssUrl) {
        // 如果没有提供参数，返回帮助信息
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Please provide ?rss=YOUR_RSS_URL" })
        };
    }

    try {
        const items = await fetchRss(rssUrl);
        let inserted = 0;
        for (const item of items) {
            const ok = await insertToSupabase(item.title, item.link, item.content);
            if (ok) inserted++;
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ inserted, source: name, url: rssUrl })
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};

async function fetchRss(url) {
    const protocol = url.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
        protocol.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(parseRss(data)); }
                catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

function parseRss(xml) {
    const items = [];
    const regex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        const itemXml = match[1];
        const title = extract(itemXml, "title");
        const link = extract(itemXml, "link");
        const pubDate = extract(itemXml, "pubDate");
        const desc = extract(itemXml, "description");
        if (title && link) {
            items.push({
                title,
                link,
                content: `发布时间：${pubDate}\n摘要：${desc}\n来源：RSS抓取`
            });
        }
    }
    return items;
}

function extract(xml, tag) {
    const re = new RegExp(`<${tag}>(.*?)</${tag}>|<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`, "i");
    const m = re.exec(xml);
    return m ? (m[1] || m[2] || "").trim() : "";
}

async function insertToSupabase(title, url, content) {
    const { error } = await supabase
        .from('search_engine')
        .upsert({ title, url, content }, { onConflict: 'url', ignoreDuplicates: true });
    if (error) {
        console.error("入库失败:", error);
        return false;
    }
    return true;
}
