<div align="center">
  <img src="https://via.placeholder.com/120x120/ff6b6b/ffffff?text=KYO" alt="Kyoto API Logo" width="120" />
  <h1>Kyoto API</h1>
  <p><strong>High-Performance REST API Platform</strong></p>

  <p>
    <img src="https://img.shields.io/badge/version-1.0.0-ff6b6b?style=flat-square" alt="Version" />
    <img src="https://img.shields.io/badge/endpoints-30+-ff8e53?style=flat-square" alt="Endpoints" />
    <img src="https://img.shields.io/badge/license-MIT-4ade80?style=flat-square" alt="License" />
    <img src="https://img.shields.io/badge/response-%3C100ms-a78bfa?style=flat-square" alt="Response Time" />
    <img src="https://img.shields.io/badge/uptime-99.9%25-38bdf8?style=flat-square" alt="Uptime" />
  </p>

  <br />
  <p>
    <a href="#-features">Features</a>
    &nbsp;&middot;&nbsp;
    <a href="#-http-methods">HTTP Methods</a>
    &nbsp;&middot;&nbsp;
    <a href="#-api-categories">API Categories</a>
    &nbsp;&middot;&nbsp;
    <a href="#-quick-start">Quick Start</a>
    &nbsp;&middot;&nbsp;
    <a href="#-documentation">Documentation</a>
    &nbsp;&middot;&nbsp;
    <a href="#-deployment">Deployment</a>
  </p>
</div>

---

## Overview

Kyoto API is a comprehensive REST API platform built for modern developers. With **30+ endpoints** across **6 categories**, it delivers AI-powered tools, media downloaders, file storage, image manipulation, and manga/anime data — all through a clean, consistent JSON interface.

Built with performance in mind, every endpoint responds in **under 100ms** with **99.9% uptime** and full **CORS support** for all major HTTP methods.

---

## Features

<table>
  <tr>
    <td width="50%">
      <h3>⚡ Lightning Fast</h3>
      <p>Average response time under 100ms across all endpoints. Optimized routing and minimal overhead.</p>
    </td>
    <td width="50%">
      <h3>🔒 Secure by Default</h3>
      <p>HTTPS enforced on all requests. Rate limiting at 100 req/min per IP. No data stored permanently.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h3>🔌 Easy Integration</h3>
      <p>Standard RESTful JSON responses. Works with any language: cURL, fetch, axios, Python requests, etc.</p>
    </td>
    <td>
      <h3>📊 Full CRUD Support</h3>
      <p>GET, POST, PUT, DELETE, PATCH methods supported on all dynamic endpoints.</p>
    </td>
  </tr>
  <tr>
    <td>
      <h3>🌐 CORS Enabled</h3>
      <p>All endpoints include proper CORS headers. OPTIONS preflight handled automatically.</p>
    </td>
    <td>
      <h3>📚 Interactive Docs</h3>
      <p>Built-in API documentation with live "Try It Out" tester, cURL generation, and response previews.</p>
    </td>
  </tr>
</table>

---

## HTTP Methods

Kyoto API supports all major HTTP methods for complete resource manipulation:

| Method | Label | Description | Safe | Idempotent |
|--------|-------|-------------|------|------------|
| `GET` | **READ** | Retrieve resources from the server | ✅ | ✅ |
| `POST` | **CREATE** | Create new resources | ❌ | ❌ |
| `PUT` | **UPDATE** | Replace an existing resource entirely | ❌ | ✅ |
| `DELETE` | **REMOVE** | Delete a specified resource | ❌ | ✅ |
| `PATCH` | **MODIFY** | Partially update specific fields | ❌ | ❌ |
| `HEAD` | **CHECK** | Retrieve headers only (no response body) | ✅ | ✅ |
| `OPTIONS` | **DISCOVER** | CORS preflight and method discovery | ✅ | ✅ |
| `TRACE` | **DIAGNOSE** | Echo back the request for debugging | ✅ | ✅ |

---

## API Categories

### AI — Artificial Intelligence
Endpoints for AI-powered chat, image generation, translation, and OCR.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/chatgpt` | `GET` `POST` | ChatGPT conversation with GPT-4 |
| `/api/ai/dalle` | `GET` | Generate images from text prompts |
| `/api/ai/translate` | `GET` | Translate text between languages |
| `/api/ai/ocr` | `POST` | Extract text from images using OCR |

### Downloader — Media Downloaders
Download videos and audio from popular platforms.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/downloader/tiktok` | `GET` | TikTok video downloader (no watermark) |
| `/api/downloader/instagram` | `GET` | Instagram reels, posts, and stories |
| `/api/downloader/youtube` | `GET` | YouTube videos in multiple qualities |
| `/api/downloader/twitter` | `GET` | Twitter/X video downloader |
| `/api/downloader/spotify` | `GET` | Spotify track and album downloader |

### Tools — Utilities & Converters
Handy tools for developers and everyday use.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tools/ssweb` | `GET` | Website screenshot capture |
| `/api/tools/qr` | `GET` | QR code generator |
| `/api/tools/shortlink` | `GET` | URL shortener |
| `/api/tools/cuaca` | `GET` | Weather information by city |
| `/api/tools/calculator` | `GET` | Mathematical expression evaluator |

### Storage — File Management
Upload, list, and manage files in cloud storage.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/storage/upload` | `POST` | Upload files (max 50MB) |
| `/api/storage/list` | `GET` | List all uploaded files |
| `/api/storage/delete` | `DELETE` | Remove a file from storage |

### Media — Image & Media Tools
Create and manipulate images programmatically.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/media/canvas` | `GET` | Generate custom canvas images |
| `/api/media/sticker` | `GET` | Convert images to WhatsApp stickers |
| `/api/media/removebg` | `POST` | AI-powered background removal |
| `/api/media/meme` | `GET` | Meme generator with custom text |

### Manga — Manga & Anime Data
Access manga and anime information.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/manga/search` | `GET` | Search manga by title |
| `/api/manga/chapter` | `GET` | Get manga chapter pages |
| `/api/manga/anime` | `GET` | Anime details and synopsis |
| `/api/manga/random` | `GET` | Random manga recommendation |
| `/api/manga/waifu` | `GET` | Random waifu/anime images |

---

## Quick Start

### Prerequisites
No authentication required. All endpoints are publicly accessible with rate limiting.

### Example Request

```bash
# AI Chat
curl "https://kyoto-api.vercel.app/api/ai/chatgpt?text=Hello+Kyoto"

# TikTok Downloader
curl "https://kyoto-api.vercel.app/api/downloader/tiktok?url=https://vt.tiktok.com/example"

# Weather
curl "https://kyoto-api.vercel.app/api/tools/cuaca?city=Tokyo"

# Manga Search
curl "https://kyoto-api.vercel.app/api/manga/search?query=One+Piece"