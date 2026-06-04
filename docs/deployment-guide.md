# yuanzehua.me 部署与内容维护完整指南

---

## 一、整体架构选型

### 推荐方案：静态站点生成器 + GitHub + Cloudflare Pages

```
本地编辑（Obsidian / VS Code）
        ↓  git push
  GitHub 仓库（yuanzehua.me）
        ↓  自动触发
  Cloudflare Pages 构建
        ↓  自动部署
  yuanzehua.me（全球 CDN）
```

**为什么选这套？**

| 维度 | 说明 |
|------|------|
| 费用 | 全程免费（Cloudflare Pages 免费额度完全够个人站） |
| 速度 | Cloudflare 全球 CDN，国内访问也快 |
| 维护 | 写完 Markdown 推送，网站自动更新，零运维 |
| 扩展 | 后续加评论、搜索、RSS 都有成熟方案 |
| 备份 | Git 仓库即是完整备份，历史可回溯 |

---

## 二、本地目录结构

```
yuanzehua.me/               ← 本地项目根目录（也是 Git 仓库）
│
├── index.html              ← 主页（当前文件，持续维护）
│
├── content/                ← 所有文字内容（纯 Markdown）
│   ├── about.md            ← 个人简介、时间轴数据
│   ├── work/               ← 成果与项目
│   │   ├── research.md
│   │   ├── projects.md
│   │   └── internship.md
│   ├── posts/              ← 博客文章（每篇一个文件）
│   │   ├── 2025-06-thinking-slow.md
│   │   ├── 2025-04-systems-thinking.md
│   │   └── ...
│   └── films.md            ← 电影片单（YAML 格式维护）
│
├── assets/
│   ├── images/             ← 图片资源
│   └── fonts/              ← 如需本地字体
│
├── scripts/
│   └── build.js            ← 构建脚本（把 content/ 注入 HTML）
│
├── .github/
│   └── workflows/
│       └── deploy.yml      ← GitHub Actions 自动部署配置
│
└── README.md
```

---

## 三、部署步骤（一次性配置）

### 步骤 1：注册 / 确认 Cloudflare 账号

前往 https://dash.cloudflare.com 注册，然后：
- 进入「Websites」→ 添加你的域名 `yuanzehua.me`
- Cloudflare 会给你两个 NS（Name Server）地址
- 去域名注册商（如 Namecheap / 腾讯云 / 阿里云）将 DNS 的 Nameserver 改为 Cloudflare 提供的两个地址
- 等待 DNS 生效（通常 5–30 分钟）

### 步骤 2：创建 GitHub 仓库

```bash
# 本地初始化
mkdir yuanzehua.me && cd yuanzehua.me
git init
git add .
git commit -m "init: personal homepage"

# 推送到 GitHub（先在 github.com 新建同名仓库）
git remote add origin git@github.com:yuanzehua/yuanzehua.me.git
git push -u origin main
```

### 步骤 3：连接 Cloudflare Pages

1. Cloudflare 控制台 → 「Pages」→「Create a project」
2. 选「Connect to Git」→ 授权 GitHub → 选择 `yuanzehua.me` 仓库
3. 构建设置：
   - **Framework preset**: None（纯静态）
   - **Build command**: 留空（或填 `node scripts/build.js`，见下文）
   - **Build output directory**: `/`（根目录）
4. 点击 Deploy

### 步骤 4：绑定自定义域名

Cloudflare Pages 项目设置 →「Custom domains」→ 添加 `yuanzehua.me`
- Cloudflare 会自动配置 DNS 解析和 HTTPS 证书
- 同时建议添加 `www.yuanzehua.me` 并设置重定向到主域

---

## 四、内容维护工作流

### 方式 A：纯手工维护 index.html（适合目前阶段）

直接编辑 `index.html` 中的占位内容，推送即更新：

```bash
# 修改 index.html 后
git add index.html
git commit -m "update: 添加新文章链接"
git push
# → Cloudflare Pages 自动检测推送，2分钟内部署完成
```

**适合修改：** 时间轴、电影片单、项目描述、联系方式等低频信息。

---

### 方式 B：Markdown → 自动注入（推荐，适合博客文章）

核心思路：用一个轻量构建脚本，读取 `content/posts/` 下的 Markdown 文件，
自动生成文章列表并注入 `index.html` 的 Thinking 板块。

**文章 Markdown 格式示例** (`content/posts/2025-06-thinking-slow.md`)：

```markdown
---
title: 关于「慢」的价值——在效率至上的时代重新理解耐心
date: 2025-06-01
tag: Essay
lang: zh
---

正文内容……
```

**构建脚本** (`scripts/build.js`)：

