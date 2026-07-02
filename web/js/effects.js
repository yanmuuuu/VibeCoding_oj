(function() {
    var bgLayer = document.getElementById('bg-layer');
    if (!bgLayer) return;

    var MODE_KEY = 'vibeoj_bg_mode';
    var BLUR_KEY = 'vibeoj_bg_blur';
    var USE_CUSTOM_KEY = 'vibeoj_use_custom_bg';
    var PREFS_VERSION_KEY = 'vibeoj_prefs_version';
    var PREFS_VERSION = '2';

    if (localStorage.getItem(PREFS_VERSION_KEY) !== PREFS_VERSION) {
        localStorage.setItem(MODE_KEY, 'leet');
        localStorage.setItem(USE_CUSTOM_KEY, '0');
        localStorage.setItem(BLUR_KEY, '0');
        localStorage.removeItem('vibeoj_custom_bg_url');
        localStorage.setItem('miooj_editor_theme', 'ace/theme/chrome');
        localStorage.setItem(PREFS_VERSION_KEY, PREFS_VERSION);
    }

    var bgMode = localStorage.getItem(MODE_KEY);
    if (bgMode === null) bgMode = 'leet';
    bgMode = bgMode === 'album' ? 'album' : 'leet';

    var blurPx = parseInt(localStorage.getItem(BLUR_KEY)) || 0;

    var useCustomBg = localStorage.getItem(USE_CUSTOM_KEY);
    if (useCustomBg === null || useCustomBg === '') useCustomBg = 'false';
    else if (useCustomBg === '0') useCustomBg = 'false';
    else useCustomBg = null;
    var cachedCustomBgUrl = localStorage.getItem('vibeoj_custom_bg_url');

    function applyBlur(px) {
        blurPx = px;
        bgLayer.style.filter = 'blur(' + px + 'px)';
        localStorage.setItem(BLUR_KEY, px);
    }

    function applyMode(mode) {
        if (mode === 'album') {
            document.body.classList.remove('lc-white');
            bgLayer.style.display = 'block';
        } else {
            document.body.classList.add('lc-white');
            bgLayer.style.display = 'none';
        }
    }

    function preloadImage(url) {
        return new Promise(function(resolve, reject) {
            var img = new Image();
            img.onload = function() { resolve(); };
            img.onerror = function() { reject(); };
            img.src = url;
        });
    }

    function setBackgroundUrl(url) {
        preloadImage(url).then(function() {
            bgLayer.style.backgroundImage = 'url(' + url + ')';
        }).catch(function() {});
    }

    function setRandomBackground(images) {
        if (!images || images.length === 0) return;
        var idx = Math.floor(Math.random() * images.length);
        setBackgroundUrl(images[idx]);
    }

    function fetchSystemBackgrounds() {
        return fetch('/api/backgrounds', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(images) {
                if (Array.isArray(images)) setRandomBackground(images);
            })
            .catch(function() {});
    }

    function loadBackground() {
        if (bgMode !== 'album') return;
        fetch('/api/user/profile', { credentials: 'same-origin' })
            .then(function(r) { return r.json(); })
            .then(function(profile) {
                if (profile.background_url) {
                    cachedCustomBgUrl = profile.background_url;
                    localStorage.setItem('vibeoj_custom_bg_url', cachedCustomBgUrl);
                    if (useCustomBg !== 'false') {
                        setBackgroundUrl(profile.background_url);
                    } else {
                        fetchSystemBackgrounds();
                    }
                } else {
                    useCustomBg = null;
                    localStorage.setItem(USE_CUSTOM_KEY, '');
                    cachedCustomBgUrl = null;
                    localStorage.setItem('vibeoj_custom_bg_url', '');
                    fetchSystemBackgrounds();
                }
                updateUseCustomBgToggle();
            })
            .catch(function() {
                fetchSystemBackgrounds();
            });
    }

    window.refreshBackground = function() {
        if (bgMode !== 'album') return;
        loadBackground();
    };

    window.getUseCustomBg = function() {
        return useCustomBg !== 'false' && !!cachedCustomBgUrl;
    };

    window.setUseCustomBg = function(enabled) {
        useCustomBg = enabled ? null : 'false';
        localStorage.setItem(USE_CUSTOM_KEY, useCustomBg === null ? '' : '0');
        if (bgMode === 'album') {
            if (enabled && cachedCustomBgUrl) {
                setBackgroundUrl(cachedCustomBgUrl);
            } else if (!enabled) {
                fetchSystemBackgrounds();
            }
        }
        updateUseCustomBgToggle();
    };

    window.refreshUseCustomBgUI = function() {
        updateUseCustomBgToggle();
    };

    function updateUseCustomBgToggle() {
        var toggleEl = document.getElementById('toggle-use-custom-bg');
        var settingRow = document.getElementById('setting-use-custom-bg');
        if (!toggleEl || !settingRow) return;
        if (cachedCustomBgUrl) {
            settingRow.style.display = 'flex';
            if (useCustomBg !== 'false') {
                toggleEl.classList.add('on');
            } else {
                toggleEl.classList.remove('on');
            }
        } else {
            settingRow.style.display = 'none';
            toggleEl.classList.remove('on');
        }
        updateDeleteBgBtn();
    }

    applyBlur(blurPx);
    applyMode(bgMode);
    loadBackground();

    window.toggleEffects = function(enabled) {
        bgMode = enabled ? 'album' : 'leet';
        localStorage.setItem(MODE_KEY, bgMode);
        applyMode(bgMode);
        if (enabled) loadBackground();
    };

    window.setBackgroundBlur = function(px) {
        applyBlur(px);
    };

    window.deleteCustomBackground = function() {
        return fetch('/api/backgrounds/delete', {
            method: 'POST',
            credentials: 'same-origin'
        }).then(function(r) {
            if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || '删除失败'); });
            return r.json();
        }).then(function() {
            useCustomBg = null;
            localStorage.setItem(USE_CUSTOM_KEY, '');
            cachedCustomBgUrl = null;
            localStorage.setItem('vibeoj_custom_bg_url', '');
            if (bgMode === 'album') {
                fetchSystemBackgrounds();
            }
            updateUseCustomBgToggle();
            return true;
        });
    };

    window.resetAllBackgrounds = function() {
        var promises = [];
        if (cachedCustomBgUrl) {
            promises.push(fetch('/api/backgrounds/delete', {
                method: 'POST',
                credentials: 'same-origin'
            }).then(function(r) {
                if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || '删除失败'); });
                return r.json();
            }).catch(function() {}));
        }
        return Promise.all(promises).then(function() {
            useCustomBg = null;
            localStorage.setItem(USE_CUSTOM_KEY, '');
            cachedCustomBgUrl = null;
            localStorage.setItem('vibeoj_custom_bg_url', '');

            bgMode = 'leet';
            localStorage.setItem(MODE_KEY, 'leet');
            applyMode('leet');

            applyBlur(0);
            var blurSlider = document.getElementById('blur-slider');
            var blurLabel = document.getElementById('blur-value-label');
            if (blurSlider) blurSlider.value = 0;
            if (blurLabel) blurLabel.textContent = '0px';

            var toggleEff = document.getElementById('toggle-effects');
            if (toggleEff) toggleEff.classList.remove('on');

            localStorage.setItem('miooj_editor_theme', 'ace/theme/chrome');
            updateUseCustomBgToggle();
            return true;
        });
    };

    function updateDeleteBgBtn() {
        var btn = document.getElementById('delete-bg-btn');
        if (!btn) return;
        btn.style.display = cachedCustomBgUrl ? 'inline-block' : 'none';
    }

    window.refreshDeleteBgBtn = function() {
        updateDeleteBgBtn();
    };

    window.uploadBackground = function(file) {
        var formData = new FormData();
        formData.append('background', file);
        return fetch('/api/backgrounds/upload', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        }).then(function(r) {
            if (!r.ok) return r.json().then(function(d) { throw new Error(d.error || '上传失败'); });
            return r.json();
        }).then(function(data) {
            return preloadImage(data.url).then(function() {
                bgLayer.style.backgroundImage = 'url(' + data.url + ')';
                cachedCustomBgUrl = data.url;
                localStorage.setItem('vibeoj_custom_bg_url', data.url);
                useCustomBg = null;
                localStorage.setItem(USE_CUSTOM_KEY, '');
                updateUseCustomBgToggle();
                return data;
            });
        });
    };

    window.uploadAvatarFile = function(file) {
        var formData = new FormData();
        formData.append('avatar', file);
        return API.uploadAvatar(formData).then(function(data) {
            if (App.user) App.user.avatar_url = data.url;
            App.updateNavAvatar();
            if (typeof window.refreshUserCenterAvatar === 'function') {
                window.refreshUserCenterAvatar();
            }
            return data;
        });
    };

    window.showCropModal = function(file) {
        return window.showCropModalWithRatio(file, window.innerWidth / window.innerHeight);
    };

    window.showAvatarCropModal = function(file) {
        return window.showCropModalWithRatio(file, 1, true);
    };

    window.showCropModalWithRatio = function(file, viewportRatio, circular) {
        circular = circular || false;
        return new Promise(function(resolve, reject) {
            var modal = document.getElementById('crop-modal');
            var canvas = document.getElementById('crop-canvas');
            var ctx = canvas.getContext('2d');
            var closeBtn = document.getElementById('crop-close');
            var cancelBtn = document.getElementById('crop-cancel');
            var confirmBtn = document.getElementById('crop-confirm');

            var img = new Image();
            var imgLoaded = false;
            var crop = { x: 0, y: 0, w: 0, h: 0 };

            var dragging = false;
            var dragMode = ''; // 'move', 'br', 'bl', 'tr', 'tl', 'b', 'l', 't', 'r'
            var dragStartMouse = { x: 0, y: 0 };
            var dragStartCrop = { x: 0, y: 0, w: 0, h: 0 };

            function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

            function getMouse(e) {
                var rect = canvas.getBoundingClientRect();
                var scaleX = canvas.width / rect.width;
                var scaleY = canvas.height / rect.height;
                return {
                    x: (e.clientX - rect.left) * scaleX,
                    y: (e.clientY - rect.top) * scaleY
                };
            }

            function draw() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                var cx = crop.x, cy = crop.y, cw = crop.w, ch = crop.h;

                if (circular) {
                    var cr = Math.min(cw, ch) / 2;
                    var centerX = cx + cw / 2;
                    var centerY = cy + ch / 2;

                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(0, 0, canvas.width, canvas.height);
                    ctx.arc(centerX, centerY, cr, 0, Math.PI * 2, true);
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                    ctx.fill();
                    ctx.restore();

                    ctx.beginPath();
                    ctx.arc(centerX, centerY, cr, 0, Math.PI * 2);
                    ctx.strokeStyle = '#fdbb2d';
                    ctx.lineWidth = 2.5;
                    ctx.stroke();

                    var handleSize = 10;
                    ctx.fillStyle = '#fdbb2d';
                    var handles = [
                        { x: centerX, y: centerY - cr },
                        { x: centerX, y: centerY + cr },
                        { x: centerX - cr, y: centerY },
                        { x: centerX + cr, y: centerY }
                    ];
                    handles.forEach(function(p) {
                        ctx.fillRect(p.x - handleSize/2, p.y - handleSize/2, handleSize, handleSize);
                    });
                } else {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                    ctx.fillRect(0, 0, canvas.width, cy);
                    ctx.fillRect(0, cy + ch, canvas.width, canvas.height - cy - ch);
                    ctx.fillRect(0, cy, cx, ch);
                    ctx.fillRect(cx + cw, cy, canvas.width - cx - cw, ch);

                    ctx.strokeStyle = '#fdbb2d';
                    ctx.lineWidth = 2.5;
                    ctx.strokeRect(cx, cy, cw, ch);

                    var handleSize = 10;
                    ctx.fillStyle = '#fdbb2d';
                    var corners = [
                        { x: cx, y: cy },
                        { x: cx + cw, y: cy },
                        { x: cx, y: cy + ch },
                        { x: cx + cw, y: cy + ch }
                    ];
                    corners.forEach(function(p) {
                        ctx.fillRect(p.x - handleSize/2, p.y - handleSize/2, handleSize, handleSize);
                    });
                }
            }

            function getHandleAt(mx, my) {
                var cx = crop.x, cy = crop.y, cw = crop.w, ch = crop.h;
                var r = 10;
                if (circular) {
                    var centerX = cx + cw / 2;
                    var centerY = cy + ch / 2;
                    var cr = Math.min(cw, ch) / 2;
                    if (Math.abs(mx - centerX) < r && Math.abs(my - (centerY - cr)) < r) return 't';
                    if (Math.abs(mx - centerX) < r && Math.abs(my - (centerY + cr)) < r) return 'b';
                    if (Math.abs(my - centerY) < r && Math.abs(mx - (centerX - cr)) < r) return 'l';
                    if (Math.abs(my - centerY) < r && Math.abs(mx - (centerX + cr)) < r) return 'r';
                    var dist = Math.sqrt((mx - centerX) * (mx - centerX) + (my - centerY) * (my - centerY));
                    if (dist <= cr) return 'move';
                    return '';
                }
                if (Math.abs(mx - cx) < r && Math.abs(my - cy) < r) return 'tl';
                if (Math.abs(mx - (cx + cw)) < r && Math.abs(my - cy) < r) return 'tr';
                if (Math.abs(mx - cx) < r && Math.abs(my - (cy + ch)) < r) return 'bl';
                if (Math.abs(mx - (cx + cw)) < r && Math.abs(my - (cy + ch)) < r) return 'br';
                if (mx >= cx + r && mx <= cx + cw - r && Math.abs(my - cy) < 8) return 't';
                if (mx >= cx + r && mx <= cx + cw - r && Math.abs(my - (cy + ch)) < 8) return 'b';
                if (my >= cy + r && my <= cy + ch - r && Math.abs(mx - cx) < 8) return 'l';
                if (my >= cy + r && my <= cy + ch - r && Math.abs(mx - (cx + cw)) < 8) return 'r';
                if (mx >= cx && mx <= cx + cw && my >= cy && my <= cy + ch) return 'move';
                return '';
            }

            function updateCursor(e) {
                var m = getMouse(e);
                var h = getHandleAt(m.x, m.y);
                var cursors = {
                    'tl': 'nwse-resize', 'br': 'nwse-resize',
                    'tr': 'nesw-resize', 'bl': 'nesw-resize',
                    't': 'ns-resize', 'b': 'ns-resize',
                    'l': 'ew-resize', 'r': 'ew-resize',
                    'move': 'move'
                };
                canvas.style.cursor = cursors[h] || 'crosshair';
            }

            function updateCropFromResize(mx, my, mode) {
                var ocx = dragStartCrop.x, ocy = dragStartCrop.y, ocw = dragStartCrop.w, och = dragStartCrop.h;
                var dx = mx - dragStartMouse.x;
                var dy = my - dragStartMouse.y;
                var newCrop = { x: ocx, y: ocy, w: ocw, h: och };
                var ratio = viewportRatio;

                if (mode === 'br') {
                    newCrop.w = clamp(ocw + dx, 40, canvas.width - ocx);
                    newCrop.h = newCrop.w / ratio;
                    if (newCrop.h > canvas.height - ocy) {
                        newCrop.h = clamp(och + dy, 40, canvas.height - ocy);
                        newCrop.w = newCrop.h * ratio;
                    }
                } else if (mode === 'bl') {
                    newCrop.x = clamp(ocx + dx, 0, ocx + ocw - 40);
                    newCrop.w = ocx + ocw - newCrop.x;
                    newCrop.h = newCrop.w / ratio;
                    if (newCrop.h > canvas.height - ocy) {
                        newCrop.h = clamp(och + dy, 40, canvas.height - ocy);
                        newCrop.w = newCrop.h * ratio;
                        newCrop.x = ocx + ocw - newCrop.w;
                    }
                } else if (mode === 'tr') {
                    newCrop.w = clamp(ocw + dx, 40, canvas.width - ocx);
                    newCrop.y = ocy;
                    newCrop.h = newCrop.w / ratio;
                    if (ocy + newCrop.h > canvas.height) {
                        newCrop.h = clamp(och - dy, 40, ocy + och);
                        newCrop.y = ocy + och - newCrop.h;
                        newCrop.w = newCrop.h * ratio;
                    }
                } else if (mode === 'tl') {
                    newCrop.x = clamp(ocx + dx, 0, ocx + ocw - 40);
                    newCrop.w = ocx + ocw - newCrop.x;
                    newCrop.y = ocy;
                    newCrop.h = newCrop.w / ratio;
                    if (ocy + newCrop.h > ocy + och) {
                        newCrop.h = clamp(och - dy, 40, ocy + och);
                        newCrop.y = ocy + och - newCrop.h;
                        newCrop.w = newCrop.h * ratio;
                        newCrop.x = ocx + ocw - newCrop.w;
                    }
                } else if (mode === 'b') {
                    newCrop.h = clamp(och + dy, 40, canvas.height - ocy);
                    newCrop.w = newCrop.h * ratio;
                    if (newCrop.w > canvas.width - ocx) {
                        newCrop.w = clamp(ocw, 40, canvas.width - ocx);
                        newCrop.h = newCrop.w / ratio;
                    }
                } else if (mode === 't') {
                    newCrop.h = clamp(och - dy, 40, ocy + och);
                    newCrop.y = ocy + och - newCrop.h;
                    newCrop.w = newCrop.h * ratio;
                    if (ocx + newCrop.w > canvas.width) {
                        newCrop.w = clamp(ocw, 40, canvas.width - ocx);
                        newCrop.h = newCrop.w / ratio;
                        newCrop.y = ocy + och - newCrop.h;
                    }
                } else if (mode === 'r') {
                    newCrop.w = clamp(ocw + dx, 40, canvas.width - ocx);
                    newCrop.h = newCrop.w / ratio;
                    if (newCrop.h > canvas.height - ocy) {
                        newCrop.h = clamp(och, 40, canvas.height - ocy);
                        newCrop.w = newCrop.h * ratio;
                    }
                } else if (mode === 'l') {
                    newCrop.x = clamp(ocx + dx, 0, ocx + ocw - 40);
                    newCrop.w = ocx + ocw - newCrop.x;
                    newCrop.h = newCrop.w / ratio;
                    if (newCrop.h > canvas.height - ocy) {
                        newCrop.h = clamp(och, 40, canvas.height - ocy);
                        newCrop.w = newCrop.h * ratio;
                        newCrop.x = ocx + ocw - newCrop.w;
                    }
                }

                // final clamp
                newCrop.x = clamp(newCrop.x, 0, canvas.width - 1);
                newCrop.y = clamp(newCrop.y, 0, canvas.height - 1);
                newCrop.w = clamp(newCrop.w, 40, canvas.width - newCrop.x);
                newCrop.h = clamp(newCrop.h, 40, canvas.height - newCrop.y);

                // re-enforce aspect ratio
                var bestW = Math.min(newCrop.w, (canvas.height - newCrop.y) * ratio);
                var bestH = Math.min(newCrop.h, (canvas.width - newCrop.x) / ratio);
                if (bestW / ratio < bestH) {
                    newCrop.w = bestW;
                    newCrop.h = bestW / ratio;
                } else {
                    newCrop.h = bestH;
                    newCrop.w = bestH * ratio;
                }

                newCrop.x = clamp(newCrop.x, 0, canvas.width - newCrop.w);
                newCrop.y = clamp(newCrop.y, 0, canvas.height - newCrop.h);

                crop.x = newCrop.x;
                crop.y = newCrop.y;
                crop.w = newCrop.w;
                crop.h = newCrop.h;
            }

            function onMouseDown(e) {
                if (!imgLoaded || modal.style.display === 'none') return;
                e.preventDefault();
                var m = getMouse(e);
                var mode = getHandleAt(m.x, m.y);
                if (mode) {
                    dragging = true;
                    dragMode = mode;
                    dragStartMouse = m;
                    dragStartCrop = { x: crop.x, y: crop.y, w: crop.w, h: crop.h };
                    if (mode === 'move') {
                        canvas.style.cursor = 'grabbing';
                    }
                }
            }

            function onMouseMove(e) {
                if (!imgLoaded || modal.style.display === 'none') return;
                if (dragging) {
                    var m = getMouse(e);
                    if (dragMode === 'move') {
                        var dx = m.x - dragStartMouse.x;
                        var dy = m.y - dragStartMouse.y;
                        crop.x = clamp(dragStartCrop.x + dx, 0, canvas.width - crop.w);
                        crop.y = clamp(dragStartCrop.y + dy, 0, canvas.height - crop.h);
                    } else {
                        updateCropFromResize(m.x, m.y, dragMode);
                    }
                    draw();
                } else {
                    updateCursor(e);
                }
            }

            function onMouseUp() {
                if (dragging) {
                    dragging = false;
                    dragMode = '';
                    canvas.style.cursor = 'crosshair';
                }
            }

            canvas.addEventListener('mousedown', onMouseDown);
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);

            function initCrop() {
                var ratio = viewportRatio;
                var cw = canvas.width, ch = canvas.height;
                if (cw / ch > ratio) {
                    crop.h = ch;
                    crop.w = ch * ratio;
                } else {
                    crop.w = cw;
                    crop.h = cw / ratio;
                }
                crop.x = (cw - crop.w) / 2;
                crop.y = (ch - crop.h) / 2;
            }

            function fitCanvas() {
                var maxW = window.innerWidth * 0.88;
                var maxH = window.innerHeight * 0.65;
                var iw = img.width, ih = img.height;
                var scale = Math.min(maxW / iw, maxH / ih, 1);
                canvas.width = iw * scale;
                canvas.height = ih * scale;
            }

            function getCroppedBlob() {
                var scaleX = img.width / canvas.width;
                var scaleY = img.height / canvas.height;
                var sx = crop.x * scaleX;
                var sy = crop.y * scaleY;
                var sw = crop.w * scaleX;
                var sh = crop.h * scaleY;

                var outCanvas = document.createElement('canvas');
                outCanvas.width = sw;
                outCanvas.height = sh;
                var outCtx = outCanvas.getContext('2d');
                outCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

                return new Promise(function(blobResolve) {
                    outCanvas.toBlob(function(blob) {
                        blobResolve(blob);
                    }, 'image/jpeg', 0.92);
                });
            }

            function cleanup() {
                canvas.removeEventListener('mousedown', onMouseDown);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                modal.style.display = 'none';
                if (img) { img.onload = null; img = null; }
            }

            function open() {
                modal.style.display = 'flex';
                var reader = new FileReader();
                reader.onload = function(e) {
                    img.onload = function() {
                        imgLoaded = true;
                        fitCanvas();
                        initCrop();
                        draw();
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }

            confirmBtn.onclick = function() {
                getCroppedBlob().then(function(blob) {
                    var ext = file.name.slice(file.name.lastIndexOf('.')) || '.jpg';
                    var croppedFile = new File([blob], 'cropped' + ext, { type: 'image/jpeg' });
                    cleanup();
                    resolve(croppedFile);
                }).catch(function(err) {
                    cleanup();
                    reject(err);
                });
            };

            function closeModal() {
                cleanup();
                reject(new Error('用户取消'));
            }

            closeBtn.onclick = closeModal;
            cancelBtn.onclick = closeModal;
            modal.querySelector('.crop-backdrop').onclick = closeModal;

            open();
        });
    };
})();
