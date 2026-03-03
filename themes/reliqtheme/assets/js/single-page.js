// Single Page Scrolling Navigation
class SinglePageNavigation {
  constructor() {
    this.navLinks = document.querySelectorAll('.scroll-link')
    this.navContainer = document.querySelector('.header__nav')
    this.sections = document.querySelectorAll('section[id]')
    this.isManualScrolling = false
    this.scrollTimeout = null
    
    this.init()
  }

  init() {
    this.setupSmoothScroll()
    this.setupScrollSpy()
    this.setupScrollFadeIn()
    this.setInitialActiveLink()
  }

  setupScrollFadeIn() {
    const fadeElements = document.querySelectorAll('.page-section')
    
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.15
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    }, observerOptions)

    fadeElements.forEach(el => {
      observer.observe(el)
    })
  }

  setInitialActiveLink() {
    // Dynamically calculate offset for consistency with scrollToSection
    const header = document.querySelector('.header')
    const headerNav = document.querySelector('.header__nav')
    let headerOffset = 80 // fallback minimum
    
    if (header) {
      headerOffset = header.offsetHeight
    }
    if (headerNav) {
      headerOffset = Math.max(headerOffset, headerNav.offsetHeight)
    }
    const buffer = 50 // slightly larger buffer for initial check
    
    // Check if there's a hash in the URL
    const hash = window.location.hash
    if (hash) {
      const sectionId = hash.replace('#', '')
      this.setActiveLink(sectionId)
    } else {
      // Find the first visible section
      const scrollPosition = window.scrollY + headerOffset + buffer
      for (const section of this.sections) {
        const sectionTop = section.offsetTop
        const sectionHeight = section.offsetHeight
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
          const id = section.getAttribute('id')
          this.setActiveLink(id)
          break
        }
      }
    }
  }

  setupSmoothScroll() {
    this.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        let targetId = link.getAttribute('href')

        // Handle URLs that have a path before the hash
        const hashIndex = targetId.indexOf('#')
        if (hashIndex !== -1) {
          targetId = targetId.substring(hashIndex)
        }

        if (targetId.startsWith('#')) {
          const targetElement = document.querySelector(targetId)
          if (targetElement) {
            // Immediately set active state on click
            const sectionId = targetId.replace('#', '')
            this.setActiveLink(sectionId)
            this.isManualScrolling = true
            this.scrollToSection(targetElement)

            // Clear any existing timeout
            if (this.scrollTimeout) {
              clearTimeout(this.scrollTimeout)
            }

            // Re-enable scroll spy after scroll animation completes (approx 800ms)
            this.scrollTimeout = setTimeout(() => {
              this.isManualScrolling = false
            }, 900)
          }
        }
      })
    })
  }

  scrollToSection(element) {
    // Dynamically calculate header offset to handle different screen sizes
    const header = document.querySelector('.header')
    const headerNav = document.querySelector('.header__nav')
    let headerOffset = 80 // fallback minimum
    
    if (header) {
      headerOffset = header.offsetHeight
    }
    // Account for header__nav if it's rendered separately
    if (headerNav) {
      const navHeight = headerNav.offsetHeight
      // Use whichever is larger
      headerOffset = Math.max(headerOffset, navHeight)
    }
    
    // Add a small buffer for visual comfort
    const buffer = 20
    const finalOffset = headerOffset + buffer
    
    const elementPosition = element.getBoundingClientRect().top
    const offsetPosition = window.pageYOffset + elementPosition - finalOffset
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    })
  }

  setupScrollSpy() {
    const updateActiveLink = () => {
      if (this.isManualScrolling) return

      const scrollPosition = window.scrollY + window.innerHeight / 2

      let currentSection = null
      
      for (const section of this.sections) {
        const sectionTop = section.offsetTop
        const sectionHeight = section.offsetHeight
        
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
          currentSection = section
          break
        }
      }

      if (currentSection) {
        const id = currentSection.getAttribute('id')
        this.setActiveLink(id)
      }
    }

    window.addEventListener('scroll', updateActiveLink, { passive: true })
    updateActiveLink()
  }

  setActiveLink(sectionId) {
    this.navLinks.forEach(link => {
      link.classList.remove('active')
      const href = link.getAttribute('href')
      // Handle both "#section" and "/#section" formats
      if (href === `#${sectionId}` || href.endsWith(`#${sectionId}`)) {
        link.classList.add('active')
      }
    })
  }

}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.scroll-link')
  if (navLinks.length > 0) {
    new SinglePageNavigation()
  }
})