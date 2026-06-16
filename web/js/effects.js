(function() {
    var canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var starsContainer = document.getElementById('star-layer');
    var cloudsContainer = document.getElementById('sky-clouds');

    var EFF_KEY = 'vibeoj_effects_enabled';
    var effectsEnabled = localStorage.getItem(EFF_KEY);
    if (effectsEnabled === null) effectsEnabled = 'true';
    effectsEnabled = effectsEnabled === 'true';

    function applyEffects(enabled) {
        if (canvas) canvas.style.display = enabled ? 'block' : 'none';
        if (starsContainer) starsContainer.style.display = enabled ? 'block' : 'none';
        if (cloudsContainer) cloudsContainer.style.display = enabled ? 'block' : 'none';
    }

    var particles = [];
    var maxParticles = 80;
    var width, height;
    var animId;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    function initParticles() {
        particles = [];
        for (var i = 0; i < maxParticles; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 2.5 + 0.8,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35,
                opacity: Math.random() * 0.5 + 0.2,
                pulse: Math.random() * 6.28
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            p.pulse += 0.015;
            var alpha = p.opacity + Math.sin(p.pulse) * 0.2;
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < -10) p.x = width + 10;
            if (p.x > width + 10) p.x = -10;
            if (p.y < -10) p.y = height + 10;
            if (p.y > height + 10) p.y = -10;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, Math.min(1, alpha)) + ')';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(253,187,45,' + Math.max(0, Math.min(1, alpha * 0.25)) + ')';
            ctx.fill();
        }
        animId = requestAnimationFrame(draw);
    }

    function startEffects() {
        resize();
        initParticles();
        animId = requestAnimationFrame(draw);
    }

    function stopEffects() {
        if (animId) cancelAnimationFrame(animId);
    }

    if (effectsEnabled) {
        startEffects();
        applyEffects(true);
    } else {
        applyEffects(false);
    }

    window.addEventListener('resize', function() {
        if (effectsEnabled) resize();
    });

    window.toggleEffects = function(enabled) {
        effectsEnabled = enabled;
        if (enabled) {
            startEffects();
        } else {
            stopEffects();
        }
        applyEffects(enabled);
        localStorage.setItem(EFF_KEY, enabled);
    };
})();
