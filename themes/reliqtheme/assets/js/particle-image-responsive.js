const ParticleImageDisplayer = function(tag_id, canvas_el, params) {
  "use strict";
  this.pImageConfig = {
    particles: {
      array: [],
      secondary_array: [],
      density: 100,
      color: '#fff',
      size: {
        value: 2,
        random: false,
        responsive: {
          enabled: true,
          base_multiplier: 1.0,
          min_size: 0.8,
          max_size: 4.0,
          breakpoints: {
            mobile: { max_width: 768, multiplier: 1.5 },
            tablet: { max_width: 1024, multiplier: 1.0 },
            desktop: { multiplier: 1.5 }
          }
        }
      },
      movement: {
        speed: 1,
        restless: {
          enabled: false,
          value: 10,
        }
      },
      scatter: {
        force: 3
      },
      interactivity: {
        on_hover: {
          enabled: true,
          action: 'repulse'
        },
        on_click: {
          enabled: false,
          action: 'big_repulse'
        },
        on_touch: {
          enabled: true,
          action: 'repulse'
        },
        fn_array: []
      }
    },
    image: {
      src: {
        path: null,
        is_external: false
      },
      animation: {
        enabled: false,
        frames: [],
        frame_duration_ms: 150,
        loop: true,
        auto_start: true,
        current_frame: 0,
        is_playing: false,
        last_frame_time: 0
      },
      position: {
        x_img_pct: -15,
        y_img_pct: -8
      },
      size: {
        canvas_pct: 50,
        min_px: 350,
        max_px: 2000
      }
    },
    interactions: {
      repulse: {
        distance: 100,
        strength: 200
      },
      big_repulse: {
        distance: 100,
        strength: 500
      },
      grab: {
        distance: 100,
        line_width: 1,
      }
    },
    canvas: {
      el: canvas_el,
      w: canvas_el.offsetWidth,
      h: canvas_el.offsetHeight
    },
functions: {
      particles: {},
      image: {},
      canvas: {},
      interactivity: {},
      utils: {},
      config: {}
    },
    mouse: {
      x: null,
      y: null,
      click_x: null,
      click_y: null
    },
  };

  const pImg = this.pImageConfig;
  if (params) {
    Object.deepExtend(pImg, params);
  }
  
  // Initialize frame cache for animation
  pImg.image.frameCache = {
    frames: new Map(), // frameNumber -> pixelData
    loadedCount: 0,
    totalCount: 0,
    isInitialized: false
  };
  
  // Initialize secondary particle system
  if (params && params.secondary_particles && params.secondary_particles.enabled) {
    const mergedConfig = window.mergeSecondaryConfig(
      pImg.particles, 
      params.secondary_particles
    );
    // Store enabled status in merged config
    mergedConfig.enabled = true;
    pImg.secondary_particles_config = mergedConfig;
  } else {
    pImg.secondary_particles_config = null;
  }

  /*
  ========================================
  =           CANVAS FUNCTIONS           =
  ========================================
  */
  pImg.functions.canvas.init = function() {
    pImg.canvas.context = pImg.canvas.el.getContext('2d', { willReadFrequently: true });
    pImg.canvas.el.width = pImg.canvas.w;
    pImg.canvas.el.height = pImg.canvas.h;
    pImg.canvas.aspect_ratio = pImg.canvas.w / pImg.canvas.h;
    window.addEventListener('resize', pImg.functions.utils.debounce(pImg.functions.canvas.onResize, 200));
  };

  pImg.functions.canvas.onResize = function() {
    // Skip if animation has already completed
    if (pImg.image.animation.enabled && pImg.image.animation.has_played_once && pImg.particles.array.length === 0) {
      return;
    }

    pImg.canvas.w = pImg.canvas.el.offsetWidth;
    pImg.canvas.h = pImg.canvas.el.offsetHeight;
    pImg.canvas.el.width = pImg.canvas.w;
    pImg.canvas.el.height = pImg.canvas.h;
    pImg.canvas.aspect_ratio = pImg.canvas.w / pImg.canvas.h;

    // Clear existing particles to prevent duplicates
    pImg.particles.array = [];
    pImg.particles.secondary_array = [];

    // Store current density if not set
    if (!pImg.currentDensity) {
      pImg.currentDensity = pImg.functions.utils.calculateResponsiveDensity();
    }

    // Only process image-related operations if an image is loaded
    if (pImg.image.src.path && pImg.image.obj) {
      pImg.functions.image.resize();
      const image_pixels = pImg.functions.canvas.getImagePixels();
      pImg.functions.particles.createImageParticles(image_pixels, true);
    }

    // Reinitialize secondary particles if enabled
    if (pImg.secondary_particles_config) {
      pImg.particles.secondary_array = pImg.functions.particles.createSecondaryParticles(
        pImg.secondary_particles_config
      );
    }
  };

  pImg.functions.canvas.clear = function() {
    pImg.canvas.context.clearRect(0, 0, pImg.canvas.w, pImg.canvas.h);
  };

  pImg.functions.canvas.getImagePixels = function() {
    pImg.functions.canvas.clear();
    pImg.canvas.context.drawImage(pImg.image.obj, pImg.image.x, pImg.image.y, pImg.image.obj.width, pImg.image.obj.height);
    const pixel_data = pImg.canvas.context.getImageData(pImg.image.x, pImg.image.y, pImg.image.obj.width, pImg.image.obj.height);
    pImg.functions.canvas.clear();
    return pixel_data;
  };

  /*
  ========================================
  =           IMAGE FUNCTIONS            =
  ========================================
  */
  pImg.functions.image.resize = function() {
    if (pImg.image.aspect_ratio < pImg.canvas.aspect_ratio) {
      // canvas height constrains image size
      pImg.image.obj.height = pImg.functions.utils.clamp(Math.round(pImg.canvas.h * pImg.image.size.canvas_pct / 100), pImg.image.size.min_px, pImg.image.size.max_px);
      pImg.image.obj.width = Math.round(pImg.image.obj.height * pImg.image.aspect_ratio);
    } else {
      // canvas width constrains image size
      pImg.image.obj.width = pImg.functions.utils.clamp(Math.round(pImg.canvas.w * pImg.image.size.canvas_pct / 100), pImg.image.size.min_px, pImg.image.size.max_px);
      pImg.image.obj.height = Math.round(pImg.image.obj.width / pImg.image.aspect_ratio);
    }
    // set x,y coords to center image on canvas with image-relative positioning
    const x_offset = (pImg.image.obj.width * pImg.image.position.x_img_pct) / 100;
    const y_offset = (pImg.image.obj.height * pImg.image.position.y_img_pct) / 100;
    
    pImg.image.x = pImg.canvas.w  / 2 - pImg.image.obj.width / 2 + x_offset;
    pImg.image.y = pImg.canvas.h / 2 - pImg.image.obj.height / 2 + y_offset;
  };

  pImg.functions.image.init = function() {
    // Check if image path is null or empty - skip image loading entirely
    if (!pImg.image.src.path) {
      // No image - just create secondary particles if enabled
      if (pImg.secondary_particles_config) {
        pImg.particles.secondary_array = pImg.functions.particles.createSecondaryParticles(
          pImg.secondary_particles_config
        );
      }
      
      pImg.functions.particles.animateParticles();

      // Dispatch event to signal particles are ready for fade-in
      window.particleImageDisplayerReady = true
      const event = new CustomEvent('particleImageReady')
      document.dispatchEvent(event)
      return;
    }
    
    pImg.image.obj = new Image();
    pImg.image.obj.addEventListener('load', function() {
      // get aspect ratio (only have to compute once on initial load)
      pImg.image.aspect_ratio = pImg.image.obj.width / pImg.image.obj.height;
      pImg.functions.image.resize();
      
      if (pImg.image.animation.enabled) {
        // Load animation frames
        pImg.functions.image.loadAnimationFrames().then(() => {
          // Create initial particles from first frame
          const firstFrame = pImg.image.animation.frames[0];
          const pixelData = pImg.functions.image.getFramePixels(firstFrame);
          if (pixelData) {
            pImg.functions.particles.createImageParticles(pixelData);
            pImg.image.animation.current_frame = firstFrame;
          }
          
          // Initialize secondary particles if enabled
          if (pImg.secondary_particles_config) {
            pImg.particles.secondary_array = pImg.functions.particles.createSecondaryParticles(
              pImg.secondary_particles_config
            );
          }
          
          pImg.functions.particles.animateParticles();

          // Dispatch event to signal particles are ready for fade-in
          window.particleImageDisplayerReady = true
          const event = new CustomEvent('particleImageReady')
          document.dispatchEvent(event)
        });
      } else {
        // Original static image behavior
        const img_pixels = pImg.functions.canvas.getImagePixels();
        pImg.functions.particles.createImageParticles(img_pixels);
        
        // Initialize secondary particles if enabled
        if (pImg.secondary_particles_config) {
          pImg.particles.secondary_array = pImg.functions.particles.createSecondaryParticles(
            pImg.secondary_particles_config
          );
        }
        
        pImg.functions.particles.animateParticles();

        // Dispatch event to signal particles are ready for fade-in
        window.particleImageDisplayerReady = true
        const event = new CustomEvent('particleImageReady')
        document.dispatchEvent(event)
      }
    });
    
    pImg.image.obj.addEventListener('error', function() {
      // Still create secondary particles if configured
      if (pImg.secondary_particles_config) {
        pImg.particles.secondary_array = pImg.functions.particles.createSecondaryParticles(
          pImg.secondary_particles_config
        );
        pImg.functions.particles.animateParticles();

        // Dispatch event to signal particles are ready for fade-in (even on error)
        window.particleImageDisplayerReady = true
        const event = new CustomEvent('particleImageReady')
        document.dispatchEvent(event)
      }
    });
    
    pImg.image.obj.src = pImg.image.src.path;
    if (pImg.image.src.is_external) {
      pImg.image.obj.crossOrigin = "anonymous";
    }
  };

  // Helper function to calculate frame sizing and positioning
  pImg.functions.image.calculateFrameBounds = function(img) {
    const aspectRatio = img.width / img.height;
    let scaledWidth, scaledHeight;
    
    if (aspectRatio < pImg.canvas.aspect_ratio) {
      scaledHeight = pImg.functions.utils.clamp(Math.round(pImg.canvas.h * pImg.image.size.canvas_pct / 100), pImg.image.size.min_px, pImg.image.size.max_px);
      scaledWidth = Math.round(scaledHeight * aspectRatio);
    } else {
      scaledWidth = pImg.functions.utils.clamp(Math.round(pImg.canvas.w * pImg.image.size.canvas_pct / 100), pImg.image.size.min_px, pImg.image.size.max_px);
      scaledHeight = Math.round(scaledWidth / aspectRatio);
    }
    
    const x_offset = (scaledWidth * pImg.image.position.x_img_pct) / 100;
    const y_offset = (scaledHeight * pImg.image.position.y_img_pct) / 100;
    const x_pos = pImg.canvas.w / 2 - scaledWidth / 2 + x_offset;
    const y_pos = pImg.canvas.h / 2 - scaledHeight / 2 + y_offset;
    
    return { x_pos, y_pos, scaledWidth, scaledHeight };
  };

  // Frame loading and caching functions for sprite animation
  pImg.functions.image.loadAnimationFrames = function() {
    if (!pImg.image.animation.enabled || pImg.image.frameCache.isInitialized) {
      return Promise.resolve();
    }
    
    const frames = pImg.image.animation.frames;
    pImg.image.frameCache.totalCount = frames.length;
    
    const loadPromises = frames.map(frameNum => {
      return new Promise((resolve) => {
        const img = new Image();
        
        img.addEventListener('load', function() {
          const bounds = pImg.functions.image.calculateFrameBounds(img);
          
          // Process frame and cache pixel data
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          tempCanvas.width = pImg.canvas.w;
          tempCanvas.height = pImg.canvas.h;
          
          tempCtx.drawImage(img, bounds.x_pos, bounds.y_pos, bounds.scaledWidth, bounds.scaledHeight);
          const pixelData = tempCtx.getImageData(bounds.x_pos, bounds.y_pos, bounds.scaledWidth, bounds.scaledHeight);
          
          pImg.image.frameCache.frames.set(frameNum, pixelData);
          pImg.image.frameCache.loadedCount++;
          resolve(frameNum);
        });
        
        img.addEventListener('error', function() {
          resolve(frameNum);
        });
        
        img.src = `/chest/${frameNum}.png`;
        if (pImg.image.src.is_external) {
          img.crossOrigin = "anonymous";
        }
      });
    });
    
    return Promise.all(loadPromises).then(() => {
      pImg.image.frameCache.isInitialized = true;
      if (pImg.image.animation.auto_start) {
        pImg.functions.animation.start();
      }
    });
  };

  pImg.functions.image.getFramePixels = function(frameNum) {
    return pImg.image.frameCache.frames.get(frameNum) || null;
  };

  /*
  ========================================
  =          ANIMATION FUNCTIONS         =
  ========================================
  */
  pImg.functions.animation = {
    start: function() {
      
      // Reset to first frame for click-to-play behavior
      pImg.image.animation.current_frame = pImg.image.animation.frames[0];
      
      pImg.image.animation.is_playing = true;
      pImg.image.animation.last_frame_time = performance.now();
      pImg.image.animation.has_played_once = true; // Mark as played

      // Disable interactivity during animation
      pImg.interactivityDisabled = true;

      this.animate();
    },
    
    stop: function() {

      pImg.image.animation.is_playing = false;

      // Re-enable interactivity after animation stops
      pImg.interactivityDisabled = false;

      // Clear the captured float offset when animation stops
      pImg.image.animation.float_offset = null;

      // Disable floating permanently after animation stops
      pImg.particles.movement.floating.enabled = false;

      // Scatter particles and make them stay there

      pImg.functions.particles.scatterParticles();

      // Start fade-out after scatter

      pImg.functions.particles.startFadeOut();
    },
    
    setFrame: function(frameNum) {
      if (!pImg.image.frameCache.frames.has(frameNum)) {
        return;
      }
      
      pImg.image.animation.current_frame = frameNum;
      const pixelData = pImg.functions.image.getFramePixels(frameNum);
      if (pixelData) {
        // Clear all existing particles and recreate from new frame
        pImg.particles.array = [];
        pImg.functions.particles.createImageParticles(pixelData, true); // Start at destination
      }
    },
    
    animate: function() {
      if (!pImg.image.animation.is_playing) {
        return;
      }
      
      const currentTime = performance.now();
      const deltaTime = currentTime - pImg.image.animation.last_frame_time;
      
      if (deltaTime >= pImg.image.animation.frame_duration_ms) {
        const frames = pImg.image.animation.frames;
        const currentIndex = frames.indexOf(pImg.image.animation.current_frame);
        let nextIndex = (currentIndex + 1) % frames.length;
        
        // Handle loop logic
        if (!pImg.image.animation.loop && nextIndex === 0) {
          this.stop();
          return;
        }
        
        this.setFrame(frames[nextIndex]);
        pImg.image.animation.last_frame_time = currentTime;
      }
      
      requestAnimationFrame(() => this.animate());
    }
  };

  /*
  ========================================
  =          PARTICLE FUNCTIONS          =
  ========================================
  */
  pImg.functions.particles.SingleImageParticle = function(init_xy, dest_xy, start_stationary = false) {
    // Defensive checks for required parameters
    if (!init_xy || !dest_xy) {
      console.error('SingleImageParticle: Missing init_xy or dest_xy parameters', { init_xy, dest_xy });
      return;
    }
    
    this.x = init_xy.x || 0;
    this.y = init_xy.y || 0;
    this.dest_x = dest_xy.x || 0;
    this.dest_y = dest_xy.y || 0;
    
    // Set initial velocity based on whether particle should start stationary
    if (start_stationary) {
      this.vx = 0;
      this.vy = 0;
    } else {
      this.vx = (Math.random() - 0.5) * (pImg.particles.movement?.speed || 1);
      this.vy = (Math.random() - 0.5) * (pImg.particles.movement?.speed || 1);
    }
    
    this.acc_x = 0;
    this.acc_y = 0;
    this.friction = Math.random() * 0.01 + 0.92;
    this.restlessness = {
      max_displacement: Math.ceil(Math.random() * (pImg.particles.movement?.restless?.value || 10)),
      x_jitter: Math.floor(Math.random() * 7) - 3, // -3 to 3
      y_jitter: Math.floor(Math.random() * 7) - 3, // -3 to 3
      on_curr_frame: false
    };
    
    // Safe color assignment
    try {
      if (Array.isArray(pImg.particles.color)) {
        this.color = pImg.particles.color[Math.floor(Math.random() * pImg.particles.color.length)];
      } else {
        this.color = pImg.particles.color || '#ffffff';
      }
    } catch (e) {
      console.error('Error setting particle color:', e);
      this.color = '#ffffff';
    }
    
    // Use responsive sizing with fallback
    try {
      const responsiveSize = pImg.functions.utils.calculateResponsiveSize();
      this.radius = Math.round(((pImg.particles.size?.random) ? Math.max(Math.random(), 0.5) : 1) * responsiveSize);
    } catch (e) {
      console.error('Error calculating particle size:', e);
      this.radius = 2;
    }
    this.targetRadius = this.radius;
  };

  pImg.functions.particles.SingleImageParticle.prototype.draw = function() {
    let drawX = this.x;
    let drawY = this.y;
    
    // Apply floating offset if enabled and animation is not playing
    if (pImg.particles.movement.floating.enabled && !pImg.image.animation.is_playing) {
      const floating_offset = pImg.functions.particles.calculateFloatingOffset();
      drawX += floating_offset.x;
      drawY += floating_offset.y;
    }
    
    // Apply captured float offset during animation to prevent position shift
    if (pImg.image.animation.is_playing && pImg.image.animation.float_offset) {
      drawX += pImg.image.animation.float_offset.x;
      drawY += pImg.image.animation.float_offset.y;
    }
    
    // Apply fade-out opacity if enabled
    const opacity = (pImg.particles.fade_out && pImg.particles.fade_out.enabled && pImg.particles.fade_out.active) ? pImg.particles.fade_out.opacity : 1;
    pImg.canvas.context.fillStyle = this.color;
    pImg.canvas.context.globalAlpha = opacity;
    pImg.canvas.context.beginPath();
    pImg.canvas.context.arc(drawX, drawY, this.radius, 0, Math.PI * 2, false);
    pImg.canvas.context.fill();
    pImg.canvas.context.globalAlpha = 1; // Reset global alpha
  };

  /*
  ========================================
  =       SECONDARY PARTICLE CLASS      =
  ========================================
  */
  pImg.functions.particles.SecondaryParticle = function(x, y, config) {
    this.x = x;
    this.y = y;
    // Secondary particles have no destination - they stay in place
    this.dest_x = x;
    this.dest_y = y;
    this.vx = 0;
    this.vy = 0;
    this.acc_x = 0;
    this.acc_y = 0;
    // Lower friction = more momentum (0.99 = very slippery, 0.8 = quick stop)
    this.friction = Math.random() * 0.02 + 0.97;
    this.restlessness = {
      max_displacement: Math.ceil(Math.random() * (pImg.particles.movement?.restless?.value || 10)),
      x_jitter: Math.floor(Math.random() * 7) - 3, // -3 to 3
      y_jitter: Math.floor(Math.random() * 7) - 3, // -3 to 3
      on_curr_frame: false
    };
    
    // Random movement properties - use config speed, not inherited primary speed
    const randomSpeed = config.movement?.random?.speed || 0.1;
    this.random_movement = {
      enabled: config.movement?.random?.enabled || false,
      speed: randomSpeed,
      current_direction: Math.random() * 2 * Math.PI, // Set once, don't change
      vx: 0,
      vy: 0
    };
    
    // Initialize velocity based on random movement config
    if (this.random_movement.enabled) {
      this.vx = Math.cos(this.random_movement.current_direction) * this.random_movement.speed;
      this.vy = Math.sin(this.random_movement.current_direction) * this.random_movement.speed;
    }
    
    this.color = config.color;
    
    // Use responsive sizing from merged config
    const responsiveSize = pImg.functions.utils.calculateResponsiveSize();
    this.radius = Math.round((config.size.random ? Math.max(Math.random(), 0.5) : 1) * responsiveSize);
    this.targetRadius = this.radius;
  };

  pImg.functions.particles.SecondaryParticle.prototype.draw = function() {
    let drawX = this.x;
    let drawY = this.y;
    
    pImg.canvas.context.fillStyle = this.color;
    pImg.canvas.context.globalAlpha = 1;
    pImg.canvas.context.beginPath();
    pImg.canvas.context.arc(drawX, drawY, this.radius, 0, Math.PI * 2, false);
    pImg.canvas.context.fill();
    pImg.canvas.context.globalAlpha = 1; // Reset global alpha
  };

  /*
  ========================================
  =    CONFIGURATION INHERITANCE       =
  ========================================
  */
  pImg.functions.config.mergeSecondaryConfig = function(primary, secondary) {
    // Deep clone primary config as base (always inherit)
    const merged = JSON.parse(JSON.stringify(primary));
    
    // Apply secondary overrides only where explicitly defined
    for (let [key, value] of Object.entries(secondary)) {
      // Skip meta fields
      if (key === 'enabled') {
        continue;
      }
      
      // Only override if secondary has a non-undefined value
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          // Deep merge objects
          merged[key] = Object.deepExtend(merged[key] || {}, value);
        } else {
          // Direct value override
          merged[key] = value;
        }
      }
    }
    
    return merged;
  };

  /*
  ========================================
  =     SECONDARY PARTICLE CREATION     =
  ========================================
  */
  pImg.functions.particles.createSecondaryParticles = function(config) {
    if (!config.enabled) {
      return [];
    }

    const particles = [];
    const placementConfig = config.placement || {};

    switch (String(config.placement_mode || 'grid').trim().toLowerCase()) {
      case 'grid': {
        const gridParticles = pImg.functions.particles.createGridParticles(config, placementConfig);
        particles.push(...gridParticles);
        break;
      }
      case 'random': {
        const randomParticles = pImg.functions.particles.createRandomParticles(config, placementConfig);
        particles.push(...randomParticles);
        break;
      }
      case 'full_canvas': {
        const fullCanvasParticles = pImg.functions.particles.createFullCanvasParticles(config, placementConfig);
        particles.push(...fullCanvasParticles);
        break;
      }
      case 'around_image': {
        const aroundImageParticles = pImg.functions.particles.createAroundImageParticles(config);
        particles.push(...aroundImageParticles);
        break;
      }
      default: {
        console.warn('Unknown placement_mode:', config.placement_mode, '- defaulting to grid');
        const defaultParticles = pImg.functions.particles.createGridParticles(config, placementConfig);
        particles.push(...defaultParticles);
        break;
      }
    }

    return particles;
  };

  pImg.functions.particles.createGridParticles = function(config, placementConfig) {
    const particles = [];
    const spacing = placementConfig.grid_spacing || 20;
    
    const cols = Math.floor(pImg.canvas.w / spacing);
    const rows = Math.floor(pImg.canvas.h / spacing);
    
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = (i + 0.5) * spacing;
        const y = (j + 0.5) * spacing;
        particles.push(new pImg.functions.particles.SecondaryParticle(x, y, config));
      }
    }
    
    return particles;
  };

  pImg.functions.particles.createRandomParticles = function(config, placementConfig) {
    const particles = [];
    const density = pImg.functions.utils.calculateResponsiveDensity();
    const margin = placementConfig.random_margin || 50;
    const minSpacing = 10; // Minimum distance between particles
    
    const particleCount = Math.floor(density * (pImg.canvas.w * pImg.canvas.h) / 10000 * (config.particle_multiplier || 1));
    
    for (let i = 0; i < particleCount; i++) {
      let x, y;
      let attempts = 0;
      
      // Try to place particle without overlap
      do {
        // Calculate center of canvas
        const centerX = pImg.canvas.w / 2;
        const centerY = pImg.canvas.h / 2;
        const maxRadius = (Math.min(pImg.canvas.w, pImg.canvas.h) * (config.placement_radius_percentage || 100)) / 200;
        
        // Generate random position within radius
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * maxRadius;
        x = centerX + Math.cos(angle) * distance;
        y = centerY + Math.sin(angle) * distance;
        attempts++;
      } while (attempts < 50 && pImg.functions.particles.hasOverlap(x, y, particles, minSpacing));
      
      if (attempts < 50) {
        particles.push(new pImg.functions.particles.SecondaryParticle(x, y, config));
      }
    }
    
    return particles;
  };

  pImg.functions.particles.createFullCanvasParticles = function(config, placementConfig) {
    const particles = [];
    const density = pImg.functions.utils.calculateResponsiveDensity();
    const margin = placementConfig.random_margin || 20;
    const minSpacing = placementConfig.min_spacing || 15;
    
    // Calculate particle count based on canvas area and multiplier
    const particleCount = Math.floor(density * (pImg.canvas.w * pImg.canvas.h) / 10000 * (config.particle_multiplier || 1));
    
    for (let i = 0; i < particleCount; i++) {
      let x, y;
      let attempts = 0;
      
      // Try to place particle without overlap - spread across FULL canvas
      do {
        // Random position across entire canvas with margin
        x = margin + Math.random() * (pImg.canvas.w - 2 * margin);
        y = margin + Math.random() * (pImg.canvas.h - 2 * margin);
        attempts++;
      } while (attempts < 50 && pImg.functions.particles.hasOverlap(x, y, particles, minSpacing));
      
      if (attempts < 50) {
        particles.push(new pImg.functions.particles.SecondaryParticle(x, y, config));
      }
    }
    
    return particles;
  };

  pImg.functions.particles.createAroundImageParticles = function(config) {
    const particles = [];
    const density = pImg.functions.utils.calculateResponsiveDensity();
    const minSpacing = 10; // Minimum distance between particles
    
    // Calculate canvas-centered elliptical bounds with image aspect ratio
    const canvasCenterX = pImg.canvas.w / 2;
    const canvasCenterY = pImg.canvas.h / 2;
    
    // Add buffer percentage using image aspect ratio
    const bufferPercent = (config.placement_image_buffer || 20) / 100;
    const imageAspectRatio = pImg.image.obj.width / pImg.image.obj.height;
    
    // Use larger dimension for base radius, maintain aspect ratio
    const baseRadius = Math.max(pImg.image.obj.width, pImg.image.obj.height) / 2 * (1 + bufferPercent);
    const widthRadius = baseRadius;
    const heightRadius = baseRadius / imageAspectRatio;
    
    const particleCount = Math.floor(density * (pImg.canvas.w * pImg.canvas.h) / 10000 * (config.particle_multiplier || 1));
    
    for (let i = 0; i < particleCount; i++) {
      let x, y;
      let attempts = 0;
      
      // Try to place particle without overlap
      do {
        // Generate random position within ellipse centered on canvas
        const angle = Math.random() * 2 * Math.PI;
        const normalizedRadius = Math.random(); // sqrt gives even distribution
        x = canvasCenterX + Math.cos(angle) * widthRadius * Math.sqrt(normalizedRadius);
        y = canvasCenterY + Math.sin(angle) * heightRadius * Math.sqrt(normalizedRadius);
        attempts++;
      } while (attempts < 50 && pImg.functions.particles.hasOverlap(x, y, particles, minSpacing));
      
      if (attempts < 50) {
        particles.push(new pImg.functions.particles.SecondaryParticle(x, y, config));
      }
    }
    
    return particles;
  };

  pImg.functions.particles.hasOverlap = function(x, y, existingParticles, minSpacing) {
    for (let p of existingParticles) {
      const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2);
      if (dist < minSpacing) {
        return true;
      }
    }
    return false;
  };

  pImg.functions.particles.createImageParticles = function(pixel_data, at_dest = false) {
    // Defensive checks for pixel data
    if (!pixel_data || !pixel_data.data || !pixel_data.width || !pixel_data.height) {
      console.error('createImageParticles: Invalid pixel data', pixel_data);
      return;
    }
    
    const responsiveDensity = pImg.functions.utils.calculateResponsiveDensity();
    const increment = Math.max(1, Math.round(pixel_data.width / responsiveDensity));
    

    
    for (let i = 0; i < pixel_data.width; i += increment) {
      for (let j = 0; j < pixel_data.height; j += increment) {
        const pixelIndex = (i + j * pixel_data.width) * 4 + 3; // Alpha channel
        
        // Check if pixel is within bounds and has sufficient opacity
        if (pixelIndex < pixel_data.data.length && pixel_data.data[pixelIndex] > 128) {
          const dest_xy = {x: (pImg.image?.x || 0) + i, y: (pImg.image?.y || 0) + j};
          let init_xy;
          
          // Check if particles should start scrambled or at destination
          const startAtDestination = at_dest || !pImg.particles?.start_scrambled;
          if (startAtDestination) {
            // Start at destination (either explicitly requested or scramble disabled)
            init_xy = dest_xy;
          } else {
            // Start scrambled at random positions
            init_xy = {x: Math.random() * (pImg.canvas?.w || 800), y: Math.random() * (pImg.canvas?.h || 600)};
          }
          
          try {
            pImg.particles.array.push(new pImg.functions.particles.SingleImageParticle(init_xy, dest_xy, startAtDestination));
          } catch (e) {
            console.error('Error creating SingleImageParticle:', e, { init_xy, dest_xy });
          }
        }
      }
    }
    

  };

  pImg.functions.particles.updateParticles = function() {
    // Update primary particles
    for (let p of pImg.particles.array) {
      if ((pImg.particles.movement.restless.enabled) && (p.restlessness.on_curr_frame)) {
        // if restless activity is enabled & particle is in restless mode, animate some random movement
        pImg.functions.particles.jitterParticle(p);
      } else {
        // otherwise, update position with approach to destination
        p.acc_x = (p.dest_x - p.x) / 500;
        p.acc_y = (p.dest_y - p.y) / 500;
        p.vx = (p.vx + p.acc_x) * p.friction;
        p.vy = (p.vy + p.acc_y) * p.friction;
        p.x += p.vx;
        p.y += p.vy;
      }

      // Smooth size transitions
      if (Math.abs(p.radius - p.targetRadius) > 0.1) {
        p.radius += (p.targetRadius - p.radius) * 0.1;
      }

      pImg.functions.interactivity.interactWithClient(p);
    }
    
    // Update secondary particles if enabled
    if (pImg.secondary_particles_config && pImg.particles.secondary_array.length > 0) {
      for (let p of pImg.particles.secondary_array) {
        pImg.functions.particles.updateSecondaryParticle(p);
      }
    }
  };

  pImg.functions.particles.updateSecondaryParticle = function(p) {
    // Apply interactivity FIRST if enabled (so it affects this frame's movement)
    if (pImg.secondary_particles_config.interactivity && pImg.secondary_particles_config.interactivity.enabled) {
      pImg.functions.interactivity.interactWithClient(p);
    }
    
    // Handle scatter behavior for secondary particles
    if (p.is_scattered) {
      // Move towards scatter destination like primary particles
      p.acc_x = (p.dest_x - p.x) / 500;
      p.acc_y = (p.dest_y - p.y) / 500;
      p.vx = (p.vx + p.acc_x) * p.friction;
      p.vy = (p.vy + p.acc_y) * p.friction;
      p.x += p.vx;
      p.y += p.vy;
      
      // Check if particle has slowed down enough to transition to random movement
      const velocity = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (velocity < 0.1) {
        p.is_scattered = false;
        p.scatter_original = null;
        // Reset friction to lower value for more momentum
        p.friction = Math.random() * 0.02 + 0.97;
      }
      return; // Skip normal movement when scattered
    }
    
    // Apply random movement if enabled (always apply regardless of mouse proximity)
    if (p.random_movement.enabled) {
      // Calculate target velocity based on configured direction and speed
      const target_vx = Math.cos(p.random_movement.current_direction) * p.random_movement.speed;
      const target_vy = Math.sin(p.random_movement.current_direction) * p.random_movement.speed;
      
      // Smoothly blend towards target velocity - use lower factor to preserve momentum from touch
      p.vx = p.vx * 0.97 + target_vx * 0.03;
      p.vy = p.vy * 0.97 + target_vy * 0.03;
      
      // Apply friction to total velocity
      p.vx *= p.friction;
      p.vy *= p.friction;
      
      // Update position
      p.x += p.vx;
      p.y += p.vy;
      
      // Bounce off canvas edges (reflect direction)
      if (p.x < p.radius) {
        p.x = p.radius;
        p.random_movement.current_direction = Math.PI - p.random_movement.current_direction;
      }
      if (p.x > pImg.canvas.w - p.radius) {
        p.x = pImg.canvas.w - p.radius;
        p.random_movement.current_direction = Math.PI - p.random_movement.current_direction;
      }
      if (p.y < p.radius) {
        p.y = p.radius;
        p.random_movement.current_direction = -p.random_movement.current_direction;
      }
      if (p.y > pImg.canvas.h - p.radius) {
        p.y = pImg.canvas.h - p.radius;
        p.random_movement.current_direction = -p.random_movement.current_direction;
      }
    }
    
    // Apply restless movement if enabled in inherited config
    if ((pImg.secondary_particles_config.movement.restless.enabled) && (p.restlessness.on_curr_frame)) {
      pImg.functions.particles.jitterParticle(p);
    } else if (!p.random_movement.enabled) {
      // Secondary particles don't have a destination to approach, just apply friction
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx;
      p.y += p.vy;
    }

    // Smooth size transitions
    if (Math.abs(p.radius - p.targetRadius) > 0.1) {
      p.radius += (p.targetRadius - p.radius) * 0.1;
    }
  };

  pImg.functions.particles.jitterParticle = function(p) {
    p.x += p.restlessness.x_jitter;
    p.y += p.restlessness.y_jitter;
    if (Math.sqrt((p.dest_x - p.x) ** 2 + (p.dest_y - p.y) ** 2) >= pImg.particles.movement.restless.value) {
      p.restlessness.on_curr_frame = false;
    }
  };

  pImg.functions.particles.calculateFloatingOffset = function() {
    if (!pImg.particles.movement.floating.enabled) {
      return { x: 0, y: 0 };
    }
    
    const config = pImg.particles.movement.floating;
    const time = performance.now() / 1000;
    const phase = (time * config.frequency * 2 * Math.PI) + config.phase_offset;
    
    return { x: 0, y: Math.sin(phase) * config.amplitude };
  };

  pImg.functions.particles.scatterParticles = function() {

    // Get scatter force with default
    const scatterForce = (pImg.particles.scatter && pImg.particles.scatter.force) || 3;
    
    // Scatter all primary particles away from their destinations
    for (let p of pImg.particles.array) {
      // Calculate random scatter direction
      const scatterAngle = Math.random() * 2 * Math.PI;
      
      // Set new destination far from current position
      p.dest_x = p.x + Math.cos(scatterAngle) * scatterForce * 30;
      p.dest_y = p.y + Math.sin(scatterAngle) * scatterForce * 30;
      
      // Give particles initial velocity in scatter direction
      p.vx = Math.cos(scatterAngle) * scatterForce;
      p.vy = Math.sin(scatterAngle) * scatterForce;
      
      // Reduce friction to allow particles to travel
      p.friction = 0.85;
    }
    
    // Also scatter secondary particles if they exist
    if (pImg.particles.secondary_array && pImg.particles.secondary_array.length > 0) {
      for (let p of pImg.particles.secondary_array) {
        const scatterAngle = Math.random() * 2 * Math.PI;
        
        // Store original position for potential return, and set new scatter destination
        if (!p.scatter_original) {
          p.scatter_original = { x: p.x, y: p.y };
        }
        
        // Set new destination far from current position
        p.dest_x = p.x + Math.cos(scatterAngle) * scatterForce * 25;
        p.dest_y = p.y + Math.sin(scatterAngle) * scatterForce * 25;
        
        // Give particles initial velocity in scatter direction
        p.vx = Math.cos(scatterAngle) * scatterForce * 0.8;
        p.vy = Math.sin(scatterAngle) * scatterForce * 0.8;
        
        // Reduce friction to allow particles to travel
        p.friction = 0.85;
        
        // Flag that this secondary particle is scattered
        p.is_scattered = true;
        
        // Re-initialize random direction for when scattering ends
        if (p.random_movement && p.random_movement.enabled) {
          p.random_movement.current_direction = Math.random() * 2 * Math.PI;
        }
      }
    }
  };

  pImg.functions.particles.startFadeOut = function() {
    // Check if fade-out is enabled in config
    if (!pImg.particles.fade_out || !pImg.particles.fade_out.enabled) {

      return;
    }
    

    // Initialize fade-out state
    pImg.particles.fade_out.start_time = performance.now();
    pImg.particles.fade_out.opacity = 1.0;
    pImg.particles.fade_out.active = true;
  };

  pImg.functions.particles.updateFadeOut = function() {
    if (!pImg.particles.fade_out || !pImg.particles.fade_out.enabled || !pImg.particles.fade_out.active) {
      return;
    }
    
    const elapsed = performance.now() - pImg.particles.fade_out.start_time;
    const progress = Math.min(elapsed / pImg.particles.fade_out.duration_ms, 1);
    
    // Update opacity (fade to 0)
    pImg.particles.fade_out.opacity = 1 - progress;
    

    
    // When fade is complete, clear only primary particles, keep secondary particles
    if (progress >= 1) {
      pImg.particles.array = [];
      // Keep secondary particles: pImg.particles.secondary_array = [];
      pImg.particles.fade_out.active = false;
      
      // Clear scattered state only after particles have slowed down from scatter momentum
      // The velocity check in updateSecondaryParticle will handle transitioning to random movement
      if (pImg.secondary_particles_config && pImg.particles.secondary_array.length > 0) {
        for (let p of pImg.particles.secondary_array) {
          p.scatter_original = null;
          // Don't clear is_scattered here - let updateSecondaryParticle do it based on velocity
        }
      }
      

      const event = new CustomEvent('particleAnimationComplete', {
        detail: { 
          timestamp: performance.now(),
          particleSystem: 'primary'
        }
      });
      document.dispatchEvent(event);

    }
  };

  pImg.functions.particles.animateParticles = function() {
    pImg.functions.canvas.clear()
    pImg.functions.particles.updateParticles();
    pImg.functions.particles.updateFadeOut();
    
    // Determine render order based on secondary particles configuration
    const renderConfig = pImg.secondary_particles_config;
    if (renderConfig && pImg.particles.secondary_array.length > 0) {
      if (renderConfig.render_order === 'background') {
        // Render secondary particles first (background)
        for (let p of pImg.particles.secondary_array) {
          p.draw();
        }
        // Then render primary particles (foreground)
        for (let p of pImg.particles.array) {
          p.draw();
        }
      } else {
        // Render primary particles first (background)
        for (let p of pImg.particles.array) {
          p.draw();
        }
        // Then render secondary particles (foreground)
        for (let p of pImg.particles.secondary_array) {
          p.draw();
        }
      }
    } else {
      // Only primary particles
      for (let p of pImg.particles.array) {
        p.draw();
      }
    }
    
    requestAnimFrame(pImg.functions.particles.animateParticles);
  };

  /*
  ========================================
  =        INTERACTIVITY FUNCTIONS       =
  ========================================
  */
  pImg.functions.interactivity.repulseParticle = function(p, args) {
    // compute distance to mouse
    const dx_mouse = p.x - pImg.mouse.x,
          dy_mouse = p.y - pImg.mouse.y,
          mouse_dist = Math.sqrt(dx_mouse * dx_mouse + dy_mouse * dy_mouse);
    
    // Calculate displacement from destination
    const dx_dest = p.x - p.dest_x;
    const dy_dest = p.y - p.dest_y;
    const current_displacement = Math.sqrt(dx_dest * dx_dest + dy_dest * dy_dest);
    
    if (mouse_dist <= args.detection_radius) {
      // Check displacement constraint
      if (current_displacement < args.max_displacement) {
        // Initialize repulse timer if not started
        if (!p.repulse_start_time) {
          p.repulse_start_time = Date.now();
        }
        
        // Calculate elapsed time as fraction of repulse duration
        const elapsed_ms = Date.now() - p.repulse_start_time;
        const elapsed_fraction = Math.min(elapsed_ms / (args.repulse_duration * 1000), 1);
        
        // FIX: Prevent double-reaction by stopping force after significant displacement
        // Only apply force if we're still in the initial push phase
        if (elapsed_fraction < 0.8) { // Stop force at 80% of duration
          // Calculate force multiplier based on selected curve
          let force_multiplier;
          switch (args.force_curve) {
            case 'top_heavy':
              force_multiplier = 1 - (1 - elapsed_fraction) ** 2;
              break;
            case 'bottom_heavy':
              force_multiplier = elapsed_fraction ** 2;
              break;
            case 'linear':
            default:
              force_multiplier = elapsed_fraction;
              break;
          }
          
          // Calculate required acceleration from physics: a = 2 * d / t^2
          const required_acceleration = (2 * args.max_displacement) / (args.repulse_duration ** 2);
          
          // Apply displacement constraint factor
          const constraint_factor = Math.max(0, 1 - (current_displacement / args.max_displacement));
          
          // Calculate and apply force
          const force = required_acceleration * force_multiplier * constraint_factor;
          p.acc_x = ((p.x - pImg.mouse.x) / mouse_dist) * force * 0.01;
          p.acc_y = ((p.y - pImg.mouse.y) / mouse_dist) * force * 0.01;
          p.vx += p.acc_x;
          p.vy += p.acc_y;
        }
      }
    } else {
      // Reset timer when mouse leaves
      p.repulse_start_time = null;
    }
  };

  pImg.functions.interactivity.repulseSecondaryParticle = function(p, args) {
    // compute distance to mouse
    const dx_mouse = p.x - pImg.mouse.x,
          dy_mouse = p.y - pImg.mouse.y,
          mouse_dist = Math.sqrt(dx_mouse * dx_mouse + dy_mouse * dy_mouse);
    
    if (mouse_dist <= args.detection_radius) {
      // Get sensitivity from secondary particles config
      const sensitivity = pImg.secondary_particles_config?.interactivity?.touch_sensitivity || 0.1;
      const maxOffset = pImg.secondary_particles_config?.interactivity?.touch_max_offset || 2.0;
      
      // Calculate gentle repulsion force (much lighter than primary particles)
      const distance_factor = 1 - (mouse_dist / args.detection_radius);
      const repulse_force = distance_factor * sensitivity * maxOffset;
      
      // Apply gentle force as direct velocity addition (not acceleration)
      p.vx += ((p.x - pImg.mouse.x) / mouse_dist) * repulse_force;
      p.vy += ((p.y - pImg.mouse.y) / mouse_dist) * repulse_force;
    }
  };

  pImg.functions.interactivity.grabParticle = function(p, args) {
    const dx_mouse = p.x - pImg.mouse.x,
          dy_mouse = p.y - pImg.mouse.y,
          mouse_dist = Math.sqrt(dx_mouse * dx_mouse + dy_mouse * dy_mouse);
    if (mouse_dist <= args.distance) {
      pImg.canvas.context.strokeStyle = p.color;
      pImg.canvas.context.lineWidth = Math.min(args.line_width, p.radius * 2);
      pImg.canvas.context.beginPath();
      pImg.canvas.context.moveTo(p.x, p.y);
      pImg.canvas.context.lineTo(pImg.mouse.x, pImg.mouse.y);
      pImg.canvas.context.stroke();
      pImg.canvas.context.closePath();
    }
  };

  pImg.functions.interactivity.onMouseMove = function(func, args, p) {
    if (pImg.mouse.x != null && pImg.mouse.y != null) {
      func(p, args);
    }
  };

  pImg.functions.interactivity.onMouseClick = function(func, args, p) {
    if (pImg.mouse.click_x != null && pImg.mouse.click_y != null) {
      func(p, args);
    }
  };

  pImg.functions.interactivity.addEventListeners = function() {
    let needsMouseMove = false;
    let needsMouseDown = false;
    let needsTouchMove = false;
    
    // Check primary particles interactivity needs
    if (pImg.particles.interactivity.on_hover.enabled || pImg.particles.interactivity.on_click.enabled) {
      needsMouseMove = true;
      needsMouseDown = pImg.particles.interactivity.on_click.enabled;
    }
    if (pImg.particles.interactivity.on_touch.enabled) {
      needsTouchMove = true;
    }
    
    // Check secondary particles interactivity needs
    if (pImg.secondary_particles_config && pImg.secondary_particles_config.interactivity && pImg.secondary_particles_config.interactivity.enabled) {
      const secondaryInteractivity = pImg.secondary_particles_config.interactivity;
      
      // Secondary particles inherit primary interactivity needs by default
      if (pImg.particles.interactivity.on_hover.enabled) needsMouseMove = true;
      if (pImg.particles.interactivity.on_click.enabled) needsMouseDown = true;
      if (pImg.particles.interactivity.on_touch.enabled) needsTouchMove = true;
      
      // Additional events if custom secondary interactivity is defined
      if (secondaryInteractivity.on_hover?.enabled) needsMouseMove = true;
      if (secondaryInteractivity.on_click?.enabled) needsMouseDown = true;
      if (secondaryInteractivity.on_touch?.enabled) needsTouchMove = true;
    }
    
    // Setup universal mouse listeners
    if (needsMouseMove) {
      pImg.canvas.el.addEventListener('mousemove', function(e) {
        // Skip mouse tracking during animation
        if (pImg.interactivityDisabled) {
          return;
        }
        const pos_x = e.offsetX || e.clientX;
        const pos_y = e.offsetY || e.clientY;
        pImg.mouse.x = pos_x;
        pImg.mouse.y = pos_y;
      });
      pImg.canvas.el.addEventListener('mouseleave', function(e) {
        pImg.mouse.x = null;
        pImg.mouse.y = null;
      });
    }
    
    if (needsMouseDown) {
      pImg.canvas.el.addEventListener('mousedown', function(e) {
        // Skip click tracking during animation
        if (pImg.interactivityDisabled) {
          return;
        }
        pImg.mouse.click_x = pImg.mouse.x;
        pImg.mouse.click_y = pImg.mouse.y;
      });
      pImg.canvas.el.addEventListener('mouseup', function(e) {
        pImg.mouse.click_x = null;
        pImg.mouse.click_y = null;
      });
    }
    
    if (needsTouchMove) {
      pImg.canvas.el.addEventListener('touchmove', function(e) {
        // Skip touch tracking during animation
        if (pImg.interactivityDisabled) {
          return;
        }
        e.preventDefault();
        const rect = pImg.canvas.el.getBoundingClientRect();
        const pos_x = e.touches[0].clientX - rect.left;
        const pos_y = e.touches[0].clientY - rect.top;
        pImg.mouse.x = pos_x;
        pImg.mouse.y = pos_y;
      }, { passive: false });
      pImg.canvas.el.addEventListener('touchend', function(e) {
        pImg.mouse.x = null;
        pImg.mouse.y = null;
      });
    }
    
    // Setup event actions for primary particles
    pImg.functions.utils.addEventActions('on_hover', pImg);
    pImg.functions.utils.addEventActions('on_click', pImg);
    pImg.functions.utils.addEventActions('on_touch', pImg);
    
    // Add click-to-play animation trigger if animation is enabled
    if (pImg.image.animation.enabled) {
      let touchStartX = null;
      let touchStartY = null;
      let touchStartTime = null;
      let isTouchEvent = false;
      const dragThreshold = 10;
      const tapMaxDuration = 300;

      pImg.canvas.el.addEventListener('click', function(e) {
        if (isTouchEvent) {
          isTouchEvent = false;
          return;
        }
        e.preventDefault();
        // Only start if not already playing to prevent overlap
        if (!pImg.image.animation.is_playing) {
          pImg.functions.animation.start();
        }
      });

      pImg.canvas.el.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          touchStartTime = Date.now();
          isTouchEvent = true;
        }
      }, { passive: true });

      pImg.canvas.el.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1 && touchStartX !== null) {
          const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
          const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
          if (deltaX > dragThreshold || deltaY > dragThreshold) {
            touchStartX = null;
            touchStartY = null;
            touchStartTime = null;
          }
        }
      }, { passive: true });

      pImg.canvas.el.addEventListener('touchend', function(e) {
        if (e.changedTouches.length === 1 && touchStartX !== null && touchStartTime !== null) {
          const deltaX = Math.abs(e.changedTouches[0].clientX - touchStartX);
          const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY);
          const duration = Date.now() - touchStartTime;

          if (deltaX < dragThreshold && deltaY < dragThreshold && duration < tapMaxDuration) {
            e.preventDefault();
            if (!pImg.image.animation.is_playing) {
              pImg.functions.animation.start();
            }
          }
        }
        touchStartX = null;
        touchStartY = null;
        touchStartTime = null;
      }, { passive: false });
    }
    
    // Setup event actions for secondary particles if enabled
    if (pImg.secondary_particles_config && pImg.secondary_particles_config.interactivity && pImg.secondary_particles_config.interactivity.enabled) {
 
      
      // Initialize fn_array if not exists
      if (!pImg.secondary_particles_config.interactivity_fn_array) {
        pImg.secondary_particles_config.interactivity_fn_array = [];
      }
      
      // Setup custom event actions for secondary particles
      // First ensure secondary particles inherit primary particle actions as defaults
      if (pImg.particles.interactivity.on_hover.enabled && !pImg.secondary_particles_config.interactivity.on_hover) {
        pImg.secondary_particles_config.interactivity.on_hover = pImg.particles.interactivity.on_hover;
      }
      if (pImg.particles.interactivity.on_click.enabled && !pImg.secondary_particles_config.interactivity.on_click) {
        pImg.secondary_particles_config.interactivity.on_click = pImg.particles.interactivity.on_click;
      }
      if (pImg.particles.interactivity.on_touch.enabled && !pImg.secondary_particles_config.interactivity.on_touch) {
        pImg.secondary_particles_config.interactivity.on_touch = pImg.particles.interactivity.on_touch;
      }
      
      // Then setup event actions
      pImg.functions.utils.addEventActions('on_hover', pImg.secondary_particles_config);
      pImg.functions.utils.addEventActions('on_click', pImg.secondary_particles_config);
      pImg.functions.utils.addEventActions('on_touch', pImg.secondary_particles_config);
    }
  };

  pImg.functions.interactivity.interactWithClient = function(p) {
    // Skip all particle interactions during animation playback
    if (pImg.interactivityDisabled) {
      return;
    }

    // Skip hover interactions during animation playback, but allow touch interactions
    if (pImg.image.animation && pImg.image.animation.is_playing) {
      // Check if there's active touch/mouse input
      if (pImg.mouse.x == null || pImg.mouse.y == null) {
        return; // Skip if no active input
      }
      // Allow touch interactions during animation
    }
    
    // Check if this is a secondary particle
    const isSecondary = pImg.secondary_particles_config && 
                      pImg.particles.secondary_array.includes(p);
    
    if (isSecondary) {
      // Handle secondary particle interactivity
      if (!pImg.secondary_particles_config.interactivity || !pImg.secondary_particles_config.interactivity.enabled) {
        return; // No interactivity configured or explicitly disabled for secondary particles
      }
      
      // Use the gentle secondary particle repulse function
      pImg.functions.interactivity.onMouseMove(
        pImg.functions.interactivity.repulseSecondaryParticle, 
        pImg.interactions[pImg.particles.interactivity.on_hover.action], 
        p
      );
    } else {
      // Handle primary particle interactivity
      for (let func of pImg.particles.interactivity.fn_array) {
        func(p, pImg.interactions[pImg.particles.interactivity.on_hover.action]);
      }
    }
  };

