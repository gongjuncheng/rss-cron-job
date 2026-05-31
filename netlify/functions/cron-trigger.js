const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const parser = new Parser();

// Supabase配置（直接使用你的固定值）
const SUPABASE_URL = "https://abhrrwrclzginwwtirys.supabase.co";
const SUPABASE_KEY = "sb_publishable_e7MZt0br_4YIzt4b0TphNA_6RpIXYIh";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event) => {
    // 从查询参数中获取rss地址和名称
    const { rss: rssUrl, name = "自定义源" } = event.queryStringParameters || {};

    if (!rssUrl) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "请提供 ?rss=你的RSS地址" })
        };
    }

    try {
        // 使用rss-parser抓取并解析RSS
        const feed = await parser.parseURL(rssUrl);
        if (!feed.items || feed.items.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "RSS源中没有条目", inserted: 0 })
            };
        }

        let insertedCount = 0;
        for (const item of feed.items) {
            const title = item.title || "无标题";
            const link = item.link || "";
            if (!link) continue;
            const content = `标题：${title}\n链接：${link}\n摘要：${item.contentSnippet || ''}\n来源：${name}`;
            const { error } = await supabase
                .from('search_engine')
                .upsert({ title, url: link, content }, { onConflict: 'url', ignoreDuplicates: true });
            if (!error) insertedCount++;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ inserted: insertedCount, total: feed.items.length, source: name })
        };
    } catch (err) {
        console.error("抓取失败:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "RSS抓取或解析失败，请检查链接", detail: err.message })
        };
    }
};
