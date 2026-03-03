// Mobile Dial Navigation
;(function() {
  'use strict'
  
  function initMobileDialNav() {
    var dialNav = document.querySelector('.mobile-dial-nav')
    if (!dialNav) return

    var tab = dialNav.querySelector('.mobile-dial-tab')
    var wheel = dialNav.querySelector('.mobile-dial-wheel')
    var wheelContainer = dialNav.querySelector('.mobile-dial-wheel__container')
    var items = dialNav.querySelectorAll('.mobile-dial-wheel__item')
    
    if (!tab || !wheel || items.length === 0) return

    // Configuration
    var config = {
      wheelRadius: 135,
      containerSize: 400
    }

    var isOpen = false
    var currentRotation = 0
    var isDragging = false
    var startY = 0
    var lastY = 0
    var velocity = 0
    var animationId = null
    var isUserScrolling = false
    var scrollTimeout = null

    // Position items on the wheel with their text rotated
    function positionItems() {
      // Clear existing items first
      var existingItems = wheelContainer.querySelectorAll('.mobile-dial-wheel__item')
      existingItems.forEach(function(item) {
        item.remove()
      })

      // Calculate how many repeats we need for good spacing
      var baseItems = items.length // actual unique menu items
      var desiredSpacing = 30 // degrees between items (denser repetition)
      var totalItemsNeeded = Math.ceil(360 / desiredSpacing)
      var repeatsNeeded = Math.ceil(totalItemsNeeded / baseItems)
      
      // Duplicate items and add them to wheel
      var createdItems = 0
      for (let repeat = 0; repeat < repeatsNeeded; repeat++) {
        items.forEach(function(originalItem) {
          var newItem = originalItem.cloneNode(true)
          newItem.classList.add('mobile-dial-wheel__item')
          newItem.setAttribute('href', originalItem.getAttribute('href'))
          newItem.dataset.section = originalItem.dataset.section
          wheelContainer.appendChild(newItem)
          createdItems++
        })
      }

      // Update items reference to point to newly created items
      items = wheelContainer.querySelectorAll('.mobile-dial-wheel__item')

      // Attach click handlers to all items
      items.forEach(function(item) {
        item.addEventListener('click', function(e) {
          e.preventDefault()
          e.stopPropagation()
          
          var targetHref = item.getAttribute('href')
          
          // Handle URLs that have a path before the hash
          var hashIndex = targetHref.indexOf('#')
          if (hashIndex !== -1) {
            targetHref = targetHref.substring(hashIndex)
          }
          
          // Rotate wheel and scroll after rotation completes
          rotateToItem(item, function() {
            scrollToSection(targetHref)
          })
        })
      })

      // Position all created items on the wheel
      var center = config.containerSize / 2

      items.forEach(function(item, index) {
        // Calculate angle around full 360° circle
        var angleDeg = index * (360 / createdItems)
        var angleRad = (angleDeg * Math.PI) / 180

        // Calculate position on circle circumference
        var x = center + (Math.cos(angleRad) * config.wheelRadius)
        var y = center + (Math.sin(angleRad) * config.wheelRadius)

        // Text rotates with wheel naturally (prize wheel style)
        // Add 180° offset so text is upright when at any position
        var textRotation = angleDeg + 180

        item.style.left = x + 'px'
        item.style.top = y + 'px'
        item.style.transform = 'translate(-50%, -50%) rotate(' + textRotation + 'deg)'
        
        item.dataset.angle = angleDeg
        item.dataset.index = index
      })

      updateSelectedItem()
    }

// Update selected item - highlight the one at 9 o'clock
function updateSelectedItem() {
  var targetAngle = 180 // 9 o'clock position
  var selectionThreshold = 30 // degrees within which to consider an item selected
  
  // Find which item is closest to 9 o'clock
  var closestItem = null
  var closestDistance = Infinity
  
  var allWheelItems = wheelContainer.querySelectorAll('.mobile-dial-wheel__item')
  allWheelItems.forEach(function(item, index) {
    var itemAngle = parseFloat(item.dataset.angle)
    var effectiveAngle = itemAngle + currentRotation
    effectiveAngle = ((effectiveAngle % 360) + 360) % 360
    
    var distance = Math.abs(effectiveAngle - targetAngle)
    if (distance > 180) distance = 360 - distance
    
    // Compute blur based on distance (0-180 degrees). Closer items get less blur, increasing faster.
    const maxBlur = 6 // increased maximum blur for stronger effect
    const minBlur = 0.5 // minimum blur for near items (above/below 9 o'clock)
    // Use exponential scaling to make blur increase faster with distance
    let blur = Math.pow(distance / 180, 1.5) * maxBlur
    if (blur < minBlur) blur = minBlur
    // Selected (closest) item gets no blur
    if (distance < 20) {
      item.style.filter = 'none'
    } else {
      item.style.filter = 'blur(' + blur.toFixed(2) + 'px)'
    }
    
    // Update opacity based on distance (optional visual cue)
    if (distance < 20) {
      item.style.opacity = 1
    } else if (distance < 80) {
      item.style.opacity = 0.6
    } else {
      item.style.opacity = 0.3
    }
    
    if (distance < closestDistance) {
      closestDistance = distance
      closestItem = item
    }
    
    // Remove selected class from all items first
    item.classList.remove('is-selected')
  })
  
  // Add selected class to closest item
  if (closestItem && closestDistance < selectionThreshold) {
    closestItem.classList.add('is-selected')
  }
}


    // Apply rotation to wheel only - items rotate with it naturally
    function applyRotation() {
      if (wheelContainer) {
        wheelContainer.style.transform = 'rotate(' + currentRotation + 'deg)'
      }
      
      // Items are children of wheel container, so they rotate with it
      // Text rotation was set once in positionItems and never changes
      updateSelectedItem()
    }

    // Rotate wheel to bring specific item to 9 o'clock
    function rotateToItem(item, callback) {
      var itemAngle = parseFloat(item.dataset.angle)
      var targetAngle = 180 // 9 o'clock
      
      // Calculate the item's current effective angle (item's base angle + current rotation)
      var effectiveAngle = itemAngle + currentRotation
      // Normalize to 0-360
      effectiveAngle = ((effectiveAngle % 360) + 360) % 360
      
      // Calculate how much we need to rotate to bring this item to 9 o'clock
      var rotationDelta = targetAngle - effectiveAngle
      
      // Normalize to shortest rotation path (-180 to 180)
      if (rotationDelta > 180) rotationDelta -= 360
      if (rotationDelta < -180) rotationDelta += 360
      
      var startRotation = currentRotation
      var endRotation = currentRotation + rotationDelta
      var duration = 400
      var startTime = performance.now()

      function animateSnap(currentTime) {
        var elapsed = currentTime - startTime
        var progress = Math.min(elapsed / duration, 1)
        var easeProgress = 1 - Math.pow(1 - progress, 3)
        
        currentRotation = startRotation + (endRotation - startRotation) * easeProgress
        applyRotation()

        if (progress < 1) {
          requestAnimationFrame(animateSnap)
        } else {
          // Rotation complete, call callback if provided
          if (callback) callback()
        }
      }

      requestAnimationFrame(animateSnap)
    }

    // Scroll to section
    function scrollToSection(targetId) {
      // Set flag to prevent scroll spy from interfering
      isUserScrolling = true
      
      // Clear any existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      
      // Handle URLs that have a path before the hash
      var hashIndex = targetId.indexOf('#')
      if (hashIndex !== -1) {
        targetId = targetId.substring(hashIndex)
      }
      
      var targetElement = document.querySelector(targetId)
      if (targetElement) {
        const elementRect = targetElement.getBoundingClientRect()
        const elementTop = window.pageYOffset + elementRect.top
        window.scrollTo({
          top: elementTop,
          behavior: 'smooth'
        })
        history.pushState(null, null, targetId)
      }
      
      // Clear the flag after scroll animation completes (give it enough time for long scrolls)
      scrollTimeout = setTimeout(function() {
        isUserScrolling = false
      }, 1500)
    }

    // Set active item based on section ID (called by scroll spy)
    function setActiveItem(sectionId) {
      // Don't update if user is currently interacting with the wheel
      if (isDragging || isUserScrolling) return
      
      var matchingItem = null
      var allWheelItems = wheelContainer.querySelectorAll('.mobile-dial-wheel__item')
      
      // Find the item matching this section
      allWheelItems.forEach(function(item) {
        var href = item.getAttribute('href')
        // Handle URLs that have a path before the hash
        var hashIndex = href.indexOf('#')
        if (hashIndex !== -1) {
          href = href.substring(hashIndex)
        }
        
        if (!matchingItem && href === '#' + sectionId) {
          matchingItem = item
        }
      })
      
      // Only rotate if we found a matching item that's not already near the target position
      if (matchingItem) {
        var itemAngle = parseFloat(matchingItem.dataset.angle)
        var effectiveAngle = itemAngle + currentRotation
        effectiveAngle = ((effectiveAngle % 360) + 360) % 360
        var targetAngle = 180 // 9 o'clock
        var distance = Math.abs(effectiveAngle - targetAngle)
        if (distance > 180) distance = 360 - distance
        
        // If already within 10 degrees, no need to rotate (avoid unnecessary spins)
         if (distance > 10) {
           rotateToItem(matchingItem)
         }
       }
     }

    // Snap to nearest item - rotate wheel so closest item to 9 o'clock stays there
    function snapToNearest() {
      var targetAngle = 180 // 9 o'clock
      
      // Find which item is currently closest to 9 o'clock
      var closestItem = null
      var closestDistance = Infinity
      var closestItemAngle = 0

      var allWheelItems = wheelContainer.querySelectorAll('.mobile-dial-wheel__item')
      allWheelItems.forEach(function(item) {
        var itemAngle = parseFloat(item.dataset.angle)
        var effectiveAngle = itemAngle + currentRotation
        effectiveAngle = ((effectiveAngle % 360) + 360) % 360
        
        var distance = Math.abs(effectiveAngle - targetAngle)
        if (distance > 180) distance = 360 - distance

        if (distance < closestDistance) {
          closestDistance = distance
          closestItem = item
          closestItemAngle = itemAngle
        }
      })

      if (closestItem) {
        // Store href for scrolling after snap
        var targetHref = closestItem.getAttribute('href')
        
        // Calculate how much we need to rotate to bring this item to 9 o'clock
        const effectiveAngle = ((closestItemAngle + currentRotation) % 360 + 360) % 360
        let rotationNeeded = targetAngle - effectiveAngle
        
        // Normalize to shortest rotation path
        if (rotationNeeded > 180) rotationNeeded -= 360
        if (rotationNeeded < -180) rotationNeeded += 360

        const startRotation = currentRotation
        const endRotation = currentRotation + rotationNeeded
        const duration = 400
        const startTime = performance.now()

        function animateSnap(currentTime) {
          var elapsed = currentTime - startTime
          var progress = Math.min(elapsed / duration, 1)
          var easeProgress = 1 - Math.pow(1 - progress, 3)
          
          currentRotation = startRotation + (endRotation - startRotation) * easeProgress
          applyRotation()

          if (progress < 1) {
            requestAnimationFrame(animateSnap)
          } else {
            // Snap complete - scroll to the selected section
            if (targetHref) {
              scrollToSection(targetHref)
            }
          }
        }

        requestAnimationFrame(animateSnap)
      }
    }

    // Toggle wheel
    function toggleWheel() {
      isOpen = !isOpen
      
      if (isOpen) {
        wheel.classList.add('is-open')
        tab.classList.add('is-open')
      } else {
        wheel.classList.remove('is-open')
        tab.classList.remove('is-open')
      }
    }

    // Drag handlers
    function handleStart(e) {
      if (!isOpen) return
      isDragging = true
      startY = e.type.indexOf('mouse') !== -1 ? e.clientY : e.touches[0].clientY
      lastY = startY
      velocity = 0
      
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }

    function handleMove(e) {
      if (!isDragging || !isOpen) return
      e.preventDefault()
      
      var currentY = e.type.indexOf('mouse') !== -1 ? e.clientY : e.touches[0].clientY
      var deltaY = currentY - lastY
      lastY = currentY
      
      velocity = -deltaY * 0.3
      currentRotation += velocity
      
      applyRotation()
    }

    function handleEnd() {
      if (!isDragging) return
      isDragging = false
      
      function applyMomentum() {
        if (Math.abs(velocity) > 0.5) {
          velocity *= 0.95
          currentRotation += velocity
          applyRotation()
          animationId = requestAnimationFrame(applyMomentum)
        } else {
          snapToNearest()
        }
      }
      
      applyMomentum()
    }

    // Event listeners
    tab.addEventListener('click', function(e) {
      e.preventDefault()
      e.stopPropagation()
      toggleWheel()
    })

    wheel.addEventListener('touchstart', handleStart, { passive: false })
    wheel.addEventListener('touchmove', handleMove, { passive: false })
    wheel.addEventListener('touchend', handleEnd)

    wheel.addEventListener('mousedown', handleStart)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleEnd)

    // Close when clicking outside
    document.addEventListener('click', function(e) {
      // Check if wheel is open and click is outside wheel and tab
      var clickedWheel = wheel.contains(e.target)
      var clickedTab = tab.contains(e.target)
      
      if (isOpen && !clickedWheel && !clickedTab) {
        isOpen = false
        tab.classList.remove('is-open')
        wheel.classList.remove('is-open')
      }
    })

    // Close when scrolling on the page (immediate, with smooth CSS transition)
    window.addEventListener('scroll', function() {
      if (isOpen) {
        isOpen = false
        tab.classList.remove('is-open')
        wheel.classList.remove('is-open')
      }
    }, { passive: true })

    // Setup scroll spy to update wheel selection
    function setupScrollSpy() {
      var sections = document.querySelectorAll('section[id]')
      
      if (sections.length === 0) return
      
      var observerOptions = {
        root: null,
        rootMargin: '-100px 0px -70% 0px',
        threshold: 0
      }

      var observer = new IntersectionObserver(function(entries) {
        // Don't update wheel if user just clicked an item (prevents jumping)
        if (isUserScrolling) return
        
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id')
            setActiveItem(id)
          }
        })
      }, observerOptions)

      sections.forEach(function(section) {
        observer.observe(section)
      })
    }

    // Initialize
    positionItems()
    setupScrollSpy()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileDialNav)
  } else {
    initMobileDialNav()
  }
})();
