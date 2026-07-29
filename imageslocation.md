# Image Storage — FishTokri Admin

## Physical storage location (VPS)

All uploaded images are stored inside the admin project directory:

```
/var/www/fishtokri/Images/<folder>/<timestamp>-<random>.<ext>
```

### Folder structure

The `<folder>` segment comes from the `?folder=` query parameter passed at upload time. Current folders in use:

| Upload context | Folder path | Full disk path |
|---|---|---|
| Super Hub images | `fishtokri/super-hubs` | `/var/www/fishtokri/Images/fishtokri/super-hubs/` |
| Banner images | `fishtokri/banners` | `/var/www/fishtokri/Images/fishtokri/banners/` |
| Product images | `fishtokri/products` | `/var/www/fishtokri/Images/fishtokri/products/` |
| Category images | `fishtokri/categories` | `/var/www/fishtokri/Images/fishtokri/categories/` |
| Recipe images | `fishtokri/recipes` | `/var/www/fishtokri/Images/fishtokri/recipes/` |

### Filename format

```
<unix-timestamp-ms>-<6-char-random>.<original-extension>
```

Example: `1785339604951-tgox0c.png`

---

## How the admin API serves images

The Express API (running on port **3015**) serves the `Images/` directory as static files at the `/images` path:

```
http://localhost:3015/images/<folder>/<filename>
```

Example:
```
http://localhost:3015/images/fishtokri/banners/1785339604951-tgox0c.png
```

The URL stored in MongoDB for every image looks like:
```
/images/fishtokri/banners/1785339604951-tgox0c.png
```
(a root-relative path, not an absolute URL)

---

## Accessing images from the fishtokriwebsite app (`/var/www/fishtokriwebsite`)

Because the website is a separate app at a different location, the relative `/images/...` path from MongoDB will not resolve on its own. You have two options:

### Option A — Nginx alias (recommended)

Add an `alias` block to the nginx config for `fishtokriwebsite` so it serves the shared `Images/` folder directly from disk — no extra HTTP hop, fastest performance.

```nginx
# Inside the fishtokriwebsite server block in nginx
location /images/ {
    alias /var/www/fishtokri/Images/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

After adding this, any image whose URL in the database is `/images/fishtokri/banners/xyz.png` will be served correctly from the website too.

### Option B — Proxy to the admin API

If you prefer not to touch nginx, proxy `/images/` traffic to the admin API:

```nginx
location /images/ {
    proxy_pass http://localhost:3015/images/;
}
```

---

## Replit (development)

On Replit the API runs on port **8080** and the Vite dev server proxies both `/api` and `/images` to it, so images work the same way in development without any extra configuration.

---

## Summary

| Environment | Images stored at | Served from |
|---|---|---|
| VPS | `/var/www/fishtokri/Images/` | `http://localhost:3015/images/` |
| Replit (dev) | `<project-root>/Images/` | Vite proxy → port 8080 |

For the fishtokriwebsite to display images, use **Option A** (nginx alias) pointing to `/var/www/fishtokri/Images/`.
