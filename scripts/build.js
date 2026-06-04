#!/usr/bin/env node
/**
 * build.js — yuanzehua.me 构建脚本
 *
 * 功能：
 *   1. 读取 content/posts/*.md 的 frontmatter，生成文章列表注入 index.html
 *   2. 读取 content/films.yml，生成电影轮播注入 index.html
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
const FILMS_PATH = path.join(ROOT, 'content', 'films.yml');

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
      slug,
      url:   `/posts/${slug}.html`,
    };
  })
  .filter(p => p.title)
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 5);  // 首页只展示最新 5 篇

const postsHTML = posts.length
  ? posts.map(p => {
      const dateStr = String(p.date).slice(0, 7).replace('-', '.');
      return `      <a href="${p.url}" class="thought-item reveal">
        <span class="thought-date">${dateStr}</span>
        <span class="thought-title">${p.title}</span>
        <span class="thought-tag">${p.tag}</span>
      </a>`;
    }).join('\n')
  : '      <!-- 暂无文章，在 content/posts/ 下新建 .md 文件 -->';

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
      ? `<img src="${f.image}" alt="${f.title}" style="width:100%;height:100%;object-fit:cover;display:block;">`
      : `<div class="film-poster-bg">${f.symbol}</div>`;
    return `
        <div class="film-card">
          <div class="film-poster" style="background:${f.color};">
            ${posterInner}
            <div class="film-poster-overlay"></div>
            <span class="film-score">★ ${f.score}</span>
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
if (filmsHTML) console.log(`✓ films injected`);
console.log('✓ index.html updated');
