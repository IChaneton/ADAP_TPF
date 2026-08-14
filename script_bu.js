// Los de la ventana — pequeñas mejoras de interacción
// Revela secciones y celdas de la galería suavemente al entrar en vista.
// Respeta prefers-reduced-motion: si el usuario lo pidió, no animamos nada.

(function () {
  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var revealTargets = document.querySelectorAll(
    "section, .gallery .cell, .window-frame, .interaction-map"
  );

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    return;
  }

  revealTargets.forEach(function (el) {
    el.style.opacity = "0";
    el.style.transform = "translateY(14px)";
    el.style.transition = "opacity 0.7s ease, transform 0.7s ease";
  });

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  revealTargets.forEach(function (el) {
    observer.observe(el);
  });
})();

// Modal de imágenes + audio testimonial
// Al hacer click en una de las composiciones menores se abre un modal con
// la imagen ampliada y se dispara su audio correspondiente. Al cerrar
// (click fuera del modal, o tecla Escape), el audio se pausa y su posición
// de reproducción queda guardada para retomarse la próxima vez.

(function () {
  var modal = document.getElementById("imapModal");
  if (!modal) return;

  var modalImg = document.getElementById("imapModalImg");
  var modalCap = document.getElementById("imapModalCap");
  var cells = document.querySelectorAll(".imap-clickable");

  var audioCache = {};
  var currentAudio = null;
  var currentKey = null;

  function storageKey(src) {
    return "imap-audio-time:" + src;
  }

  function getAudio(src) {
    if (!audioCache[src]) {
      var audio = new Audio(src);
      audio.preload = "none";
      audio.loop = true;
      audioCache[src] = audio;
    }
    return audioCache[src];
  }

  function openModal(cell) {
    var img = cell.querySelector("img");
    var audioSrc = cell.getAttribute("data-audio");
    var label = cell.getAttribute("data-label") || "";

    modalImg.setAttribute("src", img.getAttribute("src"));
    modalImg.setAttribute("alt", img.getAttribute("alt") || "");
    modalCap.textContent = label;

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");

    if (audioSrc) {
      var audio = getAudio(audioSrc);
      var saved = parseFloat(localStorage.getItem(storageKey(audioSrc)) || "0");
      if (!isNaN(saved) && saved > 0) {
        try {
          audio.currentTime = saved;
        } catch (e) {
          /* el audio puede no estar listo todavía; se ignora */
        }
      }
      audio.play().catch(function () {
        /* reproducción bloqueada o archivo aún no disponible: se ignora */
      });
      currentAudio = audio;
      currentKey = audioSrc;
    }
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");

    if (currentAudio) {
      currentAudio.pause();
      if (currentKey) {
        try {
          localStorage.setItem(storageKey(currentKey), currentAudio.currentTime);
        } catch (e) {
          /* localStorage no disponible: se ignora */
        }
      }
      currentAudio = null;
      currentKey = null;
    }
  }

  cells.forEach(function (cell) {
    cell.setAttribute("tabindex", "0");
    cell.setAttribute("role", "button");
    cell.addEventListener("click", function () {
      openModal(cell);
    });
    cell.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(cell);
      }
    });
  });

  // cerrar únicamente al hacer click FUERA del contenido del modal
  modal.addEventListener("click", function (e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.classList.contains("open")) {
      closeModal();
    }
  });

  window.addEventListener("beforeunload", function () {
    if (currentAudio && currentKey) {
      try {
        localStorage.setItem(storageKey(currentKey), currentAudio.currentTime);
      } catch (e) {
        /* localStorage no disponible: se ignora */
      }
    }
  });
})();

// Reproductor de audio con forma de onda (sección 07 · Escuchar)
// Genera las barras, controla play/pause y anima la forma de onda.
// Si el navegador soporta Web Audio API, las barras reaccionan al audio
// real; si no, o si el audio todavía no existe, cae en una animación
// suave "idle" para que el reproductor nunca se vea roto.

(function () {
  var player = document.getElementById("audioPlayer");
  var audio = document.getElementById("playerAudio");
  if (!player || !audio) return;

  var toggle = document.getElementById("playerToggle");
  var iconPlay = toggle.querySelector(".icon-play");
  var iconPause = toggle.querySelector(".icon-pause");
  var waveform = document.getElementById("waveform");
  var elCurrent = document.getElementById("playerCurrent");
  var elDuration = document.getElementById("playerDuration");

  var BAR_COUNT = 32;
  var bars = [];
  for (var i = 0; i < BAR_COUNT; i++) {
    var bar = document.createElement("div");
    bar.className = "bar";
    bar.style.setProperty("--d", (i * 0.045).toFixed(3) + "s");
    waveform.appendChild(bar);
    bars.push(bar);
  }

  var audioCtx = null;
  var analyser = null;
  var freqData = null;
  var rafId = null;

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function setPlayingIcon(isPlaying) {
    iconPlay.style.display = isPlaying ? "none" : "";
    iconPause.style.display = isPlaying ? "" : "none";
    toggle.setAttribute("aria-label", isPlaying ? "Pausar" : "Reproducir");
    player.classList.toggle("playing", isPlaying);
  }

  function ensureAudioGraph() {
    if (audioCtx) return true;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audioCtx = new Ctx();
      var source = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // 32 bins == BAR_COUNT
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      return true;
    } catch (e) {
      audioCtx = null;
      analyser = null;
      return false;
    }
  }

  function drawFrame() {
    analyser.getByteFrequencyData(freqData);
    for (var i = 0; i < BAR_COUNT; i++) {
      var v = freqData[i] || 0;
      var pct = Math.max(8, (v / 255) * 100);
      bars[i].style.height = pct + "%";
    }
    rafId = requestAnimationFrame(drawFrame);
  }

  function startVisualizer() {
    waveform.classList.remove("idle");
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    if (analyser) {
      if (rafId) cancelAnimationFrame(rafId);
      drawFrame();
    }
  }

  function stopVisualizer() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    waveform.classList.add("idle");
  }

  toggle.addEventListener("click", function () {
    if (audio.paused) {
      ensureAudioGraph();
      audio.play().catch(function () {
        /* el archivo puede no estar disponible todavía: se ignora */
      });
    } else {
      audio.pause();
    }
  });

  waveform.addEventListener("click", function (e) {
    if (!isFinite(audio.duration) || audio.duration <= 0) return;
    var rect = waveform.getBoundingClientRect();
    var ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
  });

  audio.addEventListener("play", function () {
    setPlayingIcon(true);
    startVisualizer();
  });
  audio.addEventListener("pause", function () {
    setPlayingIcon(false);
    stopVisualizer();
  });
  audio.addEventListener("ended", function () {
    setPlayingIcon(false);
    stopVisualizer();
  });
  audio.addEventListener("loadedmetadata", function () {
    elDuration.textContent = formatTime(audio.duration);
  });
  audio.addEventListener("timeupdate", function () {
    elCurrent.textContent = formatTime(audio.currentTime);
  });
})();
