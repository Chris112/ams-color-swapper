// Animate number from 0 to target value
export const animateNumber = (
  element: HTMLElement,
  targetValue: number,
  duration: number = 1000,
  format?: (value: number) => string
): void => {
  const startTime = performance.now();
  const startValue = 0;

  const updateNumber = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const currentValue = startValue + (targetValue - startValue) * easeOutQuart;

    element.textContent = format ? format(currentValue) : Math.round(currentValue).toString();

    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    }
  };

  requestAnimationFrame(updateNumber);
};

// Add ripple effect to element
export const addRippleEffect = (element: HTMLElement): void => {
  element.classList.add('ripple');

  element.addEventListener('click', (e) => {
    const rect = element.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple-effect');

    element.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  });
};

// Magnetic hover effect
export const addMagneticEffect = (element: HTMLElement, strength: number = 0.3): void => {
  let bounds: DOMRect;

  const onMouseMove = (e: MouseEvent) => {
    const x = e.clientX - bounds.left - bounds.width / 2;
    const y = e.clientY - bounds.top - bounds.height / 2;

    const distance = Math.sqrt(x * x + y * y);
    const maxDistance = Math.max(bounds.width, bounds.height);

    if (distance < maxDistance) {
      const translateX = (x / maxDistance) * 20 * strength;
      const translateY = (y / maxDistance) * 20 * strength;

      element.style.transform = `translate(${translateX}px, ${translateY}px) scale(1.05)`;
    }
  };

  const onMouseEnter = () => {
    bounds = element.getBoundingClientRect();
    document.addEventListener('mousemove', onMouseMove);
  };

  const onMouseLeave = () => {
    document.removeEventListener('mousemove', onMouseMove);
    element.style.transform = '';
  };

  element.addEventListener('mouseenter', onMouseEnter);
  element.addEventListener('mouseleave', onMouseLeave);
};

// Stagger animation for lists
export const staggerAnimation = (
  container: HTMLElement,
  selector: string,
  animationClass: string,
  delay: number = 50
): void => {
  const elements = container.querySelectorAll(selector);

  elements.forEach((element, index) => {
    const el = element as HTMLElement;
    el.style.animationDelay = `${index * delay}ms`;
    el.classList.add(animationClass);
  });
};

// Add glow effect on hover
export const addGlowHover = (element: HTMLElement, color: string = 'pink'): void => {
  const glowClass = `shadow-glow-${color}`;

  element.addEventListener('mouseenter', () => {
    element.classList.add(glowClass);
  });

  element.addEventListener('mouseleave', () => {
    element.classList.remove(glowClass);
  });
};

// 3D tilt effect
export const add3DTiltEffect = (element: HTMLElement, maxTilt: number = 15): void => {
  let bounds: DOMRect;

  const onMouseMove = (e: MouseEvent) => {
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;

    const xPercent = (x / bounds.width - 0.5) * 2;
    const yPercent = (y / bounds.height - 0.5) * 2;

    const xDeg = xPercent * maxTilt;
    const yDeg = yPercent * maxTilt;

    element.style.transform = `perspective(1000px) rotateY(${xDeg}deg) rotateX(${-yDeg}deg) scale(1.02)`;
  };

  const onMouseEnter = () => {
    bounds = element.getBoundingClientRect();
    element.style.transition = 'transform 0.2s ease';
    document.addEventListener('mousemove', onMouseMove);
  };

  const onMouseLeave = () => {
    document.removeEventListener('mousemove', onMouseMove);
    element.style.transform = '';
  };

  element.addEventListener('mouseenter', onMouseEnter);
  element.addEventListener('mouseleave', onMouseLeave);
};
