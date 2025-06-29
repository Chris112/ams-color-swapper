/**
 * Type-safe DOM query utilities
 */

/**
 * Query for a required element, throwing an error if not found
 * @param parent - Parent element to search within
 * @param selector - CSS selector
 * @param context - Optional context for error message
 * @returns The found element
 * @throws Error if element not found
 */
export function requireElement<T extends Element = Element>(
  parent: Element | Document,
  selector: string,
  context?: string
): T {
  const element = parent.querySelector<T>(selector);
  if (!element) {
    const errorContext = context ? ` (${context})` : '';
    throw new Error(`Required element not found: ${selector}${errorContext}`);
  }
  return element;
}

/**
 * Query for an optional element
 * @param parent - Parent element to search within
 * @param selector - CSS selector
 * @returns The found element or null
 */
export function queryElement<T extends Element = Element>(
  parent: Element | Document,
  selector: string
): T | null {
  return parent.querySelector<T>(selector);
}

/**
 * Query for all elements matching selector
 * @param parent - Parent element to search within
 * @param selector - CSS selector
 * @returns Array of found elements (empty if none found)
 */
export function queryElements<T extends Element = Element>(
  parent: Element | Document,
  selector: string
): T[] {
  return Array.from(parent.querySelectorAll<T>(selector));
}

/**
 * Get element by ID, throwing if not found
 * @param id - Element ID (without #)
 * @param context - Optional context for error message
 * @returns The found element
 * @throws Error if element not found
 */
export function requireById<T extends HTMLElement = HTMLElement>(id: string, context?: string): T {
  const element = document.getElementById(id) as T | null;
  if (!element) {
    const errorContext = context ? ` (${context})` : '';
    throw new Error(`Required element not found by ID: ${id}${errorContext}`);
  }
  return element;
}

/**
 * Get element by ID
 * @param id - Element ID (without #)
 * @returns The found element or null
 */
export function getById<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Safely get an attribute value
 * @param element - Element to get attribute from
 * @param attribute - Attribute name
 * @param required - If true, throws if attribute missing
 * @returns Attribute value or null
 */
export function getAttribute(element: Element, attribute: string, required: true): string;
export function getAttribute(element: Element, attribute: string, required?: false): string | null;
export function getAttribute(element: Element, attribute: string, required = false): string | null {
  const value = element.getAttribute(attribute);
  if (required && value === null) {
    throw new Error(`Required attribute '${attribute}' not found on element ${element.tagName}`);
  }
  return value;
}

/**
 * Add event listener with proper typing
 * @param element - Element to attach listener to
 * @param event - Event name
 * @param handler - Event handler
 * @param options - Event listener options
 */
export function addTypedEventListener<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  event: K,
  handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
  options?: boolean | AddEventListenerOptions
): void {
  element.addEventListener(event, handler, options);
}

/**
 * Remove event listener with proper typing
 * @param element - Element to remove listener from
 * @param event - Event name
 * @param handler - Event handler
 * @param options - Event listener options
 */
export function removeTypedEventListener<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  event: K,
  handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
  options?: boolean | EventListenerOptions
): void {
  element.removeEventListener(event, handler, options);
}

/**
 * Type guard for HTMLElement
 */
export function isHTMLElement(element: Element): element is HTMLElement {
  return element instanceof HTMLElement;
}

/**
 * Type guard for HTMLInputElement
 */
export function isInputElement(element: Element): element is HTMLInputElement {
  return element instanceof HTMLInputElement;
}

/**
 * Type guard for HTMLSelectElement
 */
export function isSelectElement(element: Element): element is HTMLSelectElement {
  return element instanceof HTMLSelectElement;
}

/**
 * Type guard for HTMLTextAreaElement
 */
export function isTextAreaElement(element: Element): element is HTMLTextAreaElement {
  return element instanceof HTMLTextAreaElement;
}

/**
 * Type guard for HTMLButtonElement
 */
export function isButtonElement(element: Element): element is HTMLButtonElement {
  return element instanceof HTMLButtonElement;
}

/**
 * Cast element to specific type with runtime check
 */
export function castElement<T extends Element>(
  element: Element,
  constructor: new (...args: any[]) => T,
  context?: string
): T {
  if (!(element instanceof constructor)) {
    const errorContext = context ? ` (${context})` : '';
    throw new Error(`Element is not an instance of ${constructor.name}${errorContext}`);
  }
  return element;
}
