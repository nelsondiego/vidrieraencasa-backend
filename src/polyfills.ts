// Polyfill for Headers.prototype.raw required by mercadopago
// The mercadopago SDK expects a node-fetch style Headers object with a raw() method.
// Cloudflare Workers provides a standard Web Headers object which lacks this method.

if (typeof Headers !== 'undefined' && !('raw' in Headers.prototype)) {
  Object.defineProperty(Headers.prototype, 'raw', {
    value: function() {
      const res: Record<string, string[]> = {};
      this.forEach((value: string, key: string) => {
        res[key] = [value];
      });
      return res;
    },
    enumerable: false,
    writable: true
  });
}

// Export something to ensure this file is treated as a module
export {};