/*
  ========================================
  =    CONFIGURATION INHERITANCE       =
  ========================================
  */

  pImg.functions.utils.clamp = function(n, min, max) {
    return Math.min(Math.max(n, min), max);
  };

  pImg.functions.utils.debounce = function(func, min_interval) {
    let timer;
    return function(event) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(func, min_interval, event);
    };
  };

  // Viewport detection function
  pImg.functions.utils.getViewportSize = function() {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  };

  // Dynamic responsive size calculation function
  pImg.functions.utils.calculateResponsiveSize = function() {
    const sizeConfig = pImg.particles.size;

    // Check if responsive sizing is enabled
    if (!sizeConfig.responsive || !sizeConfig.responsive.enabled) {
      return sizeConfig.value;
    }

    const viewport = pImg.functions.utils.getViewportSize();
    const responsive = sizeConfig.responsive;
    const breakpoints = responsive.breakpoints;

    let multiplier = responsive.base_multiplier || 1.0;

    // Apply breakpoint-based multiplier
    if (breakpoints) {
      if (breakpoints.mobile && viewport.width <= breakpoints.mobile.max_width) {
        multiplier = breakpoints.mobile.multiplier;
      } else if (breakpoints.tablet && viewport.width <= breakpoints.tablet.max_width) {
        multiplier = breakpoints.tablet.multiplier;
      } else if (breakpoints.desktop) {
        multiplier = breakpoints.desktop.multiplier;
      }
    }

    const calculatedSize = sizeConfig.value * multiplier;

    // Clamp to min/max bounds
    return pImg.functions.utils.clamp(
      calculatedSize,
      responsive.min_size || 0.8,
      responsive.max_size || 4.0
    );
  };

  // Dynamic responsive density calculation function
  pImg.functions.utils.calculateResponsiveDensity = function() {
    if (!pImg.particles.responsive.enabled) {
      return pImg.particles.responsive.density.base_density;
    }
    
    const viewport = pImg.functions.utils.getViewportSize();
    const densityConfig = pImg.particles.responsive.density;
    
    // Calculate dynamic density based on viewport width
    // Smaller screens = fewer particles, larger screens = more particles
    const viewportRatio = viewport.width / densityConfig.base_viewport;
    const dynamicDensity = densityConfig.min_density + 
      (viewportRatio - 0.5) * densityConfig.scale_factor * viewport.width;
    
    return pImg.functions.utils.clamp(
      dynamicDensity,
      densityConfig.min_density,
      densityConfig.max_density
    );
  };
  
  pImg.functions.utils.addEventActions = function(event, config = pImg) {
    const action_funcs = {
      repulse: pImg.functions.interactivity.repulseParticle,
      big_repulse: pImg.functions.interactivity.repulseParticle,
      grab: pImg.functions.interactivity.grabParticle
    };
    let event_wrapper = event === 'on_click' ? pImg.functions.interactivity.onMouseClick : pImg.functions.interactivity.onMouseMove;
    
    // Handle both primary and secondary particle configurations
    const isPrimary = config === pImg;
    const particlesConfig = isPrimary ? config.particles : config;
    const interactionsConfig = isPrimary ? config.interactions : pImg.interactions;
    const fnArrayTarget = isPrimary ? pImg.particles.interactivity.fn_array : config.interactivity_fn_array;
    
    // Defensive check for interactivity structure
    if (particlesConfig && particlesConfig.interactivity && particlesConfig.interactivity[event] && particlesConfig.interactivity[event].enabled) {
      const action = particlesConfig.interactivity[event].action;
      const func = action_funcs[action];
      const args = interactionsConfig[action];
      
      if (func && args) {
        const partial_func = event_wrapper.bind(null, func, args);
        fnArrayTarget.push(partial_func);
      }
    }
  };

  /*
  ========================================
  =           LAUNCH FUNCTIONS           =
  ========================================
  */
  pImg.functions.launch = function() {
    pImg.functions.interactivity.addEventListeners();
    pImg.functions.canvas.init();
    pImg.functions.image.init();
  };

  if (!pImg.disabled) {
    pImg.functions.launch();
  }
};

