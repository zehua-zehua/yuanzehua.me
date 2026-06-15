# Loopi 数据库最简配置

这个页面只需要配置一次。你不需要理解数据库，只要按顺序点完即可。

## 1. 创建 D1 数据库

1. 打开 Cloudflare Dashboard。
2. 进入 **Workers & Pages**。
3. 找到 **D1 SQL Database**。
4. 点击 **Create database**。
5. 数据库名称填写：`homepage_pet`。

## 2. 建表

这一步可以跳过。线上接口会在第一次请求时自动创建 `pet_feedback` 表。

如果你想手动确认，也可以：

1. 打开刚创建的 `homepage_pet`。
2. 进入 **Console**。
3. 复制项目里的建表文件内容：
   `pet-loop/db/schema.sql`
4. 粘贴到 Console。
5. 点击 **Execute**。

建表完成后，线上数据库就只有一张表：`pet_feedback`。

## 3. 绑定到 Pages 项目

1. 回到 Cloudflare Dashboard 的 **Workers & Pages**。
2. 打开 `yuanzehua.me` 对应的 Pages 项目。
3. 进入 **Settings** → **Functions** → **Bindings**。
4. 新增 **D1 database binding**。
5. Variable name 填：`PET_DB`。
6. D1 database 选择：`homepage_pet`。
7. 保存。

## 4. 添加管理员密钥

1. 仍然在 Pages 项目的 **Settings**。
2. 找到 **Environment variables**。
3. 新增变量：`PET_ADMIN_TOKEN`。
4. 值填写一段你自己保存的长随机字符串。
5. 再新增变量：`PET_HASH_SALT`。
6. 值同样填写一段长随机字符串。

`PET_ADMIN_TOKEN` 用来让 Codex 读取原始反馈并生成报告。前端用户看不到它。

## 5. 重新部署

保存 binding 和环境变量后，重新部署一次 Pages 项目。

完成后可以访问：

- `/api/pet-feedback-summary?version=loopi_v0_2`
- `/pet-lab/`

如果返回 JSON，说明数据库已经连通。

## 以后怎么用

- 用户反馈会自动写入 `pet_feedback`。
- Pet Lab 只读取聚合统计，不展示原始文字反馈。
- Codex 生成报告时，使用 `PET_ADMIN_TOKEN` 读取原始反馈。
- Loopi 版本、候选和报告仍然放在仓库里，不进入数据库。
