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
