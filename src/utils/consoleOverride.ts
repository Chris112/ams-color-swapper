/**
 * Disables all console methods in production to prevent any console output
 */
export function disableConsoleInProduction(): void {
  if (import.meta.env?.PROD) {
    const noop = () => {};

    // List of all console methods to override
    const consoleMethods = [
      'log',
      'debug',
      'info',
      'warn',
      'error',
      'trace',
      'dir',
      'dirxml',
      'group',
      'groupEnd',
      'groupCollapsed',
      'time',
      'timeEnd',
      'timeLog',
      'count',
      'countReset',
      'assert',
      'profile',
      'profileEnd',
      'table',
      'clear',
    ] as const;

    // Override each method with a no-op function
    consoleMethods.forEach((method) => {
      if (method in console) {
        (console[method] as unknown) = noop;
      }
    });

    // Also override console itself to prevent console.anyNewMethod
    const consoleProxy = new Proxy(console, {
      get: () => noop,
      set: () => true,
    }) as unknown as Console;

    // Replace global console
    window.console = consoleProxy;
  }
}
