# 新北市 115 學年度國中小學區查詢雛形

使用 Next.js、React、TypeScript、Tailwind CSS 建立的學區查詢系統初版。資料目前由 PDF 抽取成靜態 JSON，後續可替換為資料庫或後台匯入流程。

## 開發

```bash
npm run dev
```

開啟 http://localhost:3000。

## PDF 資料抽取

```bash
/Users/jsdryan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/extract-school-zones.py
```

預設來源：

- 國小：`/Users/jsdryan/Downloads/6390815202945559934835907.pdf`
- 國中：`/Users/jsdryan/Downloads/115年新北市國中學區.pdf`

輸出：

`src/data/school-zones.json`

## 目前功能

- 切換國小、國中學區資料。
- 以學校、行政區、里、鄰與備註文字搜尋。
- 依行政區篩選。
- 切換各區學區、有自由學區、全市自由學區。
- 顯示學校、基本學區、自由學區與備註欄位。