/*
========================================
=           GLOBAL FUNCTIONS           =
========================================
*/
Object.deepExtend = function(destination, source) {
  // credit: https://andrewdupont.net/2009/08/28/deep-extending-objects-in-javascript/
  for (let property in source) {
    if (source[property] && source[property].constructor &&
     source[property].constructor === Object) {
      destination[property] = destination[property] || {};
      arguments.callee(destination[property], source[property]);
    } else {
      destination[property] = source[property];
    }
  }
  return destination;
};



window.requestAnimFrame = (function() {
  return  window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame    ||
    window.oRequestAnimationFrame      ||
    window.msRequestAnimationFrame     ||
    function(callback) {
      window.setTimeout(callback, 1000 / 60);
    };
})();

window.cancelRequestAnimFrame = (function() {
  return window.cancelAnimationFrame         ||
    window.webkitCancelRequestAnimationFrame ||
    window.mozCancelRequestAnimationFrame    ||
    window.oRequestAnimationFrame      ||
    window.msRequestAnimationFrame     ||
    clearTimeout
})();

window.pImgDom = [];
window.particleImageInitialized = false;

window.particleImageDisplay = function(tag_id) {

  
  // Global initialization check to prevent multiple instances
  if (window.particleImageInitialized) {

    return;
  }
  
  // Check if instance already exists for this tag_id
  const existingInstance = pImgDom.find(instance => instance.canvas?.parentElement?.id === tag_id);
  if (existingInstance) {

    return; // Already initialized, don't create another instance
  }

  // get target element by ID, check for existing canvases
  const pImage_el = document.getElementById(tag_id),
      canvas_classname = 'particle-image-canvas-el',
      existing_canvases = pImage_el.getElementsByClassName(canvas_classname);



  // remove any existing canvases within div
  if (existing_canvases.length) {
    while(existing_canvases.length > 0){
      pImage_el.removeChild(existing_canvases[0]);
    }
  }

  // create canvas element, set size, append to target element
  const canvas_el = document.createElement('canvas');
  canvas_el.className = canvas_classname;
  canvas_el.style.width = "100%";
  canvas_el.style.height = "100%";

  const canvas = document.getElementById(tag_id).appendChild(canvas_el);


  if(canvas != null){
    // get params.json filepath from load parameters from element's data-params-src property
    const params_json = pImage_el.dataset.paramsSrc,
      xhr = new XMLHttpRequest();
    xhr.overrideMimeType("application/json")
    xhr.open("GET", params_json, false);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {

          // parse parameters & launch display
        const params = JSON.parse(xhr.responseText);

        pImgDom.push(new ParticleImageDisplayer(tag_id, canvas, params));
        window.particleImageInitialized = true; // Mark as globally initialized

      } else {

      }
    };
    xhr.send();
  }
};

