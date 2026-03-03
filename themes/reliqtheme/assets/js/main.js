// Fade-in animation handler
const initFadeInAnimations = () => {
  // Fade in header with background at the same time
  const header = document.querySelector('.header')
  if (header) {
    setTimeout(() => {
      header.classList.add('fade-in', 'nav-visible')
    }, 100)
  }
  
  // Fade in logo and nav after a delay
  const logo = document.querySelector('.logo')
  if (logo) {
    setTimeout(() => {
      logo.classList.add('fade-in')
    }, 150)
  }

  // Fade in nav after a delay
  const nav = document.querySelector('.header__nav')
  if (nav) {
    setTimeout(() => {
      nav.classList.add('fade-in')
    }, 200)
  }

  // Fade in footer immediately (with slight delay)
  const footer = document.querySelector('.footer')
  if (footer) {
    setTimeout(() => {
      footer.classList.add('fade-in')
    }, 200)
  }

  // Fade in main content immediately (like header)
  const mainContent = document.getElementById('main-content')
  if (mainContent) {
    setTimeout(() => {
      mainContent.classList.add('fade-in')
      document.body.classList.add('content-visible') // Enable scrolling
    }, 300)
  }

  // Fade in scroll indicator
  const scrollIndicator = document.querySelector('.scroll-indicator')
  if (scrollIndicator) {
    setTimeout(() => {
      scrollIndicator.classList.add('fade-in')
    }, 400)
  }

  // Fade in particles once they're ready
  const particleCanvas = document.getElementById('particle-image')
  if (particleCanvas) {
    // Listen for particle initialization event
    const startParticleFadeIn = () => {
      particleCanvas.classList.add('fade-in')
    }

    // Check if particles already started, otherwise listen for the event
    if (window.particleImageDisplayerReady) {
      startParticleFadeIn()
    } else {
      document.addEventListener('particleImageReady', startParticleFadeIn)
      // Fallback: fade in after a reasonable timeout if event never fires
      setTimeout(startParticleFadeIn, 2000)
    }
  }
}

// Contact form handling
const setupContactForm = () => {
  const contactForm = document.getElementById('contactForm')
  if (!contactForm) return

  const resultDiv = document.getElementById('result')
  const submitButton = contactForm.querySelector('button[type="submit"]')

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    // Show loading state
    submitButton.textContent = 'Sending...'
    submitButton.disabled = true
    resultDiv.textContent = 'Sending message...'
    resultDiv.className = 'contact-result'

    const formData = new FormData(e.target)
    // Add origin field to identify which site the submission is from
    formData.append('origin', 'reliqlabs')
    // Add recipient email
    formData.append('to', 'hi@reliqlabs.com')

    try {
      const res = await fetch('/vulkan/web_contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
      })

      const data = await res.json()

      if (res.ok) {
        // Fade out form and show thank you message
        const fadeOutDuration = 600

        contactForm.style.transition = `opacity ${fadeOutDuration}ms ease-out`
        resultDiv.style.transition = `opacity ${fadeOutDuration}ms ease-out`
        contactForm.style.opacity = '0'
        resultDiv.style.opacity = '0'

        setTimeout(() => {
          contactForm.style.display = 'none'
          resultDiv.textContent = 'Thanks for reaching out! Talk soon.'
          resultDiv.className = 'contact-result success'
          resultDiv.style.display = 'block'

          setTimeout(() => {
            resultDiv.style.transition = `opacity ${fadeOutDuration}ms ease-in`
            resultDiv.style.opacity = '1'
          }, 100)
        }, fadeOutDuration)
      } else {
        // Display error message
        let errorMessage = 'Error, please try again later'
        if (data.error) {
          errorMessage = `Error: ${data.error}`
        }
        resultDiv.textContent = errorMessage
        resultDiv.className = 'contact-result error'
      }
    } catch (err) {
      resultDiv.textContent = 'Error, please try again later'
      resultDiv.className = 'contact-result error'
    } finally {
      submitButton.textContent = 'Send Message'
      submitButton.disabled = false
    }
  })
}

// Scroll to top on page load/reload
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
}
window.scrollTo(0, 0)

// Main coordinator for particle animation and content loading
document.addEventListener('DOMContentLoaded', () => {
    // Scroll to top
    window.scrollTo(0, 0)

    // Initialize fade-in animations (includes main content)
    initFadeInAnimations()

    // Initialize contact form
    setupContactForm()
})