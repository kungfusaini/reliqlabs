/**
 * ReliqProjects - Project grabber styled for Reliq Studios theme
 * 
 * Fetches projects from API and displays them in a modal carousel
 * Only shows projects with group "reliqlabs"
 * 
 * Usage:
 *   ReliqProjects('#container').fetch();
 * 
 * CSS Classes (styled inline to match theme):
 *   .rp-container   - Main container
 *   .rp-grid       - Grid wrapper
 *   .rp-project    - Individual project card
 *   .rp-image      - Project image/video
 *   .rp-content    - Card content wrapper
 *   .rp-title      - Project title
 *   .rp-date       - Date
 *   .rp-description - Description
 *   .rp-tags       - Tags container
 *   .rp-tag        - Individual tag
 *   .rp-link       - Project link
 *   .rp-loading    - Loading state
 *   .rp-error      - Error state
 *   .rp-modal       - Modal overlay
 *   .rp-modal-content - Modal content wrapper
 */
(function(global) {
  'use strict';

  // Theme colors (from _variables.scss - Gruvbox Dark)
  const theme = {
    background: '#282828',
    backgroundSecondary: '#3c3836',
    color: '#fbf1c7',
    colorVariant: '#ebdbb2',
    colorSecondary: '#d5c4a1',
    borderColor: '#504945'
  };

  const ReliqProjects = function(selector, options = {}) {
    const container = typeof selector === 'string' 
      ? document.querySelector(selector) 
      : selector;

    if (!container) {
      console.error('ReliqProjects: Container not found:', selector);
      return Promise.reject(new Error('Container not found'));
    }

    const apiUrl = options.apiUrl || 'https://vulkan.sumeetsaini.com/projects/';
    const mode = options.mode || 'render'; // 'render' or 'data-only'
    const filters = { group: ['reliqlabs'], ...options.filters };

    // Modal state
    let modal = null;
    let currentSlideIndex = 0;
    let currentImages = [];
    let currentVideos = [];
    let currentProject = null;
    let isFullscreen = false;
    const imageCache = {}; // Store preloaded images
    
    // Autoscroll state
    let autoscrollInterval = null;
    const AUTOSCROLL_DELAY = 4000; // 4 seconds
    let isAutoscrollPaused = false;

    // Create loader element
    const createLoader = (width, height) => {
      const container = document.createElement('div');
      container.className = 'rp-media-loader';
      container.style.width = width || '100%';
      container.style.height = height || '200px';
      container.style.background = theme.colorVariant;
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      
      const spinner = document.createElement('div');
      spinner.className = 'rp-spinner';
      spinner.style.width = '30px';
      spinner.style.height = '30px';
      spinner.style.border = '3px solid rgba(255, 255, 255, 0.3)';
      spinner.style.borderTopColor = '#fff';
      spinner.style.borderRadius = '50%';
      spinner.style.animation = 'rp-spin 0.8s linear infinite';
      
      container.appendChild(spinner);
      return container;
    };
    
    // Add CSS for spinner animation and fluid responsive text with clamp()
    if (!document.querySelector('#rp-media-styles')) {
      const style = document.createElement('style');
      style.id = 'rp-media-styles';
      style.textContent = `
        @keyframes rp-spin {
          to { transform: rotate(360deg); }
        }
        .rp-media-loader {
          opacity: 1;
          transition: opacity 0.3s ease-out;
        }
        .rp-media-loader.rp-fade-out {
          opacity: 0;
        }
        .rp-media-content {
          opacity: 0;
          transition: opacity 0.3s ease-in;
        }
        .rp-media-content.rp-fade-in {
          opacity: 1;
        }
        /* Fluid responsive typography with clamp() */
        .rp-modal-title {
          font-size: clamp(1.25rem, 1vw + 0.75rem, 1.75rem) !important;
        }
        .rp-card-title {
          font-size: 1.25rem !important;
        }
        .rp-card-desc {
          font-size: 0.95rem !important;
        }
        .rp-tag {
          font-size: 0.85rem !important;
        }
        .rp-close-btn {
          font-size: clamp(20px, 1vw + 14px, 28px) !important;
        }
        .rp-nav-btn {
          font-size: clamp(16px, 0.8vw + 12px, 20px) !important;
        }
        /* Modal responsive size */
        .rp-modal-content {
          max-width: clamp(300px, 90vw, 1000px) !important;
          margin: 20px auto !important;
          scrollbar-width: none !important;
        }
        .rp-modal-content::-webkit-scrollbar {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Create the modal
    const createModal = () => {
      if (modal) return modal;

      modal = document.createElement('div');
      modal.className = 'rp-modal';
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100%';
      modal.style.height = '100%';
      modal.style.zIndex = '2147483647';
      modal.style.overflow = 'auto';
      modal.style.background = 'rgba(0, 0, 0, 0.85)';
      modal.style.opacity = '0';
      modal.style.visibility = 'hidden';
      modal.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
      modal.style.pointerEvents = 'none';

      const content = document.createElement('div');
      content.className = 'rp-modal-content';
      content.style.position = 'relative';
      const isMobile = window.innerWidth <= 768;
      content.style.width = isMobile ? '95%' : '50%';
      content.style.maxWidth = isMobile ? '1400px' : '600px';
      content.style.margin = '20px auto';
      content.style.background = theme.background;
      content.style.borderRadius = '8px';
      content.style.overflow = 'hidden';
      content.style.maxHeight = '90vh';
      content.style.overflowY = 'auto';
      content.style.scrollbarWidth = 'none';
      content.style.msOverflowStyle = 'none';
      content.style.fontFamily = "'Google Sans Code', Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace";
      content.style.color = theme.color;
      content.style.opacity = '0';
      content.style.transform = 'scale(0.95)';
      content.style.transition = 'opacity 0.5s ease, transform 0.5s ease';

      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'rp-modal-close rp-close-btn';
      closeBtn.innerHTML = '&times;';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '15px';
      closeBtn.style.right = '20px';
      closeBtn.classList.add('rp-close-btn');
      closeBtn.style.color = theme.color;
      closeBtn.style.background = theme.background;
      closeBtn.style.border = 'none';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.zIndex = '10000';
      closeBtn.style.borderRadius = '50%';
      closeBtn.style.width = '40px';
      closeBtn.style.height = '40px';
      closeBtn.style.lineHeight = '1';
      closeBtn.style.opacity = '0.9';
      closeBtn.style.transition = 'opacity 0.2s';

      closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
      closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.9');
      closeBtn.addEventListener('click', closeModal);
      content.appendChild(closeBtn);

      // Carousel
      const carousel = document.createElement('div');
      carousel.className = 'rp-carousel';
      carousel.style.position = 'relative';
      carousel.style.display = 'flex';
      carousel.style.flexDirection = 'column';
      carousel.style.background = theme.background;
      carousel.style.flexShrink = '0';

      // Navigation buttons container
      const navContainer = document.createElement('div');
      navContainer.className = 'rp-carousel-nav';
      navContainer.style.display = 'flex';
      navContainer.style.justifyContent = 'space-between';
      navContainer.style.alignItems = 'center';
      navContainer.style.padding = '10px';
      navContainer.style.background = theme.background;

      // Left spacer (equal to fullscreen button width)
      const leftSpacer = document.createElement('div');
      leftSpacer.style.width = '50px';
      navContainer.appendChild(leftSpacer);

      // Centered controls container
      const centerControls = document.createElement('div');
      centerControls.style.display = 'flex';
      centerControls.style.justifyContent = 'center';
      centerControls.style.alignItems = 'center';
      centerControls.style.gap = '20px';
      centerControls.style.flex = '1';

      // Calculate total slides - hide arrows/counter if only 1
      const totalSlides = Math.max(currentImages.length, currentVideos.length);
      const showNavControls = totalSlides > 1;

      const prevBtn = document.createElement('button');
      prevBtn.className = 'rp-carousel-prev rp-nav-btn';
      prevBtn.innerHTML = '&#10094;';
      prevBtn.style.color = theme.colorVariant;
      prevBtn.style.background = 'transparent';
      prevBtn.style.border = 'none';
      prevBtn.style.padding = '10px 20px';
      prevBtn.style.cursor = 'pointer';
      if (!showNavControls) prevBtn.style.display = 'none';
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSlide(currentSlideIndex - 1);
      });
      centerControls.appendChild(prevBtn);

      // Slide counter
      const slideCounter = document.createElement('span');
      slideCounter.className = 'rp-slide-counter';
      slideCounter.style.color = theme.colorVariant;
      slideCounter.style.fontSize = '0.95rem';
      slideCounter.style.padding = '0 10px';
      if (!showNavControls) slideCounter.style.display = 'none';
      centerControls.appendChild(slideCounter);

      const nextBtn = document.createElement('button');
      nextBtn.className = 'rp-carousel-next rp-nav-btn';
      nextBtn.innerHTML = '&#10095;';
      nextBtn.style.color = theme.colorVariant;
      nextBtn.style.background = 'transparent';
      nextBtn.style.border = 'none';
      nextBtn.style.padding = '10px 20px';
      nextBtn.style.cursor = 'pointer';
      if (!showNavControls) nextBtn.style.display = 'none';
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showSlide(currentSlideIndex + 1);
      });
      centerControls.appendChild(nextBtn);

      navContainer.appendChild(centerControls);

      // Fullscreen button - aligned right
      const fullscreenBtn = document.createElement('button');
      fullscreenBtn.className = 'rp-carousel-fullscreen rp-nav-btn';
      fullscreenBtn.innerHTML = '⛶';
      fullscreenBtn.style.color = theme.colorVariant;
      fullscreenBtn.style.background = 'transparent';
      fullscreenBtn.style.border = 'none';
      fullscreenBtn.style.padding = '10px 15px';
      fullscreenBtn.style.width = '50px';
      fullscreenBtn.style.cursor = 'pointer';
      fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFullscreen();
      });
      navContainer.appendChild(fullscreenBtn);

      // Image container
      const mediaContainer = document.createElement('div');
      mediaContainer.className = 'rp-media-container';
      mediaContainer.style.display = 'flex';
      mediaContainer.style.alignItems = 'center';
      mediaContainer.style.justifyContent = 'center';
      mediaContainer.style.position = 'relative';
      mediaContainer.style.width = '100%';
      mediaContainer.style.maxHeight = '70vh';
      mediaContainer.style.overflow = 'hidden';

      const loader = createLoader('100%', '300px');
      loader.className = 'rp-media-loader';
      loader.style.position = 'absolute';
      loader.style.top = '0';
      loader.style.left = '0';
      loader.style.zIndex = '5';
      loader.style.display = 'none';
      mediaContainer.appendChild(loader);

      // Slides container - holds all images stacked for fade effect
      const slidesContainer = document.createElement('div');
      slidesContainer.className = 'rp-slides-container';
      slidesContainer.style.display = 'grid';
      slidesContainer.style.gridTemplateColumns = '1fr';
      slidesContainer.style.gridTemplateRows = '1fr';
      slidesContainer.style.width = '100%';
      mediaContainer.appendChild(slidesContainer);

      carousel.appendChild(mediaContainer);
      carousel.appendChild(navContainer);

      // Add swipe support
      let touchStartX = 0;
      let touchEndX = 0;
      const minSwipeDistance = 50;

      carousel.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      carousel.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const swipeDistance = touchEndX - touchStartX;
        
        if (Math.abs(swipeDistance) > minSwipeDistance) {
          if (swipeDistance > 0) {
            // Swipe right - go to previous
            showSlide(currentSlideIndex - 1);
          } else {
            // Swipe left - go to next
            showSlide(currentSlideIndex + 1);
          }
        }
      }, { passive: true });

      // Pause autoscroll on hover/touch
      carousel.addEventListener('mouseenter', pauseAutoscroll);
      carousel.addEventListener('mouseleave', resumeAutoscroll);
      carousel.addEventListener('touchstart', pauseAutoscroll, { passive: true });
      carousel.addEventListener('touchend', resumeAutoscroll, { passive: true });

      content.appendChild(carousel);

      // Text content
      const textContent = document.createElement('div');
      textContent.className = 'rp-text-content';
      textContent.style.padding = '30px';
      textContent.style.color = '#d5c4a1';
      content.appendChild(textContent);

      modal.appendChild(content);

      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (modal.style.display === 'none') return;
        if (e.key === 'Escape') closeModal();
        if (e.key === 'ArrowLeft') showSlide(currentSlideIndex - 1);
        if (e.key === 'ArrowRight') showSlide(currentSlideIndex + 1);
      });

      document.body.appendChild(modal);
      return modal;
    };

    const showSlide = (index) => {
      if (currentImages.length === 0 && currentVideos.length === 0) return;
      
      const totalSlides = Math.max(currentImages.length, currentVideos.length);
      const newIndex = (index + totalSlides) % totalSlides;
      
      const slidesContainer = modal.querySelector('.rp-slides-container');
      const slides = slidesContainer.querySelectorAll('.rp-slide');
      
      // Fade out current slide and fade in new slide
      slides.forEach((slide, i) => {
        if (i === newIndex) {
          slide.style.opacity = '1';
          slide.style.zIndex = '1';
        } else {
          slide.style.opacity = '0';
          slide.style.zIndex = '0';
        }
      });
      
      currentSlideIndex = newIndex;
      
      // Update slide counter
      updateSlideCounter();
      
      // Reset autoscroll timer when user manually navigates
      resetAutoscroll();
    };

    // Update slide counter display
    const updateSlideCounter = () => {
      if (!modal) return;
      const counter = modal.querySelector('.rp-slide-counter');
      const totalSlides = Math.max(currentImages.length, currentVideos.length);
      if (counter && totalSlides > 0) {
        counter.textContent = `${currentSlideIndex + 1} / ${totalSlides}`;
      }
    };

    // Autoscroll functions
    const startAutoscroll = () => {
      if (autoscrollInterval) clearInterval(autoscrollInterval);
      if (currentImages.length <= 1 && currentVideos.length <= 1) return;
      
      autoscrollInterval = setInterval(() => {
        if (!isAutoscrollPaused && modal && modal.style.visibility === 'visible') {
          showSlide(currentSlideIndex + 1);
        }
      }, AUTOSCROLL_DELAY);
    };

    const stopAutoscroll = () => {
      if (autoscrollInterval) {
        clearInterval(autoscrollInterval);
        autoscrollInterval = null;
      }
    };

    const pauseAutoscroll = () => {
      isAutoscrollPaused = true;
    };

    const resumeAutoscroll = () => {
      isAutoscrollPaused = false;
      resetAutoscroll();
    };

    const resetAutoscroll = () => {
      stopAutoscroll();
      startAutoscroll();
    };

    // Build all slides for the carousel
    const buildCarouselSlides = () => {
      const slidesContainer = modal.querySelector('.rp-slides-container');
      slidesContainer.innerHTML = '';
      
      const totalSlides = Math.max(currentImages.length, currentVideos.length);
      
      for (let i = 0; i < totalSlides; i++) {
        const slide = document.createElement('div');
        slide.className = 'rp-slide';
        slide.style.gridArea = '1 / 1 / 2 / 2';
        slide.style.top = '0';
        slide.style.left = '0';
        slide.style.width = '100%';
        slide.style.height = '100%';
        slide.style.display = 'flex';
        slide.style.justifyContent = 'center';
        slide.style.alignItems = 'center';
        slide.style.opacity = i === 0 ? '1' : '0';
        slide.style.transition = 'opacity 0.5s ease';
        slide.style.zIndex = i === 0 ? '1' : '0';
        
        if (currentImages[i]) {
          const img = document.createElement('img');
          img.src = currentImages[i];
          img.alt = 'Project image';
          img.style.maxWidth = '100%';
          img.style.maxHeight = '70vh';
          img.style.objectFit = 'contain';
          slide.appendChild(img);
        } else if (currentVideos[i]) {
          const video = document.createElement('video');
          video.src = currentVideos[i];
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.style.maxWidth = '100%';
          video.style.maxHeight = '70vh';
          video.style.objectFit = 'contain';
          slide.appendChild(video);
        }
        
        slidesContainer.appendChild(slide);
      }
    };

    // Preload all images for smoother carousel navigation
    const preloadImages = (images) => {
      images.forEach(src => {
        if (!src || imageCache[src]) return;
        // Force browser to cache by using fetch with cache
        fetch(src, { mode: 'no-cors', cache: 'force-cache' }).catch(() => {});
        const img = new Image();
        img.src = src;
        img.loading = 'eager';
        imageCache[src] = true; // Mark as cached
      });
    };

    const renderProjectText = (project) => {
      const textContent = modal.querySelector('.rp-text-content');
      textContent.innerHTML = '';

      // Title
      if (project.title) {
        const title = document.createElement('h1');
        title.className = 'rp-modal-title';
        title.style.margin = '0 0 15px 0';
        title.style.fontWeight = '700';
        title.style.color = theme.colorVariant;
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.gap = '12px';
        
        const titleText = document.createElement('span');
        titleText.textContent = project.title;
        title.appendChild(titleText);
        
        // Add link icon if project has a valid link
        if (project.link && project.link !== 'none' && project.link.trim() !== '') {
          const linkIcon = document.createElement('a');
          linkIcon.href = project.link;
          linkIcon.target = '_blank';
          linkIcon.rel = 'noopener noreferrer';
          linkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${theme.colorSecondary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
          linkIcon.style.textDecoration = 'none';
          linkIcon.style.transition = 'transform 0.2s';
          linkIcon.style.display = 'inline-flex';
          linkIcon.style.alignItems = 'center';
          linkIcon.addEventListener('mouseenter', () => {
            linkIcon.style.transform = 'translateY(-2px)';
            linkIcon.querySelector('svg').style.stroke = theme.colorVariant;
          });
          linkIcon.addEventListener('mouseleave', () => {
            linkIcon.style.transform = 'translateY(0)';
            linkIcon.querySelector('svg').style.stroke = theme.colorSecondary;
          });
          title.appendChild(linkIcon);
        }
        
        textContent.appendChild(title);
      }

      // Reliq key from text object
      if (project.text && project.text.reliq) {
        const reliqText = project.text.reliq;
        const textSection = document.createElement('div');
        textSection.style.lineHeight = '1.7';
        textSection.style.color = '#d5c4a1';
        
        if (typeof reliqText === 'string') {
          if (reliqText.includes('\n')) {
            reliqText.split('\n').forEach(para => {
              if (para.trim()) {
                const p = document.createElement('p');
                p.textContent = para;
                p.style.margin = '0 0 12px 0';
                textSection.appendChild(p);
              }
            });
          } else {
            const p = document.createElement('p');
            p.textContent = reliqText;
            p.style.margin = '0';
            textSection.appendChild(p);
          }
        }
        
        textContent.appendChild(textSection);
      }

      // Tech tags
      if (project.tech && project.tech.length > 0) {
        const tagsContainer = document.createElement('div');
        tagsContainer.style.display = 'flex';
        tagsContainer.style.flexWrap = 'wrap';
        tagsContainer.style.gap = '8px';
        tagsContainer.style.justifyContent = 'center';
        tagsContainer.style.marginTop = '15px';
        
        project.tech.forEach(tech => {
          const tag = document.createElement('span');
          tag.className = 'rp-tag';
          tag.textContent = tech;
          tag.style.background = theme.backgroundSecondary;
          tag.style.color = theme.colorVariant;
          tag.style.padding = '4px 12px';
          tag.style.borderRadius = '20px';
          tagsContainer.appendChild(tag);
        });
        
        textContent.appendChild(tagsContainer);
      }

      // End of modal content
    };

    const openModal = (project) => {
      try {
      if (!modal) createModal();
      
      currentProject = project;
      currentSlideIndex = 0;
      
      // Clear previous slides
      const slidesContainer = modal.querySelector('.rp-slides-container');
      if (slidesContainer) {
        slidesContainer.innerHTML = '';
        slidesContainer.style.transform = 'translateX(0)';
      }
      
      // Get images and videos
      const images = [];
      const videos = [];
      
      if (project.images && project.images.length > 0) {
        images.push(...project.images);
      } else if (project.image) {
        images.push(project.image);
      }
      
      if (project.videos && project.videos.length > 0) {
        videos.push(...project.videos);
      } else if (project.video) {
        videos.push(project.video);
      }
      
      currentImages = images;
      currentVideos = videos;
      
      // Show/hide carousel based on media
      const carousel = modal.querySelector('.rp-carousel');
      if (images.length > 0 || videos.length > 0) {
        carousel.style.display = 'flex';
        buildCarouselSlides();
        showSlide(0);
        startAutoscroll();
      } else {
        carousel.style.display = 'none';
      }
      
      // Render text
      renderProjectText(project);
      
      // Fade in modal - use requestAnimationFrame to ensure transition happens
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          modal.style.visibility = 'visible';
          modal.style.opacity = '1';
          modal.style.pointerEvents = 'auto';
          
          const modalContent = modal.querySelector('.rp-modal-content');
          if (modalContent) {
            modalContent.style.opacity = '1';
            modalContent.style.transform = 'scale(1)';
          }
        });
      });
      
      document.body.style.overflow = 'hidden';
      } catch (error) {
        console.error('Error opening modal:', error);
        alert('Error opening project: ' + error.message);
      }
    };

    // Fullscreen overlay element
    let fullscreenOverlay = null;

    // Update fullscreen slide when navigating
    const updateFullscreenSlide = (newIndex) => {
      if (!fullscreenOverlay) return;
      
      const totalSlides = Math.max(currentImages.length, currentVideos.length);
      currentSlideIndex = (newIndex + totalSlides) % totalSlides;
      
      // Update the carousel in the modal too
      showSlide(currentSlideIndex);
      
      // Update the fullscreen image/video
      const mediaContainer = fullscreenOverlay.querySelector('.rp-fullscreen-media');
      if (mediaContainer) {
        mediaContainer.innerHTML = '';
        
        if (currentImages[currentSlideIndex]) {
          const img = document.createElement('img');
          img.src = currentImages[currentSlideIndex];
          img.alt = 'Project image';
          img.style.cssText = `
            max-width: 95vw;
            max-height: calc(100vh - 120px);
            object-fit: contain;
          `;
          mediaContainer.appendChild(img);
        } else if (currentVideos[currentSlideIndex]) {
          const video = document.createElement('video');
          video.src = currentVideos[currentSlideIndex];
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.style.cssText = `
            max-width: 95vw;
            max-height: calc(100vh - 120px);
            object-fit: contain;
          `;
          mediaContainer.appendChild(video);
        }
      }
      
      // Update the slide counter
      const counter = fullscreenOverlay.querySelector('.rp-fullscreen-counter');
      if (counter) {
        counter.textContent = `${currentSlideIndex + 1} / ${totalSlides}`;
      }
    };

    const toggleFullscreen = () => {
      const modalContent = modal.querySelector('.rp-modal-content');
      const fullscreenBtn = modal.querySelector('.rp-carousel-fullscreen');
      const currentSlide = modal.querySelectorAll('.rp-slide')[currentSlideIndex];
      
      isFullscreen = !isFullscreen;
      
if (isFullscreen) {
      // Hide the modal content
      modalContent.style.display = 'none';
      
      // Create fullscreen overlay with just the image/video
      fullscreenOverlay = document.createElement('div');
      fullscreenOverlay.className = 'rp-fullscreen-overlay';
      fullscreenOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2147483647;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;

      // Content wrapper to hold media and nav together
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'rp-fullscreen-content';
      contentWrapper.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
      `;

      // Media container (for easy updating when navigating)
      const mediaContainer = document.createElement('div');
      mediaContainer.className = 'rp-fullscreen-media';
      mediaContainer.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: center;
      `;

      // Clone the current image or video
      const img = currentSlide.querySelector('img');
      const video = currentSlide.querySelector('video');
      
      if (img) {
        const imgClone = document.createElement('img');
        imgClone.src = img.src;
        imgClone.alt = img.alt;
        imgClone.style.cssText = `
          max-width: 95vw;
          max-height: calc(100vh - 120px);
          object-fit: contain;
        `;
        mediaContainer.appendChild(imgClone);
      } else if (video) {
        const videoClone = document.createElement('video');
        videoClone.src = video.src;
        videoClone.autoplay = true;
        videoClone.loop = true;
        videoClone.muted = true;
        videoClone.playsInline = true;
        videoClone.style.cssText = `
          max-width: 95vw;
          max-height: calc(100vh - 120px);
          object-fit: contain;
        `;
        mediaContainer.appendChild(videoClone);
      }
      
      contentWrapper.appendChild(mediaContainer);
        
// Close button
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '✕';
      closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        font-size: 32px;
        color: #fff;
        background: rgba(0, 0, 0, 0.5);
        border: none;
        border-radius: 8px;
        width: 50px;
        height: 50px;
        cursor: pointer;
        z-index: 10;
      `;
      closeBtn.addEventListener('click', toggleFullscreen);
      fullscreenOverlay.appendChild(closeBtn);

      // Bottom navigation bar with controls
      const bottomNav = document.createElement('div');
      bottomNav.className = 'rp-fullscreen-nav';
      bottomNav.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 20px;
      `;

      // Prev button
      const prevBtn = document.createElement('button');
      prevBtn.innerHTML = '&#10094;';
      prevBtn.style.cssText = `
        font-size: 24px;
        color: #fff;
        background: transparent;
        border: none;
        padding: 5px 15px;
        cursor: pointer;
      `;
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateFullscreenSlide(currentSlideIndex - 1);
      });
      bottomNav.appendChild(prevBtn);

      // Slide counter
      const slideCounter = document.createElement('span');
      slideCounter.className = 'rp-fullscreen-counter';
      const totalSlides = Math.max(currentImages.length, currentVideos.length);
      slideCounter.textContent = `${currentSlideIndex + 1} / ${totalSlides}`;
      slideCounter.style.cssText = `
        color: #fff;
        font-size: 1rem;
        padding: 0 10px;
        min-width: 60px;
        text-align: center;
      `;
      bottomNav.appendChild(slideCounter);

      // Next button
      const nextBtn = document.createElement('button');
      nextBtn.innerHTML = '&#10095;';
      nextBtn.style.cssText = `
        font-size: 24px;
        color: #fff;
        background: transparent;
        border: none;
        padding: 5px 15px;
        cursor: pointer;
      `;
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateFullscreenSlide(currentSlideIndex + 1);
      });
      bottomNav.appendChild(nextBtn);

      contentWrapper.appendChild(bottomNav);
      fullscreenOverlay.appendChild(contentWrapper);

      // Close on click outside image
      fullscreenOverlay.addEventListener('click', (e) => {
        if (e.target === fullscreenOverlay) toggleFullscreen();
      });

      // Keyboard navigation
      const keyHandler = (e) => {
        if (!isFullscreen) {
          document.removeEventListener('keydown', keyHandler);
          return;
        }
        if (e.key === 'Escape') {
          toggleFullscreen();
          document.removeEventListener('keydown', keyHandler);
        } else if (e.key === 'ArrowLeft') {
          updateFullscreenSlide(currentSlideIndex - 1);
        } else if (e.key === 'ArrowRight') {
          updateFullscreenSlide(currentSlideIndex + 1);
        }
      };
      document.addEventListener('keydown', keyHandler);
        
        document.body.appendChild(fullscreenOverlay);
        
        // Trigger fade in
        requestAnimationFrame(() => {
          fullscreenOverlay.style.opacity = '1';
        });
        
        fullscreenBtn.textContent = '✕';
      } else {
        // Fade out and remove fullscreen overlay
        if (fullscreenOverlay) {
          fullscreenOverlay.style.opacity = '0';
          setTimeout(() => {
            if (fullscreenOverlay) {
              fullscreenOverlay.remove();
              fullscreenOverlay = null;
            }
          }, 300);
        }
        
        // Show modal content again
        modalContent.style.display = 'block';
        fullscreenBtn.textContent = '⛶';
      }
    };

    const closeModal = () => {
      stopAutoscroll();
      if (modal) {
        // Reset fullscreen state when closing
        isFullscreen = false;
        
        // Remove fullscreen overlay if it exists
        if (fullscreenOverlay) {
          fullscreenOverlay.remove();
          fullscreenOverlay = null;
        }
        
        // Reset modal content display
        const modalContent = modal.querySelector('.rp-modal-content');
        if (modalContent) {
          modalContent.style.display = 'block';
        }
        
        // Fade out modal
        modal.style.opacity = '0';
        
        if (modalContent) {
          modalContent.style.opacity = '0';
          modalContent.style.transform = 'scale(0.95)';
        }
        
        // Hide after transition completes
        setTimeout(() => {
          modal.style.visibility = 'hidden';
          modal.style.pointerEvents = 'none';
          document.body.style.overflow = '';
        }, 500);
      }
    };

    // Render a single project card
    const renderProject = (project) => {
      const article = document.createElement('article');
      article.className = 'rp-project';
      article.style.background = theme.background;
      article.style.borderRadius = '8px';
      article.style.overflow = 'hidden';
      article.style.border = `1px solid ${theme.borderColor}`;
      article.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
      article.style.cursor = 'pointer';
      article.style.display = 'flex';
      article.style.flexDirection = 'column';

      // Hover effects
      article.addEventListener('mouseenter', () => {
        article.style.transform = 'translateY(-5px)';
        article.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.1)';
      });
      article.addEventListener('mouseleave', () => {
        article.style.transform = 'translateY(0)';
        article.style.boxShadow = 'none';
      });

      // Video or Image
      if (project.video) {
        // Create a container for video and loader to overlap properly
        const mediaContainer = document.createElement('div');
        mediaContainer.style.position = 'relative';
        mediaContainer.style.width = '100%';
        mediaContainer.style.height = '200px';
        
        const video = document.createElement('video');
        video.src = project.video;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '200px';
        video.style.objectFit = 'cover';
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        video.className = 'rp-media-content';
        
        // Check if video is already loaded (instant load)
        if (video.readyState >= 3) {
          // Video already loaded, just show it
          video.classList.add('rp-fade-in');
          mediaContainer.appendChild(video);
          article.appendChild(mediaContainer);
        } else {
          // Video not loaded yet, show loader first
          const loader = createLoader('100%', '200px');
          loader.style.position = 'absolute';
          loader.style.top = '0';
          loader.style.left = '0';
          
          mediaContainer.appendChild(video);
          mediaContainer.appendChild(loader);
          article.appendChild(mediaContainer);
          
          video.oncanplay = function() {
            loader.classList.add('rp-fade-out');
            video.classList.add('rp-fade-in');
            // Remove loader from DOM after fade completes
            setTimeout(() => {
              if (loader.parentNode) loader.remove();
            }, 300);
          };
        }
        
        video.onerror = function() {
          const loader = mediaContainer.querySelector('.rp-media-loader');
          if (loader) loader.remove();
          const img = document.createElement('img');
          img.src = project.image || '';
          img.alt = project.title || 'Project image';
          img.loading = 'lazy';
          img.style.width = '100%';
          img.style.height = '200px';
          img.style.objectFit = 'cover';
          img.style.position = 'absolute';
          img.style.top = '0';
          img.style.left = '0';
          img.className = 'rp-media-content rp-fade-in';
          mediaContainer.appendChild(img);
          mediaContainer.removeChild(video);
        };
      } else if (project.image) {
        // Create a container for image and loader to overlap properly
        const mediaContainer = document.createElement('div');
        mediaContainer.style.position = 'relative';
        mediaContainer.style.width = '100%';
        mediaContainer.style.height = '200px';
        
        const img = document.createElement('img');
        img.src = project.image;
        img.alt = project.title || 'Project image';
        img.loading = 'lazy';
        img.style.width = '100%';
        img.style.height = '200px';
        img.style.objectFit = 'cover';
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';
        img.className = 'rp-media-content';
        
        // Check if image is already loaded (from browser cache)
        if (img.complete && img.naturalHeight !== 0) {
          // Image already loaded, just show it
          img.classList.add('rp-fade-in');
          mediaContainer.appendChild(img);
          article.appendChild(mediaContainer);
        } else {
          // Image not loaded yet, show loader first
          const loader = createLoader('100%', '200px');
          loader.style.position = 'absolute';
          loader.style.top = '0';
          loader.style.left = '0';
          
          mediaContainer.appendChild(img);
          mediaContainer.appendChild(loader);
          article.appendChild(mediaContainer);
          
          img.onload = function() {
            loader.classList.add('rp-fade-out');
            img.classList.add('rp-fade-in');
            // Remove loader from DOM after fade completes
            setTimeout(() => {
              if (loader.parentNode) loader.remove();
            }, 300);
          };
        }
        
        img.onerror = function() {
          const loader = mediaContainer.querySelector('.rp-media-loader');
          if (loader) loader.remove();
        };
      }

      // Content wrapper
      const content = document.createElement('div');
      content.className = 'rp-content';
      content.style.padding = '20px';
      content.style.display = 'flex';
      content.style.flexDirection = 'column';
      content.style.flex = '1';
      content.style.minHeight = '0';

      // Title
      if (project.title) {
        const title = document.createElement('h2');
        title.className = 'rp-title rp-card-title';
        title.textContent = project.title;
        title.style.margin = '0 0 8px 0';
        title.style.fontWeight = '600';
        title.style.color = theme.colorVariant;
        content.appendChild(title);
      }

      // Description
      if (project.description) {
        const desc = document.createElement('p');
        desc.className = 'rp-description rp-card-desc';
        desc.textContent = project.description;
        desc.style.margin = 'auto 0';
        desc.style.color = '#d5c4a1';
        desc.style.lineHeight = '1.5';
        content.appendChild(desc);
      }

      article.appendChild(content);

      // Click handler - using onclick for more reliable event handling
      article.onclick = function() {
        console.log('Card clicked:', project.title);
        openModal(project);
      };
      article.style.cursor = 'pointer';

      return article;
    };

    const renderProjects = (projects) => {
      container.innerHTML = '';
      container.className = 'rp-container';

      if (projects.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'rp-empty';
        empty.textContent = 'Portfolio coming soon.';
        empty.style.textAlign = 'center';
        empty.style.padding = '40px';
        empty.style.color = theme.colorSecondary;
        container.appendChild(empty);
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'rp-grid';
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
      grid.style.gap = '2rem';
      grid.style.marginTop = '2rem';

      projects.forEach(project => {
        grid.appendChild(renderProject(project));
      });

      container.appendChild(grid);
    };

    const applyFilters = (projects) => {
      let filtered = [...projects];

      // Filter by group (always filter for reliqstudios)
      if (filters.group && filters.group.length > 0) {
        filtered = filtered.filter(p => 
          p.group && p.group.some(g => filters.group.includes(g))
        );
      }

      // Filter by tech
      if (filters.tech && filters.tech.length > 0) {
        filtered = filtered.filter(p => 
          p.tech && p.tech.some(t => filters.tech.includes(t))
        );
      }

      // Filter by company
      if (filters.company) {
        filtered = filtered.filter(p => p.company === filters.company);
      }

      return filtered;
    };

    // Main fetch function
    const fetchProjects = async () => {
      container.className = 'rp-container rp-loading';
      container.innerHTML = '<p class="rp-loading-text" style="text-align: center; padding: 40px; color: ' + theme.colorSecondary + ';">Loading projects...</p>';

      try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const allProjects = data.projects || [];
        const filteredProjects = applyFilters(allProjects);

        if (mode === 'data-only') {
          container.className = 'rp-container';
          container.innerHTML = '';
          return {
            all: allProjects,
            filtered: filteredProjects,
            filters: filters
          };
        }

        renderProjects(filteredProjects);

        // Preload all images from all projects on page load
        const allProjectImages = [];
        filteredProjects.forEach(project => {
          if (project.images && project.images.length > 0) {
            allProjectImages.push(...project.images);
          } else if (project.image) {
            allProjectImages.push(project.image);
          }
        });
        preloadImages(allProjectImages);

        // Dispatch event when projects are loaded
        container.dispatchEvent(new CustomEvent('rp-loaded', {
          detail: {
            all: allProjects,
            filtered: filteredProjects,
            filters: filters
          }
        }));

        return {
          all: allProjects,
          filtered: filteredProjects,
          filters: filters
        };

      } catch (error) {
        container.className = 'rp-container rp-error';
        container.innerHTML = `<p class="rp-error-text" style="text-align: center; padding: 40px; color: ${theme.colorSecondary};">Oops, the project server is down. We'll be back soon!</p>`;
        throw error;
      }
    };

    // Public API
    return {
      fetch: fetchProjects,
      render: () => fetchProjects(),
      refresh: () => fetchProjects(),
      
      // Filter functions for custom rendering
      filter: (newFilters) => {
        const mergedFilters = { ...filters, ...newFilters };
        return ReliqProjects(selector, { ...options, filters: mergedFilters }).fetch();
      },
      
      // Get current filters
      getFilters: () => ({ ...filters }),
      
      // Update options
      updateOptions: (newOptions) => {
        Object.assign(options, newOptions);
      },

      // Open modal manually
      openModal: openModal,
      closeModal: closeModal
    };
  };

  // Expose globally
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReliqProjects;
  } else {
    global.ReliqProjects = ReliqProjects;
  }

})(typeof window !== 'undefined' ? window : this);