// Global utility functions
window.randIntInRange = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Helper to get particle instance by ID
function getParticleInstance(tag_id) {
  return pImgDom.find(instance => instance.canvas?.parentElement?.id === tag_id);
}

// Global animation controls for chest sprite animation
window.particleAnimationControls = {
  // Click to play animation from beginning (same as clicking canvas)
  play: function(tag_id = 'particle-image') {
    const pImgInstance = getParticleInstance(tag_id);
    pImgInstance?.functions.animation.start();
  },
  
  pause: function(tag_id = 'particle-image') {
    const pImgInstance = getParticleInstance(tag_id);
    pImgInstance?.functions.animation.stop();
  },
  
  stop: function(tag_id = 'particle-image') {
    this.pause(tag_id);
    this.setFrame(0, tag_id);
  },
  
  setFrame: function(frameNum, tag_id = 'particle-image') {
    const pImgInstance = getParticleInstance(tag_id);
    pImgInstance?.functions.animation.setFrame(frameNum);
  },
  
  nextFrame: function(tag_id = 'particle-image') {
    const pImgInstance = getParticleInstance(tag_id);
    if (pImgInstance) {
      const frames = pImgInstance.image.animation.frames;
      const currentIndex = frames.indexOf(pImgInstance.image.animation.current_frame);
      const nextIndex = (currentIndex + 1) % frames.length;
      this.setFrame(frames[nextIndex], tag_id);
    }
  },
  
  previousFrame: function(tag_id = 'particle-image') {
    const pImgInstance = getParticleInstance(tag_id);
    if (pImgInstance) {
      const frames = pImgInstance.image.animation.frames;
      const currentIndex = frames.indexOf(pImgInstance.image.animation.current_frame);
      const prevIndex = currentIndex === 0 ? frames.length - 1 : currentIndex - 1;
      this.setFrame(frames[prevIndex], tag_id);
    }
  },
  
  setSpeed: function(speedMultiplier, tag_id = 'particle-image') {
    const pImgInstance = getParticleInstance(tag_id);
    if (pImgInstance) {
      pImgInstance.image.animation.frame_duration_ms = 150 / speedMultiplier;
    }
  },
  
  isPlaying: function(tag_id = 'particle-image') {
    const pImgInstance = getParticleInstance(tag_id);
    return pImgInstance?.image.animation.is_playing || false;
  },
  
  getCurrentFrame: function(tag_id = 'particle-image') {
    const pImgInstance = getParticleInstance(tag_id);
    return pImgInstance?.image.animation.current_frame || null;
  }
};

// Global configuration merger for secondary particles
window.mergeSecondaryConfig = function(primary, secondary) {
  // Deep clone primary config as base (always inherit)
  const merged = JSON.parse(JSON.stringify(primary));
  
  // Apply secondary overrides only where explicitly defined
  for (let [key, value] of Object.entries(secondary)) {
    // Skip meta fields
    if (key === 'enabled') {
      continue;
    }
    
    // Only override if secondary has a non-undefined value
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Deep merge objects
        merged[key] = Object.deepExtend(merged[key] || {}, value);
      } else {
        // Direct value override
        merged[key] = value;
      }
    }
  }
  
  return merged;
};

// Only initialize if not already done

if (!window.particleImageInitialized) {

  window.particleImageDisplay("particle-image");
} else {

}