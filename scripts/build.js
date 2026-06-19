#!/usr/bin/env node
/**
 * build.js — yuanzehua.me 构建脚本
 *
 * 功能：
 *   1. 读取 content/posts/*.md 的 frontmatter，生成文章列表注入 index.html
 *   2. 读取 content/films.yml，生成电影轮播注入 index.html
 *   3. 生成 posts/*.html 文章详情页与 posts/index.html 文章列表页
 *
 * 用法：
 *   node scripts/build.js
 *
 * index.html 中需要有对应的注释锚点（已预留）：
 *   <!-- POSTS_START --> ... <!-- POSTS_END -->
 *   <!-- FILMS_START --> ... <!-- FILMS_END -->
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const POSTS_DIR  = path.join(ROOT, 'content', 'posts');
const POSTS_OUT  = path.join(ROOT, 'posts');
const FILMS_PATH = path.join(ROOT, 'content', 'films.yml');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITE_URL = 'https://yuanzehua.me';
const SHARE_IMAGE = `${SITE_URL}/assets/images/pets/loopi/v0-2/loopi-v0-2-source.png`;

// ── 1. Read posts ──────────────────────────────────────────────────────────

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) return {};
  const meta = {};
  match[1].split('\n').forEach(line => {
    const [k, ...v] = line.split(':');
    if (k && v.length) meta[k.trim()] = v.join(':').trim();
  });
  return meta;
}

function stripFrontmatter(raw) {
  return raw.replace(/^---\r?\n[\s\S]+?\r?\n---\r?\n?/, '');
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(str) {
  return escapeHTML(str)
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function markdownToHTML(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      return;
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      return;
    }
    paragraph.push(trimmed);
  });
  flushParagraph();
  return html.join('\n');
}

function formatDate(date) {
  return String(date).replace(/-/g, '.');
}

function renderPostPage(post) {
  const bodyHTML = markdownToHTML(stripFrontmatter(post.raw));
  const description = post.summary || 'Zane Hua 的文章。';
  return `<!DOCTYPE html>
<html lang="${post.lang || 'zh'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${escapeHTML(description)}">
<title>${escapeHTML(post.title)} · Zane Hua</title>
<link rel="canonical" href="${SITE_URL}${post.url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHTML(post.title)} · Zane Hua">
<meta property="og:description" content="${escapeHTML(description)}">
<meta property="og:url" content="${SITE_URL}${post.url}">
<meta property="og:image" content="${SHARE_IMAGE}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHTML(post.title)} · Zane Hua">
<meta name="twitter:description" content="${escapeHTML(description)}">
<meta name="twitter:image" content="${SHARE_IMAGE}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Noto+Serif+SC:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
:root {
  --ink:#1a1814; --paper:#f5f2ed; --mid:#8c8880; --light:#c8c4bc;
  --faint:#e4e0d8; --accent:#2d4a3e; --rule:rgba(26,24,20,0.10);
  --serif-en:'EB Garamond', Georgia, serif;
  --serif-cn:'Noto Serif SC', STSong, serif;
  --mono:'DM Mono', 'Courier New', monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:var(--serif-cn);font-weight:300;line-height:1.9;-webkit-font-smoothing:antialiased}
body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");background-size:200px;pointer-events:none;z-index:9999;opacity:.6}
.page{max-width:780px;margin:0 auto;padding:56px clamp(28px,6vw,72px) 72px}
.top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--rule);padding-bottom:22px;margin-bottom:64px}
.brand{font-family:var(--serif-en);font-size:15px;font-style:italic;color:var(--ink);text-decoration:none;letter-spacing:.08em}
.back{font-family:var(--mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--mid);text-decoration:none}
.back:hover{color:var(--ink)}
.meta{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--light);margin-bottom:20px}
article h1{font-family:var(--serif-cn);font-size:clamp(30px,4.4vw,42px);font-weight:400;line-height:1.32;letter-spacing:.02em;margin-bottom:42px}
article h2{font-family:var(--serif-cn);font-style:normal;font-size:clamp(21px,2.5vw,26px);font-weight:400;line-height:1.45;margin:68px 0 24px;color:var(--ink)}
article h3{font-size:18px;font-weight:400;margin:44px 0 16px}
article p{font-size:16px;line-height:2;margin:0 0 20px;color:var(--ink);font-weight:400}
article em{font-family:var(--serif-en);font-style:italic;color:var(--accent)}
article a{color:var(--accent);text-decoration:underline;text-decoration-color:rgba(45,74,62,.35);text-decoration-thickness:1px;text-underline-offset:4px}
article a:hover{text-decoration-color:var(--accent)}
article strong{font-weight:500}
article code{font-family:var(--mono);font-size:.9em;color:var(--accent)}
.footer{border-top:1px solid var(--rule);margin-top:64px;padding-top:28px;display:flex;justify-content:space-between;gap:24px;color:var(--light);font-family:var(--mono);font-size:10px;letter-spacing:.1em}
@media(max-width:640px){.page{padding-top:36px}.top{margin-bottom:44px}.footer{flex-direction:column}}
</style>
</head>
<body>
<main class="page">
  <div class="top">
    <a class="brand" href="/">Zane Hua</a>
    <a class="back" href="/#thinking">Back to home</a>
  </div>
  <article>
    <div class="meta">${formatDate(post.date)} · ${escapeHTML(post.tag)}</div>
${bodyHTML}
  </article>
  <div class="footer">
    <span>© 2026 Zane Hua</span>
    <span>yuanzehua.me</span>
  </div>
</main>
</body>
</html>`;
}

function renderPostsIndex(posts) {
  const listHTML = posts.length
    ? posts.map(p => `
      <a href="${p.url}">
        <span class="post-date">${formatDate(p.date)}</span>
        <span class="post-copy">
          <strong>${escapeHTML(p.title)}</strong>
          ${p.summary ? `<small>${escapeHTML(p.summary)}</small>` : ''}
        </span>
        <em>${escapeHTML(p.tag)}</em>
      </a>`).join('')
    : '<p class="empty">暂无文章。</p>';
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Zane Hua 的文章与阶段性思考。">
<title>Writing · Zane Hua</title>
<link rel="canonical" href="${SITE_URL}/posts/">
<meta property="og:type" content="website">
<meta property="og:title" content="Writing · Zane Hua">
<meta property="og:description" content="Zane Hua 的文章与阶段性思考。">
<meta property="og:url" content="${SITE_URL}/posts/">
<meta property="og:image" content="${SHARE_IMAGE}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Writing · Zane Hua">
<meta name="twitter:description" content="Zane Hua 的文章与阶段性思考。">
<meta name="twitter:image" content="${SHARE_IMAGE}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Noto+Serif+SC:wght@300;400;500&family=DM+Mono:wght@300;400&display=swap" rel="stylesheet">
<style>
:root{--ink:#1a1814;--paper:#f5f2ed;--mid:#8c8880;--light:#c8c4bc;--accent:#2d4a3e;--rule:rgba(26,24,20,.10);--serif-en:'EB Garamond',Georgia,serif;--serif-cn:'Noto Serif SC',STSong,serif;--mono:'DM Mono','Courier New',monospace}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:var(--serif-cn);font-weight:300;line-height:1.8;-webkit-font-smoothing:antialiased}
.page{max-width:860px;margin:0 auto;padding:56px clamp(28px,6vw,72px) 72px}
.top{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--rule);padding-bottom:22px;margin-bottom:72px}
.brand{font-family:var(--serif-en);font-size:15px;font-style:italic;color:var(--ink);text-decoration:none;letter-spacing:.08em}
.back{font-family:var(--mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--mid);text-decoration:none}
h1{font-family:var(--serif-en);font-size:clamp(42px,8vw,76px);font-weight:400;line-height:1;font-style:italic;margin-bottom:18px}
.sub{font-size:14px;color:var(--mid);margin-bottom:56px}
.list{display:flex;flex-direction:column;border-top:1px solid var(--rule)}
.list a{display:grid;grid-template-columns:110px 1fr auto;gap:28px;align-items:start;padding:28px 0;border-bottom:1px solid var(--rule);color:inherit;text-decoration:none}
.list a:hover strong{color:var(--accent)}
.post-date{font-family:var(--mono);font-size:10px;letter-spacing:.08em;color:var(--light)}
.post-copy{display:block}
.list strong{font-size:16px;font-weight:400;transition:color .2s}
.list small{display:block;margin-top:9px;font-size:13px;line-height:1.8;font-weight:400;color:var(--mid)}
.list em{font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-style:normal;color:var(--mid);border:1px solid var(--rule);padding:3px 8px}
.empty{color:var(--mid)}
@media(max-width:640px){.list a{grid-template-columns:1fr;gap:8px}.list em{width:max-content}}
</style>
</head>
<body>
<main class="page">
  <div class="top">
    <a class="brand" href="/">Zane Hua</a>
    <a class="back" href="/#thinking">Back to home</a>
  </div>
  <h1>Writing</h1>
  <p class="sub">思考不是结论的堆放，而是判断力的缓慢成形。</p>
  <div class="list">${listHTML}
  </div>
</main>
</body>
</html>`;
}

const posts = fs.readdirSync(POSTS_DIR)
  .filter(f => f.endsWith('.md') && !f.startsWith('YYYY'))   // skip template
  .map(f => {
    const raw  = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
    const meta = parseFrontmatter(raw);
    const slug = f.replace(/\.md$/, '');
    return {
      title: meta.title || slug,
      date:  meta.date  || '2025-01-01',
      tag:   meta.tag   || 'Note',
      lang:  meta.lang  || 'zh',
      summary: meta.summary || '',
      slug,
      url:   `/posts/${slug}.html`,
      raw,
    };
  })
  .filter(p => p.title)
  .sort((a, b) => b.date.localeCompare(a.date));

const homePosts = posts.slice(0, 5);  // 首页只展示最新 5 篇

const postsHTML = homePosts.length
  ? homePosts.map(p => {
      const dateStr = String(p.date).slice(0, 7).replace('-', '.');
      return `      <a href="${p.url}" class="thought-item reveal">
        <span class="thought-date">${dateStr}</span>
        <span class="thought-copy">
          <span class="thought-title">${escapeHTML(p.title)}</span>
          ${p.summary ? `<span class="thought-summary">${escapeHTML(p.summary)}</span>` : ''}
        </span>
        <span class="thought-tag">${escapeHTML(p.tag)}</span>
      </a>`;
    }).join('\n')
  : '      <!-- 暂无文章，在 content/posts/ 下新建 .md 文件 -->';

fs.mkdirSync(POSTS_OUT, { recursive: true });
posts.forEach(post => {
  fs.writeFileSync(path.join(POSTS_OUT, `${post.slug}.html`), renderPostPage(post), 'utf8');
});
fs.writeFileSync(path.join(POSTS_OUT, 'index.html'), renderPostsIndex(posts), 'utf8');

const sitemapURLs = [
  { loc: `${SITE_URL}/`, lastmod: posts[0]?.date },
  { loc: `${SITE_URL}/posts/`, lastmod: posts[0]?.date },
  { loc: `${SITE_URL}/pet-lab/` },
  { loc: `${SITE_URL}/pet-loop/reports/2026-06-15-loopi-v0-2.html`, lastmod: '2026-06-15' },
  ...posts.map(post => ({ loc: `${SITE_URL}${post.url}`, lastmod: post.date })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapURLs.map(item => `  <url>
    <loc>${item.loc}</loc>${item.lastmod ? `
    <lastmod>${item.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');

// ── 2. Read films ──────────────────────────────────────────────────────────

function parseYamlFilms(raw) {
  // 轻量 YAML 解析（只处理 films.yml 这一种固定格式）
  const films = [];
  const blocks = raw.split(/\n  - /).slice(1);
  blocks.forEach(block => {
    const get = key => {
      const m = block.match(new RegExp(`${key}:\\s*["']?([^"'\\n]+)["']?`));
      return m ? m[1].trim() : '';
    };
    films.push({
      title:    get('title'),
      title_en: get('title_en'),
      year:     get('year'),
      director: get('director'),
      score:    get('score'),
      color:    get('color') || '#e4e0d8',
      symbol:   get('symbol') || '◎',
      image:    get('image') || '',
    });
  });
  return films;
}

let filmsHTML = '';
if (fs.existsSync(FILMS_PATH)) {
  const raw   = fs.readFileSync(FILMS_PATH, 'utf8');
  const films = parseYamlFilms(raw);
  filmsHTML = films.map(f => {
    const posterInner = f.image
      ? `<img src="${f.image}" alt="${f.title}" width="160" height="228" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;">`
      : `<div class="film-poster-bg">${f.symbol}</div>`;
    const scoreHTML = f.score ? `\n            <span class="film-score">★ ${f.score}</span>` : '';
    return `
        <div class="film-card">
          <div class="film-poster" style="background:${f.color};">
            ${posterInner}
            <div class="film-poster-overlay"></div>${scoreHTML}
          </div>
          <span class="film-title">${f.title}</span>
          <span class="film-title-en">${f.title_en}</span>
          <span class="film-year">${f.year} · ${f.director}</span>
        </div>`;
  }).join('');
}

// ── 3. Inject into index.html ──────────────────────────────────────────────

let html = fs.readFileSync(INDEX_PATH, 'utf8');

// Posts
html = html.replace(
  /<!-- POSTS_START -->[\s\S]*?<!-- POSTS_END -->/,
  `<!-- POSTS_START -->\n${postsHTML}\n      <!-- POSTS_END -->`
);

// Films (optional)
if (filmsHTML) {
  html = html.replace(
    /<!-- FILMS_START -->[\s\S]*?<!-- FILMS_END -->/,
    `<!-- FILMS_START -->${filmsHTML}\n        <!-- FILMS_END -->`
  );
}

fs.writeFileSync(INDEX_PATH, html, 'utf8');

console.log(`✓ ${posts.length} post(s) injected`);
console.log(`✓ ${posts.length} post page(s) generated`);
console.log('✓ sitemap.xml generated');
if (filmsHTML) console.log(`✓ films injected`);
console.log('✓ index.html updated');
