const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

const SUPABASE_URL = "https://abhrrwrclzginwwtirys.supabase.co";
const SUPABASE_KEY = "sb_publishable_e7MZt0br_4YIzt4b0TphNA_6RpIXYIh";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const RSS_FEEDS = [
    { name: "必应-地理", url: "https://cn.bing.com/search?q=地理&format=rss" },
    { name: "必应-法律", url: "https://cn.bing.com/search?q=法律&format=rss" },
];

exports.handler = async function() {
    console.log("爬虫开始...");
    let total = 0;
    for (const feed of RSS_FEEDS) {
        try {
            const items = await fetchRss(feed.url);
            for (const item of items) {
                const ok = await insertToSupabase(item.title, item.link, item.content);
                if (ok) total++;
            }
        } catch(e) { console.error(feed.name, e); }
    }
    return { statusCode: 200, body: JSON.stringify({ inserted: total }) };
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
                content: `发布时间：${pubDate}\n摘要：${desc}\n来源：RSS自动抓取`
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
    console.log(`✅ 入库: ${title.slice(0,40)}`);
    return true;
}
