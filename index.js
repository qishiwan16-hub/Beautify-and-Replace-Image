//name: 主题一键换图

(async function() {
    const SCRIPT_NAME = "主题一键换图"; 
    const STYLE_ID = 'native-bgm-style-v7-0'; 
    const INJECT_STYLE_ID = 'native-bgm-injected-overrides';
    const MENU_BTN_ID = 'st-bgm-ext-btn-v7-0';
    const SCRIPT_VERSION = '1.4.1';
    const EXTENSION_DEFAULT_FOLDER = 'Beautify-and-Replace-Image';
    const EXTENSION_RAW_MANIFEST_URL = 'https://raw.githubusercontent.com/qishiwan16-hub/Beautify-and-Replace-Image/main/manifest.json';
    const BACKEND_BASE_URLS = [
        '/api/plugins/image-replacement-ui-enhancement',
        '/api/plugins/Backend-for-image-replacement-and-UI-enhancement',
        '/api/plugins/backend-for-image-replacement-and-ui-enhancement'
    ];
    const INITIAL_SCRIPT_URL = document.currentScript?.src || '';
    if (typeof window.__briHotCleanup === 'function') window.__briHotCleanup();
    const runtimeTimers = [];
    
    const DB_NAME = 'ST_BGM_Theme_DB';
    const STORE_OVERRIDES = 'theme_overrides'; 
    const STORE_PRESETS = 'theme_presets';     

    let isNukingDB = false;
    let blobCache = new Map(); 

    function getBlobObjectUrl(blob) {
        if (!blobCache.has(blob)) blobCache.set(blob, URL.createObjectURL(blob));
        return blobCache.get(blob);
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function legacyPresetId(name, index) {
        const source = `${String(name || 'preset')}\u0000${index}`;
        let hash = 2166136261;
        for (let i = 0; i < source.length; i++) {
            hash ^= source.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return `bgm-${(hash >>> 0).toString(36)}`;
    }

    function createPresetId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
        return `bgm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function normalizePresets(presets) {
        if (!Array.isArray(presets)) return [];
        const usedIds = new Set();
        let activeFound = false;
        return presets.map((rawPreset, index) => {
            const preset = rawPreset && typeof rawPreset === 'object' ? rawPreset : {};
            let id = String(preset.id || '').trim() || legacyPresetId(preset.name, index);
            if (usedIds.has(id)) id = createPresetId();
            usedIds.add(id);
            const isActive = !activeFound && !!preset.isActive;
            if (isActive) activeFound = true;
            return {
                ...preset,
                id,
                name: String(preset.name || `预设 ${index + 1}`).trim() || `预设 ${index + 1}`,
                data: preset.data && typeof preset.data === 'object' ? preset.data : {},
                isActive
            };
        });
    }

    // 优化：同时支持计算旧版 Base64 字符串和新版 Blob(文件) 的体积
    function getSizeMB(data) {
        if (!data) return 0;
        if (data instanceof Blob) return (data.size / 1024 / 1024).toFixed(2);
        return ((data.length * 2) / 1024 / 1024).toFixed(2);
    }

    function getCurrentThemeName() {
        let val = $('#themes').val() || $('#theme').val(); 
        if (val) return val.replace('.css', '').replace('.less', '');
        const $themeLink = $('link[href*="/themes/"]');
        if ($themeLink.length > 0) {
            const match = $themeLink.attr('href').match(/\/themes\/([^./]+)/);
            if (match && match[1]) return decodeURIComponent(match[1]); 
        }
        if (typeof settings !== 'undefined' && settings.visual_theme) {
            return settings.visual_theme.replace('.css', '');
        }
        return "Default_Theme";
    }

    const BGMData = {
        _db: null,
        _init: function() {
            return new Promise((resolve, reject) => {
                if (isNukingDB) return reject("Nuking");
                if (this._db) return resolve(this._db);
                const req = indexedDB.open(DB_NAME, 2);
                req.onupgradeneeded = e => { 
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_OVERRIDES)) db.createObjectStore(STORE_OVERRIDES);
                    if (!db.objectStoreNames.contains(STORE_PRESETS)) db.createObjectStore(STORE_PRESETS);
                };
                req.onsuccess = e => { this._db = e.target.result; resolve(this._db); };
                req.onerror = () => reject("DB Init Fail");
            });
        },
        loadForTheme: async function(themeName) {
            if (isNukingDB) return {};
            try {
                const db = await this._init();
                return new Promise(resolve => {
                    const tx = db.transaction(STORE_OVERRIDES, 'readonly');
                    const req = tx.objectStore(STORE_OVERRIDES).get(themeName);
                    req.onsuccess = () => resolve(req.result || {});
                    req.onerror = () => resolve({});
                });
            } catch(e) { return {}; }
        },
        saveForTheme: async function(themeName, data) {
            if (isNukingDB) return;
            const db = await this._init();
            return new Promise(resolve => {
                const tx = db.transaction(STORE_OVERRIDES, 'readwrite');
                tx.objectStore(STORE_OVERRIDES).put(data, themeName);
                tx.oncomplete = () => resolve();
            });
        },
        loadPresets: async function(themeName) {
            if (isNukingDB) return [];
            try {
                const db = await this._init();
                return new Promise(resolve => {
                    const tx = db.transaction(STORE_PRESETS, 'readonly');
                    const req = tx.objectStore(STORE_PRESETS).get(themeName);
                    req.onsuccess = () => resolve(req.result || []); 
                    req.onerror = () => resolve([]);
                });
            } catch(e) { return []; }
        },
        savePresets: async function(themeName, presetsArray) {
            if (isNukingDB) return;
            const db = await this._init();
            return new Promise(resolve => {
                const tx = db.transaction(STORE_PRESETS, 'readwrite');
                tx.objectStore(STORE_PRESETS).put(presetsArray, themeName);
                tx.oncomplete = () => resolve();
            });
        },
        clearAllDatabase: async function() {
            isNukingDB = true;
            if (this._db) { this._db.close(); this._db = null; }
            return new Promise((resolve, reject) => {
                const req = indexedDB.deleteDatabase(DB_NAME);
                req.onsuccess = () => resolve();
                req.onerror = () => reject();
                req.onblocked = () => resolve(); 
            });
        },
        // ================= 读取所有主题体积与删除特定主题的方法 =================
        getAllThemeStats: async function() {
            if (isNukingDB) return [];
            try {
                const db = await this._init();
                return new Promise(resolve => {
                    const tx = db.transaction([STORE_OVERRIDES, STORE_PRESETS], 'readonly');
                    const oStore = tx.objectStore(STORE_OVERRIDES);
                    const pStore = tx.objectStore(STORE_PRESETS);
                    
                    const oKeys = oStore.getAllKeys();
                    const oVals = oStore.getAll();
                    const pKeys = pStore.getAllKeys();
                    
                    tx.oncomplete = () => {
                        const statsMap = new Map();
                        const keys1 = oKeys.result || [];
                        const vals1 = oVals.result || [];
                        
                        for(let i=0; i<keys1.length; i++) {
                            let size = 0;
                            let data = vals1[i];
                            if (data) {
                                Object.keys(data).forEach(k => { size += parseFloat(getSizeMB(data[k])); });
                            }
                            statsMap.set(keys1[i], size);
                        }
                        
                        const keys2 = pKeys.result || [];
                        for(let i=0; i<keys2.length; i++) {
                            if (!statsMap.has(keys2[i])) statsMap.set(keys2[i], 0);
                        }
                        
                        const result = [];
                        statsMap.forEach((size, theme) => {
                            result.push({ theme: theme, sizeMB: size.toFixed(2) });
                        });
                        resolve(result);
                    };
                });
            } catch(e) { return []; }
        },
        deleteThemeData: async function(themeName) {
            if (isNukingDB) return;
            const db = await this._init();
            return new Promise(resolve => {
                const tx = db.transaction([STORE_OVERRIDES, STORE_PRESETS], 'readwrite');
                tx.objectStore(STORE_OVERRIDES).delete(themeName);
                tx.objectStore(STORE_PRESETS).delete(themeName);
                tx.oncomplete = () => resolve();
            });
        }
    };

    const localLoadForTheme = BGMData.loadForTheme.bind(BGMData);
    const localSaveForTheme = BGMData.saveForTheme.bind(BGMData);
    const localLoadPresets = BGMData.loadPresets.bind(BGMData);
    const localSavePresets = BGMData.savePresets.bind(BGMData);
    const localGetAllThemeStats = BGMData.getAllThemeStats.bind(BGMData);
    const localDeleteThemeData = BGMData.deleteThemeData.bind(BGMData);
    const localClearAllDatabase = BGMData.clearAllDatabase.bind(BGMData);

    const serverStorage = {
        mode: 'unknown',
        state: null,
        detectPromise: null,
        baseUrl: BACKEND_BASE_URLS[0],
        lastDetectionAt: 0,
        lastError: '',
        migratedThemes: new Set(),
        getRequestHeaders() {
            try {
                const context = typeof getContext === 'function' ? getContext() : window.SillyTavern?.getContext?.();
                if (context && typeof context.getRequestHeaders === 'function') return context.getRequestHeaders();
            } catch (error) {}
            try {
                if (typeof window.getRequestHeaders === 'function') return window.getRequestHeaders();
            } catch (error) {}
            const headers = { 'Content-Type': 'application/json' };
            if (window.token) headers['X-CSRF-Token'] = window.token;
            return headers;
        },
        async request(path, options = {}) {
            const headers = { ...this.getRequestHeaders(), ...(options.headers || {}) };
            const response = await fetch(`${this.baseUrl}${path}`, { cache: 'no-store', credentials: 'same-origin', ...options, headers });
            if (!response.ok) throw new Error((await response.text()) || response.statusText || `HTTP ${response.status}`);
            return response.json();
        },
        async detect(force = false, signal = null) {
            if (this.detectPromise && !force) return this.detectPromise;
            if (!force && this.mode === 'server') return this.mode;
            if (!force && this.mode === 'local' && Date.now() - this.lastDetectionAt < 15000) return this.mode;
            this.detectPromise = (async () => {
                this.lastDetectionAt = Date.now();
                this.lastError = '';
                for (const baseUrl of BACKEND_BASE_URLS) {
                    this.baseUrl = baseUrl;
                    try {
                        const status = await this.request('/status', { signal });
                        if (status && status.ok) {
                            this.mode = 'server';
                            this.state = null;
                            return this.mode;
                        }
                    } catch (error) {
                        if (error && error.name === 'AbortError') throw error;
                        this.lastError = String(error && error.message || error);
                    }
                }
                this.baseUrl = BACKEND_BASE_URLS[0];
                this.mode = 'local';
                return this.mode;
            })();
            try { return await this.detectPromise; } finally { this.detectPromise = null; }
        },
        async loadState() {
            if (this.state) return this.state;
            const result = await this.request('/data');
            const data = result && result.data && typeof result.data === 'object' ? result.data : {};
            this.state = {
                schemaVersion: Number(data.schemaVersion || 1),
                overrides: data.overrides && typeof data.overrides === 'object' ? data.overrides : {},
                presets: data.presets && typeof data.presets === 'object' ? data.presets : {}
            };
            return this.state;
        },
        async toDataUrl(value) {
            if (!(value instanceof Blob)) return value;
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error || new Error('Unable to read image'));
                reader.readAsDataURL(value);
            });
        },
        async serialize(value) {
            if (Array.isArray(value)) return Promise.all(value.map(item => this.serialize(item)));
            if (value instanceof Blob) return this.toDataUrl(value);
            if (value && typeof value === 'object') {
                const result = {};
                for (const [key, item] of Object.entries(value)) result[key] = await this.serialize(item);
                return result;
            }
            return value;
        },
        async saveState(state) {
            const result = await this.request('/data', { method: 'PUT', body: JSON.stringify(await this.serialize(state)) });
            const data = result && result.data && typeof result.data === 'object' ? result.data : state;
            this.state = {
                schemaVersion: Number(data.schemaVersion || 1),
                overrides: data.overrides && typeof data.overrides === 'object' ? data.overrides : {},
                presets: data.presets && typeof data.presets === 'object' ? data.presets : {}
            };
            return this.state;
        },
        async migrateTheme(themeName) {
            if (this.migratedThemes.has(themeName)) return;
            this.migratedThemes.add(themeName);
            const state = await this.loadState();
            const hasServerData = Object.prototype.hasOwnProperty.call(state.overrides, themeName) || Object.prototype.hasOwnProperty.call(state.presets, themeName);
            if (hasServerData) return;
            const localOverrides = await localLoadForTheme(themeName);
            const localPresets = await localLoadPresets(themeName);
            if (Object.keys(localOverrides || {}).length || (localPresets || []).length) {
                state.overrides[themeName] = localOverrides || {};
                state.presets[themeName] = localPresets || [];
                await this.saveState(state);
            }
        },
        async listThemes() {
            const result = await this.request('/themes');
            return Array.isArray(result.themes) ? result.themes : [];
        }
    };

    function useLocalStorage() { return serverStorage.mode !== 'server'; }
    function setLocalFallback() { serverStorage.mode = 'local'; }

    BGMData.loadForTheme = async function(themeName) {
        if (await serverStorage.detect() === 'server') {
            try {
                await serverStorage.migrateTheme(themeName);
                const state = await serverStorage.loadState();
                return state.overrides[themeName] || {};
            } catch (error) { setLocalFallback(); }
        }
        return localLoadForTheme(themeName);
    };
    BGMData.saveForTheme = async function(themeName, data) {
        if (await serverStorage.detect() === 'server') {
            try {
                const state = await serverStorage.loadState();
                state.overrides[themeName] = data || {};
                await serverStorage.saveState(state);
                return;
            } catch (error) { setLocalFallback(); }
        }
        return localSaveForTheme(themeName, data);
    };
    BGMData.loadPresets = async function(themeName) {
        if (await serverStorage.detect() === 'server') {
            try {
                await serverStorage.migrateTheme(themeName);
                const state = await serverStorage.loadState();
                return normalizePresets(state.presets[themeName]);
            } catch (error) { setLocalFallback(); }
        }
        return normalizePresets(await localLoadPresets(themeName));
    };
    BGMData.savePresets = async function(themeName, presetsArray) {
        const normalizedPresets = normalizePresets(presetsArray);
        if (await serverStorage.detect() === 'server') {
            try {
                const state = await serverStorage.loadState();
                state.presets[themeName] = normalizedPresets;
                await serverStorage.saveState(state);
                return;
            } catch (error) { setLocalFallback(); }
        }
        return localSavePresets(themeName, normalizedPresets);
    };
    BGMData.getAllThemeStats = async function() {
        if (await serverStorage.detect() === 'server') {
            try {
                const state = await serverStorage.loadState();
                const names = new Set([...Object.keys(state.overrides), ...Object.keys(state.presets)]);
                return Array.from(names, theme => ({ theme, sizeMB: '0.00' }));
            } catch (error) { setLocalFallback(); }
        }
        return localGetAllThemeStats();
    };
    BGMData.deleteThemeData = async function(themeName) {
        if (await serverStorage.detect() === 'server') {
            try {
                const state = await serverStorage.loadState();
                delete state.overrides[themeName];
                delete state.presets[themeName];
                await serverStorage.saveState(state);
                return;
            } catch (error) { setLocalFallback(); }
        }
        return localDeleteThemeData(themeName);
    };
    BGMData.clearAllDatabase = async function() {
        if (await serverStorage.detect() === 'server') {
            try {
                serverStorage.state = { schemaVersion: 1, overrides: {}, presets: {} };
                await serverStorage.saveState(serverStorage.state);
            } catch (error) { setLocalFallback(); }
        }
        return localClearAllDatabase();
    };

    async function clearActivePreset(themeName) {
        const presets = await BGMData.loadPresets(themeName);
        if (!presets.some(preset => preset.isActive)) return;
        presets.forEach(preset => { preset.isActive = false; });
        await BGMData.savePresets(themeName, presets);
    }

    const BATCH_NAME_SEPARATOR = '\u2014';

    function writeZipU16(bytes, value) { bytes.push(value & 0xff, (value >>> 8) & 0xff); }
    function writeZipU32(bytes, value) { bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff); }
    function zipCrc32(bytes) {
        let crc = 0xffffffff;
        for (const value of bytes) {
            crc ^= value;
            for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }
    async function createBatchZip(entries) {
        const encoder = new TextEncoder();
        const local = [], central = [];
        let offset = 0;
        for (const entry of entries) {
            const name = encoder.encode(String(entry.name));
            const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(await entry.data.arrayBuffer());
            const crc = zipCrc32(data);
            const localHeader = [];
            writeZipU32(localHeader, 0x04034b50); writeZipU16(localHeader, 20); writeZipU16(localHeader, 0x0800); writeZipU16(localHeader, 0); writeZipU16(localHeader, 0); writeZipU16(localHeader, 0);
            writeZipU32(localHeader, crc); writeZipU32(localHeader, data.length); writeZipU32(localHeader, data.length); writeZipU16(localHeader, name.length); writeZipU16(localHeader, 0);
            local.push(new Uint8Array(localHeader), name, data);
            const centralHeader = [];
            writeZipU32(centralHeader, 0x02014b50); writeZipU16(centralHeader, 20); writeZipU16(centralHeader, 20); writeZipU16(centralHeader, 0x0800); writeZipU16(centralHeader, 0); writeZipU16(centralHeader, 0); writeZipU16(centralHeader, 0);
            writeZipU32(centralHeader, crc); writeZipU32(centralHeader, data.length); writeZipU32(centralHeader, data.length); writeZipU16(centralHeader, name.length); writeZipU16(centralHeader, 0); writeZipU16(centralHeader, 0); writeZipU16(centralHeader, 0); writeZipU16(centralHeader, 0); writeZipU32(centralHeader, 0); writeZipU32(centralHeader, offset);
            central.push(new Uint8Array(centralHeader), name);
            offset += 30 + name.length + data.length;
        }
        const centralSize = central.reduce((sum, part) => sum + part.length, 0);
        const end = [];
        writeZipU32(end, 0x06054b50); writeZipU16(end, 0); writeZipU16(end, 0); writeZipU16(end, entries.length); writeZipU16(end, entries.length); writeZipU32(end, centralSize); writeZipU32(end, offset); writeZipU16(end, 0);
        return new Blob([...local, ...central, new Uint8Array(end)], { type: 'application/zip' });
    }
    function batchTimestamp() {
        const date = new Date();
        const pad = value => String(value).padStart(2, '0');
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    }
    function imageExtensionFromBlob(blob, fallback = 'png') {
        const mime = String(blob?.type || '').toLowerCase();
        if (mime.includes('png')) return 'png';
        if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
        if (mime.includes('gif')) return 'gif';
        if (mime.includes('webp')) return 'webp';
        if (mime.includes('bmp')) return 'bmp';
        if (mime.includes('svg')) return 'svg';
        const match = String(fallback).match(/\.([a-z0-9]+)(?:\?|$)/i);
        return match ? match[1].toLowerCase() : 'png';
    }
    function imageBaseName(value) {
        try { return decodeURIComponent(String(value || '').split(/[?#]/)[0].split('/').pop() || '').replace(/\.[^.]+$/, '').trim().toLowerCase(); }
        catch (error) { return String(value || '').split(/[?#]/)[0].split('/').pop().replace(/\.[^.]+$/, '').trim().toLowerCase(); }
    }
    function getBatchImageName(theme, index, extension) {
        return `${sanitizeFileName(theme)}${BATCH_NAME_SEPARATOR}${String(index + 1).padStart(2, '0')}.${extension}`;
    }
    function sanitizeFileName(value) {
        return String(value || '美化').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 100) || '美化';
    }
    function downloadBatchBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function uploadBatchZip(blob, filename) {
        if (serverStorage.mode !== 'server') throw new Error('后端未连接，请更新并启用主题一键换图后端');
        const headers = { ...serverStorage.getRequestHeaders(), 'Content-Type': 'application/zip' };
        const response = await fetch(`${serverStorage.baseUrl}/downloads?filename=${encodeURIComponent(filename)}`, {
            method: 'POST', headers, body: blob, credentials: 'same-origin', cache: 'no-store'
        });
        if (!response.ok) throw new Error((await response.text()) || `HTTP ${response.status}`);
        const result = await response.json();
        if (!result || !result.ok || !result.url) throw new Error('后端没有返回下载地址');
        return { ...result, absoluteUrl: new URL(result.url, window.location.href).href };
    }

    async function copyTextValue(value, input) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch (error) {
            if (!input) return false;
            input.focus(); input.select();
            try { return document.execCommand('copy'); } catch (copyError) { return false; }
        }
    }

    function storageLabel() {
        if (serverStorage.mode === 'server') return '存储：酒馆后端';
        if (serverStorage.mode === 'local') return '存储：浏览器 IndexedDB';
        return '存储：检测中';
    }

    function getCssTextarea() {
        let $ta = $('#CustomCSS');
        if ($ta.length === 0) $ta = $('#CustomCSS-textAreaBlock textarea');
        return $ta;
    }

    function extractCSSUrls() {
        const $ta = getCssTextarea();
        if ($ta.length === 0) return [];
        
        let cssText = $ta.val();
        const cleanCssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
        const resultsMap = new Map();
        
        const urlRegex = /url\(\s*['"]?(.*?)['"]?\s*\)/gi;
        let match;
        const fontExtensions = /\.(woff|woff2|ttf|otf|eot|css)(\?|$)/i;
        const fontKeywords = ['font', 'googleapis', 'gstatic'];

        while ((match = urlRegex.exec(cleanCssText)) !== null) {
            const urlMatch = match[1];
            if (!urlMatch || urlMatch.trim() === '') continue;
            if (fontExtensions.test(urlMatch)) continue;
            if (fontKeywords.some(kw => urlMatch.includes(kw))) continue;

            let textBefore = cleanCssText.substring(0, match.index);
            if (textBefore.trim().endsWith('@import')) continue;

            let lastOpenBrace = textBefore.lastIndexOf('{');
            let selector = "未知区域";
            if (lastOpenBrace !== -1) {
                let selectorSearchArea = textBefore.substring(0, lastOpenBrace);
                let prevCloseBrace = selectorSearchArea.lastIndexOf('}');
                let prevOpenBrace = selectorSearchArea.lastIndexOf('{'); 
                let boundary = Math.max(prevCloseBrace, prevOpenBrace);
                let selectorText = selectorSearchArea.substring(boundary + 1).trim();
                if (selectorText) selector = selectorText;
            }

            if (!resultsMap.has(urlMatch)) {
                resultsMap.set(urlMatch, { originalUrl: urlMatch, selectors: [] });
            }
            resultsMap.get(urlMatch).selectors.push(selector);
        }
        return Array.from(resultsMap.values());
    }

    async function applyInjectedOverrides() {
        if (isNukingDB) return;
        const currentTheme = getCurrentThemeName();
        const overrides = await BGMData.loadForTheme(currentTheme); 
        const $ta = getCssTextarea();
        if ($ta.length === 0) return;
        
        let originalCss = $ta.val();
        let clonedCss = originalCss;
        let rootVars = `:root {\n`;
        let varIndex = 0;
        let hasChanges = false;

        Object.keys(overrides).forEach(oldUrl => {
            if (originalCss.includes(oldUrl)) {
                hasChanges = true;
                const fileData = overrides[oldUrl];
                const varName = `--bgm-v7-img-${varIndex++}`;

                let injectUrl;
                // 核心修复：如果存的是原生二进制 Blob (File) 对象，走光速通道
                if (fileData instanceof Blob) {
                    injectUrl = getBlobObjectUrl(fileData);
                } else {
                    // 兼容你以前存的老版 Base64 字符串
                    injectUrl = fileData;
                }

                rootVars += `    ${varName}: url('${injectUrl}') !important;\n`;
                const escapedUrl = escapeRegExp(oldUrl);
                const regex = new RegExp(`url\\(\\s*['"]?${escapedUrl}['"]?\\s*\\)`, 'g');
                clonedCss = clonedCss.replace(regex, `var(${varName})`);
            }
        });
        rootVars += `}\n\n`;

        $(`#${INJECT_STYLE_ID}`).remove();
        if (hasChanges && !isNukingDB) {
            const finalCss = `/* BGM V7 - Clone & Variable Injection */\n${rootVars}${clonedCss}`;
            $('head').append(`<style id="${INJECT_STYLE_ID}">${finalCss}</style>`);
        }
    }

    let lastThemeName = getCurrentThemeName();
    runtimeTimers.push(setInterval(() => {
        if (isNukingDB) return;
        const currentTheme = getCurrentThemeName();
        const $ta = getCssTextarea();
        if (currentTheme !== lastThemeName) {
            lastThemeName = currentTheme;
            applyInjectedOverrides();
            if ($('.bgm-overlay').length > 0) $('.bgm-subtitle strong').text(currentTheme);
        }
        if ($ta.length && !$ta.data('bgm-bound')) {
            $ta.data('bgm-bound', true);
            $ta.on('input', applyInjectedOverrides);
            applyInjectedOverrides(); 
        }
    }, 1000));

    $(`#${STYLE_ID}`).remove();
    $('head').append(`
        <style id="${STYLE_ID}">
            .bgm-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 99999; background: transparent; }
            .bgm-box {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                width: 90%; max-width: 550px; height: 80vh; max-height: 800px; 
                background-color: var(--SmartThemeBlurTintColor); backdrop-filter: blur(10px);
                border-radius: 18px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); 
                display: flex; flex-direction: column; overflow: hidden;
                animation: bgm-center-pop 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28);
                font-family: sans-serif; color: var(--SmartThemeBodyColor);
            }
            @keyframes bgm-center-pop { from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
            
            .bgm-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid rgba(0,0,0,0.05); flex-shrink: 0; }
            .bgm-title-block { display: flex; flex-direction: column; }
            .bgm-title { font-weight: bold; font-size: 1.15em; display: flex; align-items: center; gap: 10px; }
            .bgm-version { font-size: 0.68em; font-weight: normal; opacity: 0.65; }
            .bgm-subtitle { font-size: 0.8em; opacity: 0.6; margin-top: 2px; }
            .bgm-subtitle i { color: var(--SmartThemeQuoteColor); }
            .bgm-close { cursor: pointer; background: none; border: none; padding: 0; opacity: 0.5; font-size: 1.5em; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; transition: 0.2s; border-radius: 50%; color: inherit; }
            .bgm-close:hover { opacity: 1; background: rgba(0,0,0,0.05); color: var(--SmartThemeQuoteColor); }

            .bgm-toolbar { display: flex; gap: 8px; padding: 10px 15px; background: rgba(0,0,0,0.02); border-bottom: 1px solid rgba(0,0,0,0.05); flex-shrink: 0; }
            
            /* 核心修复：box-sizing 解决变小跳动问题 */
            .bgm-tool-btn {
                flex: 1; padding: 8px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; box-sizing: border-box;
                background: rgba(255,255,255,0.6); cursor: pointer; font-size: 0.85em; 
                display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;
            }
            .bgm-tool-btn:hover { background: white; border-color: var(--SmartThemeQuoteColor); color: var(--SmartThemeQuoteColor); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            .bgm-tool-btn.active { background: var(--SmartThemeQuoteColor); color: white; border-color: var(--SmartThemeQuoteColor); }
            .bgm-tool-btn.danger-lite:hover { color: #e57373; border-color: #e57373; }

            .bgm-content { flex: 1; overflow-y: auto; padding: 15px; position: relative; display: flex; flex-direction: column; }
            
            .bgm-sub-panel { display: none; flex-direction: column; gap: 10px; animation: bgm-fade-in 0.2s; }
            .bgm-sub-panel.active { display: flex; }
            @keyframes bgm-fade-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

            .bgm-storage-card { background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.05); border-radius: 12px; padding: 15px; display: flex; flex-direction: column; gap: 10px; }
            .bgm-storage-title { font-weight: bold; font-size: 0.95em; color: var(--SmartThemeQuoteColor); display: flex; align-items: center; gap: 8px; }
            .bgm-storage-desc { font-size: 0.85em; opacity: 0.7; line-height: 1.4; }
            .bgm-storage-stats { background: rgba(0,0,0,0.03); padding: 8px 12px; border-radius: 8px; font-family: monospace; font-size: 0.85em; display: flex; justify-content: space-between; }
            .bgm-btn-action { padding: 8px 15px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.9em; font-weight: bold; transition: 0.2s; }
            .bgm-btn-action.safe { background: var(--SmartThemeQuoteColor); color: white; }
            .bgm-btn-action.safe:hover { filter: brightness(1.1); box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            .bgm-btn-action.nuke { background: transparent; border: 1px solid #e57373; color: #e57373; }
            .bgm-btn-action.nuke:hover { background: #e57373; color: white; }

            .bgm-preset-add { padding: 14px; border: 2px dashed rgba(0,0,0,0.1); border-radius: 12px; text-align: center; cursor: pointer; opacity: 0.6; transition: all 0.2s; }
            .bgm-preset-add:hover { color: var(--SmartThemeQuoteColor); opacity: 1; background: rgba(255,255,255,0.5); }
            .bgm-preset-item { display: flex; align-items: center; background: rgba(255,255,255,0.7); padding: 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.05); gap: 10px; transition: all 0.2s; }
            .bgm-preset-item:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.05); background: white; }
            .bgm-preset-item.active { border-color: #35a85b; box-shadow: inset 3px 0 0 #35a85b; }
            .bgm-preset-indicator { width: 9px; height: 9px; flex: 0 0 9px; border-radius: 50%; background: rgba(0,0,0,0.14); }
            .bgm-preset-item.active .bgm-preset-indicator { background: #35c46a; box-shadow: 0 0 0 3px rgba(53,196,106,0.16); }
            .bgm-preset-name { flex: 1; min-width: 0; font-weight: normal; display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .bgm-preset-actions { display: flex; align-items: center; gap: 5px; }
            .bgm-preset-switch, .bgm-preset-save { min-height: 30px; padding: 5px 9px; border: 1px solid var(--SmartThemeQuoteColor); border-radius: 7px; background: transparent; color: var(--SmartThemeQuoteColor); cursor: pointer; }
            .bgm-preset-switch:hover, .bgm-preset-save:hover { background: var(--SmartThemeQuoteColor); color: white; }
            .bgm-preset-switch.active { border-color: #35a85b; background: rgba(53,168,91,0.12); color: #35a85b; }
            .bgm-preset-switch.active:hover { background: #35a85b; color: white; }
            .bgm-icon-btn { width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0.5; transition: 0.2s; }
            .bgm-icon-btn:hover { background: rgba(0,0,0,0.05); opacity: 1; color: var(--SmartThemeQuoteColor); }
            .bgm-icon-btn.del:hover { color: #e57373; background: #fff2f2; }

            .bgm-list { display: flex; flex-direction: column; gap: 15px; }
            /* 加入 flex-wrap 使内部的长按钮可以折行 */
            .bgm-item { display: flex; flex-wrap: wrap; padding: 15px; background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.05); border-radius: 16px; transition: all 0.2s; gap: 15px; align-items: flex-start; }
            .bgm-item:hover { border-color: var(--SmartThemeQuoteColor); background: white; box-shadow: 0 6px 15px rgba(0,0,0,0.05); transform: translateY(-2px); }
            .bgm-item.is-overridden { background: white; border: 1px solid var(--SmartThemeQuoteColor); box-shadow: 0 4px 12px rgba(0,0,0,0.08); order: -1; }
            .bgm-item-preview { width: 90px; height: 90px; flex-shrink: 0; border-radius: 12px; background: rgba(0,0,0,0.04); overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(0,0,0,0.05); position: relative; }
            .bgm-item-preview img { width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; }
            .bgm-fallback-icon { font-size: 2em; color: #ccc; z-index: 1; display: none; }
            .bgm-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
            .bgm-item-selector { font-weight: 700; font-size: 1em; color: var(--SmartThemeQuoteColor); word-wrap: break-word; line-height: 1.3; }
            .bgm-meta-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
            .bgm-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: var(--SmartThemeQuoteColor); color: white; border-radius: 6px; font-size: 0.75em; font-weight: normal; white-space: nowrap; flex-shrink: 0; }
            .bgm-item-url { font-size: 0.8em; opacity: 0.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: monospace; flex: 1; min-width: 0; }
            .bgm-item-actions { display: flex; gap: 10px; width: 100%; margin-top: auto; }
            .bgm-btn { padding: 8px 0; border-radius: 8px; border: 1px solid transparent; box-sizing: border-box; cursor: pointer; font-size: 0.9em; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; flex: 1; font-weight: 500; }
            .bgm-btn-replace { background: var(--SmartThemeQuoteColor); color: white; }
            .bgm-btn-replace:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            .bgm-btn-reset { background: white; color: #666; border-color: #ddd; }
            .bgm-btn-reset:hover { background: #fff2f2; color: #e57373; border-color: #e57373; }
            .bgm-empty { text-align: center; padding: 60px 0; opacity: 0.5; font-size: 0.9em; display: flex; flex-direction: column; gap: 15px; }
            .bgm-empty i { font-size: 3em; }

            /* =================== 日夜切换与全局项 UI =================== */
            .bgm-theme-toggle { cursor: pointer; background: none; border: none; padding: 0; opacity: 0.5; font-size: 1.3em; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; transition: 0.2s; border-radius: 50%; color: inherit; }
            .bgm-theme-toggle:hover { opacity: 1; background: rgba(0,0,0,0.05); color: var(--SmartThemeQuoteColor); }
            .bgm-theme-toggle.active { opacity: 1; color: var(--SmartThemeQuoteColor); }
            
            .bgm-global-item { display: flex; align-items: center; background: rgba(255,255,255,0.7); padding: 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.05); gap: 10px; transition: all 0.2s; }
            .bgm-global-item:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.05); background: white; border-color: rgba(229, 115, 115, 0.5); }
            .bgm-btn-del-theme:hover { background: transparent !important; color: #e57373 !important; }

            .bgm-box.bgm-dark { background-color: rgba(30,30,30,0.95) !important; color: #eee !important; }
            .bgm-box.bgm-dark .bgm-header { border-bottom: 1px solid rgba(255,255,255,0.1); }
            .bgm-box.bgm-dark .bgm-toolbar { background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.1); }
            .bgm-box.bgm-dark .bgm-tool-btn { background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.1); color:#eee; }
            .bgm-box.bgm-dark .bgm-tool-btn:hover { background: rgba(255,255,255,0.1); }
            .bgm-box.bgm-dark .bgm-storage-card, .bgm-box.bgm-dark .bgm-preset-item, .bgm-box.bgm-dark .bgm-item { background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.1); color: #eee; }
            .bgm-box.bgm-dark .bgm-storage-stats { background: rgba(0,0,0,0.5); }
            
            .bgm-box.bgm-dark .bgm-btn-reset { background: rgba(255,255,255,0.1); color: #ccc; border-color: transparent; }
            .bgm-box.bgm-dark .bgm-btn-reset:hover { background: rgba(255,0,0,0.2); color: #e57373; }
            
            .bgm-box.bgm-dark .bgm-btn-replace { background: rgba(255,255,255,0.1); color: #ccc; box-shadow: none; border-color: transparent; }
            .bgm-box.bgm-dark .bgm-btn-replace:hover { background: rgba(255,255,255,0.2); color: #fff; transform: translateY(-1px); }
            .bgm-box.bgm-dark .bgm-badge { background: rgba(255,255,255,0.15); color: #ccc; }
            .bgm-box.bgm-dark .bgm-item.is-overridden { border-color: rgba(255,255,255,0.2); }

            .bgm-box.bgm-dark .bgm-item-preview { background: rgba(0,0,0,0.5); border-color: rgba(255,255,255,0.1); }
            .bgm-box.bgm-dark .bgm-close:hover, .bgm-box.bgm-dark .bgm-theme-toggle:hover { background: rgba(255,255,255,0.1); }
            .bgm-box.bgm-dark .bgm-preset-add:hover { background: rgba(0,0,0,0.3); color: #eee; }
            .bgm-box.bgm-dark .bgm-preset-item.active { border-color: #35c46a; }

            .bgm-batch-modal { position: fixed; inset: 0; z-index: 100001; background: rgba(0,0,0,0.42); display: flex; align-items: center; justify-content: center; padding: 14px; box-sizing: border-box; }
            .bgm-batch-modal-box { width: min(900px, 96vw); max-height: min(88vh, 900px); overflow: auto; background: var(--SmartThemeBlurTintColor); color: var(--SmartThemeBodyColor); border-radius: 14px; padding: 16px; box-shadow: 0 12px 42px rgba(0,0,0,0.28); }
            .bgm-batch-dark { background: rgba(30,30,30,0.98); color: #eee; }
            .bgm-batch-modal-title { font-weight: 700; font-size: 1.05em; display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
            .bgm-batch-modal-hint { font-size: 0.82em; opacity: 0.72; line-height: 1.45; margin-bottom: 10px; }
            .bgm-batch-order { display: inline-flex; margin-bottom: 10px; border: 1px solid rgba(0,0,0,0.14); border-radius: 8px; overflow: hidden; }
            .bgm-batch-order button { min-width: 72px; padding: 7px 12px; border: 0; border-right: 1px solid rgba(0,0,0,0.12); background: rgba(255,255,255,0.58); color: inherit; cursor: pointer; }
            .bgm-batch-order button:last-child { border-right: 0; }
            .bgm-batch-order button.active { background: var(--SmartThemeQuoteColor); color: white; }
            .bgm-batch-dark .bgm-batch-order { border-color: rgba(255,255,255,0.16); }
            .bgm-batch-dark .bgm-batch-order button { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.14); }
            .bgm-batch-dark .bgm-batch-order button.active { background: var(--SmartThemeQuoteColor); }
            .bgm-batch-link-lines { width: 100%; min-height: 90px; resize: vertical; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.14); background: rgba(255,255,255,0.7); color: inherit; font: inherit; }
            .bgm-batch-dark .bgm-batch-link-lines, .bgm-batch-dark .bgm-batch-new-link { background: rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.16); color: #eee; }
            .bgm-batch-table-head, .bgm-batch-table-row { display: grid; grid-template-columns: 56px minmax(0, 1fr) minmax(0, 1fr); gap: 8px; align-items: center; }
            .bgm-batch-table-head { margin-top: 12px; padding: 7px 8px; font-size: 0.78em; opacity: 0.65; }
            .bgm-batch-table-body { display: flex; flex-direction: column; gap: 6px; }
            .bgm-batch-table-row { padding: 7px 8px; border: 1px solid rgba(0,0,0,0.1); border-radius: 9px; background: rgba(255,255,255,0.45); }
            .bgm-batch-dark .bgm-batch-table-row { border-color: rgba(255,255,255,0.12); background: rgba(0,0,0,0.3); }
            .bgm-batch-index { text-align: center; font-family: monospace; opacity: 0.72; }
            .bgm-batch-link-cell { min-width: 0; display: flex; align-items: center; gap: 7px; }
            .bgm-batch-link-cell img { width: 48px; height: 48px; flex: 0 0 48px; object-fit: contain; border-radius: 6px; background: rgba(0,0,0,0.06); }
            .bgm-batch-link-cell img.empty { visibility: hidden; }
            .bgm-batch-link-cell > div { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.76em; opacity: 0.72; }
            .bgm-batch-new-link { min-width: 0; flex: 1; box-sizing: border-box; padding: 7px 8px; border-radius: 7px; border: 1px solid rgba(0,0,0,0.12); background: rgba(255,255,255,0.72); color: inherit; }
            .bgm-batch-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
            .bgm-batch-modal-actions button { padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.12); background: rgba(255,255,255,0.64); color: inherit; cursor: pointer; }
            .bgm-batch-modal-actions .bgm-batch-confirm { border-color: var(--SmartThemeQuoteColor); background: var(--SmartThemeQuoteColor); color: white; }
            .bgm-download-result-box { width: min(560px, 94vw); }
            .bgm-download-result-row { display: flex; gap: 7px; margin-top: 10px; }
            .bgm-download-result-url { flex: 1; min-width: 0; box-sizing: border-box; padding: 8px 10px; border: 1px solid rgba(0,0,0,0.14); border-radius: 8px; background: rgba(255,255,255,0.72); color: inherit; }
            .bgm-download-result-copy { flex: 0 0 auto; padding: 8px 14px; border: 0; border-radius: 8px; background: var(--SmartThemeQuoteColor); color: white; cursor: pointer; }
            .bgm-download-result-note { margin-top: 8px; font-size: 0.78em; opacity: 0.66; line-height: 1.45; overflow-wrap: anywhere; }
            .bgm-batch-dark .bgm-download-result-url { background: rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.16); color: #eee; }
            @media (max-width: 640px) { .bgm-batch-table-head, .bgm-batch-table-row { grid-template-columns: 34px minmax(0, 1fr) minmax(0, 1fr); gap: 4px; } .bgm-batch-link-cell { flex-direction: column; align-items: stretch; } .bgm-batch-link-cell img { width: 100%; height: 54px; flex-basis: 54px; } .bgm-batch-link-cell > div { display: none; } }

            @media (max-width: 600px) {
                .bgm-preset-item { align-items: flex-start; flex-wrap: wrap; }
                .bgm-preset-name { min-width: calc(100% - 24px); }
                .bgm-preset-actions { width: 100%; justify-content: flex-end; }
            }
            
            .bgm-box.bgm-dark .bgm-global-item { background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.1); }
            .bgm-box.bgm-dark .bgm-global-item:hover { background: rgba(0,0,0,0.5); border-color: rgba(229, 115, 115, 0.5); }

            /* =================== 创作模式 (Dev Mode) 专属样式 =================== */
            .bgm-dev-only { display: none !important; }
            .bgm-box.dev-mode-active .bgm-dev-only { display: flex !important; }
            
            /* 确保横幅不受列表order影响始终在最上方 */
            .bgm-dev-banner { justify-content: space-between; align-items: center; padding: 12px 15px; background: rgba(0,0,0,0.03); border-radius: 12px; border: 1px dashed var(--SmartThemeQuoteColor); font-size: 0.85em; margin-bottom: 5px; flex-shrink: 0; order: -2; }
            .bgm-dev-banner > div { width: 100%; }
            .bgm-box.bgm-dark .bgm-dev-banner { background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.2); }
            
            /* 创作模式新的一整行按钮组，跨越预览图和信息的整个宽度 */
            .bgm-dev-actions-row { flex-basis: 100%; width: 100%; display: flex; gap: 10px; margin-top: 2px; }
            .bgm-btn-dev-action-row { padding: 8px 0; border-radius: 8px; border: 1px solid #ddd; background: white; color: #666; cursor: pointer; font-size: 0.9em; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; flex: 1; font-weight: 500; box-sizing: border-box; }
            
            /* 换链接和下载按钮的悬浮样式：日间背景保持白，边框/文字变色；夜间保持和换图一致 */
            .bgm-btn-dev-action-row:hover { background: white; color: var(--SmartThemeQuoteColor); border-color: var(--SmartThemeQuoteColor); }
            .bgm-batch-actions { display: flex; gap: 8px; width: 100%; margin-top: 8px; order: 3; }
            .bgm-batch-actions .bgm-btn-dev-action-row { flex: 1; min-width: 0; }
            @media (max-width: 600px) { .bgm-batch-actions { flex-wrap: wrap; } .bgm-batch-actions .bgm-btn-dev-action-row { flex-basis: 100%; } }
            
            /* 夜间模式 */
            .bgm-box.bgm-dark .bgm-btn-dev-action-row { background: rgba(255,255,255,0.1); color: #ccc; border-color: transparent; }
            .bgm-box.bgm-dark .bgm-btn-dev-action-row:hover { background: rgba(255,255,255,0.2); color: #fff; border-color: transparent; transform: translateY(-1px); }
            .bgm-box.bgm-dark .bgm-batch-actions .bgm-btn-dev-action-row { background: rgba(255,255,255,0.1); color: #ccc; border-color: transparent; }
        </style>
    `);

    async function showBgmPopup() {
        if ($('.bgm-overlay').length > 0) return;

        const currentTheme = getCurrentThemeName();
        const overrides = await BGMData.loadForTheme(currentTheme);
        const parsedUrls = extractCSSUrls();
        const cssOrderedUrls = parsedUrls.slice();

        parsedUrls.sort((a, b) => {
            const hasA = overrides[a.originalUrl] !== undefined;
            const hasB = overrides[b.originalUrl] !== undefined;
            if (hasA && !hasB) return -1;
            if (!hasA && hasB) return 1;
            return 0;
        });

        // =================== 读取本地储存的模式状态 ===================
        const isDarkMode = localStorage.getItem('ST_BGM_DarkMode') === 'true';
        const isDevMode = localStorage.getItem('ST_BGM_DevMode') === 'true';

        let listHTML = '';
        if (parsedUrls.length === 0) {
            listHTML = `<div class="bgm-empty"><i class="fa-solid fa-code"></i><span>当前主题 CSS 中未检测到任何图片 URL</span></div>`;
        } else {
            // 顶部创作模式横幅 (加入 order:-2 永远置顶)
            let devBannerHTML = `
                <div class="bgm-dev-only bgm-dev-banner">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div class="bgm-batch-actions">
                            <button class="bgm-btn-dev-action-row" id="bgm-batch-download"><i class="fa-solid fa-file-zipper"></i> 鎵归噺涓嬭浇</button>
                            <button class="bgm-btn-dev-action-row" id="bgm-batch-import-images"><i class="fa-solid fa-file-arrow-up"></i> 鎵归噺瀵煎叆</button>
                            <button class="bgm-btn-dev-action-row" id="bgm-batch-import-links"><i class="fa-solid fa-link"></i> 閾炬帴瀵煎叆</button>
                        </div>
                        <span style="font-size:1.1em; color:var(--SmartThemeQuoteColor);"><i class="fa-solid fa-screwdriver-wrench"></i> <strong>创作模式</strong></span>
                        <span style="opacity:0.7;">可以直接替换 CSS 源码中的链接，或下载单个原图素材。<br>注意：替换链接后不会自动保存主题，请自行去主题页面保存。</span>
                    </div>
                </div>
            `;
            listHTML += devBannerHTML;

            parsedUrls.forEach((item) => {
                const originalUrl = item.originalUrl;
                const isOverridden = overrides[originalUrl] !== undefined;
                const activeDisplayUrl = isOverridden ? overrides[originalUrl] : originalUrl;
                
                // 处理预览图的 URL，如果是 Blob 就临时生成一个用于显示的地址
                let previewSrc = activeDisplayUrl;
                if (activeDisplayUrl instanceof Blob) {
                    previewSrc = getBlobObjectUrl(activeDisplayUrl);
                }

                // 后端图片使用 /api/plugins/... 相对地址；交给 img 实际加载，失败时再显示占位图。
                const isLikelyImage = activeDisplayUrl instanceof Blob || (typeof previewSrc === 'string' && previewSrc.trim() !== '');
                const imgStyle = isLikelyImage ? '' : 'display:none;';
                const iconStyle = isLikelyImage ? 'display:none;' : 'display:block;';
                const badgeHTML = isOverridden ? `<span class="bgm-badge"><i class="fa-solid fa-check"></i> 已替换</span>` : '';
                
                let textUrl = isOverridden ? String(activeDisplayUrl || '') : originalUrl;
                if (activeDisplayUrl instanceof Blob) {
                    textUrl = `[已替换本地文件: ${getSizeMB(activeDisplayUrl)} MB]`;
                } else if (textUrl.length > 30 && textUrl.startsWith('data:image')) {
                    textUrl = "Base64/SVG 数据隐藏";
                }

                let displaySelector = [...new Set(item.selectors)].join(', ');
                const safeUrl = escapeHtml(originalUrl);
                const safePreviewSrc = escapeHtml(String(previewSrc || ''));
                const safeTextUrl = escapeHtml(textUrl);

                // 第一行：正常的重置和选择图片功能
                const actionsHTML = isOverridden ? `
                    <button class="bgm-btn bgm-btn-reset" data-target="${safeUrl}"><i class="fa-solid fa-rotate-left"></i> 重置</button>
                    <button class="bgm-btn bgm-btn-replace" data-target="${safeUrl}"><i class="fa-solid fa-image"></i> 换图</button>
                ` : `
                    <button class="bgm-btn bgm-btn-replace" data-target="${safeUrl}"><i class="fa-solid fa-image"></i> 选择图片</button>
                `;

                // 第二行：创作模式专属的换链接和下载（利用 flex-basis:100% 独占一整行）
                const devActionsRowHTML = `
                    <div class="bgm-dev-actions-row bgm-dev-only">
                        <button class="bgm-btn-dev-action-row bgm-btn-dev-replace" data-target="${safeUrl}" title="直接修改原主题 CSS 代码"><i class="fa-solid fa-link"></i> 替换链接</button>
                        <button class="bgm-btn-dev-action-row bgm-btn-dev-download-full" data-target="${safeUrl}" title="下载原图"><i class="fa-solid fa-download"></i> 下载图片</button>
                    </div>
                `;

                listHTML += `
                    <div class="bgm-item ${isOverridden ? 'is-overridden' : ''}">
                        <div class="bgm-item-preview">
                            <img src="${safePreviewSrc}" style="${imgStyle}" onerror="$(this).hide().siblings('.bgm-fallback-icon').show()">
                            <i class="fa-solid fa-image bgm-fallback-icon" style="${iconStyle}"></i>
                        </div>
                        <div class="bgm-item-info">
                            <div class="bgm-item-selector">${displaySelector}</div>
                            <div class="bgm-meta-row">
                                ${badgeHTML}
                                <div class="bgm-item-url" title="${safeTextUrl}">${safeTextUrl}</div>
                            </div>
                            <div class="bgm-item-actions">${actionsHTML}</div>
                        </div>
                        ${devActionsRowHTML}
                    </div>
                `;
            });
        }

        const popupHTML = `
            <div class="bgm-overlay">
                <div class="bgm-box ${isDarkMode ? 'bgm-dark' : ''} ${isDevMode ? 'dev-mode-active' : ''}">
                    <div class="bgm-header">
                        <div class="bgm-title-block">
                            <div class="bgm-title"><i class="fa-solid fa-paw"></i> ${SCRIPT_NAME} <span class="bgm-version">v${SCRIPT_VERSION}</span></div>
                            <div class="bgm-subtitle"><i class="fa-solid fa-circle-info"></i> 当前主题: <strong>${currentTheme}</strong></div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button class="bgm-theme-toggle ${isDevMode ? 'active' : ''}" id="bgm-dev-toggle" title="开启/关闭创作模式"><i class="fa-solid fa-code"></i></button>
                            <button class="bgm-theme-toggle" id="bgm-theme-toggle" title="切换夜间模式"><i class="fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'}"></i></button>
                            <button class="bgm-close"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                    </div>

                    <div class="bgm-toolbar">
                        <div class="bgm-tool-btn" id="btn-tab-storage"><i class="fa-solid fa-gear"></i> 设置</div>
                        <div class="bgm-tool-btn" id="btn-tab-presets"><i class="fa-solid fa-folder-open"></i> 预设管理</div>
                        <div class="bgm-tool-btn danger-lite" id="btn-clear-current"><i class="fa-solid fa-rotate-left"></i> 一键重置</div>
                    </div>

                    <div class="bgm-content">
                        <div class="bgm-sub-panel" id="panel-presets"></div>
                        <div class="bgm-sub-panel" id="panel-storage"></div>
                        <div class="bgm-list active-sub" id="panel-main">${listHTML}</div>
                    </div>
                    
                    <input type="file" id="bgm-file-input" accept="image/*" style="display:none;">
                    <input type="file" id="bgm-batch-image-input" accept="image/*" multiple style="display:none;">
                </div>
            </div>
        `;

        const $popup = $(popupHTML);
        $('body').append($popup);
        $popup.find('#bgm-batch-download').html('<i class="fa-solid fa-file-zipper"></i> &#25209;&#37327;&#19979;&#36733;');
        $popup.find('#bgm-batch-import-images').html('<i class="fa-solid fa-file-arrow-up"></i> &#25209;&#37327;&#23548;&#20837;');
        $popup.find('#bgm-batch-import-links').html('<i class="fa-solid fa-link"></i> &#38142;&#25509;&#23548;&#20837;');

        const panelAbortController = new AbortController();
        let popupClosed = false;
        const showBatchDownloadResult = ({ zip, filename, directUrl = '', directError = '', expiresAt = '' }) => {
            $('.bgm-download-result-modal').remove();
            const linkContent = directUrl
                ? `<div class="bgm-download-result-row"><input class="bgm-download-result-url" readonly value="${escapeHtml(directUrl)}"><button type="button" class="bgm-download-result-copy"><i class="fa-solid fa-copy"></i> 复制</button></div><div class="bgm-download-result-note">直链约 24 小时后失效${expiresAt ? `，有效期至 ${escapeHtml(new Date(expiresAt).toLocaleString())}` : ''}。其他浏览器需能访问当前酒馆地址。</div>`
                : `<div class="bgm-download-result-note">未生成直链：${escapeHtml(directError || '主题后端未连接或版本过旧')}。本地 ZIP 已正常下载。</div>`;
            const $modal = $(`<div class="bgm-batch-modal bgm-download-result-modal"><div class="bgm-batch-modal-box bgm-download-result-box ${isDarkMode ? 'bgm-batch-dark' : ''}"><div class="bgm-batch-modal-title"><i class="fa-solid fa-file-zipper"></i> 批量下载完成</div><div class="bgm-batch-modal-hint">${escapeHtml(filename)}</div>${linkContent}<div class="bgm-batch-modal-actions"><button type="button" class="bgm-batch-cancel">关闭</button><button type="button" class="bgm-batch-confirm bgm-download-again"><i class="fa-solid fa-download"></i> 再次下载</button></div></div></div>`);
            $('body').append($modal);
            const close = () => $modal.remove();
            $modal.on('click', '.bgm-batch-cancel', close);
            $modal.on('click', event => { if ($(event.target).is('.bgm-batch-modal')) close(); });
            $modal.on('click', '.bgm-download-again', () => downloadBatchBlob(zip, filename));
            $modal.on('click', '.bgm-download-result-copy', async function() {
                const $input = $modal.find('.bgm-download-result-url');
                const copied = await copyTextValue(directUrl, $input[0]);
                if (window.toastr) toastr[copied ? 'success' : 'error'](copied ? '直链已复制' : '复制失败，请手动选择链接');
            });
        };

        const closePopup = () => {
            popupClosed = true;
            panelAbortController.abort();
            $('.bgm-batch-modal').remove();
            $popup.fadeOut(200, () => $popup.remove());
        };
        $popup.find('.bgm-close').on('click', closePopup);
        
        // =================== 日夜切换与开发模式切换 ===================
        $popup.find('#bgm-theme-toggle').on('click', function() {
            const $icon = $(this).find('i');
            if ($icon.hasClass('fa-moon')) {
                $icon.removeClass('fa-moon').addClass('fa-sun');
                $popup.find('.bgm-box').addClass('bgm-dark');
                localStorage.setItem('ST_BGM_DarkMode', 'true');
            } else {
                $icon.removeClass('fa-sun').addClass('fa-moon');
                $popup.find('.bgm-box').removeClass('bgm-dark');
                localStorage.setItem('ST_BGM_DarkMode', 'false');
            }
        });

        // 移除切换时的 toast 弹窗
        $popup.find('#bgm-dev-toggle').on('click', function() {
            const $box = $popup.find('.bgm-box');
            if ($box.hasClass('dev-mode-active')) {
                $box.removeClass('dev-mode-active');
                $(this).removeClass('active');
                localStorage.setItem('ST_BGM_DevMode', 'false');
            } else {
                $box.addClass('dev-mode-active');
                $(this).addClass('active');
                localStorage.setItem('ST_BGM_DevMode', 'true');
            }
        });
        
        $popup.on('click', (e) => { if ($(e.target).hasClass('bgm-overlay')) closePopup(); });

        const refreshList = async () => { 
            $('.bgm-overlay').remove(); 
            await showBgmPopup();       
        };

        const closeBatchModal = $modal => $modal.remove();
        const openBatchLinkModal = () => {
            $('.bgm-batch-link-modal').remove();
            let linkOrder = 'forward';
            const orderedItems = () => linkOrder === 'reverse' ? cssOrderedUrls.slice().reverse() : cssOrderedUrls.slice();
            const buildRows = (lines = []) => orderedItems().map((item, rowIndex) => {
                const imageIndex = cssOrderedUrls.findIndex(candidate => candidate.originalUrl === item.originalUrl);
                const newUrl = String(lines[rowIndex] || '').trim();
                const previewUrl = newUrl && newUrl !== '空' ? newUrl : '';
                return `<div class="bgm-batch-table-row" data-image-index="${imageIndex}">
                    <div class="bgm-batch-index">${String(imageIndex + 1).padStart(2, '0')}</div>
                    <div class="bgm-batch-link-cell"><img src="${escapeHtml(item.originalUrl)}" alt=""><div title="${escapeHtml(item.originalUrl)}">${escapeHtml(item.originalUrl)}</div></div>
                    <div class="bgm-batch-link-cell"><img class="bgm-batch-new-preview ${previewUrl ? '' : 'empty'}" ${previewUrl ? `src="${escapeHtml(previewUrl)}"` : ''} alt=""><input class="bgm-batch-new-link" type="text" value="${escapeHtml(newUrl)}" placeholder="新链接，或填写“空”跳过"></div>
                </div>`;
            }).join('');
            const $modal = $(`
                <div class="bgm-batch-modal bgm-batch-link-modal">
                    <div class="bgm-batch-modal-box ${isDarkMode ? 'bgm-batch-dark' : ''}">
                        <div class="bgm-batch-modal-title"><i class="fa-solid fa-link"></i> 批量导入链接</div>
                        <div class="bgm-batch-modal-hint">每行对应一个图片序号。输入“空”会保留该序号的原链接；编辑表格中的链接时，缩略图会实时更新。</div>
                        <div class="bgm-batch-order" role="group" aria-label="替换顺序"><button type="button" class="active" data-order="forward">正序</button><button type="button" data-order="reverse">倒序</button></div>
                        <textarea class="bgm-batch-link-lines" placeholder="链接1&#10;空&#10;链接3"></textarea>
                        <div class="bgm-batch-table-head"><span>序号</span><span>原链接及缩略图</span><span>新链接及缩略图</span></div>
                        <div class="bgm-batch-table-body">${buildRows()}</div>
                        <div class="bgm-batch-modal-actions"><button type="button" class="bgm-batch-cancel">取消</button><button type="button" class="bgm-batch-confirm">确认替换</button></div>
                    </div>
                </div>`);
            $('body').append($modal);
            const updatePreview = $input => {
                const value = String($input.val() || '').trim();
                const $preview = $input.siblings('.bgm-batch-new-preview');
                if (!value || value === '空') $preview.removeAttr('src').addClass('empty');
                else $preview.attr('src', value).removeClass('empty');
            };
            const currentLines = () => String($modal.find('.bgm-batch-link-lines').val() || '').replace(/\r/g, '').split('\n');
            const renderRows = () => $modal.find('.bgm-batch-table-body').html(buildRows(currentLines()));
            $modal.on('click', '.bgm-batch-order button', function() {
                linkOrder = String($(this).data('order')) === 'reverse' ? 'reverse' : 'forward';
                $(this).addClass('active').siblings().removeClass('active');
                renderRows();
            });
            $modal.on('input', '.bgm-batch-link-lines', function() {
                renderRows();
            });
            $modal.on('input', '.bgm-batch-new-link', function() {
                const $input = $(this);
                const rowIndex = $modal.find('.bgm-batch-table-row').index($input.closest('.bgm-batch-table-row'));
                const lines = currentLines();
                while (lines.length <= rowIndex) lines.push('');
                lines[rowIndex] = String($input.val() || '').trim();
                $modal.find('.bgm-batch-link-lines').val(lines.join('\n'));
                updatePreview($input);
            });
            $modal.on('click', '.bgm-batch-cancel', () => closeBatchModal($modal));
            $modal.on('click', event => { if ($(event.target).is('.bgm-batch-modal')) closeBatchModal($modal); });
            $modal.on('click', '.bgm-batch-confirm', async function() {
                const $textarea = getCssTextarea();
                if (!$textarea.length) { if (window.toastr) toastr.error('未找到酒馆主题 CSS 编辑框'); return; }
                let css = String($textarea.val() || ''), replaced = 0;
                $modal.find('.bgm-batch-table-row').each(function() {
                    const imageIndex = Number($(this).data('image-index'));
                    const $input = $(this).find('.bgm-batch-new-link');
                    const newUrl = String($input.val() || '').trim();
                    const oldUrl = cssOrderedUrls[imageIndex]?.originalUrl;
                    if (!oldUrl || !newUrl || newUrl === '空' || newUrl === oldUrl) return;
                    css = css.split(oldUrl).join(newUrl); replaced += 1;
                });
                if (!replaced) { if (window.toastr) toastr.warning('没有需要替换的链接'); return; }
                $(this).prop('disabled', true).text('替换中...');
                $textarea.val(css).trigger('input');
                await clearActivePreset(currentTheme);
                closeBatchModal($modal);
                if (window.toastr) toastr.success(`已替换 ${replaced} 个链接，请在酒馆主题界面自行保存`);
                await refreshList();
            });
        };

        $popup.on('click', '#bgm-batch-download', async function() {
            if (!cssOrderedUrls.length) return;
            const $button = $(this), oldHtml = $button.html();
            $button.prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 下载中');
            const entries = [], failed = [];
            for (let index = 0; index < cssOrderedUrls.length; index++) {
                const url = cssOrderedUrls[index].originalUrl;
                try {
                    const response = await fetch(url, { cache: 'no-store' });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const blob = await response.blob();
                    if (!blob.size) throw new Error('Empty image');
                    entries.push({ name: getBatchImageName(currentTheme, index, imageExtensionFromBlob(blob, url)), data: blob });
                } catch (error) { failed.push({ index: index + 1, url, error: String(error?.message || error) }); }
            }
            if (failed.length) {
                const text = failed.map(item => `${String(item.index).padStart(2, '0')}\t${item.url}\t${item.error}`).join('\n');
                entries.push({ name: '下载失败序号.txt', data: new TextEncoder().encode(`失败序号\t原链接\t原因\n${text}\n`) });
            }
            if (entries.length) {
                const zip = await createBatchZip(entries);
                const filename = `${sanitizeFileName(currentTheme)}-${batchTimestamp()}.zip`;
                downloadBatchBlob(zip, filename);
                let directUrl = '', directError = '', expiresAt = '';
                $button.html('<i class="fa-solid fa-link"></i> 生成直链');
                try {
                    const uploaded = await uploadBatchZip(zip, filename);
                    directUrl = uploaded.absoluteUrl;
                    expiresAt = uploaded.expiresAt || '';
                } catch (error) {
                    directError = String(error && error.message || error);
                }
                showBatchDownloadResult({ zip, filename, directUrl, directError, expiresAt });
                if (window.toastr) toastr[failed.length ? 'warning' : 'success'](failed.length ? `下载完成，${failed.length} 张失败，详情见 TXT` : `已下载 ${cssOrderedUrls.length} 张图片`);
            }
            $button.prop('disabled', false).html(oldHtml);
        });

        $popup.on('click', '#bgm-batch-import-images', () => $popup.find('#bgm-batch-image-input').click());
        $popup.find('#bgm-batch-image-input').on('change', async function(event) {
            const files = Array.from(event.target.files || []).filter(file => String(file.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name));
            $(this).val('');
            if (!files.length) return;
            const byBaseName = new Map(cssOrderedUrls.map((item, index) => [imageBaseName(item.originalUrl), index]));
            const matches = new Map(), unmatched = [];
            files.forEach(file => {
                const baseName = imageBaseName(file.name);
                const numberMatch = baseName.match(/(?:^|\u2014|[-_\s])(\d+)$/);
                let index = numberMatch ? Number(numberMatch[1]) - 1 : -1;
                if (index < 0 || index >= cssOrderedUrls.length) index = byBaseName.has(baseName) ? byBaseName.get(baseName) : -1;
                if (index < 0 || index >= cssOrderedUrls.length) unmatched.push(file.name); else matches.set(index, file);
            });
            if (!matches.size) { if (window.toastr) toastr.error('没有文件名能匹配当前美化的图片序号或原图名称'); return; }
            const data = await BGMData.loadForTheme(currentTheme);
            matches.forEach((file, index) => { data[cssOrderedUrls[index].originalUrl] = file; });
            await BGMData.saveForTheme(currentTheme, data);
            const presets = await BGMData.loadPresets(currentTheme);
            presets.forEach(preset => { preset.isActive = false; });
            presets.push({ id: createPresetId(), name: '本地图片替换版', data: { ...data }, isActive: true });
            await BGMData.savePresets(currentTheme, presets);
            await applyInjectedOverrides();
            if (window.toastr) toastr[unmatched.length ? 'warning' : 'success'](unmatched.length ? `已导入 ${matches.size} 张，${unmatched.length} 个文件名未匹配` : '已导入并保存预设“本地图片替换版”');
            await refreshList();
        });
        $popup.on('click', '#bgm-batch-import-links', openBatchLinkModal);

        // =================== 创作模式专属事件 ===================
        // 1. 替换 CSS 原链接
        $popup.on('click', '.bgm-btn-dev-replace', async function() {
            const targetUrl = $(this).attr('data-target');
            const newUrl = prompt(`要替换的目标链接：\n${targetUrl}\n\n输入新的图片链接：`, targetUrl);
            if (newUrl !== null && newUrl.trim() !== '' && newUrl.trim() !== targetUrl) {
                const $ta = getCssTextarea();
                let css = $ta.val();
                css = css.split(targetUrl).join(newUrl.trim());
                $ta.val(css).trigger('input'); 
                await clearActivePreset(currentTheme);
                if (window.toastr) toastr.success("CSS 源码链接已修改");
                refreshList();
            }
        });

        // 2. 单独下载该项原图
        $popup.on('click', '.bgm-btn-dev-download-full', async function() {
            const url = $(this).attr('data-target');
            if (url.startsWith('data:')) {
                if (window.toastr) toastr.warning("Base64 数据无法直接下载");
                return;
            }
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Fetch failed');
                const blob = await response.blob();
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = url.split('/').pop().split('?')[0] || `bgm_img.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            } catch(e) {
                // 如果遭遇跨域限制拦截，回退为在新标签页打开供用户手动保存
                const link = document.createElement('a');
                link.href = url;
                link.download = url.split('/').pop().split('?')[0] || `bgm_img.png`;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });


        const switchPanel = (targetId, btnId) => {
            const isClosing = $popup.find(targetId).hasClass('active');
            $popup.find('.bgm-sub-panel').removeClass('active');
            $popup.find('.bgm-tool-btn').removeClass('active');
            
            if (isClosing) {
                $popup.find('#panel-main').show();
            } else {
                $popup.find('#panel-main').hide();
                $popup.find(targetId).addClass('active');
                $popup.find(btnId).addClass('active');
            }
        };

        $popup.find('#btn-tab-presets').on('click', async function() {
            await renderPresets();
            switchPanel('#panel-presets', '#btn-tab-presets');
        });

        $popup.find('#btn-tab-storage').on('click', async function() {
            await renderStorage();
            switchPanel('#panel-storage', '#btn-tab-storage');
        });

        const renderPresets = async () => {
            const presets = await BGMData.loadPresets(currentTheme);
            let html = `<div class="bgm-preset-add"><i class="fa-solid fa-plus"></i> 将当前配置保存为新预设</div>`;
            if (presets.length > 0) {
                presets.forEach((p, index) => {
                    html += `
                        <div class="bgm-preset-item ${p.isActive ? 'active' : ''}" data-index="${index}">
                            <span class="bgm-preset-indicator" title="${p.isActive ? '当前使用中' : '未使用'}"></span>
                            <div class="bgm-preset-name"><i class="fa-solid fa-box-archive"></i> ${escapeHtml(p.name)}</div>
                            <div class="bgm-preset-actions">
                                <button class="bgm-preset-switch ${p.isActive ? 'active' : ''}" data-index="${index}" type="button"><i class="fa-solid ${p.isActive ? 'fa-rotate-left' : 'fa-repeat'}"></i> ${p.isActive ? '默认' : '切换'}</button>
                                <button class="bgm-preset-save" data-index="${index}" type="button" title="用当前配置覆盖此预设"><i class="fa-solid fa-floppy-disk"></i> 保存</button>
                                <div class="bgm-icon-btn rename" data-index="${index}" title="重命名"><i class="fa-solid fa-pencil"></i></div>
                                <div class="bgm-icon-btn del" data-index="${index}" title="删除"><i class="fa-solid fa-trash"></i></div>
                            </div>
                        </div>`;
                });
            } else { html += `<div style="text-align:center; opacity:0.5; padding:10px;">暂无预设</div>`; }
            $popup.find('#panel-presets').html(html);
        };

        $popup.on('click', '.bgm-preset-add', async function() {
            const name = prompt("请输入预设名称:");
            if (name && name.trim()) {
                const data = await BGMData.loadForTheme(currentTheme);
                let presets = await BGMData.loadPresets(currentTheme);
                presets.forEach(preset => { preset.isActive = false; });
                presets.push({ id: createPresetId(), name: name.trim(), data, isActive: true });
                await BGMData.savePresets(currentTheme, presets);
                await renderPresets();
                if (window.toastr) toastr.success("预设保存成功");
            }
        });

        const switchPreset = async index => {
            const presets = await BGMData.loadPresets(currentTheme);
            const preset = presets[index];
            if (!preset) return;
            if (preset.isActive) {
                if (!confirm(`恢复主题“${currentTheme}”的原始图片，并取消预设“${preset.name}”吗？`)) return;
                await BGMData.saveForTheme(currentTheme, {});
                presets.forEach(item => { item.isActive = false; });
                await BGMData.savePresets(currentTheme, presets);
                await applyInjectedOverrides();
                await renderPresets();
                if (window.toastr) toastr.success('已恢复主题原图');
                await refreshList();
                return;
            }
            if (confirm(`应用预设 "${preset.name}"？\n当前未保存的修改将被覆盖。`)) {
                await BGMData.saveForTheme(currentTheme, preset.data);
                presets.forEach((item, presetIndex) => { item.isActive = presetIndex === index; });
                await BGMData.savePresets(currentTheme, presets);
                await applyInjectedOverrides();
                await renderPresets();
                if (window.toastr) toastr.success(`已切换为预设“${preset.name}”`);
                await refreshList();
            }
        };

        $popup.on('click', '.bgm-preset-switch', async function() {
            await switchPreset(Number($(this).data('index')));
        });

        $popup.on('click', '.bgm-preset-save', async function() {
            const index = Number($(this).data('index'));
            const presets = await BGMData.loadPresets(currentTheme);
            const preset = presets[index];
            if (!preset || !confirm(`用当前配置覆盖预设“${preset.name}”？`)) return;
            preset.data = await BGMData.loadForTheme(currentTheme);
            presets.forEach((item, presetIndex) => { item.isActive = presetIndex === index; });
            await BGMData.savePresets(currentTheme, presets);
            await renderPresets();
            if (window.toastr) toastr.success(`当前配置已保存到预设“${preset.name}”`);
        });

        $popup.on('click', '.bgm-icon-btn.del', async function() {
            if (confirm("删除预设？")) {
                let presets = await BGMData.loadPresets(currentTheme);
                presets.splice($(this).data('index'), 1);
                await BGMData.savePresets(currentTheme, presets);
                await renderPresets();
            }
        });

        $popup.on('click', '.bgm-icon-btn.rename', async function() {
            let presets = await BGMData.loadPresets(currentTheme);
            const index = $(this).data('index');
            const newName = prompt("重命名预设:", presets[index].name);
            if (newName && newName.trim()) {
                presets[index].name = newName.trim();
                await BGMData.savePresets(currentTheme, presets);
                await renderPresets();
            }
        });

        const renderStorage = async () => {
            const currentData = await BGMData.loadForTheme(currentTheme);
            const activeUrls = parsedUrls.map(item => item.originalUrl);
            const zombieKeys = Object.keys(currentData).filter(key => !activeUrls.includes(key));
            let zombieSizeMB = 0;
            zombieKeys.forEach(k => { zombieSizeMB += parseFloat(getSizeMB(currentData[k])); });

            // 获取所有存过数据的主题列表
            const allStats = await BGMData.getAllThemeStats();
            
            // 获取当前酒馆列表中存在的主题
            let availableThemes = [];
            if (serverStorage.mode === 'server') {
                try {
                    availableThemes = (await serverStorage.listThemes()).map(theme => theme.id || theme.name).filter(Boolean);
                } catch (error) {}
            }
            $('#themes option, #theme option').each(function() {
                let val = $(this).val();
                if (val) availableThemes.push(val.replace('.css', '').replace('.less', ''));
            });
            if (typeof settings !== 'undefined' && settings.visual_theme) {
                availableThemes.push(settings.visual_theme.replace('.css', ''));
            }
            availableThemes.push(currentTheme); // 确保当前主题一定不会被当做幽灵
            
            // 过滤出存在于数据库，但不存在于酒馆本地的主题（即已经卸载的主题）
            const ghostStats = allStats.filter(stat => !availableThemes.includes(stat.theme));

            let globalThemesHtml = `
                <div class="bgm-storage-card" style="margin-top:10px;">
                    <div class="bgm-storage-title"><i class="fa-solid fa-ghost"></i> 卸载主题残留清理</div>
                    <div class="bgm-storage-desc">
                        这里只显示你<strong>已经从酒馆删除/卸载</strong>，但仍残留换图数据的主题。<br>
                        （当前仍在列表中的主题不会在此显示）
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px; max-height:220px; overflow-y:auto; padding-right:5px;">
            `;
            if (ghostStats.length === 0) {
                globalThemesHtml += `<div style="opacity:0.5; text-align:center; padding:10px;">没有任何卸载残留</div>`;
            } else {
                ghostStats.forEach(stat => {
                    globalThemesHtml += `
                        <div class="bgm-global-item">
                            <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                                <strong style="font-size:0.95em; font-weight:normal; display:flex; align-items:center; gap:6px;"><i class="fa-solid fa-file-css" style="opacity:0.5;"></i> ${escapeHtml(stat.theme)}</strong>
                                <span style="font-size:0.8em; opacity:0.6; font-family:monospace;">残留数据: ${stat.sizeMB} MB</span>
                            </div>
                            <div class="bgm-icon-btn bgm-btn-del-theme" data-theme="${escapeHtml(stat.theme)}" title="删除此残留数据"><i class="fa-solid fa-trash"></i></div>
                        </div>
                    `;
                });
            }
            globalThemesHtml += `</div></div>`;

            const updateMessage = escapeHtml(extensionUpdateState.message);
            let html = `
                <div class="bgm-storage-card">
                    <div class="bgm-storage-title"><i class="fa-solid fa-hard-drive"></i> 存储设置</div>
                    <div class="bgm-storage-desc">当前配置和替换图片的保存位置。</div>
                    <div class="bgm-storage-stats">
                        <span>${storageLabel()}</span>
                        <span>${serverStorage.mode === 'server' ? '已连接' : '后端未连接'}</span>
                    </div>
                    <button class="bgm-btn-action safe" id="action-detect-backend">重新检测后端</button>
                </div>

                <div class="bgm-storage-card" style="margin-top:10px;">
                    <div class="bgm-storage-title"><i class="fa-solid fa-cloud-arrow-down"></i> 扩展更新</div>
                    <div class="bgm-storage-desc">${updateMessage}</div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="bgm-btn-action safe" id="action-check-update">检查更新</button>
                        ${extensionUpdateState.canUpdate ? '<button class="bgm-btn-action safe" id="action-update-extension">立即更新</button>' : ''}
                    </div>
                </div>

                <div class="bgm-storage-card">
                    <div class="bgm-storage-title"><i class="fa-solid fa-magnifying-glass"></i> 当前主题扫描清理</div>
                    <div class="bgm-storage-desc">
                        当你删除了原 CSS 中的某些图片代码后，插件内仍会保留那些替换图的数据。<br>
                        定期清理这些失效缓存，可以大幅提升加载速度。
                    </div>
                    <div class="bgm-storage-stats">
                        <span>发现失效废弃缓存: <strong>${zombieKeys.length}</strong> 个</span>
                        <span>占用体积: <strong>${zombieSizeMB.toFixed(2)} MB</strong></span>
                    </div>
                    ${zombieKeys.length > 0 ? 
                        `<button class="bgm-btn-action safe" id="action-clean-zombies">一键清理上述冗余数据</button>` 
                        : `<button class="bgm-btn-action" style="opacity:0.5; cursor:not-allowed;" disabled>目前很干净，无需清理</button>`
                    }
                </div>

                ${globalThemesHtml}

                <div class="bgm-storage-card" style="margin-top:10px; border-color:rgba(229, 115, 115, 0.3);">
                    <div class="bgm-storage-title" style="color:#e57373;"><i class="fa-solid fa-triangle-exclamation"></i> 终极重置 </div>
                    <div class="bgm-storage-desc">
                        这将<strong>彻底清空</strong>该插件产生的所有 IndexedDB 数据库。<br>
                        所有主题的配置和预设将清空。当插件出现严重故障时使用。
                    </div>
                    <button class="bgm-btn-action nuke" id="action-nuke-db">清空数据库</button>
                </div>
            `;
            $popup.find('#panel-storage').html(html);

            $popup.find('#action-detect-backend').on('click', async function() {
                $(this).prop('disabled', true).text('检测中...');
                let mode;
                try { mode = await serverStorage.detect(true, panelAbortController.signal); }
                catch (error) { if (error && error.name === 'AbortError') return; throw error; }
                if (popupClosed) return;
                if (window.toastr) {
                    if (mode === 'server') toastr.success(`后端连接成功：${serverStorage.baseUrl}`);
                    else toastr.error(`后端未连接${serverStorage.lastError ? `：${serverStorage.lastError}` : ''}`);
                }
                await renderStorage();
            });

            $popup.find('#action-check-update').on('click', async function() {
                $(this).prop('disabled', true).text('检查中...');
                await checkExtensionUpdate(panelAbortController.signal);
                if (popupClosed) return;
                if (window.toastr) {
                    const level = extensionUpdateState.phase === 'error' ? 'error' : 'success';
                    toastr[level](extensionUpdateState.message);
                }
                await renderStorage();
            });

            $popup.find('#action-update-extension').on('click', async function() {
                $(this).prop('disabled', true).text('更新中...');
                await updateExtension();
            });

            $popup.find('#action-clean-zombies').on('click', async function() {
                zombieKeys.forEach(k => delete currentData[k]);
                await BGMData.saveForTheme(currentTheme, currentData);
                await clearActivePreset(currentTheme);
                blobCache.forEach(url => URL.revokeObjectURL(url));
                blobCache.clear();
                if (window.toastr) toastr.success(`成功释放 ${zombieSizeMB.toFixed(2)} MB 空间！`);
                await renderStorage();
            });

            $popup.find('.bgm-btn-del-theme').on('click', async function() {
                const themeToDel = $(this).attr('data-theme');
                if (confirm(`确定要彻底删除残留主题 "${themeToDel}" 的所有换图数据和预设吗？\n该操作不可逆！`)) {
                    await BGMData.deleteThemeData(themeToDel);
                    if (window.toastr) toastr.success(`已清理 ${themeToDel} 的残留数据`);
                    await renderStorage();
                }
            });

            $popup.find('#action-nuke-db').on('click', async function() {
                if (confirm("您正在尝试清空整个插件数据库！\n您的所有配置都会被永久删除。\n\n确定要继续吗？")) {
                    if (prompt("为防止误触，请输入大写字母 YES 确认执行:") === "YES") {
                        try {
                            $popup.find('#action-nuke-db').text("执行中...").css("opacity", "0.5");
                            await BGMData.clearAllDatabase();
                            blobCache.forEach(url => URL.revokeObjectURL(url));
                            blobCache.clear();
                            isNukingDB = false; 
                            if (window.toastr) toastr.success("数据库已清空");
                            $(`#${INJECT_STYLE_ID}`).remove(); 
                            refreshList(); 
                        } catch(e) { 
                            alert("清空失败，请手动清除浏览器缓存。"); 
                            isNukingDB = false;
                        }
                    }
                }
            });
        };

        $popup.find('#btn-clear-current').on('click', async function() {
            if (confirm(`确定要清空当前主题 (${currentTheme}) 的所有图片替换吗？\n(这不会删除您保存的预设)`)) {
                await BGMData.saveForTheme(currentTheme, {});
                await clearActivePreset(currentTheme);
                await applyInjectedOverrides();
                if (window.toastr) toastr.success("已重置本主题配置");
                refreshList();
            }
        });

        let currentTargetUrl = '';
        $popup.find('.bgm-btn-replace').on('click', function() {
            currentTargetUrl = $(this).attr('data-target');
            $popup.find('#bgm-file-input').click();
        });

        // 核心修复：这里不再使用 FileReader，而是直接保存二进制 File 对象
        $popup.find('#bgm-file-input').on('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const theme = getCurrentThemeName();
            const data = await BGMData.loadForTheme(theme);
            
            data[currentTargetUrl] = file; // 直接存储文件对象（Blob）
            
            await BGMData.saveForTheme(theme, data);
            await clearActivePreset(theme);
            await applyInjectedOverrides();
            if (window.toastr) toastr.success(`图片已保存`);
            refreshList();
            
            $(this).val(''); // 清空文件选择器
        });

        $popup.find('.bgm-btn-reset').on('click', async function() {
            const targetUrl = $(this).attr('data-target');
            const theme = getCurrentThemeName();
            const data = await BGMData.loadForTheme(theme);
            if (data[targetUrl]) {
                delete data[targetUrl];
                await BGMData.saveForTheme(theme, data);
                await clearActivePreset(theme);
                await applyInjectedOverrides();
                if (window.toastr) toastr.success("已恢复原样式");
                refreshList();
            }
        });
    }

    const extensionUpdateState = {
        phase: 'idle',
        message: '点击检查 GitHub 是否有更新',
        canUpdate: false,
        latestVersion: '',
        extensionName: EXTENSION_DEFAULT_FOLDER,
        global: false
    };

    function getInstalledExtensionName() {
        const scripts = Array.from(document.scripts || []);
        const source = INITIAL_SCRIPT_URL || scripts.find(script => /\/scripts\/extensions\/(?:third-party\/)?Beautify-and-Replace-Image\/index\.js(?:[?#]|$)/i.test(script.src || ''))?.src || '';
        const match = source.match(/\/scripts\/extensions\/(?:third-party\/)?([^/]+)\/index\.js(?:[?#]|$)/i);
        return match ? decodeURIComponent(match[1]) : EXTENSION_DEFAULT_FOLDER;
    }

    async function requestExtensionApi(endpoint, options = {}) {
        const names = Array.from(new Set([options.extensionName, getInstalledExtensionName(), EXTENSION_DEFAULT_FOLDER].filter(Boolean)));
        const scopes = options.global === undefined ? [false, true] : [!!options.global];
        let lastError = '扩展更新接口不可用';
        for (const extensionName of names) {
            for (const global of scopes) {
                const headers = { 'Content-Type': 'application/json' };
                if (window.token) headers['X-CSRF-Token'] = window.token;
                const response = await fetch(`/api/extensions/${endpoint}`, {
                    method: 'POST', headers,
                    body: JSON.stringify({ extensionName, global }),
                    signal: options.signal
                });
                if (response.ok) return { data: await response.json(), extensionName, global };
                lastError = (await response.text()) || response.statusText || lastError;
                if (response.status !== 404) break;
            }
        }
        throw new Error(lastError);
    }

    async function getLatestManifestVersion(signal = null) {
        try {
            const response = await fetch(`${EXTENSION_RAW_MANIFEST_URL}?bri=${Date.now()}`, { cache: 'no-store', signal });
            if (!response.ok) return '';
            const manifest = await response.json();
            return String(manifest.version || '').trim();
        } catch (error) { if (error && error.name === 'AbortError') throw error; return ''; }
    }

    async function checkExtensionUpdate(signal = null) {
        extensionUpdateState.phase = 'checking';
        try {
            const result = await requestExtensionApi('version', { signal });
            extensionUpdateState.extensionName = result.extensionName;
            extensionUpdateState.global = result.global;
            extensionUpdateState.latestVersion = await getLatestManifestVersion(signal);
            extensionUpdateState.canUpdate = result.data && result.data.isUpToDate === false;
            extensionUpdateState.phase = extensionUpdateState.canUpdate ? 'available' : 'latest';
            extensionUpdateState.message = extensionUpdateState.canUpdate
                ? `发现新版本${extensionUpdateState.latestVersion ? ` v${extensionUpdateState.latestVersion}` : ''}`
                : `当前已是最新版本 v${SCRIPT_VERSION}`;
        } catch (error) {
            if (error && error.name === 'AbortError') {
                extensionUpdateState.phase = 'idle';
                extensionUpdateState.message = '检查已取消';
                extensionUpdateState.canUpdate = false;
                return extensionUpdateState;
            }
            extensionUpdateState.phase = 'error';
            extensionUpdateState.canUpdate = false;
            extensionUpdateState.message = `检查失败：${error.message || error}`;
        }
        return extensionUpdateState;
    }

    function waitForManagerMenu(timeout = 8000) {
        return new Promise((resolve, reject) => {
            const startedAt = Date.now();
            const check = () => {
                if ($(`#${MENU_BTN_ID}`).length) return resolve();
                if (Date.now() - startedAt >= timeout) return reject(new Error('扩展菜单未能重新初始化'));
                setTimeout(check, 100);
            };
            check();
        });
    }

    async function hotReloadUpdatedExtension() {
        if (window.__briHotReloadPromise) return window.__briHotReloadPromise;
        window.__briHotReloadPromise = (async () => {
            if (typeof window.__briHotCleanup === 'function') window.__briHotCleanup();
            const pattern = new RegExp(`/scripts/extensions/(?:third-party/)?${EXTENSION_DEFAULT_FOLDER}/index\\.js(?:[?#]|$)`, 'i');
            const scripts = Array.from(document.scripts || []).filter(item => pattern.test(item.src || ''));
            const sourceUrl = INITIAL_SCRIPT_URL || (scripts[0] && scripts[0].src) || `/scripts/extensions/third-party/${EXTENSION_DEFAULT_FOLDER}/index.js`;
            const cacheBustedUrl = new URL(sourceUrl, document.baseURI || window.location.href);
            cacheBustedUrl.searchParams.set('bri_update', String(Date.now()));
            scripts.forEach(script => script.remove());
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.type = 'module';
                script.async = true;
                script.src = cacheBustedUrl.href;
                script.onload = resolve;
                script.onerror = () => reject(new Error('重新加载扩展脚本失败'));
                document.body.appendChild(script);
            });
            try {
                await waitForManagerMenu();
            } catch (moduleError) {
                const response = await fetch(cacheBustedUrl.href, { cache: 'no-store' });
                if (!response.ok) throw moduleError;
                const source = await response.text();
                new Function(`${source}\n//# sourceURL=${cacheBustedUrl.href}`)();
                await waitForManagerMenu();
            }
        })();
        try { await window.__briHotReloadPromise; } finally { window.__briHotReloadPromise = null; }
    }

    async function updateExtension() {
        extensionUpdateState.phase = 'updating';
        try {
            const result = await requestExtensionApi('update', {
                extensionName: extensionUpdateState.extensionName,
                global: extensionUpdateState.global
            });
            if (result.data && result.data.isUpToDate) {
                extensionUpdateState.phase = 'latest';
                extensionUpdateState.message = `当前已是最新版本 v${SCRIPT_VERSION}`;
                return;
            }
            if (window.toastr) toastr.success('扩展文件已更新，正在热加载');
            await hotReloadUpdatedExtension();
        } catch (error) {
            extensionUpdateState.phase = 'error';
            extensionUpdateState.message = `更新失败：${error.message || error}`;
            if (window.toastr) toastr.error(extensionUpdateState.message);
        }
    }

    function injectToExtensionsMenu() {
        const $menu = $('#extensionsMenu');
        if ($menu.length > 0 && $(`#${MENU_BTN_ID}`).length === 0) {
            const $menuItem = $(`
                <div id="${MENU_BTN_ID}" class="list-group-item flex-container flexGap5 interactable" title="${SCRIPT_NAME}">
                    <i class="fa-solid fa-paw"></i>
                    <span>${SCRIPT_NAME}</span>
                </div>
            `);
            $menuItem.on('click', showBgmPopup);
            $menu.append($menuItem);
        }
    }
    
    runtimeTimers.push(setTimeout(applyInjectedOverrides, 2000));
    runtimeTimers.push(setInterval(injectToExtensionsMenu, 2000));
    runtimeTimers.push(setTimeout(injectToExtensionsMenu, 500));

    window.__briHotCleanup = () => {
        runtimeTimers.splice(0).forEach(timer => { clearTimeout(timer); clearInterval(timer); });
        $('#extensionsMenu').find(`#${MENU_BTN_ID}`).remove();
        $('.bgm-overlay, .bgm-batch-modal').remove();
        $(`#${STYLE_ID}, #${INJECT_STYLE_ID}`).remove();
        const $ta = getCssTextarea();
        $ta.off('input', applyInjectedOverrides).removeData('bgm-bound');
        blobCache.forEach(url => { try { URL.revokeObjectURL(url); } catch (error) {} });
        blobCache.clear();
    };

})();
