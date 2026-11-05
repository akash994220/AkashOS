# Deploying AkashOS to InfinityFree Free Hosting

AkashOS is fully configured and optimized for **InfinityFree** and standard Apache/PHP shared hosting environments. 

---

## ⚡ What Makes AkashOS InfinityFree-Ready?

1. **Path-Agnostic Static Assets (`./`)**: Assets work whether hosted on the root domain (`username.infinityfreeapp.com`) or inside a subfolder (`username.epizy.com/app/`).
2. **Apache `.htaccess` Rewrite Engine**: Handles Single Page Application (SPA) routing, preventing `404 Not Found` errors when refreshing subpages (`/workspace`, `/vault`, `/content`, `/finance`).
3. **MIME Types & Gzip Compression**: Ensures `.js`, `.mjs`, `.woff2`, and `.webmanifest` files are served with the proper headers to avoid module script errors on free shared servers.
4. **PHP API Bridge (`/api/index.php`)**: InfinityFree does not support Node.js processes. AkashOS includes an Apache + PHP bridge inside `/api/` that handles `/api/health`, `/api/accounts/status`, and YouTube publishing workflows without a persistent Node server.
5. **Client-Side Firebase**: All database (Firestore) and user authentication operations run directly in the client browser, requiring zero backend server setup.

---

## 🚀 Step-by-Step Deployment Instructions

### Step 1: Build the Production Package
In your project terminal, run:
```bash
npm run build
```
This generates the production-ready package inside the **`dist/`** directory.

The `dist/` directory contains:
- `index.html` (Application entry)
- `.htaccess` (Apache SPA routing & security rules)
- `assets/` (Compiled JavaScript & CSS bundles)
- `api/` (PHP API dispatcher: `index.php`, `.htaccess`, `config.sample.php`)
- `fonts/` (Pre-packaged custom typography)
- `manifest.json` & `sw.js` (Offline PWA service worker)

---

### Step 2: Log in to InfinityFree

1. Go to [InfinityFree Client Area](https://dash.infinityfree.com/) and log in.
2. Select your hosting account (e.g., `epiz_12345678`).
3. Note your **FTP Details**:
   - **FTP Hostname**: `ftpupload.net`
   - **FTP Username**: `epiz_XXXXXXXX`
   - **FTP Password**: Your InfinityFree vPanel password
   - **Port**: `21`

---

### Step 3: Upload to `htdocs` via FileZilla (Recommended)

1. Open **FileZilla** (or your preferred FTP client).
2. Enter your Host (`ftpupload.net`), Username, Password, and Port (`21`), then click **Quickconnect**.
   - *Note: If asked about TLS certificate, accept and proceed.*
3. In FileZilla, navigate to the remote directory:
   ```
   /htdocs
   ```
   *(Or if using an addon domain: `/[your-domain]/htdocs`)*
4. If there is a default placeholder file like `index2.html`, delete it.
5. In the local pane of FileZilla, open the **`dist`** folder.
6. Select **all contents inside `dist/`** (including `.htaccess` and the `api/` folder) and drag them into the remote `/htdocs` folder.

> ⚠️ **Important (Hidden Files)**: In FileZilla, ensure hidden files are visible:  
> Go to **Server** → Check **"Force showing hidden files"** so `.htaccess` is uploaded.

---

### Alternative: Upload via InfinityFree Web File Manager
If you don't have FileZilla installed:
1. In your InfinityFree Dashboard, click **File Manager** (MonstaFTP).
2. Open the **`htdocs`** folder.
3. Zip the contents of your local `dist` folder into a `.zip` archive.
4. In the File Manager, click **Upload** → **Upload Zip** and select your zip file.
5. Extract the files directly into `/htdocs`.

---

## 🔍 Step 4: Verification Checklist

1. **Visit your website**: Open `https://your-subdomain.infinityfreeapp.com` in your browser.
2. **Test Page Reloads**: Navigate to a note or module, and reload the browser (`F5` or `Ctrl+R`). The page should reload smoothly without a 404 error.
3. **Test the PHP Health Bridge**:
   Visit `https://your-subdomain.infinityfreeapp.com/api/health`. You will receive:
   ```json
   {
     "status": "ok",
     "server": "InfinityFree PHP Shared Hosting",
     "php_version": "8.x.x",
     "timestamp": "..."
   }
   ```
4. **Log in / Sign up**: Log in using your Firebase credentials. Data automatically syncs with Firestore.

---

## ⚙️ Optional: Adding Gemini AI or Real YouTube API Keys

By default, the PHP bridge runs YouTube in simulation mode and AI generation in assisted fallback mode.

To enable live Google Gemini AI calls or live YouTube publishing on InfinityFree:
1. In your `/htdocs/api/` folder, make a copy of `config.sample.php` named `config.php`.
2. Edit `config.php`:
   ```php
   <?php
   return [
       'GEMINI_API_KEY' => 'AIzaSyYourGeminiApiKeyHere',
       'GOOGLE_CLIENT_ID' => '',
       'GOOGLE_CLIENT_SECRET' => '',
   ];
   ```
3. Save the file. The PHP bridge will automatically proxy live calls to Google's Gemini API via cURL.

---

## 🛠️ Troubleshooting on InfinityFree

- **Getting 404 on subpages or reloads?**
  - Check that `.htaccess` is uploaded into the root of `/htdocs`. In some FTP clients, dotfiles (`.htaccess`) are hidden by default.
- **Script error or MIME type warning in console?**
  - AkashOS's `.htaccess` includes explicit `AddType application/javascript .js .mjs` rules to prevent Apache from serving JavaScript as `text/plain`.
- **Upload stalled or interrupted?**
  - Free FTP accounts occasionally timeout on large bulk file transfers. In FileZilla, set Maximum Simultaneous Connections to `2` under **Settings → Transfers**.
