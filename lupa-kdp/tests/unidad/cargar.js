// Carga las librerías de la extensión en Node (cuelgan todo de globalThis.LUPA).
await import('../../extension/lib/base.js');
await import('../../extension/lib/tiendas.js');
await import('../../extension/lib/regalias.js');
await import('../../extension/lib/estimacion.js');
export const L = globalThis.LUPA;
await import('../../extension/lib/historial.js');
await import('../../extension/lib/exportar.js');
await import('../../extension/lib/biblioteca.js');
