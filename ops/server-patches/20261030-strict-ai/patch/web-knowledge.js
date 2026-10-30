import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AdminService } from './admin.js';
import { ensure, AppError } from './errors.js';
import { splitKnowledge } from './knowledge-import.js';
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const GLOBAL_WEB_POLICY = '__all_classes__';
export function sharedWebPolicy(store) { const saved=store.get('ai_web_policy',GLOBAL_WEB_POLICY);return {...saved,classId:GLOBAL_WEB_POLICY,enabled:saved?.enabled??true,domains:['mee.gov.cn'],website:'https://www.mee.gov.cn/',sourcePolicy:'uploaded_and_mee_only'}; }

const hostName = z.string().max(253).regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/);
const policySchema = z.object({ classId: id, domains: z.array(hostName).max(20), enabled: z.boolean() }).strict();
export function safeDomain(url,domains) {try {const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='mee.gov.cn'||u.hostname.endsWith('.mee.gov.cn'));}catch{return false}}

const blocked = new BlockList();
for (const [net, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]])
    blocked.addSubnet(net, prefix, 'ipv4');
export async function readPublicPage(url, domains) {
    ensure(safeDomain(url, domains), 400, 'WEB_URL_NOT_ALLOWED', '请使用已配置的 HTTPS 参考网站域名');
    const u = new URL(url);
    ensure(!isIP(u.hostname), 400, 'WEB_URL_NOT_ALLOWED', '不允许 IP 地址');
    const addresses = await Promise.race([lookup(u.hostname, { all: true, family: 4 }), new Promise((_, reject) => { const timer = setTimeout(() => reject(new AppError(502, 'WEB_FETCH_FAILED', '网站解析超时')), 8000); timer.unref(); })]);
    ensure(addresses.length > 0 && addresses.every(a => !blocked.check(a.address, 'ipv4')), 400, 'WEB_ADDRESS_BLOCKED', '网站地址不可访问');
    const address = addresses[0].address;
    return await new Promise((resolve, reject) => {
        const req = request(u, { method: 'GET', headers: { 'Accept': 'text/html,text/plain', 'User-Agent': 'CourseReferenceReader/1.0' }, lookup: (_h, _o, cb) => cb(null, address, 4), timeout: 8000 }, res => {
            if (res.statusCode !== 200) {
                res.resume();
                reject(new AppError(502, 'WEB_FETCH_FAILED', '网站读取失败或要求跳转，请使用最终地址'));
                return;
            }
            const type = res.headers['content-type'] ?? '';
            if (!/^text\/(html|plain)(?:;|$)/i.test(type)) {
                res.resume();
                reject(new AppError(400, 'WEB_CONTENT_TYPE', '仅支持网页文本'));
                return;
            }
            let bytes = 0;
            const chunks = [];
            res.on('data', (chunk) => { bytes += chunk.length; if (bytes > 1048576)
                req.destroy(new Error('网页过大'));
            else
                chunks.push(chunk); });
            res.on('error', () => reject(new AppError(502, 'WEB_FETCH_FAILED', '网页读取失败')));
            res.on('end', () => { try {
                const raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
                const text = type.toLowerCase().startsWith('text/html') ? raw.replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<!--([\s\S]*?)-->/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim() : raw.trim();
                ensure(text.length > 0 && text.length <= 300000, 400, 'WEB_PARSE_FAILED', '网页为空或文本过长');
                resolve(text);
            }
            catch {
                reject(new AppError(400, 'WEB_PARSE_FAILED', '无法读取网页文本，请检查编码和页面内容'));
            } });
        });
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', () => reject(new AppError(502, 'WEB_FETCH_FAILED', '网站读取失败')));
        req.end();
    });
}
function isPublicResultUrl(url) {
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && !u.username && !u.password && !u.port && !isIP(u.hostname) && hostName.safeParse(u.hostname).success && !u.hostname.endsWith('.local');
    }
    catch {
        return false;
    }
}
// Domain suffixes provide a conservative first-pass filter, not proof that a page is authoritative.
export const GOVERNMENT_DOMAINS = ['gov.cn', 'gov', 'gov.uk', 'gov.au', 'gc.ca', 'gouv.fr'];
export const PUBLIC_INSTITUTION_DOMAINS = ['edu.cn', 'ac.cn', 'edu', 'ac.uk', 'int'];
export async function searchOfficial(){return [];} // Third-party search summaries are not answer evidence.

export function webKnowledgeRoutes(app, core) {
    const admin = new AdminService(core);
    const ok = (res, data) => res.json({ ok: true, data, requestId: res.locals.requestId });
    app.get('/api/v1/admin/knowledge/web/:classId', (req, res) => { admin.require(res.locals.user); const classId = id.parse(req.params.classId); ensure(classId === GLOBAL_WEB_POLICY || core.store.get('class', classId), 404, 'CLASS_NOT_FOUND', '班级不存在'); ok(res, { ...(classId === GLOBAL_WEB_POLICY ? sharedWebPolicy(core.store) : ({...sharedWebPolicy(core.store),classId})), providerConfigured: true, provider: 'mee-cache', liveModelReady: false }); });
    app.put('/api/v1/admin/knowledge/web/:classId', (req, res) => { admin.require(res.locals.user); const classId = id.parse(req.params.classId), body = policySchema.parse(req.body); ensure(body.domains.every(d=>d==='mee.gov.cn'||d==='www.mee.gov.cn'),400,'MEE_ONLY','外部参考网站仅允许生态环境部官网 mee.gov.cn'); body.domains=['mee.gov.cn']; ensure(classId === body.classId && (classId === GLOBAL_WEB_POLICY || core.store.get('class', classId)), 404, 'CLASS_NOT_FOUND', '班级不存在'); ensure(body.domains.every(d => !isIP(d)) && new Set(body.domains).size === body.domains.length, 400, 'INVALID_DOMAIN', '域名无效或重复'); core.store.transaction(() => { core.store.put('ai_web_policy', classId, body); admin.audit(res.locals.user, 'knowledge.web.configure', classId); }); ok(res, body); });
    app.post('/api/v1/admin/knowledge/web/import', async (req, res) => { admin.require(res.locals.user); const b = z.object({ classId: id, title: z.string().trim().min(1).max(200), url: z.string().url().max(2000) }).strict().parse(req.body); ensure(b.classId === GLOBAL_WEB_POLICY || core.store.get('class', b.classId), 404, 'CLASS_NOT_FOUND', '班级不存在'); const p = sharedWebPolicy(core.store); ensure(p, 400, 'WEB_DOMAIN_REQUIRED', '请先配置参考网站域名'); const text = await readPublicPage(b.url, p.domains); const source = { id: randomUUID(), classId: b.classId, title: b.title, name: b.url, url: b.url, version: createHash('sha256').update(text).digest('hex'), state: 'draft', chunks: splitKnowledge(text), createdAt: new Date().toISOString() }; core.store.transaction(() => { core.store.put('ai_imported_source', source.id, source); admin.audit(res.locals.user, 'knowledge.web.import', source.id); }); ok(res, { ...source, chunks: source.chunks.slice(0, 3), chunkCount: source.chunks.length }); });
}
//# sourceMappingURL=web-knowledge.js.map