```javascript
const fs   = require('fs');
const path = require('path');

// 1. 读取所有文章的 frontmatter
const postsDir = path.join(__dirname, '../content/posts');
const posts = fs.readdirSync(postsDir)
  .filter(f => f.endsWith('.md'))
  .map(f => {
    const raw  = fs.readFileSync(path.join(postsDir, f), 'utf8');
    const meta = raw.match(/^---\n([\s\S]+?)\n---/)?.[1] || '';
    const get  = key => meta.match(new RegExp(`${key}: (.+)`))?.[1]?.trim() || '';
    const slug = f.replace('.md', '');
    return {
      title: get('title'),
      date:  get('date'),
      tag:   get('tag'),
      slug,
      url:   `/posts/${slug}.html`
    };
  })
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 5); // 首页只展示最新 5 篇

// 2. 生成 HTML 片段
const listHTML = posts.map(p => `
  <a href="${p.url}" class="thought-item reveal">
    <span class="thought-date">${p.date.slice(0,7).replace('-','.')}</span>
    <span class="thought-title">${p.title}</span>
    <span class="thought-tag">${p.tag}</span>
  </a>`).join('\n');

// 3. 注入 index.html（替换占位符注释）
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(
  /<!-- POSTS_START -->[\s\S]*?<!-- POSTS_END -->/,
  `<!-- POSTS_START -->\n${listHTML}\n<!-- POSTS_END -->`
);
fs.writeFileSync('index.html', html);
console.log(`✓ Injected ${posts.length} posts into index.html`);
```

在 `index.html` 的 Thinking 列表处加两行注释标记：

```html
<div class="thoughts-list">
  <!-- POSTS_START -->
  <!-- POSTS_END -->
</div>
```

这样每次 `node scripts/build.js` 后推送，文章列表自动更新。

---

### 方式 C：Obsidian 一键发布（最舒适的写作体验）

如果你用 Obsidian 写作：

1. 在 Obsidian 里把 `yuanzehua.me/content/posts/` 设为你的笔记目录（或子目录）
2. 写完文章后，在文章顶部加好 frontmatter（title/date/tag）
3. 打开终端，在项目根目录运行：

```bash
# 一键发布脚本（保存为 publish.sh）
#!/bin/bash
echo "📝 Building site..."
node scripts/build.js
echo "🚀 Pushing to GitHub..."
git add .
git commit -m "post: $(date '+%Y-%m-%d') 新文章"
git push
echo "✅ 部署中，约 1-2 分钟后生效：https://yuanzehua.me"
```

```bash
chmod +x publish.sh
./publish.sh
```

也可以配置 Obsidian 的「Shell commands」插件，在编辑器内一键触发。

---

## 五、电影片单维护

单独维护一个 `content/films.yml`，格式清晰，易于增删：

```yaml
films:
  - title: 请替换片名
    title_en: Film Title
    year: 2023
    director: 导演姓名
    score: 9.2
    color: "#d8d3ca"   # 海报背景色，可用取色器从真实海报取色
    symbol: "◎"        # 占位符号（无海报图时显示）

  - title: 请替换片名
    title_en: Film Title
    year: 2022
    director: 导演姓名
    score: 8.8
    color: "#ddd8cf"
    symbol: "◈"
```

构建脚本同样读取这个文件，自动生成轮播 HTML。
你只需要在 YAML 里加一行，推送后网站自动更新。

---

## 六、GitHub Actions 自动构建（完整配置）

`.github/workflows/deploy.yml`：

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build site
        run: node scripts/build.js

      - name: Commit built files
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add index.html
          git diff --staged --quiet || git commit -m "build: auto-inject posts [skip ci]"
          git push
```

> **注**：由于 Cloudflare Pages 直接监听 `main` 分支，构建脚本在 Actions 里跑完、
> 更新 `index.html` 后，Cloudflare 会再自动触发一次部署。
> `[skip ci]` 标记防止无限循环。

另一种更简洁的方式：直接让 Cloudflare Pages 执行构建命令 `node scripts/build.js`，
省去 GitHub Actions 这一步。

---

## 七、本地需要长期维护的内容清单

| 文件/目录 | 更新频率 | 内容 |
|-----------|---------|------|
| `index.html` | 低频（几个月一次） | 时间轴、项目描述、联系方式等结构性信息 |
| `content/posts/*.md` | 高频（有想法就写） | 博客文章，写完推送即自动上线 |
| `content/films.yml` | 中频（看完一部加一条） | 电影片单 |
| `assets/images/` | 按需 | 文章配图、头像等 |

**不需要维护的**：服务器、SSL 证书、CDN 配置——全部由 Cloudflare 自动处理。

---

## 八、后续可扩展的功能

| 功能 | 方案 | 难度 |
|------|------|------|
| 文章详情页 | 构建脚本生成独立 `.html` | ★★☆ |
| RSS 订阅 | 脚本额外生成 `feed.xml` | ★★☆ |
| 搜索 | Pagefind（纯静态全文搜索） | ★★☆ |
| 评论 | giscus（基于 GitHub Discussions） | ★☆☆ |
| 访问统计 | Cloudflare Analytics（免费，无 Cookie） | ★☆☆ |
| 文章目录 / TOC | JS 自动生成 | ★☆☆ |

---

## 九、第一次部署的操作顺序

```
1. 去域名注册商，把 yuanzehua.me 的 NS 改为 Cloudflare 的
2. 本地：mkdir yuanzehua.me && 把 index.html 放进去
3. GitHub：新建仓库 yuanzehua.me，推送代码
4. Cloudflare Pages：连接仓库，部署
5. Cloudflare Pages：Custom Domain → 绑定 yuanzehua.me
6. 验证：浏览器访问 https://yuanzehua.me ✓
7. 之后：改内容 → git push → 等 1-2 分钟 → 自动上线
```

---

*文档版本：2025-06*
